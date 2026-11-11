create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  variant_id text not null,
  total numeric(12, 2) not null check (total > 0),
  method text not null check (method in ('pago_movil', 'binance')),
  reference text not null,
  customer_info jsonb not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, variant_id)
);

create index if not exists sales_created_at_idx on public.sales (created_at desc);
create index if not exists sales_order_id_idx on public.sales (order_id);

alter table public.sales enable row level security;
revoke all on public.sales from anon, authenticated;
grant select on public.sales to authenticated;
grant all on public.sales to service_role;

drop policy if exists "Admins can read sales" on public.sales;
create policy "Admins can read sales"
  on public.sales
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
        and tablename = 'sales'
    )
  then
    alter publication supabase_realtime add table public.sales;
  end if;
end;
$$;
