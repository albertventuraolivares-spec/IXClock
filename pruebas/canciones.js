const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9195);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9195/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2400);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
   return !l || getComputedStyle(l).display==='none'; }, null, {timeout:20000}).catch(()=>{});
 await p.waitForTimeout(1900);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const r=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms)); const o={};
   openGarageBand(); await wait(400);
   localStorage.removeItem('ixband_canciones_v1');
   gbBorrarCancionGuardada(); gbCargarLista(); await wait(200);
   const toma=(n,f)=>({name:n,sec:_gbSecActiva,muted:false,solo:false,vol:1,pan:0,
     events:[{at:0,freq:f,type:'piano',vel:1},{at:800,freq:f+50,type:'piano',vel:1}]});

   // --- sin nada grabado no deja guardar ---
   gbGuardarComo();
   o.noGuardaVacio = _gbCanciones.length===0
     && /No hay nada que guardar/.test(document.getElementById('gb-status').textContent);

   // --- canción 1 ---
   _gbTakes.push(toma('piano',440)); _gbBpm=100;
   gbGuardarComo(); await wait(150);
   o.guardaUna = _gbCanciones.length===1;
   o.quedaAbierta = _gbCancionActual===_gbCanciones[0].id;
   const id1=_gbCanciones[0].id;

   // --- lo guardado es una COPIA, no la misma lista ---
   _gbTakes[0].events[0].freq=111;
   o.copiaProfunda = _gbCanciones[0].datos.takes[0].events[0].freq===440;

   // --- mientras está abierta, los cambios se escriben en ella ---
   _gbTakes.push(toma('drums',200));
   _gbGuardarPronto(); await wait(1000);
   gbCargarLista();
   o.sincroniza = _gbCanciones.find(x=>x.id===id1).datos.takes.length===2;

   // --- canción 2, independiente ---
   gbBorrarCancionGuardada(); await wait(150);
   o.ceroSaleDeLaCancion = _gbCancionActual===null;
   o.ceroNoBorraLaLista = (gbCargarLista(), _gbCanciones.length===1);
   _gbTakes.push(toma('bass',80)); _gbBpm=150;
   gbGuardarComo(); await wait(150);
   o.dosCanciones = _gbCanciones.length===2;
   o.laNuevaVaPrimero = _gbCanciones[0].datos.takes.length===1;
   const id2=_gbCancionActual;

   // --- abrir la primera trae SU estado, no el de ahora ---
   gbAbrirCancion(id1); await wait(250);
   o.abreLaSuya = _gbTakes.length===2 && _gbBpm===100;
   o.cambiaLaActual = _gbCancionActual===id1;
   o.vaAPistas = getComputedStyle(document.getElementById('gb-tracks')).display!=='none';
   o.avisaCual = /abierta/.test(document.getElementById('gb-status').textContent);
   // y la otra sigue intacta
   gbCargarLista();
   o.laOtraIntacta = _gbCanciones.find(x=>x.id===id2).datos.bpm===150;

   // --- duplicar ---
   gbDuplicarCancion(id1); await wait(150);
   gbCargarLista();
   o.duplica = _gbCanciones.length===3;
   o.copiaSeLlamaAsi = _gbCanciones.some(x=>/\(copia\)$/.test(x.nombre));
   const copia=_gbCanciones.find(x=>/\(copia\)$/.test(x.nombre));
   copia.datos.takes[0].events[0].freq=999;
   o.copiaIndependiente = _gbCanciones.find(x=>x.id===id1).datos.takes[0].events[0].freq!==999;

   // --- se pintan en Mis canciones ---
   gbView('songs'); gbBuildSongs(); await wait(200);
   const html=document.getElementById('gb-songs').innerHTML;
   o.pintaSeccion = /TUS CANCIONES/.test(html);
   o.pintaTarjetas = (html.match(/gb-cancion-n-/g)||[]).length===3;
   o.marcaLaAbierta = /outline:3px solid #30d158/.test(html);
   o.siguenLasPlantillas = /Biblioteca de sonidos/.test(html);

   // --- renombrar sin ventanitas ---
   let usoPrompt=false; const op=window.prompt; window.prompt=()=>{usoPrompt=true;return null;};
   gbRenombrarCancion(id1); await wait(120);
   const inp=document.getElementById('gb-cancion-inp');
   o.saleCampo=!!inp;
   if(inp){ inp.value='Mi tema bueno'; inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); }
   await wait(200);
   window.prompt=op;
   o.sinPrompt = usoPrompt===false;
   gbCargarLista();
   o.renombrada = _gbCanciones.find(x=>x.id===id1).nombre==='Mi tema bueno';
   o.nombrePintado = /Mi tema bueno/.test(document.getElementById('gb-songs').innerHTML);

   // --- un nombre con código no lo ejecuta ---
   let ejecuto=false; window.__cancXSS=()=>{ejecuto=true;};
   _gbCanciones[0].nombre='<img src=x onerror="window.__cancXSS()">';
   gbGuardarLista(); gbBuildSongs(); await wait(300);
   o.nombreEscapado = ejecuto===false;
   _gbCanciones[0].nombre='X'; gbGuardarLista();

   // --- borrar ---
   gbBorrarCancion(id2); await wait(150);
   gbCargarLista();
   o.borra = _gbCanciones.length===2 && !_gbCanciones.some(x=>x.id===id2);
   // borrar la abierta deja de escribir en ella
   _gbCancionActual=id1;
   gbBorrarCancion(id1); await wait(150);
   o.borrarLaAbiertaLimpia = _gbCancionActual===null;

   // --- una lista corrupta no rompe ---
   localStorage.setItem('ixband_canciones_v1','{no es json');
   o.corruptoNoRompe = Array.isArray(gbCargarLista()) && _gbCanciones.length===0;
   gbBuildSongs(); await wait(150);
   o.pintaSinTuyas = !/TUS CANCIONES/.test(document.getElementById('gb-songs').innerHTML)
                  && /Biblioteca de sonidos/.test(document.getElementById('gb-songs').innerHTML);

   // --- no se pasa del tope ---
   const ev=[]; for(let i=0;i<130000;i++) ev.push({at:i,freq:440,type:'piano',vel:1});
   _gbCanciones=[{id:'x',nombre:'gigante',fecha:1,datos:{bpm:120,compas:4,secciones:[{id:'s1',nombre:'A'}],secActiva:'s1',secSeq:1,takes:[{name:'p',sec:'s1',muted:false,solo:false,vol:1,pan:0,events:ev}]}}];
   o.rechazaGigante = gbGuardarLista()===false;
   o.avisaDelGigante = /No cabe/.test(document.getElementById('gb-status').textContent);
   return o;
 });

 const pruebas=[
  ['sin nada no deja guardar',      r.noGuardaVacio===true,       r.noGuardaVacio],
  ['guarda la primera',             r.guardaUna===true,           r.guardaUna],
  ['y queda abierta',               r.quedaAbierta===true,        r.quedaAbierta],
  ['lo guardado es una COPIA',      r.copiaProfunda===true,       r.copiaProfunda],
  ['los cambios entran en ella',    r.sincroniza===true,          r.sincroniza],
  ['empezar de cero la suelta',     r.ceroSaleDeLaCancion===true, r.ceroSaleDeLaCancion],
  ['y NO borra Mis canciones',      r.ceroNoBorraLaLista===true,  r.ceroNoBorraLaLista],
  ['guarda una segunda',            r.dosCanciones===true,        r.dosCanciones],
  ['la nueva va la primera',        r.laNuevaVaPrimero===true,    r.laNuevaVaPrimero],
  ['abrir trae SU estado',          r.abreLaSuya===true,          r.abreLaSuya],
  ['cambia la canción actual',      r.cambiaLaActual===true,      r.cambiaLaActual],
  ['y te lleva a Pistas',           r.vaAPistas===true,           r.vaAPistas],
  ['dice cuál abrió',               r.avisaCual===true,           r.avisaCual],
  ['la otra queda intacta',         r.laOtraIntacta===true,       r.laOtraIntacta],
  ['duplicar crea otra',            r.duplica===true,             r.duplica],
  ['la copia se llama (copia)',     r.copiaSeLlamaAsi===true,     r.copiaSeLlamaAsi],
  ['la copia es independiente',     r.copiaIndependiente===true,  r.copiaIndependiente],
  ['sale «TUS CANCIONES»',          r.pintaSeccion===true,        r.pintaSeccion],
  ['pinta las tres tarjetas',       r.pintaTarjetas===true,       r.pintaTarjetas],
  ['marca la que está abierta',     r.marcaLaAbierta===true,      r.marcaLaAbierta],
  ['siguen las plantillas',         r.siguenLasPlantillas===true, r.siguenLasPlantillas],
  ['renombrar saca un campo',       r.saleCampo===true,           r.saleCampo],
  ['sin ventanitas del navegador',  r.sinPrompt===true,           r.sinPrompt],
  ['guarda el nombre nuevo',        r.renombrada===true,          r.renombrada],
  ['y se ve en pantalla',           r.nombrePintado===true,       r.nombrePintado],
  ['el nombre no ejecuta código',   r.nombreEscapado===true,      r.nombreEscapado],
  ['borrar quita la canción',       r.borra===true,               r.borra],
  ['borrar la abierta la suelta',   r.borrarLaAbiertaLimpia===true, r.borrarLaAbiertaLimpia],
  ['una lista rota no rompe',       r.corruptoNoRompe===true,     r.corruptoNoRompe],
  ['y la pantalla sigue bien',      r.pintaSinTuyas===true,       r.pintaSinTuyas],
  ['no se pasa del tope',           r.rechazaGigante===true,      r.rechazaGigante],
  ['y avisa de por qué',            r.avisaDelGigante===true,     r.avisaDelGigante],
  ['sin errores de página',         errs.length===0,              errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
