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
assert.match(publicHtml, /id="memberLoginForm"/, 'Miembros aprobados deben poder pedir acceso por correo');
assert.doesNotMatch(publicHtml, /id="phoneForm"/, 'No debe quedar ingreso por SMS');
assert.match(clientJs, /shouldCreateUser:false/, 'Nadie crea una cuenta solo solicitando acceso por correo');
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
console.log('OK: 36 verificaciones BellaLovers (profesoras afiliadas controladas por BellaShop)');
