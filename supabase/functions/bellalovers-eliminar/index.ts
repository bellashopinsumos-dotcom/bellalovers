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
 "Vary":"Origin",
};
function reply(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:CORS});}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method!=="POST")return reply({error:"Método inválido"},405);
 if(req.headers.get("origin")!==ORIGIN)return reply({error:"Origen no autorizado"},403);
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return reply({error:"Inicia sesión como administrador"},401);
 const userClient=createClient(URL,ANON,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:userError}=await userClient.auth.getUser(token);
 if(userError||!user)return reply({error:"Sesión inválida"},401);
 const {data:staff,error:staffError}=await userClient.from("bl_staff").select("role,active").eq("user_id",user.id).maybeSingle();
 if(staffError||!staff?.active||staff.role!=="admin")return reply({error:"Solo puede eliminar cuentas el administrador principal"},403);
 let json:Record<string,unknown>;
 try{json=await req.json();}catch{return reply({error:"Solicitud inválida"},400);}
 const id=String(json.customer_id||""),reason=String(json.reason||"").trim();
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)||reason.length<8||reason.length>500)return reply({error:"Identificador o motivo inválido"},400);
 if(id===user.id)return reply({error:"No puedes eliminar tu propia cuenta"},403);
 const {data:result,error:deleteError}=await userClient.rpc("bl_delete_member_account",{p_customer:id,p_reason:reason});
 if(deleteError)return reply({error:deleteError.message},422);
 const admin=createClient(URL,SECRET,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error:authError}=await admin.auth.admin.deleteUser(id,true);
 if(authError&&!(authError.code==="user_not_found"||authError.status===404)){
   console.error("User was deactivated, auth soft-delete returned:",authError.code||authError.message);
   return reply({success:false,account_closed:true,error:"Se bloquearon el acceso y los datos personales, pero Supabase Auth no confirmó el cierre. Contacta al administrador técnico para completarlo."},207);
 }
 return reply({success:true,account_closed:true,
  info:"Se eliminó el acceso y los datos de contacto de la membresía. Se conservan facturas y movimientos para trazabilidad."});
});
