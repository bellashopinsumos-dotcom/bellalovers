import {CONFIG,HAS_BACKEND} from './config.js';
import {db,$,$$,fmt,date,esc,TYPE,DEFAULT_RULES,notify,setLoading,safeUrl} from './core.js';
let sb=null, session=null, customer=null, rules={...DEFAULT_RULES}, ledger=[], cycles=[], purchases=[], requests=[], rewards=[], teacherCode=null;
let cart={}; let sendingPhone=''; let giftClaims=[];
let enrollmentReady=false, publicPrizeList=[],activePrizeFilter='todas';
async function run(q, label='Ocurrió un error') {
  const { data,error }=await q;
  if(error) throw new Error(error.message || label);
  return data;
}
function show(which) {
  ['#loginPanel','#signupPanel','#account'].forEach(s=>$(s).classList.add('hidden'));
  if(which==='login') $('#loginPanel').classList.remove('hidden');
  if(which==='signup') $('#signupPanel').classList.remove('hidden');
  if(which==='account') {$('#account').classList.remove('hidden');$('#account').scrollIntoView({behavior:'smooth',block:'start'});}
}
function phoneNumber(raw) {
  const digits=String(raw).replace(/\D/g,'');
  if(!/^3\d{9}$/.test(digits)) throw new Error('Escribe un celular colombiano válido de 10 dígitos.');
  return `+57${digits}`;
}
async function sendOtp(event){
  event.preventDefault();const btn=$('#phoneForm button[type=submit]');
  try{if(!enrollmentReady)throw new Error('BellaShop aún no ha activado las inscripciones.');setLoading(btn,true);sendingPhone=phoneNumber($('#phone').value);await run(sb.auth.signInWithOtp({phone:sendingPhone,options:{shouldCreateUser:true}}));$('#phoneForm').classList.add('hidden');$('#otpForm').classList.remove('hidden');notify('Te enviamos el código por SMS.');}
  catch(err){notify(err.message,'error');}finally{setLoading(btn,false);}
}
async function verifyOtp(event){
  event.preventDefault();const btn=$('#otpForm button[type=submit]');
  try{setLoading(btn,true);const token=$('#otp').value.trim();await run(sb.auth.verifyOtp({phone:sendingPhone,token,type:'sms'}));await loadUser();notify('Celular verificado correctamente.');}
  catch(err){notify(err.message,'error');}finally{setLoading(btn,false);}
}
async function saveProfile(event){
  event.preventDefault();const btn=$('#signupForm button[type=submit]');
  try{if(!enrollmentReady)throw new Error('BellaShop aún no ha activado las inscripciones.');setLoading(btn,true);await run(sb.rpc('bl_register',{
    p_name:$('#fullName').value.trim(),p_category:$('#customerType').value,p_teacher_code:$('#teacherCode').value.trim()||null,
    p_marketing:$('#marketing').checked,p_accept:$('#privacy').checked,
  }));await loadUser();notify('¡Bienvenida a BellaLovers! Tu cuenta está lista.');}
  catch(err){notify(err.message,'error');}finally{setLoading(btn,false);}
}
async function loadUser(){
  session=(await sb.auth.getUser()).data.user;
  if(!session){show('login');return;}
  const profile=await run(sb.from('bl_profiles').select('*').eq('id',session.id).maybeSingle());
  if(!profile){
    if(session.email&&!session.phone){await sb.auth.signOut();notify('Para ingresar como clienta debes verificar tu celular.','error');show('login');return;}
    show('signup');return;
  }
  customer=profile;await refreshAccount();show('account');
}
async function refreshAccount(){
  try { await run(sb.rpc('bl_sync_my_points')); }catch(err){console.warn('No se pudo verificar vencimientos:',err.message);}
  const results=await Promise.all([
    run(sb.from('bl_settings').select('*').eq('id',1).single()),
    run(sb.from('bl_cycles').select('*').eq('customer_id',customer.id).order('expires_at')),
    run(sb.from('bl_points').select('*').eq('customer_id',customer.id).order('created_at',{ascending:false}).limit(200)),
    run(sb.from('bl_purchases').select('*').eq('customer_id',customer.id).order('created_at',{ascending:false}).limit(100)),
    run(sb.from('bl_redemptions').select('*').eq('customer_id',customer.id).order('created_at',{ascending:false}).limit(100)),
    run(sb.from('bl_rewards').select('*').eq('active',true).order('points_cost')),
    run(sb.from('bl_teacher_codes').select('code').eq('teacher_id',customer.id).eq('enabled',true).maybeSingle()),
    run(sb.from('bl_gift_claims').select('*').eq('student_id',customer.id)),
  ]);
  [rules,cycles,ledger,purchases,requests,rewards]=results;teacherCode=results[6]?.code||null;giftClaims=results[7]||[];
  cart={};renderAccount();
}
function availablePoints() {
  const today=Date.now();
  const validIds=new Set(cycles.filter(c=>!c.closed_at && new Date(c.grace_until).getTime()>today).map(c=>c.id));
  return Math.max(0,ledger.filter(p=>validIds.has(p.cycle_id)).reduce((s,p)=>s+Number(p.delta),0));
}
function renderAccount(){
  const points=availablePoints(),unlock=rules.unlock_points||50,missing=Math.max(0,unlock-points);
  $('#accountGreeting').textContent=`¡Hola, ${customer.full_name.split(' ')[0]}! ♡`;

  $('#memberName').textContent=customer.full_name;
  $('#memberCategory').textContent=TYPE[customer.category]||customer.category;
  $('#memberCode').textContent='BL-'+String(customer.id).slice(0,8).toUpperCase();
  const pending=requests.filter(r=>r.status==='solicitada').length;
  const expiring=cycles.filter(c=>!c.closed_at && Date.parse(c.expires_at)>Date.now()
       && Date.parse(c.expires_at)-Date.now()<=30*86400000);
  const notices=[];
  if(customer.blocked)notices.push('Tu cuenta está suspendida. Consulta con BellaShop para revisar el estado.');
  if(pending)notices.push('Tienes '+pending+' solicitud(es) de premio en revisión.');
  if(expiring.length)notices.push('Algunos puntos están próximos a vencer. Revisa las fechas en tu historial.');
  if(!notices.length)notices.push('Tu carné digital identifica tu participación en BellaLovers. Para reclamar un premio debes pasar por la validación de BellaShop.');
  $('#accountNotices').innerHTML='<span class="kicker">AVISOS DE MI CUENTA</span>'+notices.map(n=>'<p>'+esc(n)+'</p>').join('');

  $('#accountSub').textContent='Este es tu espacio BellaLovers.';
  $('#balance').textContent=points;
  $('#progressBar').style.width=`${Math.min(100,Math.max(0,points/unlock*100))}%`;
  $('#pointsTip').textContent=missing>0 ? `¡Te faltan ${missing} puntos para desbloquear tus recompensas!` : '¡Ya puedes seleccionar recompensas disponibles!';
  $('#myType').textContent=TYPE[customer.category]||customer.category;
  const today=Date.now(); const activeCycle=cycles.filter(c=>!c.closed_at && new Date(c.grace_until).getTime()>today).sort((a,b)=>new Date(a.expires_at)-new Date(b.expires_at))[0];
  $('#myExpires').textContent=date(activeCycle?.expires_at);
  $('#myStatus').textContent=customer.blocked?'Cuenta suspendida':points>=unlock?'Recompensas disponibles':'Acumulando';
  $('#teacherCodeRow').hidden=!(customer.category==='profesora');
  $('#myTeacherCode').textContent=teacherCode || 'Pendiente de validación';
  const refpts=ledger.filter(x=>x.kind==='referido').reduce((s,x)=>s+x.delta,0);
  $('#myRefPointsRow').hidden=customer.category!=='profesora'; $('#myRefPoints').textContent=String(refpts)+' puntos';
  const welcome=$('#welcomeBanner'); welcome.classList.toggle('hidden',customer.category!=='estudiante');
  if(customer.category==='estudiante') {
    const eligible=purchases.some(p=>p.status==='confirmada'&&p.welcome_eligible);
    const claimed=giftClaims.length>0;
    welcome.textContent=claimed?'♡ Ya recibiste tu regalo de bienvenida.':eligible?'♡ ¡Tienes un regalo de bienvenida pendiente! Pregunta por él en BellaShop.':'♡ Tu primera compra desde $150.000 puede darte un regalo de bienvenida.';
  }
  $('#rewardHint').textContent=points>=unlock?'Puedes solicitar tus premios. Se reservarán hasta revisión de BellaShop.':`Necesitas ${unlock} puntos para solicitar recompensas.`;
  $('#logout').textContent='Cerrar sesión';
  $('#storeLink').href=safeUrl(rules.shop_url||CONFIG.shopUrl)||CONFIG.shopUrl;
  renderRewards();renderLedger();renderPurchases();renderRequests();
}
function imageCard(r){const url=r.image_url&&safeUrl(r.image_url);return url ? `<img src="${esc(url)}" alt="${esc(r.name)}" loading="lazy" onerror="this.style.display='none'">` : '♡';}
function renderRewards(){
  const total=availablePoints(), unlock=rules.unlock_points||50;
  const filtered=rewards.filter(r=>r.active && (r.audience==='todas'||r.audience===customer.category));
  $('#rewardsGrid').innerHTML=filtered.length? filtered.map(r=>{
    const max=Math.max(0,r.stock-r.reserved);const qty=cart[r.id]||0;
    return `<article class="reward-card"><div class="reward-image">${imageCard(r)}</div><div class="reward-info"><h4>${esc(r.name)}</h4><p>Ref. ${esc(r.product_ref)} · ${max>0?`${max} disponibles`:'Agotado'}</p><div class="reward-foot"><span class="points-cost">${r.points_cost} puntos</span><div class="qty-controls"><button type="button" data-minus="${esc(r.id)}" ${qty<=0?'disabled':''} aria-label="Restar">−</button><span>${qty}</span><button type="button" data-plus="${esc(r.id)}" ${qty>=max||total<unlock?'disabled':''} aria-label="Agregar">+</button></div></div></div></article>`;
  }).join('') : '<div class="empty">Actualmente no hay recompensas publicadas.</div>';
  for(const btn of $$('[data-plus]')) btn.addEventListener('click',()=>{const r=rewards.find(x=>x.id===btn.dataset.plus);const max=r.stock-r.reserved;cart[r.id]=Math.min(max,(cart[r.id]||0)+1);renderRewards();});
  for(const btn of $$('[data-minus]')) btn.addEventListener('click',()=>{cart[btn.dataset.minus]=Math.max(0,(cart[btn.dataset.minus]||0)-1);renderRewards();});
  const pts=Object.entries(cart).reduce((s,[id,qty])=>s+(rewards.find(r=>r.id===id)?.points_cost||0)*qty,0);
  $('#cartTotal').textContent=`${pts} punto${pts===1?'':'s'} seleccionados`;
  $('#cartNote').textContent=pts>total?'Seleccionaste más puntos de los que tienes':`Saldo después de solicitar: ${Math.max(0,total-pts)} puntos`;
  $('#submitRedeem').disabled=!pts||pts>total||total<unlock||customer.blocked;
}
function renderLedger(){
  const items=ledger;
  $('#pointsTable').innerHTML=items.length?items.map(x=>`<div class="data-row"><div><strong>${esc(({compra:'Compra confirmada',referido:'Referido verificado',redencion:'Recompensa solicitada',reintegro:'Puntos reintegrados',reverso:'Compra anulada',ajuste:'Ajuste administrativo',vencimiento:'Puntos vencidos'})[x.kind]||x.kind)}</strong><small>${date(x.created_at)} · ${esc(x.detail||'')}</small></div><strong class="${x.delta>=0?'positive':'negative'} nowrap">${x.delta>0?'+':''}${x.delta} pts</strong></div>`).join(''):'<div class="empty">Todavía no tienes movimientos. Tus compras confirmadas aparecerán aquí.</div>';
}
function renderPurchases(){
  $('#purchaseList').innerHTML=purchases.length?purchases.map(p=>`<div class="data-row"><div><strong>Factura ${esc(p.invoice)}</strong><small>${date(p.created_at)} · ${p.status==='confirmada'?'Confirmada':'Anulada'}${p.special_discount?' · Con descuento especial':''}</small></div><div class="right"><strong>${fmt(p.products_total)}</strong><small>+${p.points_awarded} puntos</small></div></div>`).join(''):'<div class="empty">Aún no tienes compras registradas.</div>';
}
function renderRequests(){
  $('#requestsList').innerHTML=requests.length?requests.map(r=>`<div class="data-row"><div><strong>Solicitud ${esc(r.id.slice(0,8).toUpperCase())}</strong><small>${date(r.created_at)} · ${r.total_points} puntos</small></div>${r.status==='aprobada'?'<span class="status green">Aprobada</span>':r.status==='rechazada'?'<span class="status red">Rechazada</span>':'<span class="status">En revisión</span>'}</div>`).join(''):'<div class="empty">Todavía no has solicitado recompensas.</div>';
}
async function submitRedemption(){
  const selected=Object.entries(cart).filter(([,qty])=>qty>0).map(([reward_id,qty])=>({reward_id,qty}));
  if(!selected.length) return;
  if(!confirm('¿Confirmas que deseas reservar estos premios usando tus puntos?')) return;
  const btn=$('#submitRedeem');try {setLoading(btn,true);await run(sb.rpc('bl_redeem',{p_items:selected}));notify('¡Solicitud enviada! BellaShop revisará tu recompensa.');await refreshAccount();}
  catch(err){notify(err.message,'error');}finally{setLoading(btn,false);}
}
async function logOut(){
  if(sb) await sb.auth.signOut();customer=null;$('#otpForm').classList.add('hidden');$('#phoneForm').classList.remove('hidden');$('#otp').value='';show('login');location.hash='#acceso';
}

