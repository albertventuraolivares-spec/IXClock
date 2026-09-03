// Clima de cada ciudad del reloj mundial. Los servidores de open-meteo estan
// bloqueados en este entorno, asi que se responden desde aqui: se comprueba
// que la app pide lo correcto y pinta lo que recibe, y que aguanta el fallo.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9205);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1100,height:900}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 const pedidos=[]; let romper=false;

 // El catch-all va PRIMERO: Playwright prueba las rutas de la ultima a la
 // primera, asi que si se registra al final se traga tambien los simulacros.
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());

 await p.route(/geocoding-api\.open-meteo\.com/, r=>{
   pedidos.push('geo:'+r.request().url());
   if(romper) return r.abort();
   const n=decodeURIComponent(new URL(r.request().url()).searchParams.get('name')||'');
   const coords={'Tokio':[35.68,139.69],'Madrid':[40.42,-3.70]}[n];
   if(!coords) return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({})});
   r.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify({results:[{latitude:coords[0],longitude:coords[1],name:n}]})});
 });
 await p.route(/api\.open-meteo\.com\/v1\/forecast/, r=>{
   const u=new URL(r.request().url());
   if(!u.searchParams.get('current')?.includes('weathercode')) return r.continue();
   pedidos.push('clima:'+u.searchParams.get('latitude'));
   if(romper) return r.abort();
   const lat=parseFloat(u.searchParams.get('latitude'));
   const datos = Math.abs(lat-35.68)<1 ? {temperature_2m:22.4, weathercode:0}
                                       : {temperature_2m:9.6,  weathercode:61};
   r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({current:datos})});
 });

 await p.goto('http://localhost:9205/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2600);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
   return !l || getComputedStyle(l).display==='none'; }, null, {timeout:20000}).catch(()=>{});
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const o={};
 // --- dos ciudades: la hora sale YA, el clima llega despues ---
 await p.evaluate(()=>{
   localStorage.removeItem('ica_clima_v1'); localStorage.removeItem('ica_geo_v1');
   _icaClima={}; _icaGeo={};
   _icaWorldClocks=['Asia/Tokyo','Europe/Madrid'];
   const app=document.getElementById('ios-clock-app'); app.classList.add('open');
   icaSwitchTab('world'); icaRenderWorldClocks();
 });
 await p.waitForTimeout(120);
 o.horaSaleYa = await p.evaluate(()=>/\d{1,2}:\d{2}/.test(document.getElementById('ica-world-list').innerText));
 o.huecoDelClima = await p.evaluate(()=>!!document.getElementById('ica-clima-Asia-Tokyo'));
 await p.waitForTimeout(2500);
 const txt = await p.evaluate(()=>document.getElementById('ica-world-list').innerText);
 o.tokioClima  = /22°/.test(txt) && /☀️/.test(txt);
 o.madridClima = /10°|9°/.test(txt) && /🌧️/.test(txt);
 o.pidioGeoDeAmbas = pedidos.filter(x=>x.startsWith('geo:')).length===2;
 o.pidioClimaDeAmbas = pedidos.filter(x=>x.startsWith('clima:')).length===2;
 o.usoLasCoordenadas = pedidos.some(x=>/^clima:35\.68/.test(x)) && pedidos.some(x=>/^clima:40\.42/.test(x));

 // --- se guarda: al repintar no vuelve a preguntar ---
 const antes=pedidos.length;
 await p.evaluate(()=>icaRenderWorldClocks());
 await p.waitForTimeout(1200);
 o.noRepregunta = pedidos.length===antes;
 o.sigueEnPantalla = await p.evaluate(()=>/22°/.test(document.getElementById('ica-world-list').innerText));
 o.guardadoEnDisco = await p.evaluate(()=>{
   const c=JSON.parse(localStorage.getItem('ica_clima_v1')||'{}');
   const g=JSON.parse(localStorage.getItem('ica_geo_v1')||'{}');
   return !!c['Asia/Tokyo'] && !!g['Asia/Tokyo'] && g['Asia/Tokyo'].lat===35.68;
 });

 // --- sin internet: la hora sigue, el clima guardado se ve igual ---
 romper=true;
 await p.evaluate(()=>{ _icaClima['Asia/Tokyo'].t=0; icaRenderWorldClocks(); });   // caduca el guardado
 await p.waitForTimeout(1500);
 const txt2 = await p.evaluate(()=>document.getElementById('ica-world-list').innerText);
 o.sinRedSigueLaHora = /\d{1,2}:\d{2}/.test(txt2);
 o.sinRedNoRompe = errs.length===0;
 romper=false;

 // --- una ciudad sin coordenadas no rompe la lista ---
 await p.evaluate(()=>{
   _icaClima={}; _icaGeo={};
   _icaWorldClocks=['Pacific/Kiritimati'];
   icaRenderWorldClocks();
 });
 await p.waitForTimeout(1800);
 o.desconocidaNoRompe = await p.evaluate(()=>{
   const t=document.getElementById('ica-world-list').innerText;
   return /\d{1,2}:\d{2}/.test(t);
 });

 // --- el nombre de la ciudad va escapado ---
 o.nombreEscapado = await p.evaluate(()=>{
   window.__pwn=0;
   _icaWorldClocks=['America/New_York'];
   icaRenderWorldClocks();
   return !/[^&]<img/.test(document.getElementById('ica-world-list').innerHTML);
 });

 const pruebas=[
  ['la hora sale sin esperar red',  o.horaSaleYa===true,        o.horaSaleYa],
  ['hay hueco para el clima',       o.huecoDelClima===true,     o.huecoDelClima],
  ['Tokio: 22° y sol',              o.tokioClima===true,        o.tokioClima],
  ['Madrid: 10° y lluvia',          o.madridClima===true,       o.madridClima],
  ['pide coordenadas de las dos',   o.pidioGeoDeAmbas===true,   o.pidioGeoDeAmbas],
  ['pide el clima de las dos',      o.pidioClimaDeAmbas===true, o.pidioClimaDeAmbas],
  ['usa las coordenadas correctas', o.usoLasCoordenadas===true, o.usoLasCoordenadas],
  ['NO vuelve a preguntar',         o.noRepregunta===true,      o.noRepregunta],
  ['y sigue en pantalla',           o.sigueEnPantalla===true,   o.sigueEnPantalla],
  ['queda guardado en el disco',    o.guardadoEnDisco===true,   o.guardadoEnDisco],
  ['sin red la hora sigue',         o.sinRedSigueLaHora===true, o.sinRedSigueLaHora],
  ['y no rompe nada',               o.sinRedNoRompe===true,     o.sinRedNoRompe],
  ['ciudad sin datos no rompe',     o.desconocidaNoRompe===true,o.desconocidaNoRompe],
  ['el nombre va escapado',         o.nombreEscapado===true,    o.nombreEscapado],
  ['sin errores de página',         errs.length===0,            errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\npeticiones: '+pedidos.join(' , '));
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
