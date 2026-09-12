(function(){
"use strict";

/* =========================================================
   STORAGE HELPERS
========================================================= */
const LS = {
  get(k, fallback){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

const KEYS = {
  products: 'muv_admin_products',
  coupons: 'muv_admin_coupons',
  settings: 'muv_admin_settings',
  creds: 'muv_admin_creds',
  session: 'muv_admin_session',
  customersMeta: 'muv_admin_customers_meta',
  showcaseCards: 'muv_showcase_cards',
  // shared with storefront (index_10.html)
  orders: 'muv_orders',
  cart: 'muv_cart',
  user: 'muv_user',
  addresses: 'muv_addresses'
};

const CATEGORIES = [
  {id:'conjuntos', name:'Conjuntos'},
  {id:'macacoes', name:'Macacões'},
  {id:'blusa', name:'Blusas'},
  {id:'shorts', name:'Shorts'},
  {id:'calcas', name:'Calças'},
  {id:'top', name:'Tops'},
  {id:'moletom', name:'Moletom'},
  {id:'acessorios', name:'Acessórios'}
];

function brl(n){ return (Number(n)||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }
function uid(prefix){ return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

/* =========================================================
   SEED DATA
========================================================= */
function seedProducts(){
  return [
    {id:uid('p'), name:'Conjunto Essence', category:'conjuntos', subcat:'short', price:219, oldPrice:0, stock:14, sku:'MUV-CJ-001', tag:'Mais vendido', description:'Conjunto de short e top em tecido tecnológico com caimento justo.', image:'', active:true, createdAt:Date.now()-86400000*30},
    {id:uid('p'), name:'Conjunto Drap', category:'conjuntos', subcat:'calca', price:199, oldPrice:0, stock:9, sku:'MUV-CJ-002', tag:'', description:'Conjunto de calça flare e top com recortes estratégicos.', image:'', active:true, createdAt:Date.now()-86400000*28},
    {id:uid('p'), name:'Conjunto Nice', category:'conjuntos', subcat:'short', price:189, oldPrice:229, stock:3, sku:'MUV-CJ-003', tag:'Novo', description:'Conjunto leve para treinos de alta intensidade.', image:'', active:true, createdAt:Date.now()-86400000*4},
    {id:uid('p'), name:'Conjunto Hit', category:'conjuntos', subcat:'calca', price:199, oldPrice:0, stock:0, sku:'MUV-CJ-004', tag:'', description:'Conjunto com tecido de compressão média.', image:'', active:true, createdAt:Date.now()-86400000*20},
    {id:uid('p'), name:'Macacão Mom', category:'macacoes', subcat:'', price:234, oldPrice:0, stock:11, sku:'MUV-MC-001', tag:'', description:'Macacão modelagem mom, cintura alta.', image:'', active:true, createdAt:Date.now()-86400000*15},
    {id:uid('p'), name:'Short Rise', category:'shorts', subcat:'', price:139, oldPrice:0, stock:22, sku:'MUV-SH-001', tag:'', description:'Short cintura alta com bolso lateral.', image:'', active:true, createdAt:Date.now()-86400000*40},
    {id:uid('p'), name:'Legging Fit', category:'calcas', subcat:'', price:179, oldPrice:0, stock:4, sku:'MUV-CL-001', tag:'Últimas peças', description:'Legging com sustentação total e bolso lateral.', image:'', active:true, createdAt:Date.now()-86400000*50},
    {id:uid('p'), name:'Top Base', category:'top', subcat:'', price:99, oldPrice:119, stock:18, sku:'MUV-TP-001', tag:'Promoção', description:'Top básico de sustentação média.', image:'', active:true, createdAt:Date.now()-86400000*10},
    {id:uid('p'), name:'Moletom Soft', category:'moletom', subcat:'', price:249, oldPrice:0, stock:7, sku:'MUV-MT-001', tag:'', description:'Moletom canguru em algodão peluciado.', image:'', active:true, createdAt:Date.now()-86400000*60},
    {id:uid('p'), name:'Bolsa Training', category:'acessorios', subcat:'', price:129, oldPrice:0, stock:0, sku:'MUV-AC-001', tag:'', description:'Bolsa impermeável para treinos e academia.', image:'', active:false, createdAt:Date.now()-86400000*70}
  ];
}
function seedCoupons(){
  const d = new Date(); d.setMonth(d.getMonth()+2);
  return [
    {id:uid('c'), code:'BEMVINDA10', type:'percent', value:10, min:0, expiry:d.toISOString().slice(0,10), limit:null, used:0, active:true},
    {id:uid('c'), code:'FRETEGRATIS', type:'fixed', value:25, min:250, expiry:'', limit:100, used:37, active:true}
  ];
}
function seedSettings(){
  return {storeName:'MUV FITNESS', storeEmail:'contato@muvfitness.com.br', storePhone:'(11) 90000-0000', freeShipping:250};
}

/* =========================================================
   STATE / LOAD
========================================================= */
let products = LS.get(KEYS.products, null);
if(!products){ products = seedProducts(); LS.set(KEYS.products, products); }

let coupons = LS.get(KEYS.coupons, null);
if(!coupons){ coupons = seedCoupons(); LS.set(KEYS.coupons, coupons); }

let settings = LS.get(KEYS.settings, null);
if(!settings){ settings = seedSettings(); LS.set(KEYS.settings, settings); }

let creds = LS.get(KEYS.creds, null);
if(!creds){ creds = {user:'admin', pass:'muv2026'}; LS.set(KEYS.creds, creds); }

function getOrders(){ return LS.get(KEYS.orders, []); }
function saveOrders(list){ LS.set(KEYS.orders, list); }
function getCustomersMeta(){ return LS.get(KEYS.customersMeta, {}); }
function saveCustomersMeta(m){ LS.set(KEYS.customersMeta, m); }

/* =========================================================
   TOAST / CONFIRM
========================================================= */
const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toastEl.classList.remove('show'), 2600);
}

const confirmOverlay = document.getElementById('confirmOverlay');
let confirmCb = null;
function askConfirm(title, text, cb){
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmText').textContent = text;
  confirmCb = cb;
  confirmOverlay.classList.add('open');
}
document.getElementById('confirmCancel').addEventListener('click', ()=>{ confirmOverlay.classList.remove('open'); confirmCb=null; });
document.getElementById('confirmOk').addEventListener('click', ()=>{ if(confirmCb) confirmCb(); confirmOverlay.classList.remove('open'); confirmCb=null; });

function closeModal(id){ document.getElementById(id).classList.remove('open'); }
function openModal(id){ document.getElementById(id).classList.add('open'); }
document.querySelectorAll('[data-close]').forEach(btn=>{
  btn.addEventListener('click', ()=>closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(ov=>{
  ov.addEventListener('click', (e)=>{ if(e.target===ov) ov.classList.remove('open'); });
});

/* =========================================================
   LOGIN
========================================================= */
const loginScreen = document.getElementById('loginScreen');
const appEl = document.getElementById('app');

function isLoggedIn(){ return sessionStorage.getItem(KEYS.session) === '1'; }
function enterApp(){
  loginScreen.style.display = 'none';
  appEl.classList.add('visible');
  document.getElementById('sideUserName').textContent = creds.user;
  document.getElementById('sideAvatar').textContent = creds.user.slice(0,1).toUpperCase();
  renderAll();
}

document.getElementById('loginForm').addEventListener('submit', function(e){
  e.preventDefault();
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const c = LS.get(KEYS.creds, creds);
  if(u === c.user && p === c.pass){
    sessionStorage.setItem(KEYS.session, '1');
    document.getElementById('loginError').style.display = 'none';
    enterApp();
  } else {
    document.getElementById('loginError').style.display = 'block';
  }
});

document.getElementById('logoutBtn').addEventListener('click', ()=>{
  askConfirm('Sair do painel?', 'Você precisará entrar novamente com usuário e senha.', ()=>{
    sessionStorage.removeItem(KEYS.session);
    appEl.classList.remove('visible');
    loginScreen.style.display = 'flex';
    document.getElementById('loginPass').value = '';
  });
});

/* =========================================================
   NAVIGATION
========================================================= */
const titles = {dashboard:'Dashboard', products:'Produtos', showcase:'Vitrine', orders:'Pedidos', customers:'Clientes', coupons:'Cupons', settings:'Configurações'};
function safeRender(fn){
  try{ fn(); }
  catch(err){
    console.error('[MUV admin] erro ao renderizar tela:', err);
    showToast('Ocorreu um erro ao carregar esta tela. Veja o console para detalhes.');
  }
}
function goView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  document.querySelectorAll('.side-link').forEach(l=>l.classList.toggle('active', l.dataset.view===name));
  document.getElementById('pageTitle').textContent = titles[name] || '';
  document.getElementById('sidebar').classList.remove('open');
  // Guarda a aba atual pra poder voltar pra ela caso a página recarregue
  // (ex.: depois de salvar um produto no Supabase, ver saveProduct em supabase-products.js).
  sessionStorage.setItem('muv_admin_last_view', name);
  if(name==='dashboard') safeRender(renderDashboard);
  if(name==='products') safeRender(renderProducts);
  if(name==='showcase'){ safeRender(renderShowcase); safeRender(renderAboutImage); }
  if(name==='orders') safeRender(renderOrders);
  if(name==='customers') safeRender(renderCustomers);
  if(name==='coupons') safeRender(renderCoupons);
  if(name==='settings') safeRender(renderSettings);
}
document.querySelectorAll('.side-link').forEach(l=>{
  l.addEventListener('click', (e)=>{ e.preventDefault(); goView(l.dataset.view); });
});
document.querySelectorAll('[data-nav]').forEach(el=>{
  el.addEventListener('click', ()=>goView(el.dataset.nav));
});
document.getElementById('menuToggle').addEventListener('click', ()=>{
  document.getElementById('sidebar').classList.toggle('open');
});

/* =========================================================
   DASHBOARD
========================================================= */
function renderDashboard(){
  const orders = getOrders();
  const revenue = orders.reduce((s,o)=>s+(o.total||0),0);
  document.getElementById('kpiRevenue').textContent = brl(revenue);
  document.getElementById('kpiOrders').textContent = orders.length;
  document.getElementById('kpiTicket').textContent = brl(orders.length ? revenue/orders.length : 0);

  const lowStock = products.filter(p=>p.active && p.stock<=5).length;
  document.getElementById('kpiLowStock').textContent = lowStock;

  const last7 = orders.filter(o=>Date.now()-new Date(o.date).getTime() < 7*86400000);
  const prev7 = orders.filter(o=>{
    const diff = Date.now()-new Date(o.date).getTime();
    return diff >= 7*86400000 && diff < 14*86400000;
  });
  const last7rev = last7.reduce((s,o)=>s+(o.total||0),0);
  const prev7rev = prev7.reduce((s,o)=>s+(o.total||0),0);
  const dEl = document.getElementById('kpiRevenueDelta');
  if(prev7rev===0 && last7rev===0){ dEl.textContent='sem pedidos nos últimos 7 dias'; dEl.className='kpi-delta flat'; }
  else if(prev7rev===0){ dEl.textContent='novo neste período'; dEl.className='kpi-delta up'; }
  else{
    const pct = ((last7rev-prev7rev)/prev7rev*100);
    dEl.textContent = (pct>=0?'▲ ':'▼ ')+Math.abs(pct).toFixed(0)+'% vs. 7 dias anteriores';
    dEl.className = 'kpi-delta ' + (pct>=0?'up':'down');
  }
  document.getElementById('kpiOrdersDelta').textContent = last7.length + ' pedido(s) nos últimos 7 dias';

  // revenue bar chart (last 7 days)
  const days = [];
  for(let i=6;i>=0;i--){
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
    days.push(d);
  }
  const dayTotals = days.map(d=>{
    const next = new Date(d); next.setDate(next.getDate()+1);
    return orders.filter(o=>{ const t=new Date(o.date).getTime(); return t>=d.getTime() && t<next.getTime(); })
                 .reduce((s,o)=>s+(o.total||0),0);
  });
  const maxVal = Math.max(...dayTotals, 1);
  const chartWrap = document.getElementById('revenueChart');
  chartWrap.innerHTML = days.map((d,i)=>{
    const h = Math.max(4, Math.round(dayTotals[i]/maxVal*140));
    const lbl = d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');
    return `<div class="chart-bar-wrap">
      <div class="val">${dayTotals[i]>0 ? 'R$'+Math.round(dayTotals[i]) : ''}</div>
      <div class="chart-bar" style="height:${h}px" title="${brl(dayTotals[i])}"></div>
      <div class="lbl">${lbl}</div>
    </div>`;
  }).join('');

  // status donut
  const statusColors = {
    'Pagamento pendente':'#c98a3a','Pago':'#4c7a5f','Em separação':'#3f6a8a',
    'Enviado':'#8f4c60','Entregue':'#2f6b4f','Cancelado':'#a8452f'
  };
  const statusCount = {};
  orders.forEach(o=>{ const s=o.status||'Pagamento pendente'; statusCount[s]=(statusCount[s]||0)+1; });
  const donutEl = document.getElementById('statusDonut');
  const legendEl = document.getElementById('statusLegend');
  const entries = Object.entries(statusCount);
  if(!entries.length){
    donutEl.style.background = '#f0ebe9';
    legendEl.innerHTML = '<div style="color:var(--ink-faint)">Sem pedidos ainda</div>';
  } else {
    let acc = 0; const total = orders.length;
    const stops = entries.map(([status,count])=>{
      const start = acc/total*360; acc += count; const end = acc/total*360;
      const color = statusColors[status] || '#b96c83';
      return `${color} ${start}deg ${end}deg`;
    }).join(', ');
    donutEl.style.background = `conic-gradient(${stops})`;
    legendEl.innerHTML = entries.map(([status,count])=>{
      const color = statusColors[status] || '#b96c83';
      return `<div><span class="dot" style="background:${color}"></span>${status}<b>${count}</b></div>`;
    }).join('');
  }

  // recent orders
  const recent = [...orders].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  document.getElementById('recentOrdersBody').innerHTML = recent.length ? recent.map(o=>`
    <tr>
      <td class="cell-title">#${o.id}</td>
      <td>${o.email||'—'}</td>
      <td>${brl(o.total)}</td>
      <td>${statusBadge(o.status)}</td>
    </tr>`).join('') : `<tr><td colspan="4" style="text-align:center;color:var(--ink-faint);padding:30px;">Nenhum pedido ainda</td></tr>`;

  // top products by qty sold
  const qtyMap = {};
  orders.forEach(o=>(o.items||[]).forEach(it=>{
    const key = it.name || it.id || 'Item';
    qtyMap[key] = (qtyMap[key]||0) + (it.qty||it.quantity||1);
  }));
  const top = Object.entries(qtyMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  document.getElementById('topProductsBody').innerHTML = top.length ? top.map(([name,qty])=>`
    <tr><td class="cell-title">${name}</td><td>${qty}</td></tr>
  `).join('') : `<tr><td colspan="2" style="text-align:center;color:var(--ink-faint);padding:30px;">Sem vendas registradas</td></tr>`;

  document.getElementById('navCountProducts').textContent = products.length;
  document.getElementById('navCountOrders').textContent = orders.length;
  document.getElementById('navCountCoupons').textContent = coupons.length;
  document.getElementById('navCountCustomers').textContent = Object.keys(groupCustomers(orders)).length;
}

function statusBadge(status){
  const map = {
    'Pagamento pendente':'badge-amber','Pago':'badge-green','Em separação':'badge-blue',
    'Enviado':'badge-blue','Entregue':'badge-green','Cancelado':'badge-red'
  };
  const cls = map[status] || 'badge-gray';
  return `<span class="badge ${cls}">${status||'—'}</span>`;
}

/* =========================================================
   SHOWCASE / VITRINE
========================================================= */
let showcaseCards = LS.get(KEYS.showcaseCards, {
  short:{a:'',b:''},
  calca:{a:'',b:''},
  macaquito:{a:'',b:''}
});

function compressShowcaseImage(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', .82));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderShowcase(){
  ['Short','Calca','Macaquito'].forEach(name=>{
    const key = name.toLowerCase();
    const data = showcaseCards[key] || {};
    const a = document.getElementById('showcasePreview'+name+'A');
    const b = document.getElementById('showcasePreview'+name+'B');
    [a,b].forEach(img=>{
      if(!img) return;
      const src = img.id.endsWith('A') ? (data.a || '') : (data.b || data.a || '');
      if(src){
        img.src = src;
        img.style.display='block';
        const ph = img.parentElement.querySelector('.placeholder');
        if(ph) ph.style.display='none';
      } else {
        img.removeAttribute('src');
        img.style.display='none';
        const box = img.parentElement;
        let ph = box.querySelector('.placeholder');
        if(!ph){ ph=document.createElement('div'); ph.className='placeholder'; box.appendChild(ph); }
        ph.textContent='Imagem original da loja';
        ph.style.display='block';
      }
    });
    const status = document.getElementById('showcaseStatus'+name);
    if(status) status.textContent = (data.a || data.b) ? 'Alterações salvas' : 'Usando imagens originais';
  });
}

['short','calca','macaquito'].forEach(key=>{
  const suffix = key.charAt(0).toUpperCase()+key.slice(1);
  ['A','B'].forEach(slot=>{
    const input = document.getElementById('showcaseInput'+suffix+slot);
    if(!input) return;
    input.addEventListener('change', async e=>{
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      try{
        const dataUrl = await compressShowcaseImage(file);
        showcaseCards[key] = Object.assign({a:'',b:''}, showcaseCards[key] || {});
        showcaseCards[key][slot.toLowerCase()] = dataUrl;
        const preview = document.getElementById('showcasePreview'+suffix+slot);
        if(preview){
          preview.src = dataUrl;
          preview.style.display='block';
          const ph = preview.parentElement.querySelector('.placeholder');
          if(ph) ph.style.display='none';
        }
        const status = document.getElementById('showcaseStatus'+suffix);
        if(status) status.textContent = 'Imagem selecionada — clique em "Salvar card".';
      }catch(err){
        showToast('Não foi possível carregar essa imagem.');
      }
      e.target.value = '';
    });
  });
});

document.querySelectorAll('[data-showcase-save]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    LS.set(KEYS.showcaseCards, showcaseCards);
    renderShowcase();
    showToast('Card da vitrine atualizado.');
    if(window.MUV_SUPABASE_SAVE_SITE_SETTING){
      window.MUV_SUPABASE_SAVE_SITE_SETTING('showcase_cards', showcaseCards).catch(()=>{});
    }
  });
});

document.querySelectorAll('[data-showcase-reset]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const key = btn.dataset.showcaseReset;
    askConfirm('Usar imagens originais?', 'As imagens personalizadas deste card serão removidas e a loja voltará a usar as imagens que já estão no código.', ()=>{
      showcaseCards[key] = {a:'',b:''};
      LS.set(KEYS.showcaseCards, showcaseCards);
      renderShowcase();
      showToast('Imagens originais restauradas.');
      if(window.MUV_SUPABASE_SAVE_SITE_SETTING){
        window.MUV_SUPABASE_SAVE_SITE_SETTING('showcase_cards', showcaseCards).catch(()=>{});
      }
    });
  });
});

window.addEventListener('storage', ev=>{
  if(ev.key === KEYS.showcaseCards){
    showcaseCards = LS.get(KEYS.showcaseCards, {short:{a:'',b:''},calca:{a:'',b:''},macaquito:{a:'',b:''}});
    if(document.getElementById('view-showcase').classList.contains('active')) renderShowcase();
  }
});

/* =========================================================
   IMAGEM DA SEÇÃO "SOBRE NÓS" (home)
   Chave compartilhada: muv_about_image
========================================================= */
const KEY_ABOUT_IMAGE = 'muv_about_image';
let aboutImageDraft = null;

function renderAboutImage(){
  const saved = LS.get(KEY_ABOUT_IMAGE, '');
  const preview = document.getElementById('aboutPreviewImg');
  const status = document.getElementById('aboutImageStatus');
  const src = aboutImageDraft !== null ? aboutImageDraft : saved;
  if(preview){
    if(src){
      preview.src = src;
      preview.style.display='block';
      const ph = preview.parentElement.querySelector('.placeholder');
      if(ph) ph.style.display='none';
    } else {
      preview.removeAttribute('src');
      preview.style.display='none';
      const box = preview.parentElement;
      let ph = box.querySelector('.placeholder');
      if(!ph){ ph=document.createElement('div'); ph.className='placeholder'; box.appendChild(ph); }
      ph.textContent='Ilustração original da loja';
      ph.style.display='block';
    }
  }
  if(status) status.textContent = saved ? 'Alterações salvas' : 'Usando a ilustração original';
}

const aboutImageInput = document.getElementById('aboutImageInput');
if(aboutImageInput){
  aboutImageInput.addEventListener('change', async e=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    try{
      aboutImageDraft = await compressShowcaseImage(file);
      renderAboutImage();
      const status = document.getElementById('aboutImageStatus');
      if(status) status.textContent = 'Imagem selecionada — clique em "Salvar imagem".';
    }catch(err){
      showToast('Não foi possível carregar essa imagem.');
    }
    e.target.value = '';
  });
}

