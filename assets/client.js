import {CONFIG,HAS_BACKEND} from './config.js';
import {db,$,$$,fmt,date,esc,TYPE,DEFAULT_RULES,notify,setLoading,safeUrl} from './core.js?v=solicitudes20261120final';
let sb=null, session=null, customer=null, rules={...DEFAULT_RULES}, ledger=[], cycles=[], purchases=[], requests=[], rewards=[], teacherCode=null;
let cart={}; let giftClaims=[];
let requestsOpen=false;

function configureHomeNavigation() {
 // Las anclas del menú no deben quedarse grabadas para el siguiente refresco.
 document.addEventListener('click', event => {
  const link=event.target.closest?.('a[href^="#"]');
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
function closeAuthModal(){
 const modal=$('#authModal');
 if(!modal||modal.classList.contains('hidden'))return;
 modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');
 document.body.classList.remove('auth-modal-open');
 $('#memberAccessKey').value='';
 authModalTrigger?.focus?.();authModalTrigger=null;
}
function openAuthModal(screen='signin'){
 if(customer&&screen==='signin'){show('account');return;}
 authModalTrigger=document.activeElement;setAuthScreen(screen);
 $('#memberVerification').classList.add('hidden');
 $('#memberLoginFeedback').classList.add('hidden');
 const modal=$('#authModal');
 modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');
 document.body.classList.add('auth-modal-open');
 requestAnimationFrame(()=>$('#closeAuthModal').focus());
}
function show(which){
 const account=$('#account'),nav=$('#navCuenta');
 if(which==='account'){
  closeAuthModal();
  account.classList.remove('hidden');
  $('#navRegister')?.classList.add('hidden');
  if(nav){nav.textContent='Mi cuenta ♡';nav.href='#account';delete nav.dataset.openAuth;}
  account.scrollIntoView({behavior:'smooth',block:'start'});
 }else{
  account.classList.add('hidden');$('#navRegister')?.classList.remove('hidden');
  if(nav){nav.textContent='Iniciar sesión ♡';nav.href='#inicio';nav.dataset.openAuth='signin';}
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
   p_email:'',p_category:$('#joinCategory').value,
   p_teacher_code:$('#joinTeacherCode').value.trim()||null,
   p_marketing:$('#joinMarketing').checked,p_accept:$('#joinPrivacy').checked};
  setLoading(btn,true,'Enviando solicitud…');
  await run(sb.rpc('bl_submit_join_request',payload));
  $('#joinForm').reset();$('#joinForm').classList.add('hidden');
  $('#joinSent').classList.remove('hidden');
  notify('Solicitud recibida. BellaShop la revisará cuando hagas tu primera compra.');
 }catch(err){notify(err.message,'error');}finally{setLoading(btn,false);}
}
function normalizeIdentifier(value){
 const raw=String(value||'').trim().toLowerCase();
 if(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(raw))return raw;
 const digits=raw.replace(/\D/g,'');
 const local=digits.startsWith('57')&&digits.length===12?digits.slice(2):digits;
 if(/^3\d{9}$/.test(local))return '+57'+local;
 throw new Error('Escribe un celular colombiano o correo válido.');
}
function normalizeName(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .replace(/\s+/g,' ').trim().toLocaleLowerCase('es-CO');
}
async function sendMemberAccess(event){
 event.preventDefault();
 const info=$('#memberLoginFeedback'),verify=$('#memberVerification');
 try{
  const identifier=normalizeIdentifier($('#memberIdentifier').value);
  const name=$('#memberFullName').value.trim();
  if(name.length<3||!name.includes(' '))throw new Error('Escribe nombre y apellido como te registraste.');
  if(!sb)throw new Error('No se pudo conectar con BellaLovers.');
  const {data:{user}}=await sb.auth.getUser();
  if(user){
   const {data:profile}=await sb.from('bl_profiles').select('id,full_name,phone,blocked,archived_at,deleted_at').eq('id',user.id).maybeSingle();
   if(profile&&!profile.blocked&&!profile.archived_at&&!profile.deleted_at&&
      normalizeName(name)===normalizeName(profile.full_name)&&
      (identifier===profile.phone||identifier===String(user.email||'').toLowerCase())){
    await loadUser();return;
   }
  }
  verify.classList.remove('hidden');
  info.textContent='Para proteger tus compras y puntos, BellaShop debe confirmar que eres la titular cuando ingresas desde un dispositivo nuevo.';
  info.classList.remove('hidden');
  $('#memberAccessKey').focus();
 }catch(err){
  info.textContent=err.message||'Revisa tus datos.';
  info.classList.remove('hidden');verify.classList.add('hidden');
 }
}
async function verifyMemberAccess(event){
 event.preventDefault();
 const info=$('#memberLoginFeedback'),button=$('#memberKeyForm button[type=submit]');
 try{
  if(!sb)throw new Error('No se pudo conectar con BellaLovers.');
  const identifier=normalizeIdentifier($('#memberIdentifier').value);
  const name=$('#memberFullName').value.trim();
  if(!name.includes(' '))throw new Error('Escribe nombre y apellido completos.');
  const key=$('#memberAccessKey').value.trim().toUpperCase();
  if(!/^[A-HJ-NP-Z2-9]{12}$/.test(key))throw new Error('Revisa la clave de acceso.');
  setLoading(button,true,'Verificando acceso…');
  const {data,error}=await sb.functions.invoke('bellalovers-ingresar',{
   body:{identifier,full_name:name,access_key:key}
  });
  if(error||!data?.success||!data.access_token||!data.refresh_token)
   throw new Error(data?.error||'No se pudo confirmar tu identidad. Consulta con BellaShop.');
  const {error:sessionError}=await sb.auth.setSession({
   access_token:data.access_token,refresh_token:data.refresh_token
  });
  if(sessionError)throw sessionError;
  $('#memberAccessKey').value='';
  await loadUser();
  notify('¡Bienvenida a tu cuenta BellaLovers!');
 }catch(err){
  info.textContent=err.message||'No fue posible ingresar.';
  info.classList.remove('hidden');
 }finally{setLoading(button,false);}
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
  $('#myJoinedDate').textContent=date(customer.created_at);
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
  const matchingRewards=rewards.filter(r=>r.active&&(r.audience==='todas'||r.audience===customer.category));
  $('#rewardHint').textContent=!matchingRewards.length?'Los productos de recompensa aparecerán aquí cuando BellaShop los publique.':
    points>=unlock?'¡Meta alcanzada! Ya puedes solicitar las recompensas que puedas pagar con tus puntos.':
    'Acumula '+Math.max(0,unlock-points)+' puntos más para desbloquear los canjes.';
  $('#logout').textContent='Cerrar sesión';
  $('#storeLink').href=safeUrl(rules.shop_url||CONFIG.shopUrl)||CONFIG.shopUrl;
  renderRewards();renderLedger();renderPurchases();renderRequests();
}
function imageCard(r){const url=r.image_url&&safeUrl(r.image_url);return url ? `<img src="${esc(url)}" alt="${esc(r.name)}" loading="lazy" onerror="this.style.display='none'">` : '♡';}
function renderRewards(){
 const total=availablePoints(),unlock=rules.unlock_points||50;
 const unlocked=total>=unlock&&!customer.blocked;
 const filtered=rewards.filter(r=>r.active&&(r.audience==='todas'||r.audience===customer.category));
 const lock=$('#rewardsLock'),bar=$('#redeemBar');
 if(!filtered.length){
  lock.classList.remove('hidden');
  lock.innerHTML='<span class="reward-lock-icon" aria-hidden="true">♡</span><strong>Próximamente tendremos recompensas para ti</strong><p>BellaShop está preparando sus premios. Cuando los publique en el administrador, aparecerán en esta sección.</p>';
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
 $('#rewardsGrid').innerHTML=filtered.map(r=>{
  const max=Math.max(0,r.stock-r.reserved);
  const qty=cart[r.id]||0;
  const used=Object.entries(cart).reduce((n,[id,q])=>n+(rewards.find(x=>x.id===id)?.points_cost||0)*q,0);
  const canAdd=unlocked&&max>qty&&used+r.points_cost<=total;
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
  if(selected+r.points_cost>total||cart[r.id]>=max)return;
  cart[r.id]=Math.min(max,(cart[r.id]||0)+1);renderRewards();
 });
 for(const btn of $$('[data-minus]'))btn.addEventListener('click',()=>{
  cart[btn.dataset.minus]=Math.max(0,(cart[btn.dataset.minus]||0)-1);renderRewards();
 });
 const pts=Object.entries(cart).reduce((n,[id,qty])=>n+(rewards.find(r=>r.id===id)?.points_cost||0)*qty,0);
 $('#cartTotal').textContent=pts+' punto'+(pts===1?'':'s')+' seleccionados';
 $('#cartNote').textContent=pts>total?'Seleccionaste más puntos de los que tienes':'Saldo después de solicitar: '+Math.max(0,total-pts)+' puntos';
 $('#submitRedeem').disabled=!pts||pts>total||!unlocked;
}
function renderLedger(){
  const items=ledger;
  $('#pointsTable').innerHTML=items.length?items.map(x=>`<div class="data-row"><div><strong>${esc(({compra:'Compra confirmada',referido:'Referido verificado',redencion:'Recompensa solicitada',reintegro:'Puntos reintegrados',reverso:'Compra anulada',ajuste:'Ajuste administrativo',vencimiento:'Puntos vencidos'})[x.kind]||x.kind)}</strong><small>${date(x.created_at)} · ${esc(x.detail||'')}</small></div><strong class="${x.delta>=0?'positive':'negative'} nowrap">${x.delta>0?'+':''}${x.delta} pts</strong></div>`).join(''):'<div class="empty">Todavía no tienes movimientos. Tus compras confirmadas aparecerán aquí.</div>';
}
function renderPurchases(){
 const channels={tienda:'Compra en tienda',whatsapp:'Compra por WhatsApp',domicilio:'Pedido con domicilio',web:'Compra por la página web',otro:'Compra registrada'};
 $('#purchaseList').innerHTML=purchases.length?purchases.map(p=>
  '<div class="data-row"><div><strong>Factura '+esc(p.invoice)+'</strong>'+
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
  if(!confirm('¿Confirmas que deseas reservar estos premios usando tus puntos?')) return;
  const btn=$('#submitRedeem');try {setLoading(btn,true);await run(sb.rpc('bl_redeem',{p_items:selected}));notify('¡Solicitud enviada! BellaShop revisará tu recompensa.');await refreshAccount();}
  catch(err){notify(err.message,'error');}finally{setLoading(btn,false);}
}
async function logOut(){
 if(sb)await sb.auth.signOut();customer=null;
 show('login');window.scrollTo({top:0,behavior:'smooth'});
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
 $('#joinTeacherHelp').textContent=(data||[]).length?
  'Elige una profesora afiliada activa. Si no te recomendó ninguna, deja «Ninguna».':
  'BellaShop todavía no ha publicado profesoras afiliadas. Puedes continuar sin seleccionar ninguna.';
}

async function loadJoinStatus(){
 requestsOpen=(await run(sb.rpc('bl_join_requests_status')))===true;
 $('#joinForm').classList.toggle('hidden',!requestsOpen);
 $('#joinClosed').classList.toggle('hidden',requestsOpen);
}

function setup(){
 $('#joinForm').addEventListener('submit',sendJoinRequest);
 $('#memberLoginForm').addEventListener('submit',sendMemberAccess);
 $('#memberKeyForm').addEventListener('submit',verifyMemberAccess);
 $('#closeAuthModal').addEventListener('click',closeAuthModal);
 $('#authModal').addEventListener('click',event=>{if(event.target===$('#authModal'))closeAuthModal();});
 document.addEventListener('keydown',handleAuthKeydown);
 $$('[data-auth-screen]').forEach(button=>button.addEventListener('click',()=>{
  setAuthScreen(button.dataset.authScreen);
  $('#memberVerification').classList.add('hidden');
  $('#memberLoginFeedback').classList.add('hidden');
 }));
 $('#refreshMemberRewards').addEventListener('click',()=>{if(customer)refreshAccount().then(()=>notify('Tu cuenta está actualizada.')).catch(e=>notify('No fue posible actualizar: '+e.message,'error'));});

 $('#logout').addEventListener('click',logOut);
 $('#submitRedeem').addEventListener('click',submitRedemption);
 $$('.account-tabs button').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.account-tabs button').forEach(x=>x.classList.toggle('active',x===btn));
  $$('.account-tab').forEach(tab=>tab.classList.toggle('hidden',tab.id!==('tab-'+btn.dataset.tab)));
 }));

 $('#joinForm').classList.add('hidden');$('#joinClosed').classList.remove('hidden');
 setAuthScreen('signin');
 if(!HAS_BACKEND)return;
 db().then(async x=>{
  sb=x;
  try{await loadAffiliatedTeachers();}catch(err){console.warn('Profesoras afiliadas no disponibles:',err.message);$('#joinTeacherHelp').textContent='No pudimos cargar las profesoras. Puedes continuar sin seleccionar ninguna.';}
  try{await loadJoinStatus();}catch(err){console.warn('Solicitudes no disponibles:',err.message);}
  const {data:{session}}=await sb.auth.getSession();
  if(session)await loadUser();
 }).catch(err=>notify('No fue posible conectar con BellaLovers: '+err.message,'error'));
}

configureHomeNavigation();
setup();
