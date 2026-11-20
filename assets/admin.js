import {HAS_BACKEND} from './config.js';
import {db,$,$$,fmt,date,esc,TYPE,DEFAULT_RULES,notify,setLoading,pill,safeUrl} from './core.js?v=solicitudes20261120final';
let sb, staff, mode='locked', recoveryMode=false, photoPreviewUrl=null;
let profiles=[], purchases=[], points=[],adjustmentReversals=[], cycles=[], rewards=[], redemptions=[], redemptionItems=[],teachers=[],affiliatedTeachers=[],affiliateAttributions=[],referrals=[],tiers=[],giftOptions=[],giftClaims=[],audit=[],staffDirectory=[],joinRequests=[],selectedJoinId=null,settings={...DEFAULT_RULES},selectedCustomerId=null;
const CHANNEL_LABEL={tienda:'Tienda',whatsapp:'WhatsApp',domicilio:'Domicilio',web:'Página web',otro:'Otro'};
const titles={joins:['Solicitudes de ingreso','Solo la primera factura confirmada activa una membresía.'],overview:['Resumen general','Lo importante de tu club, en un solo lugar.'],customers:['Clientas registradas','Información, saldos y permisos de las BellaLovers.'],purchases:['Compras y puntos','Solo las facturas confirmadas generan puntos.'],rewards:['Catálogo de recompensas','Premios, referencias, puntos e inventario.'],redemptions:['Solicitudes de premios','Aprueba o rechaza las redenciones pendientes.'],teachers:['Profesoras afiliadas','Solo las profesoras autorizadas por BellaShop aparecen en las solicitudes.'],gifts:['Regalos de bienvenida','Un detalle especial para estudiantes elegibles.'],settings:['Configuración del club','Las reglas que puede ajustar la jefa.'],staff:['Equipo y accesos','Autoriza, suspende y restaura accesos del equipo.'],audit:['Auditoría','Registro de cambios y autorizaciones.']};
function uname(id){return profiles.find(p=>p.id===id)?.full_name||'—';}
function ubalance(id){
  const validCycles=cycles.filter(c=>c.customer_id===id&&!c.closed_at&&Date.parse(c.grace_until)>Date.now()).map(c=>c.id);
  return points.filter(p=>p.customer_id===id&&validCycles.includes(p.cycle_id)).reduce((a,p)=>a+p.delta,0);
}
function requireLive(){if(mode!=='live'||!sb||!staff){notify('Inicia sesión con una cuenta administrativa autorizada.','error');return false;}return true;}
function checkManager(){if(staff?.role!=='admin'){notify('Esta acción requiere permisos de administración.','error');return false;}return true;}
async function run(q){const {data,error}=await q;if(error)throw new Error(error.message);return data;}
async function rpc(name,args={}){if(!requireLive())return null;return run(sb.rpc(name,args));}
function table(headers, rows){
 return `<table class="admin-table"><thead><tr>${headers.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}" class="empty">Aún no hay registros.</td></tr>`}</tbody></table>`;
}
function showPanel(name){
 $$('.admin-panel').forEach(e=>e.classList.toggle('active',e.id===`section-${name}`));$$('#adminNav button').forEach(b=>b.classList.toggle('active',b.dataset.section===name));
 $('#sectionTitle').textContent=titles[name][0];$('#sectionSubtitle').textContent=titles[name][1];
 if(window.innerWidth<690) window.scrollTo({top:0,behavior:'smooth'});
}
function enter(){
 mode='live';
 $('#adminLogin').classList.add('hidden');
 $('#adminApp').classList.remove('hidden');
 $('#adminMode').textContent=staff.role==='admin'?'Administrador':'Operador';
 $('#staffIdentity').textContent=staff.role;
}

async function login(e){e.preventDefault();const btn=$('#adminLoginForm button[type=submit]');
 try{setLoading(btn,true);sb=await db('admin');await run(sb.auth.signInWithPassword({email:$('#adminEmail').value.trim(),password:$('#adminPassword').value}));await initAdmin();}
 catch(err){notify('No se pudo ingresar: '+err.message,'error');}
 finally{setLoading(btn,false);}
}
async function initAdmin(){
 const {data:{user}}=await sb.auth.getUser();if(!user){$('#adminLogin').classList.remove('hidden');return;}
 staff=await run(sb.from('bl_staff').select('*').eq('user_id',user.id).eq('active',true).maybeSingle());
 if(!staff){await sb.auth.signOut();throw new Error('Este correo no tiene acceso de administrador. Debe estar autorizado previamente en Supabase.');}
 enter();await loadAll();
}
async function loadAll(){if(mode!=='live')return;
 const reqs=[
  ['profiles',sb.from('bl_profiles').select('*').order('created_at',{ascending:false}).limit(1000)],
  ['purchases',sb.from('bl_purchases').select('*').order('created_at',{ascending:false}).limit(1000)],
  ['points',sb.from('bl_points').select('*').order('created_at',{ascending:false}).limit(3000)],
  ...(staff?.role==='admin'?[['adjustmentReversals',sb.from('bl_adjustment_reversals').select('*').limit(3000)]]:[]),
  ['cycles',sb.from('bl_cycles').select('*').order('started_at',{ascending:false}).limit(1000)],
  ['rewards',sb.from('bl_rewards').select('*').order('created_at',{ascending:false})],
  ['redemptions',sb.from('bl_redemptions').select('*').order('created_at',{ascending:false}).limit(1000)],
  ['redemptionItems',sb.from('bl_redemption_items').select('*')],
  ['teachers',sb.from('bl_teacher_codes').select('*')],
  ...(staff?.role==='admin'?[['affiliatedTeachers',sb.from('bl_affiliated_teachers').select('*').order('display_name')],['affiliateAttributions',sb.from('bl_affiliate_attributions').select('*')]]:[]),
  ['referrals',sb.from('bl_referrals').select('*')],
  ['tiers',sb.from('bl_referral_tiers').select('*').order('min_amount')],
  ['giftOptions',sb.from('bl_gift_options').select('*').order('name')],
  ['giftClaims',sb.from('bl_gift_claims').select('*').order('delivered_at',{ascending:false})],
  ['audit',sb.from('bl_audit').select('*').order('created_at',{ascending:false}).limit(150)],
  ['settings',sb.from('bl_settings').select('*').eq('id',1).single()],
  ...(staff?.role==='admin'?[['joinRequests',sb.from('bl_join_requests').select('*').order('created_at',{ascending:false}).limit(1000)]]:[]),
  ...(staff?.role==='admin'?[['staffDirectory',sb.rpc('bl_list_staff')]]:[]),
 ];
 try{const results=await Promise.all(reqs.map(async ([name,q])=>[name,await run(q)]));   const d=Object.fromEntries(results);({profiles,purchases,points,cycles,rewards,redemptions,redemptionItems,teachers,referrals,tiers,giftOptions,giftClaims,audit,settings}=d);
   staffDirectory=d.staffDirectory||[];joinRequests=d.joinRequests||[];adjustmentReversals=d.adjustmentReversals||[];affiliatedTeachers=d.affiliatedTeachers||[];affiliateAttributions=d.affiliateAttributions||[];renderAll();}
 catch(err){notify('No se pudieron cargar todos los datos: '+err.message,'error');}
}
function statTile(label,n){return `<article class="stat-tile"><p>${esc(label)}</p><strong>${esc(n)}</strong></article>`;}
function renderOverview(){
 const valid=purchases.filter(p=>p.status==='confirmada');const pending=redemptions.filter(p=>p.status==='solicitada').length;
 const earned=points.filter(p=>p.delta>0&&['compra','referido'].includes(p.kind)).reduce((s,p)=>s+p.delta,0);
 const claimsCost=giftClaims.reduce((s,g)=>s+(giftOptions.find(o=>o.id===g.gift_id)?.unit_cost||0),0);
 const prizesCost=redemptions.filter(r=>r.status==='aprobada').reduce((s,r)=>s+redemptionItems.filter(i=>i.redemption_id===r.id).reduce((a,i)=>a+i.qty*(rewards.find(w=>w.id===i.reward_id)?.unit_cost||0),0),0);
 $('#overviewStats').innerHTML=statTile('Clientas registradas',profiles.length)+statTile('Ventas del club',fmt(valid.reduce((s,p)=>s+p.products_total,0)))+statTile('Solicitudes pendientes',pending)+statTile('Puntos emitidos',earned)+statTile('Solicitudes por revisar',joinRequests.filter(x=>x.status==='pendiente').length);
 $('#recentPurchases').innerHTML=table(['Factura','Canal','Clienta','Productos','Puntos','Estado'],purchases.slice(0,7).map(p=>`<tr><td>${esc(p.invoice)}</td><td>${esc(CHANNEL_LABEL[p.channel]||'Tienda')}</td><td>${esc(uname(p.customer_id))}</td><td>${fmt(p.products_total)}</td><td>${p.points_awarded}</td><td>${pill(p.status,p.status==='confirmada'?'green':'red')}</td></tr>`));
 if(!$('#additionalStats')) {const card=document.createElement('div');card.className='admin-card';card.id='additionalStats';$('#section-overview').append(card);}
 const repeat=profiles.filter(c=>valid.filter(p=>p.customer_id===c.id).length>1).length;
 const sales=valid.reduce((s,p)=>s+p.products_total,0);
 const returnedStudents=profiles.filter(c=>c.category==='estudiante'&&valid.filter(p=>p.customer_id===c.id).length>=2).length;
 const expired=points.filter(p=>p.kind==='vencimiento').reduce((s,p)=>s-p.delta,0);
 const topTeachers=profiles.filter(p=>p.category==='profesora').map(p=>({name:p.full_name,awards:referrals.filter(r=>r.teacher_id===p.id&&r.awarded_at).length,pts:points.filter(x=>x.customer_id===p.id&&x.kind==='referido').reduce((s,x)=>s+x.delta,0)})).sort((a,b)=>b.awards-a.awards).slice(0,5);
 const channelTotals=Object.entries(CHANNEL_LABEL).map(([id,label])=>({label,count:valid.filter(p=>(p.channel||'tienda')===id).length,total:valid.filter(p=>(p.channel||'tienda')===id).reduce((n,p)=>n+p.products_total,0)}));
 const prizeRank=rewards.map(r=>({name:r.name,qty:redemptionItems.filter(i=>i.reward_id===r.id&&redemptions.some(d=>d.id===i.redemption_id&&d.status==='aprobada')).reduce((s,i)=>s+i.qty,0)})).filter(x=>x.qty>0).sort((a,b)=>b.qty-a.qty).slice(0,5);
 $('#additionalStats').innerHTML=`<h2>Indicadores adicionales</h2><div class="stats-grid">${statTile('Clientas con recompra',repeat)}${statTile('Estudiantes que regresaron',returnedStudents)}${statTile('Puntos redimidos',-points.filter(p=>p.kind==='redencion').reduce((s,p)=>s+p.delta,0))}${statTile('Puntos vencidos',expired)}${statTile('Costo estimado de premios',fmt(prizesCost+claimsCost))}${statTile('Costo de premios / ventas',sales?((prizesCost+claimsCost)/sales*100).toFixed(1)+'%':'—')}${statTile('Ticket promedio',valid.length?fmt(Math.round(sales/valid.length)):'—')}${statTile('Compras por clienta',profiles.length?(valid.length/profiles.length).toFixed(1):'—')}</div><div class="admin-card-header"><h2>Ventas por canal</h2><span class="info-inline">Solo productos facturados</span></div>${table(['Canal','Facturas','Valor productos'],channelTotals.map(x=>`<tr><td>${esc(x.label)}</td><td>${x.count}</td><td>${fmt(x.total)}</td></tr>`))}<div class="admin-form"><div><h2>Profesoras con más primeras compras referidas</h2>${topTeachers.length?table(['Profesora','Referidos','Puntos'],topTeachers.map(t=>`<tr><td>${esc(t.name)}</td><td>${t.awards}</td><td>${t.pts}</td></tr>`)):'<p class="muted">Sin profesoras verificadas aún.</p>'}</div><div><h2>Recompensas más elegidas</h2>${prizeRank.length?table(['Producto','Entregas'],prizeRank.map(t=>`<tr><td>${esc(t.name)}</td><td>${t.qty}</td></tr>`)):'<p class="muted">Sin recompensas entregadas aún.</p>'}</div></div><p class="form-help">Indicadores descriptivos calculados con los registros cargados. Los costos de premio son manuales; no representan el margen bruto real de BellaShop.</p>`;
}
function populateClientSelects(){
 // Las compras ya no usan una lista de cientos de nombres: búsqueda exacta por celular.
 const selected=$('#purchaseCustomer');
 if(selected?.value && !profiles.some(p=>p.id===selected.value&&!p.blocked&&!p.archived_at&&!p.deleted_at)){
  selected.value='';$('#purchaseLookupResult').textContent='La clienta dejó de estar activa. Busca nuevamente por celular.';
 }
 const eligible=purchases.filter(p=>p.welcome_eligible&&p.status==='confirmada'&&!giftClaims.some(g=>g.student_id===p.customer_id)&&profiles.some(c=>c.id===p.customer_id&&!c.blocked&&!c.archived_at&&!c.deleted_at));
 $('#giftStudent').innerHTML='<option value="">Selecciona una estudiante</option>'+eligible.map(p=>'<option value="'+esc(p.customer_id)+'">'+esc(uname(p.customer_id))+' · '+esc(p.invoice)+'</option>').join('');
 $('#giftChoice').innerHTML='<option value="">Selecciona un regalo</option>'+giftOptions.filter(g=>g.active&&g.stock>0).map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+' · '+g.stock+' disponibles</option>').join('');
}
function normalizedPurchasePhone(input){
 const digits=String(input||'').replace(/[^0-9]/g,'');
 const local=digits.startsWith('57')&&digits.length===12?digits.slice(2):digits;
 if(!/^3\d{9}$/.test(local))throw new Error('Escribe un celular colombiano de 10 dígitos.');
 return '+57'+local;
}
async function findPurchaseCustomer(){
 const result=$('#purchaseLookupResult');
 $('#purchaseCustomer').value='';
 try{
  if(!requireLive())return null;
  const phone=normalizedPurchasePhone($('#purchasePhone').value);
  result.textContent='Buscando clienta…';
  const profile=await run(sb.from('bl_profiles').select('id,full_name,phone,category,blocked,archived_at,deleted_at').eq('phone',phone).maybeSingle());
  if(!profile){result.innerHTML='<span class="status red">No encontrada</span> No hay una membresía aprobada con ese celular. Revisa Solicitudes de ingreso.';return null;}
  if(profile.blocked||profile.archived_at||profile.deleted_at){
   result.textContent='Esta cuenta está suspendida, archivada o eliminada. Revisa Clientas antes de registrar compras.';return null;
  }
  $('#purchaseCustomer').value=profile.id;
  result.innerHTML='<strong>✓ '+esc(profile.full_name)+'</strong><span>'+esc(profile.phone)+' · '+esc(TYPE[profile.category]||profile.category)+'</span>';
  return profile;
 }catch(err){result.textContent=err.message;return null;}
}

function renderCustomers(){
 const term=$('#searchCustomers').value.trim().toLocaleLowerCase('es');
 const chosen=$('#customerStatusFilter')?.value||'all';
 const filtered=profiles.filter(p=>{
   const match=(p.full_name+' '+(p.phone||'')).toLowerCase().includes(term);
   const status=p.deleted_at?'deleted':p.archived_at?'archived':p.blocked?'blocked':'active';
   return match&&(chosen==='all'||chosen===status);
 });
 const status=p=>p.deleted_at?pill('Eliminada','red'):p.archived_at?pill('Archivada','neutral'):p.blocked?pill('Bloqueada','red'):pill('Activa','green');
 $('#customersTable').innerHTML=table(['Nombre','Celular','Categoría','Puntos','Estado',''],filtered.map(p=>
   `<tr><td><strong>${esc(p.full_name)}</strong><div class="muted-cell">${date(p.created_at)}</div></td><td>${esc(p.phone)}</td><td>${esc(TYPE[p.category])}</td><td><strong>${ubalance(p.id)}</strong></td><td>${status(p)}</td><td><button class="btn btn-outline" data-view-customer="${esc(p.id)}">Ver ficha</button></td></tr>`));
 $$('[data-view-customer]').forEach(b=>b.onclick=()=>{
   selectedCustomerId=b.dataset.viewCustomer;renderCustomerDetail();
   if(window.innerWidth<690)$('#selectedCustomerCard')?.scrollIntoView({behavior:'smooth',block:'start'});
 });
 renderCustomerDetail();
}
async function manageCustomer(p,action,category=null){
 if(!requireLive()||!checkManager())return;
 const verbs={block:'bloquear',unblock:'desbloquear',archive:'archivar',restore:'restaurar',category:'cambiar la categoría de'};
 const reason=prompt('Motivo para '+verbs[action]+' '+p.full_name+' (mínimo 8 caracteres):');
 if(reason===null)return;
 if(reason.trim().length<8)return notify('Escribe un motivo de al menos 8 caracteres.','error');
 if(!confirm('¿Confirmas '+verbs[action]+' esta cuenta? El cambio quedará registrado en auditoría.'))return;
 try {
   await rpc('bl_manage_customer',{p_customer:p.id,p_action:action,p_category:category,p_reason:reason.trim()});
   notify(action==='restore'?'Cuenta restaurada con su historial intacto':'Cambio guardado y auditado');
   await loadAll();
 }catch(err){notify(err.message,'error');}
}
function renderCustomerDetail(){
 const p=profiles.find(x=>x.id===selectedCustomerId);
 if(!p){$('#selectedCustomer').innerHTML='<p>Selecciona una clienta para revisar su historial y administrar su cuenta.</p>';return;}
 const archived=!!p.archived_at,deleted=!!p.deleted_at;
 const cycle=cycles.filter(c=>c.customer_id===p.id&&!c.closed_at).sort((a,b)=>new Date(a.expires_at)-new Date(b.expires_at))[0];
 const own=points.filter(x=>x.customer_id===p.id);
 const movements=own.slice(0,12).map(x=>'<li>'+date(x.created_at)+': '+(x.delta>0?'+':'')+x.delta+' puntos · '+esc(x.kind)+(x.detail?' · '+esc(x.detail):'')+'</li>').join('');
 const status=deleted?'Eliminada':archived?'Archivada':p.blocked?'Bloqueada':'Activa';
 const categoryOptions=['estudiante','manicurista','profesora'].map(c=>'<option value="'+c+'" '+(p.category===c?'selected':'')+'>'+esc(TYPE[c]||c)+'</option>').join('');
 const actions=deleted?'<span class="status red">Cuenta eliminada (no se puede restaurar)</span>':
  archived?'<button class="btn btn-primary" id="restoreCustomer">Restaurar cuenta</button>':
  '<button class="btn btn-outline" id="toggleCustomerBlock">'+(p.blocked?'Desbloquear':'Bloquear')+' cuenta</button>'+
  '<button class="btn btn-outline" id="archiveCustomer">Archivar (reversible)</button>';
 const adjustments=own.filter(x=>x.kind==='ajuste'&&x.delta!==0
   &&!adjustmentReversals.some(r=>r.original_adjustment_id===x.id)
   &&!String(x.detail||'').startsWith('Reversión del ajuste manual') &&
   !String(x.detail||'').startsWith('Reversión del ajuste de prueba'));
 const adjustmentHtml=adjustments.slice(0,15).map(x=>
   '<div class="point-adjustment-row"><div><strong>'+(x.delta>0?'+':'')+x.delta+' puntos</strong>'+
   '<small>'+date(x.created_at)+' · '+esc(x.detail||'Ajuste')+'</small></div>'+
   '<button class="btn btn-outline btn-small" type="button" data-reverse-adjustment="'+esc(x.id)+'"'+
   (p.blocked||archived||deleted?' disabled':'')+'>Deshacer ajuste</button></div>').join('');
 const html=[
  '<div class="admin-form">',
  '<div><p class="form-help">Clienta y celular de contacto</p><strong>'+esc(p.full_name)+'</strong><p>'+esc(p.phone||'Sin celular asociado')+'</p><p class="admin-tag">Estado: '+esc(status)+'</p></div>',
  '<div><p class="form-help">Saldo actual</p><strong>'+ubalance(p.id)+' puntos</strong><p>Próximo vencimiento: '+date(cycle?.expires_at)+'</p></div>',
  '<div><label for="editCustomerCategory">Categoría</label><select class="admin-input" id="editCustomerCategory" '+(archived||deleted?'disabled':'')+'>'+categoryOptions+'</select></div>',
  '<div><p class="form-help">Registro y trazabilidad</p><p>Ingreso: '+date(p.created_at)+'</p><p>'+(deleted?'Eliminada: '+date(p.deleted_at):archived?'Archivada: '+date(p.archived_at):'Cuenta con historial completo')+'</p></div>',
  '<div class="span2 account-actions">',
  '<button class="btn btn-outline" id="saveCustomerCategory" '+(archived||deleted?'disabled':'')+'>Cambiar categoría</button>',
  actions,
  '<button class="btn btn-outline" id="adjustPointsBtn" '+(p.blocked||archived||deleted?'disabled':'')+'>Sumar o descontar puntos</button>',
  deleted?'':'<button class="btn btn-outline admin-danger" id="deleteCustomer">Eliminar cuenta y acceso</button>',
  '</div>',
  '<div class="span2"><h3 class="admin-subsection-heading">Ajustes manuales de puntos</h3>',
  '<p class="form-help">«Deshacer ajuste» registra el movimiento contrario sin borrar los originales.</p>',
  '<div class="point-adjustments">'+(adjustmentHtml||'<p class="form-help">Sin ajustes manuales pendientes de reversión.</p>')+'</div></div>',
  '<div class="span2"><p class="form-help">Últimos movimientos</p><ul class="list-compact">'+(movements||'<li>Sin movimientos registrados</li>')+'</ul></div>',
  '</div>'
 ].join('');
 $('#selectedCustomer').innerHTML=html;
 $('#saveCustomerCategory').onclick=()=>{const c=$('#editCustomerCategory').value;if(c===p.category)return notify('Ya tiene esa categoría.');manageCustomer(p,'category',c);};
 if(!deleted){
  if(archived)$('#restoreCustomer').onclick=()=>manageCustomer(p,'restore');
  else{
   $('#toggleCustomerBlock').onclick=()=>manageCustomer(p,p.blocked?'unblock':'block');
   $('#archiveCustomer').onclick=()=>manageCustomer(p,'archive');
  }
  $('#deleteCustomer').onclick=()=>deleteMemberAccount(p);
 }
 $('#adjustPointsBtn').onclick=async()=>{
  if(!requireLive()||!checkManager())return;
  const quantity=prompt('¿Cuántos puntos sumar o descontar? Usa negativo para descontar, por ejemplo -20:');
  if(quantity===null)return;
  const number=Number(quantity);
  if(!Number.isInteger(number)||number===0)return notify('Escribe un entero distinto de cero.','error');
  const reason=prompt('Motivo obligatorio del ajuste (mínimo 8 caracteres):');
  if(reason===null)return;
  if(reason.trim().length<8)return notify('Explica el motivo con al menos 8 caracteres.','error');
  if(!confirm('¿Guardar un ajuste de '+number+' puntos? Quedará registrado en auditoría.'))return;
  try{await rpc('bl_adjust_points',{p_customer:p.id,p_delta:number,p_reason:reason.trim()});notify('Ajuste registrado y puntos recalculados.');await loadAll();}
  catch(err){notify(err.message,'error');}
 };
 $$('[data-reverse-adjustment]').forEach(button=>button.onclick=async()=>{
  if(!requireLive()||!checkManager())return;
  const original=own.find(pt=>pt.id===button.dataset.reverseAdjustment);if(!original)return;
  const reason=prompt('Motivo para deshacer el ajuste de '+original.delta+' puntos (mínimo 8 caracteres):');
  if(reason===null)return;
  if(reason.trim().length<8)return notify('Escribe un motivo de al menos 8 caracteres.','error');
  if(!confirm('¿Deshacer el ajuste de '+original.delta+' puntos? El movimiento quedará en auditoría.'))return;
  try{
   const result=await rpc('bl_reverse_manual_adjustment',{p_point:original.id,p_reason:reason.trim()});
   notify('Ajuste revertido: '+result.reverted_points+' puntos.');await loadAll();
  }catch(err){notify('No se pudo deshacer: '+err.message,'error');}
 });
}
async function deleteMemberAccount(p){
 if(!requireLive()||!checkManager())return;
 const typed=prompt('ELIMINACIÓN DE CUENTA: escribe ELIMINAR para desactivar su acceso, quitar sus datos de contacto y conservar las facturas/movimientos necesarios. No podrá restaurarse después.');
 if(typed===null)return;
 if(typed!=='ELIMINAR')return notify('Operación cancelada: escribe ELIMINAR.','error');
 const reason=prompt('Motivo de la eliminación (mínimo 8 caracteres):');
 if(reason===null)return;
 if(reason.trim().length<8)return notify('Describe el motivo con al menos 8 caracteres.','error');
 if(!confirm('Confirmación definitiva: ¿eliminar acceso y datos personales de contacto de '+p.full_name+'? Los registros contables permanecerán.'))return;
 try{
  const {data,error}=await sb.functions.invoke('bellalovers-eliminar',{body:{customer_id:p.id,reason:reason.trim()}});
  if(error)throw error;
  if(!data?.success){
   if(data?.account_closed){notify('Cuenta bloqueada y datos anonimizados. Supabase Auth necesita revisión técnica para terminar el cierre.','error');await loadAll();return;}
   throw new Error(data?.error||'No se completó la eliminación');
  }
  selectedCustomerId=null;notify('Cuenta eliminada, datos de contacto retirados e historial contable conservado.');await loadAll();
 }catch(err){notify('No se pudo eliminar: '+err.message,'error');}
}

function renderPurchases(){
 $('#purchasesTable').innerHTML=table(['Factura','Canal','Clienta','Productos','Transporte','Descuento','Puntos','Estado',''],purchases.map(p=>`<tr><td>${esc(p.invoice)}<div class="form-help">${date(p.created_at)}</div></td><td>${esc(CHANNEL_LABEL[p.channel]||'Tienda')}</td><td>${esc(uname(p.customer_id))}</td><td>${fmt(p.products_total)}</td><td>${fmt(p.delivery_fee)}</td><td>${p.special_discount?'Sí':'No'}</td><td>${p.points_awarded}${p.referral_awarded?` +${p.referral_awarded} referido`:''}</td><td>${pill(p.status,p.status==='confirmada'?'green':'red')}</td><td>${p.status==='confirmada'?`<button class="btn btn-outline admin-danger" data-void="${esc(p.id)}">Anular</button>`:''}</td></tr>`));
 $$('[data-void]').forEach(b=>b.onclick=async()=>{if(!requireLive()||!checkManager())return;const reason=prompt('Motivo obligatorio de anulación (mínimo 5 caracteres):');if(reason===null)return;if(!confirm('Se revertirán los puntos relacionados. ¿Continuar?'))return;try{await rpc('bl_void_purchase',{p_purchase:b.dataset.void,p_reason:reason});notify('Factura anulada y puntos revertidos');await loadAll();}catch(e){notify(e.message,'error');}});
}

function updateRewardPhotoPreview(src,description=''){
 const preview=$('#rewardPhotoPreview');if(!preview)return;
 if(src&&/^(https?:\/\/|blob:)/.test(src)){
  const image=document.createElement('img');image.src=src;image.alt='Vista previa del premio';image.loading='lazy';
  preview.replaceChildren(image);
  if(description){const small=document.createElement('span');small.textContent=description;preview.append(small);}
 }else preview.textContent='Puedes subir una fotografía desde tu celular antes de guardar el premio.';
}
function renderRewards(){
 $('#rewardsTable').innerHTML=table(['Foto','Producto','Referencia','Puntos','Disponibles','Costo','Categoría','Estado',''],rewards.map(r=>
  `<tr><td>${r.image_url?'<img class="reward-admin-thumb" src="'+esc(safeUrl(r.image_url))+'" alt="" loading="lazy">':'♡'}</td><td><strong>${esc(r.name)}</strong></td><td>${esc(r.product_ref)}</td><td>${r.points_cost}</td><td>${r.stock-r.reserved} <small>(${r.reserved} reservadas)</small></td><td>${fmt(r.unit_cost)}</td><td>${esc(r.audience)}</td><td>${r.active?pill('Publicado','green'):pill('Oculto','neutral')}</td><td><button class="btn btn-outline" data-edit-reward="${esc(r.id)}">Editar</button></td></tr>`));
 $$('[data-edit-reward]').forEach(b=>b.onclick=()=>{
  const r=rewards.find(x=>x.id===b.dataset.editReward);if(!r)return;
  $('#rewardId').value=r.id;$('#rewardName').value=r.name;$('#rewardRef').value=r.product_ref;
  $('#rewardPoints').value=r.points_cost;$('#rewardStock').value=r.stock;$('#rewardCost').value=r.unit_cost;
  $('#rewardAudience').value=r.audience;$('#rewardImage').value=r.image_url||'';$('#rewardActive').checked=r.active;
  $('#rewardPhoto').value='';updateRewardPhotoPreview(safeUrl(r.image_url), 'Fotografía actual');
  $('#rewardName').focus();$('#rewardForm').scrollIntoView({behavior:'smooth',block:'start'});
 });
}
function renderRedemptions(){
 $('#redemptionsTable').innerHTML=table(['ID','Clienta','Premios','Puntos','Fecha','Estado',''],redemptions.map(r=>{
   const items=redemptionItems.filter(i=>i.redemption_id===r.id).map(i=>`${i.qty} × ${rewards.find(x=>x.id===i.reward_id)?.name||'Premio'}`).join(', ');
   return `<tr><td>${esc(r.id.slice(0,8))}</td><td>${esc(uname(r.customer_id))}</td><td>${esc(items)}</td><td>${r.total_points}</td><td>${date(r.created_at)}</td><td>${pill(r.status,r.status==='aprobada'?'green':r.status==='rechazada'?'red':'')}</td><td>${r.status==='solicitada'?`<div class="admin-actions"><button class="btn btn-outline" data-approve="${esc(r.id)}">Aprobar</button><button class="btn btn-outline admin-danger" data-reject="${esc(r.id)}">Rechazar</button></div>`:''}</td></tr>`;
 }));
 $$('[data-approve]').forEach(b=>b.onclick=()=>decide(b.dataset.approve,true));$$('[data-reject]').forEach(b=>b.onclick=()=>decide(b.dataset.reject,false));
}
async function decide(id,approve){if(!requireLive())return;const reason=approve?'Premio entregado':prompt('Motivo para rechazar:');if(reason===null)return;if(!confirm(approve?'¿Confirmas que el premio fue entregado?':'¿Rechazar solicitud y reintegrar puntos?'))return;try{await rpc('bl_decide_redemption',{p_redemption:id,p_approve:approve,p_reason:reason});notify(approve?'Recompensa entregada y descontada del stock.':'Solicitud rechazada y puntos reintegrados.');await loadAll();}catch(e){notify(e.message,'error');}}
function renderTeachers(){
 const tableEl=$('#affiliatesTable');
 if(staff?.role!=='admin'){
  tableEl.innerHTML='<div class="admin-feedback">Solo el administrador principal puede agregar o retirar profesoras afiliadas.</div>';
  $('#affiliateForm').classList.add('hidden');
 }else{
  $('#affiliateForm').classList.remove('hidden');
  const total=affiliatedTeachers.filter(t=>t.active).length;
  $('#affiliateCount').textContent=total+' activa'+(total===1?'':'s');
  const selectedId=$('#affiliateProfile').value;
  const chosen=affiliatedTeachers.find(t=>t.id===$('#affiliateId').value);
  const available=profiles.filter(p=>p.category==='profesora'&&!p.blocked&&!p.archived_at);
  const select=$('#affiliateProfile');
  select.replaceChildren(new Option('Sin cuenta vinculada aún',''));
  available.forEach(p=>{
   const occupied=affiliatedTeachers.some(t=>t.linked_profile_id===p.id&&t.id!==chosen?.id);
   if(!occupied)select.append(new Option(p.full_name+' · '+p.phone,p.id));
  });
  if([...select.options].some(o=>o.value===selectedId))select.value=selectedId;
  tableEl.innerHTML=table(['Profesora','Código','Estado','Cuenta de puntos','Referidos','Acciones'],
   affiliatedTeachers.map(t=>{
    const linked=profiles.find(p=>p.id===t.linked_profile_id);
    const totalRef=affiliateAttributions.filter(x=>x.affiliate_id===t.id).length;
    const waiting=affiliateAttributions.filter(x=>x.affiliate_id===t.id&&!x.awarded_at).length;
    const waitingText=waiting?' · '+waiting+' sin abonar':'';
    return '<tr><td><strong>'+esc(t.display_name)+'</strong></td>'+
     '<td><code>'+esc(t.code)+'</code></td><td>'+pill(t.active?'Activa':'Retirada',t.active?'green':'neutral')+'</td>'+
     '<td>'+esc(linked?.full_name||'No vinculada')+'</td>'+
     '<td>'+totalRef+esc(waitingText)+'</td><td><div class="affiliate-actions">'+
     '<button class="btn btn-outline btn-small" data-affiliate-edit="'+esc(t.id)+'">Editar</button>'+
     (t.active?'<button class="btn btn-outline btn-small admin-danger" data-affiliate-retire="'+esc(t.id)+'">Retirar</button>':
      '<button class="btn btn-outline btn-small" data-affiliate-restore="'+esc(t.id)+'">Reactivar</button>')+
     (t.active?'<button class="btn btn-outline btn-small" data-affiliate-share="'+esc(t.id)+'">Enlace/QR</button>':'')+
     '</div></td></tr>';
   }));
  $$('[data-affiliate-edit]').forEach(b=>b.onclick=()=>selectAffiliate(b.dataset.affiliateEdit));
  $$('[data-affiliate-retire]').forEach(b=>b.onclick=()=>changeAffiliateStatus(b.dataset.affiliateRetire,false));
  $$('[data-affiliate-restore]').forEach(b=>b.onclick=()=>changeAffiliateStatus(b.dataset.affiliateRestore,true));
  $$('[data-affiliate-share]').forEach(b=>b.onclick=()=>{
    const t=affiliatedTeachers.find(x=>x.id===b.dataset.affiliateShare);
    if(t)showTeacherQR({full_name:t.display_name},{code:t.code});
  });
 }
 $('#tiersFields').innerHTML=tiers.map(t=>'<div style="display:inline-block;margin:0 14px 15px 0;max-width:200px"><label>Desde '+fmt(t.min_amount)+'</label><input class="admin-input mini-input" type="number" min="0" max="100" data-tier="'+esc(t.min_amount)+'" value="'+esc(t.points)+'"></div>').join('');
}
function resetAffiliateForm(){
 $('#affiliateForm').reset();
 $('#affiliateId').value='';
 $('#affiliateActive').checked=true;
 $('#affiliateSave').textContent='Agregar profesora afiliada';
 renderTeachers();
}
function selectAffiliate(id){
 const t=affiliatedTeachers.find(x=>x.id===id);
 if(!t)return;
 $('#affiliateId').value=t.id;
 $('#affiliateName').value=t.display_name;
 $('#affiliateActive').checked=t.active;
 renderTeachers();
 $('#affiliateProfile').value=t.linked_profile_id||'';
 $('#affiliateSave').textContent='Guardar cambios';
 $('#affiliateForm').scrollIntoView({behavior:'smooth',block:'start'});
 $('#affiliateName').focus();
}
async function submitAffiliate(event){
 event.preventDefault();
 if(!requireLive()||!checkManager())return;
 const name=$('#affiliateName').value.trim(),id=$('#affiliateId').value||null;
 const linked=$('#affiliateProfile').value||null,active=$('#affiliateActive').checked;
 if(name.length<3)return notify('Escribe el nombre de la profesora afiliada.','error');
 if(!confirm(id?'¿Guardar los cambios de la profesora afiliada?':'¿Agregar esta profesora al directorio de BellaShop?'))return;
 const button=$('#affiliateSave');
 try{
  setLoading(button,true,'Guardando…');
  await rpc('bl_manage_affiliated_teacher',{p_id:id,p_name:name,p_active:active,p_linked_profile:linked});
  notify(id?'Profesora actualizada':'Profesora afiliada agregada. Aparecerá en nuevas solicitudes.');
  $('#affiliateId').value='';$('#affiliateForm').reset();$('#affiliateSave').textContent='Agregar profesora afiliada';
  await loadAll();
 }catch(err){notify('No se pudo guardar: '+err.message,'error');}
 finally{setLoading(button,false);}
}
async function changeAffiliateStatus(id,active){
 if(!requireLive()||!checkManager())return;
 const t=affiliatedTeachers.find(x=>x.id===id);if(!t)return;
 if(!confirm(active?'¿Reactivar a '+t.display_name+' en el listado de solicitudes?':
   '¿Retirar a '+t.display_name+'? Dejará de aparecer para nuevas solicitudes, pero no se borrará su historial.'))return;
 try{
  await rpc('bl_manage_affiliated_teacher',{p_id:id,p_name:t.display_name,p_active:active,p_linked_profile:t.linked_profile_id||null});
  notify(active?'Profesora reactivada':'Profesora retirada del listado público.');
  if($('#affiliateId').value===id)resetAffiliateForm();
  await loadAll();
 }catch(err){notify('No se pudo cambiar el estado: '+err.message,'error');}
}
function showTeacherQR(p,c){
 const link=new URL('./index.html',location.href);link.searchParams.set('ref',c.code);
 const modal=document.createElement('div');modal.className='modal-overlay';
 modal.innerHTML=`<div class="modal-dialog" role="dialog" aria-modal="true" aria-label="QR de profesora"><button type="button" class="modal-close" aria-label="Cerrar">×</button><span class="kicker">RECOMIENDA BELLALOVERS</span><h3>${esc(p.full_name)}</h3><p class="muted">Escanea este QR para inscribirte con el código ${esc(c.code)}.</p><div class="qr-area"></div><p class="form-help">${esc(link.toString())}</p><button type="button" class="btn btn-primary btn-full" id="copyTeacherUrl">Copiar enlace de referido</button><p class="form-help">Para usar el QR con el enlace definitivo, primero publica BellaLovers en su dirección final.</p></div>`;
 document.body.append(modal);modal.querySelector('.modal-close').onclick=()=>modal.remove();modal.onclick=e=>{if(e.target===modal)modal.remove();};
 const area=modal.querySelector('.qr-area');
 if(window.QRCode)new window.QRCode(area,{text:link.toString(),width:210,height:210,colorDark:'#44393d',colorLight:'#ffffff'});
 else area.textContent='QR no disponible sin conexión; el enlace sí se puede copiar.';
 modal.querySelector('#copyTeacherUrl').onclick=async()=>{try{await navigator.clipboard.writeText(link.toString());notify('Enlace copiado');}catch{prompt('Copia el enlace:',link.toString());}};
}
function renderGifts(){
 $('#giftOptionsTable').innerHTML=table(['Producto','Referencia','Stock','Costo',''],giftOptions.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.product_ref)}</td><td>${x.stock}</td><td>${fmt(x.unit_cost)}</td><td><button class="btn btn-outline" data-edit-gift="${esc(x.id)}">Editar</button></td></tr>`));
 $$('[data-edit-gift]').forEach(b=>b.onclick=()=>{const g=giftOptions.find(x=>x.id===b.dataset.editGift);$('#giftId').value=g.id;$('#giftName').value=g.name;$('#giftRef').value=g.product_ref;$('#giftStock').value=g.stock;$('#giftCost').value=g.unit_cost;$('#giftName').focus();});
 $('#giftClaimsTable').innerHTML=table(['Estudiante','Regalo','Fecha'],giftClaims.map(g=>`<tr><td>${esc(uname(g.student_id))}</td><td>${esc(giftOptions.find(x=>x.id===g.gift_id)?.name||'Regalo')}</td><td>${date(g.delivered_at)}</td></tr>`));
}
function renderSettings(){
 const lbl=$('#joinStatusLabel');if(lbl){lbl.textContent=settings.join_requests_open?'Solicitudes abiertas':'Solicitudes pausadas';lbl.className='status '+(settings.join_requests_open?'green':'neutral');}
 for(const key of ['min_purchase','point_value','unlock_points','student_gift_min','cycle_months','grace_days','shop_url'])$('#rule_'+key).value=settings[key]??'';
 for(const key of ['exclude_discounts','student_first_no_points'])$('#rule_'+key).checked=Boolean(settings[key]);
}
function renderAudit(){
 $('#auditTable').innerHTML=table(['Fecha','Acción','Entidad','ID','Detalle'],audit.map(x=>`<tr><td>${date(x.created_at)}</td><td>${esc(x.action)}</td><td>${esc(x.entity)}</td><td>${esc(String(x.entity_id||'').slice(0,20))}</td><td>${esc(JSON.stringify(x.detail||{}).slice(0,150))}</td></tr>`));
}
function renderStaff(){
 const container=$('#staffTable');if(!container)return;
 if(mode==='live'&&staff?.role!=='admin'){
   container.innerHTML='<p class="admin-feedback">Solo el administrador principal puede gestionar empleados.</p>';
   $('#staffForm')?.classList.add('hidden');return;
 }
 $('#staffForm')?.classList.remove('hidden');
 container.innerHTML=table(['Correo','Permiso','Estado','Fecha',''],staffDirectory.map(e=>
   `<tr><td><strong>${esc(e.email)}</strong></td><td>${esc(e.role)}</td><td>${e.active?pill('Activo','green'):pill('Suspendido','red')}</td><td>${date(e.created_at)}</td><td><button class="btn btn-outline" data-edit-staff="${esc(e.user_id)}">Gestionar</button></td></tr>`));
 $$('[data-edit-staff]').forEach(b=>b.onclick=()=>{
   const e=staffDirectory.find(x=>x.user_id===b.dataset.editStaff);if(!e)return;
   $('#staffEmail').value=e.email;$('#staffRole').value=e.role;$('#staffActive').value=String(e.active);
   $('#staffReason').value='';$('#staffEmail').focus();
   if(window.innerWidth<690)$('#staffForm')?.scrollIntoView({behavior:'smooth',block:'center'});
 });
}
async function saveStaff(e){
 e.preventDefault();if(!requireLive()||!checkManager())return;
 const payload={p_email:$('#staffEmail').value.trim().toLowerCase(),p_role:$('#staffRole').value,
   p_active:$('#staffActive').value==='true',p_reason:$('#staffReason').value.trim()};
 if(payload.p_reason.length<8)return notify('Escribe un motivo de al menos 8 caracteres.','error');
 if(!confirm('¿Aplicar los permisos indicados al correo '+payload.p_email+'?'))return;
 const btn=$('#staffForm button[type=submit]');
 try{setLoading(btn,true);await rpc('bl_manage_staff',payload);notify('Acceso actualizado y auditado');e.target.reset();await loadAll();}
 catch(err){notify('No se pudo actualizar: '+err.message,'error');}
 finally{setLoading(btn,false);}
}
function renderJoins(){
 const tableEl=$('#joinRequestsTable'),card=$('#joinApprovalCard');
 if(!tableEl)return;
 if(staff?.role!=='admin'){
  tableEl.innerHTML='<p class="admin-feedback">Solo el administrador puede revisar solicitudes y aprobar nuevas membresías.</p>';
  card.classList.add('hidden');return;
 }
 const pending=joinRequests.filter(x=>x.status==='pendiente').length;
 $('#joinPendingBadge').textContent=pending+' pendiente'+(pending===1?'':'s');
 const filter=$('#joinFilter').value;
 const selected=joinRequests.filter(x=>filter==='todas'||x.status===filter);
 tableEl.innerHTML=table(['Fecha','Solicitante','Celular','Correo','Categoría','Profesora afiliada','Estado','Acción'],selected.map(x=>
  '<tr><td>'+date(x.created_at)+'</td><td><strong>'+esc(x.full_name)+'</strong></td><td>'+esc(x.phone)+'</td>'+
  '<td>'+esc(x.email)+'</td><td>'+esc(TYPE[x.category]||x.category)+'</td><td>'+
  esc(affiliatedTeachers.find(t=>t.id===x.affiliate_teacher_id)?.display_name||'Ninguna')+'</td><td>'+
  pill(x.status,x.status==='aprobada'?'green':x.status==='rechazada'?'red':'neutral')+'</td><td>'+
  (x.status==='pendiente'?'<div class="account-actions"><button class="btn btn-primary btn-small" data-join-approve="'+esc(x.id)+'">Revisar factura</button><button class="btn btn-outline btn-small" data-join-reject="'+esc(x.id)+'">Rechazar</button></div>':
  x.status==='aprobada'?'Factura aprobada':'Revisada')+'</td></tr>'));
 $$('[data-join-approve]').forEach(btn=>btn.onclick=()=>{
   const request=joinRequests.find(x=>x.id===btn.dataset.joinApprove);if(!request)return;
   selectedJoinId=request.id;
   $('#joinRequestId').value=request.id;
   const affiliate=affiliatedTeachers.find(t=>t.id===request.affiliate_teacher_id);
   $('#joinSelectedInfo').textContent=request.full_name+' · '+request.phone+' · '+request.email+
      ' · '+(TYPE[request.category]||request.category)+
      ' · Profesora: '+(affiliate?.display_name||'Ninguna');
   $('#joinApprovalForm').reset();
   $('#joinRequestId').value=request.id;
   card.classList.remove('hidden');card.scrollIntoView({behavior:'smooth',block:'start'});
 });
 $$('[data-join-reject]').forEach(btn=>btn.onclick=()=>rejectJoin(btn.dataset.joinReject));
 if(!joinRequests.some(x=>x.id===selectedJoinId&&x.status==='pendiente'))card.classList.add('hidden');
}
async function rejectJoin(id){
 if(!requireLive()||!checkManager())return;
 const req=joinRequests.find(x=>x.id===id);if(!req)return;
 const reason=prompt('Motivo de rechazo para '+req.full_name+' (mínimo 8 caracteres)');
 if(reason===null)return;
 if(reason.trim().length<8)return notify('Escribe un motivo de 8 caracteres como mínimo.','error');
 if(!confirm('¿Rechazar esta solicitud? No se creará una membresía.'))return;
 try{
  await rpc('bl_reject_join_request',{p_request:id,p_reason:reason.trim()});
  notify('Solicitud rechazada; quedó en el historial.');selectedJoinId=null;await loadAll();
 }catch(err){notify('No se pudo rechazar: '+err.message,'error');}
}
async function approveJoin(e){
 e.preventDefault();if(!requireLive()||!checkManager())return;
 const req=joinRequests.find(x=>x.id===$('#joinRequestId').value&&x.status==='pendiente');
 if(!req)return notify('Selecciona una solicitud pendiente.','error');
 const payload={
  request_id:req.id,invoice:$('#joinInvoice').value.trim(),
  products_total:Number($('#joinProductsTotal').value),
  delivery_fee:Number($('#joinDelivery').value),
  special_discount:$('#joinDiscount').checked,
  channel:$('#joinChannel').value,notes:$('#joinNotes').value.trim()
 };
 if(!payload.invoice||!Number.isSafeInteger(payload.products_total)||payload.products_total<=0)
  return notify('Debes comprobar una factura real con el valor de sus productos.','error');
 if(!confirm('¿Ya comprobaste la factura '+payload.invoice+' en BellaShop? Al aprobar se registrará la compra y se enviará una invitación privada a '+req.email+'.'))return;
 const btn=$('#joinApprovalForm button[type=submit]');
 try{
  setLoading(btn,true,'Aprobando y enviando invitación…');
  const {data,error}=await sb.functions.invoke('bellalovers-aprobar',{body:payload});
  if(error)throw error;
  if(!data?.success)throw new Error(data?.error||'El servidor no pudo confirmar la membresía');
  notify('Membresía aprobada, factura registrada e invitación enviada por correo.');
  selectedJoinId=null;$('#joinApprovalCard').classList.add('hidden');
  $('#joinApprovalForm').reset();await loadAll();
 }catch(err){notify('No se aprobó la solicitud: '+err.message,'error');}
 finally{setLoading(btn,false);}
}

