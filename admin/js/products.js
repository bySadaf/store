/* ==========================================================================
   PRODUCTS (admin)
   --------------------------------------------------------------------------
   - Table with pagination + search + category filter
   - Add / edit / delete products (Bootstrap modals, multi-image upload)
   - Photos are uploaded to Supabase Storage; their public URLs are saved in
     the products table (image_urls array + image_url cover). Replaced or
     removed photos are cleaned up from storage.
   Depends on: ../js/*, js/auth.js
   ========================================================================== */

AdminAuth.ready().then((user) => {
  if (user) init();
});

const AP = {
  perPage: 10,
  page: 0,
  total: 0,
  search: '',
  categoryId: '',
  items: [],
  categories: [],
  editingId: null,       // product id being edited, or null when adding
  gallery: [],           // photos in the form: [{ url: '...' }] (saved) or [{ file: File }] (new)
  originalUrls: [],      // photo URLs of the product when editing started (for cleanup)
  deleteId: null
};

const MAX_IMAGES = SITE_CONFIG.maxImagesPerProduct || 8;

/* All saved photo URLs of a product (gallery array, or the legacy single
   image_url when the product has no gallery yet). */
function productImageUrls(p) {
  const arr = (p && p.image_urls && p.image_urls.length) ? p.image_urls : [];
  if (arr.length) return arr.slice();
  return (p && p.image_url) ? [p.image_url] : [];
}

/* ------------------------------ Init -------------------------------------- */

async function init() {
  document.getElementById('addProductBtn').addEventListener('click', openAdd);
  document.getElementById('productsSearch').addEventListener('input', U.debounce((e) => {
    AP.search = e.target.value.trim();
    AP.page = 0;
    load();
  }, 350));

  document.getElementById('productsCategoryFilter').addEventListener('change', (e) => {
    AP.categoryId = e.target.value;
    AP.page = 0;
    load();
  });

  document.getElementById('paginationPrev').addEventListener('click', () => {
    if (AP.page > 0) { AP.page--; load(); }
  });
  document.getElementById('paginationNext').addEventListener('click', () => {
    if ((AP.page + 1) * AP.perPage < AP.total) { AP.page++; load(); }
  });

  document.getElementById('productsTableBody').addEventListener('click', onTableClick);
  document.getElementById('productsTableBody').addEventListener('change', onTableToggle);

  document.getElementById('productForm').addEventListener('submit', saveProduct);
  document.getElementById('pfImages').addEventListener('change', onImagesChosen);
  document.getElementById('pfGalleryList').addEventListener('click', onGalleryTileClick);
  document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);

  const maxEl = document.getElementById('pfMaxPhotos');
  if (maxEl) maxEl.textContent = String(MAX_IMAGES);

  document.getElementById('currencyLabel').textContent = SITE_CONFIG.currency || 'Rs.';

  await loadCategories();
  await load();

  /* Dashboard quick action: products.html?add=1 opens the form directly. */
  if (new URLSearchParams(location.search).get('add') === '1') openAdd();
}

/* ------------------------------ Categories -------------------------------- */

async function loadCategories() {
  try {
    const { data, error } = await DB.client()
      .from('categories')
      .select('id, name, slug')
      .order('name');

    if (error) throw error;
    AP.categories = data || [];

    /* Dropdown inside the Add/Edit form. */
    const formSelect = document.getElementById('pfCategory');
    const current = formSelect.value;
    formSelect.innerHTML = '<option value="">&mdash; Choose a category &mdash;</option>' +
      AP.categories.map((c) => '<option value="' + U.esc(c.id) + '">' + U.esc(c.name) + '</option>').join('');
    if (current) formSelect.value = current;

    /* Filter dropdown above the table. */
    const filterSelect = document.getElementById('productsCategoryFilter');
    const filterCurrent = filterSelect.value;
    filterSelect.innerHTML = '<option value="">All categories</option>' +
      AP.categories.map((c) => '<option value="' + U.esc(c.id) + '">' + U.esc(c.name) + '</option>').join('');
    if (filterCurrent) filterSelect.value = filterCurrent;
  } catch (err) {
    console.error('Categories load failed:', err);
    U.toast(DB.friendlyError(err, 'Could not load the categories.'), 'danger');
  }
}

/* ------------------------------ Table -------------------------------------- */

