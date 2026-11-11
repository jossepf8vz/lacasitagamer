alter table public.product_pricing
  add column if not exists category text,
  add column if not exists platform text,
  add column if not exists stock integer
    check (stock is null or stock >= 0);

insert into public.product_pricing (
  variant_id,
  product_id,
  profit_margin_percent,
  category,
  platform,
  stock
)
values (
  'v-ps10-us',
  'g-psn-10',
  33,
  'PlayStation / Gift Cards',
  'PlayStation',
  80
)
on conflict (variant_id) do update set
  product_id = excluded.product_id,
  profit_margin_percent = excluded.profit_margin_percent,
  category = excluded.category,
  platform = excluded.platform,
  stock = excluded.stock,
  updated_at = now();

insert into public.product_supplier_urls (variant_id, supplier, url)
values (
  'v-ps10-us',
  'eneba',
  'https://www.eneba.com/latam/psn-playstation-network-card-10-usd-usa-psn-key-united-states'
)
on conflict (variant_id, supplier) do update set
  url = excluded.url;
