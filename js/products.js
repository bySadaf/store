/* ==========================================================================
   PRODUCTS (public website)
   --------------------------------------------------------------------------
   - Loads active products with pagination ("Load More")
   - Supports category filter, live search (name / description / category)
     and sorting, all without reloading the page
   - Renders product cards with a "Buy on WhatsApp" button
   - Opens the product details modal
   Exposes: Prods
   Depends on: js/supabase.js, js/utils.js, js/whatsapp.js
   ========================================================================== */

const Prods = (function () {

  const PER_PAGE = SITE_CONFIG.productsPerPage;

  const state = {
    categoryId: null,
    categoryName: null,
    search: '',
    sort: 'newest',
    page: 0,
    total: -1,
    loading: false,
    items: []
  };

  /* Photos of the product shown in the details modal. */
  const gallery = { images: [], index: 0 };

  /* All photo URLs of a product (the image_urls gallery, or the legacy
     single image_url when the product has no gallery yet). */
  function productImageUrls(p) {
    const arr = (p && p.image_urls && p.image_urls.length) ? p.image_urls : [];
    if (arr.length) return arr.slice();
    return (p && p.image_url) ? [p.image_url] : [];
  }

  /* ------------------------------ DOM helpers ---------------------------- */

  function grid() { return document.getElementById('productsGrid'); }
  function statusEl() { return document.getElementById('productsStatus'); }
  function loadMoreBtn() { return document.getElementById('loadMoreBtn'); }

  function showStatus(node) {
    const box = statusEl();
    if (!box) return;
    box.innerHTML = '';
    box.appendChild(node);
  }
  function clearStatus() {
    if (statusEl()) statusEl().innerHTML = '';
  }

  /* ------------------------------ Bindings ------------------------------- */

  function init() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', U.debounce((e) => {
        setSearch(e.target.value);
      }, 350));
    }

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        state.sort = e.target.value;
        load(true);
      });
    }

    if (loadMoreBtn()) {
      loadMoreBtn().addEventListener('click', () => {
        if (!state.loading) { state.page++; load(false); }
      });
    }

    /* Product cards open the details modal. Featured products are rendered
       into a SEPARATE grid (#featuredGrid) with the same card markup, so
       both grids need the click + keyboard handlers. */
    [grid(), document.getElementById('featuredGrid')].forEach((g) => {
      if (!g) return;
      g.addEventListener('click', onGridClick);
      g.addEventListener('keydown', onGridKeydown);
    });

    /* The active filter chips ("Category: Shoes x") are clickable. */
    const chips = document.getElementById('activeFilters');
    if (chips) {
      chips.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-clear]');
        if (!btn) return;
        if (btn.dataset.clear === 'category') {
          location.hash = '#category/all'; // goes through the router
        } else {
          const si = document.getElementById('searchInput');
          if (si) si.value = '';
          setSearch('');
        }
      });
    }

    bindGalleryControls();

    loadFeatured();

    /* Avoid a duplicate first load when a #category/... link already
       triggered one through the router in main.js. */
    if (!state.loading && !state.items.length && !state.started) {
      state.started = true;
      return load(true);
    }
    return Promise.resolve();
  }

  function onGridClick(e) {
    /* A missing-WhatsApp button shows a friendly message. */
    const missing = e.target.closest('[data-wa-missing]');
    if (missing) return; // handled by main.js

    /* Let the real WhatsApp link open normally. */
    if (e.target.closest('a.btn-whatsapp')) return;

    const cardEl = e.target.closest('.product-card');
    if (cardEl && cardEl.dataset.slug) {
      location.hash = '#product/' + cardEl.dataset.slug;
    }
  }

  function onGridKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const media = e.target.closest('.card-media');
    if (media) {
      e.preventDefault();
      const cardEl = media.closest('.product-card');
      if (cardEl && cardEl.dataset.slug) location.hash = '#product/' + cardEl.dataset.slug;
    }
  }

  /* ------------------------------ Filters -------------------------------- */

  function setSearch(term) {
    state.search = String(term || '').trim();
    renderChips();
    load(true);
  }

  function setCategory(categoryId, categoryName) {
    state.categoryId = categoryId || null;
    state.categoryName = categoryName || null;
    renderChips();
    updateSubtitle();
    load(true);
  }

  function updateSubtitle() {
    const el = document.getElementById('catalogSubtitle');
    if (!el) return;
    el.textContent = state.categoryName
      ? 'Showing products in "' + state.categoryName + '"'
      : 'Browse everything we have in store';
  }

  function renderChips() {
    const box = document.getElementById('activeFilters');
    if (!box) return;
    let html = '';
    if (state.categoryId) {
      html += '<span class="filter-chip">Category: ' + U.esc(state.categoryName) +
        ' <button type="button" data-clear="category" aria-label="Clear category filter">&times;</button></span>';
    }
    if (state.search) {
      html += '<span class="filter-chip">"' + U.esc(state.search) +
        '" <button type="button" data-clear="search" aria-label="Clear search">&times;</button></span>';
    }
    if (html) {
      html += '<button type="button" class="clear-all" data-clear="both">Clear all</button>';
    }
    box.innerHTML = html;
    box.classList.toggle('d-none', !html);
  }

  /* ------------------------------ Query ---------------------------------- */

  function sanitizeTerm(term) {
    /* Remove characters that would break PostgREST's "or" syntax. */
    return String(term || '').replace(/[,()%]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function buildQuery() {
    let q = DB.client()
      .from('products')
      .select('id, name, slug, description, price, image_url, image_urls, featured, category_id, categories(name, slug)', { count: 'exact' })
      .eq('active', true);

    if (state.categoryId) q = q.eq('category_id', state.categoryId);

    const term = sanitizeTerm(state.search);
    if (term) {
      const parts = [
        'name.ilike.%' + term + '%',
        'description.ilike.%' + term + '%'
      ];
      /* Also match the category NAME, e.g. searching "shoes". */
      const t = term.toLowerCase();
      const catIds = SiteState.categories
        .filter((c) => String(c.name || '').toLowerCase().indexOf(t) !== -1)
        .map((c) => c.id);
      if (catIds.length) parts.push('category_id.in.(' + catIds.join(',') + ')');
      q = q.or(parts.join(','));
    }

    const orders = {
      'newest': ['created_at', true],
      'price-asc': ['price', false],
      'price-desc': ['price', true],
      'name-asc': ['name', false]
    };
    const order = orders[state.sort] || orders['newest'];
    q = q.order(order[0], { ascending: !order[1] });

    return q;
  }

  /* ------------------------------ Loading -------------------------------- */

  async function load(reset) {
    if (!DB.client()) {
      grid().innerHTML = '';
      showStatus(U.statusBlock('info',
        'Products will appear here after setup. Add your Supabase URL and anon key in <code>js/config.js</code> ' +
        '(see <code>README.md</code>) and reload this page.', 'Reload page', () => location.reload()));
      return;
    }

    if (state.loading) return;
    state.loading = true;

    if (reset) {
      state.page = 0;
      state.total = -1;
      state.items = [];
      grid().innerHTML = U.skeletonCards(PER_PAGE);
      clearStatus();
      loadMoreBtn().classList.add('d-none');
    }

    const from = state.page * PER_PAGE;
    const to = from + PER_PAGE - 1;

    try {
      const { data, error, count } = await buildQuery().range(from, to);
      if (error) throw error;

      const fresh = data || [];
      state.items = reset ? fresh : state.items.concat(fresh);
      state.total = (count == null) ? state.items.length : count;
      renderResults(reset, fresh);
    } catch (err) {
      console.error('Products load failed:', err);
      if (reset) grid().innerHTML = '';
      showStatus(U.statusBlock('error',
        'We could not load the products right now. Please check your connection and try again.',
        'Try again', () => load(true)));
    } finally {
      state.loading = false;
      const spinner = loadMoreBtn().querySelector('.spinner-border');
      if (spinner) { spinner.remove(); loadMoreBtn().disabled = false; }
    }
  }

  function renderResults(reset, fresh) {
    if (!state.items.length) {
      grid().innerHTML = '';
      let message;
      if (state.search) {
        message = 'No products found for "' + U.esc(state.search) + '". Try a different word.';
      } else if (state.categoryId) {
        message = 'No products available in this category.';
      } else {
        message = 'No products yet. New products will appear here soon.';
      }
      showStatus(U.statusBlock('empty', message));
      updateCountText();
      loadMoreBtn().classList.add('d-none');
      return;
    }

    /* On "Load More" only the NEW rows are appended, never the full list. */
    const html = (reset ? state.items : fresh).map(cardHtml).join('');
    if (reset) {
      grid().innerHTML = html;
    } else {
      grid().insertAdjacentHTML('beforeend', html);
    }

    clearStatus();
    updateCountText();

    const remaining = state.total - state.items.length;
    if (remaining > 0) {
      loadMoreBtn().innerHTML = 'Load More (' + remaining + ' more)';
      loadMoreBtn().classList.remove('d-none');
    } else {
      loadMoreBtn().classList.add('d-none');
    }
  }

  function updateCountText() {
    const el = document.getElementById('resultsCount');
    if (!el) return;
    el.textContent = state.items.length
      ? 'Showing ' + state.items.length + ' of ' + state.total + ' products'
      : '';
  }

  /* ------------------------------ Rendering ------------------------------ */

  function cardHtml(p) {
    const catName = p.categories ? p.categories.name : '';
    const img = p.image_url ? U.esc(p.image_url) : U.placeholder();
    const ph = U.placeholder();

    return '<div class="col-6 col-md-4 col-lg-3">' +
      '<article class="product-card" data-slug="' + U.esc(p.slug) + '">' +
      '<div class="card-media" role="button" tabindex="0" aria-label="View details for ' + U.esc(p.name) + '">' +
      '<img src="' + img + '" alt="' + U.esc(p.name) + '" loading="lazy" decoding="async" ' +
      'onerror="this.onerror=null;this.src=\'' + ph + '\'">' +
      (p.featured ? '<span class="badge-featured"><i class="bi bi-star-fill"></i> Featured</span>' : '') +
      '</div>' +
      '<div class="card-body">' +
      (catName ? '<span class="cat-badge">' + U.esc(catName) + '</span>' : '') +
      '<h3 class="card-title">' + U.esc(p.name) + '</h3>' +
      '<div class="card-price">' + U.money(p.price) + '</div>' +
      '<p class="card-desc">' + U.esc(U.truncate(p.description, 90)) + '</p>' +
      waButtonHtml(p) +
      '</div>' +
      '</article>' +
      '</div>';
  }

  /* "Buy on WhatsApp" button. Falls back to a disabled-style button with a
     friendly message when no WhatsApp number is configured yet. */
  function waButtonHtml(p) {
    const url = WA.link(SiteState.settings, p);
    const label = '<i class="bi bi-whatsapp" aria-hidden="true"></i><span>Buy on WhatsApp</span>';
    if (url) {
      return '<a class="btn btn-whatsapp" href="' + U.esc(url) + '" target="_blank" rel="noopener noreferrer" ' +
        'aria-label="Buy ' + U.esc(p.name) + ' on WhatsApp">' + label + '</a>';
    }
    return '<button type="button" class="btn btn-whatsapp" data-wa-missing>' + label + '</button>';
  }

  /* ------------------------------ Featured ------------------------------- */

  async function loadFeatured() {
    const section = document.getElementById('featuredSection');
    const wrap = document.getElementById('featuredGrid');
    if (!section || !wrap || !DB.client()) return;

    try {
      const { data, error } = await DB.client()
        .from('products')
        .select('id, name, slug, description, price, image_url, image_urls, featured, category_id, categories(name, slug)')
        .eq('active', true)
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) throw error;
      if (!data || !data.length) { section.classList.add('d-none'); return; }
      wrap.innerHTML = data.map(cardHtml).join('');
      section.classList.remove('d-none');
    } catch (err) {
      console.error('Featured products failed:', err);
      section.classList.add('d-none');
    }
  }

  /* ------------------------------ Details modal -------------------------- */

  async function openBySlug(slug) {
    let product = state.items.find((p) => p.slug === slug);

    if (!product) {
      if (!DB.client()) return;
      try {
        const { data, error } = await DB.client()
          .from('products')
          .select('id, name, slug, description, price, image_url, image_urls, featured, category_id, categories(name, slug)')
          .eq('active', true)
          .eq('slug', slug)
          .maybeSingle();
        if (error) throw error;
        product = data;
      } catch (err) {
        console.error('Product fetch failed:', err);
        U.toast(DB.friendlyError(err, 'Could not load this product.'), 'danger');
        return;
      }
    }

    if (!product) {
      U.toast('Sorry, this product was not found. It may have been removed.', 'warning');
      return;
    }

    fillModal(product);
  }

  function fillModal(p) {
    const modalEl = document.getElementById('productModal');
    if (!modalEl) return;

    const featuredEl = document.getElementById('pmFeatured');
    if (featuredEl) featuredEl.classList.toggle('d-none', !p.featured);

    const img = document.getElementById('pmImage');
    if (img) img.alt = p.name;

    /* Load the product's photos into the gallery and show the first one. */
    gallery.images = productImageUrls(p);
    gallery.index = 0;
    pmShow(0);

    const badge = document.getElementById('pmCategory');
    if (badge) {
      badge.textContent = p.categories ? (p.categories.name || 'Product') : 'Product';
    }

    document.getElementById('pmName').textContent = p.name;
    document.getElementById('pmPrice').textContent = U.money(p.price);

    const desc = document.getElementById('pmDescription');
    desc.textContent = p.description || 'Contact us on WhatsApp for more details about this product.';

    const waEl = document.getElementById('pmWhatsApp');
    const url = WA.link(SiteState.settings, p);
    if (url) {
      waEl.setAttribute('href', url);
      waEl.removeAttribute('data-wa-missing');
    } else {
      waEl.setAttribute('href', '#');
      waEl.setAttribute('data-wa-missing', '');
    }

    modalEl.dataset.slug = p.slug || '';
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  /* ------------------------------ Photo gallery --------------------------- */

  /* Bound once when the page starts; the modal markup is static in the HTML. */
  function bindGalleryControls() {
    const prev = document.getElementById('pmPrev');
    if (prev) prev.addEventListener('click', () => pmShow(gallery.index - 1));

    const next = document.getElementById('pmNext');
    if (next) next.addEventListener('click', () => pmShow(gallery.index + 1));

    const thumbs = document.getElementById('pmThumbs');
    if (thumbs) {
      thumbs.addEventListener('click', (e) => {
        const t = e.target.closest('img[data-index]');
        if (t) pmShow(Number(t.dataset.index));
      });
    }

    /* Left / right arrow keys switch photos while the modal is open. */
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const m = document.getElementById('productModal');
      if (!m || !m.classList.contains('show') || gallery.images.length < 2) return;
      e.preventDefault();
      pmShow(gallery.index + (e.key === 'ArrowRight' ? 1 : -1));
    });
  }

  /* Show photo i (wraps around). With no photos at all, shows the placeholder. */
  function pmShow(i) {
    const img = document.getElementById('pmImage');
    if (!img) return;

    const len = gallery.images.length;
    if (!len) {
      img.removeAttribute('onerror');
      img.src = U.placeholder();
      updateGalleryUi();
      return;
    }

    gallery.index = ((i % len) + len) % len;
    img.onerror = () => { img.onerror = null; img.src = U.placeholder(); };
    img.src = gallery.images[gallery.index];
    updateGalleryUi();
  }

  /* Arrows, the "2 / 5" counter and the thumbnail strip only appear when
     the product has more than one photo. */
  function updateGalleryUi() {
    const multi = gallery.images.length > 1;

    ['pmPrev', 'pmNext', 'pmCount', 'pmThumbs'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('d-none', !multi);
    });

    const count = document.getElementById('pmCount');
    if (count) count.textContent = (gallery.index + 1) + ' / ' + gallery.images.length;

    const thumbs = document.getElementById('pmThumbs');
    if (thumbs) {
      thumbs.innerHTML = multi ? gallery.images.map((url, i) =>
        '<img src="' + U.esc(url) + '" alt="Photo ' + (i + 1) + ' of ' + gallery.images.length + '" ' +
        'class="' + (i === gallery.index ? 'active' : '') + '" data-index="' + i + '" loading="lazy" decoding="async">'
      ).join('') : '';
    }
  }

  return { init, load, setSearch, setCategory, openBySlug, state };
})();
