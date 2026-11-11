create or replace function public.sync_catalog_prices_with_bcv(
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
  if p_bcv_rate is null or p_bcv_rate < 1 or p_bcv_rate > 10000 then
    raise exception 'La tasa BCV debe estar entre 1 y 10000.';
  end if;

  if p_supplier_prices is null or jsonb_typeof(p_supplier_prices) <> 'array' then
    raise exception 'Los precios de proveedor deben enviarse como una lista JSON.';
  end if;

  insert into public.exchange_rates (currency, rate, updated_at)
  values ('USD', p_bcv_rate, v_updated_at)
  on conflict (currency) do update
  set rate = excluded.rate,
      updated_at = excluded.updated_at;

  with supplier_prices as (
    select *
    from jsonb_to_recordset(p_supplier_prices) as item(
      variant_id text,
      cost_usd numeric,
      supplier text,
      seller_name text,
      offer_url text
    )
  ),
  updated_products as (
    update public.product_pricing as pricing
    set current_cost_usd = coalesce(supplier_prices.cost_usd, pricing.current_cost_usd),
        current_supplier = coalesce(supplier_prices.supplier, pricing.current_supplier),
        current_seller_name = coalesce(supplier_prices.seller_name, pricing.current_seller_name),
        current_offer_url = coalesce(supplier_prices.offer_url, pricing.current_offer_url),
        profit_margin_percent = case
          when coalesce(supplier_prices.cost_usd, pricing.current_cost_usd, pricing.fallback_cost_usd) < 20 then 33
          when coalesce(supplier_prices.cost_usd, pricing.current_cost_usd, pricing.fallback_cost_usd) < 50 then 20
          else 8
        end,
        applied_margin_percent = case
          when coalesce(supplier_prices.cost_usd, pricing.current_cost_usd, pricing.fallback_cost_usd) < 20 then 33
          when coalesce(supplier_prices.cost_usd, pricing.current_cost_usd, pricing.fallback_cost_usd) < 50 then 20
          else 8
        end,
        final_price_usd = round(
          case
            when coalesce(supplier_prices.cost_usd, pricing.current_cost_usd, pricing.fallback_cost_usd) < 20
              then coalesce(supplier_prices.cost_usd, pricing.current_cost_usd, pricing.fallback_cost_usd) * 1.33 + 0.40
            when coalesce(supplier_prices.cost_usd, pricing.current_cost_usd, pricing.fallback_cost_usd) < 50
              then coalesce(supplier_prices.cost_usd, pricing.current_cost_usd, pricing.fallback_cost_usd) * 1.20
            else coalesce(supplier_prices.cost_usd, pricing.current_cost_usd, pricing.fallback_cost_usd) * 1.08
          end,
          2
        ),
        final_price_bs = round(
          round(
            case
              when coalesce(supplier_prices.cost_usd, pricing.current_cost_usd, pricing.fallback_cost_usd) < 20
                then coalesce(supplier_prices.cost_usd, pricing.current_cost_usd, pricing.fallback_cost_usd) * 1.33 + 0.40
              when coalesce(supplier_prices.cost_usd, pricing.current_cost_usd, pricing.fallback_cost_usd) < 50
                then coalesce(supplier_prices.cost_usd, pricing.current_cost_usd, pricing.fallback_cost_usd) * 1.20
              else coalesce(supplier_prices.cost_usd, pricing.current_cost_usd, pricing.fallback_cost_usd) * 1.08
            end,
            2
          ) * p_bcv_rate,
          2
        ),
        bcv_rate = p_bcv_rate,
        price_checked_at = v_updated_at,
        updated_at = v_updated_at
    from supplier_prices
    where pricing.variant_id = supplier_prices.variant_id
      and supplier_prices.cost_usd > 0
      and supplier_prices.supplier = 'eneba'
    returning pricing.variant_id, pricing.product_id, pricing.current_cost_usd,
      pricing.applied_margin_percent, pricing.final_price_usd, pricing.final_price_bs
  ),
  repriced_products as (
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
          case
            when coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) < 20
              then coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) * 1.33 + 0.40
            when coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) < 50
              then coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) * 1.20
            else coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) * 1.08
          end,
          2
        ),
        final_price_bs = round(
          round(
            case
              when coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) < 20
                then coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) * 1.33 + 0.40
              when coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) < 50
                then coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) * 1.20
              else coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) * 1.08
            end,
            2
          ) * p_bcv_rate,
          2
        ),
        bcv_rate = p_bcv_rate,
        price_checked_at = v_updated_at,
        updated_at = v_updated_at
    where coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd) > 0
      and not exists (
        select 1
        from supplier_prices
        where supplier_prices.variant_id = pricing.variant_id
          and supplier_prices.cost_usd > 0
          and supplier_prices.supplier = 'eneba'
      )
    returning pricing.variant_id, pricing.product_id, coalesce(pricing.current_cost_usd, pricing.fallback_cost_usd)
      as best_price_usd, pricing.applied_margin_percent, pricing.final_price_usd, pricing.final_price_bs
  ),
  all_updated_products as (
    select variant_id, product_id, current_cost_usd as best_price_usd, applied_margin_percent,
      final_price_usd, final_price_bs
    from updated_products
    union all
    select variant_id, product_id, best_price_usd, applied_margin_percent, final_price_usd, final_price_bs
    from repriced_products
  )
  select count(*)::integer,
         coalesce(jsonb_agg(jsonb_build_object(
           'variant_id', variant_id,
           'product_id', product_id,
           'best_price_usd', best_price_usd,
           'profit_margin_percent', applied_margin_percent,
           'final_price_usd', final_price_usd,
           'final_price_bs', final_price_bs
         ) order by variant_id), '[]'::jsonb)
  into v_products_updated, v_products
  from all_updated_products;

  return jsonb_build_object(
    'success', true,
    'bcv_rate', p_bcv_rate,
    'updated_at', v_updated_at,
    'products_updated', v_products_updated,
    'products', v_products
  );
end;
$$;

revoke all on function public.sync_catalog_prices_with_bcv(numeric, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.sync_catalog_prices_with_bcv(numeric, timestamptz, jsonb) to service_role;
