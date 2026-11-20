# BellaLovers ♡ — Club de beneficios BellaShop

Sitio: https://bellashopinsumos-dotcom.github.io/bellalovers/

Administrador: https://bellashopinsumos-dotcom.github.io/bellalovers/admin.html

Proyecto Supabase exclusivo: `xpnfdyfnaromfwkontid`.

## Iniciar sesión: ventana emergente, no sección fija

La página muestra normalmente la presentación, productos y beneficios de BellaLovers. **Iniciar sesión** en el menú o portada abre una ventana emergente rosada con **Iniciar sesión**, **Registrarse** y una **X** para cerrarla. Funciona en móvil; se puede cerrar tocando fuera o pulsando Esc.

- **Primera pantalla:** la persona escribe **celular o correo** y su **nombre y apellido**, tal como quedó registrada. No se muestra una clave en esa pantalla.
- **Si ya tiene una sesión aprobada guardada en ese dispositivo:** comprueba los datos y muestra su cuenta directamente, con compras, puntos y recompensas.
- **Si es un dispositivo nuevo o no hay sesión:** el nombre y celular/correo no demuestran identidad. Para evitar que cualquiera consulte compras y puntos ajenos, la persona debe confirmar su acceso con BellaShop. Si ya le dieron una clave privada, puede introducirla en el segundo paso; no se envían correos ni SMS.
- El servidor `bellalovers-ingresar` verifica que sea un miembro activo y comprueba identificador, nombre y credencial contra Supabase Auth. La consulta por correo `bl_resolve_member_email` solo está disponible para service_role; nunca se expone el correo de otras personas.
- **Registrarse** es solicitar ingreso, no crear una cuenta automáticamente. La aprobación requiere una primera compra real verificada y BellaShop puede entregar la clave de acceso sin usar Gmail.
- **Pérdida de acceso:** el administrador puede generar otra clave desde Clientas tras identificar a la titular. No se cambia el acceso administrativo desde el formulario de clientas.

**Seguridad:** no se muestran datos privados simplemente por introducir nombres y teléfonos, porque podrían ser conocidos por otras personas. Las sesiones previamente verificadas permanecen en el mismo dispositivo. El administrador controla las claves y permisos.

## Cuenta de BellaLover

Una vez autenticada, la clienta consulta su carné digital con fecha de ingreso, categoría, compras, canales (incluidas compras por WhatsApp o domicilio), movimientos y saldo de puntos, solicitudes y catálogo privado de recompensas.

Premios: si BellaShop todavía no publicó ninguno aparece **Próximamente**; si hay pero faltan puntos, se muestran bloqueados hasta **50 puntos**; desde entonces permite solicitar premios que alcance a cubrir con su saldo, sujetos a disponibilidad y revisión de BellaShop. No hay pagos en línea desde BellaLovers.

## Reglas y operaciones administrativas

- **Compras:** buscar por celular, confirmar la clienta y escribir valor de productos. Factura y canal opcionales, sin campo de transporte. Una referencia `REG-...` generada internamente no equivale a factura fiscal.
- **Puntos:** $50.000 en productos = 5 puntos y cada $10.000 completos adicionales, 1 punto. No se suman puntos sobre transporte ni compras de descuento especial. La primera compra de una estudiante no acumula puntos; su regalo de bienvenida depende de las reglas.
- **Clientas:** editar categoría autorizada, bloquear, desbloquear, archivar/restaurar, sumar/descontar puntos, **deshacer ajustes con auditoría** y eliminar acceso/datos de contacto, conservando trazabilidad contable.
- **Profesoras afiliadas:** solo el administrador agrega, edita, retira o reactiva profesoras. El formulario de solicitud muestra solo profesoras activas o Ninguna. Puntos de referidos sujetos a aprobación y afiliación real.
- **Premios:** crear/modificar productos de recompensa, foto, stock, costo y puntos. El catálogo se muestra dentro de la cuenta, no en el inicio público.
- **Equipo:** permisos separados y autorizados por la jefa, no registro público de administradores.

## Pendientes antes de difundir masivamente

1. La política publicada `politica-datos.html` todavía es un **borrador**, pendiente de completar por BellaShop y aprobar según la normativa. Debe actualizarse antes de recabar nuevos registros.
2. Probar el flujo completo con una solicitud y una primera compra **auténticas y autorizadas**: aceptación, aprobación, entrega de clave, inicio desde celular y canjes. No inventar clientas/facturas.
3. Configurar mitigación anti-bots en registro y revisar los límites de Supabase Auth. El sistema ya limita intentos de inicio, pero no reemplaza CAPTCHA.
4. Verificar el horario y funcionamiento del canal WhatsApp de BellaShop para soporte de claves. No se envían automáticamente mensajes a ninguna clienta.
5. En Supabase Auth habilitar, si el plan lo permite, protección contra contraseñas filtradas para el equipo.

El acceso con clave no exige SMTP ni ningún proveedor SMS.

## Archivos y despliegue

- UI: `index.html`, `assets/client.js`, `assets/premium.css`, `admin.html`, `assets/admin.js`.
- Auth clientas: `supabase/functions/bellalovers-ingresar/index.ts`, `supabase/functions/bellalovers-clave/index.ts`, `supabase/functions/bellalovers-aprobar/index.ts`.
- Función antigua de correo (deshabilitada): `supabase/functions/bellalovers-acceso/index.ts`.
- Scripts SQL en `supabase/migrations/` y configuración en `assets/config.js` (solo clave pública).
- Pruebas automáticas: `npm test` y GitHub Actions.

No se debe usar service_role en frontend ni cambiar cuentas administrativas desde el formulario de clientas.
