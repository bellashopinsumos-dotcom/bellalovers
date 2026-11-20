import { createClient } from "npm:@supabase/supabase-js@2.47.16";

const URL=Deno.env.get("SUPABASE_URL")!;
const ANON=Deno.env.get("SUPABASE_ANON_KEY")!;
const SECRET=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORIGIN="https://bellashopinsumos-dotcom.github.io";
const HEADERS={
 "Access-Control-Allow-Origin":ORIGIN,
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Content-Type":"application/json; charset=utf-8",
 "Vary":"Origin"
};
const reply=(obj:unknown,status=200)=>new Response(JSON.stringify(obj),{status,headers:HEADERS});
const generic="No se pudo verificar tu acceso. Revisa tus datos o consulta con BellaShop.";
async function digest(input:string){
 const bytes=new TextEncoder().encode(SECRET+"|"+input);
 const hash=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
 return Array.from(hash).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function phoneOf(value:string){
 const digits=value.replace(/[^0-9]/g,"");
 const phone=digits.startsWith("57")&&digits.length===12?digits.slice(2):digits;
 return /^3[0-9]{9}$/.test(phone)?"+57"+phone:null;
}
function normName(value:string){
 return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLocaleLowerCase("es-CO");
}
function emailOf(raw:string){return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(raw)?raw.toLowerCase():null;}

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:HEADERS});
 if(req.method!=="POST")return reply({error:"Método no permitido"},405);
 if(req.headers.get("origin")!==ORIGIN)return reply({error:"Origen no autorizado"},403);
 let body:Record<string,unknown>;
 try{body=await req.json();}catch{return reply({error:generic},400);}
 const identifier=String(body.identifier||body.phone||"").trim().toLowerCase();
 const phone=phoneOf(identifier),email=emailOf(identifier);
 const name=String(body.full_name||"").trim();
 const key=String(body.access_key||"").trim().toUpperCase();
 if((!phone&&!email)||name.length<3||name.length>120||!name.includes(" ")||
   !/^[A-HJ-NP-Z2-9]{12}$/.test(key))return reply({error:generic},401);
 const service=createClient(URL,SECRET,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  // The rate limit is checked even if the customer is unknown.
  const {data:allowed,error:limitError}=await service.rpc("bl_limit_member_access",{
   p_key:await digest("access:"+(email||phone)),p_max:12
  });
  if(limitError||allowed!==true)return reply({error:"Demasiados intentos. Intenta nuevamente más tarde o contacta a BellaShop."},429);
  const ip=req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip");
  if(ip){
   const {data:ipAllowed}=await service.rpc("bl_limit_member_access",{
     p_key:await digest("ip:"+ip),p_max:60
   });
   if(ipAllowed!==true)return reply({error:"Demasiados intentos. Intenta más tarde."},429);
  }
  let selectedId:string|null=null;
  let personEmail:string|null=null;
  if(email){
   // Service-role-only SQL resolves email without listing all Auth accounts.
   const {data:memberId,error:resolveError}=await service.rpc("bl_resolve_member_email",{p_email:email});
   if(resolveError||!memberId)return reply({error:generic},401);
   selectedId=memberId;personEmail=email;
  }
  const {data:profile,error:profileError}=await service.from("bl_profiles")
   .select("id,full_name,blocked,archived_at,deleted_at")
   .eq(phone?"phone":"id",phone||selectedId).maybeSingle();
  if(profileError||!profile||profile.blocked||profile.archived_at||profile.deleted_at||
     normName(String(profile.full_name))!==normName(name))return reply({error:generic},401);
  const {data:staff}=await service.from("bl_staff").select("user_id").eq("user_id",profile.id).maybeSingle();
  if(staff)return reply({error:generic},401);
  if(!personEmail){
   const {data:person,error:userError}=await service.auth.admin.getUserById(profile.id);
   if(userError||!person?.user?.email)return reply({error:generic},401);
   personEmail=person.user.email;
  }
  const auth=createClient(URL,ANON,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:session,error:signInError}=await auth.auth.signInWithPassword({
   email:personEmail!,password:key
  });
  if(signInError||!session?.session||session.user?.id!==profile.id)return reply({error:generic},401);
  return reply({
   success:true,access_token:session.session.access_token,
   refresh_token:session.session.refresh_token
  });
 }catch(error){
  console.error("Member sign in unavailable:",error instanceof Error?error.message:"unexpected");
  return reply({error:"No se pudo ingresar en este momento. Intenta más tarde."},503);
 }
});