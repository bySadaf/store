/* ==========================================================================
   CATEGORIES (admin)
   --------------------------------------------------------------------------
   - Add / edit / delete categories, quick activate/deactivate
   - Prevents deleting a category that still contains products
   - Optional category image uploaded to Supabase Storage
   Depends on: ../js/*, js/auth.js
   ========================================================================== */

AdminAuth.ready().then((user) => {
  if (user) init();
});

const AC = {
  items: [],          // all categories (including hidden ones)
  productCounts: {},  // categoryId -> number of products
  editingId: null,
  editingImage: null,
  pendingImage: null,
  deleteId: null
};

/* ------------------------------ Init --------------------------------------- */

async function init() {
  document.getElementById('addCategoryBtn').addEventListener('click', openAdd);
  document.getElementById('categoriesTableBody').addEventListener('click', onTableClick);
  document.getElementById('categoriesTableBody').addEventListener('change', onTableToggle);
  document.getElementById('categoryForm').addEventListener('submit', saveCategory);
  document.getElementById('cfImage').addEventListener('change', onImageChosen);
  document.getElementById('confirmCatDeleteBtn').addEventListener('click', confirmDelete);

  await load();

  /* Dashboard quick action: categories.html?add=1 */
  if (new URLSearchParams(location.search).get('add') === '1') openAdd();
}

/* ------------------------------ Load ---------------------------------------- */

async function load() {
  const body = document.getElementById('categoriesTableBody');
  body.innerHTML = '<tr><td colspan="6" class="table-loading"><div class="spinner-border text-primary" role="status"></div></td></tr>';

  try {
    const [{ data: cats, error: catsError }, { data: prods, error: prodsError }] = await Promise.all([
      DB.client().from('categories').select('*').order('name'),
      DB.client().from('products').select('category_id')
    ]);

    if (catsError) throw catsError;
    if (prodsError) throw prodsError;

    AC.items = cats || [];

    /* Count products per category (all products, including hidden ones). */
    AC.productCounts = {};
    (prods || []).forEach((p) => {
      if (p.category_id) AC.productCounts[p.category_id] = (AC.productCounts[p.category_id] || 0) + 1;
    });

    renderRows();
  } catch (err) {
    console.error('Categories load failed:', err);
    body.innerHTML = '<tr><td colspan="6" class="empty-table"><i class="bi bi-wifi-off"></i>' +
      '<p class="mb-2">' + U.esc(DB.friendlyError(err, 'Could not load the categories.')) + '</p></td></tr>';
  }
}

function renderRows() {
  const body = document.getElementById('categoriesTableBody');

  if (!AC.items.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-table"><i class="bi bi-tags"></i>' +
      '<p class="mb-0">No categories yet. Click <strong>Add Category</strong> to create your first one.</p></td></tr>';
    return;
  }

  const ph = U.placeholder('../');
  body.innerHTML = AC.items.map((c) => {
    const img = c.image_url ? U.esc(c.image_url) : ph;
    const count = AC.productCounts[c.id] || 0;
    return '<tr data-id="' + U.esc(c.id) + '">' +
      '<td><img class="thumb" src="' + img + '" alt="' + U.esc(c.name) + '" loading="lazy" ' +
      'onerror="this.onerror=null;this.src=\'' + ph + '\'"></td>' +
      '<td><div class="cell-name">' + U.esc(c.name) + '</div></td>' +
      '<td class="text-muted">' + U.esc(U.truncate(c.description, 70)) + '</td>' +
      '<td><span class="badge-soft-muted">' + count + ' product' + (count === 1 ? '' : 's') + '</span></td>' +
      '<td><div class="form-check form-switch m-0"><input class="form-check-input toggle-active" type="checkbox" role="switch" ' +
      (c.active ? 'checked' : '') + ' data-id="' + U.esc(c.id) + '" aria-label="Show or hide ' + U.esc(c.name) + '"></div></td>' +
      '<td class="text-nowrap">' +
      '<button type="button" class="btn btn-sm btn-outline-primary btn-edit" data-id="' + U.esc(c.id) + '"><i class="bi bi-pencil"></i> Edit</button> ' +
      '<button type="button" class="btn btn-sm btn-outline-danger btn-delete" data-id="' + U.esc(c.id) + '"><i class="bi bi-trash"></i> Delete</button>' +
      '</td></tr>';
  }).join('');
}

/* ------------------------------ Row actions --------------------------------- */

