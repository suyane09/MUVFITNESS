/* MUV FITNESS - Supabase sync para imagens de configuração do site
   (cards da vitrine "Conjuntos" + imagem da seção "Sobre nós")

   Antes disso, essas imagens ficavam só no localStorage — ou seja,
   só apareciam no navegador/aparelho onde foram trocadas pelo admin.
   Este arquivo guarda e lê essas imagens de uma tabela no Supabase
   (site_settings), do mesmo jeito que supabase-products.js já faz
   para o catálogo de produtos, para que a alteração apareça em
   qualquer dispositivo.

   Requer uma tabela `site_settings` no Supabase:
     key         text primary key
     value       jsonb not null default '{}'::jsonb
     updated_at  timestamptz not null default now()
   com policies de RLS liberando select/insert/update públicos
   (mesmo esquema já usado pela tabela `products`).
*/
(function () {
  'use strict';

  const SUPABASE_URL = window.MUV_SUPABASE_URL || 'https://ithzftuwowtdgibdvuuj.supabase.co';
  const SUPABASE_KEY = window.MUV_SUPABASE_ANON_KEY || 'sb_publishable_GPUftYNJEwNL4pm_HsQUrA_rOspcyvn';
  const TABLE = 'site_settings';
  const BUCKET = 'product-images'; // reaproveita o bucket já usado pelos produtos
  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const RELOAD_GUARD_KEY = 'muv_supabase_site_settings_reload_done';
  const MIGRATION_PROMPT_PREFIX = 'muv_site_settings_migration_prompted_';

  // Chave no Supabase -> chave equivalente no localStorage (compatibilidade
  // com o código já existente em admin.html e index.html).
  const LS_KEYS = {
    showcase_cards: 'muv_showcase_cards',
    about_image: 'muv_about_image'
  };

  const DEFAULTS = {
    showcase_cards: { short: { a: '', b: '' }, calca: { a: '', b: '' }, macaquito: { a: '', b: '' } },
    about_image: ''
  };

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

  function toast(msg) {
    const el = document.getElementById('toast');
    if (el) {
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(window.__muvSettingsToastTimer);
      window.__muvSettingsToastTimer = setTimeout(() => el.classList.remove('show'), 3000);
    } else {
      console.log('[MUV site settings]', msg);
    }
  }

  function getLocal(key) {
    try {
      const raw = localStorage.getItem(LS_KEYS[key]);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setLocal(key, value) {
    try { localStorage.setItem(LS_KEYS[key], JSON.stringify(value)); return true; }
    catch (e) { console.error(e); return false; }
  }

  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mime = (parts[0].match(/data:([^;]+)/) || [, 'image/jpeg'])[1];
    const bin = atob(parts[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  async function uploadIfDataUrl(client, str, pathHint) {
    if (typeof str !== 'string' || !str.startsWith('data:image/')) return str;
    const blob = dataUrlToBlob(str);
    const path = `site/${pathHint}-${Date.now()}.jpg`;
    const { error } = await client.storage.from(BUCKET).upload(path, blob, {
      contentType: 'image/jpeg', upsert: true, cacheControl: '31536000'
    });
    if (error) throw error;
    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  // Percorre o valor (string simples ou objeto aninhado, como os cards da
  // vitrine) e envia toda imagem em base64 (data:image/...) pro Storage,
  // trocando pela URL pública. URLs que já são http(s) ficam como estão.
  async function uploadDeep(client, value, pathHint) {
    if (typeof value === 'string') return uploadIfDataUrl(client, value, pathHint);
    if (value && typeof value === 'object') {
      const out = Array.isArray(value) ? [] : {};
      for (const k of Object.keys(value)) {
        out[k] = await uploadDeep(client, value[k], `${pathHint}-${k}`);
      }
      return out;
    }
    return value;
  }

  async function fetchRemote(client, key) {
    const { data, error } = await client.from(TABLE).select('value').eq('key', key).maybeSingle();
    if (error) { console.error('[MUV site settings]', error); return undefined; } // undefined = erro
    return data ? data.value : null; // null = ainda não existe no Supabase
  }

  async function pushRemote(client, key, value) {
    const uploaded = await uploadDeep(client, value, key);
    const row = { key, value: uploaded, updated_at: new Date().toISOString() };
    const { error } = await client.from(TABLE).upsert(row, { onConflict: 'key' });
    if (error) throw error;
    setLocal(key, uploaded);
    return uploaded;
  }

  function canAutoReload() {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
    return true;
  }

  async function syncAllFromRemote(client, allowReload) {
    const isAdmin = !!document.getElementById('productForm');
    let changed = false;

    for (const key of Object.keys(LS_KEYS)) {
      const remote = await fetchRemote(client, key);
      if (remote === undefined) continue; // erro de rede: não mexe no que já está local

      const local = getLocal(key);

      if (remote === null && isAdmin && local && JSON.stringify(local) !== JSON.stringify(DEFAULTS[key])) {
        // Ainda não existe nada salvo no Supabase, mas este navegador tem uma
        // personalização — provavelmente feita antes desta sincronização existir.
        const promptKey = MIGRATION_PROMPT_PREFIX + key;
        if (!sessionStorage.getItem(promptKey)) {
          sessionStorage.setItem(promptKey, '1');
          const label = key === 'showcase_cards' ? 'as imagens dos cards da vitrine' : 'a imagem da seção "Sobre nós"';
          const ok = confirm('Encontrei ' + label + ' personalizada(s) apenas neste navegador. Deseja enviá-la(s) para o Supabase agora, para que apareça(m) em todos os dispositivos?');
          if (ok) {
            try { await pushRemote(client, key, local); toast('Sincronizado com sucesso.'); }
            catch (e) { console.error(e); toast('Não foi possível sincronizar: ' + (e.message || 'erro')); }
          }
        }
        continue;
      }

      const remoteValue = remote === null ? DEFAULTS[key] : remote;
      if (JSON.stringify(remoteValue) !== JSON.stringify(local)) {
        setLocal(key, remoteValue);
        changed = true;
      }
    }

    if (changed && allowReload && canAutoReload()) location.reload();
  }

  let _clientReady = null;
  function getClient() {
    if (!_clientReady) {
      _clientReady = loadSupabase().then(api => api.createClient(SUPABASE_URL, SUPABASE_KEY));
    }
    return _clientReady;
  }

  // Lê o valor mais recente direto do Supabase (usa DEFAULTS se a chave
  // ainda não existir na tabela).
  window.MUV_SUPABASE_GET_SITE_SETTING = async function (key) {
    try {
      const client = await getClient();
      const remote = await fetchRemote(client, key);
      if (remote === undefined) return getLocal(key); // erro de rede: cai pro cache local
      return remote === null ? DEFAULTS[key] : remote;
    } catch (e) {
      console.error('[MUV site settings]', e);
      return getLocal(key);
    }
  };

  // Salva um valor (envia imagens base64 pro Storage e grava a URL) e
  // sincroniza com o Supabase. Usado pelo admin.html ao clicar em
  // "Salvar card" / "Salvar imagem" / "Restaurar".
  window.MUV_SUPABASE_SAVE_SITE_SETTING = async function (key, value) {
    const client = await getClient();
    try {
      const saved = await pushRemote(client, key, value);
      toast('Salvo e sincronizado em todos os dispositivos.');
      return saved;
    } catch (e) {
      console.error('[MUV site settings]', e);
      toast('Salvo neste navegador, mas houve erro ao sincronizar com o Supabase: ' + (e.message || 'erro'));
      throw e;
    }
  };

  async function init() {
    try {
      const client = await getClient();
      await syncAllFromRemote(client, true);
    } catch (e) {
      console.error('[MUV site settings]', e);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
