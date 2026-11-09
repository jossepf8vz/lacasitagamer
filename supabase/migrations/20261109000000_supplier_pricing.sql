create table if not exists public.product_pricing (
  variant_id text primary key,
  product_id text not null,
  profit_margin_percent numeric(7, 3) not null default 10
    check (profit_margin_percent >= 0 and profit_margin_percent <= 500),
  fallback_cost_usd numeric(12, 2)
    check (fallback_cost_usd is null or fallback_cost_usd > 0),
  updated_at timestamptz not null default now()
);

create index if not exists product_pricing_product_id_idx
  on public.product_pricing (product_id);

create table if not exists public.product_supplier_urls (
  variant_id text not null references public.product_pricing (variant_id) on delete cascade,
  supplier text not null check (supplier in ('g2a', 'eneba', 'eldorado')),
  url text not null check (
    (supplier = 'g2a' and url ~ '^https://(www\.)?g2a\.com(/|$)')
    or (supplier = 'eneba' and url ~ '^https://(www\.)?eneba\.com(/|$)')
    or (supplier = 'eldorado' and url ~ '^https://(www\.)?eldorado\.gg(/|$)')
  ),
  created_at timestamptz not null default now(),
  primary key (variant_id, supplier)
);

create table if not exists public.supplier_price_checks (
  variant_id text not null,
  supplier text not null,
  source_url text not null,
  price_usd numeric(12, 2) check (price_usd is null or price_usd > 0),
  error text,
  checked_at timestamptz not null default now(),
  primary key (variant_id, supplier),
  foreign key (variant_id, supplier)
    references public.product_supplier_urls (variant_id, supplier)
    on delete cascade
);

alter table public.product_pricing enable row level security;
alter table public.product_supplier_urls enable row level security;
alter table public.supplier_price_checks enable row level security;

revoke all on public.product_pricing from anon, authenticated;
revoke all on public.product_supplier_urls from anon, authenticated;
revoke all on public.supplier_price_checks from anon, authenticated;
grant all on public.product_pricing to service_role;
grant all on public.product_supplier_urls to service_role;
grant all on public.supplier_price_checks to service_role;

insert into public.product_pricing (variant_id, product_id, profit_margin_percent, fallback_cost_usd)
values ('v-s10-glo', 'g-steam-10', 10, 9.80)
on conflict (variant_id) do update set
  product_id = excluded.product_id,
  profit_margin_percent = excluded.profit_margin_percent,
  fallback_cost_usd = excluded.fallback_cost_usd,
  updated_at = now();

insert into public.product_supplier_urls (variant_id, supplier, url)
values
  ('v-s10-glo', 'g2a', 'https://www.g2a.com/es/steam-gift-card-10-usd-steam-key-global-i10000000258127'),
  ('v-s10-glo', 'eneba', 'https://www.eneba.com/latam/steam-gift-card-steam-wallet-gift-card-10-usd-steam-key-united-states'),
  ('v-s10-glo', 'eldorado', 'https://www.eldorado.gg/es/steam-gift-card/v/42?te_v1=3-0')
on conflict (variant_id, supplier) do update set url = excluded.url;
