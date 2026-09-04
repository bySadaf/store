/* ==========================================================================
   CATEGORIES (public website)
   --------------------------------------------------------------------------
   Loads active categories from Supabase and renders them as cards.
   Clicking a card filters the product grid (via the #category/<slug> route).
   Exposes: Cats
   Depends on: js/supabase.js, js/utils.js, js/products.js (setCategory)
   ========================================================================== */

const Cats = (function () {

  const state = { active: 'all' }; // 'all' or a category slug

  /* Fetch active categories, ordered by name. */
  async function load() {
    const { data, error } = await DB.client()
      .from('categories')
      .select('id, name, slug, description, image_url')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    SiteState.categories = data || [];
    return SiteState.categories;
  }

  function bySlug(slug) {
    return SiteState.categories.find((c) => c.slug === slug) || null;
  }

  /* Render the category cards, including the "All Products" card. */
  function render() {
    const grid = document.getElementById('categoryGrid');
    if (!grid) return;

    if (!SiteState.categories.length) {
      grid.innerHTML =
        '<div class="col-12">' +
        '<div class="status-block"><i class="bi bi-tags"></i>' +
        '<p>Categories are coming soon. Meanwhile, browse all our products below.</p></div></div>';
      return;
    }

    let html = card({
      slug: 'all',
      name: 'All Products',
      description: 'Browse everything in the store',
      image_url: null
    });

    SiteState.categories.forEach((c) => { html += card(c); });
    grid.innerHTML = html;
  }

  function card(c) {
    const isActive = state.active === c.slug;
    const media = c.image_url
      ? '<img class="cat-thumb" src="' + U.esc(c.image_url) + '" alt="' + U.esc(c.name) + '" loading="lazy" onerror="this.onerror=null;this.style.display=\'none\';this.nextElementSibling.style.display=\'inline-flex\';">' +
        '<span class="cat-icon" style="display:none"><i class="bi bi-collection"></i></span>'
      : '<span class="cat-icon"><i class="bi bi-collection"></i></span>';

    return '<div class="col-6 col-md-4 col-lg-2">' +
      '<a class="cat-card' + (isActive ? ' active' : '') + '" href="#category/' + U.esc(c.slug) + '"' +
      ' aria-label="Show products in ' + U.esc(c.name) + '">' +
      '<span class="cat-check" aria-hidden="true"><i class="bi bi-check-lg"></i></span>' +
      '<span class="cat-top">' + media + '</span>' +
      '<h3 class="cat-name">' + U.esc(c.name) + '</h3>' +
      (c.description ? '<p class="cat-desc">' + U.esc(U.truncate(c.description, 60)) + '</p>' : '') +
      '</a></div>';
  }

  /* Select a category (slug or 'all') and tell the product grid to filter. */
  function select(slug) {
    const cat = (slug === 'all' || !slug) ? null : bySlug(slug);
    state.active = cat ? cat.slug : 'all';
    render();
    Prods.setCategory(cat ? cat.id : null, cat ? cat.name : null);
  }

  /* Show a friendly error inside the categories section. */
  function showError(error) {
    const grid = document.getElementById('categoryGrid');
    if (!grid) return;
    grid.innerHTML =
      '<div class="col-12">' +
      '<div class="status-block"><i class="bi bi-wifi-off"></i>' +
      '<p>We could not load the categories right now. Please reload the page.</p>' +
      '<button type="button" class="btn btn-outline-secondary btn-sm" onclick="location.reload()">Reload page</button>' +
      '</div></div>';
    console.error('Categories load failed:', error);
  }

  return { load, render, select, bySlug, state };
})();
