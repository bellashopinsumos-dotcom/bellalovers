# BellaLovers ♡ — Club de beneficios de BellaShop

**Proyecto inicial, versión 0.1.0 — 19 de noviembre de 2026.**

He preparado una base de aplicación web con interfaz para clientas, administrador, reglas de puntos y diseño rosado pastel/dorado discreto. No es una página de producción ya conectada: viene deliberadamente en **modo demostración** para que primero la jefa revise la experiencia sin modificar otros sistemas, registrar clientas reales o entregar premios accidentalmente.

## 1. Qué puedes abrir y probar ahora

1. Extrae `BellaLovers.zip` sin cambiar la organización de las carpetas.
2. Sube los archivos a un **repositorio GitHub nuevo y separado**, por ejemplo `bella-lovers`. GitHub Pages debe servir desde la raíz (`main` → `/root`).
3. Abre la URL pública del nuevo repositorio: la página principal se llama `index.html` y el administrador `admin.html`.
4. **Sin conectar Supabase**, las dos páginas muestran una demostración con datos de ejemplo. En la principal pulsa **“Ver ejemplo de mi cuenta”**; en el administrador, **“Explorar administrador”**. Las compras, premios y cuentas de ejemplo **no son registros reales**.

> No reemplaces la página principal de BellaShop ni su carrito con estos archivos. BellaLovers es otro sitio, conectado visualmente al catálogo a través de su enlace.

## 2. Qué incluye la versión

### Página para clientas
- Diseño adaptado a celular, fondo rosa pastel claro y dorado moderado; sin decoración pesada.
- Presentación del club, condiciones y categorías: estudiante, manicurista/clienta frecuente y profesora.
- Inicio de sesión por **SMS OTP** (cuando se configure proveedor de SMS de Supabase).
- Registro con nombre, celular verificado, categoría, profesora mediante código de referido y consentimientos separados.
- Cuenta con puntos, barra de progreso, vencimiento, movimientos, facturas, solicitudes y estado de bienvenida para estudiantes.
- Premios reales configurables por categoría con referencia, fotografía, disponibilidad, carrito y redención múltiple, cuando el saldo llega a la meta.
- Código de referido visible para profesoras aprobadas (se gestionan desde administración).

### Administrador
- Inicio con correo y contraseña de empleado autorizado; roles `admin` y `operador`.
- Panel de ventas, puntos, clientas registradas, recompensas solicitadas y costo estimado.
- Búsqueda por nombre/celular, categorías, bloqueo de cuentas y ajustes de puntos con motivo (solo administradores).
- Confirmar factura única; cálculo automático de puntos, regalos y bonos por referidos.
- Anular compras con motivo y reversión de puntos; no permite anular compras cuyo regalo de bienvenida ya fue entregado sin una revisión previa.
- Crear y editar catálogo de premios con puntos, fotos, referencia, costo y existencias.
- Aprobar o rechazar redenciones; reserva de stock al solicitar, salida al aprobar y devolución de puntos cuando se rechaza.
- Habilitar profesoras con código único, enlace de referido y QR generado en el navegador.
- Administrar regalos de bienvenida con inventario separado y comprobación de entrega única.
- Cambiar equivalencias, umbrales, reglas de estudiante, duración del ciclo, días de gracia y rangos de referidos.
- Exportar clientas y compras a CSV; consulta de auditoría de cambios críticos.

### Reglas precargadas del documento
- Compra mínima válida: **$50.000 COP** de productos.
- 1 punto por **$10.000 COP completos**, sin redondear hacia arriba.
- **50 puntos** para desbloquear la posibilidad de solicitar recompensas.
- Las compras con descuentos especiales no acumulan puntos; los domicilios no se incluyen.
- Estudiantes: **primera compra de $150.000 o más** da derecho a regalo físico, pero no otorga puntos. Desde la segunda compra válida suman puntos.
- Profesoras: puntos de sus propias compras y puntos según el monto de la primera compra elegible de una estudiante recomendada, usando código personal.
- No se otorgan puntos al registrarse; toda compra debe ser confirmada por un empleado.
- Los puntos sobrantes permanecen después de una redención parcial; para iniciar otra solicitud se necesitan nuevamente al menos 50 puntos.
- Ciclos de 12 meses desde la primera compra que acredita puntos, con gracia configurada en 30 días para ciclos que ya estaban habilitados para premios.
- No se pueden redimir puntos en efectivo.

## 3. Configurar la base de datos REAL (paso posterior)

**No se ha creado ni modificado un proyecto remoto de Supabase.** Los proyectos existentes de BellaShop, RutaYa o Master Viviana no se tocaron. Se recomienda crear uno nuevo, identificado como `BellaLovers`, para no mezclar clientes ni permisos. Crear proyectos o contratar el proveedor SMS puede tener costos según el plan.

1. Crea un proyecto nuevo de Supabase, con un correo administrador bajo control de BellaShop.
2. En la sección **SQL Editor**, copia `supabase/schema.sql` y ejecútalo **en ese proyecto nuevo**. Está pensado para una instalación inicial, no para reejecutarlo en una base ya configurada.
3. En Supabase, habilita `Authentication > Providers > Phone` y configura un proveedor real de SMS (con costos y cumplimiento de privacidad). Sin SMS, la verificación real de celulares no funcionará.
4. En `Authentication > Users`, crea al administrador inicial con correo y contraseña fuertes. En el SQL Editor, cambia el email de este ejemplo y ejecútalo:
   ```sql
   insert into public.bl_staff(user_id, role)
   select id, 'admin' from auth.users where email = 'CORREO_REAL_DEL_ADMIN';
   ```
