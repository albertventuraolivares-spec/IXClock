// Todas las apps en una rejilla. En un movil el dock oculta 10 de sus 17
// botones, asi que sin esto la mitad de la app era inalcanzable para alguien
// que entra por primera vez.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9216);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 // Movil: es donde el dock se queda corto y donde esto hace falta de verdad.
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9216/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2400);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
   return !l || getComputedStyle(l).display==='none'; }, null, {timeout:20000}).catch(()=>{});
 await p.waitForTimeout(1800);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const o={};
 // El problema que resuelve: en movil el dock esconde la mayoria
 o.dock = await p.evaluate(()=>{
   const d=document.getElementById('top-dock');
   const b=[].slice.call(d.querySelectorAll('button'));
   return { total:b.length, visibles:b.filter(x=>x.getBoundingClientRect().width>0).length };
 });
 // El boton del lanzador NO se oculta en modo compacto
 o.botonVisible = await p.locator('#top-dock button[aria-label="Todas las apps"]').isVisible();
 await p.click('#top-dock button[aria-label="Todas las apps"]');
 await p.waitForTimeout(500);

 const r=await p.evaluate(()=>{
   const ov=document.getElementById('ix-lanzador');
   const tarjetas=[].slice.call(ov.querySelectorAll('button[onclick^="ixLanzarApp"]'));
   return { abierto:getComputedStyle(ov).display!=='none',
            tarjetas:tarjetas.length,
            apps:IX_APPS.length,
            nombres:tarjetas.map(t=>t.innerText.split('\n')[1]||'').slice(0,20),
            estaIXBand:/IXBand/.test(ov.innerText),
            estaMapas:/Mapas/.test(ov.innerText),
            dice:/Todas las apps/.test(ov.innerText) };
 });
 o.abierto=r.abierto; o.todas=r.tarjetas===r.apps; o.cuenta=r.tarjetas+'/'+r.apps;
 o.estaIXBand=r.estaIXBand; o.estaMapas=r.estaMapas; o.tituloOk=r.dice;

 // Pulsar una tarjeta abre esa app de verdad
 o.abreLaApp = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   let abrio=false; const orig=window.openGarageBand;
   window.openGarageBand=function(){ abrio=true; };
   ixLanzarApp('ixband'); await w(300);
   window.openGarageBand=orig;
   return abrio;
 });
 o.seCierraAlElegir = await p.evaluate(()=>getComputedStyle(document.getElementById('ix-lanzador')).display==='none');

 // Esc lo cierra
 await p.evaluate(()=>ixAbrirLanzador());
 await p.waitForTimeout(300);
 await p.keyboard.press('Escape');
 await p.waitForTimeout(300);
 o.escCierra = await p.evaluate(()=>getComputedStyle(document.getElementById('ix-lanzador')).display==='none');

 // Ctrl+Shift+A lo abre
 await p.keyboard.press('Control+Shift+A');
 await p.waitForTimeout(400);
 o.atajoAbre = await p.evaluate(()=>getComputedStyle(document.getElementById('ix-lanzador')).display!=='none');
 await p.keyboard.press('Escape'); await p.waitForTimeout(300);

 // El conmutador vacío ya no es un callejón sin salida
 o.switcherOfrece = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   _recentApps.length=0;
   openAppSwitcher(); await w(400);
   const m=document.getElementById('app-switcher-modal');
   return /Ver todas las apps/.test(m.innerText||'');
 });
 // y ese botón funciona
 o.switcherAbreLanzador = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const b=[].slice.call(document.querySelectorAll('#app-switcher-modal button'))
     .find(x=>/Ver todas las apps/.test(x.textContent));
   if(!b) return false;
   b.click(); await w(400);
   return getComputedStyle(document.getElementById('ix-lanzador')).display!=='none';
 });
 await p.evaluate(()=>ixCerrarLanzador());

 // Nada se sale de ancho en un móvil estrecho
 await p.setViewportSize({width:320,height:568});
 await p.evaluate(()=>ixAbrirLanzador());
 await p.waitForTimeout(400);
 o.sinDesborde = await p.evaluate(()=>
   document.documentElement.scrollWidth-document.documentElement.clientWidth<=2);

 const pruebas=[
  ['en móvil el dock esconde apps', o.dock.visibles < o.dock.total, o.dock.visibles+' de '+o.dock.total+' visibles'],
  ['el botón ⊞ sí se ve',           o.botonVisible===true,       o.botonVisible],
  ['abre la rejilla',               o.abierto===true,            o.abierto],
  ['con TODAS las apps',            o.todas===true,              o.cuenta],
  ['incluida IXBand',               o.estaIXBand===true,         o.estaIXBand],
  ['e incluidos Mapas',             o.estaMapas===true,          o.estaMapas],
  ['lleva su título',               o.tituloOk===true,           o.tituloOk],
  ['pulsar una abre la app',        o.abreLaApp===true,          o.abreLaApp],
  ['y se cierra al elegir',         o.seCierraAlElegir===true,   o.seCierraAlElegir],
  ['Esc lo cierra',                 o.escCierra===true,          o.escCierra],
  ['Ctrl+Mayús+A lo abre',          o.atajoAbre===true,          o.atajoAbre],
  ['el conmutador vacío lo ofrece', o.switcherOfrece===true,     o.switcherOfrece],
  ['y ese botón funciona',          o.switcherAbreLanzador===true, o.switcherAbreLanzador],
  ['no se sale de ancho a 320px',   o.sinDesborde===true,        o.sinDesborde],
  ['sin errores de página',         errs.length===0,             errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
