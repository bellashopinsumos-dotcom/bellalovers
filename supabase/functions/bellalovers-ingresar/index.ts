import {createClient} from "npm:@supabase/supabase-js@2.47.16";

const URL=Deno.env.get("SUPABASE_URL")!;
const ANON=Deno.env.get("SUPABASE_ANON_KEY")!;
const SECRET=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORIGIN="https://bellashopinsumos-dotcom.github.io";
const HEADERS={
 "Access-Control-Allow-Origin":ORIGIN,
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Content-Type":"application/json; charset=utf-8",
 "Cache-Control":"no-store",
 "Vary":"Origin"
};
const send=(obj:unknown,status=200)=>new Response(JSON.stringify(obj),{status,headers:HEADERS});
const generic="Si tus datos corresponden a una BellaLover activa, BellaShop recibirá la solicitud de acceso. Espera la aprobación del administrador.";
const service=createClient(URL,SECRET,{auth:{persistSession:false,autoRefreshToken:false}});
const anon=createClient(URL,ANON,{auth:{persistSession:false,autoRefreshToken:false}});
function phoneOf(raw:string){
 const digits=raw.replace(/\D/g,"");
 const phone=digits.startsWith("57")&&digits.length===12?digits.slice(2):digits;
 return /^3[0-9]{9}$/.test(phone)?"+57"+phone:null;
}
function emailOf(raw:string){return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(raw)?raw.toLowerCase():null;}
function normName(value:string){
 return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLocaleLowerCase("es-CO");
}
async function digest(value:string){
 const b=new TextEncoder().encode(SECRET+"|"+value);
 return [...new Uint8Array(await crypto.subtle.digest("SHA-256",b))]
 .map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function throttle(input:string,max:number){
 const {data,error}=await service.rpc("bl_limit_member_access",{
  p_key:await digest(input),p_max:max
 });
 return !error&&data===true;
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:HEADERS});
 if(req.method!=="POST")return send({error:"Método inválido"},405);
 if(req.headers.get("origin")!==ORIGIN)return send({error:"Origen no autorizado"},403);
 let data:Record<string,unknown>;
 try{data=await req.json();}catch{return send({error:"Solicitud inválida"},400);}
 const action=String(data.action||"");
 const challenge=String(data.challenge||"");
 if(!/^[A-Za-z0-9_-]{43}$/.test(challenge))return send({error:"Solicitud inválida"},400);
 if(action==="request"){
  const identifier=String(data.identifier||"").trim().toLowerCase();
  const name=String(data.full_name||"").trim();
  const email=emailOf(identifier),phone=email?null:phoneOf(identifier);
  if((!phone&&!email)||name.length<3||name.length>120||!name.includes(" "))
   return send({error:"Escribe tu celular o correo y nombre completo"},400);
  try{
   if(!await throttle("request:"+identifier,5))return send({message:generic});
   const ip=req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip");
   if(ip&&!await throttle("login-ip:"+ip,60))return send({message:generic});
   let memberId:string|null=null;
   if(email){
    const {data:id}=await service.rpc("bl_resolve_member_email",{p_email:email});
    memberId=typeof id==="string"?id:null;
   }else{
    const {data:p}=await service.from("bl_profiles").select("id").eq("phone",phone).maybeSingle();
    memberId=p?.id||null;
   }
   if(!memberId)return send({message:generic});
   const {data:p,error:pError}=await service.from("bl_profiles")
    .select("id,full_name,blocked,archived_at,deleted_at").eq("id",memberId).maybeSingle();
   if(pError||!p||p.blocked||p.archived_at||p.deleted_at||
     normName(String(p.full_name))!==normName(name))return send({message:generic});
   const {data:staff}=await service.from("bl_staff").select("user_id").eq("user_id",memberId).maybeSingle();
   if(staff)return send({message:generic});
   const {error:insertError}=await service.from("bl_login_requests").insert({
    challenge_hash:await digest("challenge:"+challenge),member_id:memberId,
    expires_at:new Date(Date.now()+10*60*1000).toISOString()
   });
   if(insertError)console.error("Login request insert failed",insertError.code||insertError.message);
   return send({message:generic});
  }catch(e){
   console.error("Login request unavailable",e instanceof Error?e.message:"unknown");
   return send({message:generic});
  }
 }
 if(action==="status"){
  try{
   const hash=await digest("challenge:"+challenge);
   const {data:item,error:readError}=await service.from("bl_login_requests")
    .select("id,member_id,status,expires_at").eq("challenge_hash",hash).maybeSingle();
   if(readError||!item)return send({status:"pendiente"});
   if(new Date(item.expires_at).getTime()<=Date.now())return send({status:"vencida"});
   if(item.status==="rechazada")return send({status:"rechazada"});
   if(item.status==="usada")return send({status:"vencida"});
   if(item.status!=="aprobada")return send({status:"pendiente"});
   const {data:p}=await service.from("bl_profiles")
    .select("id,blocked,archived_at,deleted_at").eq("id",item.member_id).maybeSingle();
   if(!p||p.blocked||p.archived_at||p.deleted_at)return send({status:"rechazada"});
   // Only the holder of the cryptographically random challenge can claim the approved request.
   const {data:claimed,error:claimError}=await service.from("bl_login_requests")
    .update({status:"usada"}).eq("id",item.id).eq("status","aprobada")
    .gt("expires_at",new Date().toISOString()).select("member_id").maybeSingle();
   if(claimError||!claimed)return send({status:"vencida"});
   const {data:person,error:userError}=await service.auth.admin.getUserById(item.member_id);
   if(userError||!person?.user?.email)return send({status:"error",message:"No se pudo completar el ingreso. Solicita de nuevo."});
   // Generate and consume a one-time Auth link entirely on the server. No email or SMS sent.
   const {data:link,error:linkError}=await service.auth.admin.generateLink({
    type:"magiclink",email:person.user.email
   });
   const tokenHash=link?.properties?.hashed_token;
   if(linkError||!tokenHash)return send({status:"error",message:"No se pudo completar el ingreso. Solicita de nuevo."});
   const {data:auth,error:otpError}=await anon.auth.verifyOtp({token_hash:tokenHash,type:"magiclink"});
   if(otpError||auth?.user?.id!==item.member_id||!auth.session)
    return send({status:"error",message:"No se pudo completar el ingreso. Solicita de nuevo."});
   return send({status:"aprobada",access_token:auth.session.access_token,
    refresh_token:auth.session.refresh_token});
  }catch(e){
   console.error("Login verification error",e instanceof Error?e.message:"unknown");
   return send({status:"error",message:"No se pudo completar el ingreso. Solicita de nuevo."});
  }
 }
 return send({error:"Acción no disponible"},400);
});
