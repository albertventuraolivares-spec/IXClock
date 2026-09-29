// Modo mesita (ideas 18 y 49): hora enorme, tiempo y próxima alarma, pantalla
// encendida pero atenuada, y en rojo de noche.
//
// Se abre como lo abriría alguien desde un acceso directo (/?app=mesita) y con
// el reloj del navegador controlado, para comprobar lo que se VE:
//  · la hora que sale es la de ahora, y cambia sola al pasar el minuto;
//  · sale la próxima alarma (la misma que la franja de arriba) y el tiempo;
//  · sin alarmas lo dice; de noche (22–7) pasa a rojo y más tenue;
//  · pide que la pantalla no se apague y lo suelta al salir;
//  · tocar, Esc o «cerrar todas las ventanas» lo cierran.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9276);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:900,height:600}, timezoneId:'America/Santo_Domingo', locale:'es-ES'});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.clock.install({time:new Date('2026-10-01T12:34:10-04:00')});
 await p.addInitScript(()=>{
   // Se cuenta cuántas veces se pide y se suelta «pantalla encendida»
   window.__wake={pedidas:0, soltadas:0};
   try{ Object.defineProperty(navigator,'wakeLock',{configurable:true, value:{ request:async()=>{ window.__wake.pedidas++; return { release:async()=>{ window.__wake.soltadas++; } }; } }}); }catch(e){}
   try{ if(!sessionStorage.getItem('s')){ localStorage.setItem('ica_alarms', JSON.stringify([{time:'7:30',label:'Trabajo',on:true,tone:'radial'}])); sessionStorage.setItem('s','1'); } }catch(e){}
 });
 await p.goto('http://localhost:9276/?app=mesita',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixAbrirMesita==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 // Si el acceso directo no llegó a abrirlo (la pantalla de entrada va antes),
 // se abre como desde la lista de apps.
 await p.evaluate(()=>{ if(!ixMesitaAbierta()){ const a=IX_APPS.find(x=>x.id==='mesita'); if(a) window[a.open](); } });
 await p.evaluate(()=>{ _lastWeatherRaw={cur:{temperature_2m:27.4, weathercode:0}}; });
 await p.clock.runFor(1500);
 const ver=()=>p.evaluate(()=>{ const ov=document.getElementById('ix-mesita'); if(!ov) return null; const cs=getComputedStyle(ov);
   return { visible:cs.display!=='none', hora:(document.getElementById('ix-mesita-hora')||{}).textContent, fecha:(document.getElementById('ix-mesita-fecha')||{}).textContent,
            extra:(document.getElementById('ix-mesita-extra')||{}).textContent, color:cs.color, opacidad:cs.opacity, z:+cs.zIndex }; });
 const o={};
 o.registrada=await p.evaluate(()=>({ apps:!!IX_APPS.find(a=>a.id==='mesita'), switcher:!!APP_SWITCHER_REGISTRY.find(a=>a.id==='mesita' && typeof window[a.fn]==='function') }));
 o.dia=await ver();
 o.wake1=await p.evaluate(()=>Object.assign({},window.__wake));
 // Pasa el minuto
 await p.clock.runFor(60*1000);
 o.minuto=await ver();
 // Tocar cierra
 await p.click('#ix-mesita',{timeout:3000}).catch(()=>{});
 await p.waitForTimeout(200);
 o.trasTocar=await ver();
 o.wake2=await p.evaluate(()=>Object.assign({},window.__wake));
 // De noche, y sin alarmas
 await p.evaluate(()=>{ _icaAlarms.length=0; localStorage.setItem('ica_alarms','[]'); try{ alarms.length=0; }catch(e){} });
 await p.clock.setSystemTime(new Date('2026-10-01T23:15:00-04:00'));
 await p.evaluate(()=>ixAbrirMesita());
 await p.clock.runFor(1500);
 o.noche=await ver();
 // Esc cierra
 await p.keyboard.press('Escape');
 await p.waitForTimeout(200);
 o.trasEsc=await ver();
 // «Cerrar todas las ventanas» también
 await p.evaluate(()=>ixAbrirMesita());
 await p.evaluate(()=>{ try{ ixCerrarTodasLasVentanas(); }catch(e){} });
 await p.waitForTimeout(200);
 o.trasCerrarTodo=await ver();
 await b.close(); srv.close();

 const pruebas=[
  ['está en la lista de apps y en el conmutador', o.registrada.apps && o.registrada.switcher, JSON.stringify(o.registrada)],
  ['se abre a pantalla completa, por encima',   !!o.dia && o.dia.visible && o.dia.z>1e9, JSON.stringify(o.dia&&{v:o.dia.visible,z:o.dia.z})],
  ['la hora es la de ahora (12:34)',             !!o.dia && o.dia.hora==='12:34', o.dia&&o.dia.hora],
  ['con la fecha',                               !!o.dia && /octubre/i.test(o.dia.fecha||''), o.dia&&o.dia.fecha],
  ['sale la próxima alarma',                     !!o.dia && /7:30/.test(o.dia.extra||''), o.dia&&o.dia.extra],
  ['y el tiempo',                                !!o.dia && /27°/.test(o.dia.extra||''), o.dia&&o.dia.extra],
  ['de día: blanco',                             !!o.dia && !/255, 59, 48/.test(o.dia.color), o.dia&&o.dia.color],
  ['la hora cambia sola al pasar el minuto',     !!o.minuto && o.minuto.hora==='12:35', o.minuto&&o.minuto.hora],
  ['pide que la pantalla no se apague',          o.wake1.pedidas>=1, JSON.stringify(o.wake1)],
  ['tocar lo cierra y suelta la pantalla',       !!o.trasTocar && !o.trasTocar.visible && o.wake2.soltadas>=1, JSON.stringify(o.wake2)],
  ['DE NOCHE: rojo',                             !!o.noche && /255, 59, 48/.test(o.noche.color), o.noche&&o.noche.color],
  ['y más tenue',                                !!o.noche && +o.noche.opacidad<+o.dia.opacidad, o.noche&&(o.noche.opacidad+' < '+o.dia.opacidad)],
  ['sin alarmas lo dice',                        !!o.noche && /Sin alarmas/.test(o.noche.extra||''), o.noche&&o.noche.extra],
  ['Esc lo cierra',                              !!o.trasEsc && !o.trasEsc.visible, o.trasEsc&&o.trasEsc.visible],
  ['«cerrar todas las ventanas» también',        !!o.trasCerrarTodo && !o.trasCerrarTodo.visible, o.trasCerrarTodo&&o.trasCerrarTodo.visible],
  ['sin errores de página',                      errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