function renderPublicPrizes(){
 const target=$('#publicRewards');if(!target)return;
 const shown=publicPrizeList.filter(p=>activePrizeFilter==='todas'||p.audience==='todas'||p.audience===activePrizeFilter);
 if(!shown.length){
  target.innerHTML='<div class="public-prize-empty">Por ahora no hay premios disponibles en esta categoría. BellaShop publicará las novedades aquí.</div>';
  return;
 }
 const label={todas:'Para todas',estudiante:'Estudiantes',manicurista:'Manicuristas',profesora:'Profesoras'};
 target.innerHTML=shown.map(p=>{
  const img=p.image_url&&/^https:\/\//i.test(p.image_url)?'<img loading="lazy" src="'+esc(p.image_url)+'" alt="'+esc(p.name)+'">':'<span aria-hidden="true">♡</span>';
  return '<article class="public-prize-card"><div class="public-prize-photo">'+img+'</div><div class="public-prize-info"><span class="public-prize-badge">'+esc(label[p.audience]||'Para todas')+'</span><h3>'+esc(p.name)+'</h3><p>Ref. '+esc(p.product_ref)+'</p><div class="public-prize-foot"><strong>'+Number(p.points_cost)+' puntos</strong><span>'+Number(p.available)+' disponibles</span></div></div></article>';
 }).join('');
}
async function loadPublicPrizes(){
 const data=await run(sb.rpc('bl_public_rewards'));
 publicPrizeList=Array.isArray(data)?data:[];
 renderPublicPrizes();
}
async function loadPublicStatus(){
 const data=await run(sb.rpc('bl_public_status'));
 enrollmentReady=Array.isArray(data)&&data[0]?.signup_open===true;
 $('#phoneForm').classList.toggle('hidden',!enrollmentReady);
 $('#enrollmentStatus').classList.toggle('hidden',enrollmentReady);
 if(!enrollmentReady)$('#enrollmentStatus').querySelector('p').textContent='Las nuevas cuentas se activarán cuando esté disponible la verificación segura de celular.';
}

