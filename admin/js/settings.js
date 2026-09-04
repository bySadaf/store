/* ==========================================================================
   SETTINGS (admin)
   --------------------------------------------------------------------------
   Loads/saves the single row (id = 1) in the site_settings table.
   Everything the public website shows (business name, hero, contact info,
   WhatsApp number) is controlled from here — no code changes needed.
   Depends on: ../js/*, js/auth.js
   ========================================================================== */

AdminAuth.ready().then((user) => {
  if (user) init();
});

const AS = {
  originalLogo: null,   // current logo_url in the database
  pendingLogo: null,    // newly chosen File, uploaded on save
  removeLogo: false     // true when the admin clicked "Remove logo"
};

/* ------------------------------ Init ---------------------------------------- */

async function init() {
  document.getElementById('settingsForm').addEventListener('submit', saveSettings);
  document.getElementById('sgLogo').addEventListener('change', onLogoChosen);
  document.getElementById('sgLogoRemove').addEventListener('click', () => {
    AS.removeLogo = true;
    AS.pendingLogo = null;
    document.getElementById('sgLogo').value = '';
    document.getElementById('sgLogoCurrentWrap').classList.add('d-none');
    document.getElementById('sgLogoPreview').src = U.placeholder('../');
  });

  await loadSettings();
}

/* ------------------------------ Load ----------------------------------------- */

async function loadSettings() {
  try {
    const { data, error } = await DB.client()
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;

    const s = data || {};
    AS.originalLogo = data ? (data.logo_url || null) : null;
    AS.removeLogo = false;

    document.getElementById('sgBusinessName').value = s.business_name || '';
    document.getElementById('sgWhatsApp').value = s.whatsapp_number || '';
    document.getElementById('sgHeroTitle').value = s.hero_title || '';
    document.getElementById('sgHeroDescription').value = s.hero_description || '';
    document.getElementById('sgPhone').value = s.contact_phone || '';
    document.getElementById('sgEmail').value = s.contact_email || '';
    document.getElementById('sgAddress').value = s.address || '';

    if (AS.originalLogo) {
      document.getElementById('sgLogoPreview').src = AS.originalLogo;
      document.getElementById('sgLogoPreviewSmall').src = AS.originalLogo;
      document.getElementById('sgLogoCurrentWrap').classList.remove('d-none');
    } else {
      document.getElementById('sgLogoPreview').src = U.placeholder('../');
      document.getElementById('sgLogoCurrentWrap').classList.add('d-none');
    }
  } catch (err) {
    console.error('Settings load failed:', err);
    U.toast(DB.friendlyError(err, 'Could not load your settings. Please reload the page.'), 'danger');
  }
}

/* ------------------------------ Logo input ------------------------------------ */

function onLogoChosen(e) {
  const file = e.target.files && e.target.files[0];
  const errEl = document.getElementById('sgLogoError');
  errEl.classList.remove('visible');
  AS.pendingLogo = null;

  if (!file) return;

  const problem = U.validateImageFile(file);
  if (problem) {
    errEl.textContent = problem;
    errEl.classList.add('visible');
    e.target.value = '';
    document.getElementById('sgLogoPreview').src = AS.originalLogo || U.placeholder('../');
    return;
  }

  AS.pendingLogo = file;
  AS.removeLogo = false;
  U.previewFile(file, document.getElementById('sgLogoPreview'));
  document.getElementById('sgLogoCurrentWrap').classList.add('d-none');
}

/* ------------------------------ Save ------------------------------------------ */

async function saveSettings(e) {
  e.preventDefault();
  clearErrors();

  const businessName = document.getElementById('sgBusinessName').value.trim();
  const whatsapp = document.getElementById('sgWhatsApp').value.trim();
  const email = document.getElementById('sgEmail').value.trim();

  let ok = true;

  if (!businessName) {
    show('sgNameError');
    document.getElementById('sgBusinessName').classList.add('is-invalid');
    ok = false;
  }

  if (!whatsapp || !WA.isValidNumber(whatsapp)) {
    show('sgWhatsError');
    document.getElementById('sgWhatsApp').classList.add('is-invalid');
    ok = false;
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    show('sgEmailError');
    document.getElementById('sgEmail').classList.add('is-invalid');
    ok = false;
  }

  if (!ok) return;

  const saveBtn = document.getElementById('sgSaveBtn');
  U.btnLoading(saveBtn, true, 'Saving\u2026');

  try {
    /* Upload the new logo, if one was chosen. */
    let logoUrl = AS.removeLogo ? null : AS.originalLogo;
    let uploadedNewPath = null;

    if (AS.pendingLogo) {
      const uploaded = await uploadImage(AS.pendingLogo, 'settings');
      logoUrl = uploaded.url;
      uploadedNewPath = uploaded.path;
    }

    const row = {
      id: 1,
      business_name: businessName,
      whatsapp_number: whatsapp,
      hero_title: document.getElementById('sgHeroTitle').value.trim() || null,
      hero_description: document.getElementById('sgHeroDescription').value.trim() || null,
      contact_phone: document.getElementById('sgPhone').value.trim() || null,
      contact_email: email || null,
      address: document.getElementById('sgAddress').value.trim() || null,
      logo_url: logoUrl
    };

    try {
      const { error } = await DB.client().from('site_settings').upsert(row, { onConflict: 'id' });
      if (error) throw error;
    } catch (err) {
      if (uploadedNewPath) removeStorageFile(uploadedNewPath);
      throw err;
    }

    /* Clean up the replaced logo. */
    if ((AS.pendingLogo || AS.removeLogo) && AS.originalLogo) {
      removeOldImage(AS.originalLogo);
    }

    AS.originalLogo = logoUrl;
    AS.pendingLogo = null;
    AS.removeLogo = false;

    const note = document.getElementById('settingsSavedNote');
    note.textContent = 'Saved! The website now shows your new details.';
    setTimeout(() => { note.textContent = ''; }, 6000);
    U.toast('Settings saved. The website is updated.', 'success');
  } catch (err) {
    console.error('Settings save failed:', err);
    U.toast(DB.friendlyError(err, 'Could not save your settings. Please try again.'), 'danger');
  } finally {
    U.btnLoading(saveBtn, false);
  }
}

function clearErrors() {
  ['sgNameError', 'sgWhatsError', 'sgEmailError', 'sgLogoError'].forEach((id) => {
    const el = document.getElementById(id);
    if (el.classList) el.classList.remove('visible');
    else el.style.display = 'none';
  });
  ['sgBusinessName', 'sgWhatsApp', 'sgEmail'].forEach((id) => {
    document.getElementById(id).classList.remove('is-invalid');
  });
}

function show(id) {
  const el = document.getElementById(id);
  el.classList.add('visible');
}

/* ------------------------------ Image helpers ----------------------------------- */

async function uploadImage(file, folder) {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/jpeg$/, 'jpg');
  const path = folder + '/' + Date.now() + '-' + U.rand(6) + '.' + ext;

  const { error } = await DB.client()
    .storage
    .from(SITE_CONFIG.storageBucket)
    .upload(path, file, { contentType: file.type, cacheControl: '3600' });

  if (error) {
    console.error('Logo upload failed:', error);
    throw new Error('The logo could not be uploaded. Please try again.');
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
    .catch((err) => console.warn('Could not remove old logo:', err && err.message));
}