5. En `assets/config.js`, configura **la Project URL y la clave pública/publishable**. Nunca publiques una service role key ni una secret key.
6. Actualiza `shopUrl` con la dirección real del catálogo BellaShop. Ajusta los dominios autorizados para autenticación según la configuración de Supabase y GitHub Pages.
7. Aprueba y publica la política de tratamiento de datos definitiva. El archivo `politica-datos.html` es solo un borrador informativo: **no sirve como política legal definitiva**. Cuando esté listo, cambia `legalPolicyApproved: false` a `true` en `assets/config.js`.
8. Prueba con **números reales autorizados**: usuario nuevo, celular duplicado, profesora verificada, compras con descuento, facturas repetidas, premios insuficientes, anulaciones y vencimientos. Revisa el Security Advisor de Supabase antes de compartir el enlace públicamente.

**Nota sobre las claves:** Supabase recomienda claves públicas para el navegador y permisos RLS para todas las tablas accesibles. El SQL incorpora RLS, funciones de validación y un registro contable de movimientos de puntos. Estas medidas deben revisarse y probarse con un proyecto real antes del lanzamiento.

## 4. Cómo se administra una compra (cuando la base esté conectada)

La clienta verifica su número y se registra en la página. La empleada entra a `admin.html` y va a **Compras**, elige la clienta, digita un identificador de factura único y el total de productos sin domicilio; marca si hubo descuento especial. Al confirmar, el servidor determina puntos, la elegibilidad de regalo y los puntos de profesora referidora. El historial queda guardado en Supabase; modificar el HTML o el navegador no puede crear puntos válidos.

## 5. Decisiones pendientes que debe cerrar la jefa

No inventé premios reales ni sus costos, porque eso podría producir pérdidas. También conviene validar formalmente:

- Qué productos específicos y cantidades entran como premios y regalos, sus costos internos y el máximo autorizado por redención.
- Política exacta de puntos que sobran al finalizar cada ciclo. La versión actual aplica vencimiento al saldo residual después del ciclo/gracia según la condición de desbloqueo.
- Estudiantes cuya primera compra NO cumple $150.000: la versión actual no concede regalo posterior, pero empieza a acumular desde la segunda compra **válida**, en línea con la regla central del documento.
- Facturas con descuentos parciales: la versión actual descarta **toda** la factura de acumulación si está marcada con descuento especial. Puede cambiarse la lógica posteriormente.

## 6. Funciones todavía NO conectadas o NO automáticas

- **Inventario BellaShop:** las referencias y las fotos se pueden usar, pero el stock de recompensas se gestiona de forma independiente y manual. NO descuenta todavía existencias del Excel o catálogo principal.
- **Notificaciones WhatsApp:** no se envían automáticamente. Requieren integración autorizada y consentimientos correspondientes. Los enlaces de referidos sí son compartibles.
- **Expiración periódica sin visitas:** el servidor procesa vencimientos al consultar una cuenta, registrar movimientos y con el botón **Procesar puntos vencidos** del administrador. Falta automatizar la tarea periódica programada.
- **Códigos QR:** se generan con la librería externa QRCode.js cuando el navegador tiene conexión. El QR tendrá la URL desde donde abras el administrador; genera los definitivos **después** de publicar la web.
- **Precio y rentabilidad:** los costos de los regalos deben cargarse de forma manual. La estadística de margen no reemplaza la contabilidad real.
- **Autenticación de empleados:** está diseñada para credenciales propias de Supabase; el primer usuario `admin` se habilita manualmente como se indicó arriba.
- No se han ejecutado pruebas end-to-end contra Supabase, ni se ha desplegado la aplicación en un dominio real. Las reglas matemáticas y el código estático se comprobaron de manera local.

## 7. Organización de archivos

```text
BellaLovers/
  index.html                 Página pública
  admin.html                 Administrador
  politica-datos.html        Borrador legal (NO definitivo)
  assets/
    style.css                Diseño rosado pastel y dorado
    config.js                Configuración del proyecto
    core.js                  Funciones compartidas
    client.js                Interacción de clientas
    admin.js                 Interacción de administración
  supabase/
    schema.sql               Tablas, permisos, RLS y funciones transaccionales
  tests/
    rules.test.mjs           Pruebas de reglas de puntos
  package.json               Ejecutar pruebas
  LEEME-PRIMERO.md           Este documento
```

Para comprobar reglas localmente, con Node.js instalado ejecuta `npm test` dentro de la carpeta. Para desarrollo local usa un servidor HTTP (por ejemplo `python -m http.server 8080`); evita abrir la página con `file://` porque los módulos JavaScript de muchos navegadores quedan bloqueados.

**Importante:** Esta entrega constituye la **primera versión programada y demostrable de BellaLovers**, más una base SQL preparada para integración. No equivale todavía a una plataforma de fidelización validada para producción. Eso requiere base de datos propia, política de datos aprobada, SMS, premios reales, pruebas de seguridad e integración con inventario.
