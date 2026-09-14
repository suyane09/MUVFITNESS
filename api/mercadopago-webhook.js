/* MUV FITNESS - Webhook do Mercado Pago
   ---------------------------------------------------------------------------
   O Mercado Pago chama esta URL automaticamente sempre que o status de um
   pagamento muda (aprovado, recusado, pendente, estornado...). Aqui a gente:
     1) busca os detalhes do pagamento na API do Mercado Pago (usando o id
        que veio na notificação)
     2) traduz o status pra um texto em português
     3) atualiza o pedido correspondente na tabela `orders` do Supabase,
        casando pelo `order_number` (gravado como external_reference no
        pagamento, em /api/process-payment.js)

   Configuração necessária no painel da Vercel (Settings -> Environment
   Variables), além de MP_ACCESS_TOKEN:
     SUPABASE_URL                 -> mesma URL do supabase-config.js
     SUPABASE_SERVICE_ROLE_KEY    -> chave "service_role" do Supabase
                                      (Project Settings -> API). Essa chave
                                      tem permissão total e por isso NUNCA
                                      pode ir para o código do site — só
                                      existe aqui, como variável de servidor.

   Também é preciso, no painel do Mercado Pago (Suas integrações -> a
   aplicação -> Webhooks), registrar a URL:
     https://SEUDOMINIO.vercel.app/api/mercadopago-webhook
   assinando o evento "Pagamentos".

   Requer a coluna `payment_id` na tabela `orders` (text, opcional):
     alter table orders add column if not exists payment_id text;

   E-mail de confirmação (Brevo):
     Pra Pix, o pagamento só é aprovado quando a cliente paga o QR Code —
     por isso é AQUI (e não em process-payment.js) que mandamos o e-mail de
     confirmação nesse caso. Pra cartão, o e-mail já foi enviado na hora
     pelo process-payment.js, então aqui a gente ignora cartão pra não
     mandar duas vezes.
     Variáveis de ambiente (além de SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
     acima):
       BREVO_API_KEY      -> mesma API key usada em process-payment.js
       BREVO_SENDER_EMAIL -> mesmo e-mail remetente verificado no Brevo
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
      <p>Recebemos a confirmação do seu pagamento via Pix do pedido <strong>${order.order_number || ''}</strong>!</p>
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
        replyTo: { name: 'MUV FITNESS', email: 'muvfiitness@gmail.com' },
        to: [{ email: order.email }],
        subject: `Pedido ${order.order_number || ''} confirmado - MUV FITNESS`,
        htmlContent: html
      })
    });
    if (!r.ok) {
      console.error('[MUV e-mail] erro ao enviar confirmação (pix):', await r.text());
    }
  } catch (err) {
    console.error('[MUV e-mail] erro inesperado ao enviar confirmação (pix):', err);
  }
}

export default async function handler(req, res) {
  // O Mercado Pago aceita 200 como "recebido"; devolvemos 200 mesmo em
  // pequenas falhas nossas pra ele não ficar reenviando a notificação
  // indefinidamente. Erros ficam registrados no log da função (Vercel).
  try {
    const paymentId =
      (req.body && req.body.data && req.body.data.id) ||
      req.query['data.id'] ||
      req.query.id;

    const topic = (req.body && req.body.type) || req.query.type || req.query.topic;

    if (!paymentId || (topic && topic !== 'payment')) {
      res.status(200).json({ received: true });
      return;
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!accessToken || !supabaseUrl || !serviceKey) {
      console.error('[MUV webhook] variáveis de ambiente ausentes.');
      res.status(200).json({ received: true });
      return;
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payment = await mpRes.json();

    if (!mpRes.ok || !payment.external_reference) {
      console.error('[MUV webhook] não foi possível ler o pagamento:', payment);
      res.status(200).json({ received: true });
      return;
    }

    const statusMap = {
      approved: 'Pagamento aprovado',
      pending: 'Pagamento pendente',
      in_process: 'Pagamento em análise',
      rejected: 'Pagamento recusado',
      cancelled: 'Pagamento cancelado',
      refunded: 'Pagamento estornado',
      charged_back: 'Pagamento contestado'
    };
    const status = statusMap[payment.status] || payment.status;

    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/orders?order_number=eq.${encodeURIComponent(payment.external_reference)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: 'return=representation'
        },
        body: JSON.stringify({ status, payment_id: String(payment.id) })
      }
    );

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error('[MUV webhook] erro ao atualizar pedido no Supabase:', errText);
    } else if (payment.status === 'approved' && payment.payment_method_id === 'pix') {
      // Cartão já teve o e-mail disparado na hora em process-payment.js —
      // aqui só cobrimos o caso do Pix, que só aprova depois (assíncrono).
      const updated = await patchRes.json();
      const orderRow = Array.isArray(updated) ? updated[0] : updated;
      if (orderRow) sendOrderConfirmationEmail(orderRow);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[MUV webhook] erro inesperado:', err);
    res.status(200).json({ received: true });
  }
}