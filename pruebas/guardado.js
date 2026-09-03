const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9192);

async function arranca(ctx){
  // MISMO contexto en las dos sesiones: browser.newPage() crea uno nuevo cada
  // vez y con el un localStorage vacio, que es justo lo que hay que probar.
  const p=await ctx.newPage();
  p.on('pageerror',e=>{ p._errs=p._errs||[]; p._errs.push(e.message.split('\n')[0]); });
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:9192/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
  await p.waitForTimeout(2400);
  await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
  try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
   return !l || getComputedStyle(l).display==='none'; }, null, {timeout:20000}).catch(()=>{});
  await p.waitForTimeout(1800);
  await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
  return p;
}
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:1200,height:900}});

 // ── Sesión 1: se monta una canción y se deja guardada ──
 let p=await arranca(ctx);
 const a=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms)); const o={};
   openGarageBand(); await wait(400);
   gbBorrarCancionGuardada(); await wait(200);
   const toma=n=>({name:n,sec:_gbSecActiva,muted:false,solo:false,vol:1,pan:0,
     events:[{at:0,freq:440,type:'piano',vel:1},{at:900,freq:494,type:'piano',vel:1}]});
   _gbTakes.push(toma('piano'));
   gbSecNueva();                       // sección B
   _gbTakes.push(toma('drums'));
   gbSecRenombrar(); await wait(80);
   const inp=document.getElementById('gb-sec-inp');
   if(inp){ inp.value='Estribillo'; inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); }
   await wait(120);
   gbSetVol(0,'0.4'); gbSetPan(1,'-0.6'); gbToggleMute(0);
   _gbBpm=118; gbTempo(2);             // 120
   gbCambiarCompas();
   await wait(1200);                   // deja que corra el guardado con retardo
   o.hayGuardado = !!localStorage.getItem('ixband_cancion_v1');
   const d=JSON.parse(localStorage.getItem('ixband_cancion_v1'));
   o.guardaTomas = d.takes.length===2;
   o.guardaSecciones = d.secciones.length===2;
   o.guardaNombre = d.secciones.some(x=>x.nombre==='Estribillo');
   o.guardaBpm = d.bpm===120;
   o.guardaCompas = d.compas===_gbCompas;
   o.guardaVol = d.takes[0].vol===0.4;
   o.guardaPan = d.takes[1].pan===-0.6;
   o.guardaMute = d.takes[0].muted===true;
   o.hayBotonCero = /Empezar de cero/.test(document.getElementById('gb-tracks').innerHTML);
   o.diceQueGuarda = /Se guarda solo en este dispositivo/.test(document.getElementById('gb-tracks').innerHTML);
   return o;
 });
 await p.close();

 // ── Sesión 2: MISMO navegador, página recargada de cero ──
 p=await arranca(ctx);
 const c=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms)); const o={};
   o.antesDeAbrir = _gbTakes.length;          // aún no se ha abierto IXBand
   openGarageBand(); await wait(500);
   o.recuperaTomas = _gbTakes.length===2;
   o.recuperaSecciones = _gbSecciones.length===2;
   o.recuperaNombre = _gbSecciones.some(x=>x.nombre==='Estribillo');
   o.recuperaBpm = _gbBpm===120;
   o.recuperaVol = _gbTakes[0].vol===0.4;
   o.recuperaMute = _gbTakes[0].muted===true;
   o.seccionActivaValida = _gbSecIdx(_gbSecActiva)>=0;
   gbView('tracks'); gbRenderTracks(); await wait(200);
   o.sePinta = /gb-track-hdr/.test(document.getElementById('gb-tracks').innerHTML);

   // --- si la sección guardada ya no existe, no deja la vista en blanco ---
   localStorage.setItem('ixband_cancion_v1', JSON.stringify({
     v:1,bpm:120,compas:4,secciones:[{id:'sX',nombre:'Uno'}],secActiva:'sBORRADA',secSeq:1,
     takes:[{name:'piano',sec:'sX',muted:false,solo:false,vol:1,pan:0,events:[{at:0,freq:440,type:'piano',vel:1}]}]}));
   gbCargarCancion();
   o.caeEnLaPrimera = _gbSecActiva==='sX';

   // --- datos corruptos no rompen nada ---
   const antes=_gbTakes.length;
   localStorage.setItem('ixband_cancion_v1','{esto no es json');
   o.corruptoNoRompe = gbCargarCancion()===false && _gbTakes.length===antes;
   localStorage.setItem('ixband_cancion_v1','{"v":1}');
   o.sinTomasNoRompe = gbCargarCancion()===false;

   // --- una canción gigante no se guarda a medias ni revienta ---
   const ev=[]; for(let i=0;i<90000;i++) ev.push({at:i,freq:440,type:'piano',vel:1});
   _gbTakes=[{name:'piano',sec:_gbSecciones[0].id,muted:false,solo:false,vol:1,pan:0,events:ev}];
   o.rechazaGigante = gbGuardarCancion()===false;
   o.avisaDelGigante = /demasiado larga/.test(document.getElementById('gb-status').textContent);

   // --- empezar de cero deja limpio y borrado ---
   gbBorrarCancionGuardada(); await wait(200);
   o.ceroVacia = _gbTakes.length===0 && _gbSecciones.length===1;
   o.ceroBorraDisco = localStorage.getItem('ixband_cancion_v1')===null;
   return o;
 });
 const errs=p._errs||[];
 await p.close();

 const pruebas=[
  ['guarda algo en el disco',        a.hayGuardado===true,      a.hayGuardado],
  ['guarda las dos tomas',           a.guardaTomas===true,      a.guardaTomas],
  ['guarda las dos secciones',       a.guardaSecciones===true,  a.guardaSecciones],
  ['guarda el nombre nuevo',         a.guardaNombre===true,     a.guardaNombre],
  ['guarda el tempo',                a.guardaBpm===true,        a.guardaBpm],
  ['guarda el compás',               a.guardaCompas===true,     a.guardaCompas],
  ['guarda el volumen',              a.guardaVol===true,        a.guardaVol],
  ['guarda el paneo',                a.guardaPan===true,        a.guardaPan],
  ['guarda el silenciado',           a.guardaMute===true,       a.guardaMute],
  ['hay botón de empezar de cero',   a.hayBotonCero===true,     a.hayBotonCero],
  ['avisa de que se guarda solo',    a.diceQueGuarda===true,    a.diceQueGuarda],
  ['tras recargar arranca vacío',    c.antesDeAbrir===0,        c.antesDeAbrir],
  ['RECUPERA las tomas',             c.recuperaTomas===true,    c.recuperaTomas],
  ['recupera las secciones',         c.recuperaSecciones===true,c.recuperaSecciones],
  ['recupera el nombre',             c.recuperaNombre===true,   c.recuperaNombre],
  ['recupera el tempo',              c.recuperaBpm===true,      c.recuperaBpm],
  ['recupera el volumen',            c.recuperaVol===true,      c.recuperaVol],
  ['recupera el silenciado',         c.recuperaMute===true,     c.recuperaMute],
  ['la sección activa es válida',    c.seccionActivaValida===true, c.seccionActivaValida],
  ['y se pinta en Pistas',           c.sePinta===true,          c.sePinta],
  ['sección perdida cae en la 1ª',   c.caeEnLaPrimera===true,   c.caeEnLaPrimera],
  ['un guardado roto no rompe nada', c.corruptoNoRompe===true,  c.corruptoNoRompe],
  ['un guardado sin tomas tampoco',  c.sinTomasNoRompe===true,  c.sinTomasNoRompe],
  ['no guarda algo gigante',         c.rechazaGigante===true,   c.rechazaGigante],
  ['y avisa de por qué',             c.avisaDelGigante===true,  c.avisaDelGigante],
  ['empezar de cero vacía todo',     c.ceroVacia===true,        c.ceroVacia],
  ['y lo borra del disco',           c.ceroBorraDisco===true,   c.ceroBorraDisco],
  ['sin errores de página',          errs.length===0,           errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
