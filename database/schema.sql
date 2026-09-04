-- ============================================================================
-- PRODUCT CATALOG — DATABASE SCHEMA
-- ----------------------------------------------------------------------------
-- HOW TO RUN THIS FILE
--   1. Open https://supabase.com and sign in.
--   2. Open your project (or create a new one).
--   3. In the left menu choose  SQL Editor  ->  New query.
--   4. Paste THIS ENTIRE FILE and press  Run.
--
-- The file is safe to run more than once (it will not duplicate data).
--
-- It creates:
--   SECTION 1  Tables        (categories, products, site_settings)
--   SECTION 2  Row Level Security policies
--   SECTION 3  Storage bucket + policies for images
--   SECTION 4  Demo seed data (optional, safe to delete)
-- ============================================================================


-- ============================================================================
-- SECTION 1: TABLES
-- ============================================================================

-- ---------------------------------------------------------------- categories
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  image_url   text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.categories is 'Product categories shown on the public website (only active ones).';

-- ------------------------------------------------------------------ products
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  price       numeric(12, 2) not null default 0 check (price >= 0),
  category_id uuid not null references public.categories (id) on delete restrict,
  image_url   text,
  active      boolean not null default true,
  featured    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.products is 'Products shown on the public website (only active ones).';

-- Multiple photos per product (the gallery shown in the product pop-up).
-- image_url stays the cover photo (= the FIRST photo) for compatibility.
alter table public.products
  add column if not exists image_urls text[] not null default '{}';

comment on column public.products.image_urls is 'All photos of the product; the first one is the cover. image_url is kept in sync as the cover photo.';

-- One-time migration: products saved with a single photo before this update
-- keep working - their existing photo becomes the first gallery photo.
update public.products
   set image_urls = array_append(image_urls, image_url)
 where image_url is not null
   and array_length(image_urls, 1) is null;

create index if not exists idx_products_category_id on public.products (category_id);
create index if not exists idx_products_active      on public.products (active);
create index if not exists idx_products_featured    on public.products (featured);
create index if not exists idx_products_created_at  on public.products (created_at desc);

-- ------------------------------------------------------------- site_settings
create table if not exists public.site_settings (
  id                integer primary key default 1 check (id = 1),
  business_name     text not null default 'My Store',
  logo_url          text,
  whatsapp_number   text,
  hero_title        text,
  hero_description  text,
  contact_phone     text,
  contact_email     text,
  address           text,
  updated_at        timestamptz not null default now()
);

comment on table public.site_settings is 'Single row (id = 1) with the business details shown on the public website.';

-- ------------------------------------------- keep updated_at automatically --
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_categories_updated on public.categories;
create trigger trg_categories_updated
  before update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_site_settings_updated on public.site_settings;
create trigger trg_site_settings_updated
  before update on public.site_settings
  for each row execute function public.set_updated_at();


-- ============================================================================
-- SECTION 2: ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
-- Visitors (anon) can READ active categories, active products and the site
-- settings — nothing else. Only signed-in admin users can write.
-- ============================================================================

alter table public.categories    enable row level security;
alter table public.products      enable row level security;
alter table public.site_settings enable row level security;

-- ---- Public (read-only) policies ----
drop policy if exists "Public can view active categories" on public.categories;
create policy "Public can view active categories"
  on public.categories for select
  using (active = true);

drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
  on public.products for select
  using (active = true);

drop policy if exists "Public can view site settings" on public.site_settings;
create policy "Public can view site settings"
  on public.site_settings for select
  using (true);

-- ---- Admin (signed-in users) policies ----
drop policy if exists "Admins can manage categories" on public.categories;
create policy "Admins can manage categories"
  on public.categories for all
  to authenticated
  using (true) with check (true);

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
  on public.products for all
  to authenticated
  using (true) with check (true);

drop policy if exists "Admins can manage site settings" on public.site_settings;
create policy "Admins can manage site settings"
  on public.site_settings for all
  to authenticated
  using (true) with check (true);

-- ---- OPTIONAL EXTRA HARDENING ----
-- By default every signed-in user is a full admin. If you want ONLY a
-- specific email to manage the store, replace the three "Admins can manage"
-- policies above with versions like this (example@yourstore.com):
--
--   create policy "Only owner can manage products"
--     on public.products for all
--     to authenticated
--     using ((auth.jwt() ->> 'email') = 'example@yourstore.com')
--     with check ((auth.jwt() ->> 'email') = 'example@yourstore.com');
--
-- NOTE: also disable public sign-ups in Supabase:
--   Authentication -> Sign In / Up -> "Allow new users to sign up" = OFF


-- ============================================================================
-- SECTION 3: STORAGE (product images)
-- ----------------------------------------------------------------------------
-- A public bucket: anyone can VIEW images; only signed-in admins can
-- upload, replace or delete them. Allowed file types: jpg, png, webp.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Anyone can read the images (needed for the public website).
drop policy if exists "Public can view images" on storage.objects;
create policy "Public can view images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Admins can upload (jpg / jpeg / png / webp only).
drop policy if exists "Admins can upload images" on storage.objects;
create policy "Admins can upload images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and (lower(name) like '%.jpg'
         or lower(name) like '%.jpeg'
         or lower(name) like '%.png'
         or lower(name) like '%.webp')
  );

