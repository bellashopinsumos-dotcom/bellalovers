// Ruta antigua de acceso por correo deshabilitada. El acceso actual usa celular + clave.
const ORIGIN="https://bellashopinsumos-dotcom.github.io";
const HEADERS={
 "Access-Control-Allow-Origin":ORIGIN,
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Content-Type":"application/json; charset=utf-8"
};
Deno.serve(req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:HEADERS});
 return new Response(JSON.stringify({error:"Entra desde BellaLovers con tu nombre y celular o correo, sin clave."}),{status:410,headers:HEADERS});
});
