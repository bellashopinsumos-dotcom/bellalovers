import {CONFIG,HAS_BACKEND} from './config.js';
import {db,$,$$,fmt,date,esc,TYPE,DEFAULT_RULES,notify,setLoading,safeUrl} from './core.js?v=estudiantes10020261127';
let sb=null, session=null, customer=null, rules={...DEFAULT_RULES}, ledger=[], cycles=[], purchases=[], requests=[], rewards=[], teacherCode=null;
let teacherSummary=null;
let cart={}; let giftClaims=[]; let serverBalance=null; let rewardSort='points';
let requestsOpen=false;
const PAGE=document.body.dataset.page||"home";
const params=new URLSearchParams(location.search);
function accessUrl(screen="signin"){const u=new URL("./acceso.html",location.href);if(screen==="register")u.searchParams.set("modo","registro");if(params.get("ref"))u.searchParams.set("ref",params.get("ref"));return u.href;}


function applyPublicRules(){
 const min=Number.isFinite(Number(rules.min_purchase))?Math.max(0,Number(rules.min_purchase)):50000;
 const unit=Math.max(1,Number(rules.point_value)||10000);
 const threshold=Math.max(1,Number(rules.unlock_points)||50);
 const welcome=Number.isFinite(Number(rules.student_gift_min))?Math.max(0,Number(rules.student_gift_min)):100000;
 const months=Math.max(1,Number(rules.cycle_months)||12);
 const grace=Number.isFinite(Number(rules.grace_days))?Math.max(0,Number(rules.grace_days)):0;
 const firstExcluded=rules.student_first_no_points!==false;
 const discountsExcluded=rules.exclude_discounts!==false;
 const base=Math.floor(min/unit);
 const sample=min+unit;
 const set=(key,value)=>$$('[data-live-rule="'+key+'"]').forEach(element=>{element.textContent=value;});
 set('base-eq',fmt(min)+' = '+base+' puntos');
 set('point-extra','+'+fmt(unit)+' = +1 punto');
 set('unlock',threshold+' puntos');
 set('spotlight-points',String(threshold));
 set('student-benefit',(firstExcluded?'Tu primera compra no suma puntos. ':'')+
  'Una primera compra desde '+fmt(welcome)+' puede darte un regalo físico de bienvenida. '+
  (firstExcluded?'Desde tu segunda compra válida comienzas a sumar puntos.':'Tus compras válidas suman puntos según las reglas del club.'));
 set('regular-benefit','En compras desde '+fmt(min)+' recibes '+base+' puntos. '+
  'Por cada '+fmt(unit)+' completos en tu compra se calcula un punto. Ejemplo: '+fmt(sample)+' = '+Math.floor(sample/unit)+' puntos.');
 set('step-buy','Una compra válida desde '+fmt(min)+' genera '+base+' puntos. Por cada '+fmt(unit)+' completos de la compra se calcula 1 punto. También cuentan las ventas por WhatsApp.');
 set('step-reward','Al alcanzar '+threshold+' puntos puedes solicitar regalos disponibles, sujetos a existencias y confirmación de BellaShop.');
 set('rule-points','1. Acumulación: compras desde '+fmt(min)+' en productos; 1 punto por cada '+fmt(unit)+' completo.');
 set('rule-exceptions','3. Excepciones: el transporte no suma; '+
  (discountsExcluded?'tampoco las compras con descuento especial. ':'')+
  'Las compras anuladas o devueltas no acumulan puntos.');
 set('rule-students','4. Estudiantes: '+(firstExcluded?'la primera compra no genera puntos; ':'')+
  'la primera compra desde '+fmt(welcome)+' puede incluir regalo de bienvenida.');
 set('rule-rewards','5. Premios: puedes solicitarlos desde '+threshold+' puntos, sujetos a disponibilidad y confirmación de BellaShop.');
 set('rule-duration','6. Vigencia: ciclo de '+months+' meses'+
  (grace?', con '+grace+' días adicionales para redimir según las condiciones del club.':'.'));
 const shop=safeUrl(rules.shop_url||CONFIG.shopUrl);
 if(shop)$('#storeLink').href=shop;
}
async function loadPublicRules(){
 try {
  const {data,error}=await sb.functions.invoke('bellalovers-consulta',{body:{action:'public_rules'}});
  if(error||!data?.success||!data?.rules)throw new Error('Reglas no disponibles');
  rules={...rules,...data.rules};
  applyPublicRules();
 }catch(err){console.warn('No se pudo actualizar la información del club:',err.message);}
}

