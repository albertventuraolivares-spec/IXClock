// Borrar la copia de la nube (idea 78).
//
// La política de privacidad promete que la copia del servidor se puede
// borrar. Antes, la única forma era mandarnos el código por correo: justo lo
// que la pantalla pide no hacer. Aquí se comprueba el botón de punta a punta:
//  · SERVIDOR (la función real con un doble del almacén): DELETE con el
//    código borra ESA caja, y solo esa; un código inválido no toca nada.
//  · APP: pregunta antes; si dices que no, no se manda nada; si dices que sí,
//    manda el DELETE, deja de sincronizar este aparato y NO borra las notas
//    de aquí; y si el servidor falla, no finge que se borró.
const fs=require('fs'), path=require('path'), os=require('os'), http=require('http'), crypto=require('crypto');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';

// ── Doble de @netlify/blobs, como en pruebas/nube.js ──
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ixnubeb-'));
const mod=path.join(tmp,'node_modules','@netlify','blobs');
fs.mkdirSync(mod,{recursive:true});
fs.writeFileSync(path.join(mod,'package.json'), JSON.stringify({name:'@netlify/blobs',version:'0.0.0-doble',type:'module',main:'index.mjs'}));
fs.writeFileSync(path.join(mod,'index.mjs'), `
export const __cajas = {};
export function getStore(nombre){
  __cajas[nombre] = __cajas[nombre] || {};
  return {
    async get(k){ const v=__cajas[nombre][k]; return v===undefined?null:v; },
    async setJSON(k,v){ __cajas[nombre][k]=v; },
    async delete(k){ delete __cajas[nombre][k]; },
  };
}`);
fs.copyFileSync(ROOT+'/netlify/functions/nube.mjs', path.join(tmp,'nube.mjs'));

const COD='ABCD-EFGH-JKMN-PQRS-TUVW', OTRO='2345-6789-ABCD-EFGH-JKMN';
const sha=c=>crypto.createHash('sha256').update('ixclock-nube-v1:'+c).digest('hex');
const pet=(m,cuerpo,qs)=>new Request('http://x/.netlify/functions/nube'+(qs||''),{method:m, headers:{'content-type':'application/json'}, body:cuerpo?JSON.stringify(cuerpo):undefined});

(async()=>{
 const o={};
 const nube=(await import(path.join(tmp,'nube.mjs'))).default;
 const blobs=await import(path.join(mod,'index.mjs'));
 // ═══ SERVIDOR ═══
 await nube(pet('POST',{codigo:COD,datos:{notes:'[1]'}}));
 await nube(pet('POST',{codigo:OTRO,datos:{notes:'[2]'}}));
 const caja=()=>blobs.__cajas.ixnube||{};
 o.antes=Object.keys(caja()).length;
 const rMal=await nube(pet('DELETE',null,'?codigo=corto'));
 o.mal={status:rMal.status, quedan:Object.keys(caja()).length};
 const rOk=await nube(pet('DELETE',null,'?codigo='+encodeURIComponent(COD)));
 o.ok={status:rOk.status, cuerpo:await rOk.json(), sigueLaMia:sha(COD) in caja(), sigueLaOtra:sha(OTRO) in caja()};
 const rGet=await nube(pet('GET',null,'?codigo='+encodeURIComponent(COD)));
 o.trasBorrar=await rGet.json();
 const rOpt=await nube(pet('OPTIONS'));
 o.cors=rOpt.headers.get('access-control-allow-methods')||'';

 // ═══ APP ═══
 let pedidos=[], respuesta={status:200,cuerpo:{ok:true}};
 const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json'};
 const srv=http.createServer((q,s)=>{
   const u=new URL(q.url,'http://localhost');
   if(u.pathname==='/.netlify/functions/nube'){
     pedidos.push({m:q.method, codigo:u.searchParams.get('codigo')});
     s.writeHead(respuesta.status,{'content-type':'application/json'}); return s.end(JSON.stringify(respuesta.cuerpo));
   }
   let f=decodeURIComponent(u.pathname); if(f==='/')f='/index.html';
   const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
   s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); s.end(fs.readFileSync(p));
 }).listen(9267);
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 let decir=false, preguntas=[];
 p.on('dialog',d=>{ preguntas.push(d.message()); decir?d.accept():d.dismiss(); });
 await p.goto('http://localhost:9267/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixNubePintar==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 await p.evaluate((COD)=>{ localStorage.setItem('notes','[{"id":"n1","content":"mi nota"}]'); ixNubePonerCodigo(COD); }, COD);
 pedidos=[];
 const estado=()=>p.evaluate(()=>({ codigo:ixNubeCodigo(), notas:localStorage.getItem('notes'),
   boton:!!document.querySelector('#ix-nube button[onclick="ixNubeBorrarServidor()"]') }));

 o.conCodigo=await estado();
 // «No»
 decir=false;
 o.cancelar=await p.evaluate(()=>ixNubeBorrarServidor());
 o.trasCancelar={ estado:await estado(), pedidos:pedidos.slice() };
 // Servidor que falla
 decir=true; respuesta={status:500,cuerpo:{error:'x'}}; pedidos=[];
 o.fallo=await p.evaluate(()=>ixNubeBorrarServidor());
 o.trasFallo=await estado();
 // «Sí» y todo bien
 respuesta={status:200,cuerpo:{ok:true}}; pedidos=[];
 o.si=await p.evaluate(()=>ixNubeBorrarServidor());
 o.trasSi={ estado:await estado(), pedidos:pedidos.slice() };
 await b.close(); srv.close();
 fs.rmSync(tmp,{recursive:true,force:true});

 const pruebas=[
  ['SERVIDOR: código inválido no borra nada', o.mal.status===400 && o.mal.quedan===o.antes && o.antes===2, JSON.stringify(o.mal)],
  ['DELETE con el código responde ok',        o.ok.status===200 && o.ok.cuerpo.ok===true, JSON.stringify(o.ok.cuerpo)],
  ['borra ESA caja',                          o.ok.sigueLaMia===false, o.ok.sigueLaMia],
  ['y NO la de otro código',                  o.ok.sigueLaOtra===true, o.ok.sigueLaOtra],
  ['después, leerla sale vacía',              o.trasBorrar.ok===true && o.trasBorrar.vacia===true, JSON.stringify(o.trasBorrar)],
  ['el navegador puede mandar DELETE (CORS)', /DELETE/.test(o.cors), o.cors],
  ['APP: el botón sale con la nube activa',   o.conCodigo.boton===true, JSON.stringify(o.conCodigo)],
  ['pregunta antes de borrar',                preguntas.length>=1 && /Borrar tu copia del servidor/.test(preguntas[0]), preguntas[0]],
  ['si dices que no, no manda nada',          o.cancelar.ok===false && o.trasCancelar.pedidos.length===0 && o.trasCancelar.estado.codigo===COD, JSON.stringify(o.trasCancelar)],
  ['si el servidor falla, NO finge',          o.fallo.ok===false && o.trasFallo.codigo===COD, JSON.stringify(o.fallo)],
  ['si dices que sí, manda DELETE con el código', o.trasSi.pedidos.length===1 && o.trasSi.pedidos[0].m==='DELETE' && o.trasSi.pedidos[0].codigo===COD, JSON.stringify(o.trasSi.pedidos)],
  ['y deja de sincronizar este aparato',      o.si.ok===true && o.trasSi.estado.codigo==='', JSON.stringify(o.trasSi.estado)],
  ['sin tocar las notas de aquí',             /mi nota/.test(o.trasSi.estado.notas||''), o.trasSi.estado.notas],
  ['sin errores de página',                   errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
