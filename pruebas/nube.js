// Sincronización entre aparatos: el SERVIDOR.
//
// Prueba la función de verdad (`netlify/functions/nube.mjs`), no una copia.
// `@netlify/blobs` no se puede instalar aquí (npm está bloqueado en este
// entorno), así que se le pone un doble en memoria en un node_modules
// temporal y se importa el archivo real desde ahí. Lo que se prueba es el
// código que se despliega, letra por letra.
//
// Lo importante que se comprueba:
//  · el código NUNCA se guarda: lo que llega al almacén es su SHA-256;
//  · un código inventado o corto se rechaza antes de tocar nada;
//  · una caja que aún no existe NO es un error (es un código nuevo), porque
//    devolverlo como fallo haría creer al móvil que se equivocó de código;
//  · dos códigos distintos no se ven entre sí;
//  · hay tope de tamaño.
const fs=require('fs'), path=require('path'), os=require('os'), crypto=require('crypto');

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ixnube-'));
const mod=path.join(tmp,'node_modules','@netlify','blobs');
fs.mkdirSync(mod,{recursive:true});
fs.writeFileSync(path.join(mod,'package.json'),
  JSON.stringify({name:'@netlify/blobs',version:'0.0.0-doble',type:'module',main:'index.mjs'}));
// Doble del almacén: guarda en un objeto y apunta TODO lo que se le pide, para
// poder mirar después con qué nombre se guardó cada caja.
fs.writeFileSync(path.join(mod,'index.mjs'), `
export const __cajas = {};
export const __log = [];
export function getStore(nombre){
  __cajas[nombre] = __cajas[nombre] || {};
  return {
    async get(clave, opts){ __log.push(['get',nombre,clave]); const v=__cajas[nombre][clave]; return v===undefined?null:v; },
    async setJSON(clave, valor){ __log.push(['set',nombre,clave]); __cajas[nombre][clave]=valor; },
  };
}
`);
// El archivo real, copiado al temporal para que resuelva el doble.
fs.copyFileSync('/home/user/IXClock/netlify/functions/nube.mjs', path.join(tmp,'nube.mjs'));

const COD='ABCD-EFGH-JKMN-PQRS-TUVW';
const OTRO='2345-6789-ABCD-EFGH-JKMN';
const sha=c=>crypto.createHash('sha256').update('ixclock-nube-v1:'+c).digest('hex');

const pet=(metodo,cuerpo,qs)=>({
  method:metodo,
  url:'http://x/.netlify/functions/nube'+(qs||''),
  json:async()=>cuerpo,
});

