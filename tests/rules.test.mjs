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
console.log('OK: 20 verificaciones de reglas y administración BellaLovers');
