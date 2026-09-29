// Notas de voz (idea 56).
//
// Chromium con micrófono de prueba (--use-fake-device-for-media-stream): se
// graba de verdad con el botón 🎙️ de una nota y se comprueba:
//  · mientras graba, el botón lo dice y cuenta el tiempo;
//  · al parar, la nota guarda la grabación y se puede escuchar (un <audio>
//    con un archivo de verdad, no vacío);
//  · el audio va a IndexedDB, NO a localStorage (que se llenaría);
//  · la lista de notas lo marca (🎙️ 1) y una nota solo de voz se llama
//    «Nota de voz», no «Nota nueva»;
//  · abrir otra nota no enseña los audios de la anterior;
//  · si el audio no está en este aparato (vino sincronizado), lo dice;
//  · ✕ lo borra de la nota Y del almacenamiento; borrar la nota, también;
//  · sin permiso de micrófono avisa en vez de quedarse colgado.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9295);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
   args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const ctx=await b.newContext({viewport:{width:1300,height:1000}, locale:'es-ES', permissions:['microphone']});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9295/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof notesOpen==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 const o={};
 o.falta=await p.evaluate(async()=>{
   try{ ixCerrarBienvenida(); }catch(e){}
   if(typeof notasVozToggle!=='function') return true;
   window.__toasts=[]; const t=window.ixToast; window.ixToast=function(m){ window.__toasts.push(m); try{ return t.apply(this,arguments); }catch(e){} };
   notes.length=0;
   notes.push({id:'n1', content:'', updatedAt:Date.now()});
   notes.push({id:'n2', content:'Lista de la compra', updatedAt:Date.now()-1000});
   await saveNotes();
   if(!notesPanelOpen) toggleNotesPanel();
   notesOpen('n1');
   return false;
 });
 if(!o.falta){
   await p.click('#notes-voz-btn');
   await p.waitForTimeout(2300);
   o.grabando=await p.evaluate(()=>{ const b=document.getElementById('notes-voz-btn'); return { txt:b.textContent, aria:b.getAttribute('aria-label') }; });
   await p.click('#notes-voz-btn');
   await p.waitForFunction(()=>{ const n=notes.find(x=>x.id==='n1'); return n && n.audios && n.audios.length; },null,{timeout:8000}).catch(()=>{});
   await p.waitForTimeout(600);
   o.guardada=await p.evaluate(async()=>{
     const n=notes.find(x=>x.id==='n1');
     const a=(n&&n.audios||[])[0]||null;
     const au=document.querySelector('#notes-audios audio');
     let tam=0; if(au){ try{ tam=(await (await fetch(au.src)).blob()).size; }catch(e){} }
     const enDB=a ? await notasVozLeer(a.id) : null;
     let ls=0; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); ls=Math.max(ls, (localStorage.getItem(k)||'').length); }
     const guardadas=await window.storage.get('notes', false);
     return { a, audio:!!au, tam, enDB:enDB?enDB.size:0, visible:!document.getElementById('notes-audios').classList.contains('hidden'),
              btn:document.getElementById('notes-voz-btn').textContent, toasts:window.__toasts.slice(),
              notasTxt:(guardadas&&guardadas.value||'').length, persistida:/"audios"/.test(guardadas&&guardadas.value||'') };
   });
   o.lista=await p.evaluate(async()=>{
     const w=m=>new Promise(r=>setTimeout(r,m));
     notesShowList(); await w(200);
     const filas=[].slice.call(document.querySelectorAll('.note-row')).map(x=>x.innerText.replace(/\s+/g,' '));
     notesOpen('n2'); await w(400);
     const otra={ oculta:document.getElementById('notes-audios').classList.contains('hidden'), audios:document.querySelectorAll('#notes-audios audio').length };
     notesOpen('n1'); await w(400);
     const vuelve=document.querySelectorAll('#notes-audios audio').length;
     return { filas, otra, vuelve };
   });
   // Un audio que vino sincronizado de otro aparato (no está en este)
   o.fuera=await p.evaluate(async()=>{
     const w=m=>new Promise(r=>setTimeout(r,m));
     const n=notes.find(x=>x.id==='n2'); n.audios=[{id:'no-esta', dur:12, fecha:Date.now()}];
     notesOpen('n2'); await w(400);
     const f=document.querySelector('#notes-audios .nota-voz-fuera');
     return f ? f.textContent : '';
   });
   // ✕ borra de la nota y del almacenamiento
   o.quitar=await p.evaluate(async()=>{
     const w=m=>new Promise(r=>setTimeout(r,m));
     notesOpen('n1'); await w(400);
     const id=notes.find(x=>x.id==='n1').audios[0].id;
     document.querySelector('#notes-audios .nota-voz button').click(); await w(500);
     return { quedan:(notes.find(x=>x.id==='n1').audios||[]).length, enDB:!!(await notasVozLeer(id)), oculta:document.getElementById('notes-audios').classList.contains('hidden') };
   });
   // Borrar la nota se lleva sus audios
   await p.click('#notes-voz-btn'); await p.waitForTimeout(1300); await p.click('#notes-voz-btn');
   await p.waitForFunction(()=>{ const n=notes.find(x=>x.id==='n1'); return n && n.audios && n.audios.length; },null,{timeout:8000}).catch(()=>{});
   o.borrarNota=await p.evaluate(async()=>{
     const w=m=>new Promise(r=>setTimeout(r,m));
     const n=notes.find(x=>x.id==='n1'); const id=n&&n.audios&&n.audios[0]&&n.audios[0].id;
     const antes=id ? !!(await notasVozLeer(id)) : false;
     notesOpen('n1'); notesDeleteCurrent(); await w(500);
     return { antes, despues:id ? !!(await notasVozLeer(id)) : true };
   });
   // Sin permiso
   o.sinPermiso=await p.evaluate(async()=>{
     const w=m=>new Promise(r=>setTimeout(r,m));
     navigator.mediaDevices.getUserMedia=function(){ return Promise.reject(new DOMException('no','NotAllowedError')); };
     notesOpen('n2'); window.__toasts.length=0;
     await notasVozToggle(); await w(200);
     return { toasts:window.__toasts.slice(), btn:document.getElementById('notes-voz-btn').textContent };
   });
 }
 await b.close(); srv.close();

 const g=o.guardada||{}, l=o.lista||{};
 const pruebas=[
  ['existe',                                          !o.falta, !o.falta],
  ['grabando, el botón lo dice y cuenta',             !!o.grabando && /^⏹ 0:0[12]$/.test(o.grabando.txt) && /Parar/.test(o.grabando.aria), JSON.stringify(o.grabando)],
  ['al parar, la nota guarda la grabación',           !!g.a && g.a.dur>=2 && g.a.dur<=3 && g.persistida, JSON.stringify(g.a)+' '+g.persistida],
  ['y se puede escuchar (archivo de verdad)',         g.audio && g.visible && g.tam>500, g.tam+' bytes'],
  ['el audio va a IndexedDB',                         g.enDB>500, g.enDB],
  ['y NO a localStorage',                             g.notasTxt<2000, 'notas: '+g.notasTxt+' car.'],
  ['avisa y el botón vuelve a 🎙️',                   g.btn==='🎙️' && (g.toasts||[]).some(t=>/Nota de voz guardada \(0:0[23]\)/.test(t)), g.btn+' '+JSON.stringify(g.toasts)],
  ['la lista la marca y la llama «Nota de voz»',      (l.filas||[]).some(f=>/^Nota de voz/.test(f) && /🎙️ 1/.test(f)), JSON.stringify(l.filas)],
  ['otra nota no enseña esos audios',                 !!l.otra && l.otra.oculta && l.otra.audios===0 && l.vuelve===1, JSON.stringify(l)],
  ['audio de otro aparato: lo dice',                  /dispositivo donde se grabó/.test(o.fuera||''), o.fuera],
  ['✕ lo quita de la nota y del almacenamiento',      !!o.quitar && o.quitar.quedan===0 && !o.quitar.enDB && o.quitar.oculta, JSON.stringify(o.quitar)],
  ['borrar la nota se lleva sus audios',              !!o.borrarNota && o.borrarNota.antes && !o.borrarNota.despues, JSON.stringify(o.borrarNota)],
  ['sin permiso de micrófono avisa',                  !!o.sinPermiso && o.sinPermiso.toasts.some(t=>/permiso/.test(t)) && o.sinPermiso.btn==='🎙️', JSON.stringify(o.sinPermiso)],
  ['sin errores de página',                           errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
