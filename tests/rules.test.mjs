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
const publicAccountFn=readFileSync(new URL('../supabase/functions/bellalovers-consulta/index.ts',import.meta.url),'utf8');
assert.match(loginFn, /status:410/, 'Ruta antigua de aprobación de ingresos desactivada');
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
assert.match(publicHtml, /id="memberIdentifier"/, 'Ingreso visible por celular o correo');
assert.match(publicHtml, /id="memberFullName"/, 'El acceso pide nombre y apellido');
assert.doesNotMatch(publicHtml, /id="memberAccessKey"/, 'Nunca se pide clave privada a clientas');
assert.match(publicHtml, /id="myJoinedDate"/, 'Fecha de ingreso visible en la cuenta');
assert.match(publicHtml, /id="rewardsLock"/, 'El bloqueo de premios debe estar claramente visible');
assert.match(publicHtml, /id="refreshMemberRewards"/, 'Recompensas actualizables desde la cuenta');
assert.match(clientJs, /bellalovers-consulta/, 'Ingresar únicamente con celular o correo y nombre');
assert.match(clientJs, /Próximamente tendremos recompensas/, 'Si faltan premios, mostrar Próximamente');
assert.match(clientJs, /Premios bloqueados hasta/, 'Los premios se bloquean antes de la meta');
assert.match(clientJs, /customer\.created_at/, 'Fecha de afiliación obtenida del perfil real');
assert.match(publicAccountFn, /bl_profiles/, 'Consultar solo membresías activas');
assert.match(publicAccountFn, /normalizeName/, 'Confirmar coincidencia del nombre completo');
assert.match(publicAccountFn, /bl_limit_member_access/, 'Limitar búsquedas públicas por cliente');
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
assert.ok(publicHtml.indexOf('id="inicio"')<publicHtml.indexOf('id="authModal"'),
  'La portada debe aparecer normalmente; acceso solo en la ventana');
