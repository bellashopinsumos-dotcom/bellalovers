# BellaLovers: cómo abrirlo y usarlo

Página: https://bellashopinsumos-dotcom.github.io/bellalovers/

Administrador: https://bellashopinsumos-dotcom.github.io/bellalovers/admin.html

## Ahora el club funciona por aprobación, SIN SMS

- La persona llena una **solicitud de ingreso** desde la web con nombre, celular, correo y categoría.
- Su solicitud aparece en **Administrador → Solicitudes de ingreso**, sin crear membresía ni puntos.
- Cuando haga la **primera compra**, la jefa verifica la factura, selecciona la solicitud y registra el número de factura, valor de productos, canal y transporte.
- Al aprobar se registra la membresía junto con esa primera compra; el sistema calcula los puntos que correspondan.
- La clienta recibe un **correo de invitación** y puede acceder a sus puntos mediante un enlace seguro a su correo.
- No se necesita SMS ni contraseña para la clienta. BellaShop puede rechazar solicitudes con motivo.

La primera compra puede ser en **tienda, WhatsApp, web o con domicilio**. El transporte no suma puntos, pero los productos del pedido sí. Compras desde $50.000 = 5 puntos; cada $10.000 completos adicionales = 1 punto. Para estudiantes se aplica la excepción de primera compra prevista en el programa.

## Paso necesario antes de recibir solicitudes reales

La política `politica-datos.html` todavía es **un borrador**, así que las solicitudes permanecen desactivadas. La jefa deberá completar los datos legales, revisarla y aprobarla.

Después, en Administrador → Configuración → Recepción de solicitudes, marca la casilla que certifica la publicación de la política y haz clic en **Abrir recepción de solicitudes**. Las membresías no serán automáticas: siempre habrá que comprobar la primera factura.

## Correos e invitaciones

En Supabase → Authentication → URL Configuration:

- Site URL: https://bellashopinsumos-dotcom.github.io/bellalovers/
- Redirect URLs: https://bellashopinsumos-dotcom.github.io/bellalovers/

Revisar la entrega real de invitaciones y enlaces de acceso. Supabase tiene límites en su proveedor de correo por defecto, así que antes de crecer revisar si hace falta SMTP propio. Ningún correo de clienta debe usarse para pruebas sin permiso.

## El administrador

Solo pueden entrar cuentas previamente autorizadas en Supabase. El registro público de administradores se retiró y no vuelve a activarse.

El administrador puede gestionar solicitudes, compras, recompensas, puntos, bloqueos, restauraciones, permisos y auditoría. Las fotografías de los premios se suben desde el panel; los premios solo se muestran después de iniciar sesión como clienta aprobada.

## Qué se completó y qué no

**Preparado en código y Supabase:** solicitudes pendientes, bandeja de revisión, aprobación por factura, invitación por correo, acceso sin SMS, rechazo con motivo, registro de WhatsApp, premios, carné y control de puntos.

**Pendiente de verificación antes de abrir al público:** política definitiva, envío efectivo de correo, URL de autenticación, protección anti-bots y una compra real autorizada de prueba.

No se añadieron clientas o facturas ficticias. No se alteraron otros proyectos.

Migración versionada: `supabase/migrations/20261120_solicitudes_y_primera_compra.sql`.
Función server: `supabase/functions/bellalovers-aprobar/index.ts`.