function setup(){
  $('#phoneForm').addEventListener('submit',sendOtp);$('#otpForm').addEventListener('submit',verifyOtp);$('#signupForm').addEventListener('submit',saveProfile);
  $('#changePhone').addEventListener('click',()=>{$('#otpForm').classList.add('hidden');$('#phoneForm').classList.remove('hidden');});
  $('#customerType').addEventListener('change',()=>$('#teacherField').classList.toggle('hidden',$('#customerType').value!=='estudiante'));
  $('#logout').addEventListener('click',logOut);$('#submitRedeem').addEventListener('click',submitRedemption);
  $$('.account-tabs button').forEach(btn=>btn.addEventListener('click',()=>{ $$('.account-tabs button').forEach(x=>x.classList.toggle('active',x===btn));$$('.account-tab').forEach(tab=>tab.classList.toggle('hidden',tab.id!==`tab-${btn.dataset.tab}`));}));
  $('[data-public-filter]').forEach(button=>button.addEventListener('click',()=>{
   activePrizeFilter=button.dataset.publicFilter;
   $('[data-public-filter]').forEach(x=>x.classList.toggle('active',x===button));
   renderPublicPrizes();
  }));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&sb)loadPublicPrizes().catch(()=>{});});
  const ref=new URLSearchParams(location.search).get('ref');if(ref) $('#teacherCode').value=ref.slice(0,30);
  $('#phoneForm').classList.add('hidden');
  $('#enrollmentStatus').classList.remove('hidden');
  if(!HAS_BACKEND)return;
  db().then(async x=>{
   sb=x;
   try{await loadPublicPrizes();}catch(err){console.warn('Premios no disponibles:',err.message);}
   try{await loadPublicStatus();}catch(err){console.warn('Inscripciones no disponibles:',err.message);}
   const {data}=await sb.auth.getSession();if(data.session)await loadUser();
  }).catch(err=>notify('No fue posible conectar con BellaLovers: '+err.message,'error'));
}
setup();
