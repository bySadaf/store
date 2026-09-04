/* ==========================================================================
   DASHBOARD (admin)
   --------------------------------------------------------------------------
   Simple statistics + recently added products.
   Depends on: ../js/*, js/auth.js
   ========================================================================== */

AdminAuth.ready().then((user) => {
  if (user) init(user);
});

async function init(user) {

  /* Personal, friendly welcome. */
  const welcome = document.getElementById('dashWelcome');
  if (welcome && user && user.email) {
    const name = String(user.email).split('@')[0];
    welcome.textContent = 'Welcome back, ' + name.charAt(0).toUpperCase() + name.slice(1);
  }

  await Promise.all([
    loadCounts(),
    loadRecent()
  ]);
}

/* ------------------------- Statistics ------------------------------------- */

async function loadCounts() {
  const ids = {
    statTotalProducts: 'total',
    statActiveProducts: 'active',
    statCategories: 'categories',
    statFeatured: 'featured'
  };

  try {
    const products = DB.client().from('products');
    const categories = DB.client().from('categories');

    const [total, active, cats, featured] = await Promise.all([
      products.select('*', { count: 'exact', head: true }),
      products.select('*', { count: 'exact', head: true }).eq('active', true),
      categories.select('*', { count: 'exact', head: true }),
      products.select('*', { count: 'exact', head: true }).eq('featured', true)
    ]);

    setStat('statTotalProducts', total.count);
    setStat('statActiveProducts', active.count);
    setStat('statCategories', cats.count);
    setStat('statFeatured', featured.count);
  } catch (err) {
    console.error('Dashboard counts failed:', err);
    Object.keys(ids).forEach((id) => setStat(id, '0'));
    U.toast(DB.friendlyError(err, 'Could not load the statistics.'), 'danger');
  }
}

function setStat(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = (value == null) ? '0' : String(value);
}

/* ------------------------- Recent products -------------------------------- */

async function loadRecent() {
  const body = document.getElementById('recentTableBody');
  if (!body) return;

  try {
    const { data, error } = await DB.client()
      .from('products')
      .select('id, name, slug, price, image_url, active, categories(name)')
      .order('created_at', { ascending: false })
      .limit(6);

    if (error) throw error;

    if (!data || !data.length) {
      body.innerHTML =
        '<tr><td colspan="5" class="empty-table">' +
        '<i class="bi bi-box"></i>' +
        '<p class="mb-2">No products yet. Click <strong>Add Product</strong> above to create your first one.</p>' +
        '<a class="btn btn-primary-app btn-sm" href="products.html?add=1">Add Product</a>' +
        '</td></tr>';
      return;
    }

    body.innerHTML = data.map(rowHtml).join('');
  } catch (err) {
    console.error('Recent products failed:', err);
    body.innerHTML =
      '<tr><td colspan="5" class="empty-table"><i class="bi bi-wifi-off"></i>' +
      '<p class="mb-0">Could not load recent products.</p></td></tr>';
  }
}

function rowHtml(p) {
  const img = p.image_url
    ? '<img class="thumb" src="' + U.esc(p.image_url) + '" alt="' + U.esc(p.name) + '" onerror="this.onerror=null;this.src=\'' + U.placeholder('../') + '\'">'
    : '<img class="thumb" src="' + U.placeholder('../') + '" alt="">';

  const status = p.active
    ? '<span class="badge-soft-success">Active</span>'
    : '<span class="badge-soft-muted">Hidden</span>';

  return '<tr>' +
    '<td>' + img + '</td>' +
    '<td class="cell-name">' + U.esc(p.name) + '</td>' +
    '<td>' + U.esc(p.categories ? (p.categories.name || '') : '') + '</td>' +
    '<td>' + U.money(p.price) + '</td>' +
    '<td>' + status + '</td>' +
    '</tr>';
}
