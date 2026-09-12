/* ==========================================================================
   SITE CONFIGURATION — THE ONLY FILE YOU MUST EDIT
   --------------------------------------------------------------------------
   1. Replace SUPABASE_URL with your Supabase project URL.
      (Supabase Dashboard -> Settings -> API -> Project URL)
      Example: https://abcdefgh12345.supabase.co

   2. Replace SUPABASE_ANON_KEY with your anon (public) key.
      (Supabase Dashboard -> Settings -> API -> Project API keys -> "anon public")

   !! SECURITY !! NEVER put the "service_role" key in this file or anywhere
   in the frontend. The service_role key must stay private. The anon key is
   safe to expose because the database is protected by Row Level Security.
   ========================================================================== */

// const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_URL = 'https://ogchobmsjbokanbyztdy.supabase.co';
// const SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_PUBLIC_KEY_HERE';
const SUPABASE_ANON_KEY = 'sb_publishable_q9rt2mP3U1LsH91yA3D_yg_3G61QJZ9';

/* -------------------------------------------------------------------------
   Optional site behaviour (safe to leave as-is)
   ------------------------------------------------------------------------- */
const SITE_CONFIG = {
  /* Currency symbol shown before prices, e.g. "Rs." -> "Rs. 8,500" */
  currency: 'Rs.',

  /* How many products load at a time on the public website */
  productsPerPage: 12,

  /* Supabase Storage bucket that holds all images.
     Must match the bucket created by database/schema.sql */
  storageBucket: 'product-images',

  /* Maximum image upload size in MB per photo (JPG, PNG, WebP) */
  maxImageMB: 5,

  /* Maximum photos per product. The first photo is the cover shown on
     product cards; all photos appear in the product details pop-up. */
  maxImagesPerProduct: 8,

  /* WhatsApp country code for auto-fixing local numbers that start with 0.
     Example: '92' turns 03001234567 into 923001234567.
     Leave empty ('') to disable. */
  whatsappCountryCode: '',

  /* App name shown in the admin sidebar */
  appName: 'Store Admin',

  /* Fallback values used until the admin saves real values in
     Admin -> Settings (settings are stored in the site_settings table) */
  defaults: {
    business_name: 'My Store',
    logo_url: null,
    whatsapp_number: '',
    hero_title: 'Quality Products, Great Prices',
    hero_description: 'Browse our catalog and message us on WhatsApp to place your order. Fast replies, friendly service.',
    contact_phone: '',
    contact_email: '',
    address: ''
  }
};
