# PROYECTO: Portal Digital (Revista Digital Local y Multi-tenant)

- **Dominio:** [portal-digital.com.ar](http://portal-digital.com.ar)

- **Objetivo:** Directorio comercial interactivo local, expandible automáticamente por localidades a medida que se registran los comercios.

- **Arquitectura:** Multi-tenant con PostgreSQL (Supabase) y Next.js (App Router).

- **Estructura de URLs:** 

  - `/[localidad]` (Ej: `/garin`, `/tigre` - Creada automáticamente al registrar el primer comercio de la zona).

  - `/[localidad]/[slug-comercio]` (Ej: `/garin/panaderia-el-buen-gusto`).

- **Características clave:**

  1. **4 Temas Predefinidos:** Plantillas de diseño adaptables según el rubro (Kioscos, Indumentaria, Supermercados, General).

  2. **Carga Inteligente por Código de Barras:** Base de datos global de productos y fotos vinculadas por EAN/UPC para autocompletado rápido.

  3. **Auto-registro y Pagos:** Suscripción automatizada mediante Mercado Pago y webhooks para activación instantánea.

  4. **Panel de SuperAdmin:** Control de tiempos de banners de ofertas en Home (ej. rotación cada 7 segundos) y gestión general.