const aboutImageSaveBtn = document.getElementById('aboutImageSave');
if(aboutImageSaveBtn){
  aboutImageSaveBtn.addEventListener('click', ()=>{
    if(aboutImageDraft !== null){
      LS.set(KEY_ABOUT_IMAGE, aboutImageDraft);
      const toSync = aboutImageDraft;
      aboutImageDraft = null;
      if(window.MUV_SUPABASE_SAVE_SITE_SETTING){
        window.MUV_SUPABASE_SAVE_SITE_SETTING('about_image', toSync).catch(()=>{});
      }
    }
    renderAboutImage();
    showToast('Imagem da seção "Sobre nós" atualizada.');
  });
}

const aboutImageResetBtn = document.getElementById('aboutImageReset');
if(aboutImageResetBtn){
  aboutImageResetBtn.addEventListener('click', ()=>{
    askConfirm('Usar a ilustração original?', 'A imagem personalizada será removida e a loja voltará a usar o desenho que já está no código.', ()=>{
      aboutImageDraft = null;
      LS.set(KEY_ABOUT_IMAGE, '');
      renderAboutImage();
      showToast('Ilustração original restaurada.');
      if(window.MUV_SUPABASE_SAVE_SITE_SETTING){
        window.MUV_SUPABASE_SAVE_SITE_SETTING('about_image', '').catch(()=>{});
      }
    });
  });
}

