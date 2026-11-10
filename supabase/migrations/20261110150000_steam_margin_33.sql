update public.product_pricing
set profit_margin_percent = 33,
    updated_at = now()
where variant_id = 'v-s10-glo'
  and product_id = 'g-steam-10';
