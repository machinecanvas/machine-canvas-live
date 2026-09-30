-- Prices now come from the pricing formula in src/config.ts (setup fee +
-- rate per m²) for every size, and customers can pick a custom size on any
-- design. This refreshes the stored reference prices of the launch prints
-- (1.5 m²: £197 + 1.5 × £97 = £342.50) and updates their descriptions.
-- The shop never charges the stored price, so this is tidy-up only.
-- Safe to re-run.

update public.products
set
  price_pence = 34250,
  size_options = jsonb_set(size_options, '{0,price_pence}', '34250'),
  description = replace(
    description,
    'Price includes setup, printing and installation.',
    'Also available in any custom size. Price includes setup, printing and installation.'
  )
where slug in (
  'blackpool-tower-sash-window',
  'harbour-shutters-window',
  'coastal-dunes-arched-window',
  'cornish-harbour-arched-window',
  'mediterranean-marina-window'
)
and description not like '%any custom size%';
