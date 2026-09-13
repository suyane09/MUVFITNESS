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

   E-mail de confirmação (Brevo):
     Quando o cartão é aprovado NA HORA, mandamos o e-mail de confirmação
     direto daqui (não precisa esperar o webhook). Pra Pix, o pagamento só
     é aprovado depois que a cliente paga o QR Code — nesse caso quem manda
     o e-mail é o webhook (api/mercadopago-webhook.js), quando a confirmação
     chegar. Isso evita mandar e-mail duplicado pro mesmo pedido.

   Variáveis de ambiente necessárias (Vercel -> Settings -> Environment
   Variables), além de MP_ACCESS_TOKEN:
     BREVO_API_KEY      -> API key gerada em app.brevo.com (Settings -> API Keys)
     BREVO_SENDER_EMAIL -> e-mail remetente verificado no Brevo (ex:
                            pedidos@muvfitness.com.br). Se não configurar,
                            o e-mail de confirmação simplesmente não é enviado.
*/

async function sendOrderConfirmationEmail(order) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail || !order || !order.email) return;

  const itemsHtml = (order.items || [])
    .map(item => `<tr>
        <td style="padding:6px 0;">${item.qty}x ${item.name}${item.color || item.size ? ` (${[item.color, item.size].filter(Boolean).join(' · ')})` : ''}</td>
        <td style="padding:6px 0;text-align:right;">R$ ${(item.price * item.qty).toFixed(2).replace('.', ',')}</td>
      </tr>`)
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="font-family:Georgia,serif;">MUV FITNESS</h2>
      <p>Recebemos seu pedido <strong>${order.orderNumber || ''}</strong> e o pagamento foi aprovado!</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">${itemsHtml}</table>
      <p><strong>Total: R$ ${Number(order.total || 0).toFixed(2).replace('.', ',')}</strong></p>
      <p style="color:#666;font-size:13px;margin-top:24px;">Qualquer dúvida, fale com a gente pelo WhatsApp: https://wa.me/5582982143150</p>
    </div>`;

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
        to: [{ email: order.email }],
        subject: `Pedido ${order.orderNumber || ''} confirmado - MUV FITNESS`,
        htmlContent: html
      })
    });
    if (!r.ok) {
      console.error('[MUV e-mail] erro ao enviar confirmação:', await r.text());
    }
  } catch (err) {
    console.error('[MUV e-mail] erro inesperado ao enviar confirmação:', err);
  }
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

    if (data.status === 'approved') {
      // Não travamos a resposta esperando o e-mail — a cliente já vê o
      // resultado aprovado na hora, o e-mail é disparado em paralelo.
      sendOrderConfirmationEmail({ ...order, orderNumber, total: order?.total ?? data.transaction_amount });
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