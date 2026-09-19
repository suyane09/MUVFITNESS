/* MUV FITNESS - Processa o pagamento vindo do Payment Brick (Checkout Bricks)
   ---------------------------------------------------------------------------
   Esta é a função que substitui o antigo fluxo de redirecionamento pro
   Mercado Pago (Checkout Pro / init_point, ver api/checkout.js — mantido
   apenas como referência/fallback, não é mais chamado pelo front-end).

   Fluxo novo:
     1) O cliente preenche cartão ou Pix DENTRO do próprio site, no Payment
        Brick (js/site.js). O Brick tokeniza os dados no navegador dele.
     2) O front-end manda esse "formData" (token, parcelas, e-mail etc. —
        NUNCA o número do cartão em texto puro) pra cá.
     3) Aqui no servidor, com o Access Token secreto, chamamos a API de
        pagamentos do Mercado Pago (POST /v1/payments) e devolvemos o
        resultado (aprovado / pendente / recusado) pro front-end mostrar
        na hora, sem sair da página.
     4) Pra Pix, o retorno inclui o QR Code / código "copia e cola"
        (point_of_interaction), que o Brick exibe automaticamente.

   E-mails de confirmação (Brevo):
     - "Pedido recebido": disparado logo depois que o Mercado Pago responde,
       desde que o pagamento não tenha sido recusado (aprovado, Pix pendente
       ou em análise) — avisa a cliente que o pedido chegou.
     - "Pagamento aprovado": quando o cartão é aprovado NA HORA, mandamos
       daqui mesmo. Pra Pix, o pagamento só é aprovado depois que a cliente
       paga o QR Code — nesse caso quem manda esse e-mail é o webhook
       (api/mercadopago-webhook.js), quando a confirmação chegar. Isso evita
       mandar e-mail de aprovação duplicado pro mesmo pedido.
     - Os dois envios usam `await`: em ambiente serverless (Vercel) a função
       pode ser encerrada assim que a resposta HTTP é mandada, e isso corta
       no meio qualquer fetch ainda em andamento — inclusive o do Brevo. Sem
       o await, o e-mail às vezes era enviado pela metade ou nem saía.

   Variáveis de ambiente necessárias (Vercel -> Settings -> Environment
   Variables), além de MP_ACCESS_TOKEN:
     BREVO_API_KEY      -> API key gerada em app.brevo.com (Settings -> API Keys)
     BREVO_SENDER_EMAIL -> e-mail remetente verificado no Brevo (ex:
                            pedidos@muvfitness.com.br). Se não configurar,
                            os e-mails simplesmente não são enviados.
*/

import { buildEmailHtml, buildOrderItemsHtml, SITE_URL } from './email-template.js';

async function sendBrevoEmail({ to, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail || !to) return;

  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        sender: { name: 'MUV FITNESS', email: senderEmail },
        replyTo: { name: 'MUV FITNESS', email: 'muvfiitness@gmail.com' },
        to: [{ email: to }],
        subject,
        htmlContent: html
      })
    });
    if (!r.ok) {
      console.error('[MUV e-mail] erro ao enviar:', await r.text());
    }
  } catch (err) {
    console.error('[MUV e-mail] erro inesperado ao enviar:', err);
  }
}

async function sendOrderPlacedEmail(order) {
  if (!order || !order.email) return;

  const html = buildEmailHtml({
    preheader: `Recebemos seu pedido ${order.orderNumber || ''} e já estamos cuidando dele.`,
    title: 'Recebemos seu pedido!',
    introHtml: `<p style="margin:0;">Recebemos seu pedido <strong>${order.orderNumber || ''}</strong> e já estamos processando o pagamento.</p>`,
    extraHtml: buildOrderItemsHtml(order),
    noteHtml: 'Assim que o pagamento for confirmado, avisamos por aqui e você também pode acompanhar tudo em "Meus pedidos", na sua conta.',
    ctaLabel: 'Acompanhar meu pedido',
    ctaUrl: SITE_URL
  });

  await sendBrevoEmail({
    to: order.email,
    subject: `Recebemos seu pedido ${order.orderNumber || ''} - MUV FITNESS`,
    html
  });
}

