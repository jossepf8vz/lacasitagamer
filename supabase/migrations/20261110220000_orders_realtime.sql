create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  display_id text not null unique,
  idempotency_key uuid not null unique,
  customer_email text not null,
  customer_phone text not null,
  payment_method text not null,
  payment_bank text not null,
  payment_reference text not null,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  subtotal_usd numeric(12, 2) not null check (subtotal_usd > 0),
  discount_usd numeric(12, 2) not null default 0 check (discount_usd >= 0),
  total_usd numeric(12, 2) not null check (total_usd > 0),
  bcv_rate numeric(14, 4) not null check (bcv_rate > 0),
  total_bs numeric(16, 2) not null check (total_bs > 0),
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_created_at_idx on public.orders (status, created_at desc);

alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
grant all on public.orders to service_role;

drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders"
  on public.orders
  for select
  to authenticated
  using (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@lacasitagamer.com'
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'orders'
    )
  then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
