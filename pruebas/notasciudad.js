// Notas de una ciudad del reloj mundial (idea 24).
//
// «Qué llevar a Tokio»: el botón 📝 de cada ciudad abre sus notas (una
// carpeta «📍 Tokio» normal de Notas) o empieza la primera. Se comprueba con
// la pantalla de verdad:
//  · sin notas, el botón no lleva número y al tocarlo crea UNA nota en esa
//    carpeta, empezada con «Para Tokio:», y la abre para escribir;
//  · después el botón cuenta cuántas hay;
//  · con notas, tocarlo abre la lista SOLO con las de esa ciudad (las demás
//    notas siguen ahí, pero no se mezclan);
//  · la carpeta sale entre las carpetas de Notas como cualquier otra.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9288);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1300,height:1000}, locale:'es-ES'});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9288/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof icaRenderWorldClocks==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 const o=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   try{ ixCerrarBienvenida(); }catch(e){}
   if(typeof ixAbrirNotasCiudad!=='function') return {falta:true};
   const r={};
   notes.length=0; notes.push({id:'otra', content:'Lista de la compra', updatedAt:Date.now()}); await saveNotes();
   _icaWorldClocks=['Asia/Tokyo']; icaRenderWorldClocks(); await w(100);
   const boton=()=>document.querySelector('#ica-world-list .ica-notas');
   r.antes=boton().textContent.trim();
   boton().click(); await w(400);
   const n=notes.find(x=>x.carpeta==='📍 Tokio');
   r.creada={ cuantas:notes.filter(x=>x.carpeta==='📍 Tokio').length, contenido:n&&n.content, abierta:currentNoteId===(n&&n.id), panel:notesPanelOpen,
              texto:(document.getElementById('notes-textarea')||{}).value };
   // Escribe algo más y vuelve al reloj
   n.content+='- Adaptador de enchufe'; await saveNotes();
   notes.push({id:'t2', content:'Restaurantes en Tokio', carpeta:'📍 Tokio', updatedAt:Date.now()}); await saveNotes();
   try{ toggleNotesPanel(); }catch(e){}
   icaRenderWorldClocks(); await w(100);
   r.despues=boton().textContent.trim();
   // Con notas: abre la lista filtrada
   boton().click(); await w(400);
   r.lista=[].slice.call(document.querySelectorAll('.note-row')).map(x=>x.innerText.replace(/\s+/g,' '));
   r.chips=[].slice.call(document.querySelectorAll('#notes-carpetas .notas-chip')).map(x=>x.textContent.trim());
   r.otraSigue=!!notes.find(x=>x.id==='otra');
   return r;
 });
 await b.close(); srv.close();

 const pruebas=[
  ['existe',                                     !o.falta, !o.falta],
  ['sin notas, el botón no lleva número',        o.antes==='📝', o.antes],
  ['tocarlo crea UNA nota en «📍 Tokio»',        !!o.creada && o.creada.cuantas===1, JSON.stringify(o.creada)],
  ['empezada con «Para Tokio:»',                 !!o.creada && /^Para Tokio:\n/.test(o.creada.contenido||''), JSON.stringify(o.creada&&o.creada.contenido)],
  ['y la abre para escribir',                    !!o.creada && o.creada.abierta && o.creada.panel && /Para Tokio/.test(o.creada.texto||''), JSON.stringify(o.creada)],
  ['luego el botón cuenta cuántas hay (2)',      o.despues==='📝 2', o.despues],
  ['con notas, abre SOLO las de Tokio',          !!o.lista && o.lista.length===2 && o.lista.every(t=>/Tokio/.test(t)), JSON.stringify(o.lista)],
  ['las demás notas siguen ahí',                 o.otraSigue===true, o.otraSigue],
  ['la carpeta sale entre las de Notas',         !!o.chips && o.chips.some(c=>/^📍 Tokio \(2\)$/.test(c)), JSON.stringify(o.chips)],
  ['sin errores de página',                      errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
