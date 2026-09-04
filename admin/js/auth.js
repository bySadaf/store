/* ==========================================================================
   ADMIN AUTH + SHARED SHELL
   --------------------------------------------------------------------------
   - login.html    : handles the sign-in form
   - other pages   : verifies the session, redirects to login.html when
                     missing, then injects the sidebar + topbar shell.
   Every admin page sets <body data-page="..." data-page-title="...">.
   Page scripts wait for:  AdminAuth.ready().then(user => { ... })
   Depends on: ../js/config.js, ../js/supabase.js, ../js/utils.js
   ========================================================================== */

const AdminAuth = (function () {

  const page = document.body.dataset.page || '';       // login | dashboard | products | categories | settings
  const pageTitle = document.body.dataset.pageTitle || 'Admin';

  /* Deferred promise: resolved as soon as the session check finishes.
     Created immediately so page scripts can call ready() at any time. */
  let _resolveReady = null;
  const _readyPromise = new Promise((resolve) => { _resolveReady = resolve; });

  /* ============================ Login page ================================= */

  function initLoginPage() {
    if (!DB.configured()) {
      showConfigBanner();
      const form = document.getElementById('loginForm');
      if (form) {
        const btn = document.getElementById('loginSubmit');
        if (btn) { btn.disabled = true; }
      }
      return;
    }

    /* Already signed in? Go straight to the dashboard. */
    (async () => {
      try {
        const { data } = await DB.client().auth.getSession();
        if (data && data.session) {
          const { data: ud } = await DB.client().auth.getUser();
          if (ud && ud.user) location.replace('index.html');
        }
      } catch (e) { /* stay on the login page */ }
    })();

    const form = document.getElementById('loginForm');
    const toggle = document.getElementById('passwordToggle');
    const passwordInput = document.getElementById('loginPassword');

    if (toggle && passwordInput) {
      toggle.addEventListener('click', () => {
        const show = passwordInput.type === 'password';
        passwordInput.type = show ? 'text' : 'password';
        toggle.innerHTML = show
          ? '<i class="bi bi-eye-slash" aria-hidden="true"></i>'
          : '<i class="bi bi-eye" aria-hidden="true"></i>';
        toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    }

    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      hideLoginError();

      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      if (!email || !password) {
        showLoginError('Please enter your email and password.');
        return;
      }

      const btn = document.getElementById('loginSubmit');
      U.btnLoading(btn, true, 'Signing in\u2026');

      try {
        const { data, error } = await DB.client().auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data || !data.user) throw new Error('No user returned.');
        /* Redirect to the dashboard (relative path works in subfolders). */
        window.location.href = 'index.html';
      } catch (err) {
        console.error('Login failed:', err);
        showLoginError(DB.friendlyError(err, 'Login failed. Please try again.'));
        U.btnLoading(btn, false);
      }
    });
  }

  function showLoginError(message) {
    const box = document.getElementById('loginError');
    if (!box) return;
    box.textContent = message;
    box.classList.remove('d-none');
  }

  function hideLoginError() {
    const box = document.getElementById('loginError');
    if (box) box.classList.add('d-none');
  }

  function showConfigBanner() {
    const box = document.getElementById('loginConfigBanner');
    if (!box) return;
    box.innerHTML =
      '<div class="alert alert-warning d-flex align-items-start gap-2" role="alert">' +
      '<i class="bi bi-exclamation-triangle-fill mt-1"></i><div>' +
      '<strong>Setup needed:</strong> open <code>../js/config.js</code> and paste your Supabase project URL and anon key, then reload this page. ' +
      'See <code>README.md</code> for the full setup guide.</div></div>';
    box.classList.remove('d-none');
  }

  /* ============================ Protected pages ============================ */

  function guard() {
    if (!DB.configured()) {
      /* Without configuration we cannot verify anyone. The login page
         shows the setup banner, so send the user there. */
      location.replace('login.html');
      _resolveReady(null);
      return;
    }

    const client = DB.client();

    (async () => {
      let user = null;

      const { data: sessionData } = await client.auth.getSession();
      if (sessionData && sessionData.session) {
        const { data: userData, error } = await client.auth.getUser();
        if (!error && userData && userData.user) user = userData.user;
      }

      if (!user) {
        location.replace('login.html');
        _resolveReady(null);
        return null;
      }

      buildShell(user);
      _resolveReady(user);
      return user;
    })().catch((err) => {
      console.error('Auth check failed:', err);
      location.replace('login.html');
      _resolveReady(null);
    });

    /* Signed out elsewhere / token revoked -> go back to login. */
    client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') location.replace('login.html');
    });
  }

  /* Build the shared sidebar + topbar around #adminContent. */
  function buildShell(user) {
    const shell = document.getElementById('adminShell');
    const content = document.getElementById('adminContent');
    if (!shell || !content) return;

    const initials = String(user.email || 'A').slice(0, 2).toUpperCase();

    const aside = document.createElement('aside');
    aside.id = 'adminSidebar';
    aside.className = 'admin-sidebar offcanvas-lg offcanvas-start';
    aside.tabIndex = -1;
    aside.setAttribute('aria-label', 'Admin navigation');
    aside.innerHTML = sidebarHtml(page, initials, user.email || '');

    const col = document.createElement('div');
    col.className = 'admin-main-col';

    const topbar = document.createElement('header');
    topbar.className = 'admin-topbar';
    topbar.innerHTML =
      '<button class="btn btn-outline-secondary d-lg-none" type="button" data-bs-toggle="offcanvas" ' +
      'data-bs-target="#adminSidebar" aria-controls="adminSidebar" aria-label="Open menu">' +
      '<i class="bi bi-list"></i></button>' +
      '<h1 class="topbar-title">' + U.esc(pageTitle) + '</h1>' +
      '<div class="topbar-actions">' +
      '<a class="btn btn-outline-app btn-sm d-none d-sm-inline-flex" href="../index.html" target="_blank" rel="noopener noreferrer">' +
      '<i class="bi bi-box-arrow-up-right me-1"></i> View Website</a>' +
      '<a class="btn btn-outline-app btn-sm d-sm-none" href="../index.html" target="_blank" rel="noopener noreferrer" aria-label="View website">' +
      '<i class="bi bi-box-arrow-up-right"></i></a>' +
      '<button type="button" class="btn btn-logout btn-sm" id="topbarLogout" aria-label="Log out">' +
      '<i class="bi bi-box-arrow-right me-1"></i>Logout</button>' +
      '</div>';

    const main = document.createElement('div');
    main.className = 'admin-main';

    content.classList.remove('d-none');
    main.appendChild(content);
    col.appendChild(topbar);
    col.appendChild(main);

    shell.innerHTML = '';
    shell.className = 'admin-flex';
    shell.appendChild(aside);
    shell.appendChild(col);

    const logoutBtn = document.getElementById('sidebarLogout');
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
    const topLogout = document.getElementById('topbarLogout');
    if (topLogout) topLogout.addEventListener('click', doLogout);

    /* Brand the sidebar with the store name from Settings (best effort). */
    DB.client().from('site_settings').select('business_name').eq('id', 1).maybeSingle()
      .then(({ data }) => {
        const brand = document.getElementById('sidebarBrandName');
        if (brand && data && data.business_name) brand.textContent = data.business_name;
      })
      .catch(() => { /* keep the default name */ });

    removeBootOverlay();
  }

  function sidebarHtml(activePage, initials, email) {
    const items = [
      { id: 'dashboard', href: 'index.html', icon: 'bi-speedometer2', label: 'Dashboard' },
      { id: 'products', href: 'products.html', icon: 'bi-box-seam', label: 'Products' },
      { id: 'categories', href: 'categories.html', icon: 'bi-tags', label: 'Categories' },
      { id: 'settings', href: 'settings.html', icon: 'bi-gear', label: 'Settings' }
    ];

    let nav = '<div class="sidebar-brand"><span class="brand-badge"><i class="bi bi-shop"></i></span>' +
      '<span id="sidebarBrandName">' + U.esc(SITE_CONFIG.appName) + '</span></div>';

    nav += '<nav class="admin-nav"><span class="nav-label">Menu</span>';
    items.forEach((item) => {
      const active = item.id === activePage ? ' active' : '';
      const current = item.id === activePage ? ' aria-current="page"' : '';
      nav += '<a class="aside-link' + active + '" href="' + item.href + '"' + current + '>' +
        '<i class="bi ' + item.icon + '" aria-hidden="true"></i>' + item.label + '</a>';
    });
    nav += '</nav>';

    nav += '<div class="sidebar-bottom">' +
      '<div class="sidebar-user"><span class="avatar">' + U.esc(initials) + '</span>' +
      '<span class="email" title="' + U.esc(email) + '">' + U.esc(email) + '</span></div>' +
      '<button type="button" class="aside-link" id="sidebarLogout">' +
      '<i class="bi bi-box-arrow-right" aria-hidden="true"></i>Logout</button>' +
      '</div>';

    return nav;
  }

  async function doLogout() {
    try {
      await DB.client().auth.signOut();
      /* onAuthStateChange also redirects, this is a safety net. */
      window.location.href = 'login.html';
    } catch (err) {
      console.error('Logout failed:', err);
      U.toast('Could not log out. Please try again.', 'danger');
    }
  }

  function removeBootOverlay() {
    const overlay = document.getElementById('bootOverlay');
    if (overlay) overlay.remove();
  }

  /* ============================ Start ====================================== */

  function start() {
    if (page === 'login') {
      initLoginPage();
    } else {
      guard();
    }
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start);
  }

  /* Resolves with the logged-in user, or null after redirecting to login. */
  return { ready: () => _readyPromise };
})();