async function sendOrderConfirmationEmail(order) {
  if (!order || !order.email) return;

  const html = buildEmailHtml({
    preheader: `Pagamento aprovado! Seu pedido ${order.orderNumber || ''} já está confirmado.`,
    title: 'Pagamento aprovado! ✅',
    introHtml: `<p style="margin:0;">Seu pedido <strong>${order.orderNumber || ''}</strong> foi confirmado e já vai seguir para separação.</p>`,
    extraHtml: buildOrderItemsHtml(order),
    noteHtml: 'Você recebe um novo aviso assim que o pedido for enviado.',
    ctaLabel: 'Acompanhar meu pedido',
    ctaUrl: SITE_URL
  });

  await sendBrevoEmail({
    to: order.email,
    subject: `Pedido ${order.orderNumber || ''} confirmado - MUV FITNESS`,
    html
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('[MUV pagamento] MP_ACCESS_TOKEN não configurado.');
    res.status(500).json({ error: 'Pagamento indisponível no momento. Tente novamente mais tarde.' });
    return;
  }

  try {
    const { formData, order } = req.body || {};

    if (!formData || typeof formData !== 'object') {
      res.status(400).json({ error: 'Dados de pagamento ausentes.' });
      return;
    }

    // Número do pedido: mesmo papel do external_reference no fluxo antigo —
    // é o elo entre o pagamento no Mercado Pago e o pedido salvo no Supabase.
    // O webhook (api/mercadopago-webhook.js) usa esse número pra achar o pedido certo.
    const orderNumber = 'MUV' + Date.now().toString().slice(-8);

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const siteUrl = `${protocol}://${req.headers.host}`;

    // formData vem pronto do Brick (token, payment_method_id, installments,
    // payer, transaction_amount etc.) — só completamos com os dados do pedido.
    const paymentBody = {
      ...formData,
      external_reference: orderNumber,
      notification_url: `${siteUrl}/api/mercadopago-webhook`,
      statement_descriptor: 'MUVFITNESS',
      description: (order && order.description) || 'Pedido MUV FITNESS'
    };

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        // Evita cobrança duplicada caso a requisição seja reenviada
        // (ex: instabilidade de rede) — cada tentativa de pedido tem sua chave.
        'X-Idempotency-Key': orderNumber
      },
      body: JSON.stringify(paymentBody)
    });

    const data = await mpRes.json();

    if (!mpRes.ok) {
      console.error('[MUV pagamento] erro do Mercado Pago:', data);
      const friendly = data.cause?.[0]?.description || data.message || 'Pagamento recusado. Confira os dados e tente novamente.';
      res.status(mpRes.status === 401 || mpRes.status === 403 ? 502 : 200).json({ error: friendly, mp_status: data.status || null });
      return;
    }

    // Log de diagnóstico: mesmo quando a chamada à API do Mercado Pago dá
    // certo (mpRes.ok), o PAGAMENTO em si pode vir recusado (status
    // "rejected"). Sem isso, uma recusa de cartão não deixava nenhum
    // rastro nos logs da Vercel — cada tentativa fica registrada aqui,
    // com o motivo detalhado (status_detail) explicando a recusa.
    console.log('[MUV pagamento] resultado:', {
      order_number: orderNumber,
      status: data.status,
      status_detail: data.status_detail,
      payment_method_id: data.payment_method_id
    });

    // "Pedido recebido": só avisa a cliente se o pagamento NÃO foi recusado
    // (aprovado, pendente/Pix ou em análise). Se o cartão foi recusado, não
    // faz sentido dizer que o pedido foi recebido — ela vê o motivo na tela
    // e tenta de novo.
    // IMPORTANTE: usar await aqui. Em ambiente serverless (Vercel), a função
    // pode ser encerrada assim que a resposta HTTP é enviada, cortando no
    // meio um fetch ainda "em voo".
    if (data.status !== 'rejected' && data.status !== 'cancelled') {
      await sendOrderPlacedEmail({ ...order, orderNumber });
    }

    if (data.status === 'approved') {
      // IMPORTANTE: usar await aqui pelo mesmo motivo do e-mail acima —
      // sem isso, a função pode ser encerrada antes do fetch pro Brevo
      // terminar e o e-mail de aprovação não sai.
      await sendOrderConfirmationEmail({ ...order, orderNumber, total: order?.total ?? data.transaction_amount });
    }

    res.status(200).json({
      status: data.status,               // approved | pending | in_process | rejected
      status_detail: data.status_detail,
      id: data.id,
      order_number: orderNumber,
      payment_method_id: data.payment_method_id,
      payment_type_id: data.payment_type_id,
      // Dados do QR Code / Pix "copia e cola" (só vem preenchido quando payment_method_id === 'pix')
      point_of_interaction: data.point_of_interaction || null
    });
  } catch (err) {
    console.error('[MUV pagamento] erro inesperado:', err);
    res.status(500).json({ error: 'Erro interno ao processar o pagamento.' });
  }
}