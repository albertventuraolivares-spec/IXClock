// Notas con casillas (idea 47).
//
// Las casillas viven DENTRO del texto («- [ ] pan», «- [x] leche») en vez de en
// un sitio aparte. La prueba lo comprueba mirando lo que queda GUARDADO, no lo
// que se pinta: si la casilla se marcara solo en pantalla, al recargar o al
// sincronizar con el iPad se perdería.
//
// Se teclea de verdad con el teclado de Playwright, porque lo delicado es el
// Intro: tiene que continuar la lista, y en una casilla vacía cerrarla, sin
// romper el Intro normal fuera de las listas.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9260);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1200,height:1000}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9260/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof notasCasillas==='function' && typeof notesOpen==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const o={};
 // Si la casilla no llega a existir, se apunta y se sigue: una prueba que
 // revienta en el primer clic no dice QUÉ falló.
 const tocar = async(n)=>{ try{ await p.click('#notes-casillas button[role=checkbox] >> nth='+n,{timeout:3000}); }catch(e){} };
 const guardada = ()=>p.evaluate(()=>{
   const arr=JSON.parse(localStorage.getItem('notes')||'[]');
   const n=arr.find(x=>x.id===currentNoteId);
   return n?n.content:null;
 });

 // Nota nueva con un texto normal y se abre el editor
 await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   notes.unshift({id:'n-prueba', content:'La compra', updatedAt:Date.now()});
   await saveNotes();
   if(!notesPanelOpen) toggleNotesPanel();
   await w(400);
   notesOpen('n-prueba'); await w(300);
 });

 // ═══ EL BOTÓN ☑ CONVIERTE LA LÍNEA ═══
 // cursor al final, Intro normal (fuera de lista), escribir «pan», botón ☑
 await p.click('#notes-textarea');
 await p.keyboard.press('End');
 await p.keyboard.press('Control+End');
 await p.keyboard.press('Enter');
 o.introNormal = await guardada();
 await p.keyboard.type('pan');
 await p.click('#notes-lista-btn');
 await p.waitForTimeout(200);
 o.trasBoton = await guardada();

 // ═══ INTRO EN UNA CASILLA CREA LA SIGUIENTE ═══
 await p.keyboard.press('Enter');
 await p.keyboard.type('leche');
 await p.keyboard.press('Enter');
 await p.keyboard.type('huevos');
 await p.waitForTimeout(200);
 o.lista = await guardada();

 // ═══ INTRO EN UNA CASILLA VACÍA CIERRA LA LISTA ═══
 await p.keyboard.press('Enter');     // crea «- [ ] » vacía
 await p.keyboard.press('Enter');     // en vacía: la quita y sale
 await p.keyboard.type('fin');
 await p.waitForTimeout(200);
 o.cerrada = await guardada();

 // ═══ LA TIRA DE CASILLAS SE PINTA ═══
 o.tira = await p.evaluate(()=>{
   const c=document.getElementById('notes-casillas');
   const bs=[].slice.call(c.querySelectorAll('button[role=checkbox]'));
   return { visible:!c.classList.contains('hidden'), n:bs.length,
            textos:bs.map(x=>x.innerText.trim()), cabecera:(c.innerText.split('\n')[0]||'').trim(),
            marcadas:bs.filter(x=>x.getAttribute('aria-checked')==='true').length };
 });

 // ═══ TOCAR UNA CASILLA LA MARCA EN EL TEXTO GUARDADO ═══
 await tocar(1);   // «leche»
 await p.waitForTimeout(300);
 o.marcada = await guardada();
 o.tiraTrasMarcar = await p.evaluate(()=>{
   const c=document.getElementById('notes-casillas');
   return { cab:(c.innerText.split('\n')[0]||'').trim(),
            aria:[].slice.call(c.querySelectorAll('button[role=checkbox]')).map(x=>x.getAttribute('aria-checked')) };
 });
 // y otra vez la desmarca
 await tocar(1);
 await p.waitForTimeout(300);
 o.desmarcada = await guardada();
 await tocar(1);   // la dejamos marcada
 await p.waitForTimeout(300);

 // ═══ EL BOTÓN ☑ SOBRE UNA CASILLA LA DEVUELVE A TEXTO ═══
 o.quitar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const ta=document.getElementById('notes-textarea');
   const i=ta.value.indexOf('huevos');
   ta.setSelectionRange(i+2,i+2);
   notasCasilla(); await w(200);
   return ta.value;
 });

 // ═══ EN LA LISTA DE NOTAS SALE EL PROGRESO ═══
 o.progresoLista = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   notesShowList(); await w(400);
   const row=[].slice.call(document.querySelectorAll('.note-row')).find(r=>/La compra/.test(r.innerText));
   return row?row.innerText.replace(/\s+/g,' '):null;
 });

 // ═══ UNA CASILLA CON CÓDIGO NO SE EJECUTA ═══
 o.xss = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__casXss=false;
   notes.unshift({id:'n-xss', content:'- [ ] <img src=x onerror="window.__casXss=true">', updatedAt:Date.now()});
   await saveNotes();
   notesOpen('n-xss'); await w(400);
   const html=document.getElementById('notes-casillas').innerHTML;
   return { colado:window.__casXss===true, crudo:/<img src=x/i.test(html), escapado:/&lt;img/i.test(html) };
 });

 // ═══ EN MODO DIBUJO LA TIRA SE ESCONDE ═══
 o.dibujo = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   notesSetMode('draw'); await w(200);
   const oculta=document.getElementById('notes-casillas').classList.contains('hidden');
   notesSetMode('text'); await w(200);
   const vuelve=!document.getElementById('notes-casillas').classList.contains('hidden');
   return { oculta, vuelve };
 });

 // ═══ UNA NOTA SIN CASILLAS NO ENSEÑA NADA ═══
 o.sinCasillas = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   notes.unshift({id:'n-lisa', content:'Solo texto\nsin listas', updatedAt:Date.now()});
   await saveNotes();
   notesOpen('n-lisa'); await w(300);
   return { oculta:document.getElementById('notes-casillas').classList.contains('hidden'),
            progreso:notasProgreso('Solo texto\nsin listas') };
 });

 await p.close(); await b.close(); srv.close();

 const pruebas=[
  ['Intro normal fuera de lista sigue igual',  o.introNormal==='La compra\n', JSON.stringify(o.introNormal)],
  ['el botón ☑ convierte la línea',            o.trasBoton==='La compra\n- [ ] pan', JSON.stringify(o.trasBoton)],
  ['Intro en casilla crea la siguiente',       o.lista==='La compra\n- [ ] pan\n- [ ] leche\n- [ ] huevos', JSON.stringify(o.lista)],
  ['Intro en casilla vacía cierra la lista',   o.cerrada==='La compra\n- [ ] pan\n- [ ] leche\n- [ ] huevos\nfin', JSON.stringify(o.cerrada)],
  ['se pintan las 3 casillas',                 o.tira.visible===true && o.tira.n===3, JSON.stringify(o.tira)],
  ['con su texto',                             o.tira.textos.join('|').indexOf('pan')>=0 && o.tira.textos.join('|').indexOf('huevos')>=0, o.tira.textos.join('|')],
  ['y el recuento «0 de 3»',                   /0 de 3/i.test(o.tira.cabecera), o.tira.cabecera],
  ['TOCAR marca la casilla EN EL TEXTO GUARDADO', /- \[x\] leche/.test(o.marcada||'') && /- \[ \] pan/.test(o.marcada||''), JSON.stringify(o.marcada)],
  ['y cambia solo esa línea',                  (o.marcada||'').replace('[x] leche','[ ] leche')===o.cerrada, 'ok'],
  ['la pantalla lo refleja',                   /1 de 3/i.test(o.tiraTrasMarcar.cab) && o.tiraTrasMarcar.aria[1]==='true', JSON.stringify(o.tiraTrasMarcar)],
  ['tocar otra vez la desmarca',               o.desmarcada===o.cerrada, JSON.stringify(o.desmarcada)],
  ['☑ sobre una casilla la vuelve texto',      /\nhuevos\n/.test(o.quitar) && !/\[ \] huevos/.test(o.quitar), JSON.stringify(o.quitar)],
  ['la lista de notas enseña el progreso',     /☑ 1\/2/.test(o.progresoLista||''), o.progresoLista],
  ['y el resumen sin marcas crudas',           !/\[ \]|\[x\]/.test(o.progresoLista||'') && /☐ pan/.test(o.progresoLista||'') && /✓ leche/.test(o.progresoLista||''), o.progresoLista],
  ['SEGURIDAD: una casilla con código no se ejecuta', o.xss.colado===false, 'colado='+o.xss.colado],
  ['y sale escapada',                          o.xss.crudo===false && o.xss.escapado===true, JSON.stringify(o.xss)],
  ['en modo dibujo la tira se esconde',        o.dibujo.oculta===true && o.dibujo.vuelve===true, JSON.stringify(o.dibujo)],
  ['nota sin casillas: no enseña nada',        o.sinCasillas.oculta===true && o.sinCasillas.progreso===null, JSON.stringify(o.sinCasillas)],
  ['sin errores de página',                    errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})();
