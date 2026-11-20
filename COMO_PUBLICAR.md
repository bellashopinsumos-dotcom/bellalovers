# BellaLovers — estado y apertura del club

GitHub Pages está configurado para publicar desde `main` / `root`.

- Club: https://bellashopinsumos-dotcom.github.io/bellalovers/
- Administrador: https://bellashopinsumos-dotcom.github.io/bellalovers/admin.html
- Supabase: https://supabase.com/dashboard/project/xpnfdyfnaromfwkontid

## Qué ya está listo en el código
- Diseño rosado pastel optimizado para celulares.
- Vitrina pública sincronizada de premios reales, sin necesidad de iniciar sesión.
- Panel que permite crear, editar y publicar premios con fotografía y existencias.
- Registro de compras facturadas por tienda, WhatsApp, web, domicilio y otros canales; el costo de transporte se excluye, no el valor de los productos.
- Gestión de clientas, restauración de cuentas, roles, anulación de facturas, puntos y auditoría.
- Carné digital y mensajes dentro de cada cuenta.
- Alta del primer administrador vinculada al correo verificado de BellaShop.

## Lo primero que debe hacer BellaShop

1. En Supabase → Authentication → URL Configuration, indicar:
   Site URL: https://bellashopinsumos-dotcom.github.io/bellalovers/
   Redirect URLs: https://bellashopinsumos-dotcom.github.io/bellalovers/admin.html
2. Abrir la página de administrador, pulsar **Primer ingreso: activar cuenta BellaShop**, escoger contraseña segura y confirmar el correo `bellashopinsumos@gmail.com`. La app concederá el primer rol admin únicamente al dueño de esa cuenta verificada.
3. Configurar **SMS OTP para Colombia** en Supabase y comprobarlo, incluidos sus costos y límites de envío.
4. Completar y aprobar la política `politica-datos.html` (actualmente es un borrador; falta identidad legal, dirección, vigencia y otros detalles).
5. Desde administrador → Configuración, confirmar esos dos requisitos y pulsar **Abrir inscripciones**.
6. Cargar premios reales y sus fotografías desde administrador → Recompensas.

El registro público está cerrado hasta los pasos 3–5. **No hemos pagado ni contratado un proveedor de SMS.** La base de datos no contiene clientas ni premios ficticios.

## Reglas para la jefa

Las compras confirmadas de productos por WhatsApp **sí suman puntos** bajo las mismas condiciones que las realizadas presencialmente. El envío a domicilio no invalida la compra: solo su tarifa no suma puntos. Si la compra tiene descuento especial, se aplica la exclusión configurada en BellaLovers.

Los premios se muestran en la vitrina pública cuando están activos y tienen stock disponible. El costo interno del premio no se expone.

**Seguridad:** nunca colocar claves privadas ni contraseñas de usuarios en GitHub. No editar proyectos Supabase de RutaYa, Master Viviana ni BellaShop Inventario.

## Migraciones de base de datos versionadas
`supabase/schema.sql` → `supabase/migrations/20261120_restauracion_y_equipo.sql` → `supabase/migrations/20261120_premios_canales_registro.sql`.
Estas migraciones ya se aplicaron en BellaLovers y no se deben repetir en otros proyectos.
