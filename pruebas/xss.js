// Comprueba que el texto que escribe el usuario (o que llega de fuera) no
// puede ejecutar codigo al pintarse. Cada caso hace DOS cosas: mete el codigo
// y comprueba que no se ejecuta, y ademas comprueba que el texto si se ve,
// para que no se pueda pasar la prueba simplemente no pintando nada.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9204);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1100,height:850}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9204/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2600);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
   return !l || getComputedStyle(l).display==='none'; }, null, {timeout:20000}).catch(()=>{});
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const r=await p.evaluate(async()=>{
   const w=ms=>new Promise(r=>setTimeout(r,ms)); const o={};
   openGarageBand(); await w(500);          // hace falta para las pantallas de IXBand
   const PAYLOAD='<img src=x onerror="window.__pwn=(window.__pwn||0)+1">';
   window.__pwn=0;

   // --- 0. la prueba sirve: el mismo texto SIN escapar si ejecuta ---
   const cobaya=document.createElement('div');
   cobaya.innerHTML=PAYLOAD; document.body.appendChild(cobaya);
   await w(350);
   o.laPruebaDetecta = window.__pwn>0;      // si esto falla, la prueba no vale
   cobaya.remove(); window.__pwn=0;

   // --- 1. eventos del calendario ---
   calEvts['2026-8-15']=['cumpleaños '+PAYLOAD];
   renderCalEvts('2026-8-15'); await w(400);
   o.calendarioNoEjecuta = window.__pwn===0;
   o.calendarioSeVe = /cumpleaños/.test((document.getElementById('cal-events-list')||{}).innerText||'');
   o.calendarioEscapado = /&lt;img/.test((document.getElementById('cal-events-list')||{}).innerHTML||'');
   delete calEvts['2026-8-15']; window.__pwn=0;

   // --- 2. alerta de terremoto (el sitio lo manda un servidor de fuera) ---
   if(typeof showEarthquakeAlert==='function'){
     showEarthquakeAlert(6.2, 'cerca de Lima '+PAYLOAD, 3);
     await w(400);
     const el=document.getElementById('quake-alert');
     o.quakeNoEjecuta = window.__pwn===0;
     o.quakeSeVe = !!el && /cerca de Lima/.test(el.innerText||'');
     if(el) el.remove();
   } else { o.quakeNoEjecuta='sin función'; o.quakeSeVe='sin función'; }
   window.__pwn=0;

   // --- 3. los que ya estaban arreglados siguen arreglados ---
   notes.length=0;
   notes.push({id:'n1',content:'mi nota '+PAYLOAD,updatedAt:Date.now()});
   renderNotesList(); await w(300);
   o.notasNoEjecuta = window.__pwn===0;
   notes.length=0; window.__pwn=0;

   _gbSecciones=[{id:'s1',nombre:'Coro '+PAYLOAD}]; _gbSecActiva='s1'; _gbTakes=[];
   gbRenderTracks(); await w(300);
   o.seccionesNoEjecuta = window.__pwn===0;
   _gbSecciones=[{id:'s1',nombre:'A'}]; window.__pwn=0;

   gbCargarLista();
   _gbCanciones=[{id:'c1',nombre:'Tema '+PAYLOAD,fecha:1,datos:{takes:[],secciones:[{id:'s1',nombre:'A'}]}}];
   gbBuildSongs(); await w(300);
   o.cancionesNoEjecuta = window.__pwn===0;
   _gbCanciones=[]; window.__pwn=0;

   // --- 3b. notas matematicas de la Calculadora (lo reporto el usuario) ---
   // Aqui el titulo se corta a 25 caracteres, asi que hace falta un payload
   // CORTO: con el largo la etiqueta quedaba partida y no se ejecutaba, y la
   // prueba pasaba aunque el fallo estuviera ahi.
   window.__p=()=>{ window.__pwn=(window.__pwn||0)+1; };
   const CORTO='<img src=x onerror=__p()>';       // 25 caracteres justos
   localStorage.setItem('math_notes', JSON.stringify([
     {text:CORTO, date:'hoy'}
   ]));
   mathRenderSaved(); await w(400);
   o.mathNoEjecuta = window.__pwn===0;
   o.mathSeVe = /img src=x/.test((document.getElementById('math-saved-list')||{}).innerText||'');
   localStorage.removeItem('math_notes'); window.__pwn=0;

   // --- 3c. historial de alarmas: la etiqueta la escribe el usuario ---
   localStorage.setItem('ica_alarm_history', JSON.stringify([
     {time:'07:30', label:'despertar '+PAYLOAD, date:'1/1/2026'}
   ]));
   icaRenderHistory(); await w(400);
   o.histNoEjecuta = window.__pwn===0;
   o.histSeVe = /despertar/.test((document.getElementById('ica-alarm-history')||{}).innerText||'');
   localStorage.removeItem('ica_alarm_history'); window.__pwn=0;

   // --- 4. el buscador global, que junta texto de muchos sitios ---
   notes.push({id:'n2',content:'buscable '+PAYLOAD,updatedAt:Date.now()});
   ixAbrirBusqueda(); ixPintarBusqueda('buscable'); await w(400);
   o.buscadorNoEjecuta = window.__pwn===0;
   o.buscadorSeVe = /buscable/.test((document.getElementById('ix-busq-res')||{}).innerText||'');
   ixCerrarBusqueda(); notes.length=0; window.__pwn=0;
   return o;
 });

 const pruebas=[
  ['la prueba de verdad detecta',   r.laPruebaDetecta===true,      r.laPruebaDetecta],
  ['CALENDARIO no ejecuta código',  r.calendarioNoEjecuta===true,  r.calendarioNoEjecuta],
  ['y el evento sí se ve',          r.calendarioSeVe===true,       r.calendarioSeVe],
  ['y sale escapado',               r.calendarioEscapado===true,   r.calendarioEscapado],
  ['TERREMOTO no ejecuta código',   r.quakeNoEjecuta===true,       r.quakeNoEjecuta],
  ['y el sitio sí se ve',           r.quakeSeVe===true,            r.quakeSeVe],
  ['notas siguen a salvo',          r.notasNoEjecuta===true,       r.notasNoEjecuta],
  ['secciones siguen a salvo',      r.seccionesNoEjecuta===true,   r.seccionesNoEjecuta],
  ['canciones siguen a salvo',      r.cancionesNoEjecuta===true,   r.cancionesNoEjecuta],
  ['NOTAS MAT. no ejecutan',       r.mathNoEjecuta===true,        r.mathNoEjecuta],
  ['y la nota sí se ve',           r.mathSeVe===true,             r.mathSeVe],
  ['HISTORIAL no ejecuta',         r.histNoEjecuta===true,        r.histNoEjecuta],
  ['y la etiqueta sí se ve',       r.histSeVe===true,             r.histSeVe],
  ['buscador sigue a salvo',        r.buscadorNoEjecuta===true,    r.buscadorNoEjecuta],
  ['y el buscador sí muestra',      r.buscadorSeVe===true,         r.buscadorSeVe],
  ['sin errores de página',         errs.length===0,               errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
