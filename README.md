# BellaLovers ♡ — Club de beneficios de BellaShop

Sistema de fidelización de BellaShop: **rosado pastel, dorado champagne, interfaz móvil y diseño despejado**. Código publicado en GitHub Pages y base de datos independiente en Supabase.

## Enlaces

- Sitio: https://bellashopinsumos-dotcom.github.io/bellalovers/
- Administrador: https://bellashopinsumos-dotcom.github.io/bellalovers/admin.html
- Proyecto de base de datos: https://supabase.com/dashboard/project/xpnfdyfnaromfwkontid
- Migración incremental: `supabase/migrations/20261120_restauracion_y_equipo.sql`

## Qué funciona en el código

**Página pública**
- Bienvenida, explicación de requisitos y categorías (estudiantes, frecuentes/manicuristas, profesoras).
- Área de clientas conectada a datos reales: puntos, vencimientos, compras y recompensas; no se cargan cuentas ficticias.
- Autenticación de clientas mediante SMS OTP una vez que el operador de SMS y la política estén habilitados.
- Catálogo de recompensas y redenciones vinculado a facturas y puntos del servidor cuando existan registros reales.

**Panel administrativo**
- Gestión de clientas y filtros por estado (activas, bloqueadas, archivadas).
- Bloquear, desbloquear, **archivar sin borrar** y **restaurar** cuentas conservando movimientos y facturas.
- Cambiar categoría con motivo; ajustar puntos auditados.
- Gestionar equipo con dos roles (administrador / operador); habilitar, suspender y restaurar accesos de empleados ya verificados.
- Registrar y anular facturas; premios, stock reservado, regalos de bienvenida, profesoras y referidos.
- Configurar reglas futuras, panel de estadísticas y exportaciones CSV de clientas, compras y auditoría.
- Recuperación de contraseña **propia** por correo de Supabase (requiere configurar la URL de redirección).

## Reglas principales

Compra mínima elegible: $50.000 COP; 1 punto por $10.000 completos en productos; 50 puntos para desbloquear solicitudes. Compras con descuentos especiales excluidas; los domicilios no suman. Regalo de estudiante según el monto y compra inicial previstos en el programa. Las anulaciones deben revertir los puntos. El historial se preserva cuando una cuenta se archiva o se restaura; restaurar **no renueva puntos vencidos**.

## Seguridad y accesos

- Todos los datos viven en Supabase; jamás en el almacenamiento del navegador como saldo verdadero.
- Tablas protegidas con RLS; el cliente público solo usa claves publicables.
- Las funciones de alto privilegio están en `bella_private`; solo se exponen envoltorios invocadores con comprobación de rol.
- Cambiar el estado o categoría de una cuenta requiere rol administrador, motivo y anotación de auditoría.
- Las cuentas no se eliminan al archivarlas. Para solicitudes legales de supresión definitiva se requiere un procedimiento separado, con revisión de obligaciones de conservación.
- No se permiten restablecimientos arbitrarios de contraseñas ni acceso a las sesiones de clientes.

## Cambios implementados: premios públicos y compras por canales

- El administrador registra el origen de la factura como tienda, WhatsApp, página web, domicilio u otro.
- Los puntos se calculan con el valor de **productos pagados**, sin el costo de transporte, independientemente del canal. En ventas WhatsApp o entregadas a domicilio se aplican las mismas reglas de compras válidas que en el mostrador.
- Premios en la tabla `bl_rewards`: referencia real, nombre, costo interno (privado), puntos, unidades, reservado, categoría, imagen y publicación.
- El administrador puede subir JPG/PNG/WEBP hasta 3 MB al bucket `bellalovers-premios` (escritura solo administrador).
- La vitrina pública carga premios publicados y con stock a través de `bl_public_rewards`; nunca devuelve `unit_cost` ni datos personales.
- Carné digital y avisos de vencimientos/solicitudes en cuentas que hayan iniciado sesión.
- Nueva migración: `supabase/migrations/20261120_premios_canales_registro.sql`.

## Activación del primer administrador

Desde `admin.html` pulsa **Primer ingreso: activar cuenta BellaShop**. La aplicación solo permite iniciar el proceso para `bellashopinsumos@gmail.com`, requiere una contraseña robusta de 12 o más caracteres y un correo confirmado. Supabase enviará un enlace de verificación. Una vez confirmado, se puede ingresar desde la misma página. La RPC `bl_claim_first_admin` da el primer permiso únicamente a ese correo confirmado, y solo mientras no exista otro administrador activo.

**Antes de crear la cuenta**, en Supabase → Authentication → URL Configuration establece:

- Site URL: `https://bellashopinsumos-dotcom.github.io/bellalovers/`
- Additional Redirect URL: `https://bellashopinsumos-dotcom.github.io/bellalovers/admin.html`

Si el correo de confirmación no llega, revisa los límites de envío de Supabase y la configuración de proveedor de correo. No compartas la contraseña ni llaves secretas en archivos del sitio.

## Inscripciones de clientas: preparados, NO ABIERTAS

El formulario para registro con celular y SMS OTP está implementado, pero **la bandera `signup_open` de `bl_settings` permanece en false**. Para abrir desde el administrador:

1. Configurar en Supabase Authentication → Providers el proveedor **Phone/SMS** para Colombia, probar envío real y revisar costos, límites y controles antispam.
2. Completar, revisar y publicar una política de datos real: identificación legal, dirección, responsables, proveedores y vigencia. La página `politica-datos.html` es todavía un **borrador**, no sustituye la aprobación de BellaShop.
3. En administración → Configuración → Activación de inscripciones, confirmar ambos puntos, pulsar **Abrir inscripciones**. La RPC de registro hace el control del estado del lado servidor; no basta con cambiar el HTML.

No abrir antes de comprobar los pasos anteriores, o la inscripción fallará y los datos pueden quedar mal tratados.

## Verificación y puesta en marcha

- En este momento no se ha añadido ninguna cuenta o premio ficticio; la base sigue vacía hasta que se registren personas reales.
- Revisa los premios y sus costos con la jefa antes de publicarlos.
- Comprueba la asignación de puntos, devoluciones, referidos y redenciones con personas autorizadas.
- La integración con el inventario central y el envío de mensajes proactivos por WhatsApp siguen pendientes de infraestructura y aprobación.

## Instalación de otra instancia

Ejecutar primero `supabase/schema.sql` en un proyecto nuevo, después `supabase/migrations/20261120_restauracion_y_equipo.sql` y finalmente `supabase/migrations/20261120_premios_canales_registro.sql`. Revisar y adaptar `assets/config.js` a los valores publicables del proyecto. No ejecutar migrations sobre otras aplicaciones. Mantener control de cambios y respaldos antes de producción.

## Pruebas automáticas

`npm test`, `node --check assets/admin.js`, `node --check assets/client.js`, `node --check assets/core.js` y `node --check assets/config.js`. Se ejecutan en GitHub Actions en cada actualización relevante.
