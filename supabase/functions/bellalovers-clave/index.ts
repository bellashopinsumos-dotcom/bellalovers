import { createClient } from "npm:@supabase/supabase-js@2.47.16";

const URL=Deno.env.get("SUPABASE_URL")!;
const ANON=Deno.env.get("SUPABASE_ANON_KEY")!;
const SECRET=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORIGIN="https://bellashopinsumos-dotcom.github.io";
const CORS={
 "Access-Control-Allow-Origin":ORIGIN,
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Content-Type":"application/json; charset=utf-8",
 "Vary":"Origin"
};
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:CORS});
function newKey(){
 const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
 const bytes=new Uint8Array(12);
 crypto.getRandomValues(bytes);
 return Array.from(bytes,b=>alphabet[b%alphabet.length]).join("");
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method!=="POST")return reply({error:"Método no permitido"},405);
 if(req.headers.get("origin")!==ORIGIN)return reply({error:"Origen no autorizado"},403);
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return reply({error:"Debes iniciar sesión como administrador"},401);
 const userClient=createClient(URL,ANON,{
  global:{headers:{Authorization:"Bearer "+token}},
  auth:{persistSession:false,autoRefreshToken:false}
 });
 const {data:{user},error:authError}=await userClient.auth.getUser(token);
 if(authError||!user)return reply({error:"Sesión no válida"},401);
 const {data:staff,error:staffError}=await userClient.from("bl_staff")
   .select("role,active").eq("user_id",user.id).maybeSingle();
 if(staffError||staff?.role!=="admin"||!staff.active)return reply({error:"Solo el administrador principal puede generar claves"},403);
 let input:Record<string,unknown>;
 try{input=await req.json();}catch{return reply({error:"Datos inválidos"},400);}
 const memberId=String(input.member_id||"");
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(memberId))return reply({error:"Cuenta inválida"},400);
 if(memberId===user.id)return reply({error:"No se puede gestionar la contraseña del administrador aquí"},403);
 const service=createClient(URL,SECRET,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:profile,error:profileError}=await service.from("bl_profiles")
  .select("id,phone,blocked,archived_at,deleted_at")
  .eq("id",memberId).maybeSingle();
 if(profileError||!profile||!profile.phone||profile.blocked||profile.archived_at||profile.deleted_at)
  return reply({error:"La cuenta no está activa"},409);
 const {data:memberStaff}=await service.from("bl_staff").select("user_id").eq("user_id",memberId).maybeSingle();
 if(memberStaff)return reply({error:"No se permite cambiar claves de equipo desde Clientas"},403);
 const key=newKey();
 const {error:updateError}=await service.auth.admin.updateUserById(memberId,{password:key});
 if(updateError)return reply({error:"No se pudo generar la clave: "+updateError.message},422);
 // Never write the plaintext key to the database or logs.
 const {error:auditError}=await service.from("bl_audit").insert({
  actor:user.id,action:"generar_clave_membresia",entity:"bl_profiles",
  entity_id:memberId,detail:{method:"entrega_personal_verificada",plain_password_logged:false}
 });
 if(auditError)console.error("Access-key audit error:",auditError.message);
 return reply({success:true,access_key:key,
  notice:"Verifica a quién se la entregarás. Esta clave solo se muestra ahora; puedes generar otra desde Clientas."});
});