(async()=>{
 const blobs=await import(path.join(mod,'index.mjs'));
 const {default:handler}=await import(path.join(tmp,'nube.mjs'));
 const o={};

 // ── una caja que aún no existe: NO es un error ──
 let r=await handler(pet('GET',null,'?codigo='+COD));
 o.vacia={ status:r.status, cuerpo:JSON.parse(await r.text()) };

 // ── guardar ──
 r=await handler(pet('POST',{codigo:COD, datos:{notes:'[{"t":"hola"}]', ica_alarms:'[]'}}));
 o.guardar={ status:r.status, cuerpo:JSON.parse(await r.text()) };

 // ── y traerlo ──
 r=await handler(pet('GET',null,'?codigo='+COD));
 o.traer={ status:r.status, cuerpo:JSON.parse(await r.text()) };

 // ── ¿con qué nombre quedó guardada? Tiene que ser el hash, nunca el código ──
 const caja=blobs.__cajas['ixnube']||{};
 const nombres=Object.keys(caja);
 o.nombres={
   cuantas:nombres.length,
   esHash: nombres[0]===sha(COD),
   llevaElCodigo: nombres.some(n=>n.indexOf(COD)>=0 || n.indexOf(COD.replace(/-/g,''))>=0),
   // y en el CONTENIDO tampoco puede aparecer el código
   contenidoLimpio: JSON.stringify(caja).indexOf(COD)<0,
 };

 // ── minúsculas y espacios: el mismo código ──
 r=await handler(pet('GET',null,'?codigo='+encodeURIComponent(COD.toLowerCase())));
 o.minusculas=JSON.parse(await r.text());

 // ── otro código NO ve lo del primero ──
 r=await handler(pet('GET',null,'?codigo='+OTRO));
 o.otro=JSON.parse(await r.text());

 // ── códigos que no valen ──
 o.malos={};
 for(const [n,c] of [['corto','ABC'],['vacio',''],['raro','ABCD-EFGH-JKMN-PQRS-TUV<'],
                     ['confusas','0000-1111-IIII-LLLL-OOOO'],['larguisimo','A'.repeat(80)]]){
   const rr=await handler(pet('GET',null,'?codigo='+encodeURIComponent(c)));
   o.malos[n]=rr.status;
 }
 // y al guardar también
 r=await handler(pet('POST',{codigo:'ABC', datos:{a:'1'}}));
 o.guardarMalo=r.status;

 // ── datos que no son un objeto ──
 r=await handler(pet('POST',{codigo:COD, datos:'soy un texto'}));
 o.datosTexto=r.status;
 r=await handler(pet('POST',{codigo:COD, datos:['una','lista']}));
 o.datosLista=r.status;

 // ── tope de tamaño ──
 r=await handler(pet('POST',{codigo:COD, datos:{gordo:'x'.repeat(1024*1024+50)}}));
 o.gordo=r.status;
 // y que el gordo NO pisó lo bueno
 r=await handler(pet('GET',null,'?codigo='+COD));
 o.trasGordo=JSON.parse(await r.text());

 // ── sobrescribir: la segunda vez manda ──
 await handler(pet('POST',{codigo:COD, datos:{notes:'[{"t":"nuevo"}]'}}));
 r=await handler(pet('GET',null,'?codigo='+COD));
 o.sobrescrito=JSON.parse(await r.text());

 // ── métodos y CORS ──
 r=await handler(pet('DELETE',null,'?codigo='+COD));  o.borrar=r.status;
 r=await handler(pet('OPTIONS',null));                o.options=r.status;
 o.cors=r.headers.get('access-control-allow-origin');

 fs.rmSync(tmp,{recursive:true,force:true});

 const pruebas=[
  ['un código nuevo no da error',      o.vacia.status===200 && o.vacia.cuerpo.vacia===true, JSON.stringify(o.vacia)],
  ['guardar responde bien',            o.guardar.status===200 && o.guardar.cuerpo.ok===true && !!o.guardar.cuerpo.guardado, JSON.stringify(o.guardar.cuerpo)],
  ['y lo guardado se recupera igual',  o.traer.cuerpo.datos && o.traer.cuerpo.datos.notes==='[{"t":"hola"}]', JSON.stringify(o.traer.cuerpo.datos)],
  ['con su fecha',                     !!o.traer.cuerpo.guardado, o.traer.cuerpo.guardado],
  ['EL CÓDIGO NO SE GUARDA: la caja se llama por su hash', o.nombres.esHash===true, o.nombres.cuantas+' caja(s)'],
  ['el código no aparece en el nombre',o.nombres.llevaElCodigo===false, o.nombres.llevaElCodigo],
  ['ni dentro del contenido',          o.nombres.contenidoLimpio===true, o.nombres.contenidoLimpio],
  ['da igual mayúsculas o minúsculas', o.minusculas.vacia===false && !!o.minusculas.datos, JSON.stringify(o.minusculas.vacia)],
  ['otro código no ve tus datos',      o.otro.vacia===true && o.otro.datos===null, JSON.stringify(o.otro)],
  ['código corto: rechazado',          o.malos.corto===400,      o.malos.corto],
  ['código vacío: rechazado',          o.malos.vacio===400,      o.malos.vacio],
  ['con signos raros: rechazado',      o.malos.raro===400,       o.malos.raro],
  ['con las letras confusas (0/1/I/L/O): rechazado', o.malos.confusas===400, o.malos.confusas],
  ['larguísimo: rechazado',            o.malos.larguisimo===400, o.malos.larguisimo],
  ['al guardar también se comprueba',  o.guardarMalo===400,      o.guardarMalo],
  ['datos que no son objeto: rechazado', o.datosTexto===400 && o.datosLista===400, o.datosTexto+' '+o.datosLista],
  ['hay tope de tamaño',               o.gordo===413,            o.gordo],
  ['y lo gordo no pisó lo bueno',      o.trasGordo.datos && o.trasGordo.datos.notes==='[{"t":"hola"}]', JSON.stringify(o.trasGordo.datos)],
  ['guardar otra vez sobrescribe',     o.sobrescrito.datos.notes==='[{"t":"nuevo"}]', JSON.stringify(o.sobrescrito.datos)],
  ['DELETE no está permitido',         o.borrar===405,           o.borrar],
  ['OPTIONS responde para CORS',       o.options===204 && o.cors==='*', o.options+' '+o.cors],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
