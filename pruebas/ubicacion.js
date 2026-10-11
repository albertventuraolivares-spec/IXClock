// Idea 82: la ubicación NO se pide al abrir. Con el permiso sin dar, el clima
// espera al botón «📍 Usar mi ubicación»; con el permiso ya dado, se usa sola.
// Se cuenta cada llamada a getCurrentPosition desde antes de cargar la página.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9307);

async function abrir(b, conPermiso){
 const ctx=await b.newContext({viewport:{width:1300,height:900},
   geolocation:{latitude:40.42,longitude:-3.70}, permissions:conPermiso?['geolocation']:[]});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.addInitScript(()=>{
   window.__geoLlamadas=0;
   const g=navigator.geolocation, orig=g.getCurrentPosition.bind(g);
   g.getCurrentPosition=function(){ window.__geoLlamadas++; return orig.apply(null,arguments); };
 });
 const clima=[];
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.route(/nominatim\.openstreetmap\.org\/reverse/,r=>r.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({address:{city:'Madrid'}})}));
 await p.route(/api\.open-meteo\.com\/v1\/forecast/,r=>{
   const u=new URL(r.request().url());
   if(!u.searchParams.get('current')?.includes('weathercode')) return r.abort();
   clima.push(u.searchParams.get('latitude'));
   r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
     current:{temperature_2m:13.2,apparent_temperature:12,weathercode:61,windspeed_10m:5,relativehumidity_2m:70},
     daily:{temperature_2m_max:[15],temperature_2m_min:[8],precipitation_probability_max:[70],sunrise:['2026-10-11T08:20'],sunset:['2026-10-11T19:40']},
     hourly:{temperature_2m:Array(48).fill(13),precipitation_probability:Array(48).fill(50),uv_index:Array(48).fill(1)}})});
 });
 await p.goto('http://localhost:9307/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixUbicacionAlAbrir==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2600);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 return {ctx,p,errs,clima};
}
const leer=p=>p.evaluate(()=>({
  llamadas:window.__geoLlamadas,
  boton:!!document.getElementById('clima-pedir-ubic'),
  temp:(document.getElementById('curr-temp')||{}).textContent.trim(),
  lugar:(document.getElementById('txt-ubicacion')||{}).textContent.trim(),
}));

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const o={};

 // --- alguien nuevo: no se le pregunta nada al entrar ---
 const A=await abrir(b,false);
 o.nuevo=await leer(A.p);
 o.climaAntes=A.clima.length;
 // --- toca el botón (aquí el permiso se concede, como si dijera «Permitir») ---
 await A.ctx.grantPermissions(['geolocation']);
 await A.p.click('#clima-pedir-ubic');
 await A.p.waitForTimeout(2500);
 o.tras=await leer(A.p);
 o.climaTrasTocar=A.clima.length;
 o.errsA=A.errs;

 // --- quien ya dio permiso: lo usa solo, sin botón ---
 const B=await abrir(b,true);
 await B.p.waitForTimeout(1500);
 o.dado=await leer(B.p);
 o.climaDado=B.clima.length;
 o.errsB=B.errs;

 const pruebas=[
  ['al abrir NO pide la ubicación',     o.nuevo.llamadas===0,        o.nuevo.llamadas],
  ['ni pide el tiempo antes de tocar',   o.climaAntes===0,            o.climaAntes],
  ['sale el botón 📍',                  o.nuevo.boton===true,        o.nuevo.boton],
  ['sin temperatura de ejemplo',        o.nuevo.temp==='—°',         o.nuevo.temp],
  ['al tocar, la pide una vez',         o.tras.llamadas===1,         o.tras.llamadas],
  ['y llega el tiempo (13°)',           o.tras.temp==='13°',         o.tras.temp],
  ['con la ciudad',                     o.tras.lugar==='Madrid',     o.tras.lugar],
  ['y el botón desaparece',             o.tras.boton===false,        o.tras.boton],
  ['permiso ya dado: la usa sola',      o.dado.llamadas===1 && o.climaDado>0, o.dado.llamadas+'/'+o.climaDado],
  ['sin botón',                         o.dado.boton===false,        o.dado.boton],
  ['con su tiempo',                     o.dado.temp==='13°',         o.dado.temp],
  ['sin errores de página',             o.errsA.length===0&&o.errsB.length===0, o.errsA.concat(o.errsB).slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
