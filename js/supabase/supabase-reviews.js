/* MUV FITNESS - Supabase: comentários das clientes na página do produto

   Requer uma tabela `product_reviews` no Supabase:
     id            uuid primary key default gen_random_uuid()
     product_id    text not null
     customer_name text not null
     comment       text not null
     created_at    timestamptz not null default now()
   com policies de RLS liberando select e insert públicos
   (mesmo esquema já usado pela tabela `products`).
   Veja supabase-reviews.sql para o script pronto.
*/
(function () {
  'use strict';

  const SUPABASE_URL = window.MUV_SUPABASE_URL || 'https://ithzftuwowtdgibdvuuj.supabase.co';
  const SUPABASE_KEY = window.MUV_SUPABASE_ANON_KEY || 'sb_publishable_GPUftYNJEwNL4pm_HsQUrA_rOspcyvn';
  const TABLE = 'product_reviews';
  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

  function loadSupabase() {
    return new Promise((resolve, reject) => {
      if (window.supabase && window.supabase.createClient) return resolve(window.supabase);
      const existing = document.querySelector('script[data-muv-supabase-cdn]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.supabase));
        existing.addEventListener('error', () => reject(new Error('Não foi possível carregar o Supabase.')));
        return;
      }
      const s = document.createElement('script');
      s.src = CDN;
      s.setAttribute('data-muv-supabase-cdn', '1');
      s.onload = () => window.supabase ? resolve(window.supabase) : reject(new Error('Supabase JS não carregou.'));
      s.onerror = () => reject(new Error('Não foi possível carregar o Supabase.'));
      document.head.appendChild(s);
    });
  }

  let _clientReady = null;
  function getClient() {
    if (!_clientReady) {
      _clientReady = loadSupabase().then(api => api.createClient(SUPABASE_URL, SUPABASE_KEY));
    }
    return _clientReady;
  }

  function sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Busca os comentários de um produto, do mais recente para o mais antigo.
  window.MUV_REVIEWS_LOAD = async function (productId) {
    const client = await getClient();
    const { data, error } = await client
      .from(TABLE)
      .select('id, customer_name, comment, created_at')
      .eq('product_id', String(productId))
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  };

  // Envia um novo comentário para o Supabase.
  window.MUV_REVIEWS_ADD = async function (productId, customerName, comment) {
    const client = await getClient();
    const payload = {
      product_id: String(productId),
      customer_name: customerName.trim().slice(0, 60),
      comment: comment.trim().slice(0, 600)
    };
    const { data, error } = await client
      .from(TABLE)
      .insert(payload)
      .select('id, customer_name, comment, created_at')
      .single();
    if (error) throw error;
    return data;
  };

  window.MUV_REVIEWS_SANITIZE = sanitize;
})();
