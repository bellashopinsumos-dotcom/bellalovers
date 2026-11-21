
import { createClient } from "npm:@supabase/supabase-js@2.47.16";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORIGIN = "https://bellashopinsumos-dotcom.github.io";
const CORS = {
 "Access-Control-Allow-Origin": ORIGIN,
 "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
 "Access-Control-Allow-Methods": "POST,OPTIONS",
 "Content-Type": "application/json; charset=utf-8",
 "Vary": "Origin",
};
const send = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status,headers:CORS});
Deno.serve(async (req: Request) => {
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method!=="POST")return send({error:"Método no permitido"},405);
 if(req.headers.get("origin") && req.headers.get("origin")!==ORIGIN)return send({error:"Origen no autorizado"},403);
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return send({error:"Inicia sesión como administrador"},401);
 const userClient=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:whoError}=await userClient.auth.getUser(token);
 if(whoError||!user)return send({error:"Sesión no válida"},401);
 const {data:staff,error:staffError}=await userClient.from("bl_staff")
   .select("role,active").eq("user_id",user.id).maybeSingle();
 if(staffError || staff?.role!=="admin"||!staff?.active)return send({error:"Solo la administración de BellaShop puede aprobar solicitudes"},403);
 let payload: Record<string,unknown>;
 try{payload=await req.json();}catch{return send({error:"Datos inválidos"},400);}
 const requestId=String(payload.request_id||"");
 const submittedInvoice=String(payload.invoice||"").trim();
 const invoice=submittedInvoice||"REG-"+crypto.randomUUID().replaceAll("-","").toUpperCase();
 const products=Number(payload.products_total);
 const delivery=0;
 const channel=String(payload.channel||"otro");
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(requestId)||
    invoice.length<2||invoice.length>80||
    !Number.isSafeInteger(products)||products<=0||products>500000000||
    !Number.isSafeInteger(delivery)||delivery<0||delivery>50000000||
    !["tienda","whatsapp","web","domicilio","otro"].includes(channel))return send({error:"Revisa los datos de la factura"},400);
 const {data:pending,error:readError}=await userClient.from("bl_join_requests")
   .select("id,email,phone,status").eq("id",requestId).maybeSingle();
 if(readError||!pending||pending.status!=="pendiente")return send({error:"La solicitud ya fue revisada o no existe"},409);
 const {data:invoiceExists}=await userClient.from("bl_purchases").select("id").eq("invoice",invoice).maybeSingle();
 if(invoiceExists)return send({error:"Esa factura ya está registrada"},409);
 const adminClient=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 // Crear membresía aprobada sin contraseña, envío de SMS ni invitación por correo.
 // La clienta podrá consultar su membresía directamente con nombre y celular o correo.
 const {data:created,error:createError}=await adminClient.auth.admin.createUser({
  email:pending.email,email_confirm:true
 });
 if(createError||!created?.user?.id){
  return send({error:"No fue posible activar la cuenta de esta clienta. Comprueba su solicitud.",detail:createError?.message},422);
 }
 const newId=created.user.id;
 try {
  const {data,error}=await userClient.rpc("bl_approve_join_request",{
   p_request:requestId,p_user:newId,p_invoice:invoice,p_amount:products,p_delivery:delivery,
   p_discount:payload.special_discount===true,p_channel:channel,
   p_notes:((submittedInvoice?"":"Registro interno sin factura comercial. ")+String(payload.notes||"")).slice(0,500)
  });
  if(error)throw error;
  return send({success:true,purchase:data,reference:invoice,internal_reference:!submittedInvoice,
   notice:"Membresía aprobada. La clienta puede ingresar directamente con su nombre y celular o correo registrado."});
 } catch(error){
  // Si la factura falla, eliminar únicamente la cuenta recién creada.
  await adminClient.auth.admin.deleteUser(newId);
  return send({error:error instanceof Error?error.message:"No se pudo confirmar la compra"},422);
 }
});
