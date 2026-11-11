alter table public.supplier_price_checks
  add column if not exists final_price_usd numeric(12, 2)
    check (final_price_usd is null or final_price_usd > 0);
