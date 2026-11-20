import { createClient } from "npm:@supabase/supabase-js@2.47.16";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE = "https://bellashopinsumos-dotcom.github.io";
const REDIRECT = SITE+"/bellalovers/";
const CORS = {
 "Access-Control-Allow-Origin":SITE,
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Content-Type":"application/json; charset=utf-8",
 "Vary":"Origin",
};
const generic = "Si tus datos corresponden a una membresía aprobada, recibirás un enlace seguro en el correo registrado. Revisa también spam.";
const send = (data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:CORS});
const formatName=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLocaleLowerCase("es-CO");
async function hash(text:string) {
 const bytes=new TextEncoder().encode(SECRET+"|"+text);
 return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(x=>x.toString(16).padStart(2,"0")).join("");
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method!=="POST")return send({error:"Método inválido"},405);
 if(req.headers.get("origin")!==SITE)return send({error:"Origen no autorizado"},403);
 let body:Record<string,unknown>;
 try{body=await req.json();}catch{return send({error:"Revisa los datos del formulario"},400);}
 const identifier=String(body.identifier||"").trim().toLowerCase();
 const name=String(body.full_name||"").trim();
 if(identifier.length<5||identifier.length>254||name.length<3||name.length>120)
  return send({error:"Escribe tu correo o celular y tu nombre completo"},400);
 const isEmail=identifier.includes("@");
 let normalized:string;
 if(isEmail){
  if(!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(identifier))return send({error:"Correo no válido"},400);
  normalized=identifier;
 }else{
  const digits=identifier.replace(/\D/g,"");
  const local=digits.startsWith("57")&&digits.length===12?digits.slice(2):digits;
  if(!/^3\d{9}$/.test(local))return send({error:"Celular colombiano no válido"},400);
  normalized="+57"+local;
 }
 const service=createClient(URL,SECRET,{auth:{persistSession:false,autoRefreshToken:false}});
 // Throttle by identifier, including unknown accounts. Do not expose whether a customer exists.
 try{
  const fingerprint=await hash("member:"+normalized);
  const {data:allowed,error:rateError}=await service.rpc("bl_limit_member_access",{p_key:fingerprint,p_max:5});
  if(rateError || !allowed)return send({message:generic});
  const requestId=req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if(requestId){
   const {data:ipAllowed}=await service.rpc("bl_limit_member_access",{p_key:await hash("ip:"+requestId),p_max:30});
   if(ipAllowed===false)return send({message:generic});
  }
  let query=service.from("bl_join_requests")
    .select("approved_user_id,email,full_name")
    .eq("status","aprobada")
    .not("approved_user_id","is",null);
  query=isEmail?query.eq("email",normalized):query.eq("phone",normalized);
  const {data:joined,error:joinError}=await query.order("reviewed_at",{ascending:false}).limit(1).maybeSingle();
  if(joinError||!joined?.approved_user_id)return send({message:generic});
  if(formatName(name)!==formatName(String(joined.full_name)))return send({message:generic});
  const {data:profile,error:profileError}=await service.from("bl_profiles")
    .select("id,full_name,blocked,archived_at").eq("id",joined.approved_user_id).maybeSingle();
  if(profileError||!profile||profile.blocked||profile.archived_at)return send({message:generic});
  if(formatName(name)!==formatName(String(profile.full_name)))return send({message:generic});
  // Auth sends the secret login link to the registered address; it is never returned to a visitor.
  const anonClient=createClient(URL,ANON,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error:sendError}=await anonClient.auth.signInWithOtp({
   email:joined.email,
   options:{shouldCreateUser:false,emailRedirectTo:REDIRECT},
  });
  if(sendError)console.error("Member email link delivery failed:",sendError.code||sendError.message);
  return send({message:generic});
 }catch(error){
  console.error("Member login request failed",error instanceof Error?error.message:"Unexpected error");
  return send({message:generic});
 }
});