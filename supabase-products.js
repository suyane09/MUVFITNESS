/* MUV FITNESS - Supabase shared product catalog */
(function () {
  'use strict';

  const SUPABASE_URL = window.MUV_SUPABASE_URL || 'https://ithzftuwowtdgibdvuuj.supabase.co';
  const SUPABASE_KEY = window.MUV_SUPABASE_ANON_KEY || 'sb_publishable_GPUftYNJEwNL4pm_HsQUrA_rOspcyvn';
  const PRODUCTS_KEY = 'muv_admin_products';
  const BUCKET = 'product-images';
  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const SYNC_KEY = 'muv_supabase_products_sync_v1';

  function loadSupabase() {
    return new Promise((resolve, reject) => {
      if (window.supabase && window.supabase.createClient) return resolve(window.supabase);
      const s = document.createElement('script');
      s.src = CDN;
      s.onload = () => window.supabase ? resolve(window.supabase) : reject(new Error('Supabase JS não carregou.'));
      s.onerror = () => reject(new Error('Não foi possível carregar o Supabase.'));
      document.head.appendChild(s);
    });
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    if (el) {
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(window.__muvToastTimer);
      window.__muvToastTimer = setTimeout(() => el.classList.remove('show'), 3000);
    } else console.log('[MUV]', msg);
  }

  function dbToProduct(r) {
    const m = r.metadata && typeof r.metadata === 'object' ? r.metadata : {};
    const imgs = Array.isArray(r.images) ? r.images : [];
    return {
      id: r.id,
      name: r.name || '',
      category: r.category || '',
      subcat: m.subcat || '',
      price: Number(r.price) || 0,
      oldPrice: Number(r.compare_price) || 0,
      stock: Number(r.stock) || 0,
      sku: m.sku || '',
      tag: m.tag || '',
      description: r.description || '',
      active: r.active !== false,
      novidade: !!m.novidade,
      images: imgs,
      image: imgs[0] || '',
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now()
    };
  }

  function productToDb(p) {
    const validUuid = p.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.id);
    return {
      ...(validUuid ? { id: p.id } : {}),
      name: p.name,
      category: p.category || null,
      price: Number(p.price) || 0,
      compare_price: Number(p.oldPrice) || null,
      stock: Number(p.stock) || 0,
      description: p.description || null,
      images: Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []),
      active: p.active !== false,
      metadata: {
        subcat: p.subcat || '',
        sku: p.sku || '',
        tag: p.tag || '',
        novidade: !!p.novidade
      }
    };
  }

  function saveLocal(products) {
    try { localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products)); return true; }
    catch (e) { console.error(e); return false; }
  }

  function sameProducts(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  async function getProducts(client) {
    const { data, error } = await client.from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(dbToProduct);
  }

  async function syncFromSupabase(client, forceReload) {
    const remote = await getProducts(client);
    const local = (() => { try { return JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]'); } catch { return []; } })();

    if (!remote.length && local.length && document.getElementById('productForm')) {
      const hasLocalImages = local.some(p => (Array.isArray(p.images) && p.images.length) || p.image);
      if (hasLocalImages && !sessionStorage.getItem('muv_catalog_migration_prompted')) {
        sessionStorage.setItem('muv_catalog_migration_prompted', '1');
        const ok = confirm('O catálogo online do Supabase está vazio, mas encontrei produtos salvos neste navegador. Deseja enviar esses produtos para o catálogo online agora?');
        if (ok) {
          for (const p of local) {
            try {
              const db = productToDb(p);
              const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.id || '') ? p.id : crypto.randomUUID();
              const images = await uploadImages(client, Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []), id);
              db.id = id;
              db.images = images;
              const result = await client.from('products').upsert(db);
              if (result.error) console.error('[MUV migration]', p.name, result.error);
            } catch (e) { console.error('[MUV migration]', p.name, e); }
          }
          const migrated = await getProducts(client);
          saveLocal(migrated);
          localStorage.setItem(SYNC_KEY, String(Date.now()));
          if (forceReload) location.reload();
          return migrated;
        }
      }
    }

    if (!sameProducts(local, remote)) {
      if (!saveLocal(remote)) throw new Error('Não foi possível atualizar o catálogo local.');
      localStorage.setItem(SYNC_KEY, String(Date.now()));
      if (forceReload) location.reload();
    }
    return remote;
  }

  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mime = (parts[0].match(/data:([^;]+)/) || [, 'image/jpeg'])[1];
    const bin = atob(parts[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  async function optimizeImage(src) {
    if (!src || !src.startsWith('data:image/')) return src;
    try {
      const blob = dataUrlToBlob(src);
      const bitmap = await createImageBitmap(blob);
      const max = 1600;
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      return canvas.toDataURL('image/jpeg', 0.84);
    } catch { return src; }
  }

  async function uploadImages(client, sources, productId) {
    const out = [];
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      if (!src) continue;
      if (/^https?:\/\//i.test(src)) { out.push(src); continue; }
      const optimized = await optimizeImage(src);
      const blob = dataUrlToBlob(optimized);
      const path = `${productId}/${Date.now()}-${i}.jpg`;
      const { error } = await client.storage.from(BUCKET).upload(path, blob, {
        contentType: 'image/jpeg', upsert: true, cacheControl: '31536000'
      });
      if (error) throw error;
      const { data } = client.storage.from(BUCKET).getPublicUrl(path);
      out.push(data.publicUrl);
    }
    return out;
  }

  function formData() {
    const byId = id => document.getElementById(id);
    const images = Array.from(document.querySelectorAll('#pfImgList img')).map(x => x.getAttribute('src')).filter(Boolean);
    return {
      name: byId('pfName')?.value.trim() || '',
      category: byId('pfCategory')?.value || '',
      subcat: byId('pfSubcat')?.value.trim() || '',
      price: parseFloat(byId('pfPrice')?.value) || 0,
      oldPrice: parseFloat(byId('pfOldPrice')?.value) || 0,
      stock: parseInt(byId('pfStock')?.value) || 0,
      sku: byId('pfSku')?.value.trim() || '',
      tag: byId('pfTag')?.value || '',
      description: byId('pfDescription')?.value.trim() || '',
      active: !!byId('pfActive')?.checked,
      novidade: !!byId('pfNovidade')?.checked,
      images
    };
  }

  async function saveProduct(client, data, editingId) {
    const id = editingId || crypto.randomUUID();
    if (!data.sku) data.sku = 'MUV-' + id.replace(/-/g, '').slice(-6).toUpperCase();
    toast('Enviando produto...');
    const uploaded = await uploadImages(client, data.images, id);
    const row = productToDb({ ...data, id, images: uploaded, image: uploaded[0] || '' });
    const { data: saved, error } = await client.from('products').upsert(row).select('*').single();
    if (error) throw error;
    const product = dbToProduct(saved);
    const current = (() => { try { return JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]'); } catch { return []; } })();
    const next = current.filter(p => p.id !== product.id);
    next.unshift(product);
    saveLocal(next);
    toast(editingId ? 'Produto atualizado no Supabase.' : 'Produto cadastrado no Supabase.');
    setTimeout(() => location.reload(), 250);
  }

  async function removeProduct(client, id) {
    if (!id) return;
    if (!confirm('Excluir este produto do catálogo?')) return;
    const { error } = await client.from('products').delete().eq('id', id);
    if (error) throw error;
    const current = (() => { try { return JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]'); } catch { return []; } })();
    saveLocal(current.filter(p => p.id !== id));
    toast('Produto excluído.');
    setTimeout(() => location.reload(), 200);
  }

  function installAdmin(client) {
    const form = document.getElementById('productForm');
    if (!form) return;

    document.addEventListener('click', function (e) {
      const edit = e.target.closest('[data-edit]');
      if (edit) window.__muvEditingId = edit.dataset.edit;
      const del = e.target.closest('[data-del]');
      if (del) {
        e.preventDefault();
        e.stopImmediatePropagation();
        removeProduct(client, del.dataset.del).catch(err => { console.error(err); toast('Não foi possível excluir: ' + (err.message || 'erro')); });
      }
    }, true);

    document.getElementById('newProductBtn')?.addEventListener('click', () => { window.__muvEditingId = null; }, true);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const editingId = window.__muvEditingId || null;
      saveProduct(client, formData(), editingId).catch(err => {
        console.error(err);
        toast('Erro ao salvar produto: ' + (err.message || 'verifique o Supabase'));
      });
    }, true);

    syncFromSupabase(client, true).catch(err => {
      console.error('[MUV Supabase sync]', err);
      toast('Não foi possível sincronizar o catálogo.');
    });
  }

  function installStore(client) {
    syncFromSupabase(client, true).catch(err => console.error('[MUV Supabase store]', err));
  }

  async function init() {
    try {
      const api = await loadSupabase();
      const client = api.createClient(SUPABASE_URL, SUPABASE_KEY);
      const isAdmin = !!document.getElementById('productForm');
      if (isAdmin) installAdmin(client);
      else installStore(client);
      window.MUV_SUPABASE = client;
    } catch (err) {
      console.error('[MUV Supabase]', err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