window.addEventListener('storage', ev=>{
  if(ev.key === KEY_ABOUT_IMAGE){
    if(document.getElementById('view-showcase').classList.contains('active')) renderAboutImage();
  }
});

/* =========================================================
   PRODUCTS
========================================================= */
const categorySelect = document.getElementById('pfCategory');
categorySelect.innerHTML = CATEGORIES.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
const catFilterSelect = document.getElementById('prodCategoryFilter');
catFilterSelect.innerHTML += CATEGORIES.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');

// Subcategoria (short/calça) só faz sentido para a categoria "Conjuntos".
// Escondemos o campo pras outras categorias e zeramos o valor, pra não
// sobrar um subcat "fantasma" salvo num produto de outra categoria.
const pfSubcatWrap = document.getElementById('pfSubcatWrap');
const pfSubcatSelect = document.getElementById('pfSubcat');
function syncSubcatVisibility(){
  const show = categorySelect.value === 'conjuntos';
  pfSubcatWrap.style.display = show ? '' : 'none';
  if (!show) pfSubcatSelect.value = '';
}
categorySelect.addEventListener('change', syncSubcatVisibility);

let prodPage = 1;
const PROD_PAGE_SIZE = 8;

function categoryName(id){ const c = CATEGORIES.find(x=>x.id===id); return c ? c.name : id; }

