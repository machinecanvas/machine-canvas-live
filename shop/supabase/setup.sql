-- Machine Canvas shop: complete database setup.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- It combines migrations/0001_shop.sql and migrations/0002_window_prints.sql
-- and is safe to run more than once.

-- Machine Canvas shop: products, bookings, block-out dates, rate limits and
-- storage buckets. Run in the Supabase SQL editor (or `supabase db push`).
-- Safe to run again: everything is created only if it doesn't exist yet.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  category text not null check (category in ('wall', 'floor')),
  image_url text,               -- public web-optimised thumbnail
  room_image_url text,          -- optional: the print shown on a wall in a room (feature image)
  original_image_path text,     -- original upload in the product-images bucket
  -- Lowest price across sizes, inc. VAT ("from £X" on the shop grid).
  price_pence integer not null check (price_pence > 0),
  -- Every product has at least one size; a single-size product has one entry.
  -- [{ "label": "2m x 1m", "width_cm": 200, "height_cm": 100, "price_pence": 25000 }]
  size_options jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  purchase_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint products_has_sizes check (jsonb_typeof(size_options) = 'array' and jsonb_array_length(size_options) > 0)
);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete set null,
  size_label text,
  custom_upload_path text,      -- private path in the custom-uploads bucket (never a public URL)
  width_cm numeric not null check (width_cm > 0),
  height_cm numeric not null check (height_cm > 0),
  category text not null check (category in ('wall', 'floor')),
  date date not null,
  slot text not null check (slot in ('morning', 'evening')),
  status text not null default 'held' check (status in ('held', 'paid', 'cancelled', 'expired')),
  hold_expires_at timestamptz,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  install_address text not null,
  amount_pence integer not null check (amount_pence > 0),  -- amount charged, after discount
  discount_pence integer not null default 0 check (discount_pence >= 0),
  calendar_event_id text,
  emails_sent_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);

-- One live booking per date + slot. This is the real double-booking guard;
-- everything in the app is a friendlier check in front of it.
create unique index if not exists bookings_one_per_slot
  on public.bookings (date, slot)
  where status in ('held', 'paid');

create index if not exists bookings_date_idx on public.bookings (date);
create index if not exists bookings_held_expiry_idx on public.bookings (hold_expires_at) where status = 'held';

