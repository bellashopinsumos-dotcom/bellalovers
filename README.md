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
6. La clienta entra a **Mi cuenta** escribiendo su **celular o correo más el nombre completo**. Una función de servidor comprueba que fue aprobada y envía un enlace de un solo uso al correo registrado. El envío utiliza `signInWithOtp` **con `shouldCreateUser:false`**: no crea usuarios nuevos.

La jefa también puede **rechazar** solicitudes dando un motivo; la decisión queda auditada. Nunca se aprueba automáticamente por el simple hecho de enviar el formulario o conocer el enlace.

**Muy importante:** el celular de la solicitud es de contacto y **no queda verificado digitalmente**. BellaShop debe contrastar ese número, el nombre y la factura de la compra al aprobar la solicitud. La propiedad del correo sí se prueba al abrir el enlace enviado allí.

## Profesoras afiliadas: directorio exclusivo de BellaShop

**Nadie puede registrarse como profesora afiliada por su cuenta.** El formulario público solo ofrece las categorías Estudiante y Manicurista/cliente frecuente.

- Administrador → **Profesoras**: agregar un nombre, editarlo, retirar del listado, reactivarlo y compartir enlace/QR. Los códigos `BLP-XXXXXXXX` se crean automáticamente, nunca los inventa la clienta.
- Solicitudes de ingreso: el desplegable **«¿Qué profesora afiliada te recomendó?»** muestra únicamente nombres de profesoras activas o la opción «Ninguna».
- Supabase restringe el alta y cambios a un administrador vigente; el público consulta por RPC exclusivamente **nombre y código de profesoras activas**. No se exponen los datos de sus cuentas ni números de teléfono.
- **Retirar** es una desactivación reversible, no un borrado de historial: desaparece de nuevas solicitudes, pero las recomendaciones previas se conservan.
- La aprobación por primera factura vincula la recomendación a la profesora afiliada seleccionada. Para que pueda **recibir puntos por referidos**, debe tener una membresía aprobada, categoría Profesora y estar vinculada desde ese mismo formulario del administrador. Si aún no está vinculada, se conserva la recomendación para reconocer los puntos elegibles al vincularla posteriormente, sin duplicar abonos.
- Las solicitudes con profesora elegida se ven en Administrador → Solicitudes de ingreso, junto con los datos de la primera compra.

**Actualmente el directorio parte vacío; BellaShop decide quiénes serán afiliadas.** No se añaden profesoras ficticias.

## Cuenta personal de las BellaLovers aprobadas

En la portada hay dos recorridos separados: **Solicitar ingreso** (requiere posterior aprobación al comprar) y **Entrar a mi cuenta** (solo miembros aprobados).

La sección de ingreso pide:

- **Celular colombiano o correo electrónico**: basta cualquiera de los dos.
- **Nombre completo tal como quedó registrado**: uno o más nombres, uno o más apellidos, según la solicitud aprobada.

El formulario NO inicia una sesión simplemente por acertar nombre y celular: la Edge Function `bellalovers-acceso` solo busca una solicitud **aprobada** y un perfil activo, comprueba la coincidencia del nombre y **envía el enlace seguro al correo ya registrado**. El servidor no revela el correo de la clienta ni informa si existe la cuenta. No se utiliza SMS. Esta función usa un límite de intentos por identificador y dirección IP (`bl_member_access_limits`, accesible solamente mediante service role); requiere correo saliente real operativo.

Después de confirmar el enlace enviado al correo, la clienta visualiza:

- **Carné digital** con nombre, categoría, identificador y **«Miembro desde»** la fecha real de creación del perfil.
- **Saldo actual** y progreso hacia los **50 puntos** mínimos.
- **Compras facturadas** con valor de productos, fecha, estado y puntos ganados (también WhatsApp o domicilio).
- **Movimientos de puntos**, vencimientos y solicitudes de premios.
- **Recompensas que BellaShop publicó desde su panel:** si no hay, **«Próximamente tendremos recompensas para ti»**. Si hay premios pero tiene menos de 50 puntos, se ven con botón de canje bloqueado y contador de puntos que le faltan. A partir de 50 puntos, puede solicitar los premios que alcance a pagar con su saldo, si hay existencias; BellaShop valida la entrega. Puede pulsar **Actualizar premios** después de cambios del administrador.

**No publicar jamás datos de una clienta solo con celular y nombre:** ambos pueden ser conocidos por terceros. El enlace enviado a su correo es la verificación de titularidad. Si una clienta pierde acceso a ese correo, BellaShop necesitará un procedimiento de verificación de identidad y cambio de contacto administrado de forma segura, no una vía pública que entregue la cuenta.