function onTableClick(e) {
  const editBtn = e.target.closest('.btn-edit');
  if (editBtn) {
    const cat = AC.items.find((c) => c.id === editBtn.dataset.id);
    if (cat) openEdit(cat);
    return;
  }

  const deleteBtn = e.target.closest('.btn-delete');
  if (deleteBtn) {
    const cat = AC.items.find((c) => c.id === deleteBtn.dataset.id);
    if (cat) openDelete(cat);
  }
}

function onTableToggle(e) {
  const toggle = e.target.closest('.toggle-active');
  if (toggle) {
    const cat = AC.items.find((c) => c.id === toggle.dataset.id);
    if (cat) quickUpdate(cat, { active: toggle.checked });
  }
}

async function quickUpdate(cat, patch) {
  try {
    const { error } = await DB.client().from('categories').update(patch).eq('id', cat.id);
    if (error) throw error;
    Object.assign(cat, patch);
    U.toast('Saved.', 'success');
  } catch (err) {
    console.error('Quick update failed:', err);
    U.toast(DB.friendlyError(err, 'Could not save the change.'), 'danger');
    load();
  }
}

/* ------------------------------ Add / Edit modal ------------------------------ */

function resetForm() {
  document.getElementById('categoryForm').reset();
  document.getElementById('cfId').value = '';
  document.getElementById('cfNameError').style.display = 'none';
  document.getElementById('cfNameDuplicate').style.display = 'none';
  document.getElementById('cfImageError').classList.remove('visible');
  document.getElementById('cfImagePreview').src = U.placeholder('../');
  document.getElementById('cfCurrentWrap').classList.add('d-none');
  document.getElementById('cfCurrentImg').src = '';
  document.getElementById('cfName').classList.remove('is-invalid');
  AC.pendingImage = null;
  AC.editingImage = null;
  AC.editingId = null;
}

function openAdd() {
  resetForm();
  document.getElementById('categoryModalTitle').textContent = 'Add Category';
  document.getElementById('cfSaveBtn').innerHTML = '<i class="bi bi-check-lg me-1"></i>Save Category';
  document.getElementById('cfActive').checked = true;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('categoryModal')).show();
}

function openEdit(c) {
  resetForm();
  AC.editingId = c.id;
  AC.editingImage = c.image_url || null;

  document.getElementById('categoryModalTitle').textContent = 'Edit Category';
  document.getElementById('cfSaveBtn').innerHTML = '<i class="bi bi-check-lg me-1"></i>Save Changes';
  document.getElementById('cfName').value = c.name || '';
  document.getElementById('cfDescription').value = c.description || '';
  document.getElementById('cfActive').checked = !!c.active;

  if (c.image_url) {
    document.getElementById('cfCurrentImg').src = c.image_url;
    document.getElementById('cfCurrentWrap').classList.remove('d-none');
    document.getElementById('cfImagePreview').src = c.image_url;
  }

  bootstrap.Modal.getOrCreateInstance(document.getElementById('categoryModal')).show();
}

function onImageChosen(e) {
  const file = e.target.files && e.target.files[0];
  const errEl = document.getElementById('cfImageError');
  errEl.classList.remove('visible');
  AC.pendingImage = null;

  if (!file) return;

  const problem = U.validateImageFile(file);
  if (problem) {
    errEl.textContent = problem;
    errEl.classList.add('visible');
    e.target.value = '';
    document.getElementById('cfImagePreview').src = AC.editingImage || U.placeholder('../');
    return;
  }

  AC.pendingImage = file;
  U.previewFile(file, document.getElementById('cfImagePreview'));
}

/* ------------------------------ Save ------------------------------------------ */

