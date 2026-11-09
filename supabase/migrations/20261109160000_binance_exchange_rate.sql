create table if not exists public.exchange_rates (
  source text primary key,
  rate numeric(14, 4) not null check (rate > 0),
  updated_at timestamptz not null default now()
);

alter table public.exchange_rates enable row level security;
revoke all on public.exchange_rates from anon, authenticated;
grant all on public.exchange_rates to service_role;
