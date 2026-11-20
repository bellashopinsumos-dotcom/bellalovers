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
- Panel de ejemplo para revisar puntos, vencimientos, compras y recompensas.
- Autenticación de clientas mediante SMS OTP una vez que el operador de SMS y la política estén habilitados.
- Catálogo de recompensas y redenciones vinculadas a facturas y puntos del servidor (en modo real).

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

## Pendiente para ponerlo en producción

1. Crear en **Authentication → Users** el usuario de `bellashopinsumos@gmail.com`, confirmar su correo y establecer una contraseña robusta. Después, autorizarlo como administrador desde el SQL Editor:

   ```sql
   insert into public.bl_staff(user_id,role,active)
   select id,'admin',true
   from auth.users where lower(email)='bellashopinsumos@gmail.com'
     and email_confirmed_at is not null
   on conflict (user_id) do update set role='admin',active=true;
   ```

   No ejecutes este paso si todavía no controlas el correo. Nunca compartas la contraseña en chats o archivos.

2. Agregar estas direcciones a **Authentication → URL Configuration** en Supabase:
   - Site URL: `https://bellashopinsumos-dotcom.github.io/bellalovers/`
   - Additional Redirect URLs: `https://bellashopinsumos-dotcom.github.io/bellalovers/admin.html`
3. Configurar proveedor de SMS autorizado para Colombia y probar el registro/verificación.
4. Aprobar la política de tratamiento de datos definitiva, **entonces** cambiar `legalPolicyApproved: false` a `true` en `assets/config.js`. No hacerlo antes.
5. Cargar recompensas reales con costos y stock aprobados por la jefa. Integración con el inventario central de BellaShop pendiente.
6. Probar operaciones completas con usuarios de prueba autorizados y supervisión de la jefa; validar correos de recuperación y auditorías.

**Estado al 20/11/2026:** backend creado y conectado, migraciones aplicadas, código y diseño publicados; registro público intencionalmente desactivado y sin ningún usuario autorizado inicial. La **vista de demostración** está disponible sin crear cuentas reales.

## Instalación de otra instancia

Ejecutar primero `supabase/schema.sql` en un proyecto nuevo y luego `supabase/migrations/20261120_restauracion_y_equipo.sql`. Revisar y adaptar `assets/config.js` a los valores publicables del proyecto. No ejecutar migrations sobre otras aplicaciones. Mantener control de cambios y respaldos antes de producción.

## Pruebas automáticas

`npm test`, `node --check assets/admin.js`, `node --check assets/client.js`, `node --check assets/core.js` y `node --check assets/config.js`. Se ejecutan en GitHub Actions en cada actualización relevante.
