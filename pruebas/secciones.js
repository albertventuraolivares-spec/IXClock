const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9188);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9188/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2400);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
   return !l || getComputedStyle(l).display==='none'; }, null, {timeout:20000}).catch(()=>{});
 await p.waitForTimeout(1800);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const r=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms)); const o={};
   openGarageBand(); await wait(400);
   // Una toma de prueba, sin depender de grabar en tiempo real.
   const toma=(nom,dur)=>({name:nom,sec:_gbSecActiva,muted:false,solo:false,vol:1,pan:0,
     events:[{at:0,freq:440,type:'piano',vel:1},{at:dur,freq:494,type:'piano',vel:1}]});
   _gbTakes=[]; _gbSecciones=[{id:'s1',nombre:'A'}]; _gbSecActiva='s1'; _gbSecSeq=1;
   gbView('tracks'); gbRenderTracks(); await wait(150);

   // --- 1. arranca con una sección y la barra existe ---
   o.barraExiste = !!document.getElementById('gb-sec-bar');
   o.unaSeccion  = _gbSecciones.length===1;
   o.vacioDiceSeccion = /Sección vacía/.test(document.getElementById('gb-tracks').innerHTML);

   // --- 2. las tomas caen en la sección activa ---
   _gbTakes.push(toma('piano',1000)); gbRenderTracks(); await wait(80);
   o.tomaEnA = _gbTomasDe('s1').length===1;
   o.pintaUnaPista = (document.getElementById('gb-tracks').innerHTML.match(/gb-track-hdr/g)||[]).length===1;

   // --- 3. crear una sección nueva: queda activa y VACÍA ---
   gbSecNueva(); await wait(80);
   o.dosSecciones = _gbSecciones.length===2;
   o.nombreB = _gbSecciones[1].nombre==='B';
   o.activaEsB = _gbSecActiva===_gbSecciones[1].id;
   o.bVacia = _gbTomasDe(_gbSecActiva).length===0;
   o.noPintaLaDeA = (document.getElementById('gb-tracks').innerHTML.match(/gb-track-hdr/g)||[]).length===0;

   // --- 4. la toma nueva va a B, no a A ---
   _gbTakes.push(toma('guitar',600)); gbRenderTracks(); await wait(80);
   o.aSigueCon1 = _gbTomasDe('s1').length===1;
   o.bTiene1   = _gbTomasDe(_gbSecActiva).length===1;

   // --- 5. cambiar de sección cambia lo que se ve ---
   gbSecIr('s1'); await wait(80);
   o.vuelveAA = _gbSecActiva==='s1';
   o.veLaDeA  = /piano/.test(document.getElementById('gb-tracks').innerHTML)
             && !/guitar/.test(document.getElementById('gb-tracks').innerHTML);

   // --- 6. duplicar: copia PROFUNDA, editar una no toca la otra ---
   gbSecDuplicar(); await wait(80);
   o.tresSecciones = _gbSecciones.length===3;
   o.copiaJustoDespues = _gbSecciones[1].id===_gbSecActiva;   // se inserta detrás de A
   const copia=_gbTomasDe(_gbSecActiva);
   o.copiaTieneLaPista = copia.length===1 && copia[0].t.name==='piano';
   const orig=_gbTomasDe('s1')[0];
   o.eventosNoCompartidos = copia[0].t.events !== orig.t.events;
   copia[0].t.events[0].freq = 100;
   o.editarCopiaNoTocaOrig = orig.t.events[0].freq===440;
   copia[0].t.vol=0.3;
   o.volumenIndependiente = orig.t.vol===1;

   // --- 7. reordenar ---
   const antes=_gbSecciones.map(x=>x.id).join(',');
   gbSecMover(-1); await wait(60);
   const despues=_gbSecciones.map(x=>x.id).join(',');
   o.seMovio = antes!==despues && _gbSecciones[0].id===_gbSecActiva;
   gbSecMover(-1); await wait(60);
   o.noSaleDelBorde = _gbSecciones[0].id===_gbSecActiva;   // ya estaba la primera
   gbSecMover(1); await wait(60);
   o.vuelveASuSitio = _gbSecciones.map(x=>x.id).join(',')===antes;

   // --- 8. renombrar sin ventanitas del navegador ---
   let usoPrompt=false; const op=window.prompt; window.prompt=()=>{usoPrompt=true;return null;};
   gbSecRenombrar(); await wait(80);
   const inp=document.getElementById('gb-sec-inp');
   o.saleCampo = !!inp;
   if(inp){ inp.value='Estribillo'; inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); }
   await wait(120);
   window.prompt=op;
   o.sinPrompt = usoPrompt===false;
   o.renombrada = _gbSecciones.some(x=>x.nombre==='Estribillo');
   o.nombrePintado = /Estribillo/.test(document.getElementById('gb-tracks').innerHTML);

   // --- 9. el nombre no puede meter codigo (XSS) ---
   let ejecuto=false; window.__secXSS=()=>{ejecuto=true;};
   _gbSecciones[0].nombre='<img src=x onerror="window.__secXSS()">';
   gbRenderTracks(); await wait(250);
   o.nombreEscapado = ejecuto===false;
   _gbSecciones[0].nombre='A';

   // --- 10. el solo NO cruza de sección ---
   gbSecIr('s1'); await wait(60);
   const tA=_gbTomasDe('s1')[0].t;
   const otraId=_gbSecciones.filter(x=>x.id!=='s1')[0].id;
   const tOtra=_gbTomasDe(otraId)[0].t;
   tA.solo=true;
   o.soloSuena = _gbPistaSuena(tA)===true;
   o.soloNoCallaOtraSeccion = _gbPistaSuena(tOtra)===true;
   const tA2=toma('bass',300); tA2.sec='s1'; _gbTakes.push(tA2);
   o.soloCallaLaDeSuSeccion = _gbPistaSuena(tA2)===false;
   tA.solo=false; _gbTakes.pop();

   // --- 11. toda la canción encadena, no amontona ---
   let progr=[]; const ost=window.setTimeout;
   window.setTimeout=function(f,ms){ if(typeof ms==='number') progr.push(ms); return ost.apply(window,arguments); };
   gbPlayCancion(); await wait(80);
   window.setTimeout=ost;
   o.programoNotas = progr.length>=4;
   o.hayDesplazamiento = Math.max.apply(null,progr) > 1000;   // la 2a seccion arranca despues
   o.estadoCancion = document.getElementById('gb-status').textContent;

   // --- 12. borrar una sección se lleva sus pistas, y nunca quedan cero ---
   const nTotal=_gbTakes.length, delId=_gbSecActiva, nEnEsa=_gbTomasDe(delId).length;
   gbSecBorrar(); await wait(80);
   o.borroSusPistas = _gbTakes.length===nTotal-nEnEsa && _gbSecIdx(delId)===-1;
   while(_gbSecciones.length>1) gbSecBorrar();
   gbSecBorrar(); await wait(60);
   o.nuncaCeroSecciones = _gbSecciones.length===1;
   o.avisaUltima = /al menos una sección/.test(document.getElementById('gb-status').textContent);

   // --- 12b. la regla de compases cuadra con las regiones ---
   // Se mide en pantalla, no se confia en el numero escrito en el codigo:
   // si alguien cambia el ancho de la cabecera o del mezclador, salta aqui.
   _gbTakes=[toma('piano',3000)]; _gbTakes[0].sec=_gbSecciones[0].id;
   gbRenderTracks(); await wait(150);
   const carril=document.querySelector('.gb-region').parentElement.getBoundingClientRect();
   const regla=document.querySelector('#gb-tracks div[style*="height:20px"][style*="margin-left"]');
   const rr=regla?regla.getBoundingClientRect():null;
   const ph=document.getElementById('gb-playhead').getBoundingClientRect();
   o.reglaAlineada  = rr ? Math.abs(rr.left-carril.left)<=1 : false;
   o.cabezalAlineado= Math.abs(ph.left-carril.left)<=1;
   o.desfaseRegla   = rr ? Math.round(rr.left-carril.left) : 'sin regla';

   // --- 13. tomas viejas sin sección caen en la primera ---
   _gbTakes=[{name:'antiguo',muted:false,solo:false,vol:1,pan:0,events:[{at:0,freq:440,type:'piano',vel:1}]}];
   gbRenderTracks(); await wait(80);
   o.tomaViejaVisible = _gbTomasDe(_gbSecciones[0].id).length===1
     && /antiguo/.test(document.getElementById('gb-tracks').innerHTML);
   return o;
 });

 const pruebas=[
  ['la barra de secciones existe',   r.barraExiste===true,      r.barraExiste],
  ['arranca con una sección',        r.unaSeccion===true,       r.unaSeccion],
  ['el vacío habla de la sección',   r.vacioDiceSeccion===true, r.vacioDiceSeccion],
  ['la toma cae en la activa',       r.tomaEnA===true,          r.tomaEnA],
  ['pinta solo esa pista',           r.pintaUnaPista===true,    r.pintaUnaPista],
  ['crear sección nueva',            r.dosSecciones===true,     r.dosSecciones],
  ['se llama B',                     r.nombreB===true,          r.nombreB],
  ['queda activa',                   r.activaEsB===true,        r.activaEsB],
  ['nace vacía',                     r.bVacia===true,           r.bVacia],
  ['no enseña las de A',             r.noPintaLaDeA===true,     r.noPintaLaDeA],
  ['A conserva la suya',             r.aSigueCon1===true,       r.aSigueCon1],
  ['la nueva toma va a B',           r.bTiene1===true,          r.bTiene1],
  ['volver a A',                     r.vuelveAA===true,         r.vuelveAA],
  ['ve solo lo de A',                r.veLaDeA===true,          r.veLaDeA],
  ['duplicar crea la tercera',       r.tresSecciones===true,    r.tresSecciones],
  ['la copia va justo detrás',       r.copiaJustoDespues===true,r.copiaJustoDespues],
  ['la copia trae la pista',         r.copiaTieneLaPista===true,r.copiaTieneLaPista],
  ['NO comparte los eventos',        r.eventosNoCompartidos===true, r.eventosNoCompartidos],
  ['editar la copia no toca el original', r.editarCopiaNoTocaOrig===true, r.editarCopiaNoTocaOrig],
  ['volumen independiente',          r.volumenIndependiente===true, r.volumenIndependiente],
  ['reordenar mueve la sección',     r.seMovio===true,          r.seMovio],
  ['no se sale por el borde',        r.noSaleDelBorde===true,   r.noSaleDelBorde],
  ['vuelve a su sitio',              r.vuelveASuSitio===true,   r.vuelveASuSitio],
  ['renombrar saca un campo',        r.saleCampo===true,        r.saleCampo],
  ['sin ventanitas del navegador',   r.sinPrompt===true,        r.sinPrompt],
  ['guarda el nombre nuevo',         r.renombrada===true,       r.renombrada],
  ['el nombre se ve en pantalla',    r.nombrePintado===true,    r.nombrePintado],
  ['el nombre no ejecuta código',    r.nombreEscapado===true,   r.nombreEscapado],
  ['el solo suena',                  r.soloSuena===true,        r.soloSuena],
  ['el solo NO calla otra sección',  r.soloNoCallaOtraSeccion===true, r.soloNoCallaOtraSeccion],
  ['el solo sí calla la suya',       r.soloCallaLaDeSuSeccion===true, r.soloCallaLaDeSuSeccion],
  ['la canción programa notas',      r.programoNotas===true,    r.programoNotas],
  ['las secciones van seguidas',     r.hayDesplazamiento===true,r.hayDesplazamiento],
  ['avisa de la canción entera',     /Canción entera/.test(r.estadoCancion||''), r.estadoCancion],
  ['borrar se lleva sus pistas',     r.borroSusPistas===true,   r.borroSusPistas],
  ['nunca quedan cero secciones',    r.nuncaCeroSecciones===true, r.nuncaCeroSecciones],
  ['avisa si es la última',          r.avisaUltima===true,      r.avisaUltima],
  ['la regla cuadra con el carril',  r.reglaAlineada===true,    'desfase '+r.desfaseRegla+'px'],
  ['el cabezal cuadra con el carril',r.cabezalAlineado===true,  r.cabezalAlineado],
  ['tomas viejas siguen visibles',   r.tomaViejaVisible===true, r.tomaViejaVisible],
  ['sin errores de página',          errs.length===0,           errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
