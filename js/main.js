/* ==========================================================================
   MAIN (public website)
   --------------------------------------------------------------------------
   Starts the page: loads settings, renders the header / hero / contact /
   footer, loads categories and products, and handles the #hash routes:

     #category/<slug>   filter the catalog by category ("all" clears it)
     #product/<slug>    open the product details modal (shareable links)

   Depends on: all other js/ files
   ========================================================================== */

(function () {

  let lastNavHash = ''; // hash to restore after the product modal closes

  document.addEventListener('DOMContentLoaded', start);

  async function start() {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    initNavbar();

    /* ---- Not configured yet: show a helpful setup banner --------------- */
    if (!DB.configured()) {
      console.warn('[Setup] js/config.js still contains placeholders.');
      showSetupBanner();
      SiteState.settings = Object.assign({}, SITE_CONFIG.defaults);
      applySettings(SiteState.settings);
      const grid = document.getElementById('categoryGrid');
      if (grid) {
        grid.innerHTML = '<div class="col-12"><div class="status-block"><i class="bi bi-gear"></i>' +
          '<p>Categories will appear here after setup.</p></div></div>';
      }
      initHashRouting();
      Prods.init();
      return;
    }

    /* ---- Load site settings (business name, hero, WhatsApp, contact) --- */
    try {
      const { data, error } = await DB.client()
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      SiteState.settings = data || Object.assign({}, SITE_CONFIG.defaults);
    } catch (err) {
      console.error('Settings load failed:', err);
      U.toast(DB.friendlyError(err, 'Could not load the site settings.'), 'warning');
      SiteState.settings = Object.assign({}, SITE_CONFIG.defaults);
    }

    applySettings(SiteState.settings);

    /* ---- Categories ------------------------------------------------------ */
    try {
      await Cats.load();
      Cats.render();
    } catch (err) {
      Cats.showError(err);
    }

    initHashRouting();

    /* ---- Products -------------------------------------------------------- */
    await Prods.init();
  }

  /* ====================================================================== */

  function showSetupBanner() {
    const box = document.getElementById('setupBanner');
    if (!box) return;
    box.innerHTML =
      '<div class="alert alert-warning alert-dismissible fade show mb-0 rounded-0" role="alert">' +
      '<strong>One small step left:</strong> open <code>js/config.js</code> and paste your Supabase ' +
      'project URL and anon key, then reload this page. Full instructions are in <code>README.md</code>.' +
      '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
      '</div>';
  }

  /* Apply settings to the whole page: header, hero, contact, footer, meta. */
  function applySettings(s) {
    const name = s.business_name || SITE_CONFIG.defaults.business_name;

    /* Browser tab + social preview */
    document.title = name + ' | Product Catalog';
    setMeta('description', U.truncate(s.hero_description || SITE_CONFIG.defaults.hero_description, 160));
    setMeta('og:title', name, true);
    setMeta('og:description', U.truncate(s.hero_description || '', 160), true);
    setMeta('og:site_name', name, true);

    /* Header brand */
    const logo = document.getElementById('brandLogo');
    const brandName = document.getElementById('brandName');
    if (brandName) brandName.textContent = name;
    if (s.logo_url) {
      logo.src = s.logo_url;
      logo.alt = name;
      logo.classList.remove('d-none');
      if (brandName) brandName.classList.add('d-none');
    }

    /* Hero */
    const heroTitle = document.getElementById('heroTitle');
    const heroDesc = document.getElementById('heroDesc');
    if (heroTitle) heroTitle.textContent = s.hero_title || name;
    if (heroDesc) heroDesc.textContent = s.hero_description || '';

    /* Contact cards */
    renderContact(s);

    /* Footer */
    const footerName = document.getElementById('footerName');
    const footerNameCopy = document.getElementById('footerNameCopy');
    const footerDesc = document.getElementById('footerDesc');
    const footerContact = document.getElementById('footerContact');
    if (footerName) footerName.textContent = name;
    if (footerNameCopy) footerNameCopy.textContent = name;
    if (footerDesc) footerDesc.textContent = U.truncate(s.hero_description || '', 120);
    if (footerContact) renderFooterContact(footerContact, s);

    /* Floating WhatsApp chat button */
    const float = document.getElementById('waFloat');
    if (float) {
      const url = WA.link(s, null);
      if (url) {
        float.setAttribute('href', url);
        float.classList.remove('d-none');
      }
    }
  }

  function setMeta(nameOrProperty, content, isProperty) {
    if (!content) return;
    const attr = isProperty ? 'property' : 'name';
    let el = document.querySelector('meta[' + attr + '="' + nameOrProperty + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, nameOrProperty);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  /* ---------------------------------------------------------------------- */

  function contactCardsHtml(s) {
    const cards = [];

    const waUrl = WA.link(s, null);
    if (waUrl) {
      cards.push(contactCard('ci-wa', 'bi-whatsapp', 'WhatsApp',
        '<a href="' + U.esc(waUrl) + '" target="_blank" rel="noopener noreferrer">Chat with us on WhatsApp</a>'));
    }
    if (s.contact_phone) {
      cards.push(contactCard('ci-phone', 'bi-telephone', 'Phone',
        '<a href="tel:' + U.esc(String(s.contact_phone).replace(/[^+0-9]/g, '')) + '">' + U.esc(s.contact_phone) + '</a>'));
    }
    if (s.contact_email) {
      cards.push(contactCard('ci-mail', 'bi-envelope', 'Email',
        '<a href="mailto:' + U.esc(s.contact_email) + '">' + U.esc(s.contact_email) + '</a>'));
    }
    if (s.address) {
      cards.push(contactCard('ci-pin', 'bi-geo-alt', 'Visit Us', '<span>' + U.esc(s.address) + '</span>'));
    }

    if (!cards.length) {
      return '<div class="col-12"><div class="status-block"><i class="bi bi-chat-dots"></i>' +
        '<p>Contact details will appear here once the shop owner adds them in the admin settings.</p></div></div>';
    }
    return cards.join('');
  }

  function contactCard(iconClass, icon, title, bodyHtml) {
    return '<div class="col-12 col-sm-6 col-lg-3">' +
      '<div class="contact-card">' +
      '<div class="contact-icon ' + iconClass + '"><i class="bi ' + icon + '" aria-hidden="true"></i></div>' +
      '<h3>' + title + '</h3>' +
      '<p>' + bodyHtml + '</p>' +
      '</div></div>';
  }

  function renderContact(s) {
    const box = document.getElementById('contactCards');
    if (box) box.innerHTML = contactCardsHtml(s);
  }

  function renderFooterContact(el, s) {
    const lines = [];
    if (s.contact_phone) lines.push('<span><i class="bi bi-telephone me-2"></i>' + U.esc(s.contact_phone) + '</span>');
    if (s.contact_email) lines.push('<span><i class="bi bi-envelope me-2"></i>' + U.esc(s.contact_email) + '</span>');
    if (s.address) lines.push('<span><i class="bi bi-geo-alt me-2"></i>' + U.esc(s.address) + '</span>');
    el.innerHTML = lines.length
      ? lines.join('<br>')
      : '<span class="opacity-75">Contact details coming soon.</span>';
  }

  /* ---------------------------------------------------------------------- */

  function initNavbar() {
    /* Shadow when the page is scrolled. */
    const header = document.getElementById('siteHeader');
    if (header) {
      window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 8);
      }, { passive: true });
    }

    /* The search icon scrolls to the catalog and focuses the search field. */
    const searchBtn = document.getElementById('navSearchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const catalog = document.getElementById('catalog');
        if (catalog) catalog.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => {
          const input = document.getElementById('searchInput');
          if (input) input.focus({ preventScroll: true });
        }, 450);
      });
    }

    /* Close the mobile menu after tapping a link. */
    document.querySelectorAll('#navMenu a').forEach((a) => {
      a.addEventListener('click', () => {
        const menu = document.getElementById('navMenu');
        const inst = window.bootstrap && bootstrap.Collapse.getInstance(menu);
        if (inst && menu.classList.contains('show')) inst.hide();
      });
    });

    /* Friendly message when the WhatsApp number is not configured yet. */
    document.addEventListener('click', (e) => {
      const missing = e.target.closest('[data-wa-missing]');
      if (!missing) return;
      e.preventDefault();
      U.toast('The WhatsApp number is not set up yet. The shop owner can add it under Admin -> Settings.', 'warning');
    });
  }

  /* ---------------------------------------------------------------------- */

  function initHashRouting() {
    window.addEventListener('hashchange', handleHash);
    const h = location.hash || '';
    if (h.indexOf('#product/') === 0 || h.indexOf('#category/') === 0) {
      handleHash();
    } else {
      lastNavHash = h;
    }
  }

  function handleHash() {
    const h = location.hash || '';

    /* Product details modal (shareable links like #product/nike-air-max). */
    if (h.indexOf('#product/') === 0) {
      const slug = decodeURIComponent(h.slice('#product/'.length));
      Prods.openBySlug(slug);
      return;
    }

    /* Category filter. "all" clears the filter. */
    if (h.indexOf('#category/') === 0) {
      const slug = decodeURIComponent(h.slice('#category/'.length));
      Cats.select(slug || 'all');
      const catalog = document.getElementById('catalog');
      if (catalog) catalog.scrollIntoView({ behavior: 'smooth' });
      lastNavHash = h;
      return;
    }

    /* Plain section links (#catalog, #contact, ...). */
    lastNavHash = h;
  }

  /* When the product modal closes, restore the URL to the previous view. */
  const modalEl = document.getElementById('productModal');
  if (modalEl) {
    modalEl.addEventListener('hidden.bs.modal', () => {
      if ((location.hash || '').indexOf('#product/') === 0) {
        history.replaceState(null, '', location.pathname + location.search + lastNavHash);
      }
    });
  }
})();
