alter table public.supplier_price_checks
  add column if not exists seller_name text,
  add column if not exists offer_url text;

alter table public.product_pricing
  add column if not exists current_supplier text,
  add column if not exists current_seller_name text,
  add column if not exists current_offer_url text,
  add column if not exists current_cost_usd numeric(12, 2)
    check (current_cost_usd is null or current_cost_usd > 0),
  add column if not exists final_price_usd numeric(12, 2)
    check (final_price_usd is null or final_price_usd > 0),
  add column if not exists final_price_bs numeric(16, 2)
    check (final_price_bs is null or final_price_bs > 0),
  add column if not exists bcv_rate numeric(14, 4)
    check (bcv_rate is null or bcv_rate > 0),
  add column if not exists applied_margin_percent numeric(7, 3)
    check (applied_margin_percent is null or (applied_margin_percent >= 0 and applied_margin_percent <= 500)),
  add column if not exists price_checked_at timestamptz;

insert into public.product_supplier_urls (variant_id, supplier, url)
values
  ('v-s10-glo', 'eneba', 'https://www.eneba.com/latam/steam-gift-card-steam-wallet-gift-card-10-usd-steam-key-united-states'),
  ('v-s10-glo', 'g2a', 'https://www.g2a.com/es/steam-gift-card-10-usd-steam-key-global-i10000000258127')
on conflict (variant_id, supplier) do update
set url = excluded.url;
