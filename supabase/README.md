# Precios de proveedores

1. Ejecuta `migrations/20261109000000_supplier_pricing.sql` en el SQL Editor de Supabase. La migración crea las tablas de configuración y caché, desactiva el acceso directo desde `anon`/`authenticated` y agrega URLs de ejemplo para la variante `v-s10-glo`.
2. En Supabase Auth, crea la cuenta administrativa y asigna `{"role":"admin"}` a su `app_metadata` desde un entorno confiable. No asignes este rol desde el cliente.
3. Configura en local y en Vercel las variables de `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` es solo para el servidor; nunca la uses con el prefijo `NEXT_PUBLIC_`.
4. Inicia sesión con la cuenta administrativa, abre **Acceso Admin → Proveedores**, elige una variante y pulsa **Actualizar y comparar**. La comparación se guarda en Supabase y los clientes solo reciben `final_usd` y `final_bs`.

Las URLs solo se consultan en HTTPS y los hosts están limitados a `g2a.com`, `eneba.com` y `eldorado.gg`. La extracción HTML puede no funcionar si un proveedor cambia su página o bloquea solicitudes; en ese caso se usa `fallback_cost_usd`, cuando está configurado. El enlace de compra abre el sitio del proveedor para que una persona revise y complete su compra.