async function load() {
  const body = document.getElementById('productsTableBody');
  body.innerHTML = '<tr><td colspan="7" class="table-loading"><div class="spinner-border text-primary" role="status"></div></td></tr>';

  try {
    let q = DB.client()
      .from('products')
      .select('id, name, slug, description, price, image_url, image_urls, active, featured, category_id, categories(name, slug)', { count: 'exact' });

    if (AP.categoryId) q = q.eq('category_id', AP.categoryId);

    const term = String(AP.search || '').replace(/[,()%]/g, ' ').replace(/\s+/g, ' ').trim();
    if (term) q = q.or('name.ilike.%' + term + '%,description.ilike.%' + term + '%');

    q = q.order('created_at', { ascending: false })
      .range(AP.page * AP.perPage, (AP.page + 1) * AP.perPage - 1);

    const { data, error, count } = await q;
    if (error) throw error;

    AP.items = data || [];
    AP.total = (count == null) ? AP.items.length : count;
    renderRows();
    renderPagination();
  } catch (err) {
    console.error('Products load failed:', err);
    body.innerHTML = '<tr><td colspan="7" class="empty-table"><i class="bi bi-wifi-off"></i>' +
      '<p class="mb-2">' + U.esc(DB.friendlyError(err, 'Could not load the products.')) + '</p>' +
      '<button type="button" class="btn btn-outline-app btn-sm" onclick="load()">Try again</button></td></tr>';
    renderPagination();
  }
}

function renderRows() {
  const body = document.getElementById('productsTableBody');

  if (!AP.items.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty-table"><i class="bi bi-box"></i>' +
      '<p class="mb-2">No products found. Click <strong>Add Product</strong> to create your first product.</p></td></tr>';
    return;
  }

  const ph = U.placeholder('../');
  body.innerHTML = AP.items.map((p) => {
    const img = p.image_url ? U.esc(p.image_url) : ph;
    const catCell = (p.categories && p.categories.name)
      ? U.esc(p.categories.name)
      : '<span class="text-muted">No category</span>';
    return '<tr data-id="' + U.esc(p.id) + '">' +
      '<td><img class="thumb" src="' + img + '" alt="' + U.esc(p.name) + '" loading="lazy" ' +
      'onerror="this.onerror=null;this.src=\'' + ph + '\'"></td>' +
      '<td><div class="cell-name">' + U.esc(p.name) + '</div></td>' +
      '<td>' + catCell + '</td>' +
      '<td class="text-nowrap">' + U.money(p.price) + '</td>' +
      '<td><div class="form-check form-switch m-0"><input class="form-check-input toggle-active" type="checkbox" role="switch" ' +
      (p.active ? 'checked' : '') + ' data-id="' + U.esc(p.id) + '" aria-label="Show or hide ' + U.esc(p.name) + '"></div></td>' +
      '<td><button type="button" class="btn btn-star toggle-featured" data-id="' + U.esc(p.id) + '" ' +
      'aria-label="Toggle featured for ' + U.esc(p.name) + '">' +
      (p.featured ? '<i class="bi bi-star-fill text-warning"></i>' : '<i class="bi bi-star text-muted"></i>') +
      '</button></td>' +
      '<td class="text-nowrap">' +
      '<button type="button" class="btn btn-sm btn-outline-primary btn-edit" data-id="' + U.esc(p.id) + '"><i class="bi bi-pencil"></i> Edit</button> ' +
      '<button type="button" class="btn btn-sm btn-outline-danger btn-delete" data-id="' + U.esc(p.id) + '"><i class="bi bi-trash"></i> Delete</button>' +
      '</td></tr>';
  }).join('');
}

function renderPagination() {
  const from = AP.total === 0 ? 0 : AP.page * AP.perPage + 1;
  const to = Math.min((AP.page + 1) * AP.perPage, AP.total);
  document.getElementById('pageInfo').textContent =
    AP.total ? 'Showing ' + from + '\u2013' + to + ' of ' + AP.total + ' products' : '';

  document.getElementById('paginationPrev').disabled = AP.page === 0;
  document.getElementById('paginationNext').disabled = (AP.page + 1) * AP.perPage >= AP.total;
}

/* ------------------------------ Row actions -------------------------------- */

function onTableClick(e) {
  const editBtn = e.target.closest('.btn-edit');
  if (editBtn) {
    const product = AP.items.find((p) => p.id === editBtn.dataset.id);
    if (product) openEdit(product);
    return;
  }

  const deleteBtn = e.target.closest('.btn-delete');
  if (deleteBtn) {
    const product = AP.items.find((p) => p.id === deleteBtn.dataset.id);
    if (product) openDelete(product);
    return;
  }

  const featuredBtn = e.target.closest('.toggle-featured');
  if (featuredBtn) {
    const product = AP.items.find((p) => p.id === featuredBtn.dataset.id);
    if (product) quickUpdate(product, { featured: !product.featured });
  }
}

