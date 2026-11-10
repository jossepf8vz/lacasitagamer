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

- `/api/bcv-rate` consulta la tasa oficial, la guarda en `exchange_rates` con el origen `bcv_official_ves` y la devuelve a la PWA para mostrarla en el banner.
- `/api/cron/test-steam` actualiza la tasa BCV, consulta los proveedores configurados para `v-s10-glo` (Steam Gift Card $10) y guarda los resultados en `supplier_price_checks`. Requiere `Authorization: Bearer <CRON_SECRET>`; solo declara éxito si al menos un proveedor devuelve un precio válido.
- Binance P2P permanece privado; la tasa BCV se expone únicamente a través de la API pública utilizada por el banner.
