// Avisos por correo (Resend): el SERVIDOR.
//
// Prueba la función de verdad (`netlify/functions/correo.mjs`), no una copia,
// con un doble de `@netlify/blobs` en un node_modules temporal (npm está
// bloqueado en este entorno) y `fetch` interceptado para no llamar a Resend.
//
// LO MÁS IMPORTANTE QUE SE COMPRUEBA, y por qué:
// Este endpoint es PÚBLICO. Si aceptara un destinatario en la petición sería un
// relé de spam gratis con la cuenta del dueño. Por eso el destino sale de una
// variable de entorno y NO de la petición — y esta prueba intenta colar un
// destinatario de varias formas para confirmar que se ignora.
//
// También: que sin la clave configurada lo DIGA en vez de fallar en silencio,
// y que la clave nunca salga en ninguna respuesta.
const fs=require('fs'), path=require('path'), os=require('os');

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ixcorreo-'));
const mod=path.join(tmp,'node_modules','@netlify','blobs');
fs.mkdirSync(mod,{recursive:true});
fs.writeFileSync(path.join(mod,'package.json'),
  JSON.stringify({name:'@netlify/blobs',version:'0.0.0-doble',type:'module',main:'index.mjs'}));
fs.writeFileSync(path.join(mod,'index.mjs'),`
export const __c={};
export function getStore(n){ __c[n]=__c[n]||{}; return {
  async get(k){ const v=__c[n][k]; return v===undefined?null:v; },
  async setJSON(k,v){ __c[n][k]=v; },
}; }
`);
fs.copyFileSync('/home/user/IXClock/netlify/functions/correo.mjs', path.join(tmp,'correo.mjs'));

const CLAVE='re_claveSecretaDePrueba_noDebeSalirNunca';
const DESTINO='albert@ejemplo.com';

const pet=(metodo,cuerpo)=>({ method:metodo, json:async()=>cuerpo });

