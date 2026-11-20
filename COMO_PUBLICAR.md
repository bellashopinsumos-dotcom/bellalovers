# BellaLovers: cómo abrirlo y usarlo

Página: https://bellashopinsumos-dotcom.github.io/bellalovers/

Administrador: https://bellashopinsumos-dotcom.github.io/bellalovers/admin.html

## Ahora el club funciona por aprobación, SIN SMS

- La persona llena una **solicitud de ingreso** desde la web con nombre, celular, correo, categoría y, si corresponde, **escoge una profesora afiliada de la lista**.
- Su solicitud aparece en **Administrador → Solicitudes de ingreso**, sin crear membresía ni puntos.
- Cuando haga la **primera compra**, la jefa verifica la factura, selecciona la solicitud y registra el número de factura, valor de productos, canal y transporte.
- Al aprobar se registra la membresía junto con esa primera compra; el sistema calcula los puntos que correspondan.
- La clienta recibe un **correo de invitación**; después puede pedir acceso usando celular o correo más su nombre completo, y confirma el ingreso desde su correo asociado.
- No se necesita SMS ni contraseña para la clienta. BellaShop puede rechazar solicitudes con motivo.

La primera compra puede ser en **tienda, WhatsApp, web o con domicilio**. El transporte no suma puntos, pero los productos del pedido sí. Compras desde $50.000 = 5 puntos; cada $10.000 completos adicionales = 1 punto. Para estudiantes se aplica la excepción de primera compra prevista en el programa.

## Paso necesario antes de recibir solicitudes reales

La política `politica-datos.html` sigue siendo **un borrador**. BellaShop debe completarla y aprobarla; verifica en Configuración si la recepción pública está abierta o pausada antes de difundir el formulario. La jefa deberá completar los datos legales, revisarla y aprobarla.

Después, en Administrador → Configuración → Recepción de solicitudes, marca la casilla que certifica la publicación de la política y haz clic en **Abrir recepción de solicitudes**. Las membresías no serán automáticas: siempre habrá que comprobar la primera factura.

## Administrar profesoras afiliadas

En Administrador → **Profesoras**:

1. Escribe el nombre público y pulsa **Agregar profesora afiliada**.
2. Aparecerá automáticamente entre las profesoras disponibles para elegir en las solicitudes.
3. Puedes cambiar el nombre con **Editar**, compartir su enlace/QR, usar **Retirar** para quitarla de las nuevas solicitudes y **Reactivar** cuando corresponda.
4. Para otorgar puntos a la profesora por referidos, vincula su membresía aprobada desde **Vincular cuenta BellaLovers**. Primero debe tener la categoría Profesora en Clientas.
5. **Retirar no elimina historial**, y ninguna persona puede autorizarse como profesora por sí misma.

Cuando todavía no hay afiliadas, las personas podrán seleccionar «Ninguna».

## Entrar a mi cuenta (solo membresías aprobadas)

La clienta no necesita escribir su correo si prefiere usar su celular. Desde la página de BellaLovers, en **¿Ya eres BellaLover?**, escribe su **celular o correo y su nombre completo tal como quedó registrado**.

Para proteger su información, el sistema envía un enlace privado al **correo ya registrado y aprobado**. Al abrirlo accede a su carné con **fecha de ingreso**, compras, puntos, movimientos y premios. El nombre y el celular solos nunca desbloquean el historial. No se usan códigos SMS.

### Recompensas de mi cuenta

- Sin premios publicados por la jefa: «Próximamente tendremos recompensas para ti».
- Con premios y menos de 50 puntos: aparecen bloqueados y se indica cuántos puntos faltan.
- Desde 50 puntos: puede solicitar productos publicados que alcance a pagar con sus puntos, sujetos a existencias y aprobación.
- El administrador modifica el catálogo en **Recompensas**; las clientas tienen el botón **Actualizar premios**.

## Correos e invitaciones

En Supabase → Authentication → URL Configuration:

- Site URL: https://bellashopinsumos-dotcom.github.io/bellalovers/
- Redirect URLs: https://bellashopinsumos-dotcom.github.io/bellalovers/

Revisar la entrega real de invitaciones y enlaces de acceso. Supabase tiene límites en su proveedor de correo por defecto, así que antes de crecer revisar si hace falta SMTP propio. Ningún correo de clienta debe usarse para pruebas sin permiso.

## Operación diaria desde el celular

Para registrar una compra entra a **Compras**, escribe el **celular de la clienta** y pulsa **Buscar**. Cuando veas su nombre, ingresa el **valor de los productos**. **Factura** y **canal** son opcionales; ya no se pide transporte. Si no tienes factura el sistema genera una referencia interna, que no reemplaza una factura comercial.

Si agregaste puntos para probar y quieres quitarlos, entra a **Clientas → Ver ficha → Ajustes manuales de puntos → Deshacer ajuste**. El saldo se recalcula y queda el movimiento contrario en el historial para que no desaparezca la auditoría.

Para dar de baja una cuenta, en **Clientas → Ver ficha** existen opciones diferentes:

- **Archivar:** reversible; luego puedes restaurar.
- **Eliminar cuenta y acceso:** desactiva la membresía y elimina los datos de contacto; conserva las facturas y movimientos históricos, pide confirmaciones y solo funciona para administradores. No se puede restaurar con un botón.

No borres manualmente movimientos o facturas de Supabase para intentar cuadrar puntos. Los cambios de puntos deben pasar por las acciones auditadas del administrador.

## El administrador

Solo pueden entrar cuentas previamente autorizadas en Supabase. El registro público de administradores se retiró y no vuelve a activarse.

El administrador puede gestionar solicitudes, compras, recompensas, puntos, bloqueos, restauraciones, permisos y auditoría. Las fotografías de los premios se suben desde el panel; los premios solo se muestran después de iniciar sesión como clienta aprobada.

## Qué se completó y qué no

**Preparado en código y Supabase:** solicitudes pendientes, bandeja de revisión, aprobación por factura, invitación por correo, acceso sin SMS, rechazo con motivo, registro de WhatsApp, premios, carné y control de puntos.

**Pendiente de verificación antes de abrir al público:** política definitiva, envío efectivo de correo, URL de autenticación, protección anti-bots y una compra real autorizada de prueba.

No se añadieron clientas o facturas ficticias. No se alteraron otros proyectos.

Migración versionada: `supabase/migrations/20261120_solicitudes_y_primera_compra.sql`.
Función server: `supabase/functions/bellalovers-aprobar/index.ts`.
