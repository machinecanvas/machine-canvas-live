# Machine Canvas shop

Online shop and booking system for machinecanvas-wallandfloorprinting.com. Customers buy a wall or floor print (or upload their own image), choose an installation date and slot, pay with Stripe, and get a confirmation email with a calendar invite. The owner manages products, bookings and block-out dates at `/shop/admin`.

## How it fits with the main site

The main site is static HTML on Netlify. The shop is a separate Next.js app in this `shop/` folder, deployed on **Vercel** with `basePath: "/shop"`. Netlify proxies `/shop/*` to Vercel (see `_redirects` in the repo root), so customers stay on `machinecanvas-wallandfloorprinting.com/shop`. The main site's pages link to it from the nav and footer.

```
Browser ──> Netlify (static site) ──/shop/*──> Vercel (this app) ──> Supabase (DB, storage, auth)
                                                                 ├─> Stripe Checkout + webhook
                                                                 ├─> Google Calendar (service account)
                                                                 └─> Resend (emails)
```

| Path | What |
|---|---|
| `/shop` | Product grid, filter by wall/floor |
| `/shop/<slug>` | Product page: size, calendar, details, checkout |
| `/shop/custom` | Upload your own image, live price, DPI check, checkout |
| `/shop/admin` | Owner admin (email code sign-in, allow-listed emails only) |
| `/shop/api/stripe/webhook` | Stripe webhook |
| `/shop/api/cron/expire-holds` | Releases lapsed slot holds (Vercel Cron) |

Key files: `src/config.ts` (prices, slot times, notice period, limits), `src/lib/pricing.ts` (custom print price and new-customer discount), `src/lib/booking.ts` (hold → checkout → payment → calendar/email → cancel/refund), `supabase/migrations/0001_shop.sql` (schema).

## How bookings stay safe

- **No double-booking.** A unique index on `(date, slot)` for `held`/`paid` bookings means the database itself rejects a second booking for the same slot.
- **Prices are never trusted from the browser.** The server looks up the product price, or recalculates the custom price, and checks the slot again before creating the Stripe session.
- **10-minute holds.** Continuing to payment creates a `held` booking. Stripe sessions must last at least 30 minutes, so when a hold lapses the app expires the Stripe session first, which stops it being paid, and then frees the slot. This runs every minute (cron), when someone else tries the same slot, and on Stripe's `checkout.session.expired` webhook.
- **Late payments.** If a payment somehow completes after its slot was rebooked, the customer is refunded automatically and both of you get an email.
- **Idempotent webhook.** Stripe retries are safe. The paid status and `purchase_count` increment happen once, in one database transaction. The calendar event and emails each record that they've been done, so a retry only re-runs what failed.
- **Customer uploads are private.** They go straight from the browser to a private bucket via a one-time signed URL. At checkout the server checks size, type and file signature, and recomputes DPI. You get a signed download link that expires; the admin page always generates a fresh one.
- **Rate limits** on availability, uploads, checkout and admin sign-in are stored in Postgres, so they apply across all serverless instances.

## Setup

Do everything in **test mode** first and run the checklist at the bottom before going live.

### 1. Supabase

1. Create a project at supabase.com (region: London `eu-west-2`).
2. Open `supabase/setup.sql`, copy **all of its contents** (not just the file name), paste them into **SQL Editor → New query** and click **Run**. It should say "Success. No rows returned". This creates the tables, functions, security policies, two storage buckets (`product-images` public, `custom-uploads` private) and the five launch products. It's safe to run again if anything goes wrong. (The same SQL is split into `migrations/0001_shop.sql` and `0002_window_prints.sql` for the Supabase CLI.)
3. **Project settings → API keys**: copy the project URL, the **publishable** key and a **secret** key into the env vars below.
4. **Authentication → Email templates → Magic link**: add the code so the admin sign-in email includes it, e.g. `<p>Your sign-in code: <strong>{{ .Token }}</strong></p>`.
5. Optional but recommended: **Authentication → SMTP** — send auth emails through Resend (smtp.resend.com), because Supabase's built-in email is heavily rate-limited.

### 2. Stripe

1. In test mode, copy the secret key (`sk_test_…`) into `STRIPE_SECRET_KEY`.
2. **Developers → Webhooks → Add endpoint**
   - URL: `https://machinecanvas-wallandfloorprinting.com/shop/api/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`
   - Copy the signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.
3. Settings → Business: set the public business name and support email (they show on Checkout and receipts). Turn on email receipts if you want Stripe's receipt as well as ours.
4. For local testing: `stripe listen --forward-to localhost:3000/shop/api/stripe/webhook` and use the `whsec_` it prints.

### 3. Google Calendar

