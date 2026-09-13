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
*/

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
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ status, payment_id: String(payment.id) })
      }
    );

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error('[MUV webhook] erro ao atualizar pedido no Supabase:', errText);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[MUV webhook] erro inesperado:', err);
    res.status(200).json({ received: true });
  }
}