/* =========================================================
   INTEGRAÇÃO COM O PAINEL ADMIN (MUV Admin)
   Lê os produtos cadastrados no painel (localStorage) e injeta
   os cards no site ANTES do restante do script rodar, para que
   esses produtos entrem automaticamente no carrinho, na busca
   e na página de produto.

   Regra: cada produto aparece na CATEGORIA que foi escolhida no
   cadastro (Conjuntos/Short, Conjuntos/Calça, Macaquitos, Blusas,
   ou qualquer outra categoria criada no painel). Só entra também
   na vitrine "Novidades" da home se a pessoa marcar a opção
   "Mostrar em Novidades" no cadastro do produto.
========================================================= */
(function(){
  try {
    var raw = localStorage.getItem('muv_admin_products');
    if (!raw) return;
    var products = JSON.parse(raw) || [];
    var active = products.filter(function(p){ return p && p.active; });
    if (!active.length) return;

    function esc(s){
      return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
      });
    }
    function brl(n){
      return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    var placeholderSvg = '<svg viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M15 10l8-3 7 4 7-4 8 3-3 10-5-2v9h-14v-9l-5 2zM22 34h16l2 20-2 4h-16l-2-4z"/></svg>';

    function cardHtml(p){
      var imgs = (Array.isArray(p.images) && p.images.length) ? p.images : (p.image ? [p.image] : []);
      function imgTag(src){
        return src ? '<img src="' + esc(src) + '" alt="' + esc(p.name) + '" loading="lazy">' : placeholderSvg;
      }
      var imgAHtml = imgTag(imgs[0]);
      var imgBHtml = imgTag(imgs.length > 1 ? imgs[1] : imgs[0]);
      var extraHtml = imgs.slice(2).map(function(src){
        return '<div class="img-extra"><img src="' + esc(src) + '" alt="' + esc(p.name) + '"></div>';
      }).join('');
      var oldPriceHtml = p.oldPrice ? '<span class="old">' + esc(brl(p.oldPrice)) + '</span>' : '';
      var stockNum = Number(p.stock) || 0;
      var tagHtml = stockNum <= 0 ? '<span class="tag">Esgotado</span>' : (p.tag ? '<span class="tag">' + esc(p.tag) + '</span>' : '');
      var price = Number(p.price) || 0;
      var installHtml = 'Aceitamos cartão de crédito e Pix';
      var colorsArr = Array.isArray(p.colors) ? p.colors : [];
      var colorsJson = esc(JSON.stringify(colorsArr));
      var sizesJson = esc(JSON.stringify(Array.isArray(p.sizes) ? p.sizes : []));
      var variantsJson = esc(JSON.stringify(Array.isArray(p.variants) ? p.variants : []));
      var colorDotsHtml = '';
      if (colorsArr.length){
        var shown = colorsArr.slice(0, 6).map(function(c){
          return '<span class="prod-color-dot" style="background:' + esc(c.hex || '#ccc') + '" title="' + esc(c.name || '') + '"></span>';
        }).join('');
        var moreHtml = colorsArr.length > 6 ? '<span class="prod-color-more">+' + (colorsArr.length - 6) + '</span>' : '';
        colorDotsHtml = '<div class="prod-color-row">' + shown + moreHtml + '</div>';
      }
      var sizesArr = (Array.isArray(p.sizes) && p.sizes.length) ? p.sizes : ((p.category || '').trim() === 'acessorios' ? [] : ['P', 'M', 'G']);
      var sizesRowHtml = sizesArr.length
        ? '<div class="prod-size-row">' + sizesArr.map(function(s){ return '<span>' + esc(s) + '</span>'; }).join('') + '</div>'
        : '';
      return (
        '<div class="prod-card" data-id="' + esc(p.id) + '" data-subcat="' + esc(p.subcat || '') + '" data-name="' + esc(p.name) + '" data-price="' + price.toFixed(2) + '" data-stock="' + stockNum + '" data-colors="' + colorsJson + '" data-sizes="' + sizesJson + '" data-variants="' + variantsJson + '">' +
          '<div class="prod-thumb">' +
            tagHtml +
            '<div class="img-a">' + imgAHtml + '</div>' +
            '<div class="img-b">' + imgBHtml + '</div>' +
            extraHtml +
          '</div>' +
          '<h4>' + esc(p.name) + '</h4>' +
          '<div class="price">' + oldPriceHtml + '<strong>' + esc(brl(price)) + '</strong></div>' +
          colorDotsHtml +
          sizesRowHtml +
          '<span class="install">' + installHtml + '</span>' +
        '</div>'
      );
    }

    // Mapa das categorias do painel -> grid já existente no site.
    // "conjuntos" usa a mesma grid para os dois subcats (short/calça),
    // o filtro por subcat já é feito pelo restante do script (data-subcat).
    var CATEGORY_GRID = {
      conjuntos: { gridId: 'conjuntosGrid', sectionId: 'conjuntos' },
      macacoes:  { gridId: 'macacaoGrid',  sectionId: 'macacoes' },
      blusa:     { gridId: 'blusaGrid',    sectionId: 'blusa' }
    };

    var CATEGORY_TITLES = {
      shorts: 'Shorts',
      calcas: 'Calças',
      top: 'Tops',
      moletom: 'Moletom',
      acessorios: 'Acessórios'
    };

    function svgArrow(dir){
      return dir === 'prev'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>';
    }

    // Cria (uma única vez) uma seção nova no site para categorias do
    // painel que ainda não têm uma vitrine própria no HTML (ex: Shorts,
    // Calças, Tops, Moletom, Acessórios), em vez de "sumir" com o produto
    // ou jogá-lo dentro de Novidades.
    function getOrCreateCategorySection(categoryId){
      if (CATEGORY_GRID[categoryId]) return CATEGORY_GRID[categoryId];

      var gridId = categoryId + 'Grid';
      var existingGrid = document.getElementById(gridId);
      if (existingGrid) {
        CATEGORY_GRID[categoryId] = { gridId: gridId, sectionId: categoryId };
        return CATEGORY_GRID[categoryId];
      }

      var title = CATEGORY_TITLES[categoryId] || (categoryId.charAt(0).toUpperCase() + categoryId.slice(1));
      var anchor = document.getElementById('painelProducts');
      if (!anchor || !anchor.parentNode) return null;

      var section = document.createElement('section');
      section.className = 'prod-section';
      section.id = categoryId;
      section.innerHTML =
        '<div class="container">' +
          '<div class="section-head reveal"><h2>' + esc(title) + '</h2></div>' +
          '<div class="carousel-wrap">' +
            '<button class="carousel-arrow cn-prev" data-target="' + gridId + '" aria-label="Anterior">' + svgArrow('prev') + '</button>' +
            '<button class="carousel-arrow cn-next" data-target="' + gridId + '" aria-label="Próxima">' + svgArrow('next') + '</button>' +
            '<div class="prod-grid reveal" id="' + gridId + '"></div>' +
          '</div>' +
        '</div>';

      anchor.parentNode.insertBefore(section, anchor.nextSibling);
      CATEGORY_GRID[categoryId] = { gridId: gridId, sectionId: categoryId };
      return CATEGORY_GRID[categoryId];
    }

    var novidadesHtml = [];

    active.forEach(function(p){
      var categoryId = (p.category || '').trim();
      var target = categoryId ? getOrCreateCategorySection(categoryId) : null;
      var html = cardHtml(p);

      if (target) {
        var grid = document.getElementById(target.gridId);
        if (grid) grid.insertAdjacentHTML('afterbegin', html);
      } else {
        console.warn('Produto "' + p.name + '" está sem categoria válida; não foi possível posicioná-lo em nenhuma vitrine.');
      }

      if (p.novidade) novidadesHtml.push(html);
    });

    // "Novidades" só recebe os produtos marcados explicitamente pela loja.
    if (novidadesHtml.length) {
      var novGrid = document.getElementById('painelProductsGrid');
      var novSection = document.getElementById('painelProducts');
      if (novGrid && novSection) {
        novGrid.innerHTML = novidadesHtml.join('');
        novSection.style.display = '';
        // libera os links "Novidades" do menu/drawer/pílulas, que ficam
        // escondidos enquanto não houver nenhum produto marcado como novidade
        document.querySelectorAll('.nov-link').forEach(function(el){ el.style.display = ''; });
      }
    }
  } catch (e) {
    console.error('Erro ao carregar produtos do painel MUV Admin:', e);
  }
})();

