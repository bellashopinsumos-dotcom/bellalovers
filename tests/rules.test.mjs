import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcPoints, referralPoints, DEFAULT_RULES } from '../assets/core.js';
assert.equal(calcPoints(68000),6,'No redondear hacia arriba');
assert.equal(calcPoints(49999),0,'Compra mínima');
assert.equal(calcPoints(50000),5,'Compra de 50 mil');
assert.equal(calcPoints(59000),5,'Entre 50 y 60 mil conserva cinco puntos');
assert.equal(calcPoints(60000),6,'Cada 10 mil adicionales suma un punto');
assert.equal(calcPoints(70000),7,'Compra de 70 mil genera siete puntos');
assert.equal(calcPoints(150000),15,'Compra de 150 mil');
assert.equal(calcPoints(500000),50,'Compra de 500 mil');
assert.equal(calcPoints(100000,DEFAULT_RULES,true),0,'Descuento excluido');
assert.equal(calcPoints(150000,DEFAULT_RULES,false,1,'estudiante'),0,'Primera compra estudiante');
assert.equal(calcPoints(150000,DEFAULT_RULES,false,2,'estudiante'),15,'Segunda compra estudiante');
for (const [n,p] of [[50000,1],[99999,1],[100000,2],[200000,4],[400000,6],[600000,8],[1000000,10]]) assert.equal(referralPoints(n),p);

