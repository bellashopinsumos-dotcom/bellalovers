# BellaLovers ♡ — Club de beneficios BellaShop

Sitio: https://bellashopinsumos-dotcom.github.io/bellalovers/

Administrador: https://bellashopinsumos-dotcom.github.io/bellalovers/admin.html

Proyecto Supabase exclusivo: `xpnfdyfnaromfwkontid`.

## Inicio de sesión SIN clave, correo de confirmación ni SMS

La portada se mantiene normal. Al tocar **Iniciar sesión** se abre una ventana con las pestañas **Iniciar sesión**, **Registrarse** y una **X** para cerrar. La clienta escribe únicamente **celular o correo y nombre completo**.

- **Sesión previamente autorizada en el mismo dispositivo:** entra directamente si los datos corresponden a la clienta de esa sesión.
- **Dispositivo nuevo o sin sesión:** se envía una **solicitud temporal de acceso** al administrador; no aparece ninguna clave. En Administrador → **Solicitudes de ingreso → Solicitudes para entrar a Mi cuenta**, BellaShop **comprueba la identidad de la persona por WhatsApp o presencialmente**, pulsa Aprobar o Rechazar y la ventana del dispositivo original se actualiza automáticamente, mientras permanezca abierta.
- Las solicitudes vencen a los **10 minutos**. El servidor no indica a un desconocido si el celular o correo existe. El reto aleatorio se genera localmente con un generador criptográfico y solo su huella se almacena en la base de datos. Una aprobación solo sirve para ese dispositivo y se consume una vez.
- Para crear una sesión válida, Supabase genera un enlace de Auth interno y de uso único que se **consume dentro de la función de servidor**; no se envía un correo ni SMS a la clienta. Los tokens de sesión solo se entregan al dispositivo aprobado.
- El administrador únicamente puede autorizar accesos si tiene la sesión y el rol apropiados. Su aprobación se guarda en auditoría.
- **Registrarse** sigue siendo solicitar ingreso al club; no equivale a crear una cuenta. La jefa aprueba la membresía cuando verifica la primera compra real.

El endpoint anterior de generar claves de clientas está **desactivado**. Las cuentas previamente aprobadas no pierden su historial, compras ni puntos. No modificar la contraseña del administrador ni exponerla en frontend. Este flujo requiere comprobar extremo a extremo la emisión de sesión Auth con una cuenta real autorizada.

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
2. Probar el flujo completo con una primera compra real autorizada: solicitud de ingreso, aprobación, solicitud de acceso desde celular, verificación humana por BellaShop, autorización en admin y consulta de compras y premios.
3. Configurar mitigación anti-bots en registro y revisar los límites de Supabase Auth. El sistema ya limita intentos de inicio, pero no reemplaza CAPTCHA.
4. Definir quién en BellaShop atiende por WhatsApp la verificación de identidad antes de autorizar el acceso; no se envían mensajes automáticamente.
5. En Supabase Auth habilitar, si el plan lo permite, protección contra contraseñas filtradas para el equipo.

El acceso con aprobación humana no exige SMTP ni proveedor de SMS. La cuenta se autentica con tokens válidos emitidos por Supabase tras la autorización.

## Archivos y despliegue

- UI: `index.html`, `assets/client.js`, `assets/premium.css`, `admin.html`, `assets/admin.js`.
- Auth clientas: `supabase/functions/bellalovers-ingresar/index.ts`, `supabase/functions/bellalovers-aprobar/index.ts` y la tabla `bl_login_requests`; `bellalovers-clave` permanece deshabilitada (HTTP 410).
- Función antigua de correo (deshabilitada): `supabase/functions/bellalovers-acceso/index.ts`.
- Scripts SQL en `supabase/migrations/` y configuración en `assets/config.js` (solo clave pública).
- Pruebas automáticas: `npm test` y GitHub Actions.

No se debe usar service_role en frontend ni cambiar cuentas administrativas desde el formulario de clientas.
