/* MUV FITNESS - API para o painel admin ler/atualizar os pedidos reais
   ---------------------------------------------------------------------------
   Antes, o admin.html mostrava pedidos guardados no localStorage do próprio
   navegador (chave 'muv_orders'), que nunca era preenchida por ninguém — os
   pedidos de verdade são gravados na tabela `orders` do Supabase (por
   supabase-auth.js, no fluxo de checkout, e atualizados pelo webhook do
   Mercado Pago em api/mercadopago-webhook.js). Este arquivo é a ponte entre
   os dois: o admin.js chama este endpoint em vez de ler o localStorage.

   Usa a chave "service_role" do Supabase (nunca exposta ao navegador) pra
   buscar e atualizar pedidos, ignorando as regras de RLS que normalmente
   limitam cada cliente a ver só os próprios pedidos.

   PROTEÇÃO: exige um header "x-admin-key" batendo com a variável de
   ambiente ADMIN_ORDERS_KEY. Sem isso, qualquer pessoa que descobrisse a
   URL deste endpoint veria os pedidos e dados de todas as clientes.

   Configuração necessária no painel da Vercel (Settings -> Environment
   Variables):
     SUPABASE_URL               -> mesma URL do supabase-config.js
                                    (já deve estar configurada, usada pelo
                                    webhook do Mercado Pago)
     SUPABASE_SERVICE_ROLE_KEY  -> idem, já deve existir (Project Settings
                                    -> API, no Supabase)
     ADMIN_ORDERS_KEY           -> crie uma nova: uma string longa e
                                    aleatória (ex.: gerada em
                                    https://www.uuidgenerator.net/). NÃO
                                    reaproveite a senha de login do admin, e
                                    nunca coloque esse valor no código/git —
                                    só na Vercel.
     BREVO_API_KEY              -> mesma API key usada em process-payment.js
     BREVO_SENDER_EMAIL         -> mesmo e-mail remetente verificado no Brevo

   Depois de configurar, na primeira vez que abrir o admin e entrar no
   painel, o navegador vai pedir pra colar essa mesma chave (uma vez só,
   fica salva no próprio navegador do admin).

   E-mail de status (Brevo):
     Toda vez que o admin muda o status de um pedido (PATCH), a gente olha o
     texto do novo status e, se ele falar de "separação", "enviado" ou
     "entregue", manda um e-mail avisando a cliente. Outros status (tipo os
     automáticos "Pagamento aprovado/pendente" que vêm do webhook) não geram
     e-mail aqui — esses já são tratados em mercadopago-webhook.js.

     IMPORTANTE: os textos abaixo (ex.: 'separa', 'envi', 'entreg') precisam
     bater com o que o painel admin realmente envia como status. Se o
     dropdown do admin.html usar palavras diferentes (ex.: "A caminho" em vez
     de "Enviado"), ajuste as condições da função sendStatusUpdateEmail.
*/

import { buildEmailHtml, SITE_URL } from './email-template.js';

async function sendStatusUpdateEmail(order, status) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail || !order || !order.email || !status) return;

  const statusLower = String(status).toLowerCase();
  let subject;
  let title;
  let message;

  if (statusLower.includes('separa')) {
    subject = `Seu pedido ${order.order_number || ''} está em separação - MUV FITNESS`;
    title = 'Seu pedido está em separação 📦';
    message = 'Seu pedido já está sendo separado com carinho pela nossa equipe e logo segue para o transporte.';
  } else if (statusLower.includes('envi') || statusLower.includes('caminho') || statusLower.includes('transport')) {
    subject = `Seu pedido ${order.order_number || ''} saiu para entrega - MUV FITNESS`;
    title = 'Seu pedido está a caminho! 🚚';
    message = 'Seu pedido já saiu para entrega e deve chegar em breve.';
  } else if (statusLower.includes('entreg')) {
    subject = `Seu pedido ${order.order_number || ''} foi entregue - MUV FITNESS`;
    title = 'Seu pedido foi entregue! 💛';
    message = 'Seu pedido foi entregue. Esperamos que você ame os produtos!';
  } else {
    // Status sem e-mail configurado (ex.: os automáticos do webhook de pagamento)
    return;
  }

  const html = buildEmailHtml({
    preheader: message,
    title,
    introHtml: `<p style="margin:0;">${message}</p>${order.order_number ? `<p style="margin:14px 0 0;color:#6f6963;font-size:13.5px;">Pedido <strong>${order.order_number}</strong></p>` : ''}`,
    noteHtml: 'Qualquer novidade sobre a entrega, avisamos por aqui.',
    ctaLabel: 'Ver minha conta',
    ctaUrl: SITE_URL
  });

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
        subject,
        htmlContent: html
      })
    });
    if (!r.ok) {
      console.error('[MUV e-mail] erro ao enviar atualização de status:', await r.text());
    }
  } catch (err) {
    console.error('[MUV e-mail] erro inesperado ao enviar atualização de status:', err);
  }
}

export default async function handler(req, res) {
  const adminKey = process.env.ADMIN_ORDERS_KEY;
  const suppliedKey = req.headers['x-admin-key'];

  if (!adminKey) {
    console.error('[MUV admin-orders] ADMIN_ORDERS_KEY não configurada no servidor.');
    res.status(500).json({ error: 'Servidor não configurado (ADMIN_ORDERS_KEY ausente).' });
    return;
  }
  if (!suppliedKey || suppliedKey !== adminKey) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('[MUV admin-orders] variáveis do Supabase ausentes.');
    res.status(500).json({ error: 'Servidor não configurado (Supabase ausente).' });
    return;
  }

  const supaHeaders = {
    'Content-Type': 'application/json',
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`
  };

  try {
    if (req.method === 'GET') {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/orders?select=*&order=created_at.desc`,
        { headers: supaHeaders }
      );
      const data = await r.json();
      if (!r.ok) {
        console.error('[MUV admin-orders] erro ao buscar pedidos:', data);
        res.status(502).json({ error: 'Erro ao buscar pedidos no Supabase.' });
        return;
      }
      res.status(200).json(data);
      return;
    }

    if (req.method === 'PATCH') {
      const { order_number, status } = req.body || {};
      if (!order_number || !status) {
        res.status(400).json({ error: 'order_number e status são obrigatórios.' });
        return;
      }
      const r = await fetch(
        `${supabaseUrl}/rest/v1/orders?order_number=eq.${encodeURIComponent(order_number)}`,
        {
          method: 'PATCH',
          headers: { ...supaHeaders, Prefer: 'return=representation' },
          body: JSON.stringify({ status })
        }
      );
      const data = await r.json();
      if (!r.ok) {
        console.error('[MUV admin-orders] erro ao atualizar pedido:', data);
        res.status(502).json({ error: 'Erro ao atualizar pedido no Supabase.' });
        return;
      }

      // Dispara o e-mail de status pra cliente, sem travar a resposta pro admin.
      const orderRow = Array.isArray(data) ? data[0] : data;
      if (orderRow) sendStatusUpdateEmail(orderRow, status);

      res.status(200).json(data);
      return;
    }

    res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    console.error('[MUV admin-orders] erro inesperado:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
}