function filteredProducts(){
  const cat = catFilterSelect.value;
  const status = document.getElementById('prodStatusFilter').value;
  const q = (document.getElementById('globalSearch').value||'').toLowerCase();
  return products.filter(p=>{
    if(cat && p.category!==cat) return false;
    if(status==='active' && !p.active) return false;
    if(status==='inactive' && p.active) return false;
    if(status==='lowstock' && !(p.stock<=5)) return false;
    if(q && !(p.name.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q))) return false;
    return true;
  }).sort((a,b)=>b.createdAt-a.createdAt);
}

function renderProducts(){
  const list = filteredProducts();
  const empty = document.getElementById('productsEmpty');
  const tbody = document.getElementById('productsBody');
  empty.style.display = list.length ? 'none' : 'block';

  const totalPages = Math.max(1, Math.ceil(list.length / PROD_PAGE_SIZE));
  if(prodPage>totalPages) prodPage = totalPages;
  const pageItems = list.slice((prodPage-1)*PROD_PAGE_SIZE, prodPage*PROD_PAGE_SIZE);

  tbody.innerHTML = pageItems.map(p=>{
    const thumb = p.image
      ? `<img class="prod-thumb-sm" src="${p.image}">`
      : `<div class="prod-thumb-ph">MUV</div>`;
    const stockBadge = p.stock===0
      ? '<span class="badge badge-red">Esgotado</span>'
      : (p.stock<=5 ? `<span class="badge badge-amber">${p.stock} un.</span>` : `<span class="badge badge-green">${p.stock} un.</span>`);
    const sizesInfo = Array.isArray(p.sizes) && p.sizes.length ? ' · '+p.sizes.length+' tam.' : '';
    const swatches = Array.isArray(p.colors) && p.colors.length
      ? `<div class="prod-swatch-row">${p.colors.slice(0,6).map(c=>`<span class="prod-swatch" style="background:${c.hex}" title="${c.name}"></span>`).join('')}${p.colors.length>6?`<span class="cell-sub">+${p.colors.length-6}</span>`:''}</div>`
      : '';
    return `<tr>
      <td><div class="prod-cell">${thumb}<div><div class="cell-title">${p.name}</div><div class="cell-sub">${p.sku||'—'}${p.tag ? ' · '+p.tag : ''}${sizesInfo}</div>${swatches}</div></div></td>
      <td>${categoryName(p.category)}</td>
      <td>${brl(p.price)}${p.oldPrice?`<div class="cell-sub" style="text-decoration:line-through;">${brl(p.oldPrice)}</div>`:''}</td>
      <td>${stockBadge}</td>
      <td>${p.active ? '<span class="badge badge-green">Ativo</span>' : '<span class="badge badge-gray">Inativo</span>'}</td>
      <td>
        <div class="row-actions" style="justify-content:flex-end;">
          <button class="icon-btn" title="Editar" data-edit="${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
          <button class="icon-btn" title="Duplicar" data-dup="${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>
          <button class="icon-btn danger" title="Excluir" data-del="${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // pagination
  const pag = document.getElementById('productsPagination');
  if(totalPages<=1){ pag.innerHTML=''; }
  else{
    let html = '';
    for(let i=1;i<=totalPages;i++){
      html += `<button class="page-btn ${i===prodPage?'active':''}" data-page="${i}">${i}</button>`;
    }
    pag.innerHTML = html;
    pag.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click', ()=>{ prodPage=Number(b.dataset.page); renderProducts(); }));
  }

  tbody.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', ()=>openProductModal(b.dataset.edit)));
  tbody.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', ()=>{
    const p = products.find(x=>x.id===b.dataset.del);
    askConfirm('Excluir produto?', `"${p.name}" será removido permanentemente do catálogo.`, ()=>{
      products = products.filter(x=>x.id!==b.dataset.del);
      LS.set(KEYS.products, products);
      renderProducts(); renderDashboard();
      showToast('Produto excluído.');
    });
  }));
  tbody.querySelectorAll('[data-dup]').forEach(b=>b.addEventListener('click', ()=>{
    const p = products.find(x=>x.id===b.dataset.dup);
    const copy = Object.assign({}, p, {id:uid('p'), name:p.name+' (cópia)', createdAt:Date.now()});
    products.unshift(copy);
    LS.set(KEYS.products, products);
    renderProducts(); renderDashboard();
    showToast('Produto duplicado.');
  }));
}

let editingProductId = null;
let pendingImages = [];
let pendingColors = [];   // [{name, hex}]
let pendingSizes = [];    // ['P','M',...]
let pendingVariants = []; // [{color, size, stock}]
const COMMON_SIZES = ['PP','P','M','G','GG','XG','Único'];

function renderPfColorList(){
  const list = document.getElementById('pfColorList');
  if(!pendingColors.length){
    list.innerHTML = '<span class="pf-chip-empty">Nenhuma cor adicionada ainda.</span>';
    return;
  }
  list.innerHTML = pendingColors.map((c,i)=>`
    <span class="pf-chip"><span class="swatch" style="background:${c.hex}"></span>${c.name}<button type="button" data-i="${i}" title="Remover cor">✕</button></span>
  `).join('');
  list.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      pendingColors.splice(parseInt(btn.dataset.i), 1);
      renderPfColorList();
      renderVariantGrid();
    });
  });
}

function addPfColor(){
  const nameInput = document.getElementById('pfColorName');
  const hexInput = document.getElementById('pfColorHex');
  const name = nameInput.value.trim();
  if(!name){ showToast('Digite o nome da cor.'); return; }
  if(pendingColors.some(c=>c.name.toLowerCase()===name.toLowerCase())){ showToast('Essa cor já foi adicionada.'); return; }
  pendingColors.push({name, hex: hexInput.value});
  nameInput.value = '';
  renderPfColorList();
  renderVariantGrid();
}

function renderPfSizeQuick(){
  const wrap = document.getElementById('pfSizeQuick');
  wrap.innerHTML = COMMON_SIZES.map(s=>`<button type="button" class="pf-size-chip ${pendingSizes.includes(s)?'active':''}" data-size="${s}">${s}</button>`).join('');
  wrap.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>toggleSize(btn.dataset.size));
  });
}

function renderPfSizeList(){
  const list = document.getElementById('pfSizeList');
  if(!pendingSizes.length){
    list.innerHTML = '';
    return;
  }
  list.innerHTML = pendingSizes.map((s,i)=>`<span class="pf-chip">${s}<button type="button" data-i="${i}" title="Remover tamanho">✕</button></span>`).join('');
  list.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      pendingSizes.splice(parseInt(btn.dataset.i), 1);
      renderPfSizeQuick();
      renderPfSizeList();
      renderVariantGrid();
    });
  });
}

function toggleSize(s){
  const idx = pendingSizes.indexOf(s);
  if(idx>=0) pendingSizes.splice(idx,1); else pendingSizes.push(s);
  renderPfSizeQuick();
  renderPfSizeList();
  renderVariantGrid();
}

function addPfCustomSize(){
  const input = document.getElementById('pfSizeCustom');
  const val = input.value.trim();
  if(!val){ showToast('Digite um tamanho.'); return; }
  if(pendingSizes.some(s=>s.toLowerCase()===val.toLowerCase())){ showToast('Esse tamanho já foi adicionado.'); return; }
  pendingSizes.push(val);
  input.value = '';
  renderPfSizeQuick();
  renderPfSizeList();
  renderVariantGrid();
}

function updateGradeTotal(){
  const total = pendingVariants.reduce((s,v)=>s+(parseInt(v.stock)||0), 0);
  document.getElementById('pfGradeTotal').textContent = total;
  document.getElementById('pfStock').value = total;
}

function renderVariantGrid(){
  const wrap = document.getElementById('pfGradeWrap');
  const stockInput = document.getElementById('pfStock');
  const hint = document.getElementById('pfStockHint');
  if(pendingColors.length && pendingSizes.length){
    wrap.style.display = 'block';
    const newVariants = [];
    pendingColors.forEach(c=>{
      pendingSizes.forEach(s=>{
        const existing = pendingVariants.find(v=>v.color===c.name && v.size===s);
        newVariants.push({color:c.name, size:s, stock: existing ? (parseInt(existing.stock)||0) : 0});
      });
    });
    pendingVariants = newVariants;

    let html = '<thead><tr><th>Cor / Tamanho</th>' + pendingSizes.map(s=>`<th>${s}</th>`).join('') + '</tr></thead><tbody>';
    pendingColors.forEach(c=>{
      html += `<tr><td><div class="pf-grade-color-cell"><span class="swatch" style="background:${c.hex}"></span>${c.name}</div></td>`;
      pendingSizes.forEach(s=>{
        const v = pendingVariants.find(v=>v.color===c.name && v.size===s);
        html += `<td><input type="number" min="0" step="1" value="${v.stock}" data-color="${c.name}" data-size="${s}"></td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';
    document.getElementById('pfGradeTable').innerHTML = html;
    document.getElementById('pfGradeTable').querySelectorAll('input[type="number"]').forEach(inp=>{
      inp.addEventListener('input', ()=>{
        const v = pendingVariants.find(v=>v.color===inp.dataset.color && v.size===inp.dataset.size);
        if(v) v.stock = parseInt(inp.value)||0;
        updateGradeTotal();
      });
    });
    updateGradeTotal();
    stockInput.readOnly = true;
    stockInput.style.background = 'var(--bg)';
    hint.style.display = 'block';
  } else {
    wrap.style.display = 'none';
    pendingVariants = [];
    stockInput.readOnly = false;
    stockInput.style.background = '';
    hint.style.display = 'none';
  }
}

function renderPfImgList(){
  const list = document.getElementById('pfImgList');
  list.innerHTML = pendingImages.map((src, i) => `
    <div class="pf-img-item">
      <img src="${src}">
      ${i===0 ? '<span class="pf-img-main-tag">Principal</span>' : ''}
      <button type="button" class="pf-img-remove" data-i="${i}" title="Remover foto">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('.pf-img-remove').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      pendingImages.splice(parseInt(btn.dataset.i), 1);
      renderPfImgList();
    });
  });
}

function openProductModal(id){
  editingProductId = id || null;
  const form = document.getElementById('productForm');
  form.reset();
  pendingImages = [];
  renderPfImgList();
  document.getElementById('pfActive').checked = true;
  document.getElementById('pfNovidade').checked = false;
  document.getElementById('pfColorHex').value = '#cccccc';

  if(id){
    const p = products.find(x=>x.id===id);
    document.getElementById('productModalTitle').textContent = 'Editar produto';
    document.getElementById('pfName').value = p.name;
    document.getElementById('pfCategory').value = p.category;
    document.getElementById('pfPrice').value = p.price;
    document.getElementById('pfOldPrice').value = p.oldPrice||'';
    document.getElementById('pfStock').value = p.stock;
    document.getElementById('pfSku').value = p.sku||'';
    document.getElementById('pfTag').value = p.tag||'';
    document.getElementById('pfDescription').value = p.description||'';
    document.getElementById('pfActive').checked = !!p.active;
    document.getElementById('pfNovidade').checked = !!p.novidade;
    pendingImages = Array.isArray(p.images) && p.images.length ? p.images.slice() : (p.image ? [p.image] : []);
    renderPfImgList();
    pendingColors = Array.isArray(p.colors) ? p.colors.map(c=>({name:c.name, hex:c.hex||'#d9a3b1'})) : [];
    pendingSizes = Array.isArray(p.sizes) ? p.sizes.slice() : [];
    pendingVariants = Array.isArray(p.variants) ? p.variants.map(v=>({color:v.color, size:v.size, stock:v.stock})) : [];
    syncSubcatVisibility();
    document.getElementById('pfSubcat').value = p.subcat || '';
  } else {
    document.getElementById('productModalTitle').textContent = 'Novo produto';
    pendingColors = [];
    pendingSizes = [];
    pendingVariants = [];
    syncSubcatVisibility();
  }
  renderPfColorList();
  renderPfSizeQuick();
  renderPfSizeList();
  renderVariantGrid();
  openModal('productModalOverlay');
}
document.getElementById('newProductBtn').addEventListener('click', ()=>openProductModal(null));

document.getElementById('pfAddColorBtn').addEventListener('click', addPfColor);
document.getElementById('pfColorName').addEventListener('keydown', function(e){
  if(e.key==='Enter'){ e.preventDefault(); addPfColor(); }
});
document.getElementById('pfAddSizeBtn').addEventListener('click', addPfCustomSize);
document.getElementById('pfSizeCustom').addEventListener('keydown', function(e){
  if(e.key==='Enter'){ e.preventDefault(); addPfCustomSize(); }
});

document.getElementById('pfImgInput').addEventListener('change', function(e){
  const files = Array.from(e.target.files || []);
  if(!files.length) return;
  const results = new Array(files.length);
  let loaded = 0;
  files.forEach((file, i)=>{
    const reader = new FileReader();
    reader.onload = function(ev){
      results[i] = ev.target.result;
      loaded++;
      if(loaded === files.length){
        pendingImages = pendingImages.concat(results);
        renderPfImgList();
      }
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
});

document.getElementById('productForm').addEventListener('submit', function(e){
  e.preventDefault();
  // Segurança: se a pessoa digitou uma cor ou tamanho mas esqueceu de clicar
  // em "+ Adicionar", adiciona automaticamente antes de salvar, pra não perder o que foi digitado.
  if(document.getElementById('pfColorName').value.trim()) addPfColor();
  if(document.getElementById('pfSizeCustom').value.trim()) addPfCustomSize();
  const hasGrade = pendingColors.length>0 && pendingSizes.length>0;
  const stockValue = hasGrade
    ? pendingVariants.reduce((s,v)=>s+(parseInt(v.stock)||0), 0)
    : (parseInt(document.getElementById('pfStock').value)||0);
  const data = {
    name: document.getElementById('pfName').value.trim(),
    category: document.getElementById('pfCategory').value,
    subcat: document.getElementById('pfSubcat').value.trim(),
    price: parseFloat(document.getElementById('pfPrice').value)||0,
    oldPrice: parseFloat(document.getElementById('pfOldPrice').value)||0,
    stock: stockValue,
    sku: document.getElementById('pfSku').value.trim(),
    tag: document.getElementById('pfTag').value,
    description: document.getElementById('pfDescription').value.trim(),
    active: document.getElementById('pfActive').checked,
    novidade: document.getElementById('pfNovidade').checked,
    images: pendingImages.slice(),
    image: pendingImages[0] || '',
    colors: pendingColors.slice(),
    sizes: pendingSizes.slice(),
    variants: pendingVariants.slice()
  };
  if(editingProductId){
    const idx = products.findIndex(x=>x.id===editingProductId);
    products[idx] = Object.assign({}, products[idx], data);
    showToast('Produto atualizado.');
  } else {
    // UUID de verdade (em vez do antigo "p_xxxx") pra bater com o ID que o
    // supabase-products.js vai usar ao enviar esse mesmo produto pro banco —
    // sem isso, o produto acabava duplicado (um local, outro no Supabase).
    data.id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : uid('p');
    data.createdAt = Date.now();
    if(!data.sku) data.sku = 'MUV-' + data.id.replace(/-/g,'').slice(-6).toUpperCase();
    products.unshift(data);
    showToast('Produto cadastrado.');
  }
  LS.set(KEYS.products, products);
  closeModal('productModalOverlay');
  renderProducts(); renderDashboard();

  // Envia esse mesmo produto (já com cor/tamanho/grade) pro catálogo online no
  // Supabase, chamando diretamente a função exposta pelo supabase-products.js.
  // Assim não depende de qual script "roda primeiro" — funciona mesmo que o
  // Supabase ainda esteja carregando no momento em que o formulário é enviado.
  const idForSync = editingProductId || data.id;
  if (typeof window.MUV_SUPABASE_SAVE_PRODUCT === 'function') {
    window.MUV_SUPABASE_SAVE_PRODUCT(Object.assign({}, data, {id: idForSync}), editingProductId || null)
      .catch(err => console.error('[MUV Supabase] erro ao sincronizar produto:', err));
  }
});

catFilterSelect.addEventListener('change', ()=>{ prodPage=1; renderProducts(); });
document.getElementById('prodStatusFilter').addEventListener('change', ()=>{ prodPage=1; renderProducts(); });

/* =========================================================
   ORDERS
========================================================= */
const ORDER_STATUSES = ['Pagamento pendente','Pago','Em separação','Enviado','Entregue','Cancelado'];

function filteredOrders(){
  const status = document.getElementById('orderStatusFilter').value;
  const q = (document.getElementById('globalSearch').value||'').toLowerCase();
  return getOrders().filter(o=>{
    if(status && (o.status||'Pagamento pendente')!==status) return false;
    if(q && !((o.id||'').toLowerCase().includes(q) || (o.email||'').toLowerCase().includes(q))) return false;
    return true;
  }).sort((a,b)=>new Date(b.date)-new Date(a.date));
}

function renderOrders(){
  const list = filteredOrders();
  const tbody = document.getElementById('ordersBody');
  document.getElementById('ordersEmpty').style.display = list.length ? 'none' : 'block';
  tbody.innerHTML = list.map(o=>{
    const itemCount = (o.items||[]).reduce((s,it)=>s+(it.qty||it.quantity||1),0);
    const dt = o.date ? new Date(o.date).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—';
    return `<tr>
      <td class="cell-title">#${o.id}</td>
      <td>${o.email||'—'}</td>
      <td>${dt}</td>
      <td>${itemCount} item(ns)</td>
      <td class="cell-title">${brl(o.total)}</td>
      <td>${(o.paymentMethod||'—')==='pix'?'Pix':(o.paymentMethod==='card'?'Cartão':(o.paymentMethod||'—'))}</td>
      <td>
        <select class="status-select" data-order-status="${o.id}">
          ${ORDER_STATUSES.map(s=>`<option ${s===(o.status||'Pagamento pendente')?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td style="text-align:right;">
        <button class="icon-btn" title="Ver detalhes" data-view-order="${o.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg></button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-order-status]').forEach(sel=>{
    sel.addEventListener('change', ()=>{
      const orders = getOrders();
      const idx = orders.findIndex(o=>o.id===sel.dataset.orderStatus);
      if(idx>-1){
        orders[idx].status = sel.value;
        saveOrders(orders);
        showToast('Status do pedido #'+sel.dataset.orderStatus+' atualizado para "'+sel.value+'".');
        renderDashboard();
      }
    });
  });
  tbody.querySelectorAll('[data-view-order]').forEach(b=>b.addEventListener('click', ()=>openOrderModal(b.dataset.viewOrder)));
}

function openOrderModal(id){
  const orders = getOrders();
  const o = orders.find(x=>x.id===id);
  if(!o) return;
  document.getElementById('orderModalTitle').textContent = 'Pedido #'+o.id;
  const dt = o.date ? new Date(o.date).toLocaleString('pt-BR') : '—';
  const items = o.items||[];
  const itemsHtml = items.length ? items.map(it=>`
    <div class="od-item">
      ${it.image ? `<img src="${it.image}">` : `<div style="width:44px;height:54px;border-radius:6px;background:var(--nude);flex-shrink:0;"></div>`}
      <div style="flex:1;">
        <div class="cell-title">${it.name||'Item'}</div>
        <div class="cell-sub">${it.size?('Tam. '+it.size+' · '):''}Qtd: ${it.qty||it.quantity||1}</div>
      </div>
      <div class="cell-title">${brl((it.price||0)*(it.qty||it.quantity||1))}</div>
    </div>`).join('') : '<p style="color:var(--ink-faint);font-size:13px;">Sem itens registrados.</p>';

  const addr = o.address;
  const addrHtml = (o.delivery==='pickup' || !addr)
    ? '<div class="addr-box">Retirada em loja / sem endereço de entrega informado.</div>'
    : `<div class="addr-box">${addr.firstName||''} ${addr.lastName||''}<br>
        ${addr.street||''}, ${addr.number||''} ${addr.complement?('- '+addr.complement):''}<br>
        ${addr.neighborhood||''} — ${addr.city||''}/${addr.state||''}<br>
        CEP ${addr.cep||''} · Tel: ${addr.phone||'—'}</div>`;

  document.getElementById('orderModalBody').innerHTML = `
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:18px;">
      <div class="cell-sub">Realizado em ${dt}</div>
      <div>${statusBadge(o.status)}</div>
    </div>
    <div class="od-section">
      <h4>Cliente</h4>
      <div class="addr-box">${o.email||'—'}</div>
    </div>
    <div class="od-section">
      <h4>Itens do pedido</h4>
      ${itemsHtml}
    </div>
    <div class="od-section">
      <h4>Entrega</h4>
      ${addrHtml}
    </div>
    <div class="od-section">
      <h4>Pagamento</h4>
      <div class="addr-box">${(o.paymentMethod||'—')==='pix'?'Pix':(o.paymentMethod==='card'?'Cartão de crédito':(o.paymentMethod||'—'))}</div>
    </div>
    <div class="od-totals">
      <div class="row"><span>Subtotal</span><span>${brl(o.subtotal)}</span></div>
      <div class="row"><span>Frete</span><span>${o.freight ? brl(o.freight) : 'Grátis'}</span></div>
      <div class="row total"><span>Total</span><span>${brl(o.total)}</span></div>
    </div>
  `;
  openModal('orderModalOverlay');
}

document.getElementById('orderStatusFilter').addEventListener('change', renderOrders);

/* =========================================================
   CUSTOMERS
========================================================= */
function groupCustomers(orders){
  const map = {};
  orders.forEach(o=>{
    const key = (o.email||'sem-email').toLowerCase();
    if(!map[key]) map[key] = {email:o.email||'—', orders:0, total:0, lastDate:o.date};
    map[key].orders += 1;
    map[key].total += (o.total||0);
    if(new Date(o.date) > new Date(map[key].lastDate)) map[key].lastDate = o.date;
  });
  return map;
}

function renderCustomers(){
  const orders = getOrders();
  const map = groupCustomers(orders);
  const q = (document.getElementById('globalSearch').value||'').toLowerCase();
  let list = Object.values(map);
  if(q) list = list.filter(c=>c.email.toLowerCase().includes(q));
  list.sort((a,b)=>b.total-a.total);

  const tbody = document.getElementById('customersBody');
  document.getElementById('customersEmpty').style.display = list.length ? 'none' : 'block';
  tbody.innerHTML = list.map(c=>{
    const dt = c.lastDate ? new Date(c.lastDate).toLocaleDateString('pt-BR') : '—';
    const initials = (c.email||'?').slice(0,1).toUpperCase();
    return `<tr>
      <td><div class="prod-cell"><div class="prod-thumb-ph" style="border-radius:50%;">${initials}</div><div class="cell-title">${c.email}</div></div></td>
      <td>${c.orders}</td>
      <td class="cell-title">${brl(c.total)}</td>
      <td>${dt}</td>
      <td style="text-align:right;">
        <button class="btn btn-ghost btn-sm" data-view-customer="${encodeURIComponent(c.email)}">Ver pedidos</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-view-customer]').forEach(b=>b.addEventListener('click', ()=>{
    const email = decodeURIComponent(b.dataset.viewCustomer);
    document.getElementById('orderStatusFilter').value = '';
    document.getElementById('globalSearch').value = email;
    goView('orders');
  }));
}

