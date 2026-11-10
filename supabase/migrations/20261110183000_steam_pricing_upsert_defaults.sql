create or replace function public.set_steam_product_pricing_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.variant_id = 'v-s10-glo' then
    new.product_id := 'g-steam-10';
    new.profit_margin_percent := 33;
  end if;

  return new;
end;
$$;

drop trigger if exists steam_product_pricing_defaults on public.product_pricing;

create trigger steam_product_pricing_defaults
before insert or update on public.product_pricing
for each row
execute function public.set_steam_product_pricing_defaults();
