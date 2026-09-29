// De nota a alarma de un toque (idea 83).
//
// En el editor de una nota, ⏰ abre la hoja de alarma de siempre con la
// primera línea como etiqueta y, si la nota trae una hora, esa hora ya
// puesta. Se prueba con el editor de verdad:
//  · «- [ ] Llamar al médico a las 18:30» → etiqueta sin la casilla, 18:30;
//  · guardar la hoja crea la alarma de verdad;
//  · una nota sin hora abre la hoja con la etiqueta y la hora de siempre;
//  · las horas se reconocen escritas de varias formas (7.30, 9h05) y una
//    imposible (25:00) no se toma por hora.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9289);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1300,height:1000}, locale:'es-ES'});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9289/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof notesOpen==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(async()=>{
   try{ ixCerrarBienvenida(); }catch(e){}
   notes.push({id:'n1', content:'- [ ] Llamar al médico a las 18:30\nLlevar la tarjeta', updatedAt:Date.now()});
   notes.push({id:'n2', content:'Comprar pan\nY leche', updatedAt:Date.now()});
   await saveNotes();
   if(!notesPanelOpen) toggleNotesPanel();
   notesOpen('n1');
 });
 await p.waitForTimeout(300);
 const hoja=()=>p.evaluate(()=>{ const s=document.getElementById('ica-alarm-sheet'); if(!s) return null;
   return { etiqueta:document.getElementById('ica-alarm-label').value, h:document.getElementById('ica-alarm-h').value, m:document.getElementById('ica-alarm-m').value }; });
 const o={};
 await p.click('#notes-alarma-btn',{timeout:3000}).catch(()=>{});
 await p.waitForTimeout(200);
 o.conHora=await hoja();
 o.guardada=await p.evaluate(()=>{ if(!document.getElementById('ica-alarm-sheet')) return null; const n=_icaAlarms.length; icaGuardarAlarma(); return { nuevas:_icaAlarms.length-n, ultima:_icaAlarms[_icaAlarms.length-1] }; });
 await p.evaluate(()=>notesOpen('n2'));
 await p.waitForTimeout(200);
 await p.click('#notes-alarma-btn',{timeout:3000}).catch(()=>{});
 await p.waitForTimeout(200);
 o.sinHora=await hoja();
 o.horas=await p.evaluate(()=> typeof notasHoraEn==='function' ? ['a las 7.30','quedamos 9h05','a las 25:00','nada'].map(t=>notasHoraEn(t)) : null);
 await b.close(); srv.close();

 const pruebas=[
  ['⏰ abre la hoja de alarma',                     !!o.conHora, JSON.stringify(o.conHora)],
  ['con la primera línea de etiqueta (sin la casilla)', !!o.conHora && o.conHora.etiqueta==='Llamar al médico a las 18:30', o.conHora&&o.conHora.etiqueta],
  ['y la hora de la nota ya puesta (18:30)',          !!o.conHora && o.conHora.h==='18' && o.conHora.m==='30', o.conHora&&(o.conHora.h+':'+o.conHora.m)],
  ['guardar crea la alarma de verdad',                !!o.guardada && o.guardada.nuevas===1 && o.guardada.ultima.time==='18:30' && /médico/.test(o.guardada.ultima.label), JSON.stringify(o.guardada)],
  ['sin hora: etiqueta y la hora de siempre',         !!o.sinHora && o.sinHora.etiqueta==='Comprar pan' && o.sinHora.h==='07' && o.sinHora.m==='00', JSON.stringify(o.sinHora)],
  ['reconoce 7.30 y 9h05, y no 25:00',                JSON.stringify(o.horas)===JSON.stringify([{h:7,m:30},{h:9,m:5},null,null]), JSON.stringify(o.horas)],
  ['sin errores de página',                           errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