function configureHomeNavigation() {
 // Las anclas del menú no deben quedarse grabadas para el siguiente refresco.
 document.addEventListener('click', event => {
  const link=event.target.closest?.('a[data-open-auth],a[href^="#"]');
  if(link?.dataset.openAuth){
   event.preventDefault();
   if(customer&&link.dataset.openAuth==='signin'){show('account');return;}
   openAuthModal(link.dataset.openAuth);
   return;
  }
  if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const destination=link.getAttribute('href');
  if (!destination || destination==='#') return;
  const section=document.getElementById(destination.slice(1));
  if (!section) return;
  event.preventDefault();
  history.replaceState(history.state,'',location.pathname+location.search);
  if (destination==='#inicio') window.scrollTo({top:0,behavior:'smooth'});
  else section.scrollIntoView({behavior:'smooth',block:'start'});
 });
 // Safari y otros navegadores recuerdan la sección incluso sin interacción.
 const navigation=performance.getEntriesByType('navigation')[0];
 const reloaded=navigation?.type==='reload' || (performance.navigation && performance.navigation.type===1);
 if (!reloaded) return;
 if (location.hash) history.replaceState(history.state,'',location.pathname+location.search);
 const reset=()=>{
  const root=document.documentElement,previous=root.style.scrollBehavior;
  root.style.scrollBehavior='auto';
  window.scrollTo(0,0);
  requestAnimationFrame(()=>{root.style.scrollBehavior=previous;});
 };
 reset();
 window.addEventListener('pageshow',()=>{reset();setTimeout(reset,40);},{once:true});
}

async function run(q, label='Ocurrió un error') {
  const { data,error }=await q;
  if(error) throw new Error(error.message || label);
  return data;
}
let authModalTrigger=null;
let guestMode=false,guestIdentity=null;
const GUEST_SESSION_KEY='bellaLoversGuestLookup';
function closeAuthModal(){
 if(PAGE==='access'){location.assign('./index.html');return;}
 const modal=$('#authModal');
 if(!modal||modal.classList.contains('hidden'))return;
 modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');
 document.body.classList.remove('auth-modal-open');
 authModalTrigger?.focus?.();authModalTrigger=null;
}
function openAuthModal(screen='signin'){
 location.assign(accessUrl(screen));
}
function show(which){
 const account=$('#account'),nav=$('#navCuenta');
 if(which==='account'){
  if(PAGE!=='account'){location.assign('./cuenta.html');return;}
  $('#accountLoading').classList.add('hidden');
  account.classList.remove('hidden');
  $('#navRegister')?.classList.add('hidden');
  if(nav){nav.textContent='Mi cuenta ♡';nav.href='./cuenta.html';delete nav.dataset.openAuth;}
  account.scrollIntoView({behavior:'smooth',block:'start'});
 }else{
  if(PAGE==='account'){location.replace(accessUrl());return;}
  account.classList.add('hidden');$('#navRegister')?.classList.remove('hidden');
  if(nav){nav.textContent='Iniciar sesión ♡';nav.href=accessUrl();nav.dataset.openAuth='signin';}
 }
}
function setAuthScreen(screen){
 const registering=screen==='register';
 $('#memberLoginView').classList.toggle('hidden',registering);
 $('#registerView').classList.toggle('hidden',!registering);
 $$('[data-auth-screen]').forEach(btn=>{
  const active=btn.dataset.authScreen===(registering?'register':'signin');
  btn.classList.toggle('active',active);
  if(btn.hasAttribute('aria-pressed'))btn.setAttribute('aria-pressed',String(active));
 });
}
function handleAuthKeydown(event){
 if(PAGE==='access')return;
 const modal=$('#authModal');
 if(modal.classList.contains('hidden'))return;
 if(event.key==='Escape'){event.preventDefault();closeAuthModal();return;}
 if(event.key!=='Tab')return;
 const list=$$('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]',modal)
 .filter(el=>el.getClientRects().length&&el.tabIndex>=0);
 if(!list.length)return;
 const first=list[0],last=list[list.length-1];
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
}

