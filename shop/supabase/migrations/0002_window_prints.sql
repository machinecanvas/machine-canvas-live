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