/* =========================================================
   CARDS DA VITRINE — imagens alteráveis pelo MUV Admin
   Chave compartilhada: muv_showcase_cards
========================================================= */
(function(){
  'use strict';

  function applyShowcaseImages(){
    try{
      var raw = localStorage.getItem('muv_showcase_cards');
      if(!raw) return;
      var data = JSON.parse(raw) || {};
      var map = {
        short: document.querySelector('.showcase-card.sc-1'),
        calca: document.querySelector('.showcase-card.sc-2'),
        macaquito: document.querySelector('.showcase-card.sc-3')
      };

      Object.keys(map).forEach(function(key){
        var card = map[key];
        if(!card) return;
        var cfg = data[key] || {};
        var a = card.querySelector('.sc-a img');
        var b = card.querySelector('.sc-b img');
        if(cfg.a && a) a.src = cfg.a;
        if((cfg.b || cfg.a) && b) b.src = cfg.b || cfg.a;
      });
    }catch(e){
      console.warn('Não foi possível carregar as imagens personalizadas da vitrine.', e);
    }
  }

  applyShowcaseImages();

  window.addEventListener('storage', function(ev){
    if(ev.key === 'muv_showcase_cards') applyShowcaseImages();
  });

  /* Imagem da seção "Sobre nós" — chave compartilhada: muv_about_image
     (salva pelo admin via LS.set, que grava como JSON — por isso o parse abaixo) */
  function applyAboutImage(){
    try{
      var raw = localStorage.getItem('muv_about_image');
      var box = document.getElementById('aboutVisual');
      if(!box) return;
      var src = raw ? JSON.parse(raw) : '';
      var img = box.querySelector('img');
      if(src){
        if(!img){ img = document.createElement('img'); img.alt = 'MUV Fitness'; box.appendChild(img); }
        img.src = src;
      } else if(img){
        img.remove();
      }
    }catch(e){
      console.warn('Não foi possível carregar a imagem da seção "Sobre nós".', e);
    }
  }
  applyAboutImage();
  window.addEventListener('storage', function(ev){
    if(ev.key === 'muv_about_image') applyAboutImage();
  });
})();

  // topbar rotating messages
  const tb = document.querySelectorAll('.topbar-track span');
  let tbi = 0;
  setInterval(() => {
    tb[tbi].classList.remove('active');
    tbi = (tbi + 1) % tb.length;
    tb[tbi].classList.add('active');
  }, 3200);

  // hero slides
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.dots button');
  let si = 0;
  function goSlide(i){
    slides[si].classList.remove('active');
    dots[si].classList.remove('active');
    si = i;
    slides[si].classList.add('active');
    dots[si].classList.add('active');
  }
  dots.forEach(d => d.addEventListener('click', () => goSlide(parseInt(d.dataset.i))));
  setInterval(() => goSlide((si + 1) % slides.length), 5000);

  // mobile drawer
  const menuOpen = document.getElementById('menuOpen');
  const menuClose = document.getElementById('menuClose');
  const drawer = document.getElementById('drawer');
  menuOpen.addEventListener('click', () => drawer.classList.add('open'));
  menuClose.addEventListener('click', () => drawer.classList.remove('open'));
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', (e) => {
    if (a.hasAttribute('data-close-drawer')) e.preventDefault();
    drawer.classList.remove('open');
  }));
  document.getElementById('drawerAccount').addEventListener('click', () => {
    drawer.classList.remove('open');
    openDrawer(accountDrawer);
  });

  // reveal on scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* =========================================================
     SKELETON DE CARREGAMENTO PARA IMAGENS DE PRODUTO
     Funciona tanto para cards estáticos quanto para grids
     renderizados dinamicamente (categoria, busca, carrinho).
  ========================================================= */
  function markLoadingThumbs(root){
    (root || document).querySelectorAll('.prod-thumb .img-a img, .prod-thumb .img-b img, .pp-main-img img, .cart-row-thumb img').forEach(img => {
      if (img.dataset.skeletonBound) return;
      img.dataset.skeletonBound = '1';
      const thumb = img.closest('.prod-thumb, .pp-main-img, .cart-row-thumb');
      if (!thumb) return;
      if (img.complete && img.naturalWidth > 0) return;
      thumb.classList.add('img-loading');
      const clear = () => thumb.classList.remove('img-loading');
      img.addEventListener('load', clear, { once: true });
      img.addEventListener('error', clear, { once: true });
    });
  }
  markLoadingThumbs();
  new MutationObserver((mutations) => {
    mutations.forEach(m => { if (m.addedNodes.length) markLoadingThumbs(); });
  }).observe(document.body, { childList: true, subtree: true });

  /* =========================================================
     CARROSSEL DE PRODUTOS (setas anterior/próxima)
  ========================================================= */
  function scrollAmountFor(grid){
    const card = grid.querySelector('.prod-card');
    if (!card) return 300;
    const style = getComputedStyle(grid);
    const gap = parseFloat(style.columnGap || style.gap || '24');
    return card.getBoundingClientRect().width + gap;
  }
  function updateCarouselButtons(grid){
    const wrap = grid.closest('.carousel-wrap');
    if (!wrap) return;
    const prevBtn = wrap.querySelector('.cn-prev');
    const nextBtn = wrap.querySelector('.cn-next');
    if (prevBtn) prevBtn.disabled = grid.scrollLeft <= 4;
    if (nextBtn) nextBtn.disabled = grid.scrollLeft >= grid.scrollWidth - grid.clientWidth - 4;
  }
  document.querySelectorAll('.carousel-arrow').forEach(btn => {
    const grid = document.getElementById(btn.dataset.target);
    if (!grid) return;
    btn.addEventListener('click', () => {
      const amount = scrollAmountFor(grid);
      grid.scrollBy({ left: btn.classList.contains('cn-next') ? amount : -amount, behavior: 'smooth' });
    });
  });
  document.querySelectorAll('.prod-grid').forEach(grid => {
    updateCarouselButtons(grid);
    grid.addEventListener('scroll', () => updateCarouselButtons(grid), { passive: true });
    window.addEventListener('resize', () => updateCarouselButtons(grid));
  });

  /* =========================================================
     TOAST
  ========================================================= */
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function showToast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  /* =========================================================
     PRODUCT INDEX (built from the DOM, used by search + cart)
  ========================================================= */
  const PRODUCTS = Array.from(document.querySelectorAll('.prod-card')).map(card => {
    let colors = [], sizes = [], variants = [];
    try { colors = JSON.parse(card.dataset.colors || '[]') || []; } catch (e) { colors = []; }
    try { sizes = JSON.parse(card.dataset.sizes || '[]') || []; } catch (e) { sizes = []; }
    try { variants = JSON.parse(card.dataset.variants || '[]') || []; } catch (e) { variants = []; }
    // stock: only enforced for products that came from the admin panel (data-stock present).
    // Static/hardcoded cards without data-stock are treated as unlimited (stock = null).
    const stock = card.dataset.stock !== undefined ? (parseInt(card.dataset.stock) || 0) : null;
    return {
      id: card.dataset.id,
      name: card.dataset.name,
      price: parseFloat(card.dataset.price),
      oldPriceText: card.querySelector('.old')?.textContent || '',
      install: card.querySelector('.install')?.textContent || '',
      tag: card.querySelector('.tag')?.textContent || '',
      section: card.closest('section')?.id || '',
      subcat: card.dataset.subcat || '',
      images: Array.from(card.querySelectorAll('.img-a, .img-b, .img-extra')).map(el => el.innerHTML),
      colors, sizes, variants, stock
    };
  });

  // Estoque disponível para um produto numa combinação de cor/tamanho.
  // Retorna null quando o estoque não é controlado (produto sem dado de estoque).
  function getAvailableStock(p, color, size){
    if (!p) return null;
    if (Array.isArray(p.variants) && p.variants.length){
      const v = p.variants.find(x => x.color === color && x.size === size);
      return v ? (parseInt(v.stock) || 0) : 0;
    }
    if (p.stock === null || p.stock === undefined) return null;
    return parseInt(p.stock) || 0;
  }

  // Quantidade já no carrinho para esse produto + cor + tamanho.
  function qtyInCart(id, color, size){
    return cart.filter(x => x.id === id && (x.color||'') === (color||'') && (x.size||'') === (size||''))
      .reduce((s, x) => s + x.qty, 0);
  }

  function brl(n){
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /* =========================================================
     SIDE DRAWER (account) — open/close helper
  ========================================================= */
  const sideOverlay = document.getElementById('sideOverlay');
  const accountDrawer = document.getElementById('accountDrawer');

  function closeDrawers(){
    accountDrawer.classList.remove('open');
    sideOverlay.classList.remove('open');
  }
  function openDrawer(el){
    closeDrawers();
    el.classList.add('open');
    sideOverlay.classList.add('open');
  }
  sideOverlay.addEventListener('click', closeDrawers);

  /* =========================================================
     CART
  ========================================================= */
  let cart = JSON.parse(localStorage.getItem('muv_cart') || '[]');

  function saveCart(){
    localStorage.setItem('muv_cart', JSON.stringify(cart));
    renderCart();
  }

  function addToCart(id, meta){
    const p = PRODUCTS.find(x => x.id === id);
    if (!p) return;
    const size = meta && meta.size ? meta.size : '';
    const color = meta && meta.color ? meta.color : '';
    const existing = cart.find(x => x.id === id && x.size === size && x.color === color);
    if (existing){ existing.qty++; }
    else { cart.push({ id: p.id, name: p.name, price: p.price, qty: 1, size, color, image: p.images[0] || '' }); }
    saveCart();
    showToast(p.name + ' adicionado ao carrinho');
  }

  /* =========================================================
     PRODUCT PAGE (full page — swaps in place of the store listing)
  ========================================================= */
  const mainContent = document.getElementById('mainContent');
  const productPage = document.getElementById('productPage');
  const cartPage = document.getElementById('cartPage');
  const ppThumbs = document.getElementById('ppThumbs');
  const ppMainImg = document.getElementById('ppMainImg');
  const ppTitle = document.getElementById('ppTitle');
  const ppCrumbName = document.getElementById('ppCrumbName');
  const ppPrice = document.getElementById('ppPrice');
  const ppInstall = document.getElementById('ppInstall');
  const ppColorGroup = document.getElementById('ppColorGroup');
  const ppColors = document.getElementById('ppColors');
  const ppColorValue = document.getElementById('ppColorValue');
  const ppSizeGroup = document.getElementById('ppSizeGroup');
  const ppSizes = document.getElementById('ppSizes');
  const ppSizeValue = document.getElementById('ppSizeValue');
  const ppStockNote = document.getElementById('ppStockNote');
  const ppAddBtn = document.getElementById('ppAddBtn');
  const ppBackLink = document.getElementById('ppBackLink');
  const ppReviewsList = document.getElementById('ppReviewsList');
  const ppReviewForm = document.getElementById('ppReviewForm');
  const ppReviewName = document.getElementById('ppReviewName');
  const ppReviewText = document.getElementById('ppReviewText');
  const ppReviewSubmit = document.getElementById('ppReviewSubmit');
  const ppReviewStatus = document.getElementById('ppReviewStatus');
  let currentPdpId = null;
  let currentPdpColor = '';
  let currentPdpSize = '';

  let pdpOrigin = 'home'; // 'home' | 'category' — remembers where to return after closing the PDP

  function updatePdpStockNote(){
    const p = PRODUCTS.find(x => x.id === currentPdpId);
    ppStockNote.classList.remove('low');
    if (!p){ ppStockNote.textContent = ''; ppAddBtn.disabled = false; ppAddBtn.textContent = 'Adicionar ao carrinho'; return; }

    const colorNeeded = ppColorGroup.style.display !== 'none';
    const sizeNeeded = ppSizeGroup.style.display !== 'none';
    if ((colorNeeded && !currentPdpColor) || (sizeNeeded && !currentPdpSize)){
      ppStockNote.textContent = '';
      ppAddBtn.disabled = false;
      ppAddBtn.textContent = 'Adicionar ao carrinho';
      return;
    }

    const available = getAvailableStock(p, currentPdpColor, currentPdpSize);
    ppAddBtn.textContent = 'Adicionar ao carrinho';
    if (available === null){
      ppStockNote.textContent = '';
      ppAddBtn.disabled = false;
      return;
    }
    const already = qtyInCart(p.id, currentPdpColor, currentPdpSize);
    const remaining = available - already;
    if (available <= 0){
      ppStockNote.textContent = 'Produto esgotado nessa combinação.';
      ppStockNote.classList.add('low');
      ppAddBtn.disabled = true;
      ppAddBtn.textContent = 'Esgotado';
    } else if (remaining <= 0){
      ppStockNote.textContent = 'Você já colocou no carrinho todo o estoque disponível (' + available + ' un.).';
      ppStockNote.classList.add('low');
      ppAddBtn.disabled = true;
    } else if (available <= 5){
      ppStockNote.textContent = 'Apenas ' + available + ' unidade' + (available > 1 ? 's' : '') + ' em estoque.';
      ppStockNote.classList.add('low');
      ppAddBtn.disabled = false;
    } else {
      ppStockNote.textContent = '';
      ppAddBtn.disabled = false;
    }
  }

  function formatReviewDate(iso){
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (err) { return ''; }
  }

  function renderReviews(list){
    if (!ppReviewsList) return;
    if (!list || !list.length){
      ppReviewsList.innerHTML = '<p class="pp-reviews-empty">Seja a primeira a comentar sobre esta peça.</p>';
      return;
    }
    const sanitize = window.MUV_REVIEWS_SANITIZE || (t => t);
    ppReviewsList.innerHTML = list.map(r => `
      <div class="pp-review-item">
        <div class="pp-review-head">
          <span class="pp-review-name">${sanitize(r.customer_name)}</span>
          <span class="pp-review-date">${formatReviewDate(r.created_at)}</span>
        </div>
        <div class="pp-review-text">${sanitize(r.comment)}</div>
      </div>
    `).join('');
  }

  async function loadReviewsForProduct(id){
    if (!ppReviewsList || !window.MUV_REVIEWS_LOAD) return;
    ppReviewsList.innerHTML = '<p class="pp-reviews-empty">Carregando comentários…</p>';
    try {
      const list = await window.MUV_REVIEWS_LOAD(id);
      if (currentPdpId === id) renderReviews(list);
    } catch (err) {
      console.error('[MUV reviews]', err);
      if (currentPdpId === id) {
        ppReviewsList.innerHTML = '<p class="pp-reviews-empty">Não foi possível carregar os comentários agora.</p>';
      }
    }
  }

  if (ppReviewForm){
    ppReviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentPdpId) return;
      const name = ppReviewName.value.trim();
      const comment = ppReviewText.value.trim();
      ppReviewStatus.textContent = '';
      ppReviewStatus.className = 'pp-review-form-status';

      if (!name || !comment){
        ppReviewStatus.textContent = 'Preencha seu nome e o comentário antes de enviar.';
        ppReviewStatus.classList.add('error');
        return;
      }
      if (!window.MUV_REVIEWS_ADD){
        ppReviewStatus.textContent = 'Não foi possível enviar o comentário agora. Tente novamente em instantes.';
        ppReviewStatus.classList.add('error');
        return;
      }

      ppReviewSubmit.disabled = true;
      ppReviewSubmit.textContent = 'Enviando…';
      try {
        const productIdAtSubmit = currentPdpId;
        await window.MUV_REVIEWS_ADD(productIdAtSubmit, name, comment);
        if (currentPdpId === productIdAtSubmit) await loadReviewsForProduct(productIdAtSubmit);
        ppReviewForm.reset();
        ppReviewStatus.textContent = 'Comentário enviado. Obrigada por avaliar!';
        ppReviewStatus.classList.add('success');
      } catch (err) {
        console.error('[MUV reviews]', err);
        ppReviewStatus.textContent = 'Não foi possível enviar seu comentário. Tente novamente.';
        ppReviewStatus.classList.add('error');
      } finally {
        ppReviewSubmit.disabled = false;
        ppReviewSubmit.textContent = 'Enviar comentário';
      }
    });
  }

  /* "Aproveite também": sugere outras peças no fim da página do produto */
  const ppRelated = document.getElementById('ppRelated');
  const ppRelatedGrid = document.getElementById('ppRelatedGrid');
  function relEsc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }
  function renderRelatedProducts(current){
    if (!ppRelated || !ppRelatedGrid) return;
    const pool = dedupeById(PRODUCTS.filter(x => x.id !== current.id && (x.stock === null || x.stock > 0)));
    // prioriza mesma subcategoria, depois mesma seção, depois o resto
    const score = x => (current.subcat && x.subcat === current.subcat ? 2 : 0) + (x.section === current.section ? 1 : 0);
    const list = pool.map((x, i) => ({ x, i })).sort((a, b) => (score(b.x) - score(a.x)) || (a.i - b.i)).slice(0, 4).map(o => o.x);
    if (!list.length){ ppRelated.style.display = 'none'; ppRelatedGrid.innerHTML = ''; return; }

    ppRelatedGrid.innerHTML = list.map(x => {
      const imgs = x.images.length ? x.images : ['<svg viewBox="0 0 60 60"></svg>'];
      const dots = (x.colors || []).slice(0, 6).map(c =>
        `<span class="prod-color-dot" style="background:${relEsc(c.hex || '#ccc')}" title="${relEsc(c.name || '')}"></span>`
      ).join('');
      const more = (x.colors || []).length > 6 ? `<span class="prod-color-more">+${x.colors.length - 6}</span>` : '';
      const sizes = (x.sizes && x.sizes.length) ? x.sizes : (x.section === 'acessorios' ? [] : ['P', 'M', 'G']);
      return `
        <div class="prod-card" data-id="${relEsc(x.id)}">
          <div class="prod-thumb">
            <div class="img-a">${imgs[0]}</div>
            <div class="img-b">${imgs[1] || imgs[0]}</div>
          </div>
          <h4>${relEsc(x.name)}</h4>
          <div class="price">${x.oldPriceText ? `<span class="old">${relEsc(x.oldPriceText)}</span>` : ''}<strong>${brl(x.price)}</strong></div>
          ${dots || more ? `<div class="prod-color-row">${dots}${more}</div>` : ''}
          ${sizes.length ? `<div class="prod-size-row">${sizes.map(s => `<span>${relEsc(s)}</span>`).join('')}</div>` : ''}
        </div>`;
    }).join('');
    ppRelated.style.display = '';
  }
  if (ppRelatedGrid){
    ppRelatedGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.prod-card');
      if (card) openProductDetail(card.dataset.id);
    });
  }

  function openProductDetail(id, opts){
    const p = PRODUCTS.find(x => x.id === id);
    if (!p) return;
    currentPdpId = id;
    pdpOrigin = categoryPage.classList.contains('active') ? 'category' : 'home';

    ppTitle.textContent = p.name;
    ppCrumbName.textContent = p.name;
    ppPrice.innerHTML = (p.oldPriceText ? `<span class="old">${p.oldPriceText}</span>` : '') + brl(p.price);
    ppInstall.textContent = p.install;

    const images = p.images.length ? p.images : ['<svg viewBox="0 0 60 60"></svg>'];
    ppMainImg.innerHTML = images[0];
    ppThumbs.innerHTML = images.map((svg, i) =>
      `<div class="pp-thumb${i === 0 ? ' active' : ''}" data-i="${i}">${svg}</div>`
    ).join('');
    ppThumbs.querySelectorAll('.pp-thumb').forEach(t => {
      t.addEventListener('click', () => {
        ppThumbs.querySelectorAll('.pp-thumb').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        ppMainImg.innerHTML = images[parseInt(t.dataset.i)];
      });
    });

    currentPdpColor = '';
    currentPdpSize = '';

    // color selector — only shown when the product has colors cadastradas no admin
    if (p.colors && p.colors.length){
      ppColorGroup.style.display = '';
      ppColorValue.textContent = 'Selecione';
      ppColors.innerHTML = p.colors.map((c) =>
        `<button type="button" class="pp-color-swatch" data-color="${c.name}"><span class="dot" style="background:${c.hex || '#ccc'}"></span>${c.name}</button>`
      ).join('');
      ppColors.querySelectorAll('.pp-color-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
          ppColors.querySelectorAll('.pp-color-swatch').forEach(x => x.classList.remove('active'));
          btn.classList.add('active');
          currentPdpColor = btn.dataset.color;
          ppColorValue.textContent = currentPdpColor;
          updatePdpStockNote();
        });
      });
    } else {
      ppColorGroup.style.display = 'none';
    }

    // size selector — hidden for accessories with no sizes cadastrados;
    // uses the sizes cadastrados no admin quando existirem, senão o padrão P/M/G.
    const sizeList = (p.sizes && p.sizes.length) ? p.sizes : (p.section === 'acessorios' ? [] : ['P', 'M', 'G']);
    const ppMeasures = document.getElementById('ppMeasures');
    const ppDetails = document.getElementById('ppDetails');
    if (ppDetails) ppDetails.style.display = sizeList.length ? '' : 'none';
    if (ppMeasures) ppMeasures.querySelectorAll('tr[data-size]').forEach(tr => tr.classList.remove('active'));
    if (!sizeList.length){
      ppSizeGroup.style.display = 'none';
    } else {
      ppSizeGroup.style.display = '';
      ppSizeValue.textContent = 'Selecione';
      ppSizes.innerHTML = sizeList.map((s) =>
        `<button type="button" class="pp-swatch" data-size="${s}">${s}</button>`
      ).join('');
      ppSizes.querySelectorAll('.pp-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
          ppSizes.querySelectorAll('.pp-swatch').forEach(x => x.classList.remove('active'));
          btn.classList.add('active');
          currentPdpSize = btn.dataset.size;
          ppSizeValue.textContent = currentPdpSize;
          document.querySelectorAll('#ppMeasures tr[data-size]').forEach(tr => tr.classList.toggle('active', tr.dataset.size === currentPdpSize));
          updatePdpStockNote();
        });
      });
    }

    updatePdpStockNote();

    if (ppReviewForm) ppReviewForm.reset();
    if (ppReviewStatus) { ppReviewStatus.textContent = ''; ppReviewStatus.className = 'pp-review-form-status'; }
    loadReviewsForProduct(id);
    renderRelatedProducts(p);

    mainContent.classList.add('hidden');
    categoryPage.classList.remove('active');
    productPage.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

    if (!opts || !opts.skipHistory){
      try { history.pushState({ pdp: id, from: pdpOrigin, cat: currentCategoryKey }, '', '#produto/' + id); } catch (err) { /* sandboxed preview: no history API */ }
    }
  }

  function closeProductDetail(opts){
    productPage.classList.remove('active');
    if (pdpOrigin === 'category' && currentCategoryKey){
      categoryPage.classList.add('active');
    } else {
      mainContent.classList.remove('hidden');
    }
    currentPdpId = null;
    if (!opts || !opts.skipHistory){
      if (location.hash.startsWith('#produto/')){
        try { history.pushState({}, '', location.pathname + location.search); } catch (err) { /* sandboxed preview: no history API */ }
      }
    }
  }

  document.querySelectorAll('.prod-card').forEach(card => {
    card.addEventListener('click', () => openProductDetail(card.dataset.id));
  });

  ppBackLink.addEventListener('click', () => closeProductDetail());
  ppAddBtn.addEventListener('click', () => {
    if (!currentPdpId) return;
    const p = PRODUCTS.find(x => x.id === currentPdpId);
    if (!p) return;

    const colorRequired = ppColorGroup.style.display !== 'none';
    if (colorRequired && !currentPdpColor){
      showToast('Selecione uma cor antes de continuar');
      ppColors.classList.add('pp-swatches-alert');
      setTimeout(() => ppColors.classList.remove('pp-swatches-alert'), 900);
      return;
    }
    const sizeRequired = ppSizeGroup.style.display !== 'none';
    if (sizeRequired && !currentPdpSize){
      showToast('Selecione um tamanho antes de continuar');
      ppSizes.classList.add('pp-swatches-alert');
      setTimeout(() => ppSizes.classList.remove('pp-swatches-alert'), 900);
      return;
    }

    const available = getAvailableStock(p, currentPdpColor, currentPdpSize);
    if (available !== null){
      const already = qtyInCart(p.id, currentPdpColor, currentPdpSize);
      if (available <= 0 || already >= available){
        showToast('Não há mais estoque disponível para essa combinação');
        updatePdpStockNote();
        return;
      }
    }

    addToCart(currentPdpId, { size: currentPdpSize, color: currentPdpColor });
    updatePdpStockNote();
    ppAddBtn.classList.add('added');
    ppAddBtn.textContent = 'Adicionado ✓';
    setTimeout(() => { ppAddBtn.classList.remove('added'); updatePdpStockNote(); }, 1200);
  });

  /* =========================================================
     CATEGORY PAGE (full page — Best Seller, Legging, Conjunto Short,
     Conjunto Calça, Macaquito, Blusa, Acessório, Todos os produtos)
  ========================================================= */
  const categoryPage = document.getElementById('categoryPage');
  const catCrumbName = document.getElementById('catCrumbName');
  const catTitle = document.getElementById('catTitle');
  const catCount = document.getElementById('catCount');
  const catGrid = document.getElementById('catGrid');
  const catSortSelect = document.getElementById('catSortSelect');
  const catBackLink = document.getElementById('catBackLink');
  const catSizeRow = document.getElementById('catSizeRow');
  const catColorRow = document.getElementById('catColorRow');
  const catPriceRow = document.getElementById('catPriceRow');
  const catInStockOnly = document.getElementById('catInStockOnly');
  const catClearFilters = document.getElementById('catClearFilters');

  const CATEGORY_LABELS = {
    'conjuntos': 'Conjuntos',
    'conjuntos:short': 'Conjunto Short',
    'conjuntos:calca': 'Conjunto Calça',
    'macacoes': 'Macaquito',
    'blusa': 'Blusa',
    'novidades': 'Novidades',
    'todos': 'Todos os produtos'
  };

  let currentCategoryKey = null;
  let activeSizes = new Set();

  // Normaliza o texto do subcat antes de comparar: tira espaços, acentos
  // e diferenças de maiúsculas/minúsculas, para que "Short", " short ",
  // "Calça" ou "calca" sejam tratados como o mesmo valor.
  function normalizeSubcat(s){
    return String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  // Um produto marcado como novidade aparece em duas vitrines (a da sua
  // categoria e a de Novidades), então some duas vezes no índice PRODUCTS.
  // Nas listagens que cruzam seções, mantemos só a primeira ocorrência.
  function dedupeById(list){
    const seen = new Set();
    return list.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  function getCategoryBaseList(key){
    // "Novidades" reúne os produtos que a loja marcou como novidade no painel.
    // Esses cards vivem na vitrine #painelProducts, então basta filtrar por ela.
    if (key === 'novidades') return dedupeById(PRODUCTS.filter(p => p.section === 'painelProducts'));
    if (key === 'todos') return dedupeById(PRODUCTS.filter(p => p.section !== 'bestseller'));
    const [section, subcat] = key.split(':');
    let list = PRODUCTS.filter(p => p.section === section);
    if (subcat) list = list.filter(p => normalizeSubcat(p.subcat) === normalizeSubcat(subcat));
    return list;
  }

  function catCardHTML(p){
  const images = p.images.length
    ? p.images
    : ['<svg viewBox="0 0 60 60"></svg>'];

  const colors = Array.isArray(p.colors) ? p.colors : [];

  const colorDots = colors.length
    ? `
      <div class="prod-color-row">
        ${colors.slice(0, 6).map(c => `
          <span
            class="prod-color-dot"
            style="background:${c.hex || '#ccc'}"
            title="${c.name || ''}">
          </span>
        `).join('')}
        ${colors.length > 6
          ? `<span class="prod-color-more">+${colors.length - 6}</span>`
          : ''}
      </div>
    `
    : '';

  const cardSizes = (p.sizes && p.sizes.length) ? p.sizes : (p.section === 'acessorios' ? [] : ['P', 'M', 'G']);
  const sizesRowHtml = cardSizes.length
    ? `<div class="prod-size-row">${cardSizes.map(s => `<span>${s}</span>`).join('')}</div>`
    : '';

  return `
    <div
      class="prod-card"
      data-id="${p.id}"
      data-name="${p.name || ''}"
      data-colors='${JSON.stringify(colors)}'
      data-sizes='${JSON.stringify(p.sizes || [])}'
      data-variants='${JSON.stringify(p.variants || [])}'
    >
      <div class="prod-thumb">
        ${p.tag ? `<span class="tag">${p.tag}</span>` : ''}
        <div class="img-a">${images[0]}</div>
        <div class="img-b">${images[1] || images[0]}</div>
      </div>

      <h4>${p.name}</h4>

      <div class="price">
        ${p.oldPriceText ? `<span class="old">${p.oldPriceText}</span>` : ''}
        <strong>${brl(p.price)}</strong>
      </div>

      ${colorDots}

      ${sizesRowHtml}

      <span class="install">${p.install}</span>
    </div>
  `;
}

  function applyCategoryFiltersAndSort(){
    if (!currentCategoryKey) return;
    let list = getCategoryBaseList(currentCategoryKey).slice();

    // price range filters (checked ranges are OR'd together)
    const checkedRanges = Array.from(catPriceRow.querySelectorAll('input[data-range]:checked')).map(i => i.dataset.range);
    if (checkedRanges.length){
      list = list.filter(p => checkedRanges.some(r => {
        const [min, max] = r.split('-').map(Number);
        return p.price >= min && p.price <= max;
      }));
    }

    // color filter (checked colors are OR'd together)
    const activeColors = Array.from(catColorRow.querySelectorAll('.cat-color-dot.active'))
      .map(d => normalizeSubcat(d.dataset.color));
    if (activeColors.length){
      list = list.filter(p => Array.isArray(p.colors) && p.colors.some(c => activeColors.includes(normalizeSubcat(c.name))));
    }

    // size filter — informational only for accessories (no per-size stock data yet, so it never excludes items)
    // kept here so the UI is ready to wire up once real per-SKU stock is available

    // sort
    const sortBy = catSortSelect.value;
    if (sortBy === 'menor-preco') list.sort((a, b) => a.price - b.price);
    else if (sortBy === 'maior-preco') list.sort((a, b) => b.price - a.price);
    else if (sortBy === 'nome') list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    catCount.textContent = list.length + (list.length === 1 ? ' produto' : ' produtos');
    catGrid.innerHTML = list.length
      ? list.map(catCardHTML).join('')
      : '<div class="cat-empty">Nenhum produto encontrado com esses filtros.</div>';
  }

  function resetCategoryFilters(){
    catPriceRow.querySelectorAll('input[data-range]').forEach(i => i.checked = false);
    catSizeRow.querySelectorAll('.cat-size-chip').forEach(c => c.classList.remove('active'));
    catColorRow.querySelectorAll('.cat-color-dot').forEach(c => c.classList.remove('active'));
    catInStockOnly.checked = false;
    catSortSelect.value = 'recente';
    activeSizes.clear();
  }

  // Monta as bolinhas de cor do filtro com base nas cores que realmente
  // existem nos produtos desta categoria (em vez de uma lista fixa) —
  // assim cada categoria só mostra as cores que ela de fato tem.
  function renderCatColorFilter(list){
    const seen = new Map(); // nome normalizado -> {name, hex}
    list.forEach(p => {
      (Array.isArray(p.colors) ? p.colors : []).forEach(c => {
        if (!c || !c.name) return;
        const key = normalizeSubcat(c.name);
        if (!seen.has(key)) seen.set(key, { name: c.name, hex: c.hex || '#ccc' });
      });
    });
    const colors = Array.from(seen.values());
    const filterBlock = catColorRow.closest('.cat-filter');

    if (!colors.length){
      catColorRow.innerHTML = '';
      if (filterBlock) filterBlock.style.display = 'none';
      return;
    }

    if (filterBlock) filterBlock.style.display = '';
    catColorRow.innerHTML = colors.map(c =>
      `<span class="cat-color-dot" style="background:${c.hex}" data-color="${c.name.replace(/"/g, '&quot;')}" title="${c.name.replace(/"/g, '&quot;')}"></span>`
    ).join('');

    catColorRow.querySelectorAll('.cat-color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        dot.classList.toggle('active');
        applyCategoryFiltersAndSort();
      });
    });
  }

  function openCategoryPage(key, opts){
    if (!CATEGORY_LABELS[key]) return;
    currentCategoryKey = key;
    catTitle.textContent = CATEGORY_LABELS[key];
    catCrumbName.textContent = CATEGORY_LABELS[key];
    renderCatColorFilter(getCategoryBaseList(key));
    resetCategoryFilters();
    applyCategoryFiltersAndSort();

    if (productPage.classList.contains('active')) closeProductDetail({ skipHistory: true });
    if (cartPage.classList.contains('active')) closeCartPage({ skipHistory: true });
    mainContent.classList.add('hidden');
    categoryPage.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

    if (!opts || !opts.skipHistory){
      try { history.pushState({ cat: key }, '', '#colecao/' + key); } catch (err) { /* sandboxed preview: no history API */ }
    }
  }

  function closeCategoryPage(opts){
    categoryPage.classList.remove('active');
    mainContent.classList.remove('hidden');
    currentCategoryKey = null;
    if (!opts || !opts.skipHistory){
      if (location.hash.startsWith('#colecao/')){
        try { history.pushState({}, '', location.pathname + location.search); } catch (err) { /* sandboxed preview: no history API */ }
      }
    }
  }

  catGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.prod-card');
    if (card) openProductDetail(card.dataset.id);
  });

  catBackLink.addEventListener('click', () => closeCategoryPage());
  catSortSelect.addEventListener('change', applyCategoryFiltersAndSort);
  catPriceRow.addEventListener('change', applyCategoryFiltersAndSort);
  catInStockOnly.addEventListener('change', applyCategoryFiltersAndSort);

  catSizeRow.querySelectorAll('.cat-size-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('active'));
  });
  catClearFilters.addEventListener('click', () => {
    resetCategoryFilters();
    applyCategoryFiltersAndSort();
  });

  document.querySelectorAll('.cat-filter-head').forEach(head => {
    head.addEventListener('click', () => head.closest('.cat-filter').classList.toggle('open'));
  });
  // open the first filter group by default
  document.querySelector('.cat-filter')?.classList.add('open');

  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.pdp){
      openProductDetail(e.state.pdp, { skipHistory: true });
    } else if (e.state && e.state.cat){
      closeProductDetail({ skipHistory: true });
      openCategoryPage(e.state.cat, { skipHistory: true });
    } else if (e.state && e.state.checkout){
      closeProductDetail({ skipHistory: true });
      mainContent.classList.add('hidden');
      cartPage.classList.remove('active');
      checkoutPage.classList.add('active');
    } else if (e.state && e.state.cart){
      closeProductDetail({ skipHistory: true });
      checkoutPage.classList.remove('active');
      mainContent.classList.add('hidden');
      cartPage.classList.add('active');
    } else {
      closeProductDetail({ skipHistory: true });
      closeCategoryPage({ skipHistory: true });
      closeCartPage({ skipHistory: true });
      checkoutPage.classList.remove('active');
    }
  });

  // open directly on a product if the page is loaded with #produto/<id> in the URL
  if (location.hash.startsWith('#produto/')){
    const initialId = location.hash.split('/')[1];
    if (PRODUCTS.some(p => p.id === initialId)) openProductDetail(initialId, { skipHistory: true });
  }
  // open directly on a category if the page is loaded with #colecao/<key> in the URL
  if (location.hash.startsWith('#colecao/')){
    const initialKey = location.hash.split('/')[1];
    if (CATEGORY_LABELS[initialKey]) openCategoryPage(initialKey, { skipHistory: true });
  }

  // Pills da seção "Conjuntos" na home (Conjunto Short / Conjunto Calça / Macaquito): filtram os cards da própria vitrine em vez de abrir a página de
  // categoria — por isso usam data-subcat-filter, não data-cat.
  (function setupConjuntosPillsFilter(){
    const bar = document.getElementById('conjuntosPills');
    if (!bar) return;
    const pills = Array.from(bar.querySelectorAll('[data-subcat-filter]'));
    const grid = document.getElementById('conjuntosGrid');
    if (!grid || !pills.length) return;

    // Macaquito usa a mesma vitrine: copia os cards da seção (escondida) de
    // Macaquitos para esta grade, marcados com subcat "macaquito". Os originais
    // continuam no HTML, então busca, carrinho e página de categoria seguem iguais.
    const macGrid = document.getElementById('macacaoGrid');
    if (macGrid){
      macGrid.querySelectorAll('.prod-card').forEach(card => {
        const clone = card.cloneNode(true);
        clone.dataset.subcat = 'macaquito';
        clone.querySelector('.prod-thumb')?.classList.remove('img-loading');
        clone.addEventListener('click', () => openProductDetail(clone.dataset.id));
        grid.appendChild(clone);
      });
    }
    const sectionTitle = document.querySelector('#conjuntos .section-head h2');
    const seeAllLink = document.querySelector('#conjuntos .see-all-wrap a');

    function applyFilter(subcat){
      const norm = normalizeSubcat(subcat);
      grid.querySelectorAll('.prod-card').forEach(card => {
        const show = !norm || normalizeSubcat(card.dataset.subcat) === norm;
        card.style.display = show ? '' : 'none';
      });
      // título e botão "Ver mais" acompanham a aba escolhida
      if (sectionTitle) sectionTitle.textContent = norm === 'macaquito' ? 'Macaquitos' : 'Conjuntos';
      if (seeAllLink) seeAllLink.dataset.cat = !norm ? 'conjuntos' : (norm === 'macaquito' ? 'macacoes' : 'conjuntos:' + norm);
      grid.scrollTo({ left: 0 });
      updateCarouselButtons(grid);
    }

    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        applyFilter(pill.dataset.subcatFilter);
      });
    });

    // aplica o filtro inicial (pill que já vier marcada como "active" no HTML)
    const initialPill = pills.find(p => p.classList.contains('active')) || pills[0];
    applyFilter(initialPill.dataset.subcatFilter);
  })();

  // any element with data-cat (nav, drawer, showcase, "Ver mais", Blusa) opens the matching category page
  document.querySelectorAll('[data-cat]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openCategoryPage(a.dataset.cat);
    });
  });

  // any other in-page nav link (header, drawer, logo) closes the product/cart/category page first so the anchor scroll works
  document.querySelectorAll('a[href^="#"]:not([data-cat])').forEach(a => {
    a.addEventListener('click', () => {
      if (productPage.classList.contains('active')) closeProductDetail();
      if (cartPage.classList.contains('active')) closeCartPage();
      if (categoryPage.classList.contains('active')) closeCategoryPage();
      if (checkoutPage.classList.contains('active')) checkoutPage.classList.remove('active');
      mainContent.classList.remove('hidden');
    });
  });

  function changeQty(idx, delta){
    const item = cart[idx];
    if (!item) return;
    if (delta > 0){
      const p = PRODUCTS.find(x => x.id === item.id);
      const available = getAvailableStock(p, item.color, item.size);
      if (available !== null && item.qty >= available){
        showToast('Estoque disponível: ' + available + ' un.');
        return;
      }
    }
    item.qty += delta;
    if (item.qty <= 0) cart.splice(idx, 1);
    saveCart();
  }

  function removeFromCart(idx){
    cart.splice(idx, 1);
    saveCart();
  }

  function renderCart(){
    const countEl = document.getElementById('cartCount');
    const totalItems = cart.reduce((s, i) => s + i.qty, 0);
    countEl.textContent = totalItems;

    const body = document.getElementById('cartPageBody');
    if (!body) return;

    if (cart.length === 0){
      body.innerHTML = `<div class="cart-page-empty">
        <p>Seu carrinho está vazio</p>
        <button type="button" class="cart-empty-btn" id="cartEmptyBtn">Comece a comprar</button>
      </div>`;
      body.querySelector('#cartEmptyBtn').addEventListener('click', closeCartPage);
      const titleEl = document.querySelector('.cart-page h1');
      if (titleEl) titleEl.classList.add('compact');
      return;
    }

    document.querySelector('.cart-page h1')?.classList.remove('compact');

    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const waMsg = 'Olá! Quero finalizar meu pedido na MUV FITNESS:%0A' +
      cart.map(i => {
        const variant = [i.color, i.size].filter(Boolean).join(', ');
        return `- ${i.qty}x ${i.name}${variant ? ' (' + variant + ')' : ''} (${brl(i.price)})`;
      }).join('%0A') +
      `%0A%0ATotal: ${brl(subtotal)}`;

    body.innerHTML = `
      <div class="cart-layout">
        <div class="cart-box">
          <div class="cart-table-head"><span>Produto</span><span class="th-qty">Quantidade</span><span class="th-total">Total</span></div>
          ${cart.map((item, idx) => `
            <div class="cart-row">
              <div class="cart-row-product">
                <div class="cart-row-thumb" data-goto-product="${item.id}">${item.image || ''}</div>
                <div class="cart-row-info">
                  <h5 data-goto-product="${item.id}">${item.name}</h5>
                  ${(item.color || item.size) ? `<div class="variant">${[item.color, item.size].filter(Boolean).join(' · ')}</div>` : ''}
                  <div class="unit-price">${brl(item.price)}</div>
                </div>
              </div>
              <div class="cart-row-qty-col">
                <div class="cart-qty-box">
                  <button data-qty-down="${idx}" aria-label="Diminuir">−</button>
                  <span>${item.qty}</span>
                  <button data-qty-up="${idx}" aria-label="Aumentar">+</button>
                </div>
                <button class="cart-remove-link" data-remove="${idx}">Remover</button>
              </div>
              <div class="cart-row-total">${brl(item.price * item.qty)}</div>
            </div>
          `).join('')}
        </div>
        <div class="cart-summary">
          <div class="cart-summary-row"><span>Subtotal</span><strong>${brl(subtotal)}</strong></div>
          <div class="cart-summary-row total"><span>Total</span><strong>${brl(subtotal)}</strong></div>
          <button type="button" class="cart-checkout-btn" id="checkoutBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
            Finalizar compra
          </button>
          <button type="button" class="cart-continue-btn" id="cartContinueBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
            Continuar comprando
          </button>
          <div class="trust-badges">
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Compra segura</span>
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 6L9 17l-5-5"/></svg>Dados criptografados</span>
          </div>
        </div>
      </div>
    `;

    body.querySelector('#cartContinueBtn').addEventListener('click', closeCartPage);
  }

  document.getElementById('cartPageBody').addEventListener('click', (e) => {
    const up = e.target.closest('[data-qty-up]');
    const down = e.target.closest('[data-qty-down]');
    const rem = e.target.closest('[data-remove]');
    const checkout = e.target.closest('#checkoutBtn');
    const goto = e.target.closest('[data-goto-product]');
    if (up) { changeQty(parseInt(up.dataset.qtyUp), 1); return; }
    if (down) { changeQty(parseInt(down.dataset.qtyDown), -1); return; }
    if (rem) { removeFromCart(parseInt(rem.dataset.remove)); return; }
    if (checkout) { openCheckoutPage(); return; }
    if (goto) { closeCartPage(); openProductDetail(goto.dataset.gotoProduct); return; }
  });

  /* =========================================================
     CART PAGE (full page — swaps in place of the store listing)
  ========================================================= */
  function openCartPage(opts){
    if (productPage.classList.contains('active')) closeProductDetail({ skipHistory: true });
    if (categoryPage.classList.contains('active')) closeCategoryPage({ skipHistory: true });
    mainContent.classList.add('hidden');
    cartPage.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    if (!opts || !opts.skipHistory){
      try { history.pushState({ cart: true }, '', '#carrinho'); } catch (err) { /* sandboxed preview: no history API */ }
    }
  }

  function closeCartPage(opts){
    cartPage.classList.remove('active');
    mainContent.classList.remove('hidden');
    if (!opts || !opts.skipHistory){
      if (location.hash === '#carrinho'){
        try { history.pushState({}, '', location.pathname + location.search); } catch (err) { /* sandboxed preview: no history API */ }
      }
    }
  }

  document.getElementById('cartOpen').addEventListener('click', () => openCartPage());

  renderCart();

  // open directly on the cart if the page is loaded with #carrinho in the URL
  if (location.hash === '#carrinho'){
    openCartPage({ skipHistory: true });
  }

  /* =========================================================
     CHECKOUT PAGE
     -----------------------------------------------------------
     Hoje esta tela é 100% front-end: ela coleta os dados de
     contato, entrega e pagamento e mostra a tela de sucesso.
     Quando a integração com o gateway (ex: Mercado Pago) for
     feita, é só substituir o conteúdo da função processOrder()
     abaixo por uma chamada real ao backend (criar preferência /
     pagamento, redirecionar ou confirmar o retorno do gateway).
  ========================================================= */
  const checkoutPage = document.getElementById('checkoutPage');
  const coForm = document.getElementById('coForm');
  const coSuccess = document.getElementById('coSuccess');
  const FREE_SHIPPING_THRESHOLD = 300;
  const SHIPPING_COST = 19.90;

  // ----- cupons de desconto -----
  // percent: desconto em % sobre o subtotal dos produtos (não incide sobre o frete)
  const COUPONS = {
    'BEMVINDA10': { type: 'percent', value: 10 }
  };
  let appliedCoupon = null; // { code, type, value } | null

  function cartSubtotal(){
    return cart.reduce((s, i) => s + i.price * i.qty, 0);
  }

  function currentDiscount(){
    if (!appliedCoupon) return 0;
    const subtotal = cartSubtotal();
    if (appliedCoupon.type === 'percent'){
      return Number((subtotal * appliedCoupon.value / 100).toFixed(2));
    }
    if (appliedCoupon.type === 'fixed'){
      return Math.min(appliedCoupon.value, subtotal);
    }
    return 0;
  }

  function showDiscountMsg(text, ok){
    [document.getElementById('coDiscountMsg'), document.getElementById('coMobileDiscountMsg')].forEach(msg => {
      if (!msg) return;
      msg.textContent = text;
      msg.style.color = ok ? '#1a7d3a' : '#c0392b';
      msg.style.display = 'block';
    });
  }

  function applyDiscountCode(sourceInput){
    const input = sourceInput || document.getElementById('coDiscountCode');
    const code = (input.value || '').trim().toUpperCase();
    const desktopInput = document.getElementById('coDiscountCode');
    const mobileInput = document.getElementById('coMobileDiscountCode');
    if (!code){
      showDiscountMsg('Digite um código de cupom.', false);
      return;
    }
    const coupon = COUPONS[code];
    if (!coupon){
      appliedCoupon = null;
      showDiscountMsg('Cupom inválido ou expirado.', false);
      renderCheckoutSummary();
      return;
    }
    appliedCoupon = { code, ...coupon };
    if (desktopInput) desktopInput.value = code;
    if (mobileInput) mobileInput.value = code;
    showDiscountMsg(`Cupom ${code} aplicado! ${coupon.type === 'percent' ? coupon.value + '% de desconto.' : 'Desconto aplicado.'}`, true);
    renderCheckoutSummary();
  }
  

  // ----- real shipping options (Sedex / PAC / Frete Grátis) -----
  let shippingOptions = [];       // options calculated for the current CEP + subtotal
  let selectedShippingId = null;  // id of the option the customer picked

  function calcShippingOptions(subtotal){
    const freeEligible = subtotal >= FREE_SHIPPING_THRESHOLD;
    const opts = [
      { id: 'pac',   label: 'PAC · Envio econômico',  days: '8 a 12 dias úteis', price: freeEligible ? 0 : SHIPPING_COST },
      { id: 'sedex', label: 'Sedex · Envio expresso',  days: '2 a 4 dias úteis',  price: freeEligible ? 14.90 : 34.90 }
    ];
    if (freeEligible){
      opts.unshift({ id: 'free', label: 'Frete Grátis', days: '8 a 12 dias úteis', price: 0 });
    }
    return opts;
  }

  function getSelectedShippingOption(){
    return shippingOptions.find(o => o.id === selectedShippingId) || null;
  }

  function currentFreight(){
    if (coDeliveryMethod === 'pickup') return 0;
    if (cart.length === 0) return 0;
    const selected = getSelectedShippingOption();
    if (selected) return selected.price;
    // CEP ainda não informado: frete não pode ser cobrado antes de ser calculado
    return 0;
  }

  function renderShippingOptions(){
    const shippingBox = document.getElementById('coShippingBox');
    if (!shippingOptions.length){
      shippingBox.textContent = 'Insira o CEP para ver as formas de frete disponíveis.';
      return;
    }
    if (!selectedShippingId) selectedShippingId = shippingOptions[0].id;
    shippingBox.innerHTML = shippingOptions.map(opt => `
      <label class="co-shipping-option">
        <span class="opt-label">
          <input type="radio" name="coShip" value="${opt.id}" ${opt.id === selectedShippingId ? 'checked' : ''}>
          ${opt.label} · ${opt.days}
        </span>
        <strong>${opt.price === 0 ? 'Grátis' : brl(opt.price)}</strong>
      </label>
    `).join('');
    shippingBox.querySelectorAll('input[name="coShip"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        selectedShippingId = e.target.value;
        renderCheckoutSummary();
      });
    });
  }

  function renderCheckoutSummary(){
    const subtotal = cartSubtotal();
    // se o CEP já foi informado, recalcula as opções de frete (ex: mudança de quantidade pode liberar frete grátis)
    if (shippingOptions.length){
      const prevSelected = selectedShippingId;
      shippingOptions = calcShippingOptions(subtotal);
      selectedShippingId = shippingOptions.some(o => o.id === prevSelected) ? prevSelected : shippingOptions[0].id;
      renderShippingOptions();
    }
    const freight = currentFreight();
    const discount = currentDiscount();
    const total = Math.max(0, subtotal + freight - discount);

    const itemsHtml = cart.map(item => `
      <div class="co-sum-item">
        <div class="co-sum-thumb">
          ${item.image || ''}
          <span class="co-sum-qty">${item.qty}</span>
        </div>
        <div class="co-sum-info">
          <h6>${item.name}</h6>
          ${(item.color || item.size) ? `<span>${[item.color, item.size].filter(Boolean).join(' · ')}</span>` : ''}
        </div>
        <div class="co-sum-price">${brl(item.price * item.qty)}</div>
      </div>
    `).join('');

    document.getElementById('coSumItems').innerHTML = itemsHtml;
    document.getElementById('coMobileItems').innerHTML = itemsHtml;
    document.getElementById('coSubtotal').textContent = brl(subtotal);
    document.getElementById('coMobileSubtotal').textContent = brl(subtotal);

    const discountRow = document.getElementById('coDiscountRow');
    const discountRowMobile = document.getElementById('coMobileDiscountRow');
    if (discount > 0){
      document.getElementById('coDiscountValue').textContent = '-' + brl(discount);
      document.getElementById('coMobileDiscountValue').textContent = '-' + brl(discount);
      discountRow.style.display = 'flex';
      discountRowMobile.style.display = 'flex';
    } else {
      discountRow.style.display = 'none';
      discountRowMobile.style.display = 'none';
    }

    const freightEl = document.getElementById('coFreight');
    const freightElMobile = document.getElementById('coMobileFreight');
    const freightAddressKnown = coDeliveryMethod === 'pickup' || getSelectedShippingOption() !== null;
    let freightText;
    if (coDeliveryMethod === 'pickup'){
      freightText = 'Retirada — grátis';
    } else if (!freightAddressKnown){
      freightText = 'Insira o CEP';
    } else {
      freightText = freight === 0 ? 'Grátis' : brl(freight);
    }
    freightEl.textContent = freightText;
    freightElMobile.textContent = freightText;

    document.getElementById('coTotal').textContent = brl(total);
    document.getElementById('coMobileTotalRow').textContent = brl(total);
    document.getElementById('coMobileTotal').textContent = brl(total);

    renderInstallments(total);
    renderPaymentBrick();
  }

  function renderInstallments(total){
    const sel = document.getElementById('coInstallments');
    if (!sel) return;
    const opts = [];
    opts.push(`<option value="1">À vista (${brl(total)})</option>`);
    for (let n = 2; n <= 3; n++){
      opts.push(`<option value="${n}">${n}x de ${brl(total / n)} sem juros</option>`);
    }
    sel.innerHTML = opts.join('');
  }

  // ----- delivery method toggle (Enviar / Retirada) -----
  let coDeliveryMethod = 'ship';
  document.querySelectorAll('#coDeliveryToggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#coDeliveryToggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      coDeliveryMethod = btn.dataset.delivery;
      const addressFields = document.getElementById('coAddressFields');
      const pickupNote = document.getElementById('coPickupNote');
      const isShip = coDeliveryMethod === 'ship';
      addressFields.classList.toggle('active', isShip);
      pickupNote.classList.toggle('active', !isShip);
      [...addressFields.querySelectorAll('input,select')].forEach(el => {
        if (el.id === 'coComplement' || el.id === 'coCountry') return;
        el.required = isShip;
      });
      // Retirada: pede nome e telefone de quem vai retirar (na entrega, esses dados já vêm do endereço)
      const pickupContact = document.getElementById('coPickupContact');
      if (pickupContact){
        pickupContact.classList.toggle('active', !isShip);
        pickupContact.querySelectorAll('input').forEach(el => { el.required = !isShip; });
      }
      renderCheckoutSummary();
    });
  });

  // ----- CEP lookup (ViaCEP) -----
  function cepDigits(){
    return document.getElementById('coCep').value.replace(/\D/g, '');
  }
  document.getElementById('coCep').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 8);
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
    e.target.value = v;
  });
  async function lookupCep(){
    const cep = cepDigits();
    const shippingBox = document.getElementById('coShippingBox');
    if (cep.length !== 8){
      shippingOptions = [];
      selectedShippingId = null;
      shippingBox.textContent = 'Insira o CEP para ver as formas de frete disponíveis.';
      return;
    }
    shippingBox.textContent = 'Buscando endereço…';
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        shippingOptions = [];
        selectedShippingId = null;
        shippingBox.textContent = 'CEP não encontrado. Confira e tente novamente.';
        return;
      }
      document.getElementById('coAddress').value = data.logradouro || '';
      document.getElementById('coNeighborhood').value = data.bairro || '';
      document.getElementById('coCity').value = data.localidade || '';
      document.getElementById('coState').value = data.uf || '';
      document.getElementById('coNumber').focus();

      shippingOptions = calcShippingOptions(cartSubtotal());
      selectedShippingId = shippingOptions[0].id;
      renderShippingOptions();
      renderCheckoutSummary();
    } catch (err){
      shippingOptions = [];
      selectedShippingId = null;
      shippingBox.textContent = 'Não foi possível buscar o CEP agora. Você pode preencher o endereço manualmente.';
    }
  }
  document.getElementById('coCep').addEventListener('blur', lookupCep);
  document.getElementById('coCepSearch').addEventListener('click', lookupCep);

  document.getElementById('coPhone').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
    e.target.value = v;
  });

  // ----- open / close -----
  function openCheckoutPage(){
    if (cart.length === 0) return;
    if (cartPage.classList.contains('active')) cartPage.classList.remove('active');
    mainContent.classList.add('hidden');
    checkoutPage.classList.add('active');
    coSuccess.classList.remove('active');
    coForm.style.display = '';
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    renderCheckoutSummary();
    try { history.pushState({ checkout: true }, '', '#checkout'); } catch (err) { /* sandboxed preview: no history API */ }
  }

  function closeCheckoutPage(){
    checkoutPage.classList.remove('active');
    openCartPage({ skipHistory: true });
    try { history.pushState({ cart: true }, '', '#carrinho'); } catch (err) { /* sandboxed preview: no history API */ }
  }

  document.getElementById('coBackToCart').addEventListener('click', closeCheckoutPage);
  document.getElementById('coLoginLink').addEventListener('click', () => openDrawer(accountDrawer));

  // ----- step breadcrumb (Carrinho > Informações > Envio > Pagamento) -----
  (function setupCoSteps(){
    const stepBtns = {
      cart: document.getElementById('coStepCart'),
      info: document.getElementById('coStepInfo'),
      ship: document.getElementById('coStepShip'),
      pay:  document.getElementById('coStepPay')
    };
    const sectionEls = {
      info: document.getElementById('coSecInfo'),
      ship: document.getElementById('coSecShip'),
      pay:  document.getElementById('coSecPay')
    };

    function setActiveStep(step){
      Object.entries(stepBtns).forEach(([key, btn]) => {
        if (!btn) return;
        btn.classList.toggle('active', key === step);
      });
    }

    stepBtns.cart.addEventListener('click', closeCheckoutPage);
    ['info', 'ship', 'pay'].forEach(step => {
      stepBtns[step].addEventListener('click', () => {
        const el = sectionEls[step];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveStep(step);
      });
    });

    // scroll-spy: highlight the step whose section is currently in view
    if ('IntersectionObserver' in window){
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting){
            const step = Object.keys(sectionEls).find(k => sectionEls[k] === entry.target);
            if (step) setActiveStep(step);
          }
        });
      }, { root: null, rootMargin: '-30% 0px -55% 0px', threshold: 0 });
      Object.values(sectionEls).forEach(el => { if (el) observer.observe(el); });
    }
  })();
  document.getElementById('coBackHome').addEventListener('click', (e) => {
    e.preventDefault();
    checkoutPage.classList.remove('active');
    mainContent.classList.remove('hidden');
    try { history.pushState({}, '', location.pathname + location.search); } catch (err) { /* no-op in sandboxed preview */ }
  });

  // ----- validação dos campos de contato/entrega -----
  function validateCheckoutForm(){
    let firstInvalid = null;
    const requiredEls = coForm.querySelectorAll('[required]');
    requiredEls.forEach(el => {
      const visible = el.offsetParent !== null;
      if (visible && !el.value.trim()){
        el.style.borderColor = '#b3452f';
        if (!firstInvalid) firstInvalid = el;
      } else {
        el.style.borderColor = '';
      }
    });
    return firstInvalid;
  }

  // impede que a tecla Enter em qualquer campo tente enviar o <form> — quem
  // dispara o pagamento agora é o botão nativo dentro do Payment Brick.
  coForm.addEventListener('submit', (e) => e.preventDefault());

  const coApplyDiscountBtn = document.getElementById('coApplyDiscount');
  const coDiscountCodeInput = document.getElementById('coDiscountCode');
  if (coApplyDiscountBtn && coDiscountCodeInput){
    coApplyDiscountBtn.addEventListener('click', () => applyDiscountCode(coDiscountCodeInput));
    coDiscountCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter'){
        e.preventDefault();
        applyDiscountCode(coDiscountCodeInput);
      }
    });
  }

  const coMobileApplyDiscountBtn = document.getElementById('coMobileApplyDiscount');
  const coMobileDiscountCodeInput = document.getElementById('coMobileDiscountCode');
  if (coMobileApplyDiscountBtn && coMobileDiscountCodeInput){
    coMobileApplyDiscountBtn.addEventListener('click', () => applyDiscountCode(coMobileDiscountCodeInput));
    coMobileDiscountCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter'){
        e.preventDefault();
        applyDiscountCode(coMobileDiscountCodeInput);
      }
    });
  }

  /* =========================================================
     PAYMENT BRICK (Mercado Pago Checkout Bricks)
     -----------------------------------------------------
     Mostra os campos de cartão/Pix DENTRO da própria página (sem
     redirecionar pro Mercado Pago). O Brick tokeniza os dados do cartão
     no navegador da cliente; a gente só recebe esse token (nunca o
     número do cartão) e manda pro backend em /api/process-payment, que
     usa o Access Token secreto pra criar o pagamento de verdade.
  ========================================================= */
  let mpInstance = null;
  let paymentBrickController = null;
  let brickMountedAmount = null;

  async function getMercadoPagoInstance(){
    if (mpInstance) return mpInstance;
    if (typeof MercadoPago === 'undefined'){
      console.error('[MUV pagamento] SDK do Mercado Pago não carregou.');
      return null;
    }
    try {
      const r = await fetch('/api/mp-public-key');
      const data = await r.json();
      if (!data.publicKey) throw new Error(data.error || 'Chave pública ausente.');
      mpInstance = new MercadoPago(data.publicKey, { locale: 'pt-BR' });
      return mpInstance;
    } catch (err){
      console.error('[MUV pagamento] erro ao obter a chave pública:', err);
      return null;
    }
  }

  function getCheckoutAmount(){
    return Number(Math.max(0, cartSubtotal() + currentFreight() - currentDiscount()).toFixed(2));
  }

  function buildOrderPayload(selectedPaymentMethod){
    const isShipOrder = coDeliveryMethod === 'ship';
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    return {
      email: document.getElementById('coEmail').value,
      delivery: coDeliveryMethod,
      // quem paga/retira (usado também pelo Mercado Pago pra analisar o pagamento)
      contact: isShipOrder
        ? { firstName: val('coFirstName'), lastName: val('coLastName'), phone: val('coPhone') }
        : { firstName: val('coPickFirstName'), lastName: val('coPickLastName'), phone: val('coPickPhone') },
      address: coDeliveryMethod === 'ship' ? {
        firstName: document.getElementById('coFirstName').value,
        lastName: document.getElementById('coLastName').value,
        cep: document.getElementById('coCep').value,
        street: document.getElementById('coAddress').value,
        number: document.getElementById('coNumber').value,
        complement: document.getElementById('coComplement').value,
        neighborhood: document.getElementById('coNeighborhood').value,
        city: document.getElementById('coCity').value,
        state: document.getElementById('coState').value,
        phone: document.getElementById('coPhone').value
      } : null,
      paymentMethod: selectedPaymentMethod, // 'credit_card', 'debit_card', 'bank_transfer' (pix) etc.
      items: cart,
      subtotal: cartSubtotal(),
      freight: currentFreight(),
      discount: currentDiscount(),
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      total: getCheckoutAmount(),
      description: `Pedido MUV FITNESS — ${cart.length} item(ns)`
    };
  }

  // Motivos de recusa do Mercado Pago (status_detail) -> mensagem clara pra cliente.
  const REJECTION_MESSAGES = {
    cc_rejected_insufficient_amount: 'Cartão sem limite ou saldo suficiente. Tente outro cartão ou pague com Pix.',
    cc_rejected_bad_filled_card_number: 'Confira o número do cartão e tente de novo.',
    cc_rejected_bad_filled_date: 'Confira a data de validade do cartão e tente de novo.',
    cc_rejected_bad_filled_security_code: 'Confira o código de segurança (CVV) do cartão e tente de novo.',
    cc_rejected_bad_filled_other: 'Confira os dados do cartão e tente de novo.',
    cc_rejected_call_for_authorize: 'Seu banco precisa autorizar esta compra. Fale com o banco ou tente outro cartão.',
    cc_rejected_card_disabled: 'Este cartão está inativo. Ative-o com o banco ou use outro cartão.',
    cc_rejected_duplicated_payment: 'Já existe um pagamento igual a este. Confira seu e-mail ou "Meus pedidos".',
    cc_rejected_high_risk: 'Por segurança, este pagamento não foi aprovado. Tente outro cartão ou pague com Pix.',
    cc_rejected_blacklist: 'Por segurança, este pagamento não foi aprovado. Tente outro cartão ou pague com Pix.',
    cc_rejected_max_attempts: 'Limite de tentativas atingido. Use outro cartão ou pague com Pix.',
    cc_rejected_other_reason: 'O banco do cartão não aprovou o pagamento. Tente outro cartão ou pague com Pix.'
  };

  function handlePaymentResult(data, order){
    if (data.status === 'approved'){
      cart = [];
      saveCart();
      checkoutPage.querySelector('.container').scrollIntoView({ behavior: 'instant' in window ? 'instant' : 'auto', block: 'start' });
      coForm.style.display = 'none';
      document.getElementById('coSuccessMsg').textContent = 'Seu pagamento foi aprovado! Você recebe a confirmação por e-mail e pode acompanhar tudo em "Meus pedidos".';
      coSuccess.classList.add('active');
    } else if (data.status === 'pending' || data.status === 'in_process'){
      // Pix: o próprio Brick mostra o QR Code / código "copia e cola" aqui embaixo dos campos.
      // Não limpamos o carrinho ainda — só quando o webhook confirmar o pagamento.
      const errorMsg = document.getElementById('coErrorMsg');
      errorMsg.style.color = 'var(--ink)';
      errorMsg.textContent = 'Pedido gerado! Finalize o pagamento pelo Pix acima — assim que for confirmado, avisamos por e-mail.';
      errorMsg.classList.add('active');
    } else {
      const errorMsg = document.getElementById('coErrorMsg');
      errorMsg.style.color = '';
      errorMsg.textContent = REJECTION_MESSAGES[data.status_detail] || 'Pagamento não aprovado. Confira os dados do cartão ou tente outra forma de pagamento.';
      errorMsg.classList.add('active');
      // O Brick não libera o botão "Pagar" sozinho depois de um pagamento
      // recusado — remontamos o formulário do zero pra cliente poder
      // tentar de novo (outro cartão, corrigir dados, ou trocar pra Pix)
      // sem precisar recarregar a página.
      if (paymentBrickController){
        try { paymentBrickController.unmount(); } catch (err) { console.error('[MUV pagamento] erro ao desmontar o Brick:', err); }
      }
      paymentBrickController = null;
      brickMountedAmount = null;
      renderPaymentBrick();
    }
  }

  async function renderPaymentBrick(){
    if (!checkoutPage.classList.contains('active')) return;
    const container = document.getElementById('paymentBrick_container');
    if (!container) return;

    const amount = getCheckoutAmount();
    if (amount <= 0) return;
    // já montado com o mesmo valor: não precisa remontar (evita perder o
    // que a cliente já digitou no cartão por causa de um recálculo bobo)
    if (paymentBrickController && amount === brickMountedAmount) return;

    const loadingEl = document.getElementById('coPayLoading');
    if (loadingEl){ loadingEl.classList.remove('hidden'); loadingEl.textContent = 'Carregando formas de pagamento...'; }

    const mp = await getMercadoPagoInstance();
    if (!mp){
      if (loadingEl) loadingEl.textContent = 'Pagamento indisponível no momento. Recarregue a página e tente novamente.';
      return;
    }

    if (paymentBrickController){
      try { await paymentBrickController.unmount(); } catch (err) { /* já desmontado */ }
      paymentBrickController = null;
    }

    try {
      const bricksBuilder = mp.bricks();
      paymentBrickController = await bricksBuilder.create('payment', 'paymentBrick_container', {
        initialization: {
          amount,
          payer: { email: (document.getElementById('coEmail').value || '').trim() || undefined }
        },
        customization: {
          paymentMethods: {
            creditCard: 'all',
            debitCard: '',
            ticket: '',
            atm: '',
            bankTransfer: 'all', // Pix
            maxInstallments: 12
          }
        },
        callbacks: {
          onReady: () => { if (loadingEl) loadingEl.classList.add('hidden'); },
          onError: (error) => { console.error('[MUV pagamento] erro no Brick:', error); },
          onSubmit: ({ selectedPaymentMethod, formData }) => new Promise((resolve, reject) => {
            const errorMsg = document.getElementById('coErrorMsg');
            errorMsg.style.color = '';
            const invalid = validateCheckoutForm();
            if (invalid){
              errorMsg.textContent = 'Confira os campos destacados e tente novamente.';
              errorMsg.classList.add('active');
              invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
              reject();
              return;
            }
            errorMsg.classList.remove('active');

            const order = buildOrderPayload(selectedPaymentMethod);

            // O security.js (carregado no index.html com output="device_id")
            // NÃO cria um elemento no HTML — ele cria uma variável global do
            // JavaScript com esse mesmo nome (window.device_id). Por isso lemos
            // a variável global aqui, e não um elemento do DOM. Como fallback,
            // também tentamos o nome padrão que o Mercado Pago usa quando o
            // SDK v2 coleta o Device ID sozinho (sem precisar do security.js).
            const deviceId = window.device_id || window.MP_DEVICE_SESSION_ID || '';
            if (!deviceId) {
              console.warn('[MUV pagamento] device_id ainda não estava disponível no momento do envio.');
            }

            fetch('/api/process-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ formData: { ...formData, deviceId }, order })
            })
              .then(r => r.json())
              .then((data) => {
                if (data.error){
                  errorMsg.textContent = data.error;
                  errorMsg.classList.add('active');
                  reject();
                  return;
                }
                order.orderNumber = data.order_number;
                order.paymentStatus = data.status;
                order.paymentId = data.id;
                // Mostra o resultado (aprovado/pendente/recusado) pra cliente
                // AGORA, sem esperar o pedido terminar de salvar no Supabase —
                // isso evita a cliente ficar travada olhando o botão "Pagar"
                // enquanto o registro do pedido acontece em segundo plano.
                handlePaymentResult(data, order);
                resolve();
                saveOrder(order);
              })
              .catch((err) => {
                console.error('Erro ao processar pagamento:', err);
                errorMsg.textContent = 'Não foi possível processar o pagamento. Tente novamente em instantes.';
                errorMsg.classList.add('active');
                reject();
              });
          })
        }
      });
      brickMountedAmount = amount;
    } catch (err){
      console.error('[MUV pagamento] erro ao montar o Brick:', err);
      if (loadingEl){ loadingEl.textContent = 'Não foi possível carregar o pagamento. Recarregue a página.'; loadingEl.classList.remove('hidden'); }
    }
  }

  /* =========================================================
     ORDERS HISTORY (Meus pedidos)
     -----------------------------------------------------
     O pedido é gravado no Supabase (tabela `orders`). Se a
     cliente estiver logada, ele fica vinculado à conta dela
     e aparece em "Meus pedidos" em qualquer dispositivo. Se
     for checkout como visitante (sem login), o pedido é salvo
     mesmo assim, mas só passa a aparecer em "Meus pedidos"
     depois que ela criar conta/logar com o mesmo e-mail e
     falarmos com o suporte, já que por segurança (RLS) pedidos
     avulsos sem usuário não ficam visíveis a ninguém pelo app.
  ========================================================= */
  async function saveOrder(order){
    try {
      const auth = await waitForAuth();
      await auth.saveOrder(order);
    } catch (err){
      console.error('[MUV Auth] erro ao salvar pedido no Supabase:', err);
      // Não bloqueia o checkout: o pagamento já foi criado no Mercado Pago,
      // então o cliente segue para lá mesmo que o registro do pedido falhe.
    }
  }

  // open directly on checkout if the page is loaded with #checkout in the URL
  if (location.hash === '#checkout' && cart.length > 0){
    openCheckoutPage();
  }

  /* =========================================================
     RETORNO DO MERCADO PAGO (após o pagamento)
     -----------------------------------------------------
     O Mercado Pago devolve o cliente pra cá com ?status=success,
     ?status=failure ou ?status=pending (ver back_urls em
     /api/checkout.js). O status real e definitivo do pedido é
     sempre o que o webhook grava no Supabase — isso aqui é só
     pra dar um retorno visual imediato pra pessoa.
  ========================================================= */
  (function checkPaymentReturn(){
    const params = new URLSearchParams(location.search);
    const status = params.get('status');
    if (!status) return;

    if (status === 'success') {
      cart = [];
      saveCart();
      showToast('Pagamento aprovado! Seu pedido foi confirmado.');
    } else if (status === 'pending') {
      cart = [];
      saveCart();
      showToast('Pagamento em análise. Avisaremos assim que for confirmado.');
    } else if (status === 'failure') {
      showToast('Pagamento não aprovado. Seu carrinho continua salvo para tentar novamente.');
    }

    // limpa os parâmetros da URL pra não reaplicar isso num F5
    const cleanUrl = location.pathname + location.hash;
    history.replaceState({}, '', cleanUrl);
  })();

  /* =========================================================
     SEARCH
  ========================================================= */
  const searchOverlay = document.getElementById('searchOverlay');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');

  function openSearch(){
    searchOverlay.classList.add('open');
    setTimeout(() => searchInput.focus(), 50);
  }
  function closeSearch(){
    searchOverlay.classList.remove('open');
    searchInput.value = '';
    searchResults.innerHTML = '<div class="search-hint">Digite para buscar entre todos os nossos produtos.</div>';
  }

  document.getElementById('searchOpen').addEventListener('click', openSearch);
  document.getElementById('searchClose').addEventListener('click', closeSearch);
  searchOverlay.addEventListener('click', (e) => { if (e.target === searchOverlay) closeSearch(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape'){ closeSearch(); closeDrawers(); closeProductDetail(); closeCartPage(); }
    if ((e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k')) && document.activeElement.tagName !== 'INPUT'){
      e.preventDefault(); openSearch();
    }
  });

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q){
      searchResults.innerHTML = '<div class="search-hint">Digite para buscar entre todos os nossos produtos.</div>';
      return;
    }
    const matches = PRODUCTS.filter(p => p.name.toLowerCase().includes(q));
    if (matches.length === 0){
      searchResults.innerHTML = '<div class="sr-empty">Nenhum produto encontrado para "' + searchInput.value + '".</div>';
      return;
    }
    searchResults.innerHTML = matches.map(p => `
      <div class="sr-item" data-goto="${p.id}" data-section="${p.section}">
        <div class="sr-thumb">${p.images && p.images[0] ? p.images[0] : ''}</div>
        <div>
          <h5>${p.name}</h5>
          <span>${brl(p.price)}</span>
        </div>
      </div>
    `).join('');
  });

  searchResults.addEventListener('click', (e) => {
    const item = e.target.closest('[data-goto]');
    if (!item) return;
    closeSearch();
    openProductDetail(item.dataset.goto);
  });

  /* =========================================================
     ACCOUNT / LOGIN
  ========================================================= */
  const accGuest = document.getElementById('accGuest');
  const accLogged = document.getElementById('accLogged');
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const formLogin = document.getElementById('formLogin');
  const formSignup = document.getElementById('formSignup');
  const loginError = document.getElementById('loginError');

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active'); tabSignup.classList.remove('active');
    formLogin.classList.add('active'); formSignup.classList.remove('active');
  });
  tabSignup.addEventListener('click', () => {
    tabSignup.classList.add('active'); tabLogin.classList.remove('active');
    formSignup.classList.add('active'); formLogin.classList.remove('active');
  });

  // Estado do usuário logado (preenchido via Supabase Auth em muv_current_user)
  window.muv_current_user = null;

  function waitForAuth(){
    return new Promise((resolve) => {
      (function check(){
        if (window.MUV_AUTH) return resolve(window.MUV_AUTH);
        setTimeout(check, 50);
      })();
    });
  }

  function setFormBusy(form, busy){
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    if (busy){
      btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Aguarde...';
    } else {
      btn.disabled = false;
      if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
    }
  }

  async function renderAccount(){
    const user = window.muv_current_user;
    if (user){
      accGuest.style.display = 'none';
      accLogged.classList.add('active');
      let name = (user.user_metadata && user.user_metadata.name) || user.email.split('@')[0];
      try {
        const profile = await (await waitForAuth()).getProfile();
        if (profile && profile.name) name = profile.name;
      } catch (e) { /* mantém o fallback */ }
      document.getElementById('accName').textContent = name;
      document.getElementById('accEmail').textContent = user.email;
      document.getElementById('accAvatar').textContent = name.charAt(0).toUpperCase();
    } else {
      accGuest.style.display = 'block';
      accLogged.classList.remove('active');
    }
  }

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const [emailInput, passInput] = formLogin.querySelectorAll('input');
    if (!emailInput.value || passInput.value.length < 4){
      loginError.textContent = 'E-mail ou senha inválidos.';
      loginError.style.display = 'block';
      return;
    }
    loginError.style.display = 'none';
    setFormBusy(formLogin, true);
    try {
      const auth = await waitForAuth();
      await auth.signIn({ email: emailInput.value.trim(), password: passInput.value });
      showToast('Login realizado com sucesso!');
      formLogin.reset();
    } catch (err){
      console.error('[MUV Auth] erro no login:', err);
      loginError.textContent = 'E-mail ou senha inválidos.';
      loginError.style.display = 'block';
    } finally {
      setFormBusy(formLogin, false);
    }
  });

  formSignup.addEventListener('submit', async (e) => {
    e.preventDefault();
    const [nameInput, emailInput, passInput] = formSignup.querySelectorAll('input');
    if (!nameInput.value.trim() || !emailInput.value.trim() || passInput.value.length < 4){
      showToast('Preencha nome, e-mail e uma senha com 4+ caracteres.');
      return;
    }
    setFormBusy(formSignup, true);
    try {
      const auth = await waitForAuth();
      const { data, session } = (await auth.signUp({
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passInput.value
      })) || {};
      if (data && data.session){
        showToast('Conta criada com sucesso! Bem-vinda, ' + nameInput.value.trim().split(' ')[0] + '.');
      } else {
        showToast('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      }
      formSignup.reset();
    } catch (err){
      console.error('[MUV Auth] erro no cadastro:', err);
      showToast('Não foi possível criar a conta: ' + (err.message || 'tente novamente.'));
    } finally {
      setFormBusy(formSignup, false);
    }
  });

  document.getElementById('accLogoutBtn').addEventListener('click', async () => {
    try {
      const auth = await waitForAuth();
      await auth.signOut();
      showToast('Você saiu da sua conta.');
    } catch (err){
      console.error('[MUV Auth] erro ao sair:', err);
    }
  });

  document.getElementById('accountOpen').addEventListener('click', () => openDrawer(accountDrawer));
  document.getElementById('accountClose').addEventListener('click', closeDrawers);

  // Sincroniza a UI toda vez que o estado de login muda (login, logout,
  // sessão restaurada ao recarregar a página, etc.)
  waitForAuth().then(auth => {
    auth.onAuthChange((user) => {
      window.muv_current_user = user;
      renderAccount();
    });
  });

  /* =========================================================
     "ESQUECI MINHA SENHA"
  ========================================================= */
  document.getElementById('forgotPasswordLink').addEventListener('click', async () => {
    const emailInput = formLogin.querySelector('input[type="email"]');
    const email = emailInput && emailInput.value.trim();
    if (!email){
      showToast('Digite seu e-mail acima para recuperar a senha.');
      emailInput.focus();
      return;
    }
    try {
      const auth = await waitForAuth();
      await auth.resetPassword(email);
      showToast('Enviamos um link de redefinição de senha para ' + email + '.');
    } catch (err){
      console.error('[MUV Auth] erro ao recuperar senha:', err);
      showToast('Não foi possível enviar o e-mail de recuperação agora.');
    }
  });

  /* =========================================================
     ACCOUNT SUB-VIEWS: Meus pedidos / Meus dados / Endereços
  ========================================================= */
  const accSubs = [document.getElementById('accOrders'), document.getElementById('accData'), document.getElementById('accAddresses')];

  function showAccSub(sub){
    accLogged.style.display = 'none';
    accSubs.forEach(s => s.classList.remove('active'));
    sub.classList.add('active');
  }
  function backToAccMenu(){
    accSubs.forEach(s => s.classList.remove('active'));
    accLogged.style.display = 'block';
  }
  document.querySelectorAll('[data-back-menu]').forEach(btn => btn.addEventListener('click', backToAccMenu));

  // ----- Meus pedidos -----
  async function renderOrders(){
    const list = document.getElementById('ordersList');
    list.innerHTML = '<div class="acc-empty">Carregando seus pedidos...</div>';
    let orders = [];
    try {
      const auth = await waitForAuth();
      orders = await auth.getOrders();
    } catch (err){
      console.error('[MUV Auth] erro ao carregar pedidos:', err);
      list.innerHTML = '<div class="acc-empty">Não foi possível carregar seus pedidos agora.</div>';
      return;
    }
    if (orders.length === 0){
      list.innerHTML = '<div class="acc-empty">Você ainda não fez nenhum pedido.<br>Quando finalizar uma compra, ela aparecerá aqui.</div>';
      return;
    }
    list.innerHTML = orders.map(o => {
      const items = Array.isArray(o.items) ? o.items : [];
      const itemsTxt = items.map(it => (it.qty || 1) + 'x ' + it.name).join(', ');
      const dateTxt = new Date(o.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
      return `
        <div class="order-card">
          <div class="oc-top"><span class="oc-id">#${o.order_number}</span><span class="oc-date">${dateTxt}</span></div>
          <span class="oc-status">${o.status}</span>
          <div class="oc-items">${itemsTxt}</div>
          <div class="oc-total">${brl(o.total)}</div>
        </div>`;
    }).join('');
  }
  document.getElementById('menuOrders').addEventListener('click', (e) => {
    e.preventDefault();
    renderOrders();
    showAccSub(document.getElementById('accOrders'));
  });

  // ----- Meus dados -----
  document.getElementById('menuData').addEventListener('click', async (e) => {
    e.preventDefault();
    showAccSub(document.getElementById('accData'));
    try {
      const auth = await waitForAuth();
      const user = (await auth.getProfile()) || { name:'', email:'', phone:'' };
      document.getElementById('accDataName').value = user.name || '';
      document.getElementById('accDataEmail').value = user.email || '';
      document.getElementById('accDataPhone').value = user.phone || '';
    } catch (err){
      console.error('[MUV Auth] erro ao carregar dados:', err);
    }
  });
  document.getElementById('formAccData').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('accDataName').value.trim();
    const email = document.getElementById('accDataEmail').value.trim();
    const phone = document.getElementById('accDataPhone').value.trim();
    if (!name || !email) return;
    try {
      const auth = await waitForAuth();
      await auth.updateProfile({ name, email, phone });
      await renderAccount();
      showToast('Dados atualizados com sucesso!');
      backToAccMenu();
    } catch (err){
      console.error('[MUV Auth] erro ao salvar dados:', err);
      showToast('Não foi possível salvar seus dados agora.');
    }
  });

  // ----- Endereços -----
  async function getAddresses(){
    try {
      const auth = await waitForAuth();
      return await auth.getAddresses();
    } catch (err){
      console.error('[MUV Auth] erro ao carregar endereços:', err);
      return [];
    }
  }

  const formAddress = document.getElementById('formAddress');
  let editingAddressId = null;

  async function renderAddresses(){
    const list = await getAddresses();
    const el = document.getElementById('addressesList');
    if (list.length === 0){
      el.innerHTML = '<div class="acc-empty">Nenhum endereço cadastrado ainda.</div>';
      return;
    }
    el.innerHTML = list.map(a => `
      <div class="addr-card">
        <div class="ac-label">${a.label || ''}${a.is_default ? '<span class="ac-default">Padrão</span>' : ''}</div>
        <div class="ac-text">${a.street}, ${a.number}${a.complement ? ' - ' + a.complement : ''}<br>${a.neighborhood} — ${a.city}/${a.state}<br>CEP ${a.cep}</div>
        <div class="ac-actions">
          <button type="button" data-edit="${a.id}">Editar</button>
          ${!a.is_default ? `<button type="button" data-default="${a.id}">Tornar padrão</button>` : ''}
          <button type="button" data-delete="${a.id}">Excluir</button>
        </div>
      </div>`).join('');
  }

  function resetAddressForm(){
    formAddress.reset();
    editingAddressId = null;
    formAddress.style.display = 'none';
    document.getElementById('addAddressBtn').style.display = 'block';
  }

  document.getElementById('menuAddresses').addEventListener('click', (e) => {
    e.preventDefault();
    renderAddresses();
    resetAddressForm();
    showAccSub(document.getElementById('accAddresses'));
  });

  document.getElementById('addAddressBtn').addEventListener('click', () => {
    editingAddressId = null;
    formAddress.reset();
    formAddress.style.display = 'flex';
    document.getElementById('addAddressBtn').style.display = 'none';
  });
  document.getElementById('cancelAddressForm').addEventListener('click', resetAddressForm);

  document.getElementById('addressesList').addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit]');
    const defaultBtn = e.target.closest('[data-default]');
    const delBtn = e.target.closest('[data-delete]');
    if (!editBtn && !defaultBtn && !delBtn) return;

    const list = await getAddresses();
    const auth = await waitForAuth();

    if (editBtn){
      const a = list.find(x => x.id === editBtn.dataset.edit);
      if (!a) return;
      editingAddressId = a.id;
      document.getElementById('addrLabel').value = a.label || '';
      document.getElementById('addrCep').value = a.cep || '';
      document.getElementById('addrStreet').value = a.street || '';
      document.getElementById('addrNumber').value = a.number || '';
      document.getElementById('addrComplement').value = a.complement || '';
      document.getElementById('addrNeighborhood').value = a.neighborhood || '';
      document.getElementById('addrCity').value = a.city || '';
      document.getElementById('addrState').value = a.state || '';
      formAddress.style.display = 'flex';
      document.getElementById('addAddressBtn').style.display = 'none';
    }
    if (defaultBtn){
      try {
        await auth.setDefaultAddress(defaultBtn.dataset.default);
        await renderAddresses();
        showToast('Endereço padrão atualizado.');
      } catch (err){
        console.error('[MUV Auth] erro ao definir padrão:', err);
        showToast('Não foi possível atualizar o endereço padrão.');
      }
    }
    if (delBtn){
      try {
        await auth.deleteAddress(delBtn.dataset.delete);
        await renderAddresses();
        showToast('Endereço removido.');
      } catch (err){
        console.error('[MUV Auth] erro ao excluir endereço:', err);
        showToast('Não foi possível excluir o endereço.');
      }
    }
  });

  formAddress.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      label: document.getElementById('addrLabel').value.trim(),
      cep: document.getElementById('addrCep').value.trim(),
      street: document.getElementById('addrStreet').value.trim(),
      number: document.getElementById('addrNumber').value.trim(),
      complement: document.getElementById('addrComplement').value.trim(),
      neighborhood: document.getElementById('addrNeighborhood').value.trim(),
      city: document.getElementById('addrCity').value.trim(),
      state: document.getElementById('addrState').value.trim()
    };
    try {
      const auth = await waitForAuth();
      await auth.saveAddress(data, editingAddressId || undefined);
      await renderAddresses();
      resetAddressForm();
      showToast('Endereço salvo com sucesso!');
    } catch (err){
      console.error('[MUV Auth] erro ao salvar endereço:', err);
      showToast('Não foi possível salvar o endereço agora.');
    }
  });

  /* =========================================================
     FOOTER INFO / POLICY MODAL
  ========================================================= */
  const infoContent = {
    rastreio: { title: 'Rastrear pedido', body: '<p>Para acompanhar o status do seu pedido, acesse "Minha conta" → "Meus pedidos". Lá você encontra o número do pedido e a situação atual de cada compra.</p><p>Assim que a transportadora gerar o código de rastreio, ele passará a aparecer automaticamente junto ao pedido.</p>' },
    faq: { title: 'Perguntas frequentes', body: '<p><strong>Qual o prazo de entrega?</strong> Varia de acordo com o CEP informado no carrinho, calculado no momento do checkout.</p><p><strong>Quais formas de pagamento são aceitas?</strong> Pix e cartão de crédito.</p><p><strong>Como faço uma troca?</strong> Entre em contato pelo e-mail contato@muvfitness.com.br em até 7 dias após o recebimento.</p>' },
    frete: { title: 'Política de frete', body: '<p>O valor do frete é calculado automaticamente com base no CEP de entrega informado durante o checkout.</p><p>Prazos e valores podem variar conforme a região e a transportadora responsável pela entrega.</p>' },
    privacidade: { title: 'Política de privacidade', body: '<h4>1. Quem trata seus dados</h4><p>A MUV FITNESS é a controladora dos dados pessoais coletados neste site, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD).</p><h4>2. Quais dados coletamos</h4><ul><li>Dados de identificação e contato: nome, e-mail, telefone e CPF;</li><li>Dados de entrega: endereço, CEP, cidade e estado;</li><li>Dados de navegação: páginas visitadas e itens no carrinho, para melhorar sua experiência de compra;</li><li>Dados de pagamento, processados diretamente pelo nosso parceiro de pagamentos (Mercado Pago), sem que a MUV FITNESS armazene números completos de cartão.</li></ul><h4>3. Para que usamos seus dados</h4><p>Usamos seus dados para processar pedidos, calcular frete, emitir nota fiscal, comunicar o status da compra, oferecer suporte e, quando você autorizar, enviar novidades e promoções por e-mail.</p><h4>4. Compartilhamento de dados</h4><p>Compartilhamos dados apenas com parceiros necessários para a operação da loja, como transportadoras e processadores de pagamento. Não vendemos nem compartilhamos suas informações com terceiros para fins de marketing sem o seu consentimento.</p><h4>5. Seus direitos</h4><p>Conforme a LGPD, você pode solicitar a qualquer momento a confirmação do tratamento, acesso, correção, anonimização, portabilidade ou exclusão dos seus dados, além de revogar consentimentos dados anteriormente. Basta entrar em contato pelo e-mail contato@muvfitness.com.br.</p><h4>6. Segurança</h4><p>Utilizamos conexão criptografada (SSL) e boas práticas de segurança da informação para proteger seus dados contra acesso não autorizado.</p><h4>7. Armazenamento</h4><p>Seus dados são mantidos pelo tempo necessário para cumprir finalidades legais, fiscais e contratuais, sendo excluídos ou anonimizados após esse período, salvo obrigação legal de retenção.</p><h4>8. Alterações desta política</h4><p>Esta política pode ser atualizada periodicamente. Recomendamos revisá-la de tempos em tempos.</p><h4>9. Contato</h4><p>Dúvidas sobre esta política? Fale conosco pelo e-mail contato@muvfitness.com.br.</p>' },
    termos: { title: 'Termos de serviço', body: '<h4>1. Sobre estes termos</h4><p>Estes Termos de Serviço regulam o uso do site MUV FITNESS e a compra de produtos oferecidos nesta loja. Ao navegar ou realizar uma compra, você concorda com as condições descritas aqui.</p><h4>2. Cadastro e conta</h4><p>Para finalizar uma compra, pode ser necessário criar uma conta com dados verdadeiros, completos e atualizados. Você é responsável por manter a confidencialidade da sua senha e por todas as atividades realizadas na sua conta.</p><h4>3. Produtos e preços</h4><p>Fazemos o possível para manter fotos, descrições e preços atualizados, mas podem ocorrer pequenas variações de cor devido à tela do dispositivo, além de alterações de preço sem aviso prévio, exceto para pedidos já confirmados.</p><h4>4. Pagamento</h4><p>Aceitamos pagamento via Pix e cartão de crédito, conforme as condições exibidas no checkout. O processamento dos pagamentos é feito por um parceiro especializado (Mercado Pago).</p><h4>5. Entrega</h4><p>Os prazos de entrega são estimados no checkout com base no CEP informado e podem variar conforme a transportadora e a região. A retirada em loja pode ser combinada para o nosso endereço em Arapiraca, Alagoas.</p><h4>6. Trocas e devoluções</h4><p>Consulte nossa Política de trocas e devoluções para prazos e condições específicas.</p><h4>7. Propriedade intelectual</h4><p>Todo o conteúdo do site — textos, imagens, marca e identidade visual — pertence à MUV FITNESS e não pode ser reproduzido sem autorização prévia.</p><h4>8. Alterações destes termos</h4><p>Podemos atualizar estes termos periodicamente. A versão vigente é sempre a publicada nesta página.</p><h4>9. Legislação aplicável</h4><p>Estes termos são regidos pelas leis brasileiras, incluindo o Código de Defesa do Consumidor (Lei nº 8.078/1990).</p><h4>10. Contato</h4><p>Dúvidas? Fale com a gente pelo e-mail contato@muvfitness.com.br ou pelo WhatsApp.</p>' },
    devolucoes: { title: 'Trocas, devoluções e reembolso', body: '<h4>Direito de arrependimento (7 dias)</h4><p>Como sua compra foi feita fora de estabelecimento físico, você tem até <strong>7 dias corridos</strong> a partir do recebimento do produto para desistir da compra, sem precisar justificar o motivo, conforme o art. 49 do Código de Defesa do Consumidor.</p><p>Nesse caso, devolvemos o valor total pago, incluindo o frete, no mesmo método de pagamento usado na compra.</p><h4>Troca por defeito</h4><p>Se o produto apresentar defeito de fabricação, você tem até 90 dias a partir do recebimento para nos avisar, conforme o art. 26 do CDC. Vamos avaliar o produto e oferecer troca, reparo ou reembolso, conforme sua preferência.</p><h4>Troca por tamanho ou cor</h4><p>Quer trocar porque a peça não serviu ou você prefere outra cor? É só solicitar dentro do mesmo prazo de 7 dias corridos após o recebimento.</p><h4>Condições para troca ou devolução</h4><ul><li>Produto sem uso, sem lavagem e sem sinais de utilização;</li><li>Etiquetas originais e selo de higiene (quando houver) intactos;</li><li>Embalagem original, sempre que possível;</li><li>Nota fiscal ou comprovante de compra.</li></ul><h4>Como solicitar</h4><p>Entre em contato pelo e-mail contato@muvfitness.com.br ou pelo WhatsApp, informando o número do pedido e o motivo da troca ou devolução. Vamos te enviar as instruções para o envio do produto.</p><p>Após recebermos e conferirmos o produto, a troca ou o reembolso é processado em até 7 dias úteis.</p><p>Pedidos retirados na nossa loja em Arapiraca (AL) também podem ser trocados presencialmente, mediante agendamento prévio por e-mail ou WhatsApp.</p>' },
    legal: { title: 'Aviso legal', body: '<p>Todo o conteúdo deste site, incluindo textos, imagens e identidade visual, é de propriedade da MUV FITNESS e protegido por lei.</p>' }
  };
  const infoOverlay = document.getElementById('infoOverlay');
  function openInfo(key){
    const data = infoContent[key];
    if (!data) return;
    document.getElementById('infoTitle').textContent = data.title;
    document.getElementById('infoBody').innerHTML = data.body;
    infoOverlay.classList.add('open');
  }
  document.querySelectorAll('[data-info]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openInfo(a.dataset.info);
    });
  });
  document.getElementById('infoClose').addEventListener('click', () => infoOverlay.classList.remove('open'));
  infoOverlay.addEventListener('click', (e) => { if (e.target === infoOverlay) infoOverlay.classList.remove('open'); });