function normalPhone(raw) {
 const digits=String(raw??'').replace(/[^0-9]/g,'');
 if(!/^3[0-9]{9}$/.test(digits))throw new Error('Escribe un celular colombiano válido de diez dígitos.');
 return '+57'+digits;
}
async function sendJoinRequest(event) {
 event.preventDefault();if($('#joinWebsite').value.trim())return;
 const btn=$('#joinForm button[type=submit]');
 try{
  if(!requestsOpen)throw new Error('Las solicitudes todavía no están abiertas por BellaShop.');
  const payload={p_name:$('#joinName').value.trim(),p_phone:normalPhone($('#joinPhone').value),
   p_email:$('#joinEmail').value.trim().toLowerCase(),p_category:$('#joinCategory').value,
   p_teacher_code:$('#joinTeacherCode').value.trim()||null,
   p_marketing:$('#joinMarketing').checked,p_accept:$('#joinPrivacy').checked};
  setLoading(btn,true,'Enviando solicitud…');
  await run(sb.rpc('bl_submit_join_request',payload));
  $('#joinForm').reset();$('#joinForm').classList.add('hidden');
  $('#joinSent').classList.remove('hidden');
  notify('Solicitud recibida. Activa tu membresía con una compra confirmada desde $50.000.');
 }catch(err){notify(err.message,'error');}finally{setLoading(btn,false);}
}
async function edgeErrorMessage(error,data,fallback='No pudimos completar la solicitud.'){
 if(data?.error)return String(data.error);
 if(error?.context?.json){
  try{
   const payload=await error.context.clone().json();
   if(payload?.error)return String(payload.error);
  }catch{}
 }
 return fallback;
}
function normalizeIdentifier(value){
 const raw=String(value||'').trim().toLowerCase();
 if(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(raw))return raw;
 const digits=raw.replace(/\D/g,'');
 const local=digits.startsWith('57')&&digits.length===12?digits.slice(2):digits;
 if(/^3\d{9}$/.test(local))return '+57'+local;
 throw new Error('Escribe un celular colombiano o correo válido.');
}
async function fetchGuestAccount(identifier,fullName,{open=false}={}){
 const {data,error}=await sb.functions.invoke('bellalovers-consulta',{
  body:{action:'view',identifier,full_name:fullName}
 });
 if(error||!data?.success||!data?.profile){
  throw new Error(await edgeErrorMessage(error,data,'No pudimos consultar tu cuenta. Comprueba tu conexión e intenta nuevamente.'));
 }
 guestMode=true;
 guestIdentity={identifier,fullName};
 customer=data.profile;
 rules={...DEFAULT_RULES,...rules,...data.settings};
 cycles=data.cycles||[];
 ledger=data.ledger||[];
 purchases=data.purchases||[];
 requests=data.requests||[];
 rewards=data.rewards||[];
 teacherCode=data.teacher_code||null;teacherSummary=data.teacher_summary||null;
 giftClaims=data.gift_claimed?[{confirmed:true}]:[];
 serverBalance=Number.isFinite(Number(data.balance))?Math.max(0,Number(data.balance)):null;
 cart={};
 renderAccount();
 if(open){
  sessionStorage.setItem(GUEST_SESSION_KEY,JSON.stringify({
   identifier,fullName,expires_at:Date.now()+8*60*60*1000
  }));
  show('account');
 }
}
async function sendMemberAccess(event){
 event.preventDefault();
 const info=$('#memberLoginFeedback');
 const btn=$('#memberLoginForm button[type=submit]');
 try{
  const identifier=normalizeIdentifier($('#memberIdentifier').value);
  const fullName=$('#memberFullName').value.trim();
  if(fullName.length<3||!fullName.includes(' '))
   throw new Error('Escribe tu nombre y apellido como te registraste.');
  if(!sb)throw new Error('No se pudo conectar con BellaLovers.');
  setLoading(btn,true,'Entrando a tu cuenta…');
  info.classList.add('hidden');
  await fetchGuestAccount(identifier,fullName,{open:true});
  notify('¡Bienvenida a tu espacio BellaLovers! ♡');
 }catch(err){
  info.textContent=err.message||'Revisa tus datos e intenta nuevamente.';
  info.classList.remove('hidden');
 }finally{setLoading(btn,false);}
}

