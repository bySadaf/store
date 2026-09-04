# Product Catalog — GitHub Pages + Supabase

A complete, lightweight product catalog website for a small business.

- **Public website**: customers browse products by category, search, open product details and order through **WhatsApp** (no cart, no payments, no checkout).
- **Admin panel**: the shop owner manages products, categories and business settings — **without touching any code**.
- **Hosting**: 100% static files on **GitHub Pages** (free). All data lives in **Supabase** (free tier is enough).

Built with HTML5, CSS3, vanilla JavaScript and Bootstrap 5. No PHP, no Node.js server, no paid hosting.

---

## Contents

1. [What you need](#1-what-you-need)
2. [Create the Supabase project](#2-create-the-supabase-project)
3. [Create the database (run the SQL)](#3-create-the-database-run-the-sql)
4. [Create the admin user](#4-create-the-admin-user)
5. [Connect the website to Supabase](#5-connect-the-website-to-supabase)
6. [Publish on GitHub Pages](#6-publish-on-github-pages)
7. [First test](#7-first-test)
8. [Guide for the shop owner](#8-guide-for-the-shop-owner)
9. [Customizing the design](#9-customizing-the-design)
10. [Security explained](#10-security-explained)
11. [Troubleshooting](#11-troubleshooting)
12. [Project structure](#12-project-structure)

---

## 1. What you need

| Account | Why | Cost |
|---|---|---|
| [GitHub](https://github.com) | Hosts the website files | Free |
| [Supabase](https://supabase.com) | Database, image storage, admin login | Free tier |
| WhatsApp | Receiving customer orders | — |

No code editor is required. Everything below is done in the browser.

---

## 2. Create the Supabase project

1. Go to <https://supabase.com> and sign in.
2. Click **New project**. Give it a name (e.g. `my-store`), choose a strong **database password** and keep it somewhere safe, pick the region closest to your customers, and click **Create new project**.
3. Wait 1–2 minutes while the project is prepared.

> The free plan includes 500 MB of database storage and 1 GB of file storage — plenty for hundreds of products.

---

## 3. Create the database (run the SQL)

The file `database/schema.sql` in this project contains everything: tables, Row Level Security rules, the image storage bucket, and some demo data.

1. In your Supabase project, open **SQL Editor** (left sidebar) → **New query**.
2. Open `database/schema.sql` from this project (you can open it with any text editor, e.g. Notepad) and **copy the whole file**.
3. Paste it into the SQL Editor and press **Run**.
4. You should see "Success. No rows returned".

**What it created:**

- Table `categories` — product groups (name, slug, description, image, active)
- Table `products` — name, slug, description, price, category, photos, active, featured
- Table `site_settings` — one row with your business details (name, logo, WhatsApp number, hero text, contact info)
- Row Level Security so **only you** can make changes
- Storage bucket `product-images` for all images
- **Demo data**: 5 categories and 10 products so the site isn't empty at first (how to delete it is written inside the SQL file)

---

## 4. Create the admin user

1. In Supabase, open **Authentication** → **Users**.
2. Click **Add user** → **Create new user**.
3. Enter the owner's **email** and a strong **password**.
4. Turn **Auto Confirm User** ON (or confirm the user manually afterwards).
5. Click **Create user**.
6. **Important — lock the door:** open **Authentication → Sign In / Up** and turn **OFF** "Allow new users to sign up". This way nobody can create their own admin account.

> These login details are only for the **admin panel**. Customers never log in — they just browse and message you on WhatsApp.

---

## 5. Connect the website to Supabase

You only need to edit **one file**: `js/config.js`.

1. In Supabase, open **Settings** (bottom of the left sidebar) → **API**.
2. Copy the **Project URL** — it looks like `https://abcdefgh12345.supabase.co`.
3. Copy the **anon public** key (also called "publishable" key) — a long string starting with `eyJ...`.
4. Open `js/config.js` and replace the two placeholder values:

```js
const SUPABASE_URL = 'https://abcdefgh12345.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your anon key...';
```

### Which key goes where?

| Key | Where it goes | Safe? |
|---|---|---|
| `anon public` key | `js/config.js` in the frontend | **Yes** — the database rules (RLS) make sure strangers can only read public data |
| `service_role` key | Nowhere. Never in the frontend, never committed to GitHub | Keep it private. It is **not needed** for this project at all |
| Database password | Only in Supabase / your password manager | Keep it private |

Double-check that you pasted the **anon** key, not the service_role key.

---

## 6. Publish on GitHub Pages

### Step 1 — Create the repository

1. Go to <https://github.com/new>.
2. Repository name: something like `my-store` (this name appears in the website address).
3. Choose **Public** and click **Create repository**.

### Step 2 — Upload the files

The easiest way (with git, from the folder containing this project):

```bash
git init
git add .
git commit -m "My product catalog"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/my-store.git
git push -u origin main
```

No git? Use the GitHub web interface: on the repository page click **Add file → Upload files**, drag **all** project files/folders in, and commit. (If the web upload gives trouble with hidden files, that's fine — `.nojekyll` and `.gitignore` are optional extras.)

### Step 3 — Turn on GitHub Pages

1. On the repository page open **Settings** → **Pages**.
2. Under "Build and deployment":
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` / folder: `/ (root)`
   - Click **Save**.
3. Wait 1–3 minutes, then refresh the page — your address appears at the top:

```
https://YOUR-USERNAME.github.io/my-store/
```

Open it — your catalog is live. The project uses **relative paths** everywhere, so it works correctly even though it lives in a subfolder (`/my-store/`) instead of the root of the domain.

> **Custom domain (optional):** GitHub Pages supports free custom domains (`www.mystore.com`) — see GitHub's "Pages → Custom domain" instructions. Supabase works with any domain automatically.

---

## 7. First test

Walk through this checklist:

| # | Test | Expected result |
|---|---|---|
| 1 | Open `https://USERNAME.github.io/REPO/` | The homepage shows the demo categories and products |
| 2 | Click a category | Only that category's products are shown |
| 3 | Search "watch" | Products and categories matching "watch" appear instantly, no page reload |
| 4 | Click a product | A pop-up shows the photo gallery (arrows/thumbnails when there are several photos), the price and **Buy on WhatsApp** |
| 5 | Click **Buy on WhatsApp** | WhatsApp opens in a new tab/app with a pre-filled order message |
| 6 | Open `.../admin/login.html`, sign in with the admin email/password | You land on the admin dashboard with statistics |
| 7 | Admin → Products → **Add Product**, upload several photos, save | The product appears in the table and on the public website after refresh |
| 8 | Admin → **Settings**, change the WhatsApp number, save | New "Buy on WhatsApp" messages go to the new number |

If something fails, check the [Troubleshooting](#11-troubleshooting) section.

---

## 8. Guide for the shop owner

Everything below is done from the **admin panel** — no code, no technical terms.

**Where do I log in?** Open `https://YOUR-USERNAME.github.io/REPO/admin/login.html` and use your email + password. Tip: save it in your phone's bookmarks.

### Add a product
Dashboard → **Products** → **Add Product**:
1. Write the **Product Name** and **Price**.
2. Pick a **Category** (create categories first — see below).
3. Optionally write a short **Description**.
4. Click **Add photos** and pick one or more photos (JPG, PNG or WebP, up to 5 MB each, up to 8 per product). You can add more photos later from the Edit screen. The **first photo is the cover** shown on product cards; customers can browse all of them in the details pop-up.
5. Leave "Show this product on the website" switched ON.
6. Press **Save Product**. Done — it's on the website.

> **Photos tip:** to reorder, use the small arrows on each photo tile — moving a photo to the first position makes it the cover. The small **x** removes a photo.

### Edit a product
Products → find the row → **Edit**. Change anything (name, price, category, photos, description), then **Save Changes**.

### Hide a product (without deleting)
Products → turn OFF the switch in the **Active** column. The product disappears from the website but stays saved. Turn it back ON any time.

### Feature a product
Turn ON the star in the **Featured** column — featured products are highlighted on the homepage.

### Delete a product
Products → **Delete** → read the confirmation → **Delete Product**. This cannot be undone.

### Categories
Dashboard → **Categories** → **Add Category** (name + optional description and image).
- The category appears on the homepage automatically.
- **Hide** a category with its Active switch.
- A category can only be **deleted when it has no products left** — you'll see a friendly warning if it still has some. This protects you from accidentally hiding products from the website.

### Business settings
Dashboard → **Settings**:
- **Business Name** — shown in the header, tab title and footer
- **Logo** — replaces the name in the header
- **WhatsApp Number** — the most important field! Every "Buy on WhatsApp" button sends messages here. Include the country code, e.g. `923001234567` (Pakistan) or `15551234567` (US). No `+`, spaces or dashes needed.
- Homepage headline & description, phone, email, address

Press **Save Changes** — the public website updates immediately.

### Where do orders arrive?
Directly in your WhatsApp chats. Each message already contains the product name, price and product ID, so you know exactly what the customer wants.

---

## 9. Customizing the design

| What | Where |
|---|---|
| Brand colors (primary, accent, background, text, WhatsApp green) | `css/variables.css` — change once, applies to the public site **and** the admin panel |
| Currency symbol (default `Rs.`) | `js/config.js` → `SITE_CONFIG.currency` |
| Products per page load (default 12) | `js/config.js` → `SITE_CONFIG.productsPerPage` |
| Max image upload size (default 5 MB per photo) | `js/config.js` → `SITE_CONFIG.maxImageMB` |
| Max photos per product (default 8) | `js/config.js` → `SITE_CONFIG.maxImagesPerProduct` |
| Auto-fix WhatsApp numbers starting with 0 | `js/config.js` → `SITE_CONFIG.whatsappCountryCode` (e.g. `'92'`) |
| Business name, logo, hero text, contact info | Admin → **Settings** (no code) |

**SEO tips:** the homepage title/description come from your Settings automatically. For the best search-engine results, also update the static `<title>` and `<meta name="description">` in `index.html` once (one line each), and replace `assets/images/placeholder.svg` with a real logo/cover image if you want nicer social-media previews.

---

## 10. Security explained

- **Row Level Security (RLS)** — the rules in `database/schema.sql` make sure:
  - Visitors can read **only** active categories, active products and the site settings. Nothing else.
  - Visitors **cannot** create, edit or delete anything.
  - Only **signed-in admin users** can write.
- **Supabase Auth** — the admin panel is protected with email + password. Wrong credentials cannot open it.
- **Public sign-ups disabled** (step 4) — strangers cannot create admin accounts for themselves.
- **Keys** — the frontend only ever uses the `anon public` key. The `service_role` key is never used or committed.
- **Storage rules** — anyone can *view* images, only signed-in admins can upload/replace/delete, and only image files (jpg/png/webp) are accepted.
- The admin pages use `noindex` so search engines skip them.
- Optional extra hardening (single-owner policies) is described in comments inside `database/schema.sql`.

> The admin login page itself is visible at `/admin/login.html` — that's normal and safe. It's just a login form; without correct credentials nothing can be changed.

---

## 11. Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Yellow "One small step left" banner on the website | `js/config.js` still has placeholders | Paste your Supabase URL + anon key (step 5) |
| "The database is not set up yet" message | `database/schema.sql` was not run | Run it in the SQL Editor (step 3) |
| "Incorrect email or password" on the admin login | Wrong credentials, or user not confirmed | Check Authentication → Users; confirm the user or reset the password |
| Login page says sign-ups are not allowed | Public sign-ups disabled (good!) | Create admins from Authentication → Users |
| Images don't appear on the website | Storage policies missing | Re-run `database/schema.sql` (Section 3) |
| "You do not have permission" in the admin | Not signed in, or RLS not active | Sign in again; re-run the schema |
| Website still shows old data | Browser cache | Hard refresh (Ctrl/Cmd + Shift + R) |
| WhatsApp opens but with no message | Number invalid | Admin → Settings → check the number (country code, digits only) |
| WhatsApp doesn't open at all | No number configured | Admin → Settings → save your WhatsApp number |
| 404 on GitHub Pages | Pages not enabled yet, or wrong folder | Settings → Pages → `main` branch, `/ (root)` (step 6) |
| Can't upload an image | Wrong file type or too big | Use JPG/PNG/WebP under 5 MB |
| Only one photo per product is shown | Old database (no `image_urls` column) | Re-run `database/schema.sql` in the Supabase SQL editor — it adds the photos column safely, without touching your data |

---

## 12. Project structure

```
product-catalog/
│
├── index.html                 # Public website (single page, hash routes)
├── .nojekyll                  # Tells GitHub Pages to serve files as-is
│
├── css/
│   ├── variables.css          # Brand colors — change these
│   └── style.css              # Public site styles
│
├── js/
│   ├── config.js              # THE file with your Supabase URL + anon key
│   ├── supabase.js            # Shared Supabase client + friendly errors
│   ├── utils.js               # Helpers (price format, toasts, validation...)
│   ├── whatsapp.js            # Builds the wa.me order links
│   ├── categories.js          # Public category cards
│   ├── products.js            # Public product grid, search, modal
│   └── main.js                # Page bootstrap: settings, header, hero, contact
│
├── assets/images/             # Placeholder + favicon
│
├── admin/
│   ├── login.html             # Admin sign-in
│   ├── index.html             # Dashboard (statistics)
│   ├── products.html          # Product management
│   ├── categories.html        # Category management
│   ├── settings.html          # Business settings
│   ├── css/admin.css          # Admin styles
│   └── js/
│       ├── auth.js            # Login + session guard + shared sidebar
│       ├── dashboard.js
│       ├── products.js
│       ├── categories.js
│       └── settings.js
│
├── database/
│   └── schema.sql             # Tables + security + storage + demo data
│
└── README.md
```

**How the pieces talk:** every page loads `js/config.js` (your keys) → `js/supabase.js` creates one shared client → the page's own script fetches data from Supabase and renders it. The admin pages additionally check the login session first and redirect to `login.html` when it's missing.

---

Made for small businesses: fast, responsive, secure and free to run.