function renderAll(){renderJoins();renderOverview();populateClientSelects();renderCustomers();renderPurchases();renderRewards();renderRedemptions();renderTeachers();renderGifts();renderSettings();renderStaff();renderAudit();}
async function purchaseSubmit(e){
 e.preventDefault();if(!requireLive())return;
 const btn=$('#purchaseForm button[type=submit]');
 const customer=await findPurchaseCustomer();
 if(!customer)return notify('Primero busca un celular que pertenezca a una clienta activa.','error');
 try{
  const amount=Number($('#purchaseAmount').value);
  if(!Number.isSafeInteger(amount)||amount<=0||amount>500000000)throw new Error('Escribe el valor exacto de productos pagados.');
  if(!confirm('¿Confirmas que '+customer.full_name+' realizó esta compra por '+fmt(amount)+' en productos?'))return;
  setLoading(btn,true,'Guardando compra…');
  const result=await rpc('bl_purchase_simple',{
   p_customer:customer.id,p_amount:amount,
   p_invoice:$('#purchaseInvoice').value.trim()||null,
   p_channel:$('#purchaseChannel').value||null,
   p_discount:$('#purchaseDiscount').checked,
   p_notes:$('#purchaseNotes').value.trim()||null
  });
  notify('Compra registrada: '+result.points+' puntos. '+(result.internal_reference?'Referencia interna: '+result.reference:'Factura: '+result.reference));
  $('#purchaseForm').reset();$('#purchaseCustomer').value='';
  $('#purchaseLookupResult').textContent='Compra guardada. Busca otra clienta por celular.';
  await loadAll();
 }catch(err){notify('No se pudo guardar la compra: '+err.message,'error');}
 finally{setLoading(btn,false);}
}
async function rewardSubmit(e){
 e.preventDefault();if(!requireLive()||!checkManager())return;
 const btn=$('#rewardForm button[type=submit]');
 const payload={name:$('#rewardName').value.trim(),product_ref:$('#rewardRef').value.trim(),points_cost:Number($('#rewardPoints').value),
  stock:Number($('#rewardStock').value),unit_cost:Number($('#rewardCost').value),audience:$('#rewardAudience').value,
  image_url:$('#rewardImage').value.trim()||null,active:$('#rewardActive').checked};
 if(payload.image_url&&!/^https:\/\//i.test(payload.image_url))return notify('La fotografía debe usar HTTPS.','error');
 const photo=$('#rewardPhoto').files[0];
 if(photo&&(!['image/jpeg','image/png','image/webp'].includes(photo.type)||photo.size>3145728)){
  return notify('La foto debe ser JPG, PNG o WEBP de máximo 3 MB.','error');
 }
 try{
  setLoading(btn,true,'Guardando premio…');
  if(photo){
   const ext=photo.type==='image/png'?'png':photo.type==='image/webp'?'webp':'jpg';
   const destination='premios/'+crypto.randomUUID()+'.'+ext;
   const {error}=await sb.storage.from('bellalovers-premios').upload(destination,photo,{contentType:photo.type,upsert:false});
   if(error)throw error;
   payload.image_url=sb.storage.from('bellalovers-premios').getPublicUrl(destination).data.publicUrl;
  }
  const id=$('#rewardId').value;
  await run(id?sb.from('bl_rewards').update(payload).eq('id',id):sb.from('bl_rewards').insert(payload));
  notify(id?'Premio actualizado: visible en la vitrina':'Premio guardado para las clientas');
  e.target.reset();$('#rewardId').value='';updateRewardPhotoPreview(null);await loadAll();
 }catch(err){notify('No se pudo guardar: '+err.message,'error');}
 finally{setLoading(btn,false);}
}
async function giftSubmit(e){e.preventDefault();if(!requireLive()||!checkManager())return;const btn=$('#giftForm button[type=submit]');const payload={name:$('#giftName').value.trim(),product_ref:$('#giftRef').value.trim(),stock:+$('#giftStock').value,unit_cost:+$('#giftCost').value,active:true};try{setLoading(btn,true);const id=$('#giftId').value;await run(id?sb.from('bl_gift_options').update(payload).eq('id',id):sb.from('bl_gift_options').insert(payload));notify('Regalo guardado');e.target.reset();$('#giftId').value='';await loadAll();}catch(err){notify(err.message,'error');}finally{setLoading(btn,false);}}
async function giftDeliverySubmit(e){e.preventDefault();if(!requireLive())return;const student=$('#giftStudent').value,gift=$('#giftChoice').value;if(!confirm('¿El regalo ya fue entregado físicamente a la estudiante?'))return;try{await rpc('bl_deliver_welcome',{p_student:student,p_gift:gift});notify('Regalo de bienvenida entregado y stock actualizado');await loadAll();}catch(err){notify(err.message,'error');}}
async function saveSettings(e){e.preventDefault();if(!requireLive()||!checkManager())return;const payload={};for(const key of ['min_purchase','point_value','unlock_points','student_gift_min','cycle_months','grace_days'])payload[key]=Number($('#rule_'+key).value);
 for(const key of ['exclude_discounts','student_first_no_points'])payload[key]=$('#rule_'+key).checked;
 payload.shop_url=$('#rule_shop_url').value.trim();
 if(!/^https:\/\//.test(payload.shop_url))return notify('El catálogo debe usar una URL HTTPS','error');
 if(!confirm('¿Confirmas el cambio de las reglas futuras de BellaLovers?'))return;
 try{await run(sb.from('bl_settings').update(payload).eq('id',1));notify('Configuración actualizada');await loadAll();}catch(err){notify(err.message,'error');}}
async function saveTiers(e){e.preventDefault();if(!requireLive()||!checkManager())return;try{const data=$$('[data-tier]').map(x=>({min_amount:Number(x.dataset.tier),points:Number(x.value)}));if(data.some(x=>!Number.isInteger(x.points)||x.points<0))throw new Error('Puntos inválidos');await run(sb.from('bl_referral_tiers').upsert(data,{onConflict:'min_amount'}));notify('Tabla de referidos actualizada');await loadAll();}catch(err){notify(err.message,'error');}}
function downloadCsv(headers,rows,name){const values=[headers,...rows].map(row=>row.map(x=>{
  let v=String(x??'').replace(/^[\s\uFEFF\u200B]*[=+\-@]/,m=>"'"+m);
  return '"'+v.replace(/"/g,'""')+'"';
 }).join(';')).join('\r\n');const blob=new Blob(['\ufeff'+values],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

async function sendRecoveryEmail(){
 const email=$('#adminEmail').value.trim().toLowerCase();
 if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
   notify('Escribe el correo de tu acceso en el campo superior.','error');return;
 }
 const btn=$('#sendRecoveryEmail');
 try{
   setLoading(btn,true,'Enviando…');
   sb=sb||await db('admin');
   const url=new URL('./admin.html',location.href).toString();
   const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:url});
   if(error)throw error;
   notify('Si el correo está registrado, recibirás instrucciones. Revisa tu bandeja y el correo no deseado.');
 }catch(err){notify('No se pudo enviar la recuperación. Revisa la configuración de correos de Supabase: '+err.message,'error');}
 finally{setLoading(btn,false);}
}
async function completePasswordRecovery(e){
 e.preventDefault();const pw=$('#newAdminPassword').value,confirmPw=$('#confirmAdminPassword').value;
 if(pw.length<12 || pw!==confirmPw)return notify('La contraseña debe tener al menos 12 caracteres y coincidir en ambos campos.','error');
 const btn=$('#passwordRecoveryPanel button[type=submit]');
 try {
   setLoading(btn,true);
   sb=sb||await db('admin');
   const {error}=await sb.auth.updateUser({password:pw});
   if(error)throw error;
   await sb.auth.signOut();
   recoveryMode=false;
   $('#passwordRecoveryPanel').classList.add('hidden');
   $('#adminLoginForm').classList.remove('hidden');
   $('#sendRecoveryEmail').classList.remove('hidden');
   e.target.reset();history.replaceState({},'',new URL('./admin.html',location.href).pathname);
   notify('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
 }catch(err){notify('No se pudo cambiar la contraseña: '+err.message,'error');}
 finally{setLoading(btn,false);}
}
function showRecoveryForm(){
 recoveryMode=true;
 $('#adminApp').classList.add('hidden');
 $('#adminLogin').classList.remove('hidden');
 $('#adminLoginForm').classList.add('hidden');
 $('#sendRecoveryEmail').classList.add('hidden');
 $('#passwordRecoveryPanel').classList.remove('hidden');
}


function updateJoinChecklist(){
 $('#joinEnable').disabled=!$('#joinPolicyVerified').checked;
}
async function saveJoinStatus(open){
 if(!requireLive()||!checkManager())return;
 if(open&&!$('#joinPolicyVerified').checked)return notify('Confirma primero la política de datos definitiva.','error');
 if(!confirm(open?'¿BellaShop aprobó su política definitiva? ¿Abrir solicitudes de ingreso?':'¿Pausar solicitudes de ingreso?'))return;
 try{
  await run(sb.from('bl_settings').update({join_requests_open:open,signup_open:false}).eq('id',1));
  notify(open?'Solicitudes abiertas (sin SMS)':'Solicitudes pausadas');
  await loadAll();
 }catch(err){notify(err.message,'error');}
}

function setup(){
 $$('#adminNav button').forEach(b=>b.onclick=()=>showPanel(b.dataset.section));$$('[data-go]').forEach(b=>b.onclick=()=>showPanel(b.dataset.go));
 $('#adminLoginForm').addEventListener('submit',login);
 $('#joinFilter').addEventListener('change',renderJoins);
 $('#joinApprovalForm').addEventListener('submit',approveJoin);
 $('#joinCancel').addEventListener('click',()=>{$('#joinApprovalCard').classList.add('hidden');selectedJoinId=null;});
 $('#reloadJoins').addEventListener('click',loadAll);

 $('#joinPolicyVerified').addEventListener('change',updateJoinChecklist);
 $('#joinStatusForm').addEventListener('submit',e=>{e.preventDefault();saveJoinStatus(true);});
 $('#joinDisable').addEventListener('click',()=>saveJoinStatus(false));
 $('#rewardPhoto').addEventListener('change',()=>{
  if(photoPreviewUrl)URL.revokeObjectURL(photoPreviewUrl);
  const file=$('#rewardPhoto').files[0];photoPreviewUrl=file?URL.createObjectURL(file):null;
  updateRewardPhotoPreview(photoPreviewUrl,file?.name||'');
 });

 $('#sendRecoveryEmail').addEventListener('click',sendRecoveryEmail);$('#passwordRecoveryPanel').addEventListener('submit',completePasswordRecovery);
 $('#adminLogout').onclick=logout;$('#adminLogoutMobile').onclick=logout;$('#refreshAdmin').onclick=()=>loadAll();
 $('#searchCustomers').addEventListener('input',renderCustomers);$('#customerStatusFilter').addEventListener('change',renderCustomers);$('#staffForm').addEventListener('submit',saveStaff);
 $('#purchaseForm').addEventListener('submit',purchaseSubmit);
 $('#purchaseFind').addEventListener('click',findPurchaseCustomer);
 $('#purchasePhone').addEventListener('input',()=>{
   $('#purchaseCustomer').value='';
   $('#purchaseLookupResult').textContent='Pulsa Buscar para confirmar la clienta.';
 });$('#rewardForm').addEventListener('submit',rewardSubmit);$('#giftForm').addEventListener('submit',giftSubmit);$('#giftDeliveryForm').addEventListener('submit',giftDeliverySubmit);$('#settingsForm').addEventListener('submit',saveSettings);$('#tierForm').addEventListener('submit',saveTiers);
 $('#affiliateForm').addEventListener('submit',submitAffiliate);
 $('#affiliateReset').addEventListener('click',resetAffiliateForm);
 $('#resetRewardForm').onclick=()=>{$('#rewardForm').reset();$('#rewardId').value='';updateRewardPhotoPreview(null);};$('#resetGiftForm').onclick=()=>{$('#giftForm').reset();$('#giftId').value='';};
 $('#expirePoints').onclick=async()=>{if(!requireLive()||!checkManager())return;try{const n=await rpc('bl_expire_due');notify('Vencimientos procesados: '+n+' puntos');await loadAll();}catch(err){notify(err.message,'error');}};
 $('#csvCustomers').onclick=()=>{if(!requireLive())return;downloadCsv(['Nombre','Celular','Categoría','Puntos','Fecha'],profiles.map(p=>[p.full_name,p.phone,p.category,ubalance(p.id),p.created_at]),'bellalovers-clientas.csv');};
 $('#csvPurchases').onclick=()=>{if(!requireLive())return;downloadCsv(['Factura','Canal','Cliente','Total productos','Costo transporte','Descuento especial','Puntos','Estado','Fecha'],purchases.map(p=>[p.invoice,CHANNEL_LABEL[p.channel]||'Tienda',uname(p.customer_id),p.products_total,p.delivery_fee,p.special_discount,p.points_awarded,p.status,p.created_at]),'bellalovers-compras.csv');};
 $('#csvAudit').onclick=()=>{if(!requireLive()||!checkManager())return;downloadCsv(['Fecha','Acción','Entidad','Identificador','Responsable','Detalle'],audit.map(x=>[x.created_at,x.action,x.entity,x.entity_id,x.actor,JSON.stringify(x.detail||{})]),'bellalovers-auditoria.csv');};
 if(!HAS_BACKEND){$('#adminLoginForm').classList.add('hidden');return;}
 db('admin').then(async s=>{
   sb=s;
   sb.auth.onAuthStateChange((event)=>{
     if(event==='PASSWORD_RECOVERY')showRecoveryForm();
   });
   const {data:{session}}=await sb.auth.getSession();
   if(session&&!recoveryMode)await initAdmin();
 }).catch(err=>notify(err.message,'error'));
}
async function logout(){if(mode==='live'&&sb)await sb.auth.signOut();mode='locked';staff=null;$('#adminApp').classList.add('hidden');$('#adminLogin').classList.remove('hidden');$('#adminPassword').value='';}
setup();
