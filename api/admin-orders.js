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

   Depois de configurar, na primeira vez que abrir o admin e entrar no
   painel, o navegador vai pedir pra colar essa mesma chave (uma vez só,
   fica salva no próprio navegador do admin).
*/

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
      res.status(200).json(data);
      return;
    }

    res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    console.error('[MUV admin-orders] erro inesperado:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
}