async function loadUser(){
  session=(await sb.auth.getUser()).data.user;
  if(!session){show('login');return;}
  const profile=await run(sb.from('bl_profiles').select('*').eq('id',session.id).maybeSingle());
  if(!profile){
    await sb.auth.signOut();notify('Esta membresía aún no está aprobada por BellaShop.','error');show('login');return;
  }
  customer=profile;await refreshAccount();show('account');
}
async function refreshAccount(){
  if(guestMode&&guestIdentity){
    await fetchGuestAccount(guestIdentity.identifier,guestIdentity.fullName);
    return;
  }
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
 if(guestMode&&serverBalance!==null)return serverBalance;
  const today=Date.now();
  const validIds=new Set(cycles.filter(c=>!c.closed_at && new Date(c.grace_until).getTime()>today).map(c=>c.id));
  return Math.max(0,ledger.filter(p=>validIds.has(p.cycle_id)).reduce((s,p)=>s+Number(p.delta),0));
}
function renderAccount(){
  const points=availablePoints(),unlock=rules.unlock_points||50,missing=Math.max(0,unlock-points);
  $('#accountGreeting').textContent=`¡Hola, ${customer.full_name.split(' ')[0]}! ♡`;

  $('#memberName').textContent=customer.full_name;
  $('#memberCategory').textContent=TYPE[customer.category]||customer.category;
  $('#myJoinedDate').textContent=date(customer.created_at);
  const memberCode='BL-'+String(customer.id).replace(/^public-/,'').slice(0,8).toUpperCase();
  $('#memberCode').textContent=memberCode;
  $('#memberQrCode').textContent=memberCode;
  $('#memberQrPanel').classList.add('hidden');$('#showMemberQr').setAttribute('aria-expanded','false');
  $('#memberQrImage').replaceChildren();
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
  const progress=Math.round(Math.min(100,Math.max(0,points/unlock*100)));
  $('#progressBar').style.width=progress+'%';
  $('#progressCounter').textContent=Math.min(unlock,points)+' / '+unlock+' puntos';
  $('#progressPercent').textContent=progress+'%';
  $('#pointsProgress').setAttribute('aria-valuemax',String(unlock));
  $('#pointsProgress').setAttribute('aria-valuenow',String(Math.min(unlock,Math.max(0,points))));
  $('#pointsCelebration').classList.toggle('hidden',missing>0);
  $('#pointsTip').textContent=missing>0
   ?'Te faltan '+missing+' punto'+(missing===1?'':'s')+' para desbloquear tus premios ♡'
   :rewards.some(r=>r.active&&(r.audience==='todas'||r.audience===customer.category))
    ?'¡Meta cumplida! Explora los premios publicados y solicita el que prefieras.'
    :'¡Meta cumplida! Tus puntos estarán listos cuando BellaShop publique sus primeros premios.';
  $('#myType').textContent=TYPE[customer.category]||customer.category;
  const today=Date.now(); const activeCycle=cycles.filter(c=>!c.closed_at && new Date(c.grace_until).getTime()>today).sort((a,b)=>new Date(a.expires_at)-new Date(b.expires_at))[0];
  $('#myExpires').textContent=date(activeCycle?.expires_at);
  $('#myStatus').textContent=customer.blocked?'Cuenta suspendida':points>=unlock?'Recompensas disponibles':'Acumulando';
  $('#teacherCodeRow').hidden=!(customer.category==='profesora');
  $('#myTeacherCode').textContent=teacherCode || 'Pendiente de validación';
  const refpts=teacherSummary?.referral_points??ledger.filter(x=>x.kind==='referido').reduce((s,x)=>s+x.delta,0);
  $('#myRefPointsRow').hidden=customer.category!=='profesora'||!teacherSummary?.referral_points_enabled; $('#myRefPoints').textContent=String(refpts)+' puntos';
  const welcome=$('#welcomeBanner'); welcome.classList.toggle('hidden',customer.category!=='estudiante');
  if(customer.category==='estudiante') {
    const eligible=purchases.some(p=>p.status==='confirmada'&&p.welcome_eligible);
    const claimed=giftClaims.length>0;
    welcome.textContent=claimed?'♡ Ya recibiste tu regalo de bienvenida.':eligible?'♡ ¡Tienes un regalo de bienvenida pendiente! Pregunta por él en BellaShop.':'♡ Tu primera compra desde '+fmt(Number(rules.student_gift_min??100000))+' puede darte un regalo de bienvenida.';
  }
  const matchingRewards=rewards.filter(r=>r.active&&(r.audience==='todas'||r.audience===customer.category));
  $('#rewardHint').textContent=!matchingRewards.length?'Los productos de recompensa aparecerán aquí cuando BellaShop los publique.':
    points>=unlock?'¡Meta alcanzada! Ya puedes solicitar las recompensas que puedas pagar con tus puntos.':
    'Acumula '+Math.max(0,unlock-points)+' puntos más para desbloquear los canjes.';
  $('#logout').textContent='Cerrar sesión';
  $('#storeLink').href=safeUrl(rules.shop_url||CONFIG.shopUrl)||CONFIG.shopUrl;
  renderTeacherDashboard();renderRewards();renderLedger();renderPurchases();renderRequests();
}
function renderTeacherDashboard(){
 const panel=$('#teacherDashboard');if(!panel)return;
 const teacher=customer?.category==='profesora';panel.classList.toggle('hidden',!teacher);if(!teacher)return;
 const d=teacherSummary||{},history=Array.isArray(d.history)?d.history:[];
 $('#teacherAffiliationStatus').textContent=d.active?'Afiliación activa a BellaShop':'Tu afiliación no está activa o todavía no está vinculada. Contacta a BellaShop.';
 $('#teacherEarned').textContent=d.referral_points_enabled?String(d.referral_points||0):'Próximamente';$('#teacherPending').textContent=String(d.pending||0);$('#teacherConfirmed').textContent=String(history.filter(x=>x.status==='confirmada').length);
 $('#teacherSharePanel').classList.toggle('hidden',!d.active||!d.code);
 $('#teacherTiers').textContent='Beneficios adicionales por recomendaciones: próximamente.';
 $('#teacherHistory').innerHTML=history.length?history.map(x=>'<div class="data-row"><div><strong>'+esc(x.kind)+'</strong><small>'+esc(date(x.date))+' · '+esc(x.status==='confirmada'?'Confirmada':'Anulada')+'</small></div><strong>'+ (x.points>0?'+'+esc(x.points)+' pts':x.status==='confirmada'?'Registrada':'Anulada')+'</strong></div>').join(''):'<div class="empty">Aún no hay compras referidas confirmadas.</div>';
}
function imageCard(r){const url=r.image_url&&safeUrl(r.image_url);return url ? `<img src="${esc(url)}" alt="${esc(r.name)}" loading="lazy" onerror="this.style.display='none'">` : '♡';}
function renderRewards(){
 const total=availablePoints(),unlock=rules.unlock_points||50;
 const unlocked=total>=unlock&&!customer.blocked;
 const filtered=rewards.filter(r=>r.active&&(r.audience==='todas'||r.audience===customer.category));
 const published=filtered.length;
 $('#rewardPublishedCount').textContent=published+' premio'+(published===1?'':'s')+' publicado'+(published===1?'':'s');
 $('#rewardSortWrap').classList.toggle('hidden',!published);
 const sorted=[...filtered].sort((a,b)=>rewardSort==='max'
  ?b.points_cost-a.points_cost
  :rewardSort==='available'
  ?Math.max(0,b.stock-b.reserved)-Math.max(0,a.stock-a.reserved)||a.points_cost-b.points_cost
  :a.points_cost-b.points_cost);
 const lock=$('#rewardsLock'),bar=$('#redeemBar');
 if(!filtered.length){
  lock.classList.remove('hidden');
  lock.innerHTML='<span class="reward-lock-icon" aria-hidden="true">✧</span><strong>Próximamente, sorpresas para nuestras BellaLovers ♡</strong><p>Todavía estamos escogiendo los premios con mucho cariño. Puedes seguir acumulando tus puntos y, cuando BellaShop publique sus primeras recompensas, aparecerán aquí con su foto, puntos necesarios y disponibilidad.</p><span class="reward-coming-chip">Tus puntos siguen acumulándose</span>';
  $('#rewardsGrid').innerHTML='';
  bar.classList.add('hidden');cart={};
  return;
 }
 lock.classList.remove('hidden');
 lock.innerHTML=unlocked?
  '<span class="reward-lock-icon" aria-hidden="true">✧</span><strong>¡Ya desbloqueaste tus recompensas!</strong><p>Escoge tus premios según tus puntos y existencias. BellaShop confirmará tu solicitud.</p>':
  '<span class="reward-lock-icon" aria-hidden="true">🔒</span><strong>Premios bloqueados hasta '+unlock+' puntos</strong><p>Actualmente tienes '+total+' puntos. Te faltan '+Math.max(0,unlock-total)+' para empezar a canjear. Sigue acumulando con tus compras válidas.</p>';
 bar.classList.toggle('hidden',!unlocked);
 if(!unlocked)cart={};
 $('#rewardsGrid').innerHTML=sorted.map(r=>{
  const max=Math.max(0,r.stock-r.reserved);
  const qty=cart[r.id]||0;
  const used=Object.entries(cart).reduce((n,[id,q])=>n+(rewards.find(x=>x.id===id)?.points_cost||0)*q,0);
  const canAdd=unlocked&&max>qty&&qty<5&&used+r.points_cost<=total;
  const badge=!unlocked?'🔒 Bloqueada':max===0?'Agotada':r.points_cost>total?'Necesitas más puntos':'Lista para canjear';
  return '<article class="reward-card '+(!unlocked?'reward-card-locked':'')+'">'+
   '<div class="reward-image">'+imageCard(r)+'</div>'+
   '<div class="reward-info"><span class="reward-lock-label">'+esc(badge)+'</span>'+
   '<h4>'+esc(r.name)+'</h4><p>Ref. '+esc(r.product_ref)+' · '+(max>0?max+' disponibles':'Agotado')+'</p>'+
   '<div class="reward-foot"><span class="points-cost">'+r.points_cost+' puntos</span>'+
   '<div class="qty-controls"><button type="button" data-minus="'+esc(r.id)+'" '+(!unlocked||qty<=0?'disabled':'')+' aria-label="Restar">−</button>'+
   '<span>'+qty+'</span><button type="button" data-plus="'+esc(r.id)+'" '+(!canAdd?'disabled':'')+' aria-label="Agregar">+</button></div></div></div></article>';
 }).join('');
 for(const btn of $$('[data-plus]'))btn.addEventListener('click',()=>{
  const r=rewards.find(x=>x.id===btn.dataset.plus);if(!r||!unlocked)return;
  const max=Math.max(0,r.stock-r.reserved),selected=Object.entries(cart).reduce((n,[id,q])=>n+(rewards.find(x=>x.id===id)?.points_cost||0)*q,0);
  if(selected+r.points_cost>total||(cart[r.id]||0)>=Math.min(max,5))return;
  cart[r.id]=Math.min(max,5,(cart[r.id]||0)+1);renderRewards();
 });
 for(const btn of $$('[data-minus]'))btn.addEventListener('click',()=>{
  cart[btn.dataset.minus]=Math.max(0,(cart[btn.dataset.minus]||0)-1);renderRewards();
 });
 const pts=Object.entries(cart).reduce((n,[id,qty])=>n+(rewards.find(r=>r.id===id)?.points_cost||0)*qty,0);
 $('#cartTotal').textContent=pts+' punto'+(pts===1?'':'s')+' seleccionados';
 $('#cartNote').textContent=guestMode?'Tus puntos solo se descontarán cuando BellaShop confirme tu canje por WhatsApp.':(pts>total?'Seleccionaste más puntos de los que tienes':'Saldo después de solicitar: '+Math.max(0,total-pts)+' puntos');
 $('#submitRedeem').disabled=!pts||pts>total||!unlocked;
}
function renderLedger(){
  const items=ledger;
  $('#pointsTable').innerHTML=items.length?items.map(x=>`<div class="data-row"><div><strong>${esc(({compra:'Compra confirmada',referido:'Referido verificado',redencion:'Recompensa confirmada',reintegro:'Puntos reintegrados',reverso:'Compra anulada',ajuste:'Ajuste administrativo',vencimiento:'Puntos vencidos'})[x.kind]||x.kind)}</strong><small>${date(x.created_at)} · ${esc(x.detail||'')}</small></div><strong class="${x.delta>=0?'positive':'negative'} nowrap">${x.delta>0?'+':''}${x.delta} pts</strong></div>`).join(''):'<div class="empty">Todavía no tienes movimientos. Tus compras confirmadas aparecerán aquí.</div>';
}
function renderPurchases(){
 const channels={tienda:'Compra en tienda',whatsapp:'Compra por WhatsApp',domicilio:'Pedido con domicilio',web:'Compra por la página web',otro:'Compra registrada'};
 $('#purchaseList').innerHTML=purchases.length?purchases.map(p=>
  '<div class="data-row"><div><strong>'+(p.invoice?'Factura '+esc(p.invoice):'Compra registrada')+'</strong>'+
  '<small>'+date(p.created_at)+' · '+esc(channels[p.channel]||'Compra en tienda')+
  ' · '+(p.status==='confirmada'?'Confirmada':'Anulada')+
  (p.special_discount?' · Descuento especial':'')+'</small></div>'+
  '<div class="right"><strong>'+fmt(p.products_total)+'</strong>'+
  '<small>'+(p.points_awarded>0?('+'+p.points_awarded+' puntos'):'0 puntos')+'</small></div></div>'
 ).join(''):'<div class="empty">Aún no tienes compras registradas. Aquí aparecerán las facturas que confirme BellaShop, incluidas las compras por WhatsApp.</div>';
}
function renderRequests(){
  $('#requestsList').innerHTML=requests.length?requests.map(r=>`<div class="data-row"><div><strong>Solicitud ${esc(r.id.slice(0,8).toUpperCase())}</strong><small>${date(r.created_at)} · ${r.total_points} puntos</small></div>${r.status==='aprobada'?'<span class="status green">Aprobada</span>':r.status==='rechazada'?'<span class="status red">Rechazada</span>':'<span class="status">En revisión</span>'}</div>`).join(''):'<div class="empty">Todavía no has solicitado recompensas.</div>';
}
async function submitRedemption(){
  const selected=Object.entries(cart).filter(([,qty])=>qty>0).map(([reward_id,qty])=>({reward_id,qty}));
  if(!selected.length) return;
  if(guestMode){
   if(!confirm('¿Enviar esta solicitud de premio? BellaShop te escribirá por WhatsApp para confirmar. No se descontarán puntos todavía.'))return;
   const btn=$('#submitRedeem');
   try{
    setLoading(btn,true,'Enviando solicitud…');
    const {data,error}=await sb.functions.invoke('bellalovers-consulta',{
     body:{action:'request_reward',identifier:guestIdentity.identifier,
      full_name:guestIdentity.fullName,items:selected}
    });
    if(error||!data?.success)throw new Error(await edgeErrorMessage(error,data,'No se pudo registrar tu solicitud. Intenta nuevamente.'));
    notify('¡Solicitud enviada! BellaShop te contactará por WhatsApp para confirmarla.');
    await refreshAccount();
    $$('.account-tabs button').find(x=>x.dataset.tab==='requests')?.click();
   }catch(err){notify(err.message,'error');}
   finally{setLoading(btn,false);}
   return;
  }
  notify('Para solicitar premios, cierra sesión y vuelve a entrar con tu nombre y celular o correo.','error');
}
async function logOut(){
 sessionStorage.removeItem(GUEST_SESSION_KEY);
 if(sb&&!guestMode)await sb.auth.signOut();
 guestMode=false;guestIdentity=null;customer=null;serverBalance=null;
 ledger=[];purchases=[];requests=[];rewards=[];cycles=[];cart={};
 location.replace('./index.html');
}
function showMemberQr(){
 if(!customer)return;
 const panel=$('#memberQrPanel');
 const opening=panel.classList.contains('hidden');
 panel.classList.toggle('hidden',!opening);
 $('#showMemberQr').setAttribute('aria-expanded',String(opening));
 $('#showMemberQr').textContent=opening?'Ocultar mi QR':'Ver mi QR';
 if(!opening)return;
 const code=$('#memberCode').textContent;
 if(window.QRCode){
  const target=$('#memberQrImage');
  target.replaceChildren();
  new window.QRCode(target,{text:code,width:150,height:150,colorDark:'#6e445b',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});
 }else{
  $('#memberQrImage').textContent='Código: '+code;
 }
}
async function copyMemberCode(){
 if(!customer)return;
 const code=$('#memberCode').textContent;
 try{
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(code);
  else{
   const field=document.createElement('textarea');
   field.value=code;document.body.append(field);field.select();
   const copied=document.execCommand('copy');field.remove();
   if(!copied)throw Error('No fue posible copiar');
  }
  notify('¡Código de carné copiado! ♡');
 }catch{notify('Tu código es '+code+'. Puedes mostrarlo en caja.');}
}
async function loadAffiliatedTeachers(){
 const select=$('#joinTeacherCode');
 if(!select||!sb)return;
 const {data,error}=await sb.rpc('bl_list_affiliated_teachers');
 if(error)throw error;
 const requested=new URLSearchParams(location.search).get('ref')?.trim().toUpperCase()||'';
 const previous=select.value||requested;
 select.replaceChildren(new Option('Ninguna / no me recomendó una profesora',''));
 for(const t of data||[]){
  if(!t?.code||!t?.name)continue;
  const option=new Option(String(t.name),String(t.code));
  select.append(option);
 }
 if([...select.options].some(o=>o.value===previous))select.value=previous;
 $('#joinTeacherField').classList.toggle('hidden',!(data||[]).length);
 $('#joinTeacherHelp').textContent=(data||[]).length?
  'Elige una profesora afiliada activa. Si no te recomendó ninguna, deja «Ninguna».':
  'BellaShop todavía no ha publicado profesoras afiliadas. Puedes continuar sin seleccionar ninguna.';
}