async function saveCategory(e) {
  e.preventDefault();

  const nameInput = document.getElementById('cfName');
  const name = nameInput.value.trim();
  const nameError = document.getElementById('cfNameError');
  const nameDup = document.getElementById('cfNameDuplicate');

  nameError.style.display = 'none';
  nameDup.style.display = 'none';
  nameInput.classList.remove('is-invalid');

  if (!name) {
    nameError.style.display = 'block';
    nameInput.classList.add('is-invalid');
    return;
  }

  /* Duplicate check (case-insensitive, ignores the category being edited). */
  const duplicate = AC.items.some((c) =>
    c.id !== AC.editingId && String(c.name).toLowerCase() === name.toLowerCase());
  if (duplicate) {
    nameDup.style.display = 'block';
    nameInput.classList.add('is-invalid');
    return;
  }

  const saveBtn = document.getElementById('cfSaveBtn');
  U.btnLoading(saveBtn, true, 'Saving\u2026');

  try {
    /* Upload image first (if chosen). */
    let imageUrl = AC.editingImage;
    let uploadedNewPath = null;

    if (AC.pendingImage) {
      const uploaded = await uploadImage(AC.pendingImage, 'categories');
      imageUrl = uploaded.url;
      uploadedNewPath = uploaded.path;
    }

    const row = {
      name: name,
      description: document.getElementById('cfDescription').value.trim() || null,
      active: document.getElementById('cfActive').checked,
      image_url: imageUrl
    };

    try {
      if (AC.editingId) {
        const { error } = await DB.client().from('categories').update(row).eq('id', AC.editingId);
        if (error) throw error;
      } else {
        await insertCategory(row);
      }
    } catch (err) {
      if (uploadedNewPath) removeStorageFile(uploadedNewPath);
      /* 23505 here almost always means the name/slug already exists. */
      if (err && err.code === '23505') {
        nameDup.style.display = 'block';
        nameInput.classList.add('is-invalid');
        throw new Error('A category with this name already exists.');
      }
      throw err;
    }

    /* Clean up the replaced image. */
    if (AC.editingId && AC.pendingImage && AC.editingImage) {
      removeOldImage(AC.editingImage);
    }

    U.toast('Category saved. The website is updated.', 'success');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('categoryModal')).hide();
    resetForm();
    load();
  } catch (err) {
    console.error('Save category failed:', err);
    U.toast(err.message || DB.friendlyError(err, 'Could not save the category. Please try again.'), 'danger');
  } finally {
    U.btnLoading(saveBtn, false);
  }
}

async function insertCategory(row) {
  const base = U.slugify(row.name);
  const candidates = [base, base + '-2', base + '-3', base + '-4', base + '-' + U.rand(4)];

  let lastError = null;
  for (const slug of candidates) {
    const { error } = await DB.client().from('categories').insert(Object.assign({}, row, { slug: slug }));
    if (!error) return;
    lastError = error;
    if (error.code !== '23505') throw error;
  }
  throw lastError;
}

/* ------------------------------ Image helpers ---------------------------------- */

async function uploadImage(file, folder) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/jpeg$/, 'jpg');
  const path = folder + '/' + Date.now() + '-' + U.rand(6) + '.' + ext;

  const { error } = await DB.client()
    .storage
    .from(SITE_CONFIG.storageBucket)
    .upload(path, file, { contentType: file.type, cacheControl: '3600' });

  if (error) {
    console.error('Image upload failed:', error);
    throw new Error('The image could not be uploaded. Please try again.');
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
  DB.client()
    .storage
    .from(SITE_CONFIG.storageBucket)
    .remove([path])
    .catch((err) => console.warn('Could not remove old image:', err && err.message));
}

/* ------------------------------ Delete ------------------------------------------ */

function openDelete(c) {
  AC.deleteId = c.id;
  const count = AC.productCounts[c.id] || 0;
  const message = document.getElementById('catDeleteMessage');
  const confirmBtn = document.getElementById('confirmCatDeleteBtn');

  if (count > 0) {
    /* Blocked: the category still has products. */
    message.innerHTML =
      '<div class="alert alert-warning mb-0 d-flex gap-2">' +
      '<i class="bi bi-exclamation-triangle-fill mt-1"></i><div>' +
      'This category still contains <strong>' + count + ' product' + (count === 1 ? '' : 's') +
      '</strong>. Please move or delete those products first, then try again.</div></div>';
    confirmBtn.disabled = true;
  } else {
    message.innerHTML =
      '<p>Are you sure you want to delete this category?</p>' +
      '<p class="mb-0"><strong>' + U.esc(c.name) + '</strong></p>' +
      '<p class="form-hint mt-2 mb-0">This cannot be undone.</p>';
    confirmBtn.disabled = false;
  }

  bootstrap.Modal.getOrCreateInstance(document.getElementById('catDeleteModal')).show();
}

async function confirmDelete() {
  if (!AC.deleteId) return;

  const btn = document.getElementById('confirmCatDeleteBtn');
  U.btnLoading(btn, true, 'Deleting\u2026');

  try {
    const { error } = await DB.client().from('categories').delete().eq('id', AC.deleteId);
    if (error) throw error;

    const cat = AC.items.find((c) => c.id === AC.deleteId);
    if (cat && cat.image_url) removeOldImage(cat.image_url);

    U.toast('Category deleted.', 'success');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('catDeleteModal')).hide();
    AC.deleteId = null;
    load();
  } catch (err) {
    console.error('Delete category failed:', err);
    U.toast(DB.friendlyError(err, 'Could not delete the category. Please try again.'), 'danger');
  } finally {
    U.btnLoading(btn, false);
    document.getElementById('confirmCatDeleteBtn').disabled = false;
  }
}
