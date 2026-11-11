alter table public.sales
  add column if not exists delivered_key text;

alter table public.sales
  drop constraint if exists sales_status_check;

alter table public.sales
  add constraint sales_status_check
  check (status in ('pendiente', 'aprobado', 'completado'));
