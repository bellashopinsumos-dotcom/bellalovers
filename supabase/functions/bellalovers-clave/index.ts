// Endpoint anterior de claves deshabilitado: BellaLovers usa aprobación manual de acceso.
const ORIGIN="https://bellashopinsumos-dotcom.github.io";
const HEADERS={
 "Access-Control-Allow-Origin":ORIGIN,
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Content-Type":"application/json; charset=utf-8",
 "Cache-Control":"no-store"
};
Deno.serve(req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:HEADERS});
 return new Response(JSON.stringify({error:"BellaLovers ya no utiliza claves privadas. Solicita autorización desde el administrador."}),
 {status:410,headers:HEADERS});
});
