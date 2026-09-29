// La brújula apunta a tus ciudades (idea 58) y ya no confunde este y oeste
// en Android.
//
// Las cuentas se comprueban contra valores conocidos (Nueva York → Londres son
// unos 5.570 km con rumbo inicial de unos 51°). Y la pantalla con la brújula
// de verdad: el navegador «está» en Nueva York, el sensor se simula con
// eventos de orientación, y se mira la flecha de cada ciudad:
//  · en Android, alpha crece hacia el OESTE: con alpha=90 miras al oeste
//    (rumbo 270). Antes la app decía 90 (este);
//  · «📍 Mis ciudades» pone Londres y Tokio con su distancia;
//  · si miras hacia Londres, su flecha apunta hacia arriba (0°);
//  · sin ciudades lo explica; sin permiso de ubicación también;
//  · sin sensor, un aviso de la app en vez de una ventanita del navegador.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9286);

const COORDS={ London:[51.5074,-0.1278], Londres:[51.5074,-0.1278], Tokio:[35.6895,139.6917], Tokyo:[35.6895,139.6917] };
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1200,height:900}, locale:'es-ES', geolocation:{latitude:40.7128, longitude:-74.0060}, permissions:['geolocation']});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 const dialogos=[]; p.on('dialog',d=>{ dialogos.push(d.message()); d.dismiss(); });
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.route(/geocoding-api\.open-meteo\.com/, r=>{
   const n=decodeURIComponent(new URL(r.request().url()).searchParams.get('name')||'');
   const c=Object.keys(COORDS).find(k=>n.indexOf(k)>=0);
   r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({results: c?[{latitude:COORDS[c][0], longitude:COORDS[c][1]}]:[]})});
 });
 await p.goto('http://localhost:9286/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof openCompass==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 const o={};
 o.cuentas=await p.evaluate(()=>{
   if(typeof brujulaCalcular!=='function') return null;
   const ny_lon=brujulaCalcular(40.7128,-74.0060,51.5074,-0.1278);
   return { nyLon:ny_lon, este:brujulaCalcular(0,0,0,10).rumbo, norte:brujulaCalcular(0,0,10,0).rumbo,
            android:brujulaRumbo({alpha:90}), iphone:brujulaRumbo({webkitCompassHeading:30, alpha:5}) };
 });
 await p.evaluate(()=>{ try{ ixCerrarBienvenida(); }catch(e){}; try{ localStorage.removeItem('ica_geo_v1'); _icaGeo={}; }catch(e){}; _icaWorldClocks=[]; openCompass(); });
 await p.waitForTimeout(300);
 // Sin ciudades
 await p.click('text=📍 Mis ciudades',{timeout:3000}).catch(()=>{});
 await p.waitForTimeout(300);
 o.sinCiudades=await p.evaluate(()=>(document.getElementById('compass-ciudades')||{}).innerText||'');
 // Con Londres y Tokio
 await p.evaluate(()=>{ _icaWorldClocks=['Europe/London','Asia/Tokyo']; });
 await p.click('text=📍 Mis ciudades',{timeout:3000}).catch(()=>{});
 await p.waitForTimeout(1200);
 const filas=()=>p.evaluate(()=>[].slice.call(document.querySelectorAll('#compass-ciudades .brj-fila')).map(f=>{ const fl=f.querySelector('.brj-flecha');
   const m=/rotate\(([\d.]+)deg\)/.exec(fl.style.transform||''); return { txt:f.innerText.replace(/\s+/g,' '), giro:m?+m[1]:null, rumbo:+fl.dataset.rumbo }; }));
 o.filas=await filas();
 // Miras hacia Londres: el sensor (Android) dice alpha = 360 − 51
 const rumboLondres=(o.filas.find(f=>/Londres|London/.test(f.txt))||{}).rumbo;
 await p.evaluate(a=>{ const e=new Event('deviceorientationabsolute'); e.alpha=a; e.beta=0; e.gamma=0; window.dispatchEvent(e); }, 360-rumboLondres);
 await p.waitForTimeout(200);
 o.mirando={ filas:await filas(), rumbo:await p.evaluate(()=>(document.getElementById('compass-heading')||{}).textContent) };
 // Sin sensor: el botón de permiso
 await p.evaluate(()=>{ try{ requestCompassPermission(); }catch(e){} });
 await p.waitForTimeout(200);
 // Sin permiso de ubicación
 await ctx.clearPermissions();
 await p.evaluate(()=>{ navigator.geolocation.getCurrentPosition=function(ok,err){ err && err({code:1}); }; });
 await p.click('text=📍 Mis ciudades',{timeout:3000}).catch(()=>{});
 await p.waitForTimeout(300);
 o.sinPermiso=await p.evaluate(()=>(document.getElementById('compass-ciudades')||{}).innerText||'');
 await b.close(); srv.close();

 const c=o.cuentas||{};
 const londres=(o.filas||[]).find(f=>/Londres|London/.test(f.txt)), tokio=(o.filas||[]).find(f=>/Tokio|Tokyo/.test(f.txt));
 const lM=(o.mirando.filas||[]).find(f=>/Londres|London/.test(f.txt)), tM=(o.mirando.filas||[]).find(f=>/Tokio|Tokyo/.test(f.txt));
 const num=t=>+(/([\d.]+) km/.exec((t||'').replace(/\./g,'').replace(/(\d+) km/,'$1 km'))||[])[1];
 const pruebas=[
  ['CUENTAS: NY → Londres ≈ 5.570 km',        !!c.nyLon && Math.abs(c.nyLon.km-5570)<40, c.nyLon && Math.round(c.nyLon.km)],
  ['con rumbo ≈ 51°',                         !!c.nyLon && Math.abs(c.nyLon.rumbo-51)<2, c.nyLon && c.nyLon.rumbo.toFixed(1)],
  ['hacia el este 90°, hacia el norte 0°',    Math.round(c.este)===90 && Math.round(c.norte)===0, c.este+' '+c.norte],
  ['ANDROID: alpha 90 = mirando al OESTE (270°)', c.android===270, c.android],
  ['iPhone: usa su rumbo tal cual',           c.iphone===30, c.iphone],
  ['sin ciudades lo explica',                 /Reloj mundial/.test(o.sinCiudades), o.sinCiudades],
  ['«Mis ciudades» pone Londres y Tokio',     !!londres && !!tokio, JSON.stringify((o.filas||[]).map(f=>f.txt))],
  ['con su distancia',                        !!londres && /5\.?5\d\d km/.test(londres.txt) && !!tokio && /10\.?8\d\d km/.test(tokio.txt), (londres||{}).txt+' | '+(tokio||{}).txt],
  ['mirando al norte, la flecha de Londres ≈ 51°', !!londres && Math.abs(londres.giro-51)<2, londres && londres.giro],
  ['MIRANDO A LONDRES su flecha apunta arriba', !!lM && (lM.giro<1.5 || lM.giro>358.5), lM && lM.giro],
  ['y la de Tokio gira lo mismo',             !!tM && !!tokio && Math.abs(((tokio.giro - tM.giro + 360)%360) - rumboLondres) < 1.5, tM && tM.giro],
  ['la brújula dice el rumbo (51°)',          /^5[01]°$/.test(o.mirando.rumbo||''), o.mirando.rumbo],
  ['sin permiso de ubicación lo dice',        /permiso/i.test(o.sinPermiso), o.sinPermiso],
  ['sin ventanitas del navegador',            dialogos.length===0, JSON.stringify(dialogos)],
  ['sin errores de página',                   errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
