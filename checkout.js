// api/checkout.js
// Função backend (serverless) que cria uma "preferência de pagamento"
// no Mercado Pago (Checkout Pro) a partir do carrinho recebido do site.
//
// O Access Token FICA SÓ AQUI, nunca no HTML/JS do site.
// Ele é lido de uma variável de ambiente (MP_ACCESS_TOKEN),
// configurada no painel da Vercel — nunca escreva o token direto no código.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const order = req.body;

    if (!order || !Array.isArray(order.items) || order.items.length === 0) {
      return res.status(400).json({ error: 'Carrinho vazio ou inválido' });
    }

    // Monta os itens no formato que o Mercado Pago espera.
    // OBS: aqui os preços ainda vêm do carrinho enviado pelo front-end.
    // Quando você tiver um catálogo de produtos guardado no servidor,
    // o ideal é buscar o preço real de cada item ali, em vez de confiar
    // no valor que veio do navegador.
    const mpItems = order.items.map((item) => ({
      title: String(item.name).slice(0, 256),
      quantity: Number(item.qty) || 1,
      unit_price: Number(item.price),
      currency_id: 'BRL',
    }));

    // Adiciona o frete como um "item" separado, se houver.
    if (order.freight && Number(order.freight) > 0) {
      mpItems.push({
        title: 'Frete',
        quantity: 1,
        unit_price: Number(order.freight),
        currency_id: 'BRL',
      });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const preferenceBody = {
      items: mpItems,
      payer: order.email ? { email: order.email } : undefined,
      back_urls: {
        success: `${origin}/#checkout-sucesso`,
        failure: `${origin}/#checkout-erro`,
        pending: `${origin}/#checkout-pendente`,
      },
      auto_return: 'approved',
      statement_descriptor: 'MUV FITNESS',
    };

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preferenceBody),
    });

    const data = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Erro do Mercado Pago:', data);
      return res.status(500).json({ error: 'Erro ao criar pagamento no Mercado Pago' });
    }

    // init_point = link de produção | sandbox_init_point = link de teste
    return res.status(200).json({
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    });
  } catch (err) {
    console.error('Erro interno em /api/checkout:', err);
    return res.status(500).json({ error: 'Erro interno ao processar o pagamento' });
  }
}
