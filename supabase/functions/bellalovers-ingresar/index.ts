// Ruta antigua de autorizaciones de ingreso deshabilitada.
// El acceso actual usa bellalovers-consulta: celular/correo y nombre, sin aprobación.
const ORIGIN="https://bellashopinsumos-dotcom.github.io";
const headers={
 "Access-Control-Allow-Origin":ORIGIN,
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Content-Type":"application/json; charset=utf-8",
 "Cache-Control":"no-store"
};
Deno.serve(req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 return new Response(JSON.stringify({error:"La ruta antigua ya no se usa. Entra con tus datos desde BellaLovers."}),
 {status:410,headers});
});
