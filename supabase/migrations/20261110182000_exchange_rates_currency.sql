alter table public.exchange_rates
  add column if not exists currency text;

update public.exchange_rates
set currency = 'USD'
where source = 'bcv_official_ves'
  and currency is null;

create unique index if not exists exchange_rates_currency_key
  on public.exchange_rates (currency);

alter table public.exchange_rates
  alter column source set default 'bcv_official_ves';
