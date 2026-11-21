# BellaLovers ♡ — club de puntos BellaShop

Sitio: https://bellashopinsumos-dotcom.github.io/bellalovers/

Administrador: https://bellashopinsumos-dotcom.github.io/bellalovers/admin.html

Supabase: `xpnfdyfnaromfwkontid`. Despliegue GitHub Pages desde `main`.

## Inicio de sesión tal como lo pidió BellaShop

La portada no contiene un formulario fijo. Al tocar **Iniciar sesión** aparece una ventana con **Iniciar sesión**, **Registrarse** y una **X** para cerrar.

**La clienta entra inmediatamente al escribir solamente:**
- **Celular colombiano o correo** (el correo solo sirve si lo informó en su inscripción).
- **Nombre completo**, como quedó registrado en BellaShop.

No se necesita contraseña, clave privada, correo de confirmación, SMS ni aprobación de administración **para entrar**. El inicio se resuelve con la función de servidor `bellalovers-consulta`, que solo devuelve un perfil de consulta limitado: nombre, categoría, fecha de ingreso, puntos, movimientos, historial simplificado de compras, estado de solicitudes y premios.

### Privacidad y limitaciones de este diseño

**Nombre y teléfono/correo NO demuestran identidad.** Otras personas que los conozcan podrían consultar el historial simplificado. BellaShop decidió priorizar un acceso sencillo; por eso se limita la información expuesta: **no** se devuelven datos de contacto, números de factura, identificadores internos de usuario, notas de caja o recibos. Se aplican límites de consultas y no se crea un token de Supabase Auth para quien solo introduce esos datos. Nadie puede editar puntos, facturas, inventario ni datos del perfil desde esta consulta.

La sesión de consulta se conserva únicamente en el almacenamiento de la pestaña durante un máximo de 8 horas; cerrar sesión borra el acceso guardado.

### Inscripciones y profesoras

**Registrarse** crea una **solicitud de ingreso**, no una cuenta activa. La jefa aprueba la solicitud una vez comprueba una primera compra real y registra el importe de productos. El correo es opcional; el teléfono obligatorio. Las profesoras afiliadas disponibles provienen exclusivamente del directorio que administra BellaShop; no se puede autoproclamar profesora.

La Edge Function `bellalovers-aprobar` crea la cuenta sin claves, contraseña compartida, SMS ni correos de invitación.

### Premios y canjes seguros

- Los premios se configuran desde el administrador (referencia, foto, puntos, inventario, categoría).
- Con menos de **50 puntos**, las recompensas están bloqueadas. Si no hay premios cargados, aparece **Próximamente**.
- Con **50 puntos** o más y saldo suficiente, la clienta puede **enviar una solicitud de canje** desde su cuenta.
- **Enviar NO descuenta puntos, reserva stock ni entrega artículos.** Se guarda una solicitud `bl_guest_reward_requests` con estado `pendiente` (máximo una pendiente por clienta).
- **Administrador → Recompensas → Solicitudes desde BellaLovers** muestra a la titular, su teléfono registrado y los premios pedidos. BellaShop debe escribir o llamar a ese teléfono para confirmar la solicitud.
- **Solo cuando la jefa confirma** y escribe `CONFIRMADO`, se llama a la función privada `bl_decide_guest_reward`; el servidor verifica stock y saldo, genera el canje definitivo, **descuenta puntos y stock**, y registra el cambio en auditoría. Rechazar no descuenta ni reserva nada.
- Las solicitudes antiguas realizadas con sesiones Supabase Auth siguen visibles en un apartado separado para evitar perder historial.

**Importante:** Una persona que conoce el nombre y celular de otra podría ver el resumen y **enviar una solicitud falsa**, pero no podrá obtener premios sin la confirmación de BellaShop a la titular. Esa responsabilidad operativa es obligatoria.

## Otras operaciones

- Compra por celular en administración, con factura y canal opcionales y sin campo de transporte.
- Acumulación: $50.000 en productos = 5 puntos; por cada $10.000 completos extra, 1 punto. No se otorgan puntos de productos con descuentos especiales si esa exclusión está activa. Primera compra de estudiantes no genera puntos.
- Administrador puede sumar, descontar y revertir puntos con auditoría, anular compras, manejar profesoras, bloquear/archivar/restaurar clientas y cerrar cuentas conservando la trazabilidad comercial.
- Recompensas ocultas de la portada; aparecen dentro de la cuenta después de entrar.

## Revisión antes del lanzamiento

La política `politica-datos.html` sigue siendo un borrador y BellaShop debe aprobarla antes de recolectar solicitudes públicamente. Debe explicar expresamente la visibilidad limitada asociada a entrar por nombre y celular/correo. La lógica de canjes se probó en una transacción de base de datos revertida sin crear registros ficticios persistentes. Es recomendable probar el uso real desde un celular autorizado antes del lanzamiento general.

Auth de administradores sigue separado, con control de permisos RLS. Nunca incluir `service_role` en JavaScript público. Las funciones antiguas `bellalovers-ingresar`, `bellalovers-acceso` y `bellalovers-clave` están desactivadas.


## Correcciones implementadas el 21 de noviembre de 2026

- La consulta pública usa límites compatibles con `bl_limit_member_access` (60 por identificador/hora y 100 por IP/hora; la base solo permite máximos de hasta 100). Ya no bloquea toda consulta por el límite de 120/200.
- El servidor devuelve el motivo específico de error y un indicador de regalo de estudiante entregado, sin filtrar detalles del regalo.
- Los saldos se calculan sobre el historial completo de movimientos, mientras la interfaz presenta solamente los más recientes.
- La meta de canjes se toma de `bl_settings.unlock_points`, sin un segundo límite fijo de 50 puntos.
- Los textos públicos de acumulación, estudiantes, vencimientos y premios se actualizan con la configuración administrativa mediante `public_rules`; el enlace al catálogo también se actualiza desde la misma configuración.
- El resumen administrativo cuenta solicitudes nuevas por WhatsApp y no repite canjes ya confirmados en la tabla del sistema anterior; incluye un acceso directo para contactar a la titular por WhatsApp.
- Se agregaron índices a 18 relaciones foráneas y se quitaron tres políticas RLS de lectura duplicadas, conservando los permisos del administrador.
- Las nuevas inscripciones se **pausaron temporalmente** mientras se completa y aprueba la política de tratamiento de datos. El acceso de las miembros existentes y sus compras no se modificó.
- La protección contra contraseñas filtradas de Supabase Auth debe habilitarse desde el Dashboard de Supabase, ya que no hay un ajuste conectado para modificarla aquí.
- Actualmente no hay premios configurados; deben registrarse en Administrador → Recompensas, usando referencias reales y existencias verificadas, antes de habilitar canjes visibles.

### Pendiente de BellaShop para reabrir inscripciones

Completar nombre o razón social legal, identificación/NIT aplicable, domicilio/dirección de notificaciones, teléfono oficial, datos de proveedores y fechas de tratamiento/conservación. Después de que la jefa apruebe la política, usar la sección Configuración → Recepción de solicitudes para reabrir. No se inventan datos legales.