(async()=>{
 const {default:handler}=await import(path.join(tmp,'correo.mjs'));
 const o={};

 // Se queda con lo que se le manda a Resend, sin llamar a nadie.
 const enviados=[];
 let respuesta={ok:true, status:200, cuerpo:{id:'correo-1'}};
 const fetchReal=global.fetch;
 global.fetch=async(url,opts)=>{
   enviados.push({url, headers:opts.headers, body:JSON.parse(opts.body)});
   return { ok:respuesta.ok, status:respuesta.status, json:async()=>respuesta.cuerpo };
 };

 // ── SIN CONFIGURAR: lo dice, y dice QUÉ falta ──
 delete process.env.RESEND_API_KEY; delete process.env.CORREO_DESTINO;
 let r=await handler(pet('POST',{asunto:'Hola',texto:'Qué tal'}));
 o.sinNada={ status:r.status, cuerpo:JSON.parse(await r.text()) };

 process.env.RESEND_API_KEY=CLAVE;
 r=await handler(pet('POST',{asunto:'Hola',texto:'Qué tal'}));
 o.sinDestino={ status:r.status, cuerpo:JSON.parse(await r.text()) };

 process.env.CORREO_DESTINO=DESTINO;

 // ── ENVÍO NORMAL ──
 r=await handler(pet('POST',{asunto:'Alarma: Trabajo',texto:'Son las 7:30'}));
 o.normal={ status:r.status, cuerpo:JSON.parse(await r.text()), enviado:enviados[enviados.length-1] };

 // ── INTENTOS DE COLAR OTRO DESTINATARIO ──
 // Este es el punto: nada de esto puede cambiar a quién se escribe.
 const intentos=[
   {asunto:'a',texto:'b', to:'victima@ejemplo.com'},
   {asunto:'a',texto:'b', para:'victima@ejemplo.com'},
   {asunto:'a',texto:'b', destino:'victima@ejemplo.com'},
   {asunto:'a',texto:'b', from:'falso@ejemplo.com'},
   {asunto:'a',texto:'b', to:['uno@ejemplo.com','dos@ejemplo.com']},
 ];
 o.colar=[];
 for(const i of intentos){
   await handler(pet('POST',i));
   const e=enviados[enviados.length-1];
   o.colar.push({ to:JSON.stringify(e.body.to), from:e.body.from });
 }

 // ── LA CLAVE NO SALE EN NINGUNA RESPUESTA ──
 const todasLasRespuestas=[JSON.stringify(o.sinNada), JSON.stringify(o.sinDestino), JSON.stringify(o.normal.cuerpo)];
 o.claveFiltrada = todasLasRespuestas.some(t=>t.indexOf(CLAVE)>=0);
 // pero sí viaja a Resend, en la cabecera, que es donde toca
 o.claveEnCabecera = String(o.normal.enviado.headers.authorization||'').indexOf(CLAVE)>=0;

 // ── UN ASUNTO CON CÓDIGO NO SE CONVIERTE EN HTML DEL CORREO ──
 await handler(pet('POST',{asunto:'Aviso',texto:'<img src=x onerror=alert(1)> y <b>negrita</b>'}));
 const conCodigo=enviados[enviados.length-1].body;
 o.escapado={ html:conCodigo.html, crudo:/<img src=x/i.test(conCodigo.html),
              escapado:/&lt;img/i.test(conCodigo.html),
              textoPlanoIntacto: conCodigo.text.indexOf('<img')>=0 };

 // ── VACÍOS Y MÉTODOS ──
 r=await handler(pet('POST',{asunto:'',texto:'algo'}));      o.sinAsunto=r.status;
 r=await handler(pet('POST',{asunto:'algo',texto:''}));      o.sinTexto=r.status;
 r=await handler(pet('POST',{}));                            o.sinNada2=r.status;
 r=await handler(pet('GET',null));                           o.get=r.status;
 r=await handler(pet('OPTIONS',null));                       o.options=r.status;

 // ── SE RECORTA LO LARGUÍSIMO ──
 await handler(pet('POST',{asunto:'A'.repeat(500), texto:'B'.repeat(9000)}));
 const largo=enviados[enviados.length-1].body;
 o.recorte={ asunto:largo.subject.length, texto:largo.text.length };

 // ── TOPE POR HORA ──
 const antes=enviados.length;
 let topeEn=-1;
 for(let i=0;i<30;i++){
   const rr=await handler(pet('POST',{asunto:'spam '+i, texto:'x'}));
   if(rr.status===429){ topeEn=i; break; }
 }
 o.tope={ saltoEn:topeEn, enviadosDeMas:enviados.length-antes };

 // ── SI RESEND FALLA, se dice el motivo (sin la clave) ──
 respuesta={ok:false, status:403, cuerpo:{message:'Domain is not verified'}};
 // el tope ya saltó, así que se usa otra hora limpia
 const modb=await import(path.join(mod,'index.mjs'));
 modb.__c['ixcorreo']={};
 r=await handler(pet('POST',{asunto:'Hola',texto:'Qué tal'}));
 o.fallo={ status:r.status, cuerpo:JSON.parse(await r.text()) };

 global.fetch=fetchReal;
 fs.rmSync(tmp,{recursive:true,force:true});

 const pruebas=[
  ['sin nada configurado: lo dice',   o.sinNada.status===503 && o.sinNada.cuerpo.error==='sin-configurar', JSON.stringify(o.sinNada.cuerpo)],
  ['y dice QUÉ falta',                o.sinNada.cuerpo.falta.length===2, o.sinNada.cuerpo.falta.join(',')],
  ['con la clave pero sin destino, también', o.sinDestino.status===503 && o.sinDestino.cuerpo.falta[0]==='CORREO_DESTINO', JSON.stringify(o.sinDestino.cuerpo.falta)],
  ['configurado: el correo sale',     o.normal.status===200 && o.normal.cuerpo.ok===true, JSON.stringify(o.normal.cuerpo)],
  ['va a Resend',                     /api\.resend\.com\/emails$/.test(o.normal.enviado.url), o.normal.enviado.url],
  ['con el asunto y el texto',        o.normal.enviado.body.subject==='Alarma: Trabajo' && /7:30/.test(o.normal.enviado.body.text), o.normal.enviado.body.subject],
  ['y al destino de la VARIABLE',     JSON.stringify(o.normal.enviado.body.to)==='["'+DESTINO+'"]', JSON.stringify(o.normal.enviado.body.to)],
  ['NO se puede colar otro destinatario', o.colar.every(x=>x.to==='["'+DESTINO+'"]'), o.colar.map(x=>x.to).join(' ')],
  ['ni cambiar el remitente',         o.colar.every(x=>/onboarding@resend\.dev/.test(x.from)), o.colar[3].from],
  ['LA CLAVE no sale en las respuestas', o.claveFiltrada===false, 'filtrada='+o.claveFiltrada],
  ['pero sí viaja en la cabecera',    o.claveEnCabecera===true, o.claveEnCabecera],
  ['el HTML del correo va escapado',  o.escapado.crudo===false && o.escapado.escapado===true, JSON.stringify({c:o.escapado.crudo,e:o.escapado.escapado})],
  ['y el texto plano queda tal cual', o.escapado.textoPlanoIntacto===true, o.escapado.textoPlanoIntacto],
  ['sin asunto: rechazado',           o.sinAsunto===400, o.sinAsunto],
  ['sin texto: rechazado',            o.sinTexto===400,  o.sinTexto],
  ['sin nada: rechazado',             o.sinNada2===400,  o.sinNada2],
  ['GET no vale',                     o.get===405,       o.get],
  ['OPTIONS responde',                o.options===204,   o.options],
  ['se recorta lo larguísimo',        o.recorte.asunto===120 && o.recorte.texto===4000, JSON.stringify(o.recorte)],
  ['HAY TOPE por hora',               o.tope.saltoEn>=0 && o.tope.saltoEn<25, 'saltó en el '+o.tope.saltoEn],
  ['si Resend falla, se dice el motivo', o.fallo.status===502 && /not verified/i.test(o.fallo.cuerpo.motivo||''), JSON.stringify(o.fallo.cuerpo)],
  ['y ese mensaje tampoco lleva la clave', JSON.stringify(o.fallo).indexOf(CLAVE)<0, 'ok'],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
