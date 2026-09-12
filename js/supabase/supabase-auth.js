/* MUV FITNESS - Supabase Auth (cadastro/login real) + pedidos e endereços
   -----------------------------------------------------------------------
   Substitui o esquema antigo baseado em localStorage ('muv_user',
   'muv_orders', 'muv_addresses') por autenticação de verdade via
   Supabase Auth, com pedidos e endereços salvos no banco, vinculados
   ao usuário logado (auth.uid()).

   Requer as tabelas `profiles`, `orders` e `addresses` no Supabase —
   veja supabase-schema.sql.

   Expõe window.MUV_AUTH com os métodos usados pelo index.html:
     signUp({name, email, password})
     signIn({email, password})
     signOut()
     getUser()                  -> usuário logado (ou null)
     onAuthChange(cb)           -> cb(user|null) a cada mudança de sessão
     resetPassword(email)
     getProfile()
     updateProfile({name, email, phone})
     getOrders()
     saveOrder(order)           -> retorna o pedido salvo (com order_number)
     getAddresses()
     saveAddress(data, id)      -> upsert; sem id = cria novo
     deleteAddress(id)
     setDefaultAddress(id)
*/
(function () {
  'use strict';

  const SUPABASE_URL = window.MUV_SUPABASE_URL || 'https://ithzftuwowtdgibdvuuj.supabase.co';
  const SUPABASE_KEY = window.MUV_SUPABASE_ANON_KEY || 'sb_publishable_GPUftYNJEwNL4pm_HsQUrA_rOspcyvn';
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
      _clientReady = loadSupabase().then(api => api.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      }));
    }
    return _clientReady;
  }

  function orderNumber() {
    return 'MUV' + Date.now().toString().slice(-8);
  }

  // -------------------------------------------------------
  // AUTH
  // -------------------------------------------------------
  async function signUp({ name, email, password }) {
    const client = await getClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) throw error;

    // Se a confirmação de e-mail estiver desligada no projeto, já existe
    // sessão aqui e conseguimos gravar o perfil imediatamente. Se estiver
    // ligada, o perfil é criado no primeiro login (ver signIn).
    if (data.user && data.session) {
      await client.from('profiles').upsert({ id: data.user.id, name, email });
    }
    return data;
  }

  async function signIn({ email, password }) {
    const client = await getClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Garante que o perfil exista (cobre o caso de cadastro com
    // confirmação de e-mail pendente até aqui).
    if (data.user) {
      const name = (data.user.user_metadata && data.user.user_metadata.name) || email.split('@')[0];
      await client.from('profiles').upsert({ id: data.user.id, name, email }, { onConflict: 'id', ignoreDuplicates: true }).select();
    }
    return data;
  }

  async function signOut() {
    const client = await getClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  async function getUser() {
    const client = await getClient();
    const { data } = await client.auth.getUser();
    return data ? data.user : null;
  }

  async function onAuthChange(cb) {
    const client = await getClient();
    client.auth.onAuthStateChange((_event, session) => {
      cb(session ? session.user : null);
    });
    // dispara o estado inicial também
    const { data } = await client.auth.getSession();
    cb(data && data.session ? data.session.user : null);
  }

  async function resetPassword(email) {
    const client = await getClient();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;
  }

  // -------------------------------------------------------
  // PROFILE
  // -------------------------------------------------------
  async function getProfile() {
    const client = await getClient();
    const { data: userData } = await client.auth.getUser();
    if (!userData || !userData.user) return null;
    const { data, error } = await client.from('profiles').select('*').eq('id', userData.user.id).maybeSingle();
    if (error) throw error;
    if (data) return data;
    // fallback: perfil ainda não existe, usa dados básicos do auth
    return { id: userData.user.id, name: userData.user.user_metadata?.name || '', email: userData.user.email, phone: '' };
  }

  async function updateProfile({ name, email, phone }) {
    const client = await getClient();
    const { data: userData } = await client.auth.getUser();
    if (!userData || !userData.user) throw new Error('Você precisa estar logada.');
    const row = { id: userData.user.id, name, email, phone, updated_at: new Date().toISOString() };
    const { error } = await client.from('profiles').upsert(row);
    if (error) throw error;
    return row;
  }

  // -------------------------------------------------------
  // ORDERS
  // -------------------------------------------------------
  async function getOrders() {
    const client = await getClient();
    const { data: userData } = await client.auth.getUser();
    if (!userData || !userData.user) return []; // sem login não há como ler pedidos (RLS)
    const { data, error } = await client
      .from('orders')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function saveOrder(order) {
    const client = await getClient();
    const { data: userData } = await client.auth.getUser();
    const row = {
      // Se o pedido já veio com um número gerado pelo /api/checkout (fluxo
      // com pagamento via Mercado Pago), usa o mesmo — é por ele que o
      // webhook encontra e atualiza este pedido depois.
      order_number: order.orderNumber || orderNumber(),
      user_id: userData && userData.user ? userData.user.id : null,
      email: order.email,
      status: 'Pagamento pendente',
      payment_method: order.paymentMethod || null,
      items: order.items || [],
      shipping_address: order.address || null,
      subtotal: order.subtotal || 0,
      freight: order.freight || 0,
      total: order.total || 0
    };
    const { data, error } = await client.from('orders').insert(row).select('*').single();
    if (error) throw error;
    return data;
  }

  // -------------------------------------------------------
  // ADDRESSES
  // -------------------------------------------------------
  async function getAddresses() {
    const client = await getClient();
    const { data: userData } = await client.auth.getUser();
    if (!userData || !userData.user) return [];
    const { data, error } = await client
      .from('addresses')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function saveAddress(data, id) {
    const client = await getClient();
    const { data: userData } = await client.auth.getUser();
    if (!userData || !userData.user) throw new Error('Você precisa estar logada.');
    const existing = await getAddresses();
    const row = { ...data, user_id: userData.user.id };
    if (id) row.id = id;
    if (!id && existing.length === 0) row.is_default = true;
    const { data: saved, error } = await client.from('addresses').upsert(row).select('*').single();
    if (error) throw error;
    return saved;
  }

  async function deleteAddress(id) {
    const client = await getClient();
    const list = await getAddresses();
    const target = list.find(a => a.id === id);
    const { error } = await client.from('addresses').delete().eq('id', id);
    if (error) throw error;
    // se apagou o endereço padrão, promove outro pra padrão
    if (target && target.is_default) {
      const remaining = list.filter(a => a.id !== id);
      if (remaining.length) await setDefaultAddress(remaining[0].id);
    }
  }

  async function setDefaultAddress(id) {
    const client = await getClient();
    const { data: userData } = await client.auth.getUser();
    if (!userData || !userData.user) throw new Error('Você precisa estar logada.');
    // zera todos e marca só o escolhido (duas chamadas simples, sem transação client-side)
    const { error: err1 } = await client.from('addresses').update({ is_default: false }).eq('user_id', userData.user.id);
    if (err1) throw err1;
    const { error: err2 } = await client.from('addresses').update({ is_default: true }).eq('id', id);
    if (err2) throw err2;
  }

  window.MUV_AUTH = {
    signUp, signIn, signOut, getUser, onAuthChange, resetPassword,
    getProfile, updateProfile,
    getOrders, saveOrder,
    getAddresses, saveAddress, deleteAddress, setDefaultAddress
  };
})();