## Administración: compras fáciles, deshacer puntos y eliminar cuentas

**Compras → Registrar compra:** busca por celular (búsqueda exacta en Supabase sobre el índice único de `bl_profiles.phone`), confirma el nombre encontrado y escribe el valor realmente pagado en **productos**. La factura es opcional, el canal es opcional y el transporte no aparece en el formulario. Sin factura se genera una referencia de seguimiento única `REG-...`, **no una factura tributaria**; el canal sin elegir se marca «No especificado / otro». El servicio `bl_purchase_simple` exige personal autorizado, saldo no afecta el precio de transporte y mantiene el cálculo de puntos vigente. El mismo criterio de campos opcionales se aplica al registro de primera compra al aprobar una solicitud.

**Clientas → Ficha de clienta → Ajustes manuales de puntos:** es posible añadir, descontar y **deshacer** ajustes. Deshacer no borra movimientos: crea una reversión compensatoria y registra motivo y auditoría; no se puede deshacer dos veces el mismo ajuste ni dejar un saldo negativo. Si el ciclo de puntos venció o se cerró, hace falta revisión administrativa antes de revertir. La revisión del caso de prueba de noviembre detectó un ajuste +50 sin revertir; se compensó con -50 en la misma cuenta, dejando un saldo final verificado de 5 puntos, originado por una compra vigente. Este saneamiento fue registrado en auditoría.

**Clientas → Eliminar cuenta y acceso:** requiere rol **administrador**, introducir la palabra `ELIMINAR`, motivo de mínimo ocho caracteres y dos confirmaciones. La RPC `bl_delete_member_account` bloquea el perfil, retira nombre y teléfono y el vínculo a solicitudes, conservando compras/movimientos para trazabilidad contable. Una Edge Function `bellalovers-eliminar` verifica el JWT y el rol de administrador y solicita a Supabase Auth la **eliminación suave del usuario**; las cuentas eliminadas no se pueden restaurar desde el panel. Esta acción es distinta de **Archivar**, que sí es reversible. No se permite eliminar una cuenta administrativa ni con premios pendientes de resolución. Por integridad de compras, facturas y auditoría, **«Eliminar cuenta» no significa destruir los registros comerciales**; para solicitudes de supresión de esos datos hay que revisar las obligaciones legales de conservación.

Las cuentas eliminadas salen del listado habitual y se pueden ver de forma anonimizada con el filtro **Eliminadas**. Las políticas RLS de puntos, compras, ciclos y canjes niegan lecturas a cuentas cerradas aun si persiste brevemente un token de sesión.
 
**Pendiente:** probar en una cuenta de ensayo autorizada el envío real de invitaciones y el flujo completo de eliminación en Supabase Auth. No se realizó ninguna eliminación de cuenta real automáticamente.

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
- **Profesoras afiliadas:** alta, edición, retiro/restauración, vínculo a cuentas, referencias y QR, autorizados por BellaShop.
- **Equipo y accesos:** permisos para operadores y administradores previamente autorizados.
- **Configuración:** activar o pausar la **recepción de solicitudes**; las aprobaciones siguen siendo siempre manuales.

El formulario para crear el primer administrador desde la web está deshabilitado. Los administradores deben crearse y autorizarse desde el panel privado de Supabase.

## Qué falta para abrir solicitudes al público

La recepción pública se administra desde **Configuración** (`bl_settings.join_requests_open`) y puede estar abierta o pausada según decisión de BellaShop. El viejo inicio automático por SMS está desactivado (`signup_open=false`, sin permiso de ejecutar `bl_register`). Para activar:

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
- Incrementales (en orden): `20261120_restauracion_y_equipo.sql` → `20261120_premios_canales_registro.sql` → `20261120_seguridad_admin.sql` → `20261120_solicitudes_y_primera_compra.sql` → `20261120_profesoras_afiliadas.sql` → `20261120_acceso_seguro_miembros.sql`.

**Los cambios del esquema ya se aplicaron solo al proyecto BellaLovers**. No ejecutar migraciones en RutaYa, Master Viviana ni inventario de BellaShop.

Pruebas: `npm test` y `node --check` en GitHub Actions. Las pruebas de sintaxis y reglas no sustituyen una prueba completa de correo y compras reales.

- Función de acceso de miembros: `supabase/functions/bellalovers-acceso/index.ts` (deploy realizado en Supabase BellaLovers; requiere que el correo funcione y que la URL esté autorizada).
