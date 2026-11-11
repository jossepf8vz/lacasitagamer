# Precios de proveedores

1. Ejecuta `migrations/20261109000000_supplier_pricing.sql` en el SQL Editor de Supabase. La migración crea las tablas de configuración y caché, desactiva el acceso directo desde `anon`/`authenticated` y agrega URLs de ejemplo para la variante `v-s10-glo`.
2. En Supabase Auth, crea la cuenta administrativa y asigna `{"role":"admin"}` a su `app_metadata` desde un entorno confiable. No asignes este rol desde el cliente.
3. Configura en local y en Vercel las variables de `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` es solo para el servidor; nunca la uses con el prefijo `NEXT_PUBLIC_`.
4. Inicia sesión con la cuenta administrativa, abre **Acceso Admin → Proveedores**, elige una variante y pulsa **Actualizar y comparar**. La comparación se guarda en Supabase y los clientes solo reciben `final_usd` y `final_bs`.

Las URLs solo se consultan en HTTPS y los hosts están limitados a `g2a.com`, `eneba.com` y `eldorado.gg`. La extracción HTML puede no funcionar si un proveedor cambia su página o bloquea solicitudes; en ese caso se usa `fallback_cost_usd`, cuando está configurado. El enlace de compra abre el sitio del proveedor para que una persona revise y complete su compra.

## Tasa Binance P2P

1. Ejecuta `migrations/20261109160000_binance_exchange_rate.sql` en el SQL Editor de Supabase para crear el caché privado de tasas.
2. Configura `CRON_SECRET` como variable de entorno en Vercel y en el entorno local si necesitas probar la ruta de cron. No la expongas con el prefijo `NEXT_PUBLIC_`.
3. `vercel.json` programa `/api/cron/binance-rate` cada cinco minutos. El panel de administración también solicita una actualización al abrir Analíticas y lee la tasa y su fecha guardadas; la ruta privada requiere el rol admin.
4. La tasa almacenada es la mediana de hasta diez ofertas válidas de venta USDT/VES devueltas por Binance P2P. La disponibilidad del cron programado depende del plan de Vercel; si el plan no admite esta frecuencia, configura un scheduler externo para llamar la misma ruta con `Authorization: Bearer <CRON_SECRET>`.

## Tasa BCV y prueba de Steam

- Ejecuta `migrations/20261110182000_exchange_rates_currency.sql` para agregar `exchange_rates.currency`, vincular el registro BCV existente con `USD` y habilitar el upsert por moneda.
- Ejecuta `migrations/20261110183000_steam_pricing_upsert_defaults.sql` para que el upsert limitado de la variante Steam complete los campos obligatorios `product_id` y `profit_margin_percent` sin enviarlos desde la ruta.
- Ejecuta `migrations/20261110190000_supplier_price_check_history.sql` para convertir `supplier_price_checks` en un historial con un ID propio, sin unicidad por variante/proveedor.
- `/api/bcv-rate` consulta `https://api.montosve.com/v1/tasas/actual` con la variable de servidor `MONTOSVE_API_KEY`. Guarda la tasa en `product_pricing.bcv_rate` y en `exchange_rates` (`currency = 'USD'`), recalculando `final_price_bs` cuando existe `final_price_usd`.
- `/api/cron/test-steam` actualiza la tasa BCV, consulta los proveedores configurados para `v-s10-glo` (Steam Gift Card $10) y guarda los resultados en `supplier_price_checks`. Requiere `Authorization: Bearer <CRON_SECRET>`; solo declara éxito si Eneba y G2A devuelven ofertas válidas y se guarda el precio calculado.
- Binance P2P permanece privado; la tasa BCV se expone únicamente a través de la API pública utilizada por el banner.
- `/api/cron/test-steam` agrega cada consulta a `supplier_price_checks` como historial; aplica la migración indicada arriba para permitir registros repetidos por variante/proveedor.

## Ofertas de Steam Eneba/G2A

1. Ejecuta `migrations/20261110140000_steam_offer_pricing.sql` y `migrations/20261110150000_steam_margin_33.sql` para guardar vendedor y enlace directo por oferta, el precio ganador, el margen aplicado y el total en Bs. La segunda migración fija el margen de `v-s10-glo` en 33%. La primera también fija las URLs públicas de Eneba y G2A para esa variante.
2. Programa cron-job.org para llamar `GET /api/cron/test-steam` con `Authorization: Bearer <CRON_SECRET>`. El endpoint responde JSON con HTTP 200 y detalla fallos de proveedor/BCV en el cuerpo.
3. El parser solo acepta ofertas no patrocinadas que estén presentes en estado JSON público y cuya moneda USD se pueda verificar. No simula un navegador ni sortea desafíos; si la página no expone ofertas parseables, informa proveedor no disponible y no actualiza el precio ganador.
4. El cron aplica un margen fijo del 33% al costo base del proveedor. La tienda lee el snapshot final guardado por el cron y calcula su equivalente en Bs. con la tasa BCV; el panel muestra el vendedor y enlace disponibles al actualizar la comparación.

La ruta `/api/bcv-rate` consulta MontosVE con `X-API-Key`; si falta la clave o la API falla, devuelve la última tasa válida de `exchange_rates` (`currency = 'USD'`, o `source = 'bcv_official_ves'` como compatibilidad) y como último respaldo la tasa de la variante Steam en `product_pricing`. Cada tasa externa válida se persiste con fecha actual y recalcula los precios Bs. La clave API debe configurarse como `MONTOSVE_API_KEY` solo en el servidor, nunca con prefijo `NEXT_PUBLIC_`. Devuelve `bcv_rate` y `source`; el checkout también consulta esta ruta cuando todavía no tiene una tasa en memoria y solo detiene el pedido cuando no hay ninguna tasa válida disponible.

## Checkout, pedidos y Supabase Realtime

1. Ejecuta `migrations/20261110220000_orders_realtime.sql` en el SQL Editor de Supabase. Crea `public.orders`, habilita lectura únicamente para administradores autenticados y agrega la tabla a la publicación `supabase_realtime`.
2. `/api/orders` registra la referencia y el detalle de compra con estado `pendiente`. No emite ni inventa claves; el panel requiere validación humana del pago.
3. El panel admin consulta `/api/admin/orders` y escucha los cambios de `public.orders` por Realtime. La aprobación del pago actualiza el registro usando la ruta protegida `/api/admin/orders`.
4. Después de aplicar la migración, verifica que `supabase_realtime` esté habilitada en el proyecto y que la cuenta admin cumpla la política (rol `admin` en `app_metadata` o email administrativo configurado).
5. Para aceptar comprobantes de Binance, ejecuta también `migrations/20261110223000_payment_proofs.sql`. Crea el bucket privado `payment-proofs`; el servidor valida y guarda imágenes PNG/JPG/WebP de hasta 5 MB, y el panel admin genera enlaces firmados temporales para verlas. No se conceden permisos públicos al bucket.
6. El checkout muestra los datos de Pago Móvil configurados en la interfaz (Banco Provincial, cédula/RIF y teléfono) con botones para copiar. No se incluyó una dirección/UID de Binance porque debe confirmarse y configurarse por un canal seguro antes de recibir USDT.
