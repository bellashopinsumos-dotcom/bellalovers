# BellaLovers ♡ — Club de beneficios BellaShop

Sitio: https://bellashopinsumos-dotcom.github.io/bellalovers/

Administrador: https://bellashopinsumos-dotcom.github.io/bellalovers/admin.html

Proyecto Supabase exclusivo: `xpnfdyfnaromfwkontid`.

## Entrada a la cuenta: primero en la portada

La portada comienza con **Iniciar sesión** y **Registrarse**, incluso en celulares.

- **Iniciar sesión:** celular colombiano + **clave BellaLovers de 12 caracteres**. No se pide Gmail, correo ni SMS. El servidor `bellalovers-ingresar` identifica la cuenta aprobada, valida la clave con Supabase Auth y establece una sesión segura. La clienta puede cerrar la sesión cuando quiera.
- **Registrarse:** realmente significa **solicitar ingreso**. Solo pide nombre, celular, categoría, profesora afiliada si la hay, consentimiento de datos y elección opcional de mensajes promocionales por WhatsApp. No activa automáticamente la membresía.
- **Primera compra:** el administrador verifica la compra real y aprueba desde **Solicitudes de ingreso**. La Edge Function protegida `bellalovers-aprobar` crea la cuenta sin invitación por email, registra la compra/puntos y muestra **una sola vez** una clave segura a la jefa.
- **Entrega de clave:** el administrador confirma la identidad de la clienta y puede usar **Copiar mensaje para WhatsApp**. El botón no envía nada automáticamente; nunca guardar la clave en inventarios o documentos.
- **Olvido de clave:** en **Clientas → Ver ficha → Generar nueva clave**. La Edge Function `bellalovers-clave` exige rol administrador, crea una nueva clave y la muestra una sola vez. La clave vieja deja de funcionar para iniciar nuevas sesiones. Sesiones existentes podrían continuar vigentes hasta su revocación o vencimiento.
- La ruta antigua de correos `bellalovers-acceso` se encuentra desactivada (HTTP 410) para impedir mensajes accidentales.

**Seguridad:** nadie puede ver historiales con solo conocer nombre/celular. Necesita su clave de acceso. Las claves las conserva Supabase Auth como credenciales de inicio; la clave en texto se expone solo una vez al administrador autorizado para su entrega y no se registra en la auditoría. El endpoint de ingreso aplica límites de intentos por celular y dirección IP. El rol del equipo se valida dentro del servidor y nunca se expone service_role en el navegador.

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