1. In Google Cloud Console, create a project and enable the **Google Calendar API**.
2. **IAM → Service accounts → Create**. Then open it → **Keys → Add key → JSON** and download the key file.
3. In Google Calendar → the calendar you use for jobs → **Settings and sharing → Share with specific people** → add the service account's email with **"Make changes to events"**.
4. On the same page, copy the **Calendar ID** (for your main calendar it's your Gmail address).
5. Env vars: `GOOGLE_SERVICE_ACCOUNT_EMAIL` = `client_email` from the JSON, `GOOGLE_PRIVATE_KEY` = `private_key` from the JSON (keep the `\n`s), `GOOGLE_CALENDAR_ID`.

Any event in this calendar blocks the slots it overlaps (e.g. a 10:00–11:00 dentist appointment blocks the morning slot). Paid bookings are added to it automatically.

### 4. Resend

1. Add and verify `machinecanvas-wallandfloorprinting.com` under **Domains** by adding the DNS records it shows at your DNS provider.
2. Create an API key → `RESEND_API_KEY`. Set `EMAIL_FROM` to an address on the verified domain.

### 5. Vercel

1. **Add New → Project** → import `machinecanvas/machine-canvas-live` → set **Root Directory** to `shop`. The framework is detected as Next.js.
2. Add every variable from `.env.example` under **Settings → Environment Variables** (Production, and Preview with test keys).
3. Deploy. Note the production domain (e.g. `machine-canvas-shop.vercel.app`).
4. **Cron:** `vercel.json` runs `/shop/api/cron/expire-holds` every minute, which needs a **Pro** plan. On Hobby, change the schedule to once a day. Holds are still released when someone tries the same slot and when Stripe expires the session (~30 minutes), so the only effect is that an abandoned slot may show as taken for up to 30 minutes instead of 10.

### 6. Connect the main site (Netlify)

In `_redirects` at the repo root, replace `REPLACE-WITH-VERCEL-DOMAIN.invalid` (two lines) with the Vercel production domain from step 5, then deploy to Netlify. The nav "Shop" links only work once this is done, so **merge the whole change after the Vercel deploy is up.**

### Environment variables

See `.env.example`. None of these belong in git: `.env*.local` is ignored.

## Local development

```bash
cd shop
cp .env.example .env.local   # fill in test keys
npm install
npm run dev                  # http://localhost:3000/shop
npm test                     # pricing, dates and .ics unit tests
npm run lint                 # TypeScript check
```

Set `SITE_URL=http://localhost:3000` locally so Stripe redirects back to your machine.

## Configuration (`src/config.ts`)

Custom prints use the main site's published pricing: **£197 minimum (covers up to 1 m²), then £49 per extra m²**, VAT included, same for walls and floors, rounded to the nearest £1 (10 m² = £638). **New customers get 50% off their first booking** (shop products and custom prints). A customer counts as new if no paid booking, or current slot hold, exists for their email or phone number. The discount is decided on the server at checkout, shown on the Stripe page, in the emails and in the admin. Set `NEW_CUSTOMER_DISCOUNT_PCT` to `0` to turn it off. Other settings: slot names and times, notice period (2 days), how far ahead customers can book (180 days), hold length (10 min), max area per slot (15 m²), upload limits and DPI thresholds (warn below 100, block below 50). Change a value and redeploy. The unit tests in `src/lib/pricing.test.ts` pin the current formula, so update them along with the pricing. Shop products have their own fixed prices, set per size in the admin.

## Room photos

Each product can have a **room photo**: the print shown on a wall in a real-looking room, used as the main image in the shop. For the launch prints these are made by `scripts/room-mockups.mjs` from empty-room photos in `mockups/rooms/`. The script places the actual design onto the wall at its true size (the scale is measured from furniture in the room) and blends it like ink on paint. Placement for each product is in `mockups/room-mockups.json`. Run `node scripts/room-mockups.mjs` after changing a design or a placement. For new products, upload a room photo in the admin.

## Admin

Go to `/shop/admin`, enter an email from `ADMIN_EMAILS`, and type the 6-digit code from the email.

- **Products:** drag and drop the design image (and optionally a room photo) (the original is kept and a 1600px WebP is generated), then set title, description, wall/floor, one or more sizes with prices inc. VAT, and whether it's visible. The list shows how many times each product has sold. You can hide/show or delete a product; deleting keeps its past bookings.
- **Bookings:** upcoming and past, with customer details and a download link for custom artwork. **Cancel & refund** refunds in full through Stripe, frees the slot and deletes the calendar event.
- **Block-out dates:** block a whole day or one slot. Existing bookings on that day are not affected.

## Test checklist (Stripe test mode)

- [ ] First booking with a new email: Stripe shows 50% off. A second booking with the same email or phone is full price.
- [ ] Product purchase with card `4242 4242 4242 4242`: success page shows; customer and owner emails arrive with a working `.ics`; calendar event created; `purchase_count` +1; the slot now shows as taken.
- [ ] Custom upload: a small JPG at a big size shows the warning or block; a PDF uploads; the owner email download link works.
- [ ] Two browsers pick the same slot at once: the second gets "slot has just been taken".
- [ ] Press back on Stripe Checkout: the slot is freed immediately.
- [ ] Leave Checkout open for more than 10 minutes: the slot is freed and the Stripe page can no longer be paid.
- [ ] Card `4000 0000 0000 9995` (declined): no booking confirmed.
- [ ] Admin cancel & refund: the refund appears in Stripe, the calendar event is gone and the slot is free again.
- [ ] Add a block-out and a personal event in Google Calendar: both slots disappear from the calendar.
- [ ] `stripe events resend <evt_id>` on a completed session: no duplicate emails or events.

Then switch to live keys, create a live-mode webhook endpoint, and repeat one real low-value purchase and refund.

## Housekeeping

- Custom uploads from abandoned checkouts stay in `custom-uploads/pending/`. Clear old files there occasionally (Supabase dashboard → Storage).
- The `rate_limits` table cleans itself up.
