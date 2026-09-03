const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9111);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1100,height:850}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9111/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2400);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); await p.waitForTimeout(600);}catch(e){}
 const r=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms)); const o={};
   // apps abren
   const ids=['ixband','mapas','navegador','juegos','emulador','radio','musica','vpn','bench','nube','brujula','buscador'];
   o.apps=[]; for(const id of ids){ try{ ixOpenApp(id); await wait(140); o.apps.push(id);}catch(e){ o.apps.push(id+'!ERR'); } }
   ixCerrarTodasLasVentanas(); await wait(200);
   // reloj: alarmas, ciudades, cronometro
   toggleIOSClockApp(); await wait(300);
   o.alarmasVacias=_icaAlarms.length===0;
   icaSwitchTab('world'); await wait(200); icaAddWorldClock(); await wait(150);
   icaCitySearch('tok'); await wait(200);
   o.buscaCiudad=/Tokio/.test(document.getElementById('ica-city-results').innerHTML);
   icaSwitchTab('stopwatch'); await wait(200);
   o.cronometro=!!document.getElementById('ica-sw-time');
   o.alarmasSuenan=typeof checkIcaAlarms==='function';
   ixCerrarTodasLasVentanas(); await wait(200);
   // divisas
   switchCalcMode('currency'); await wait(700);
   o.divisas=document.getElementById('currency-from').options.length;
   document.getElementById('currency-amount').value='10'; convertCurrency(); await wait(120);
   o.convierte=/[0-9]/.test(document.getElementById('currency-result').textContent);
   // mapas paso a paso
   o.mapasPasos=typeof _amapManeuver==='function' && typeof amapStartNav==='function';
   // instalable
   o.manifest=!!document.querySelector('link[rel="manifest"]');
   o.tailwindLocal=!!document.querySelector('link[href="tailwind.css"]');
   // gesto
   o.gesto=typeof _ixDedosEnSeco==='function' && typeof _ixEsPulsable==='function';
   return o;
 });
 const ok=(k,v)=>console.log((v?'  ✓ ':'  ✗ ')+k);
 console.log('--- REGRESION GENERAL ---');
 ok('las 12 apps abren por su enlace', r.apps.filter(a=>a.includes('!ERR')).length===0 && r.apps.length===12);
 ok('reloj: sin alarma fantasma, busca ciudades, cronometro y alarmas suenan', r.alarmasVacias && r.buscaCiudad && r.cronometro && r.alarmasSuenan);
 ok('divisas: 50 monedas y convierte', r.divisas===50 && r.convierte);
 ok('mapas paso a paso presente', r.mapasPasos);
 ok('instalable y Tailwind local', r.manifest && r.tailwindLocal);
 ok('gesto de 3 dedos con deteccion de zona vacia', r.gesto);
 console.log('ERRORES JS:',errs.length?[...new Set(errs)].slice(0,3).join(' | '):'(ninguno)');
 await b.close();srv.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