function onTableToggle(e) {
  const toggle = e.target.closest('.toggle-active');
  if (toggle) {
    const product = AP.items.find((p) => p.id === toggle.dataset.id);
    if (product) quickUpdate(product, { active: toggle.checked });
  }
}

async function quickUpdate(product, patch) {
  try {
    const { error } = await DB.client().from('products').update(patch).eq('id', product.id);
    if (error) throw error;
    Object.assign(product, patch);
    renderRows();
    U.toast('Saved.', 'success');
  } catch (err) {
    console.error('Quick update failed:', err);
    U.toast(DB.friendlyError(err, 'Could not save the change.'), 'danger');
    load();
  }
}

/* ------------------------------ Add / Edit modal ---------------------------- */

function resetForm() {
  const form = document.getElementById('productForm');
  form.reset();
  clearFieldErrors();
  document.getElementById('pfId').value = '';
  AP.gallery = [];
  AP.originalUrls = [];
  AP.editingId = null;
  renderGalleryEditor();
}

function openAdd() {
  resetForm();
  document.getElementById('productModalTitle').textContent = 'Add Product';
  document.getElementById('pfSaveBtn').innerHTML = '<i class="bi bi-check-lg me-1"></i>Save Product';
  document.getElementById('pfActive').checked = true;
  document.getElementById('pfFeatured').checked = false;
  document.getElementById('pfCategory').value = '';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('productModal')).show();
}

function openEdit(p) {
  resetForm();
  AP.editingId = p.id;
  AP.originalUrls = productImageUrls(p);
  AP.gallery = AP.originalUrls.map((url) => ({ url: url }));

  document.getElementById('productModalTitle').textContent = 'Edit Product';
  document.getElementById('pfSaveBtn').innerHTML = '<i class="bi bi-check-lg me-1"></i>Save Changes';
  document.getElementById('pfName').value = p.name || '';
  document.getElementById('pfPrice').value = p.price == null ? '' : p.price;
  document.getElementById('pfCategory').value = p.category_id || '';
  document.getElementById('pfDescription').value = p.description || '';
  document.getElementById('pfActive').checked = !!p.active;
  document.getElementById('pfFeatured').checked = !!p.featured;

  renderGalleryEditor();

  bootstrap.Modal.getOrCreateInstance(document.getElementById('productModal')).show();
}

/* ------------------------------ Photo editor ------------------------------- */

function onImagesChosen(e) {
  const files = Array.from(e.target.files || []);
  const errEl = document.getElementById('pfImagesError');
  errEl.classList.remove('visible');
  e.target.value = ''; /* allow re-picking the same file later */

  if (!files.length) return;

  const room = MAX_IMAGES - AP.gallery.length;
  if (room <= 0) {
    errEl.textContent = 'This product already has the maximum of ' + MAX_IMAGES + ' photos. Remove one first to add another.';
    errEl.classList.add('visible');
    return;
  }

  let added = 0;
  let rejected = 0;
  for (const file of files) {
    if (added >= room) break;
    const problem = U.validateImageFile(file);
    if (problem) {
      rejected++;
      continue;
    }
    AP.gallery.push({ url: null, file: file });
    added++;
  }

  if (rejected) {
    U.toast(rejected + (rejected === 1 ? ' file was' : ' files were') +
      ' skipped. Only JPG, PNG or WebP images under ' + SITE_CONFIG.maxImageMB + ' MB are allowed.', 'warning');
  }
  if (files.length > room) {
    errEl.textContent = 'A product can have up to ' + MAX_IMAGES + ' photos. Only the first ' + room +
      (room === 1 ? ' photo was' : ' photos were') + ' added.';
    errEl.classList.add('visible');
  }

  renderGalleryEditor();
}

