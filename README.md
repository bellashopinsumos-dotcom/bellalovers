# BellaLovers ♡ — club de beneficios de BellaShop

Sitio en GitHub Pages, administrador exclusivo y base de datos independiente en Supabase.

- **Página:** https://bellashopinsumos-dotcom.github.io/bellalovers/
- **Administrador:** https://bellashopinsumos-dotcom.github.io/bellalovers/admin.html
- **Supabase BellaLovers:** https://supabase.com/dashboard/project/xpnfdyfnaromfwkontid

## Flujo oficial aprobado en el código — sin SMS

1. Una persona **solicita** ser BellaLover desde la página: nombre, celular, correo, categoría y aceptación de política de datos.
2. La solicitud queda **pendiente** y **no crea** membresía, puntos ni acceso a cuentas. Tampoco requiere código SMS.
3. Cuando esa persona haga su **primera compra**, BellaShop verifica su factura real, presencial, por WhatsApp, web o domicilio.
4. Desde administración → **Solicitudes de ingreso**, la jefa selecciona la solicitud, introduce número único de factura, valor de productos y canal, y pulsa **Confirmar factura y aprobar membresía**.
5. Una función segura de Supabase, `bellalovers-aprobar`, verifica la sesión de administrador, envía una **invitación al correo** y registra la membresía, factura y puntos a través de una operación controlada.
6. La clienta puede entrar a **Mi cuenta** mediante un enlace de un solo uso enviado a su correo. El envío del enlace usa `signInWithOtp` **con `shouldCreateUser:false`**: no crea usuarios nuevos.

La jefa también puede **rechazar** solicitudes dando un motivo; la decisión queda auditada. Nunca se aprueba automáticamente por el simple hecho de enviar el formulario o conocer el enlace.

**Muy importante:** el celular de la solicitud es de contacto y **no queda verificado digitalmente**. BellaShop debe contrastar ese número, el nombre y la factura de la compra al aprobar la solicitud. La propiedad del correo sí se prueba al abrir el enlace enviado allí.

## Reglas de puntos

- Compra elegible desde **$50.000 en productos = 5 puntos**.
- Cada **$10.000 completos adicionales = 1 punto**.
- El valor de transporte no suma puntos; los **productos pedidos con domicilio sí cuentan**.
- Las facturas de WhatsApp también cuentan. Se requiere registrarlas y confirmarlas en administración; no se leen conversaciones automáticamente.
- Compras con descuentos especiales y anuladas no acumulan puntos.
- Las **estudiantes no reciben puntos por su primera compra válida**; pueden obtener el regalo de bienvenida desde $150.000 si se cumplen sus condiciones.
- Se requieren 50 puntos para solicitar premios; ciclos de 12 meses, con 30 días de gracia según el programa.

Las reglas ya programadas en el backend se conservan; aprobar la solicitud con su primera factura hace el cálculo automáticamente.

## Administrador

- **Solicitudes de ingreso:** revisar, aprobar tras primera compra, rechazar, historial.
- **Clientas:** saldos, movimientos, categorías, bloqueo, archivo y restauración con auditoría.
- **Compras:** facturas únicas, canales WhatsApp/tienda/web/domicilio, anulaciones y puntos.
- **Recompensas:** crear y editar premios con fotografía, stock, referencia, costo y categoría. Los premios aparecen **dentro de la cuenta de clientas aprobadas**, no en la portada pública.
- **Profesoras:** referidos, códigos y beneficios según condiciones.
- **Equipo y accesos:** permisos para operadores y administradores previamente autorizados.
- **Configuración:** activar o pausar la **recepción de solicitudes**; las aprobaciones siguen siendo siempre manuales.

El formulario para crear el primer administrador desde la web está deshabilitado. Los administradores deben crearse y autorizarse desde el panel privado de Supabase.

## Qué falta para abrir solicitudes al público

La recepción pública está **desactivada** (`bl_settings.join_requests_open=false`). El viejo inicio automático por SMS está desactivado (`signup_open=false`, sin permiso de ejecutar `bl_register`). Para activar:

1. **Completar y aprobar la política de datos**: la página `politica-datos.html` sigue siendo un BORRADOR; faltan nombre legal/NIT, dirección, vigencia y revisión de terceros encargados. No abrir el formulario de datos personales antes de publicar una versión adecuada.
2. En Supabase → **Authentication → URL Configuration**, configurar:
   - Site URL: `https://bellashopinsumos-dotcom.github.io/bellalovers/`
   - Redirect URL adicional: `https://bellashopinsumos-dotcom.github.io/bellalovers/`
3. Revisar el proveedor de **envío de correos** de Supabase y sus límites. Se usa para invitaciones y enlaces de acceso, no SMS. Para volumen real puede requerir un SMTP propio.
4. Configurar medidas antiabuso del formulario antes de difusión amplia (por ejemplo, CAPTCHA). Existe una comprobación básica de frecuencia por correo/teléfono, pero no sustituye un sistema profesional de prevención de bots.
5. Entrar al administrador → Configuración, marcar que la jefa aprobó la política definitiva y pulsar **Abrir recepción de solicitudes**.
6. Completar una prueba real controlada de solicitud → primera factura → invitación → inicio de sesión, antes de promocionar masivamente el programa.

La inscripción es **solicitud**, NO membresía. Crear usuarios desde el botón público no es posible. Nadie debe transmitir una contraseña ni una clave privada por WhatsApp o GitHub.

## Seguridad y componentes

- Supabase RLS: `bl_join_requests` solo puede ser consultada por personal administrador autenticado; `anon` carece de permiso de lectura.
- La RPC pública de solicitud valida y limita repeticiones por contacto, sin exponer si un correo ya existe.
- La función Edge `bellalovers-aprobar` tiene validación JWT y verifica en servidor el rol de administrador activo. Su clave secreta vive exclusivamente en el entorno de Supabase.
- La RPC de aprobación exige primera factura única y vincula la cuenta a la compra. El rechazo requiere motivo.
- Al fallar la confirmación de la compra, se intenta eliminar el usuario invitado recién creado para no dejar cuentas parciales.
- Los puntos de clientas se consultan solo con su sesión autorizada. Los saldos no se almacenan como verdad en el navegador.
- El análisis de seguridad de Supabase reporta un aviso sobre **protección contra contraseñas filtradas desactivada** para Auth. Revisar: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Código y migraciones

- Frontend: `index.html`, `admin.html`, `assets/client.js`, `assets/admin.js`.
- Función de aprobación: `supabase/functions/bellalovers-aprobar/index.ts` (deploy ya realizado en BellaLovers).
- Base: `supabase/schema.sql`.
- Incrementales (en orden): `20261120_restauracion_y_equipo.sql` → `20261120_premios_canales_registro.sql` → `20261120_seguridad_admin.sql` → `20261120_solicitudes_y_primera_compra.sql`.

**Los cambios del esquema ya se aplicaron solo al proyecto BellaLovers**. No ejecutar migraciones en RutaYa, Master Viviana ni inventario de BellaShop.

Pruebas: `npm test` y `node --check` en GitHub Actions. Las pruebas de sintaxis y reglas no sustituyen una prueba completa de correo y compras reales.
