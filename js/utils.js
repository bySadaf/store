/* ==========================================================================
   SHARED HELPERS
   --------------------------------------------------------------------------
   Exposes: U (utilities) and SiteState (simple in-memory store)
   Depends on: js/config.js
   ========================================================================== */

/* In-memory store shared across the public site modules. */
const SiteState = {
  settings: null,   // row from site_settings (snake_case columns)
  categories: []    // active categories from the categories table
};

const U = {

  /* Escape untrusted text before inserting it into HTML. */
  esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  },

  /* Format a price, e.g. 8500 -> "Rs. 8,500" */
  money(price) {
    const n = Number(price);
    if (!Number.isFinite(n)) return 'Price on request';
    const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return (SITE_CONFIG.currency + ' ' + formatted).trim();
  },

  /* Shorten long text for product cards. */
  truncate(text, max) {
    const t = String(text == null ? '' : text).trim().replace(/\s+/g, ' ');
    if (t.length <= max) return t;
    return t.slice(0, max - 1).trimEnd() + '\u2026';
  },

  /* Delay a function until the user stops typing. */
  debounce(fn, ms) {
    ms = ms || 300;
    let timer = null;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(null, args), ms);
    };
  },

  /* "Nike Air Max!" -> "nike-air-max" (used for shareable product links). */
  slugify(text) {
    const s = String(text == null ? '' : text)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .trim();
    return s || 'item';
  },

  /* Random lowercase string, used for unique image file names. */
  rand(length) {
    length = length || 6;
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  },

  /* Path to the placeholder image.
     Public pages: U.placeholder() -> 'assets/images/placeholder.svg'
     Admin pages:  U.placeholder('../') -> '../assets/images/placeholder.svg' */
  placeholder(base) {
    return (base || '') + 'assets/images/placeholder.svg';
  },

  /* Path of a file inside the storage bucket, derived from its public URL.
     Returns null for foreign or malformed URLs. Used to clean up images. */
  storagePathFromUrl(url, bucket) {
    bucket = bucket || SITE_CONFIG.storageBucket;
    try {
      const marker = '/object/public/' + bucket + '/';
      const s = String(url || '');
      const i = s.indexOf(marker);
      if (i === -1) return null;
      return s.substring(i + marker.length).split('?')[0] || null;
    } catch (e) {
      return null;
    }
  },

  /* Small dismissible toast notification. type: success|danger|warning|info */
  toast(message, type) {
    type = type || 'info';
    let box = document.getElementById('toastContainer');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toastContainer';
      box.className = 'toast-container';
      document.body.appendChild(box);
    }
    const colors = { success: 'var(--whatsapp-color)', danger: 'var(--danger-color)', warning: 'var(--secondary-color)', info: 'var(--primary-color)' };
    const icons = {
      success: 'bi-check-circle-fill', danger: 'bi-exclamation-octagon-fill',
      warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill'
    };
    const el = document.createElement('div');
    el.className = 'toast-item';
    el.setAttribute('role', 'status');
    el.style.borderLeftColor = colors[type] || colors.info;
    el.innerHTML = '<i class="bi ' + (icons[type] || icons.info) + '"></i><span>' + U.esc(message) + '</span>';
    box.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-out');
      setTimeout(() => el.remove(), 350);
    }, 4200);
  },

  /* Friendly loading state for the public product grid (skeleton cards). */
  skeletonCards(count) {
    let html = '';
    for (let i = 0; i < (count || 8); i++) {
      html += '<div class="col-6 col-md-4 col-lg-3"><div class="skel-card" aria-hidden="true">' +
        '<div class="skel skel-media"></div>' +
        '<div class="skel-body">' +
        '<div class="skel skel-line" style="width:45%"></div>' +
        '<div class="skel skel-line" style="width:85%"></div>' +
        '<div class="skel skel-line" style="width:60%"></div>' +
        '<div class="skel skel-line" style="width:100%;height:34px"></div>' +
        '</div></div></div>';
    }
    return html;
  },

  /* Status message block for the product grid area.
     kind: 'empty' | 'error' | 'info'. retryLabel/callback optional. */
  statusBlock(kind, message, retryLabel, retryCallback) {
    const icons = { empty: 'bi-inbox', error: 'bi-wifi-off', info: 'bi-hourglass-split' };
    const el = document.createElement('div');
    el.className = 'status-block';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<i class="bi ' + (icons[kind] || icons.info) + '"></i>' +
      '<p>' + message + '</p>';
    if (retryLabel && typeof retryCallback === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-outline-secondary btn-sm';
      btn.textContent = retryLabel;
      btn.addEventListener('click', retryCallback);
      el.appendChild(btn);
    }
    return el;
  },

  /* Show / hide the small spinner inside a button while saving. */
  btnLoading(button, loading, busyText) {
    if (!button) return;
    if (loading) {
      button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>' +
        U.esc(busyText || 'Please wait\u2026');
    } else {
      button.disabled = false;
      if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
    }
  },

  /* Validate an image File chosen in the admin panel.
     Returns an error message string, or null when the file is accepted. */
  validateImageFile(file) {
    if (!file) return null;
    const okTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const okExtensions = /\.(jpe?g|png|webp)$/i;
    if (okTypes.indexOf(file.type) === -1 && !okExtensions.test(file.name)) {
      return 'Please choose a JPG, PNG or WebP image.';
    }
    if (file.size > SITE_CONFIG.maxImageMB * 1024 * 1024) {
      return 'That image is too large. Please use an image smaller than ' + SITE_CONFIG.maxImageMB + ' MB.';
    }
    return null;
  },

  /* Read a local File into a data URL for the admin image preview. */
  previewFile(file, imgElement) {
    const reader = new FileReader();
    reader.onload = (e) => { imgElement.src = e.target.result; };
    reader.onerror = () => { U.toast('Could not show the image preview.', 'warning'); };
    reader.readAsDataURL(file);
  }
};