function onGalleryTileClick(e) {
  const btn = e.target.closest('button[data-index]');
  if (!btn) return;
  const i = Number(btn.dataset.index);
  if (Number.isNaN(i) || !AP.gallery[i]) return;

  if (btn.classList.contains('img-remove')) {
    AP.gallery.splice(i, 1);
  } else if (btn.classList.contains('img-move-left') && i > 0) {
    const item = AP.gallery.splice(i, 1)[0];
    AP.gallery.splice(i - 1, 0, item);
  } else if (btn.classList.contains('img-move-right') && i < AP.gallery.length - 1) {
    const item = AP.gallery.splice(i, 1)[0];
    AP.gallery.splice(i + 1, 0, item);
  } else {
    return;
  }
  renderGalleryEditor();
}

function renderGalleryEditor() {
  const list = document.getElementById('pfGalleryList');
  const empty = document.getElementById('pfGalleryEmpty');
  if (!list) return;

  empty.classList.toggle('d-none', AP.gallery.length > 0);
  list.innerHTML = '';

  AP.gallery.forEach((entry, i) => {
    const tile = document.createElement('div');
    tile.className = 'img-item';
    tile.innerHTML =
      (i === 0 ? '<span class="img-cover-badge">Cover</span>' : '') +
      (entry.file ? '<span class="img-new-badge">New</span>' : '') +
      '<div class="img-thumb-box"><img alt="Photo ' + (i + 1) + '"></div>' +
      '<div class="img-actions">' +
      (i > 0 ? '<button type="button" class="img-move-left" data-index="' + i + '" aria-label="Move photo ' + (i + 1) + ' earlier"><i class="bi bi-chevron-left"></i></button>' : '') +
      (i < AP.gallery.length - 1 ? '<button type="button" class="img-move-right" data-index="' + i + '" aria-label="Move photo ' + (i + 1) + ' later"><i class="bi bi-chevron-right"></i></button>' : '') +
      '<button type="button" class="img-remove" data-index="' + i + '" aria-label="Remove photo ' + (i + 1) + '"><i class="bi bi-x-lg"></i></button>' +
      '</div>';
    const img = tile.querySelector('img');
    if (entry.file) {
      U.previewFile(entry.file, img);
    } else {
      img.src = entry.url;
    }
    list.appendChild(tile);
  });
}

/* ------------------------------ Save ---------------------------------------- */

function clearFieldErrors() {
  ['pfNameError', 'pfPriceError', 'pfCategoryError'].forEach((id) => {
    const el = document.getElementById(id);
    el.classList.remove('visible');
  });
  ['pfName', 'pfPrice', 'pfCategory'].forEach((id) => {
    document.getElementById(id).classList.remove('is-invalid');
  });
  document.getElementById('pfImagesError').classList.remove('visible');
}

function validateForm(values) {
  clearFieldErrors();
  let ok = true;

  if (!values.name) {
    showFieldError('pfName', 'pfNameError');
    ok = false;
  }
  const price = Number(values.price);
  if (values.price === '' || values.price == null || !Number.isFinite(price) || price < 0) {
    showFieldError('pfPrice', 'pfPriceError');
    ok = false;
  }
  if (!values.category_id) {
    showFieldError('pfCategory', 'pfCategoryError');
    ok = false;
  }
  return ok;
}

function showFieldError(inputId, errorId) {
  document.getElementById(inputId).classList.add('is-invalid');
  document.getElementById(errorId).classList.add('visible');
}

async function saveProduct(e) {
  e.preventDefault();

  const values = {
    name: document.getElementById('pfName').value.trim(),
    price: document.getElementById('pfPrice').value,
    category_id: document.getElementById('pfCategory').value,
    description: document.getElementById('pfDescription').value.trim(),
    active: document.getElementById('pfActive').checked,
    featured: document.getElementById('pfFeatured').checked
  };

  if (!validateForm(values)) return;

  const saveBtn = document.getElementById('pfSaveBtn');
  U.btnLoading(saveBtn, true, 'Saving\u2026');

  /* Photos uploaded during THIS save (rolled back if the save fails). */
  const uploads = []; /* { entry, path } */

  try {
    /* 1. Upload the newly chosen photos and get their public URLs. */
    try {
      for (const entry of AP.gallery) {
        if (entry.file && !entry.url) {
          const uploaded = await uploadImage(entry.file, 'products');
          entry.url = uploaded.url;
          uploads.push({ entry: entry, path: uploaded.path });
        }
      }
    } catch (upErr) {
      rollbackUploads(uploads);
      throw upErr;
    }

    /* 2. Save the product row. The first photo is the cover image. */
    const urls = AP.gallery.map((entry) => entry.url).filter(Boolean);
    const row = {
      name: values.name,
      description: values.description || null,
      price: Number(values.price),
      category_id: values.category_id,
      active: values.active,
      featured: values.featured,
      image_url: urls[0] || null,
      image_urls: urls
    };

    try {
      if (AP.editingId) {
        await updateProduct(AP.editingId, row);
      } else {
        await insertProduct(row);
      }
    } catch (err) {
      /* Roll back the uploads so no orphan images stay in storage. */
      rollbackUploads(uploads);
      throw err;
    }

    /* 3. Clean up photos that were removed or replaced (best effort). */
    if (AP.editingId) {
      const kept = new Set(urls);
      AP.originalUrls.forEach((url) => {
        if (!kept.has(url)) removeOldImage(url);
      });
    }

    U.toast('Product saved. The website is updated.', 'success');

    const wasEditing = !!AP.editingId;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('productModal')).hide();
    resetForm();
    if (!wasEditing) AP.page = 0; /* show the newest product */
    load();
  } catch (err) {
    console.error('Save product failed:', err);
    const msg = (err && err.code === '23503')
      ? 'The chosen category no longer exists. Please reload the page and pick another one.'
      : DB.friendlyError(err, 'Could not save the product. Please try again.');
    U.toast(msg, 'danger');
  } finally {
    U.btnLoading(saveBtn, false);
  }
}

