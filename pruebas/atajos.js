const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9193);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9193/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2400);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
   return !l || getComputedStyle(l).display==='none'; }, null, {timeout:20000}).catch(()=>{});
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 const o={};
 // Cada panel se abre a su manera: los de _HOME_OPEN_PANELS con la clase
 // .open (siguen con display:flex, solo cambian opacidad) y los otros con
 // display. Mirar las dos cosas a la vez daba "abierto" siempre.
 const abierto = sel => p.evaluate(s=>{
   const e=document.getElementById(s);
   if(!e) return false;
   return (_HOME_OPEN_PANELS||[]).indexOf(s)>=0
     ? e.classList.contains('open')
     : getComputedStyle(e).display!=='none';
 }, sel);

 // --- Ctrl+, abre Configuración ---
 await p.keyboard.press('Control+Comma'); await p.waitForTimeout(400);
 o.configAbre = await p.evaluate(()=>isSidebarVisible===true);
 await p.evaluate(()=>{try{ if(isSidebarVisible) toggleSidebar(); }catch(e){}});
 await p.waitForTimeout(300);

 // --- Ctrl+/ enseña la lista de atajos ---
 await p.keyboard.press('Control+Slash'); await p.waitForTimeout(400);
 o.atajosSalen = await p.evaluate(()=>{
   const e=document.getElementById('ix-atajos');
   return !!e && getComputedStyle(e).display!=='none' && /Cerrar TODAS/.test(e.innerText);
 });
 // --- y Esc la cierra ---
 await p.keyboard.press('Escape'); await p.waitForTimeout(300);
 o.atajosSeCierran = await p.evaluate(()=>document.getElementById('ix-atajos').style.display==='none');

 // --- Esc cierra la ventana de ENCIMA, no todas ---
 // El reloj es una app a pantalla completa (z-index 9500) y la brujula un
 // panelito flotante (4000): la de encima es el reloj, aunque se abriera antes.
 await p.evaluate(()=>{ toggleIOSClockApp(); openCompass(); });
 await p.waitForTimeout(500);
 const zRel = await p.evaluate(()=>parseInt(getComputedStyle(document.getElementById('ios-clock-app')).zIndex)||0);
 const zBru = await p.evaluate(()=>parseInt(getComputedStyle(document.getElementById('compass-modal')).zIndex)||0);
 o.relojEncima = zRel>zBru;
 o.lasDosAbiertas = (await abierto('ios-clock-app')) && (await abierto('compass-modal'));
 await p.keyboard.press('Escape'); await p.waitForTimeout(400);
 o.cierraLaDeArriba = !(await abierto('ios-clock-app'));
 o.dejaLaDeAbajo    = await abierto('compass-modal');

 // --- Ctrl+Shift+X cierra TODAS ---
 await p.keyboard.press('Control+Shift+X'); await p.waitForTimeout(500);
 o.cierraTodas = !(await abierto('compass-modal'));

 // --- escribiendo, Esc no cierra ventanas ---
 await p.evaluate(()=>{ toggleIOSClockApp(); toggleNotesPanel(); });
 await p.waitForTimeout(500);
 await p.evaluate(()=>{
   const i=document.getElementById('notes-search');
   if(i){ i.focus(); i.value='hola'; }
 });
 await p.keyboard.press('Escape'); await p.waitForTimeout(350);
 o.escribiendoNoCierra = await abierto('ios-clock-app');
 await p.evaluate(()=>{ try{ document.activeElement.blur(); }catch(e){} });

 // --- la pantalla de entrar NO se cierra con Esc ---
 await p.evaluate(()=>{
   let l=document.getElementById('login-overlay');
   if(!l){ l=document.createElement('div'); l.id='login-overlay'; l.style.cssText='position:fixed;inset:0;z-index:99999;'; document.body.appendChild(l); }
   l.style.display='flex';
 });
 await p.waitForTimeout(250);
 await p.keyboard.press('Escape'); await p.waitForTimeout(350);
 o.loginNoSeCierra = await abierto('login-overlay');
 await p.evaluate(()=>{ document.getElementById('login-overlay').style.display='none'; });

 // --- Ctrl+K sigue abriendo el buscador y no choca con lo demás ---
 await p.keyboard.press('Control+k'); await p.waitForTimeout(400);
 o.buscadorAbre = await p.evaluate(()=>_ixBusqAbierto===true);
 await p.keyboard.press('Escape'); await p.waitForTimeout(300);
 o.buscadorCierra = await p.evaluate(()=>_ixBusqAbierto===false);

 // --- sin ventanas abiertas, Esc no rompe nada ---
 await p.evaluate(()=>{ try{ ixCerrarTodasLasVentanas(); }catch(e){} });
 await p.waitForTimeout(400);
 o.escEnVacio = await p.evaluate(()=>ixCerrarVentanaDeArriba()===false);

 const pruebas=[
  ['Ctrl+, abre Configuración',    o.configAbre===true,        o.configAbre],
  ['Ctrl+/ enseña los atajos',     o.atajosSalen===true,       o.atajosSalen],
  ['Esc cierra esa lista',         o.atajosSeCierran===true,   o.atajosSeCierran],
  ['el reloj queda encima',        o.relojEncima===true,       o.relojEncima],
  ['las dos empiezan abiertas',    o.lasDosAbiertas===true,    o.lasDosAbiertas],
  ['Esc cierra la de ARRIBA',      o.cierraLaDeArriba===true,  o.cierraLaDeArriba],
  ['y deja abierta la de abajo',   o.dejaLaDeAbajo===true,     o.dejaLaDeAbajo],
  ['Ctrl+Mayús+X cierra todas',    o.cierraTodas===true,       o.cierraTodas],
  ['escribiendo, Esc no cierra',   o.escribiendoNoCierra===true, o.escribiendoNoCierra],
  ['Esc no echa de la sesión',     o.loginNoSeCierra===true,   o.loginNoSeCierra],
  ['Ctrl+K abre el buscador',      o.buscadorAbre===true,      o.buscadorAbre],
  ['Esc lo cierra',                o.buscadorCierra===true,    o.buscadorCierra],
  ['sin ventanas, Esc no rompe',   o.escEnVacio===true,        o.escEnVacio],
  ['sin errores de página',        errs.length===0,            errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
