// IXBand: traer una sección de otra canción (idea 34).
//
// Con canciones guardadas como las guarda la app (Mis canciones) y la
// pantalla de verdad (botón 📋 de la barra de secciones). Se comprueba:
//  · la hoja lista tus otras canciones con sus secciones y cuántas pistas
//    tiene cada una; la canción abierta no sale; una sección vacía no se puede
//    elegir;
//  · elegir «Estribillo» lo añade al final con su nombre y sus pistas, y lo
//    deja abierto;
//  · con un id de sección NUEVO (no pisa las secciones que ya había);
//  · es una copia: cambiarla no toca la canción de origen;
//  · queda guardado;
//  · sin otras canciones, explica cómo tener alguna.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9298);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1300,height:1000}, locale:'es-ES'});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.addInitScript(()=>{ try{
   const nota=(f,at)=>({at:at||0,freq:f,type:'piano',vel:1});
   localStorage.setItem('ixband_canciones_v1', JSON.stringify([
     {id:'c1', nombre:'Pop', fecha:1, datos:{bpm:110, secciones:[{id:'s1',nombre:'Estrofa'},{id:'s2',nombre:'Estribillo'},{id:'s3',nombre:'Vacía'}],
       takes:[{name:'piano',sec:'s1',events:[nota(440)]},{name:'piano',sec:'s2',events:[nota(523),nota(587,300)]},{name:'bass',sec:'s2',events:[nota(110)]}]}},
     {id:'c2', nombre:'Mi canción', fecha:1, datos:{bpm:120, secSeq:2, secciones:[{id:'s1',nombre:'A'},{id:'s2',nombre:'B'}],
       takes:[{name:'piano',sec:'s1',events:[nota(330)]},{name:'piano',sec:'s2',events:[nota(349)]}]}},
   ]));
   localStorage.removeItem('ixband_cancion_v1');
 }catch(e){} });
 await p.goto('http://localhost:9298/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof openGarageBand==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 const o={};
 o.falta=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   try{ ixCerrarBienvenida(); }catch(e){}
   openGarageBand(); await w(500);
   if(typeof gbSecTraer!=='function') return true;
   gbAbrirCancion('c2'); await w(300);
   return false;
 });
 if(!o.falta){
   await p.click('#gb-sec-bar button[aria-label="Traer una sección de otra canción"]');
   await p.waitForTimeout(300);
   o.hoja=await p.evaluate(()=>{
     const ov=document.getElementById('gb-traer');
     return { texto:ov?ov.innerText.replace(/\s+/g,' '):'', botones:[].slice.call(document.querySelectorAll('#gb-traer .gb-traer-sec')).map(x=>x.textContent.replace(/\s+/g,' ').trim()+(x.disabled?' [off]':'')) };
   });
   await p.evaluate(()=>{ [].slice.call(document.querySelectorAll('#gb-traer .gb-traer-sec')).find(x=>/Estribillo/.test(x.textContent)).click(); });
   await p.waitForTimeout(900);
   o.tras=await p.evaluate(()=>{
     const act=_gbSecActiva;
     const tomas=_gbTomasDe(act).map(x=>x.t);
     const r={ secciones:_gbSecciones.map(x=>x.id+':'+x.nombre), activa:act, tomas:tomas.map(t=>t.name+':'+t.events.map(e=>Math.round(e.freq)).join('/')),
               hojaCerrada:!document.getElementById('gb-traer'), estado:(document.getElementById('gb-status')||{}).textContent,
               viejas:_gbTomasDe('s1').length+_gbTomasDe('s2').length };
     // Es una copia: cambiarla no toca la de origen
     tomas[0].events[0].freq=999;
     const origen=JSON.parse(localStorage.getItem('ixband_canciones_v1')).find(c=>c.id==='c1');
     r.origen=origen.datos.takes[1].events[0].freq;
     const guardada=JSON.parse(localStorage.getItem('ixband_cancion_v1')||'{}');
     r.guardada=(guardada.secciones||[]).map(x=>x.nombre).join(',');
     return r;
   });
   // Sin otras canciones
   o.vacia=await p.evaluate(async()=>{
     localStorage.setItem('ixband_canciones_v1', JSON.stringify([]));
     gbSecTraer();
     const v=document.querySelector('#gb-traer .gb-traer-vacio');
     return v ? v.textContent : '';
   });
 }
 await b.close(); srv.close();

 const h=o.hoja||{}, t=o.tras||{};
 const pruebas=[
  ['existe',                                         !o.falta, !o.falta],
  ['la hoja lista la otra canción y sus secciones',  /Pop/.test(h.texto||'') && JSON.stringify(h.botones)==='["Estrofa 1","Estribillo 2","Vacía 0 [off]"]', JSON.stringify(h.botones)],
  ['la canción abierta no sale',                     !/Mi canción/.test(h.texto||''), h.texto],
  ['añade «Estribillo» al final y lo abre',          (t.secciones||[]).length===3 && /:Estribillo$/.test(t.secciones[2]) && t.activa===t.secciones[2].split(':')[0], JSON.stringify(t.secciones)+' '+t.activa],
  ['con un id nuevo (no pisa s1/s2)',                !!t.activa && t.activa!=='s1' && t.activa!=='s2' && t.viejas===2, t.activa+' viejas:'+t.viejas],
  ['con sus dos pistas y notas',                     JSON.stringify(t.tomas)==='["piano:523/587","bass:110"]', JSON.stringify(t.tomas)],
  ['cierra la hoja y lo dice',                       t.hojaCerrada && /Estribillo» traída de «Pop» con 2 pista/.test(t.estado||''), t.estado],
  ['es una copia: el origen no cambia',              t.origen===523, t.origen],
  ['queda guardado',                                 t.guardada==='A,B,Estribillo', t.guardada],
  ['sin otras canciones lo explica',                 /Guardar en Mis canciones/.test(o.vacia||''), o.vacia],
  ['sin errores de página',                          errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