function rollbackUploads(uploads) {
  uploads.forEach((u) => {
    u.entry.url = null; /* the file will be uploaded again on the next try */
    removeStorageFile(u.path);
  });
}

async function insertProduct(row) {
  /* Try a few slugs in case another product already uses the same name. */
  const base = U.slugify(row.name);
  const candidates = [base, base + '-2', base + '-3', base + '-4', base + '-' + U.rand(4)];

  let lastError = null;
  for (const slug of candidates) {
    const { error } = await DB.client().from('products').insert(Object.assign({}, row, { slug: slug }));
    if (!error) return;
    lastError = error;
    if (error.code !== '23505') throw error; /* only retry on duplicate slug */
  }
  throw lastError;
}

async function updateProduct(id, row) {
  const { error } = await DB.client().from('products').update(row).eq('id', id);
  if (error) throw error;
}

/* ------------------------------ Image helpers ------------------------------- */

async function uploadImage(file, folder) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/jpeg$/, 'jpg');
  const path = folder + '/' + Date.now() + '-' + U.rand(6) + '.' + ext;

  const { error } = await DB.client()
    .storage
    .from(SITE_CONFIG.storageBucket)
    .upload(path, file, { contentType: file.type, cacheControl: '3600' });

  if (error) {
    console.error('Image upload failed:', error);
    const friendly = DB.friendlyError(error, 'The image could not be uploaded. Please try again.');
    const e = new Error(friendly);
    e.userMessage = friendly;
    throw e;
  }

  const { data } = await DB.client()
    .storage
    .from(SITE_CONFIG.storageBucket)
    .getPublicUrl(path);

  return { url: data.publicUrl, path: path };
}

function removeOldImage(url) {
  const path = U.storagePathFromUrl(url);
  if (path) removeStorageFile(path);
}

function removeStorageFile(path) {
  /* Best effort: a leftover file is harmless, so failures are ignored. */
  DB.client()
    .storage
    .from(SITE_CONFIG.storageBucket)
    .remove([path])
    .catch((err) => console.warn('Could not remove old image:', err && err.message));
}

/* ------------------------------ Delete -------------------------------------- */

function openDelete(p) {
  AP.deleteId = p.id;
  document.getElementById('deleteProductName').textContent = p.name;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('productDeleteModal')).show();
}

async function confirmDelete() {
  if (!AP.deleteId) return;

  const btn = document.getElementById('confirmDeleteBtn');
  U.btnLoading(btn, true, 'Deleting\u2026');

  try {
    const { error } = await DB.client().from('products').delete().eq('id', AP.deleteId);
    if (error) throw error;

    const item = AP.items.find((p) => p.id === AP.deleteId);
    if (item) {
      productImageUrls(item).forEach((url) => removeOldImage(url));
    }

    U.toast('Product deleted.', 'success');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('productDeleteModal')).hide();

    if (AP.items.length === 1 && AP.page > 0) AP.page--; /* step back a page */
    AP.deleteId = null;
    load();
  } catch (err) {
    console.error('Delete product failed:', err);
    U.toast(DB.friendlyError(err, 'Could not delete the product. Please try again.'), 'danger');
  } finally {
    U.btnLoading(btn, false);
  }
}