-- Admins can replace images.
drop policy if exists "Admins can update images" on storage.objects;
create policy "Admins can update images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

-- Admins can delete images.
drop policy if exists "Admins can delete images" on storage.objects;
create policy "Admins can delete images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');


-- ============================================================================
-- SECTION 4: DEMO SEED DATA (optional — for testing only)
-- ----------------------------------------------------------------------------
-- Includes a default settings row plus a few demo categories and products so
-- the website is not empty the first time you open it.
-- Replace the business details from Admin -> Settings after deploying,
-- and delete the demo products/categories whenever you like.
-- ============================================================================

-- ---- Default site settings (kept after demo data is removed) ----
insert into public.site_settings
  (id, business_name, whatsapp_number, hero_title, hero_description,
   contact_phone, contact_email, address)
values
  (1,
   'Demo Store',
   '923001234567',
   'Quality Products, Great Prices',
   'Browse our catalog and message us on WhatsApp to place your order. Fast replies, friendly service.',
   '+92 300 1234567',
   'hello@demostore.example',
   'Main Bazaar, Lahore, Pakistan')
on conflict (id) do nothing;

-- ---- Demo categories (fixed IDs so the demo data can be re-run / deleted) ----
insert into public.categories (id, name, slug, description, active) values
  ('c1000000-0000-0000-0000-000000000001', 'Shoes',       'shoes',       'Sports shoes, sneakers and formal footwear.', true),
  ('c1000000-0000-0000-0000-000000000002', 'Clothing',    'clothing',    'Shirts, jackets and everyday clothing.', true),
  ('c1000000-0000-0000-0000-000000000003', 'Watches',     'watches',     'Classic and smart watches for every budget.', true),
  ('c1000000-0000-0000-0000-000000000004', 'Bags',        'bags',        'Handbags, backpacks and travel bags.', true),
  ('c1000000-0000-0000-0000-000000000005', 'Accessories', 'accessories', 'Belts, sunglasses and small essentials.', true)
on conflict (id) do nothing;

-- ---- Demo products (image_url is empty: the placeholder image is shown) ----
insert into public.products (id, name, slug, description, price, category_id, active, featured) values
  ('e1000000-0000-0000-0000-000000000001', 'Nike Air Max',            'nike-air-max',            'Comfortable running shoes with a classic air sole.', 8500,  'c1000000-0000-0000-0000-000000000001', true, true),
  ('e1000000-0000-0000-0000-000000000002', 'Adidas Running Shoes',    'adidas-running-shoes',    'Lightweight daily running shoes with a breathable upper.', 6200, 'c1000000-0000-0000-0000-000000000001', true, false),
  ('e1000000-0000-0000-0000-000000000003', 'Men''s Denim Jacket',     'mens-denim-jacket',       'Classic blue denim jacket, perfect for cool evenings.', 4500,  'c1000000-0000-0000-0000-000000000002', true, false),
  ('e1000000-0000-0000-0000-000000000004', 'Cotton T-Shirt',          'cotton-t-shirt',          'Soft 100% cotton t-shirt available in multiple colours.', 1500, 'c1000000-0000-0000-0000-000000000002', true, false),
  ('e1000000-0000-0000-0000-000000000005', 'Classic Leather Watch',   'classic-leather-watch',   'Elegant leather-strap watch with a stainless steel case.', 12500, 'c1000000-0000-0000-0000-000000000003', true, true),
  ('e1000000-0000-0000-0000-000000000006', 'Sport Smartwatch',        'sport-smartwatch',        'Fitness tracking, heart rate monitor and 7-day battery.', 9800,  'c1000000-0000-0000-0000-000000000003', true, false),
  ('e1000000-0000-0000-0000-000000000007', 'Leather Handbag',         'leather-handbag',         'Spacious genuine leather handbag with an inner pocket.', 7500,  'c1000000-0000-0000-0000-000000000004', true, false),
  ('e1000000-0000-0000-0000-000000000008', 'Travel Backpack',         'travel-backpack',         'Durable 30L backpack with a padded laptop sleeve.', 3200,  'c1000000-0000-0000-0000-000000000004', true, false),
  ('e1000000-0000-0000-0000-000000000009', 'Polarised Sunglasses',    'polarised-sunglasses',    'UV400 polarised lenses with a lightweight frame.', 2200,  'c1000000-0000-0000-0000-000000000005', true, false),
  ('e1000000-0000-0000-0000-000000000010', 'Leather Belt',            'leather-belt',            'Genuine leather belt with a matte buckle.', 1800,     'c1000000-0000-0000-0000-000000000005', true, false)
on conflict (id) do nothing;

-- ============================================================================
-- To REMOVE the demo data later, run:
--
--   delete from public.products   where id like 'e1000000-%';
--   delete from public.categories where id like 'c1000000-%';
--
-- (The site_settings row is kept — edit it from Admin -> Settings.)
-- ============================================================================

-- Quick verification (should return 5 and 10 while the demo data exists):
--   select count(*) from public.categories;
--   select count(*) from public.products;
