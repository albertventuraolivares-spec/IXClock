// Barrido profundo: no solo abre cada app, PULSA sus botones uno a uno y
// apunta cualquier error de JavaScript. Abrir una pantalla casi nunca falla;
// lo que falla es lo que hay dentro.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9211);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
   args:['--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
 const p=await ctx.newPage();
 const fallos=[];
 let zona='arranque';
 p.on('pageerror',e=>fallos.push([zona, e.message.split('\n')[0].slice(0,140)]));
 p.on('console',m=>{ if(m.type()==='error'){ const t=m.text();
   if(!/net::|Failed to load resource|ERR_|status of 4|status of 5/.test(t)) fallos.push([zona,'consola: '+t.slice(0,130)]); }});
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9211/',{waitUntil:'domcontentloaded'});
 await p.waitForTimeout(2600);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2200);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 // Se pulsa llamando al onclick, no con el raton: asi no importa que algo
 // quede tapado por otra capa y se prueban TODOS los botones de la pantalla.
 const pulsarTodos = (raiz, saltar) => p.evaluate(async(args)=>{
   const [sel, saltarTxt] = args;
   const w=ms=>new Promise(r=>setTimeout(r,ms));
   const cont=document.querySelector(sel);
   if(!cont) return {pulsados:0, nota:'no existe '+sel};
   const botones=[].slice.call(cont.querySelectorAll('button,[role=button],[onclick]'));
   let n=0; const nombres=[];
   for(const el of botones){
     const t=((el.textContent||'')+' '+(el.title||'')+' '+(el.id||'')).trim().toLowerCase();
     if(saltarTxt.some(s=>t.includes(s))) continue;
     const r=el.getBoundingClientRect();
     if(r.width===0 && r.height===0) continue;
     try{ el.click(); }catch(e){ /* lo recoge el listener de pageerror */ }
     n++; nombres.push(t.slice(0,22));
     await w(45);
     if(n>=45) break;
   }
   return {pulsados:n, nombres:nombres};
 }, [raiz, saltar]);

 const APPS=[
   ['Reloj',        'toggleIOSClockApp', '#ios-clock-app',      ['cerrar','✕','borrar','delete']],
   ['IXBand',       'openGarageBand',    '#garageband-modal',   ['✕','cerrar','empezar de cero','exportar','borrar']],
   ['Calculadora',  'toggleCalcPanel',  '#calc-panel',         ['✕','cerrar']],
   ['Notas',        'toggleNotesPanel',  '#notes-panel',        ['✕','cerrar','borrar']],
   ['Mapas',        'openAppleMaps',     '#apple-maps-modal',   ['✕','cerrar']],
   ['Navegador',    'openBrowser',       '#browser-modal',      ['✕','cerrar']],
   ['Juegos',       'toggleGamesPanel',  '#games-panel',        ['✕','cerrar']],
   ['Brújula',      'openCompass',       '#compass-modal',      ['✕','cerrar']],
   ['Mi Nube',      'openCloudPanel',    '#cloud-modal',        ['✕','cerrar','borrar']],
   ['IXBench',      'openBenchmark',     '#bench-modal',        ['✕','cerrar','iniciar','empezar']],
   ['Traductor',    'toggleTranslator',  '#translator-panel',   ['✕','cerrar']],
   ['TV',           'toggleTVPanel',          '#tv-panel',           ['✕','cerrar']],
   ['Configuración','toggleSidebar',     '#left-sidebar',       ['✕','cerrar','borrar','descargar','instalar','restablecer','reiniciar']],
 ];

 for(const [nombre, abrir, sel, saltar] of APPS){
   zona=nombre;
   const antes=fallos.length;
   const abierta=await p.evaluate(async(fn)=>{
     const w=ms=>new Promise(r=>setTimeout(r,ms));
     const f=window[fn];
     if(typeof f!=='function') return 'no existe '+fn;
     try{ f(); }catch(e){ return 'al abrir: '+e.message; }
     await w(800); return true;
   }, abrir);
   if(abierta!==true){ fallos.push([nombre, String(abierta)]); continue; }
   const res=await pulsarTodos(sel, saltar);
   await p.waitForTimeout(400);
   console.log(nombre.padEnd(14)+' botones pulsados: '+String(res.pulsados).padStart(3)
     +(fallos.length>antes ? '   ← '+(fallos.length-antes)+' FALLO(S)' : ''));
   await p.evaluate(()=>{ try{ ixCerrarTodasLasVentanas(); }catch(e){}
     try{ if(typeof isSidebarVisible!=='undefined' && isSidebarVisible) toggleSidebar(); }catch(e){} });
   await p.waitForTimeout(400);
 }

 // Las cuatro pestañas del reloj (mundial, alarmas, cronometro, timers)
 for(const v of ['world','alarms','stopwatch','timer']){
   zona='Reloj·'+v;
   const antes=fallos.length;
   await p.evaluate(async(vista)=>{
     const w=ms=>new Promise(r=>setTimeout(r,ms));
     document.getElementById('ios-clock-app').classList.add('open');
     try{ icaSwitchTab(vista); }catch(e){}
     await w(600);
   }, v);
   const res=await pulsarTodos('#ica-view-'+v, ['borrar','eliminar','✕']);
   console.log(('Reloj·'+v).padEnd(14)+' botones pulsados: '+String(res.pulsados).padStart(3)
     +(fallos.length>antes ? '   ← '+(fallos.length-antes)+' FALLO(S)' : ''));
 }
 await p.evaluate(()=>{ try{ ixCerrarTodasLasVentanas(); }catch(e){} });
 await p.waitForTimeout(400);

 // Las cuatro pestañas de Configuración, una a una
 for(const t of ['wallpapers','clocks','more','manual']){
   zona='Config·'+t;
   const antes=fallos.length;
   await p.evaluate(async(tab)=>{
     const w=ms=>new Promise(r=>setTimeout(r,ms));
     try{ if(!isSidebarVisible) toggleSidebar(); showTab(tab); }catch(e){}
     await w(700);
   }, t);
   const res=await pulsarTodos('#tab-'+t, ['borrar','descargar','instalar','restablecer','reiniciar','idioma']);
   console.log(('Config·'+t).padEnd(14)+' botones pulsados: '+String(res.pulsados).padStart(3)
     +(fallos.length>antes ? '   ← '+(fallos.length-antes)+' FALLO(S)' : ''));
 }
 await p.evaluate(()=>{ try{ if(isSidebarVisible) toggleSidebar(); }catch(e){} });

 console.log('\n===== RESULTADO =====');
 if(!fallos.length) console.log('Sin errores al pulsar nada.');
 else {
   const vistos=new Set();
   fallos.forEach(([z,m])=>{ const k=z+'|'+m; if(vistos.has(k)) return; vistos.add(k); console.log('· ['+z+'] '+m); });
   console.log('\ntotal (sin repetir): '+vistos.size+'  ·  brutos: '+fallos.length);
 }
 await b.close(); srv.close();
})();