-- ---------------------------------------------------------------------------
-- Block-out dates (holidays etc). slot null = whole day.
-- ---------------------------------------------------------------------------
create table if not exists public.blockouts (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  slot text check (slot in ('morning', 'evening')),
  reason text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists blockouts_unique on public.blockouts (date, coalesce(slot, 'all'));

-- ---------------------------------------------------------------------------
-- Fixed-window rate limiting shared by all serverless instances
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;

  -- opportunistic cleanup of old windows
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- Create a held booking. Raises 'blocked' or 'slot_taken'.
-- ---------------------------------------------------------------------------
create or replace function public.create_hold(
  p_product_id uuid,
  p_size_label text,
  p_custom_upload_path text,
  p_width_cm numeric,
  p_height_cm numeric,
  p_category text,
  p_date date,
  p_slot text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_install_address text,
  p_amount_pence integer,
  p_discount_pence integer,
  p_hold_minutes integer
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if exists (
    select 1 from public.blockouts
    where date = p_date and (slot is null or slot = p_slot)
  ) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  begin
    insert into public.bookings (
      product_id, size_label, custom_upload_path, width_cm, height_cm, category,
      date, slot, status, hold_expires_at,
      customer_name, customer_email, customer_phone, install_address, amount_pence, discount_pence
    ) values (
      p_product_id, p_size_label, p_custom_upload_path, p_width_cm, p_height_cm, p_category,
      p_date, p_slot, 'held', now() + make_interval(mins => p_hold_minutes),
      p_customer_name, p_customer_email, p_customer_phone, p_install_address, p_amount_pence, p_discount_pence
    ) returning id into v_id;
  exception when unique_violation then
    raise exception 'slot_taken' using errcode = 'P0001';
  end;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mark a booking paid (Stripe webhook). Idempotent; increments the product's
-- purchase_count in the same transaction the first time only.
-- Returns 'paid' | 'already_paid' | 'conflict' | 'not_found'.
-- ---------------------------------------------------------------------------
create or replace function public.mark_booking_paid(
  p_booking_id uuid,
  p_session_id text,
  p_payment_intent_id text
) returns text
language plpgsql
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and stripe_session_id = p_session_id
  for update;

  if not found then
    return 'not_found';
  end if;

  if v_booking.status = 'paid' then
    return 'already_paid';
  end if;

  begin
    update public.bookings
    set status = 'paid', hold_expires_at = null, stripe_payment_intent_id = p_payment_intent_id
    where id = p_booking_id;
  exception when unique_violation then
    -- The hold lapsed and someone else took the slot before payment landed.
    update public.bookings set stripe_payment_intent_id = p_payment_intent_id where id = p_booking_id;
    return 'conflict';
  end;

  if v_booking.product_id is not null then
    update public.products set purchase_count = purchase_count + 1 where id = v_booking.product_id;
  end if;

  return 'paid';
end;
$$;

-- ---------------------------------------------------------------------------
-- New-customer check: true if this email or phone number already has a paid
-- booking, or a live hold (so one person can't stack discounted checkouts).
-- Phones are compared on their last 10 digits so 07… and +447… match.
-- ---------------------------------------------------------------------------
create or replace function public.is_returning_customer(p_email text, p_phone text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.bookings
    where (status = 'paid' or (status = 'held' and hold_expires_at > now()))
      and (
        lower(trim(customer_email)) = lower(trim(p_email))
        or (
          length(regexp_replace(p_phone, '\D', '', 'g')) >= 10
          and right(regexp_replace(customer_phone, '\D', '', 'g'), 10) = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security: the public can read active products only. Everything
-- else goes through the server using the secret (service role) key.
-- ---------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.bookings enable row level security;
alter table public.blockouts enable row level security;
alter table public.rate_limits enable row level security;

drop policy if exists "public reads active products" on public.products;
create policy "public reads active products" on public.products
  for select to anon, authenticated using (active);

revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.create_hold(uuid, text, text, numeric, numeric, text, date, text, text, text, text, text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.is_returning_customer(text, text) from public, anon, authenticated;
revoke execute on function public.mark_booking_paid(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 52428800, array['image/jpeg', 'image/png', 'image/webp']),
  ('custom-uploads', 'custom-uploads', false, 52428800, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;


-- Launch range: five "window view" wall prints at a fixed size and price
-- (£350 inc. VAT, supply, setup and installation). Images are served from
-- the shop's public folder (shop/public/products): the design itself plus a
-- "-room" photo of it printed on a wall (made by scripts/room-mockups.mjs).
-- Safe to re-run: existing slugs are left untouched, so admin edits are kept.

insert into public.products (title, slug, description, category, image_url, room_image_url, price_pence, size_options)
values
  (
    'Blackpool Tower Sash Window',
    'blackpool-tower-sash-window',
    E'A weathered Georgian sash window looking out over Blackpool: the Tower, the promenade, the beach and North Pier stretching out to sea.\n\nPrinted directly onto your wall with a realistic 3D window effect. Portrait format, 1 m wide × 1.5 m high. Price includes setup, printing and installation.',
    'wall',
    '/shop/products/blackpool-tower-sash-window.webp',
    '/shop/products/blackpool-tower-sash-window-room.webp',
    35000,
    '[{"label": "1 m × 1.5 m (portrait)", "width_cm": 100, "height_cm": 150, "price_pence": 35000}]'
  ),
  (
    'Harbour Through the Shutters',
    'harbour-shutters-window',
    E'Modern black louvred shutters opening onto a Cornish fishing harbour, with painted boats, stone quays and cottages climbing the hillside.\n\nPrinted directly onto your wall with a realistic 3D window effect. Landscape format, 1.5 m wide × 1 m high. Price includes setup, printing and installation.',
    'wall',
    '/shop/products/harbour-shutters-window.webp',
    '/shop/products/harbour-shutters-window-room.webp',
    35000,
    '[{"label": "1.5 m × 1 m (landscape)", "width_cm": 150, "height_cm": 100, "price_pence": 35000}]'
  ),
  (
    'Coastal Dunes Arched Window',
    'coastal-dunes-arched-window',
    E'A dark-wood arched window with a stone sill, framing a sweeping sandy bay, grassy dunes and bright blue sea.\n\nPrinted directly onto your wall with a realistic 3D window effect. Landscape format, 1.5 m wide × 1 m high. Price includes setup, printing and installation.',
    'wall',
    '/shop/products/coastal-dunes-arched-window.webp',
    '/shop/products/coastal-dunes-arched-window-room.webp',
    35000,
    '[{"label": "1.5 m × 1 m (landscape)", "width_cm": 150, "height_cm": 100, "price_pence": 35000}]'
  ),
  (
    'Cornish Harbour Arched Window',
    'cornish-harbour-arched-window',
    E'An oak arched window on a granite sill, looking down over a Cornish harbour village: whitewashed cottages, fishing boats and turquoise water.\n\nPrinted directly onto your wall with a realistic 3D window effect. Landscape format, 1.5 m wide × 1 m high. Price includes setup, printing and installation.',
    'wall',
    '/shop/products/cornish-harbour-arched-window.webp',
    '/shop/products/cornish-harbour-arched-window-room.webp',
    35000,
    '[{"label": "1.5 m × 1 m (landscape)", "width_cm": 150, "height_cm": 100, "price_pence": 35000}]'
  ),
  (
    'Mediterranean Marina Window',
    'mediterranean-marina-window',
    E'A black iron-framed window set into a sunlit plaster wall, opening onto a Mediterranean marina with yachts, clear turquoise water and pastel houses on the cliffs.\n\nPrinted directly onto your wall with a realistic 3D window effect. Landscape format, 1.5 m wide × 1 m high. Price includes setup, printing and installation.',
    'wall',
    '/shop/products/mediterranean-marina-window.webp',
    '/shop/products/mediterranean-marina-window-room.webp',
    35000,
    '[{"label": "1.5 m × 1 m (landscape)", "width_cm": 150, "height_cm": 100, "price_pence": 35000}]'
  )
on conflict (slug) do nothing;
