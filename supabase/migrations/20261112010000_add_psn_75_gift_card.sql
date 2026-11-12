do $$
declare
  v_bcv_rate numeric;
  v_initial_cost_usd constant numeric := 72.38;
  v_updated_at timestamptz := now();
begin
  select rate
    into v_bcv_rate
    from public.exchange_rates
   where currency = 'USD'
   order by updated_at desc
   limit 1;

  if v_bcv_rate is null or v_bcv_rate <= 0 then
    raise exception 'No existe una tasa USD válida en exchange_rates para registrar PlayStation Network Card $75 USD.';
  end if;

  insert into public.product_pricing as existing (
    variant_id,
    product_id,
    profit_margin_percent,
    category,
    platform,
    stock,
    current_cost_usd,
    current_supplier,
    current_offer_url,
    final_price_usd,
    final_price_bs,
    bcv_rate,
    applied_margin_percent,
    price_checked_at,
    updated_at
  )
  values (
    'v-ps75-us',
    'g-psn-75',
    8,
    'PlayStation / Gift Cards',
    'PlayStation',
    25,
    v_initial_cost_usd,
    'eneba',
    'https://www.eneba.com/latam/psn-playstation-network-card-75-usd-usa-psn-key-united-states',
    round(v_initial_cost_usd * 1.08, 2),
    round(round(v_initial_cost_usd * 1.08, 2) * v_bcv_rate, 2),
    v_bcv_rate,
    8,
    v_updated_at,
    v_updated_at
  )
  on conflict (variant_id) do update set
    product_id = excluded.product_id,
    category = excluded.category,
    platform = excluded.platform,
    stock = excluded.stock,
    current_cost_usd = coalesce(existing.current_cost_usd, excluded.current_cost_usd),
    current_supplier = coalesce(existing.current_supplier, excluded.current_supplier),
    current_offer_url = excluded.current_offer_url,
    profit_margin_percent = case
      when coalesce(existing.current_cost_usd, excluded.current_cost_usd) < 20 then 33
      when coalesce(existing.current_cost_usd, excluded.current_cost_usd) < 50 then 20
      else 8
    end,
    final_price_usd = round(
      coalesce(existing.current_cost_usd, excluded.current_cost_usd)
      * case
          when coalesce(existing.current_cost_usd, excluded.current_cost_usd) < 20 then 1.33
          when coalesce(existing.current_cost_usd, excluded.current_cost_usd) < 50 then 1.20
          else 1.08
        end,
      2
    ),
    final_price_bs = round(
      round(
        coalesce(existing.current_cost_usd, excluded.current_cost_usd)
        * case
            when coalesce(existing.current_cost_usd, excluded.current_cost_usd) < 20 then 1.33
            when coalesce(existing.current_cost_usd, excluded.current_cost_usd) < 50 then 1.20
            else 1.08
          end,
        2
      )
      * v_bcv_rate,
      2
    ),
    bcv_rate = v_bcv_rate,
    applied_margin_percent = case
      when coalesce(existing.current_cost_usd, excluded.current_cost_usd) < 20 then 33
      when coalesce(existing.current_cost_usd, excluded.current_cost_usd) < 50 then 20
      else 8
    end,
    price_checked_at = v_updated_at,
    updated_at = v_updated_at;

  insert into public.product_supplier_urls (variant_id, supplier, url)
  values (
    'v-ps75-us',
    'eneba',
    'https://www.eneba.com/latam/psn-playstation-network-card-75-usd-usa-psn-key-united-states'
  )
  on conflict (variant_id, supplier) do update set
    url = excluded.url;
end;
$$;
