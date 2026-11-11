create or replace function public.sync_exchange_rate_and_recalculate_catalog(
  p_bcv_rate numeric,
  p_updated_at timestamptz,
  p_supplier_prices jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_updated_at timestamptz := coalesce(p_updated_at, now());
  v_products_updated integer;
  v_products jsonb;
begin
  perform public.sync_catalog_prices_with_bcv(
    p_bcv_rate,
    v_updated_at,
    p_supplier_prices
  );

  with repriced_products as (
    update public.product_pricing as pricing
    set profit_margin_percent = case
          when coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) < 20 then 33
          when coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) < 50 then 20
          else 8
        end,
        applied_margin_percent = case
          when coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) < 20 then 33
          when coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) < 50 then 20
          else 8
        end,
        final_price_usd = round(
          coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd)
          * case
              when coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) < 20 then 1.33
              when coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) < 50 then 1.20
              else 1.08
            end
          + 0.40,
          2
        ),
        final_price_bs = round(
          round(
            coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd)
            * case
                when coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) < 20 then 1.33
                when coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) < 50 then 1.20
                else 1.08
              end
            + 0.40,
            2
          ) * p_bcv_rate,
          2
        ),
        bcv_rate = p_bcv_rate,
        price_checked_at = v_updated_at,
        updated_at = v_updated_at
    where coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) > 0
    returning pricing.variant_id,
      pricing.product_id,
      coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) as best_price_usd,
      pricing.applied_margin_percent as profit_margin_percent,
      pricing.final_price_usd,
      pricing.final_price_bs
  )
  select count(*)::integer,
         coalesce(jsonb_agg(jsonb_build_object(
           'variant_id', variant_id,
           'product_id', product_id,
           'best_price_usd', best_price_usd,
           'profit_margin_percent', profit_margin_percent,
           'final_price_usd', final_price_usd,
           'final_price_bs', final_price_bs
         ) order by variant_id), '[]'::jsonb)
    into v_products_updated, v_products
    from repriced_products;

  return jsonb_build_object(
    'success', true,
    'bcv_rate', p_bcv_rate,
    'updated_at', v_updated_at,
    'products_updated', v_products_updated,
    'products', v_products
  );
end;
$$;

revoke all on function public.sync_exchange_rate_and_recalculate_catalog(numeric, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.sync_exchange_rate_and_recalculate_catalog(numeric, timestamptz, jsonb) to service_role;