/* =========================================================
   COUPONS
========================================================= */
function renderCoupons(){
  const tbody = document.getElementById('couponsBody');
  document.getElementById('couponsEmpty').style.display = coupons.length ? 'none' : 'block';
  tbody.innerHTML = coupons.map(c=>{
    const discount = c.type==='percent' ? c.value+'%' : brl(c.value);
    const expired = c.expiry && new Date(c.expiry) < new Date();
    const status = !c.active ? '<span class="badge badge-gray">Inativo</span>'
      : expired ? '<span class="badge badge-red">Expirado</span>'
      : '<span class="badge badge-green">Ativo</span>';
    return `<tr>
      <td class="cell-title">${c.code}</td>
      <td>${discount}</td>
      <td>${c.min ? brl(c.min) : '—'}</td>
      <td>${c.expiry ? new Date(c.expiry).toLocaleDateString('pt-BR') : 'Sem validade'}</td>
      <td>${c.used||0}${c.limit?(' / '+c.limit):''}</td>
      <td>${status}</td>
      <td style="text-align:right;">
        <div class="row-actions" style="justify-content:flex-end;">
          <button class="icon-btn" title="Editar" data-edit-coupon="${c.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
          <button class="icon-btn danger" title="Excluir" data-del-coupon="${c.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-edit-coupon]').forEach(b=>b.addEventListener('click', ()=>openCouponModal(b.dataset.editCoupon)));
  tbody.querySelectorAll('[data-del-coupon]').forEach(b=>b.addEventListener('click', ()=>{
    const c = coupons.find(x=>x.id===b.dataset.delCoupon);
    askConfirm('Excluir cupom?', `O cupom "${c.code}" será removido.`, ()=>{
      coupons = coupons.filter(x=>x.id!==b.dataset.delCoupon);
      LS.set(KEYS.coupons, coupons);
      renderCoupons(); renderDashboard();
      showToast('Cupom excluído.');
    });
  }));
}

let editingCouponId = null;
function openCouponModal(id){
  editingCouponId = id || null;
  document.getElementById('couponForm').reset();
  document.getElementById('cfActive').checked = true;
  if(id){
    const c = coupons.find(x=>x.id===id);
    document.getElementById('couponModalTitle').textContent = 'Editar cupom';
    document.getElementById('cfCode').value = c.code;
    document.getElementById('cfType').value = c.type;
    document.getElementById('cfValue').value = c.value;
    document.getElementById('cfMin').value = c.min||'';
    document.getElementById('cfExpiry').value = c.expiry||'';
    document.getElementById('cfLimit').value = c.limit||'';
    document.getElementById('cfActive').checked = !!c.active;
  } else {
    document.getElementById('couponModalTitle').textContent = 'Novo cupom';
  }
  openModal('couponModalOverlay');
}
document.getElementById('newCouponBtn').addEventListener('click', ()=>openCouponModal(null));

document.getElementById('couponForm').addEventListener('submit', function(e){
  e.preventDefault();
  const data = {
    code: document.getElementById('cfCode').value.trim().toUpperCase(),
    type: document.getElementById('cfType').value,
    value: parseFloat(document.getElementById('cfValue').value)||0,
    min: parseFloat(document.getElementById('cfMin').value)||0,
    expiry: document.getElementById('cfExpiry').value,
    limit: document.getElementById('cfLimit').value ? parseInt(document.getElementById('cfLimit').value) : null,
    active: document.getElementById('cfActive').checked
  };
  if(editingCouponId){
    const idx = coupons.findIndex(x=>x.id===editingCouponId);
    coupons[idx] = Object.assign({}, coupons[idx], data);
    showToast('Cupom atualizado.');
  } else {
    data.id = uid('c');
    data.used = 0;
    coupons.unshift(data);
    showToast('Cupom criado.');
  }
  LS.set(KEYS.coupons, coupons);
  closeModal('couponModalOverlay');
  renderCoupons(); renderDashboard();
});

/* =========================================================
   SETTINGS
========================================================= */
function renderSettings(){
  document.getElementById('setStoreName').value = settings.storeName||'';
  document.getElementById('setStoreEmail').value = settings.storeEmail||'';
  document.getElementById('setStorePhone').value = settings.storePhone||'';
  document.getElementById('setFreeShipping').value = settings.freeShipping||0;
  document.getElementById('setAdminUser').value = creds.user||'';
  document.getElementById('setAdminPass').value = '';
}

document.getElementById('saveSettingsBtn').addEventListener('click', ()=>{
  settings = {
    storeName: document.getElementById('setStoreName').value.trim(),
    storeEmail: document.getElementById('setStoreEmail').value.trim(),
    storePhone: document.getElementById('setStorePhone').value.trim(),
    freeShipping: parseFloat(document.getElementById('setFreeShipping').value)||0
  };
  LS.set(KEYS.settings, settings);
  showToast('Configurações salvas.');
});

document.getElementById('saveAccountBtn').addEventListener('click', ()=>{
  const u = document.getElementById('setAdminUser').value.trim();
  const p = document.getElementById('setAdminPass').value;
  if(!u){ showToast('Informe um usuário válido.'); return; }
  creds = {user:u, pass: p ? p : creds.pass};
  LS.set(KEYS.creds, creds);
  document.getElementById('sideUserName').textContent = creds.user;
  document.getElementById('sideAvatar').textContent = creds.user.slice(0,1).toUpperCase();
  document.getElementById('setAdminPass').value = '';
  showToast('Dados de acesso atualizados.');
});

document.getElementById('exportDataBtn').addEventListener('click', ()=>{
  const payload = { products, coupons, settings, showcaseCards, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'muv-admin-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup exportado.');
});

document.getElementById('importDataInput').addEventListener('change', function(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    try{
      const data = JSON.parse(ev.target.result);
      askConfirm('Importar dados?', 'Isso substituirá produtos, cupons e configurações atuais deste navegador.', ()=>{
        if(data.products){ products = data.products; LS.set(KEYS.products, products); }
        if(data.coupons){ coupons = data.coupons; LS.set(KEYS.coupons, coupons); }
        if(data.settings){ settings = data.settings; LS.set(KEYS.settings, settings); }
        if(data.showcaseCards){ showcaseCards = data.showcaseCards; LS.set(KEYS.showcaseCards, showcaseCards); }
        renderAll();
        showToast('Dados importados com sucesso.');
      });
    }catch(err){ showToast('Arquivo inválido.'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('resetDemoBtn').addEventListener('click', ()=>{
  askConfirm('Restaurar catálogo de demonstração?', 'Todos os produtos e cupons cadastrados neste navegador serão substituídos pelos dados de exemplo.', ()=>{
    products = seedProducts(); LS.set(KEYS.products, products);
    coupons = seedCoupons(); LS.set(KEYS.coupons, coupons);
    renderAll();
    showToast('Catálogo de demonstração restaurado.');
  });
});

/* =========================================================
   GLOBAL SEARCH
========================================================= */
let searchDebounce;
document.getElementById('globalSearch').addEventListener('input', ()=>{
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(()=>{
    const active = document.querySelector('.view.active').id.replace('view-','');
    if(active==='products'){ prodPage=1; renderProducts(); }
    if(active==='orders') renderOrders();
    if(active==='customers') renderCustomers();
  }, 200);
});

/* =========================================================
   INIT
========================================================= */
function renderAll(){
  safeRender(renderDashboard);
  safeRender(renderProducts);
  safeRender(renderShowcase);
  safeRender(renderAboutImage);
  safeRender(renderOrders);
  safeRender(renderCustomers);
  safeRender(renderCoupons);
  safeRender(renderSettings);
}

// keep dashboard counters fresh if orders change in another tab (same-origin storefront)
window.addEventListener('storage', function(ev){
  if(ev.key===KEYS.orders && appEl.classList.contains('visible')){
    const active = document.querySelector('.view.active').id.replace('view-','');
    renderDashboard();
    if(active==='orders') renderOrders();
    if(active==='customers') renderCustomers();
  }
});

/* =========================================================
   ENTRADA NO PAINEL
   (fica por último de propósito: por aqui, todas as variáveis
   e funções usadas pelas telas já existem e foram inicializadas)
========================================================= */
if(isLoggedIn()){
  try{
    enterApp();
    // Depois de recarregar a página (ex.: após salvar um produto), volta pra
    // aba em que a pessoa estava, em vez de sempre cair no Dashboard.
    const lastView = sessionStorage.getItem('muv_admin_last_view');
    if(lastView && document.getElementById('view-'+lastView)) goView(lastView);
  }
  catch(err){ console.error('[MUV admin] erro ao entrar no painel:', err); }
}

})();