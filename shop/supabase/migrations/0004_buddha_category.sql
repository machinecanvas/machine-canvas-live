-- Allow 'buddha' as a product/booking category.
-- Safe to run more than once.

alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check check (category in ('wall', 'floor', 'buddha'));

alter table public.bookings drop constraint if exists bookings_category_check;
alter table public.bookings add constraint bookings_category_check check (category in ('wall', 'floor', 'buddha'));
