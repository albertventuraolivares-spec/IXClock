// Organizar las notas: carpetas y fijar arriba.
//
// Hasta ahora lo unico que habia era el buscador, y para buscar tienes que
// saber de antemano lo que buscas. Esto es para lo contrario: encontrar sin
// buscar.
//
// Las carpetas NO se guardan en una lista aparte, son los nombres que llevan
// las notas. Lo que se prueba aqui es justo eso: que no queden carpetas
// fantasma ni notas metidas en una carpeta que ya no existe.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9237);

async function arranca(ctx){
  const p=await ctx.newPage();
  p.on('pageerror',e=>{ p._errs=p._errs||[]; p._errs.push(e.message.split('\n')[0]); });
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:9237/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof notasCarpetas==='function' && typeof renderNotesList==='function',
    null,{timeout:30000}).catch(()=>{});
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
  try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
  await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
    return !l || getComputedStyle(l).display==='none'; },null,{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(1800);
  await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
  await p.evaluate(()=>{ try{ if(!notesPanelOpen) toggleNotesPanel(); }catch(e){} });
  await p.waitForTimeout(500);
  return p;
}
// Deja tres notas conocidas y devuelve sus ids.
const sembrar = p => p.evaluate(async()=>{
  const w=m=>new Promise(r=>setTimeout(r,m));
  notes.length=0;
  const t=Date.now();
  notes.push({id:'n1', content:'Lista de la compra\npan y leche', updatedAt:t-30000});
  notes.push({id:'n2', content:'Ideas para el verano\nplaya', updatedAt:t-20000});
  notes.push({id:'n3', content:'Contraseña del wifi\n1234', updatedAt:t-10000});
  await saveNotes();
  notesShowList(); await w(300);
  return notes.map(n=>n.id);
});

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1280,height:1000}});
 let p=await arranca(ctx);
 const o={};
 await sembrar(p);

 // --- sin carpetas, la fila de chips NO estorba ---
 o.sinCarpetas = await p.evaluate(()=>({
   oculta: getComputedStyle(document.getElementById('notes-carpetas')).display==='none',
   carpetas: notasCarpetas().length
 }));

 // --- FIJAR sube la nota, sin tocar la fecha ---
 o.fijar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const antes=[].slice.call(document.querySelectorAll('#notes-list .note-title')).map(e=>e.innerText);
   const fecha=notes.find(n=>n.id==='n1').updatedAt;
   notesOpen('n1'); await w(300);
   notasFijarActual(); await w(200);
   notesShowList(); await w(300);
   const filas=[].slice.call(document.querySelectorAll('#notes-list .note-title')).map(e=>e.innerText);
   return { antes: antes[0], primera: filas[0], conChincheta:/📌/.test(filas[0]||''),
            noTocaLaFecha: notes.find(n=>n.id==='n1').updatedAt===fecha,
            guardado: !!notes.find(n=>n.id==='n1').fijada,
            hayCabecera: /fijadas/i.test(document.getElementById('notes-list').innerText) };
 });

 // --- y desfijar la devuelve a su sitio ---
 o.desfijar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   notesOpen('n1'); await w(300);
   notasFijarActual(); await w(200);
   notesShowList(); await w(300);
   const filas=[].slice.call(document.querySelectorAll('#notes-list .note-title')).map(e=>e.innerText);
   return { primera: filas[0], sinChincheta: !/📌/.test(filas.join(' ')),
            sinCabecera: !/fijadas/i.test(document.getElementById('notes-list').innerText) };
 });

 // --- CARPETAS: crear una desde la hoja ---
 o.carpeta = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   notesOpen('n1'); await w(300);
   notasHojaCarpeta(); await w(300);
   const hayHoja=!!document.getElementById('notas-hoja-carpeta');
   document.getElementById('notas-carpeta-nueva').value='Casa';
   notasCrearCarpeta(); await w(300);
   const seCerro=!document.getElementById('notas-hoja-carpeta');
   const botonLoDice=/Casa/.test(document.getElementById('notes-carpeta-btn').innerText);
   notesShowList(); await w(400);
   return { hayHoja, seCerro, botonLoDice,
            guardada: notes.find(n=>n.id==='n1').carpeta,
            chipsVisibles: getComputedStyle(document.getElementById('notes-carpetas')).display!=='none',
            chips: document.getElementById('notes-carpetas').innerText.replace(/\s+/g,' ').trim() };
 });

 // --- filtrar por carpeta enseña solo las suyas ---
 o.filtrar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   notesOpen('n2'); await w(250); notasMover('Casa'); await w(200);
   notesShowList(); await w(300);
   notasIrCarpeta('Casa'); await w(300);
   const enCasa=document.querySelectorAll('#notes-list .note-row').length;
   notasIrCarpeta(NOTAS_SIN); await w(300);
   const sueltas=document.querySelectorAll('#notes-list .note-row').length;
   const textoSueltas=document.getElementById('notes-list').innerText;
   notasIrCarpeta(null); await w(300);
   const todas=document.querySelectorAll('#notes-list .note-row').length;
   return { enCasa, sueltas, todas, soloLaTercera:/wifi/i.test(textoSueltas) && !/compra/i.test(textoSueltas) };
 });

 // --- buscar DENTRO de una carpeta ---
 o.buscarEnCarpeta = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   notasIrCarpeta('Casa'); await w(250);
   document.getElementById('notes-search').value='verano';
   notesFilterList(); await w(300);
   const unaSola=document.querySelectorAll('#notes-list .note-row').length;
   document.getElementById('notes-search').value='wifi';   // esa no esta en Casa
   notesFilterList(); await w(300);
   const ninguna=document.querySelectorAll('#notes-list .note-row').length;
   const dice=document.getElementById('notes-list').innerText;
   document.getElementById('notes-search').value='';
   notasIrCarpeta(null); notesFilterList(); await w(300);
   return { unaSola, ninguna, diceSinResultados:/sin resultados/i.test(dice) };
 });

 // --- una carpeta VACIA se dice, y no se confunde con «no hay notas» ---
 o.vacia = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   notesOpen('n3'); await w(250); notasMover('Trabajo'); await w(200);
   notesShowList(); await w(300);
   notasIrCarpeta('Trabajo'); await w(300);
   const una=document.querySelectorAll('#notes-list .note-row').length;
   // se saca de la carpeta: la carpeta desaparece y se vuelve a Todas sola
   notesOpen('n3'); await w(250); notasMover(''); await w(200);
   notesShowList(); await w(400);
   return { una, carpetasAhora: notasCarpetas(),
            volvioATodas: _notasCarpeta===null,
            filas: document.querySelectorAll('#notes-list .note-row').length };
 });

 // --- borrar la ultima nota de una carpeta se lleva la carpeta ---
 o.borrar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   notesOpen('n1'); await w(250); notesDeleteCurrent(); await w(300);
   notesOpen('n2'); await w(250); notesDeleteCurrent(); await w(300);
   notesShowList(); await w(400);
   return { carpetas: notasCarpetas(),
            chipsOcultos: getComputedStyle(document.getElementById('notes-carpetas')).display==='none',
            quedan: notes.length };
 });

 // --- un nombre de carpeta con código no se ejecuta ---
 o.xss = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__pwn=0;
   notes.length=0;
   notes.push({id:'x1', content:'hola', updatedAt:Date.now(),
               carpeta:'<img src=x onerror="window.__pwn=1">'});
   await saveNotes();
   notesShowList(); await w(500);
   const enChips=window.__pwn;
   notesOpen('x1'); await w(300);
   notasHojaCarpeta(); await w(400);
   const enHoja=window.__pwn;
   // y el chip de la hoja tiene que seguir siendo pulsable, no roto
   const chip=document.querySelector('#notas-hoja-carpeta .notas-chip');
   const sigueSirviendo = !!chip && /onclick/i.test(chip.outerHTML);
   notasCerrarHojaCarpeta();
   notes.length=0; await saveNotes(); notesShowList(); await w(300);
   return { enChips, enHoja, sigueSirviendo };
 });

 // --- SOBREVIVE a recargar ---
 await p.evaluate(async()=>{
   notes.length=0;
   notes.push({id:'p1', content:'Fijada', updatedAt:Date.now()-9000, fijada:true, carpeta:'Casa'});
   notes.push({id:'p2', content:'Normal', updatedAt:Date.now()});
   await saveNotes();
 });
 await p.close();
 p = await arranca(ctx);
 o.trasRecargar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   notesShowList(); await w(400);
   const filas=[].slice.call(document.querySelectorAll('#notes-list .note-title')).map(e=>e.innerText);
   return { primera: filas[0]||'', carpetas: notasCarpetas(),
            chipsVisibles: getComputedStyle(document.getElementById('notes-carpetas')).display!=='none' };
 });
 const errs=p._errs||[];
 await p.close();

 const pruebas=[
  ['sin carpetas no hay chips',   o.sinCarpetas.oculta===true,      JSON.stringify(o.sinCarpetas)],
  ['FIJAR la sube arriba',        /compra/i.test(o.fijar.primera||''), o.fijar.antes+' → '+o.fijar.primera],
  ['con su chincheta',            o.fijar.conChincheta===true,      o.fijar.primera],
  ['y su cabecera de grupo',      o.fijar.hayCabecera===true,       o.fijar.hayCabecera],
  ['fijar NO cuenta como editar', o.fijar.noTocaLaFecha===true,     o.fijar.noTocaLaFecha],
  ['se guarda',                   o.fijar.guardado===true,          o.fijar.guardado],
  ['desfijar la devuelve',        o.desfijar.sinChincheta===true,   o.desfijar.primera],
  ['y quita la cabecera',         o.desfijar.sinCabecera===true,    o.desfijar.sinCabecera],
  ['CARPETA: se crea desde la hoja', o.carpeta.hayHoja===true && o.carpeta.guardada==='Casa', o.carpeta.guardada],
  ['la hoja se cierra al crearla',o.carpeta.seCerro===true,         o.carpeta.seCerro],
  ['el botón dice cuál es',       o.carpeta.botonLoDice===true,     o.carpeta.botonLoDice],
  ['y aparecen los chips',        o.carpeta.chipsVisibles===true,   o.carpeta.chips],
  ['filtrar enseña solo las suyas', o.filtrar.enCasa===2,           o.filtrar.enCasa+' en Casa'],
  ['«Sin carpeta» enseña el resto', o.filtrar.sueltas===1 && o.filtrar.soloLaTercera===true, o.filtrar.sueltas],
  ['«Todas» las enseña todas',    o.filtrar.todas===3,              o.filtrar.todas],
  ['buscar dentro de la carpeta', o.buscarEnCarpeta.unaSola===1,    o.buscarEnCarpeta.unaSola],
  ['y no se escapa a otras',      o.buscarEnCarpeta.ninguna===0 && o.buscarEnCarpeta.diceSinResultados===true, JSON.stringify(o.buscarEnCarpeta)],
  ['una carpeta con una nota',    o.vacia.una===1,                  o.vacia.una],
  ['al vaciarla desaparece',      o.vacia.carpetasAhora.indexOf('Trabajo')<0, o.vacia.carpetasAhora.join(',')],
  ['y se vuelve a Todas solo',    o.vacia.volvioATodas===true && o.vacia.filas===3, JSON.stringify({v:o.vacia.volvioATodas,f:o.vacia.filas})],
  ['borrar las notas se lleva la carpeta', o.borrar.carpetas.length===0, JSON.stringify(o.borrar)],
  ['y los chips se van',          o.borrar.chipsOcultos===true,     o.borrar.chipsOcultos],
  ['un nombre con código no se ejecuta', o.xss.enChips===0 && o.xss.enHoja===0, JSON.stringify(o.xss)],
  ['y el chip sigue sirviendo',   o.xss.sigueSirviendo===true,      o.xss.sigueSirviendo],
  ['SOBREVIVE a recargar',        /Fijada/.test(o.trasRecargar.primera) && o.trasRecargar.carpetas.indexOf('Casa')>=0 && o.trasRecargar.chipsVisibles===true, JSON.stringify(o.trasRecargar)],
  ['sin errores de página',       errs.length===0,                  errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
