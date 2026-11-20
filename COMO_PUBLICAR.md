# BellaLovers — publicación y operación

La página de BellaLovers se publica desde la rama `main`, carpeta `/(root)` en GitHub Pages:

- Página pública: https://bellashopinsumos-dotcom.github.io/bellalovers/
- Administrador: https://bellashopinsumos-dotcom.github.io/bellalovers/admin.html

**Actualización 20/11/2026:** el proyecto Supabase BellaLovers YA está creado y conectado mediante clave publicable. Los datos y botones ficticios fueron retirados. No hay clientas, compras ni premios cargados; `legalPolicyApproved: false` impide registros públicos mientras no exista política definitiva ni verificación SMS. La activación del registro requiere primero pruebas autorizadas y la política de tratamiento de datos.

## Qué falta para operar

1. Crear y confirmar en Supabase Authentication al usuario de `bellashopinsumos@gmail.com` y asignarle el rol administrador según `README.md`.
2. Configurar las URLs de redirección de autenticación y recuperación de contraseña.
3. Contratar/configurar SMS OTP en Supabase; aprobar la política de tratamiento de datos.
4. Registrar premios reales y comprobar inventario, rentabilidad, puntos y auditoría.
5. Realizar pruebas completas con usuarios autorizados antes del lanzamiento.

No se han modificado los proyectos de RutaYa, Master Viviana ni el inventario original de BellaShop.

La migración de restauración y gestión de empleados está en `supabase/migrations/20261120_restauracion_y_equipo.sql` y ya está aplicada en el proyecto BellaLovers.
