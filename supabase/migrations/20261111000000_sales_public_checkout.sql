alter table public.sales
  add column if not exists payment_method text,
  add column if not exists payment_reference text;

update public.sales
set
  payment_method = coalesce(payment_method, method),
  payment_reference = coalesce(payment_reference, reference)
where payment_method is null or payment_reference is null;

alter table public.sales
  alter column payment_method set not null,
  alter column payment_reference set not null;

alter table public.sales
  drop constraint if exists sales_payment_method_check,
  add constraint sales_payment_method_check
    check (payment_method in ('pago_movil', 'binance')),
  drop constraint if exists sales_payment_reference_length_check,
  add constraint sales_payment_reference_length_check
    check (char_length(payment_reference) between 3 and 80);

create or replace function public.sync_sales_payment_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.method := coalesce(new.method, new.payment_method);
  new.reference := coalesce(new.reference, new.payment_reference);
  new.payment_method := coalesce(new.payment_method, new.method);
  new.payment_reference := coalesce(new.payment_reference, new.reference);
  return new;
end;
$$;

drop trigger if exists sync_sales_payment_fields on public.sales;
create trigger sync_sales_payment_fields
before insert or update on public.sales
for each row
execute function public.sync_sales_payment_fields();

revoke insert, update, delete on public.sales from anon, authenticated;
grant insert (order_id, variant_id, total, payment_method, payment_reference, customer_info, status)
  on public.sales to anon, authenticated;
grant select (id, order_id) on public.sales to anon;

drop policy if exists "Checkout can create pending sales" on public.sales;
create policy "Checkout can create pending sales"
  on public.sales
  for insert
  to anon, authenticated
  with check (
    status = 'pendiente'
    and variant_id ~ '^[a-zA-Z0-9_-]{1,100}$'
    and char_length(payment_reference) between 3 and 80
    and customer_info is not null
    and jsonb_typeof(customer_info) = 'object'
    and lower(coalesce(customer_info ->> 'email', '')) ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    and char_length(coalesce(customer_info ->> 'name', '')) between 2 and 120
    and char_length(coalesce(customer_info ->> 'phone', '')) between 7 and 25
  );

drop policy if exists "Checkout can read public order identifiers" on public.sales;
create policy "Checkout can read public order identifiers"
  on public.sales
  for select
  to anon
  using (true);

drop policy if exists "Customers can read their own sales" on public.sales;
create policy "Customers can read their own sales"
  on public.sales
  for select
  to authenticated
  using (lower(coalesce(customer_info ->> 'email', '')) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "Checkout can upload payment proofs" on storage.objects;
create policy "Checkout can upload payment proofs"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'payment-proofs'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp)$'
    and coalesce(metadata ->> 'mimetype', '') in ('image/png', 'image/jpeg', 'image/webp')
    and coalesce(nullif(metadata ->> 'size', '')::bigint, 0) between 1 and 5242880
  );
