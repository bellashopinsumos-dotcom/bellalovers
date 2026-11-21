import {createClient} from "npm:@supabase/supabase-js@2.47.16";

const URL=Deno.env.get("SUPABASE_URL")!;
const SECRET=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORIGIN="https://bellashopinsumos-dotcom.github.io";
const client=createClient(URL,SECRET,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={
 "Access-Control-Allow-Origin":ORIGIN,
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Content-Type":"application/json; charset=utf-8",
 "Cache-Control":"no-store",
 "Vary":"Origin"
};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
function normalizeName(raw:string){
 return raw.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();
}
function normalizedIdentifier(value:string){
 const original=value.trim().toLowerCase();
 if(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(original))return {email:original};
 const digits=original.replace(/\D/g,"");
 const phone=digits.startsWith("57")&&digits.length===12?digits.slice(2):digits;
 return /^3\d{9}$/.test(phone)?{phone:"+57"+phone}:null;
}
async function digest(value:string){
 const input=new TextEncoder().encode(SECRET+"|"+value);
 const raw=new Uint8Array(await crypto.subtle.digest("SHA-256",input));
 return [...raw].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function limit(identifier:string,kind:string,max:number){
 const {data,error}=await client.rpc("bl_limit_member_access",{
  p_key:await digest("public-account:"+kind+":"+identifier),p_max:max
 });
 return !error&&data===true;
}
const generic="No encontramos una membresía activa con ese nombre y celular o correo. Revisa tus datos o regístrate.";
async function resolveMember(identifier:string,fullName:string){
 const token=normalizedIdentifier(identifier);
 if(!token||fullName.length<3||fullName.length>120||!fullName.trim().includes(" "))return null;
 let id:string|null=null;
 if("email" in token){
  const {data,error}=await client.rpc("bl_resolve_member_email",{p_email:token.email});
  if(error)return null;
  id=typeof data==="string"?data:null;
 }else if("phone" in token){
  const {data,error}=await client.from("bl_profiles")
   .select("id").eq("phone",token.phone).maybeSingle();
  if(error)return null;
  id=data?.id||null;
 }
 if(!id)return null;
 const {data:person,error}=await client.from("bl_profiles")
  .select("id,full_name,category,created_at,blocked,archived_at,deleted_at").eq("id",id).maybeSingle();
 if(error||!person||person.blocked||person.archived_at||person.deleted_at||
  normalizeName(person.full_name)!==normalizeName(fullName))return null;
 const {data:staff}=await client.from("bl_staff").select("user_id").eq("user_id",id).maybeSingle();
 if(staff)return null;
 return person;
}
async function balanceFor(memberId:string){
 const {data:cycles,error:cycleError}=await client.from("bl_cycles")
  .select("id,started_at,expires_at,grace_until,closed_at")
  .eq("customer_id",memberId).order("expires_at",{ascending:true}).limit(500);
 if(cycleError)throw cycleError;
 const points:Array<{cycle_id:string,delta:number,kind:string,created_at:string}>=[];
 // Consultar todas las páginas; no limitar el saldo a los últimos 500 movimientos.
 for(let offset=0;offset<50000;offset+=1000){
  const {data:batch,error:pointError}=await client.from("bl_points")
   .select("cycle_id,delta,kind,created_at").eq("customer_id",memberId)
   .order("created_at",{ascending:false}).order("id",{ascending:false})
   .range(offset,offset+999);
  if(pointError)throw pointError;
  points.push(...(batch||[]));
  if((batch||[]).length<1000)break;
 }
 const ids=new Set((cycles||[]).filter(c=>!c.closed_at&&Date.parse(c.grace_until)>Date.now()).map(c=>c.id));
 const amount=(points||[]).filter(p=>ids.has(p.cycle_id)).reduce((a,p)=>a+Number(p.delta),0);
 return {balance:Math.max(0,amount),cycles:cycles||[],points};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return respond({error:"Método inválido"},405);
 if(req.headers.get("origin")!==ORIGIN)return respond({error:"Origen no autorizado"},403);
 let body:Record<string,unknown>;
 try{body=await req.json();}catch{return respond({error:"Solicitud inválida"},400);}
 const action=String(body.action||"view");
 // Datos públicos del programa: no incluyen información de clientas.
 if(action==="public_rules"){
  const {data,error}=await client.from("bl_settings")
   .select("min_purchase,point_value,unlock_points,student_gift_min,cycle_months,grace_days,exclude_discounts,student_first_no_points,shop_url")
   .eq("id",1).single();
  if(error||!data)return respond({error:"No pudimos cargar las reglas del club."},503);
  return respond({success:true,rules:data});
 }
 const identifier=String(body.identifier||"").trim();
 const fullName=String(body.full_name||"").trim();
 const parsed=normalizedIdentifier(identifier);
 if(!parsed||fullName.length<3||fullName.length>120||!fullName.includes(" "))
  return respond({error:"Escribe celular o correo y nombre completo válido."},400);
 const key=("email" in parsed?parsed.email:parsed.phone)||"";
 if(!await limit(key,"lookup",60))return respond({error:"Demasiados intentos. Vuelve más tarde."},429);
 const ip=req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip");
 if(ip&&!await limit(ip,"ip",100))return respond({error:"Se alcanzó el límite de consultas."},429);
 try{
  const person=await resolveMember(identifier,fullName);
  if(!person)return respond({error:generic},404);
  const {balance,cycles,points}=await balanceFor(person.id);
  if(action==="view"){
   const [settingsResult,purchasesResult,rewardsResult,redemptionsResult,guestResult,teacherResult,giftResult]=await Promise.all([
    client.from("bl_settings").select("unlock_points,student_gift_min").eq("id",1).single(),
    client.from("bl_purchases").select("created_at,products_total,points_awarded,status,channel,special_discount")
      .eq("customer_id",person.id).order("created_at",{ascending:false}).limit(80),
    client.from("bl_rewards").select("id,name,product_ref,image_url,points_cost,stock,reserved,active,audience")
      .eq("active",true).order("points_cost",{ascending:true}).limit(100),
    client.from("bl_redemptions").select("id,created_at,status,total_points").eq("customer_id",person.id)
      .order("created_at",{ascending:false}).limit(35),
    client.from("bl_guest_reward_requests").select("id,created_at,status,total_points").eq("customer_id",person.id)
      .order("created_at",{ascending:false}).limit(35),
    client.from("bl_teacher_codes").select("code").eq("teacher_id",person.id).eq("enabled",true).maybeSingle(),
     client.from("bl_gift_claims").select("id").eq("student_id",person.id).limit(1)
   ]);
   for(const item of [settingsResult,purchasesResult,rewardsResult,redemptionsResult,guestResult,teacherResult,giftResult])
    if(item.error)throw item.error;
   const rewards=(rewardsResult.data||[]).filter(r=>r.audience==="todas"||r.audience===person.category);
   const traditional=(redemptionsResult.data||[]).map(r=>({
    id:r.id,created_at:r.created_at,total_points:r.total_points,status:r.status
   }));
   const guests=(guestResult.data||[]).map(r=>({
    id:r.id,created_at:r.created_at,total_points:r.total_points,
    status:r.status==="pendiente"?"solicitada":r.status==="aprobada"?"aprobada":"rechazada"
   }));
   const requests=[...traditional,...guests].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,65);
   // Never disclose phone, email, database UUID, invoice number, internal notes or payment receipts.
   return respond({
    success:true,profile:{
     id:"public-"+String(person.id).slice(0,8),full_name:person.full_name,
     category:person.category,created_at:person.created_at,blocked:false
    },
    settings:{unlock_points:settingsResult.data.unlock_points||50,
     student_gift_min:settingsResult.data.student_gift_min||150000},
    balance,cycles,ledger:points.slice(0,250).map(p=>({
     cycle_id:p.cycle_id,created_at:p.created_at,kind:p.kind,delta:p.delta,detail:""
    })),
    purchases:(purchasesResult.data||[]).map(p=>({...p,invoice:null})),
    requests,rewards,gift_claimed:(giftResult.data||[]).length>0,teacher_code:teacherResult.data?.code||null
   });
  }
  if(action==="request_reward"){
   if(!await limit(key,"reward",3))return respond({error:"Límite de solicitudes alcanzado. Consulta con BellaShop."},429);
   const {data:settings,error:settingsError}=await client.from("bl_settings").select("unlock_points").eq("id",1).single();
   if(settingsError)throw settingsError;
   const threshold=Math.max(1,Number(settings?.unlock_points||50));
   if(balance<threshold)return respond({error:"Necesitas al menos "+threshold+" puntos para solicitar un premio."},422);
   const raw=body.items;
   if(!Array.isArray(raw)||raw.length<1||raw.length>10)return respond({error:"Selecciona de 1 a 10 premios."},400);
   const ids=new Set<string>(),chosen:{reward_id:string,qty:number}[]=[];
   for(const value of raw){
    if(!value||typeof value!=="object")return respond({error:"Premio inválido"},400);
    const rewardId=String(value.reward_id||"");
    const qty=Number(value.qty);
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(rewardId)||!Number.isSafeInteger(qty)||qty<1||qty>5||ids.has(rewardId))
     return respond({error:"Revisa los premios o cantidades."},400);
    ids.add(rewardId);chosen.push({reward_id:rewardId,qty});
   }
   const {data:existing}=await client.from("bl_guest_reward_requests")
    .select("id").eq("customer_id",person.id).eq("status","pendiente").maybeSingle();
   if(existing)return respond({error:"Ya tienes una solicitud pendiente. BellaShop debe confirmarla antes de solicitar otra."},409);
   const {data:listed,error:rewardsError}=await client.from("bl_rewards")
    .select("id,points_cost,stock,reserved,active,audience").in("id",[...ids]);
   if(rewardsError)throw rewardsError;
   let total=0;
   for(const item of chosen){
    const r=(listed||[]).find(x=>x.id===item.reward_id);
    if(!r||!r.active||!(r.audience==="todas"||r.audience===person.category)||r.stock-r.reserved<item.qty)
     return respond({error:"Uno de los premios no está disponible."},422);
    total+=r.points_cost*item.qty;
   }
   if(total<=0||total>balance)return respond({error:"Tus puntos no alcanzan para estos premios."},422);
   const {data:created,error:createError}=await client.from("bl_guest_reward_requests")
    .insert({customer_id:person.id,items:chosen,total_points:total,status:"pendiente"})
    .select("id").single();
   if(createError){
    if(createError.code==="23505")return respond({error:"Ya tienes una solicitud pendiente."},409);
    throw createError;
   }
   return respond({success:true,request_id:created.id,
    message:"¡Solicitud registrada! BellaShop confirmará contigo por WhatsApp antes de descontar puntos, reservar o entregar cualquier premio."});
  }
  return respond({error:"Acción desconocida"},400);
 }catch(error){
  console.error("Account lookup failed",error instanceof Error?error.message:"unexpected");
  return respond({error:"No pudimos consultar tu cuenta. Intenta nuevamente."},503);
 }
});
