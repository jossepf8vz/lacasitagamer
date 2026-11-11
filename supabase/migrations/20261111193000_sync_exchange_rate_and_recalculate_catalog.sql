create or replace function public.sync_exchange_rate_and_recalculate_catalog(
  p_bcv_rate numeric,
  p_updated_at timestamptz,
  p_supplier_prices jsonb default '[]'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select public.sync_catalog_prices_with_bcv(
    p_bcv_rate,
    p_updated_at,
    p_supplier_prices
  );
$$;

revoke all on function public.sync_exchange_rate_and_recalculate_catalog(numeric, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.sync_exchange_rate_and_recalculate_catalog(numeric, timestamptz, jsonb) to service_role;
