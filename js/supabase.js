/* ==========================================================================
   SUPABASE CLIENT (shared by the public website and the admin panel)
   --------------------------------------------------------------------------
   Depends on: the supabase-js CDN script and js/config.js
   Exposes a single global: DB
   ========================================================================== */

const DB = (function () {

  let _client = null; // lazy-created singleton

  /* True when the placeholders in js/config.js have been replaced. */
  function configured() {
    const url = (typeof SUPABASE_URL !== 'undefined') ? String(SUPABASE_URL).trim() : '';
    const key = (typeof SUPABASE_ANON_KEY !== 'undefined') ? String(SUPABASE_ANON_KEY).trim() : '';
    const badUrl = !url || url.indexOf('YOUR_PROJECT') !== -1 || url.indexOf('your-project') !== -1 || !/^https?:\/\//.test(url);
    const badKey = !key || key.indexOf('YOUR_') !== -1 || key.indexOf('PASTE') !== -1 || key.length < 30;
    return !badUrl && !badKey;
  }

  /* Returns the Supabase client, or null when not configured yet. */
  function client() {
    if (!configured()) return null;
    if (!_client) {
      _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return _client;
  }

  /* Translate raw Supabase/Postgres errors into short, friendly messages.
     Technical details are logged to the console, never shown to visitors. */
  function friendlyError(error, fallback) {
    if (!error) return null;
    if (typeof fallback === 'undefined') fallback = 'Something went wrong. Please try again.';

    const code = error.code || '';
    const msg = String(error.message || '').toLowerCase();
    const status = String(error.status || '');

    if (msg.indexOf('failed to fetch') !== -1 || msg.indexOf('network') !== -1 || msg.indexOf('fetch failed') !== -1) {
      return 'Cannot reach the server. Please check your internet connection and try again.';
    }
    if (code === 'PGRST205' || msg.indexOf('does not exist') !== -1 || msg.indexOf('could not find the table') !== -1) {
      return 'The database is not set up yet. Please run database/schema.sql in the Supabase SQL editor (see README.md).';
    }
    if (code === '23505' || msg.indexOf('duplicate key') !== -1) {
      return 'This record already exists.';
    }
    if (code === '23503' || msg.indexOf('violates foreign key') !== -1) {
      return 'That item is linked to other records, so it cannot be saved or removed this way.';
    }
    if (msg.indexOf('invalid login credentials') !== -1) {
      return 'Incorrect email or password. Please try again.';
    }
    if (msg.indexOf('email not confirmed') !== -1) {
      return 'This account has not been confirmed yet. Confirm the user in Supabase (Authentication -> Users).';
    }
    if (msg.indexOf('signups not allowed') !== -1) {
      return 'New sign-ups are disabled. Create the admin user from the Supabase dashboard.';
    }
    if (msg.indexOf('jwt') !== -1 || msg.indexOf('token') !== -1 || status === '401') {
      return 'Your session has expired. Please log in again.';
    }
    if (msg.indexOf('row-level security') !== -1 || code === '42501' || status === '403') {
      return 'You do not have permission to do this.';
    }
    if (status === '404') {
      return 'The requested item was not found.';
    }
    return fallback;
  }

  return { configured, client, friendlyError };
})();
