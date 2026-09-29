// Avisos del tiempo en las ciudades del reloj mundial (idea 57).
//
// El servicio del tiempo (Open-Meteo) se sustituye por respuestas preparadas
// para cada ciudad, y se comprueba lo que ve y recibe la persona:
//  · Tokio con tormenta: la ciudad lo marca y llega UN aviso;
//  · Madrid con buen tiempo: nada;
//  · volver a abrir el reloj el mismo día NO repite el aviso;
//  · al día siguiente, si sigue la tormenta, vuelve a avisar;
//  · calor extremo y helada también se marcan;
//  · y sin internet no se inventa nada ni se rompe.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9278);

// Lo que «dice» el servicio del tiempo en cada momento, por latitud
let TIEMPO={ '35':{t:28, code:95}, '40':{t:22, code:0} };
let sinRed=false;
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1200,height:900}, timezoneId:'America/Santo_Domingo', locale:'es-ES'});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 // Primero el corte general; las rutas registradas DESPUÉS mandan.
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.route(/geocoding-api\.open-meteo\.com/, r=>{
   if(sinRed) return r.abort();
   const n=decodeURIComponent(new URL(r.request().url()).searchParams.get('name')||'');
   const lat=/Tok/i.test(n)?35:/Madrid/i.test(n)?40:10;
   r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({results:[{latitude:lat, longitude:lat}]})});
 });
 await p.route(/api\.open-meteo\.com\/v1\/forecast/, r=>{
   if(sinRed) return r.abort();
   const lat=String(Math.round(+new URL(r.request().url()).searchParams.get('latitude')));
   const w=TIEMPO[lat]||{t:20,code:0};
   r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({current:{temperature_2m:w.t, weathercode:w.code}})});
 });
 await p.clock.install({time:new Date('2026-10-01T10:00:00-04:00')});
 await p.addInitScript(()=>{ try{ if(!sessionStorage.getItem('s')){ ['ica_clima_v1','ica_geo_v1','ix_alerta_clima_v1'].forEach(k=>localStorage.removeItem(k)); sessionStorage.setItem('s','1'); } }catch(e){} });
 await p.goto('http://localhost:9278/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof icaRenderWorldClocks==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}; window.__avisos=[]; window.ixNotificar=function(t){ window.__avisos.push(t); }; });
 const abrir=async()=>{ await p.evaluate(()=>{ _icaWorldClocks=['Asia/Tokyo','Europe/Madrid']; icaRenderWorldClocks(); }); await p.clock.runFor(1500);
   return p.evaluate(()=>{ const t=id=>(document.getElementById('ica-clima-'+id)||{}).textContent||''; const r={ tokio:t('Asia-Tokyo'), madrid:t('Europe-Madrid'), avisos:window.__avisos.slice() }; window.__avisos=[]; return r; }); };
 const o={};
 o.primera=await abrir();
 o.otraVez=await abrir();
 // Al día siguiente (la caché de 30 min ya caducó)
 await p.clock.setSystemTime(new Date('2026-10-02T10:00:00-04:00'));
 o.manana=await abrir();
 // Calor y helada
 await p.clock.setSystemTime(new Date('2026-10-03T10:00:00-04:00'));
 TIEMPO={ '35':{t:38, code:0}, '40':{t:-3, code:3} };
 o.extremos=await abrir();
 // Sin internet (y sin nada guardado de antes para una ciudad nueva)
 sinRed=true;
 await p.clock.setSystemTime(new Date('2026-10-04T10:00:00-04:00'));
 o.sinRed=await p.evaluate(async()=>{ _icaWorldClocks=['Asia/Tokyo','Europe/Madrid','America/Sao_Paulo']; icaRenderWorldClocks(); await new Promise(r=>setTimeout(r,50)); return (document.getElementById('ica-clima-America-Sao_Paulo')||{}).textContent; });
 await p.clock.runFor(1500);
 await b.close(); srv.close();

 const pruebas=[
  ['TOKIO con tormenta: se marca en la ciudad',  /28°/.test(o.primera.tokio) && /Tormenta/.test(o.primera.tokio), o.primera.tokio],
  ['y llega UN aviso',                           o.primera.avisos.length===1 && /Tormenta/.test(o.primera.avisos[0]) && /Tokio|Tokyo/.test(o.primera.avisos[0]), JSON.stringify(o.primera.avisos)],
  ['MADRID con buen tiempo: nada',               /22°/.test(o.primera.madrid) && !/Tormenta|Calor|Helada|Lluvia|Nevada/.test(o.primera.madrid), o.primera.madrid],
  ['abrir otra vez el mismo día NO repite',      o.otraVez.avisos.length===0 && /Tormenta/.test(o.otraVez.tokio), JSON.stringify(o.otraVez.avisos)],
  ['al día siguiente vuelve a avisar',           o.manana.avisos.length===1, JSON.stringify(o.manana.avisos)],
  ['calor extremo (38°) se marca',               /38°/.test(o.extremos.tokio) && /Calor extremo/.test(o.extremos.tokio), o.extremos.tokio],
  ['helada (−3°) se marca',                      /-3°/.test(o.extremos.madrid) && /Helada/.test(o.extremos.madrid), o.extremos.madrid],
  ['y avisa de los dos',                         o.extremos.avisos.length===2, JSON.stringify(o.extremos.avisos)],
  ['sin internet no inventa nada',               (o.sinRed||'')==='', JSON.stringify(o.sinRed)],
  ['sin errores de página',                      errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
