/* MUV FITNESS - Cria a preferência de pagamento no Mercado Pago (Checkout Pro)
   ---------------------------------------------------------------------------
   O front-end (js/site.js) envia o pedido pra cá via POST. Esta função:
     1) monta os itens do pedido no formato que o Mercado Pago espera
     2) cria uma "preferência de pagamento" pela API do Mercado Pago
     3) devolve o link (init_point) pro qual o cliente é redirecionado,
        onde ele escolhe Pix, cartão de crédito etc. e finaliza o pagamento

   O Access Token do Mercado Pago é secreto e SÓ existe aqui no servidor,
   lido da variável de ambiente MP_ACCESS_TOKEN (configurada no painel da
   Vercel). Ele nunca é enviado para o navegador do cliente.
*/

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('[MUV checkout] MP_ACCESS_TOKEN não configurado.');
    res.status(500).json({ error: 'Pagamento indisponível no momento. Tente novamente mais tarde.' });
    return;
  }

  try {
    const order = req.body || {};

    if (!Array.isArray(order.items) || order.items.length === 0) {
      res.status(400).json({ error: 'Carrinho vazio.' });
      return;
    }

    const items = order.items.map((it) => ({
      title: String(it.name || it.title || 'Produto MUV FITNESS').slice(0, 250),
      quantity: Math.max(1, Number(it.qty || it.quantity || 1)),
      unit_price: Number(it.price) || 0,
      currency_id: 'BRL'
    }));

    const freight = Number(order.freight) || 0;
    if (freight > 0) {
      items.push({ title: 'Frete', quantity: 1, unit_price: freight, currency_id: 'BRL' });
    }

    // Número do pedido gerado aqui, usado como "external_reference" — é o elo
    // entre a preferência de pagamento no Mercado Pago e o pedido salvo no
    // Supabase (ver js/site.js e supabase-auth.js). O webhook usa esse mesmo
    // número pra saber qual pedido atualizar quando o pagamento é confirmado.
    const orderNumber = 'MUV' + Date.now().toString().slice(-8);

    // Restringe os meios de pagamento aceitos conforme o método escolhido
    // no checkout (Pix ou Cartão de crédito) — sem boleto e sem débito.
    const excludedPaymentTypes = [{ id: 'ticket' }, { id: 'debit_card' }];
    if (order.paymentMethod === 'pix') {
      excludedPaymentTypes.push({ id: 'credit_card' });
    } else if (order.paymentMethod === 'card') {
      excludedPaymentTypes.push({ id: 'bank_transfer' });
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const siteUrl = `${protocol}://${req.headers.host}`;

    const preference = {
      items,
      payer: order.email ? { email: order.email } : undefined,
      external_reference: orderNumber,
      back_urls: {
        success: `${siteUrl}/index.html?status=success&order=${orderNumber}`,
        failure: `${siteUrl}/index.html?status=failure&order=${orderNumber}`,
        pending: `${siteUrl}/index.html?status=pending&order=${orderNumber}`
      },
      auto_return: 'approved',
      notification_url: `${siteUrl}/api/mercadopago-webhook`,
      statement_descriptor: 'MUVFITNESS',
      payment_methods: {
        excluded_payment_types: excludedPaymentTypes,
        installments: order.paymentMethod === 'card' ? 12 : 1
      }
    };

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(preference)
    });

    const data = await mpRes.json();

    if (!mpRes.ok) {
      console.error('[MUV checkout] erro do Mercado Pago:', data);
      res.status(502).json({ error: 'Não foi possível gerar o pagamento. Tente novamente.' });
      return;
    }

    res.status(200).json({ init_point: data.init_point, order_number: orderNumber });
  } catch (err) {
    console.error('[MUV checkout] erro inesperado:', err);
    res.status(500).json({ error: 'Erro interno ao criar o pagamento.' });
  }
}