async function loadJoinStatus(){
 requestsOpen=(await run(sb.rpc('bl_join_requests_status')))===true;
 $('#joinForm').classList.toggle('hidden',!requestsOpen);
 $('#joinClosed').classList.toggle('hidden',requestsOpen);
 if(!requestsOpen)$('#joinClosed').innerHTML='<strong>Solicitudes temporalmente cerradas</strong><p>BellaShop abrirá las inscripciones aquí mismo.</p>';
}

function setup(){
 $('#teacherRefresh')?.addEventListener('click',async()=>{try{if(customer)await refreshAccount();notify('Información actualizada.');}catch(err){notify(err.message,'error');}});
 $('#teacherShare')?.addEventListener('click',async()=>{if(!teacherSummary?.active||!teacherSummary.code)return;const u=new URL('./acceso.html',location.href);u.searchParams.set('modo','registro');u.searchParams.set('ref',teacherSummary.code);try{if(navigator.share)await navigator.share({title:'BellaLovers',url:u.href});else if(navigator.clipboard){await navigator.clipboard.writeText(u.href);notify('Enlace copiado ♡');}else prompt('Copia tu enlace:',u.href);}catch(err){if(err.name!=='AbortError')prompt('Copia tu enlace:',u.href);}});
 $('#shareClub')?.addEventListener('click',async()=>{const url=new URL('./index.html',location.href).href;try{if(navigator.share){await navigator.share({title:'BellaLovers',text:'Descubre el club de beneficios de BellaShop ♡',url});}else if(navigator.clipboard){await navigator.clipboard.writeText(url);notify('Enlace copiado ♡');}else prompt('Comparte este enlace:',url);}catch(err){if(err.name!=='AbortError')prompt('Comparte este enlace:',url);}});
 $('#joinForm').addEventListener('submit',sendJoinRequest);
 $('#memberLoginForm').addEventListener('submit',sendMemberAccess);
 $('#closeAuthModal').addEventListener('click',closeAuthModal);
 $('#authModal').addEventListener('click',event=>{if(PAGE!=='access'&&event.target===$('#authModal'))closeAuthModal();});
 document.addEventListener('keydown',handleAuthKeydown);
 $$('[data-auth-screen]').forEach(button=>button.addEventListener('click',()=>{
  setAuthScreen(button.dataset.authScreen);
  if(PAGE==='access'){const url=new URL(location.href);if(button.dataset.authScreen==='register')url.searchParams.set('modo','registro');else url.searchParams.delete('modo');history.replaceState(history.state,'',url);}
  $('#memberLoginFeedback').classList.add('hidden');
 }));
 $('#refreshMemberRewards').addEventListener('click',()=>{if(customer)loadPublicRules().then(()=>refreshAccount()).then(()=>notify('Tu cuenta está actualizada.')).catch(e=>notify('No fue posible actualizar: '+e.message,'error'));});
 $('#showMemberQr').addEventListener('click',showMemberQr);
 $('#copyMemberCode').addEventListener('click',copyMemberCode);
 $('#rewardSort').addEventListener('change',event=>{rewardSort=event.target.value;renderRewards();});

 $('#logout').addEventListener('click',logOut);
 $('#submitRedeem').addEventListener('click',submitRedemption);
 $$('.account-tabs button').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.account-tabs button').forEach(x=>x.classList.toggle('active',x===btn));
  $$('.account-tab').forEach(tab=>tab.classList.toggle('hidden',tab.id!==('tab-'+btn.dataset.tab)));
 }));

 $('#joinForm').classList.add('hidden');$('#joinClosed').classList.remove('hidden');
 if(PAGE==='access')$('#joinClosed').innerHTML='<strong>Consultando inscripciones…</strong><p>Un momento mientras comprobamos la disponibilidad.</p>';
 setAuthScreen(params.get('modo')==='registro'?'register':'signin');
 if(PAGE==='home'&&params.has('ref')){location.replace(accessUrl('register'));return;}
 if(PAGE==='home'&&sessionStorage.getItem(GUEST_SESSION_KEY)){const nav=$('#navCuenta');nav.href='./cuenta.html';nav.textContent='Mi cuenta ♡';delete nav.dataset.openAuth;}
 if(!HAS_BACKEND)return;
 db().then(async x=>{
  sb=x;
  await loadPublicRules();
  if(PAGE==='home')return;
  if(PAGE==='access'){
  try{await loadAffiliatedTeachers();}catch(err){console.warn('Profesoras afiliadas no disponibles:',err.message);$('#joinTeacherHelp').textContent='No pudimos cargar las profesoras. Puedes continuar sin seleccionar ninguna.';}
  try{await loadJoinStatus();}catch(err){console.warn('Solicitudes no disponibles:',err.message);$('#joinClosed').innerHTML='<strong>No pudimos comprobar las inscripciones.</strong><p>Recarga la página o comunícate con BellaShop por WhatsApp.</p>';}
  }
  const stored=sessionStorage.getItem(GUEST_SESSION_KEY);
  if(stored&&PAGE==='account'){
   try{
    const guest=JSON.parse(stored);
    if(Date.now()<guest.expires_at&&guest.identifier&&guest.fullName){
     await fetchGuestAccount(guest.identifier,guest.fullName);show('account');
     return;
    }
   }catch(err){console.warn('No se pudo restaurar la consulta:',err.message);}
   sessionStorage.removeItem(GUEST_SESSION_KEY);
  }
  if(PAGE==='account'){location.replace(accessUrl());return;}
  const {data:{session}}=await sb.auth.getSession();
  if(session){
   // Cerrar cualquier sesión antigua para mantener un único flujo de consulta.
   await sb.auth.signOut({scope:'local'});
   show('login');
  }
 }).catch(err=>{if(PAGE==='account')$('#accountLoading').textContent='No pudimos cargar tu cuenta. Regresa al inicio e inténtalo de nuevo.';notify('No fue posible conectar con BellaLovers: '+err.message,'error');});
}

if(PAGE==='account')window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
configureHomeNavigation();
setup();
