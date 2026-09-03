// Comparador de horas del reloj mundial: elegir una hora tuya y ver que hora
// seria en cada ciudad guardada, con el color de si es hora decente o no.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9207);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 // Zona horaria fija: si no, el resultado dependeria de donde corra la prueba.
 const ctx=await b.newContext({viewport:{width:1100,height:950}, timezoneId:'Europe/Madrid'});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9207/',{waitUntil:'domcontentloaded'});
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
   localStorage.removeItem('ica_clima_v1'); localStorage.removeItem('ica_geo_v1');
   _icaClima={}; _icaGeo={};
   document.getElementById('ios-clock-app').classList.add('open');
   icaSwitchTab('world');

   // --- sin ciudades no hay boton ---
   _icaWorldClocks=[]; _icaCompAbierto=false; icaRenderWorldClocks(); await w(200);
   o.sinCiudadesSinBoton = getComputedStyle(document.getElementById('ica-comp-btn')).display==='none';

   // --- con ciudades sale el boton, cerrado ---
   _icaWorldClocks=['Asia/Tokyo','America/New_York'];
   icaRenderWorldClocks(); await w(250);
   o.conCiudadesHayBoton = getComputedStyle(document.getElementById('ica-comp-btn')).display!=='none';
   o.empiezaCerrado = getComputedStyle(document.getElementById('ica-comparador')).display==='none';

   // --- se abre ---
   icaToggleComparador(); await w(250);
   const c=document.getElementById('ica-comparador');
   o.seAbre = getComputedStyle(c).display!=='none';
   o.botonCambia = /Ocultar/.test(document.getElementById('ica-comp-btn').textContent);
   o.tira24 = (c.innerHTML.match(/icaCompElegir\(/g)||[]).length===24;
   o.saleAqui = /Aquí/.test(c.innerText);
   o.salenLasCiudades = /Tokio/.test(c.innerText) && /Nueva York/.test(c.innerText);

   // --- las CUENTAS: a las 10:00 de Madrid ---
   // Tokio va 8 h por delante en horario de verano europeo (7 en invierno);
   // Nueva York 6 h por detras (5 en invierno). Se calcula, no se supone.
   icaCompElegir(10); await w(200);
   const base=new Date(); base.setHours(10,0,0,0);
   const hEn=tz=>parseInt(new Intl.DateTimeFormat('es',{timeZone:tz,hour:'2-digit',hour12:false}).format(base),10);
   const tok=hEn('Asia/Tokyo'), ny=hEn('America/New_York');
   const txt=document.getElementById('ica-comparador').innerText;
   o.horaElegida = /10:00/.test(txt);
   o.tokioCuadra = new RegExp(String(tok).padStart(2,'0')+':00').test(txt);
   o.nyCuadra    = new RegExp(String(ny).padStart(2,'0')+':00').test(txt);
   o.detalle = 'base 10 · Tokio '+tok+' · NY '+ny;

   // --- los COLORES: a las 3 de la madrugada de aquí, aquí sale en rojo ---
   icaCompElegir(3); await w(200);
   const html3=document.getElementById('ica-comparador').innerHTML;
   o.madrugadaEnRojo = /#ff453a;">03:00/.test(html3);
   icaCompElegir(12); await w(200);
   const html12=document.getElementById('ica-comparador').innerHTML;
   o.mediodiaEnVerde = /#30d158;">12:00/.test(html12);

   // --- moverse con las flechas y dar la vuelta al dia ---
   _icaCompHora=23; icaCompMover(1); o.pasaDe23A0 = _icaCompHora===0;
   _icaCompHora=0;  icaCompMover(-1); o.pasaDe0A23 = _icaCompHora===23;

   // --- quitar todas las ciudades esconde el comparador ---
   _icaWorldClocks=[]; icaRenderWorldClocks(); await w(200);
   o.sinCiudadesSeEsconde = getComputedStyle(document.getElementById('ica-comparador')).display==='none';

   // --- y con el comparador abierto, añadir una ciudad lo repinta ---
   _icaWorldClocks=['Europe/Londres_falso'];   // zona invalida: no debe reventar
   let reventó=false;
   try{ icaRenderWorldClocks(); }catch(e){ reventó=true; }
   await w(200);
   o.zonaInvalidaNoRompe = reventó===false;
   _icaWorldClocks=['Asia/Tokyo']; icaRenderWorldClocks(); await w(200);
   o.repintaAlCambiar = /Tokio/.test(document.getElementById('ica-comparador').innerText);
   return o;
 });

 const pruebas=[
  ['sin ciudades no hay botón',    r.sinCiudadesSinBoton===true,  r.sinCiudadesSinBoton],
  ['con ciudades sí hay botón',    r.conCiudadesHayBoton===true,  r.conCiudadesHayBoton],
  ['empieza cerrado',              r.empiezaCerrado===true,       r.empiezaCerrado],
  ['se abre al pulsar',            r.seAbre===true,               r.seAbre],
  ['el botón cambia de texto',     r.botonCambia===true,          r.botonCambia],
  ['tira de las 24 horas',         r.tira24===true,               r.tira24],
  ['sale tu propia hora',          r.saleAqui===true,             r.saleAqui],
  ['salen las dos ciudades',       r.salenLasCiudades===true,     r.salenLasCiudades],
  ['marca la hora elegida',        r.horaElegida===true,          r.horaElegida],
  ['la hora de Tokio cuadra',      r.tokioCuadra===true,          r.detalle],
  ['la de Nueva York cuadra',      r.nyCuadra===true,             r.detalle],
  ['la madrugada sale en rojo',    r.madrugadaEnRojo===true,      r.madrugadaEnRojo],
  ['el mediodía en verde',         r.mediodiaEnVerde===true,      r.mediodiaEnVerde],
  ['de las 23 pasa a las 0',       r.pasaDe23A0===true,           r.pasaDe23A0],
  ['y de las 0 a las 23',          r.pasaDe0A23===true,           r.pasaDe0A23],
  ['sin ciudades se esconde',      r.sinCiudadesSeEsconde===true, r.sinCiudadesSeEsconde],
  ['una zona inválida no rompe',   r.zonaInvalidaNoRompe===true,  r.zonaInvalidaNoRompe],
  ['se repinta al cambiar',        r.repintaAlCambiar===true,     r.repintaAlCambiar],
  ['sin errores de página',        errs.length===0,               errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
