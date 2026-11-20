# BellaLovers - activación de la página (demostración)

## Paso único que debe hacer el dueño del repositorio

1. Entrar a **Settings** del repositorio `bellashopinsumos-dotcom/bellalovers`.
2. Abrir **Pages** en la sección **Code and automation**.
3. En **Build and deployment**, elegir **Deploy from a branch**.
4. En **Branch**, seleccionar **main** y la carpeta **/(root)**.
5. Pulsar **Save**.

URL esperada una vez publicado: https://bellashopinsumos-dotcom.github.io/bellalovers/

La página de demostración está en `index.html` y el panel en `admin.html`. Los archivos fuente ya están en `main`; no hay que subir ZIP manualmente.

## Antes del lanzamiento comercial

El registro y los puntos reales permanecen desactivados. Faltan un proyecto de Supabase separado, proveedor SMS, administradores seguros, política de datos aprobada, definición de premios y pruebas de seguridad y facturación. **No registrar datos de clientas reales en la demostración.**

Las reglas originales y el SQL de preparación están en `LEEME-PRIMERO.md` y `supabase/schema.sql`. El inventario de BellaShop no está conectado y no deben anunciarse premios reales hasta validarlos.

## Aviso sobre GitHub Actions

Se incluyó un flujo de publicación automática, pero GitHub no permitió habilitar Pages desde la integración. Por eso la **primera activación de Pages debe hacerse en Settings**, como se explica arriba. La publicación desde la rama principal evita depender de esa automatización.