assert.match(publicHtml, /id="authModal"[^>]*hidden/, 'Modal oculto por defecto');
assert.match(publicHtml, /id="closeAuthModal"/, 'El modal debe tener una X');
assert.match(publicHtml, /role="dialog" aria-modal="true"/, 'Ventana accesible');
assert.match(publicHtml, /data-auth-screen="signin"/, 'Pestaña de iniciar sesión');
assert.match(publicHtml, /data-auth-screen="register"/, 'Pestaña de registrarse');
assert.match(publicHtml, /id="joinEmail"[^>]*type="email"[^>]*>/, 'Correo opcional para quien quiera ingresar con correo');
assert.doesNotMatch(publicHtml, /id="joinEmail"[^>]*required/, 'El correo nunca es obligatorio');
assert.doesNotMatch(publicHtml, /id="memberPhone"/, 'No pedir celular como único identificador');
assert.doesNotMatch(clientJs, /signInWithOtp/, 'El ingreso no debe enviar magic links al correo');
assert.doesNotMatch(clientJs, /auth\.setSession/, 'Consulta por nombre y celular no emite sesiones de Auth');
assert.match(approvalFn, /auth\.admin\.createUser/, 'Nueva membresía creada sin invitación de correo');
assert.doesNotMatch(approvalFn, /inviteUserByEmail/, 'Aprobación sin enviar invitaciones por correo');
assert.doesNotMatch(adminHtml, /id="loginRequestsTable"/, 'Admin ya no aprueba ingresos de clientas');
assert.match(adminJs, /bl_decide_guest_reward/, 'Admin confirma por WhatsApp antes de gastar puntos');
assert.doesNotMatch(adminHtml, /id="copyMemberKey"/, 'No se entregan claves a clientas');
assert.match(keyFn, /status:410/, 'Endpoint de claves privadas deshabilitado');
assert.match(publicAccountFn, /invoice:null/, 'No compartir números de factura en consultas sin autenticación');
assert.match(clientJs, /openAuthModal/, 'Al tocar iniciar sesión se abre modal');
assert.match(clientJs, /closeAuthModal/, 'Permite cerrar modal');
assert.match(clientJs, /handleAuthKeydown/, 'Cierre con Escape y navegación de teclado');
assert.match(clientJs, /normalizeIdentifier/, 'Identificador normalizado sin contraseñas');
assert.match(publicAccountFn, /bl_resolve_member_email/, 'Consulta de correo solo en servidor');
assert.doesNotMatch(publicAccountFn, /generateLink\(/, 'No crear sesiones Auth mediante nombre y teléfono');
assert.doesNotMatch(publicAccountFn, /verifyOtp\(/, 'No exigir códigos o correos');
assert.match(publicAccountFn, /bl_guest_reward_requests/, 'Canjes son solicitudes pendientes');
assert.doesNotMatch(loginFn, /signInWithPassword/, 'No usar contraseña como acceso');
assert.doesNotMatch(clientJs, /memberKeyForm|memberAccessKey|access_key/, 'Frontend sin clave privada');
assert.doesNotMatch(adminJs, /resetMemberKey|showMemberKey|issuedMemberKey/, 'Admin sin generación de claves');
assert.doesNotMatch(approvalFn, /access_key|password:/, 'Aprobación sin clave para clientas');
assert.match(clientJs, /fetchGuestAccount/, 'Consulta inmediata de cuenta tras escribir dos datos');
assert.doesNotMatch(clientJs, /pollMemberLogin|memberVerification|cancelMemberLogin/, 'No esperar aprobación para entrar');
assert.doesNotMatch(publicHtml, /memberVerification|Esperando autorización/, 'Ventana sin solicitud de autorización');
assert.match(clientJs, /request_reward/, 'El canje se envía como solicitud pendiente');
assert.match(clientJs, /Confirmar tu canje por WhatsApp|confirme tu canje por WhatsApp/i, 'Confirmación por WhatsApp antes de descuento');
assert.match(publicAccountFn, /status:"pendiente"/, 'Crear solicitudes de premios sin descontar puntos');
assert.match(publicAccountFn, /balance<threshold/, 'Bloquear canjes según meta configurada por BellaShop');
assert.match(adminHtml, /id="guestRedemptionsTable"/, 'Admin revisa nuevas solicitudes de premios');
assert.match(adminJs, /CONFIRMADO/, 'Admin confirma con titular antes de descontar');
assert.doesNotMatch(adminJs, /renderLoginRequests|reviewLoginRequest/, 'No pedir aprobación para iniciar sesión');

const accessCaps=[...publicAccountFn.matchAll(/limit\((?:key|ip),"[^"]+",(\d+)\)/g)].map(x=>Number(x[1]));
assert.equal(accessCaps.length,3,'Comprobar límites de acceso, IP y premios');
assert.ok(accessCaps.every(cap=>cap>=1&&cap<=100),'Todos los límites deben cumplir el máximo de 100 de bl_limit_member_access');
assert.match(publicAccountFn,/action==="public_rules"/,'Reglas públicas disponibles sin entrar en una cuenta');
assert.match(publicAccountFn,/gift_claimed/,'La cuenta debe saber si recibió regalo de bienvenida');
assert.match(publicAccountFn,/threshold=Math\.max\(1,Number\(settings\?\.unlock_points\|\|50\)\)/,'Meta de canjes configurable');
assert.doesNotMatch(publicAccountFn,/if\(balance<50\)/,'Nunca bloquear con la antigua meta fija si el administrador cambió puntos');
assert.match(clientJs,/data\.gift_claimed/,'La app muestra los regalos entregados');
assert.match(clientJs,/serverBalance/,'El saldo remoto debe tener prioridad sobre el historial recortado');
assert.match(clientJs,/edgeErrorMessage/,'Mostrar error real de las funciones');
assert.match(clientJs,/loadPublicRules/,'Cargar y pintar reglas actuales del club');
assert.match(adminJs,/guestRewardRequests\.filter\(p=>p\.status==='pendiente'\)/,'Incluir nuevas solicitudes de premios en el resumen');
assert.match(adminJs,/guestRedemptionIds/,'Evitar repetir los premios confirmados en el listado anterior');
assert.match(adminJs,/parseFunctionFailure/,'Mostrar por qué falló la aprobación de membresía');
assert.match(publicHtml,/data-live-rule="base-eq"/,'Acumulación pública editable');
assert.match(publicHtml,/data-live-rule="rule-duration"/,'Vigencia pública editable');
assert.doesNotMatch(clientJs,/sb\.rpc\('bl_redeem'/,'El cliente no puede reservar canjes directamente con sesiones antiguas');
assert.match(clientJs,/if\(session\)\s*\{[\s\S]*?sb\.auth\.signOut/,'Se deben cerrar las sesiones antiguas de miembros');
const legacyLock=readFileSync(new URL('../supabase/migrations/20261121_bloquear_canje_directo_anterior.sql',import.meta.url),'utf8');
assert.match(legacyLock,/REVOKE EXECUTE ON FUNCTION public\.bl_redeem\(jsonb\)/,'Cierre del canje directo antiguo también en servidor');

for(const id of ['progressCounter','progressPercent','pointsProgress','pointsCelebration','memberQrPanel','memberQrImage','memberQrCode','showMemberQr','copyMemberCode','rewardPublishedCount','rewardSort']){
 assert.match(publicHtml,new RegExp('id="'+id+'"'),'Control público: '+id);
}
for(const id of ['adminRewardBadge','adminRewardAlerts','goPendingRewards','clubMonthlyChart','csvSummary','adminRewardsEmpty']){
 assert.match(adminHtml,new RegExp('id="'+id+'"'),'Control administrativo: '+id);
}
assert.match(clientJs,/const set=\(key,value\)=>\$\$\(/,'Actualizar todas las reglas dinámicas, no solo un elemento');
assert.match(clientJs,/showMemberQr\(\)/,'El carné tiene un código QR generado localmente');
assert.match(clientJs,/copyMemberCode\(\)/,'El carné permite copiar el identificador');
assert.match(clientJs,/rewardSort==='available'/,'La vitrina puede priorizar premios disponibles');
assert.match(clientJs,/Próximamente, sorpresas para nuestras BellaLovers/,'Sin premios, el catálogo debe mostrar un mensaje real');
assert.match(clientJs,/qty<5/,'No permitir seleccionar más de 5 unidades de un mismo premio');
assert.match(adminJs,/startPendingRewardPoll\(\)/,'Se activa la comprobación periódica de nuevos canjes');
assert.match(adminJs,/stopPendingRewardPoll\(\)/,'Se detiene la comprobación al salir');
assert.match(adminJs,/updatePendingRewardAlerts\(\)/,'Administración muestra el número de canjes pendientes');
assert.match(adminJs,/renderMonthlyChart\(valid\)/,'Estadísticas basadas en compras confirmadas');
assert.match(adminJs,/exportClubSummary\(\)/,'El resumen mensual se puede exportar');
assert.match(adminJs,/p\.id\.slice\(0,8\)/,'Búsqueda administrativa por código de carné');
console.log('OK: pruebas BellaLovers y regresión de acceso, recompensas y configuración');