const adminJs = readFileSync(new URL('../assets/admin.js', import.meta.url), 'utf8');
assert.doesNotMatch(adminJs, /(?<!\$)\$\(['"][^'"]+['"]\)\.forEach\(/,
  'El selector de un elemento no se puede recorrer con forEach; usar $');
assert.match(adminJs, /\$\$\('\[data-edit-staff\]'\)\.forEach\(/,
  'El listado de personal necesita querySelectorAll');
const clientJs = readFileSync(new URL('../assets/client.js', import.meta.url), 'utf8');
assert.match(clientJs, /configureHomeNavigation\(\);/, 'La portada debe controlar restauración al recargar');
assert.match(clientJs, /history\.replaceState\(/, 'Al navegar por secciones hay que evitar conservar el ancla en URL');
const publicHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const adminHtml = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
assert.match(publicHtml, /id="joinForm"/, 'La portada debe ofrecer solicitudes manuales');
assert.match(publicHtml, /id="memberLoginForm"/, 'La portada ofrece inicio de sesión privado');
assert.doesNotMatch(publicHtml, /id="phoneForm"/, 'No debe quedar ingreso por SMS');
const loginFn = readFileSync(new URL('../supabase/functions/bellalovers-ingresar/index.ts', import.meta.url), 'utf8');
const approvalFn = readFileSync(new URL('../supabase/functions/bellalovers-aprobar/index.ts', import.meta.url), 'utf8');
const keyFn = readFileSync(new URL('../supabase/functions/bellalovers-clave/index.ts', import.meta.url), 'utf8');
assert.match(loginFn, /signInWithPassword/, 'El acceso se valida con contraseña, no correo de activación');
assert.match(adminHtml, /id="section-joins"/, 'Panel de revisión de solicitudes');
assert.match(adminJs, /bl_join_requests/, 'Admin consulta solicitudes desde Supabase');
assert.match(adminJs, /bellalovers-aprobar/, 'El alta requiere aprobación protegida y factura');
assert.match(publicHtml, /<select id="joinTeacherCode"/,
  'La selección de profesora afiliada debe ser una lista, no un texto libre');
assert.doesNotMatch(publicHtml, /<option value="profesora">Profesora de uñas<\/option>/,
  'Nadie debe afiliarse como profesora por la inscripción pública');
assert.match(clientJs, /bl_list_affiliated_teachers/,
  'Solo cargar profesoras desde el directorio autorizado');
assert.match(adminHtml, /id="affiliateForm"/,
  'El administrador debe incorporar profesoras afiliadas');
assert.match(adminHtml, /id="affiliatesTable"/,
  'El administrador debe ver el directorio de profesoras');
assert.match(adminJs, /bl_manage_affiliated_teacher/,
  'La edición de afiliación debe pasar por una función segura');
assert.match(adminJs, /data-affiliate-retire/,
  'Debe ser posible retirar a una profesora sin borrar su historial');
assert.match(publicHtml, /id="memberPhone"/, 'Ingreso por celular');
assert.match(publicHtml, /id="memberAccessKey"/, 'Ingreso con clave privada entregada por BellaShop');
assert.match(publicHtml, /id="myJoinedDate"/, 'Fecha de ingreso visible en la cuenta');
assert.match(publicHtml, /id="rewardsLock"/, 'El bloqueo de premios debe estar claramente visible');
assert.match(publicHtml, /id="refreshMemberRewards"/, 'Recompensas actualizables desde la cuenta');
assert.match(clientJs, /bellalovers-ingresar/, 'El ingreso usa verificación con celular y clave en el servidor');
assert.match(clientJs, /Próximamente tendremos recompensas/, 'Si faltan premios, mostrar Próximamente');
assert.match(clientJs, /Premios bloqueados hasta/, 'Los premios se bloquean antes de la meta');
assert.match(clientJs, /customer\.created_at/, 'Fecha de afiliación obtenida del perfil real');
assert.match(loginFn, /bl_profiles/, 'Solo miembros activos pueden ingresar');
assert.match(loginFn, /getUserById/, 'El servidor resuelve la cuenta de Auth de la clienta');
assert.match(loginFn, /bl_limit_member_access/, 'Limitar intentos sin SMS');
assert.match(adminHtml,/id="purchasePhone"/, 'Comprar buscando por celular');
assert.match(adminHtml,/id="purchaseFind"/, 'Confirmar cliente antes de guardar compra');
assert.doesNotMatch(adminHtml,/id="purchaseDelivery"/, 'No mostrar costo de transporte en compras');
assert.doesNotMatch(adminHtml,/id="joinDelivery"/, 'No mostrar costo de transporte al aprobar primera compra');
assert.doesNotMatch(adminHtml,/id="purchaseInvoice"[^>]*\srequired/, 'Factura debe ser opcional');
assert.match(adminJs,/bl_purchase_simple/, 'Compra sencilla validada en el servidor');
assert.match(adminJs,/bl_reverse_manual_adjustment/, 'Deshacer ajuste realmente revierte puntos');
assert.match(adminJs,/bellalovers-eliminar/, 'Solo admin puede iniciar cierre de cuenta');
assert.match(adminJs,/data-reverse-adjustment/, 'Mostrar botón de deshacer en ficha');
assert.match(adminJs,/deleteMemberAccount\(/, 'Mostrar eliminación segura de cuenta');
const deleteFn=readFileSync(new URL('../supabase/functions/bellalovers-eliminar/index.ts',import.meta.url),'utf8');
assert.match(deleteFn,/staff\.role!=="admin"/, 'Eliminar cuenta requiere administrador autorizado');
assert.match(deleteFn,/deleteUser\(id,true\)/, 'Eliminación de acceso en Auth conserva referencias');
assert.ok(publicHtml.indexOf('id="acceso"') < publicHtml.indexOf('id="inicio"'),
  'Iniciar sesión debe aparecer primero en la portada');
assert.match(publicHtml, /data-auth-screen="signin"/, 'Pestaña de iniciar sesión');
assert.match(publicHtml, /data-auth-screen="register"/, 'Pestaña de registrarse');
assert.doesNotMatch(publicHtml, /id="joinEmail"/, 'Registro sin necesidad de correo Gmail');
assert.doesNotMatch(publicHtml, /id="memberIdentifier"/, 'No mostrar solicitud antigua de correo');
assert.doesNotMatch(clientJs, /signInWithOtp/, 'El ingreso no debe enviar magic links al correo');
assert.match(clientJs, /auth\.setSession/, 'La sesión se establece con credenciales verificadas');
assert.match(approvalFn, /auth\.admin\.createUser/, 'Nueva membresía creada sin invitación de correo');
assert.doesNotMatch(approvalFn, /inviteUserByEmail/, 'Aprobación sin enviar invitaciones por correo');
assert.match(adminHtml, /id="memberKeyDialog"/, 'Clave mostrada al administrador solamente');
assert.match(adminJs, /bellalovers-clave/, 'Generar nueva clave exclusivamente desde admin');
assert.match(adminJs, /Copiar mensaje/, 'Entrega de clave mediante mensaje preparado');
assert.match(keyFn, /staff\.role!=="admin"/, 'Solo administrador puede restablecer una clave');
assert.match(loginFn, /refresh_token/, 'El servidor devuelve una sesión de miembro autenticado');
console.log('OK: 74 verificaciones BellaLovers (acceso al inicio sin correo, SMS ni autoconfirmación)');
