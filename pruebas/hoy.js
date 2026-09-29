// Tarea en Modo Enfoque + «Hoy en IXClocK» (idea 63).
//
// Con el reloj de la página controlado (un pomodoro de 25 min pasa en un
// momento) y la pantalla de verdad:
//  · el Modo Enfoque tiene un campo «¿En qué vas a trabajar?» que se guarda;
//  · la sesión que TERMINA se apunta con su tarea; saltar no apunta nada;
//  · debajo sale «Hoy: Tesis 50 min · Correo 25 min», de más a menos;
//  · la tarea se escapa (es texto del usuario);
//  · la radio cuenta el tiempo que suena, y no cuenta si está parada;
//  · la app Avisos enseña «Hoy en IXClocK» con enfoque (y en qué), alarmas
//    que sonaron hoy y minutos de radio; sin nada de hoy, no sale la tarjeta.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9296);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1300,height:1000}, locale:'es-ES'});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.clock.install({time:new Date('2026-09-29T10:00:00')});
 await p.addInitScript(()=>{ try{ ['ix_enfoque_v1','ix_enfoque_hist_v1','ica_alarm_history','ix_radio_hoy_v1','ix_avisos_v1'].forEach(k=>localStorage.removeItem(k)); }catch(e){} });
 await p.goto('http://localhost:9296/',{waitUntil:'domcontentloaded'});
 await p.clock.runFor(4000);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.clock.runFor(2000);
 const o={};
 o.falta=await p.evaluate(()=>{ try{ ixCerrarBienvenida(); }catch(e){} return typeof ixHoyResumen!=='function'; });
 if(!o.falta){
   // Avisos sin nada de hoy: no hay tarjeta
   o.vacio=await p.evaluate(()=>{ ixAbrirAvisos(); const h=!!document.getElementById('ix-hoy'); ixAvisosCerrar(); return h; });
   // ── Enfoque con tarea ──
   await p.evaluate(()=>{ window.playAlarmTone=function(){ return function(){}; }; ixAbrirEnfoque(); });
   await p.fill('#enf-tarea','Tesis');
   await p.clock.fastForward(25*60000); await p.clock.runFor(2000);            // termina la 1.ª: Tesis 25
   await p.clock.fastForward(5*60000); await p.clock.runFor(2000);             // descanso
   await p.clock.fastForward(25*60000); await p.clock.runFor(2000);            // termina la 2.ª: Tesis 25
   await p.clock.fastForward(5*60000); await p.clock.runFor(2000);
   await p.fill('#enf-tarea','Correo <b>urgente</b>');
   await p.clock.fastForward(25*60000); await p.clock.runFor(2000);            // termina la 3.ª: Correo 25
   await p.clock.fastForward(5*60000); await p.clock.runFor(2000);
   await p.evaluate(()=>{ ixEnfoqueSaltar(); ixEnfoqueSaltar(); });   // saltar NO apunta
   await p.clock.runFor(1500);
   o.enf=await p.evaluate(()=>{
     const t=document.getElementById('enf-tareas');
     return { linea:t?t.textContent:'', html:t?t.innerHTML:'', negrita:!!(t&&t.querySelector('b')),
              hist:JSON.parse(localStorage.getItem('ix_enfoque_hist_v1')||'[]').map(x=>x.tarea+':'+x.m),
              guardada:JSON.parse(localStorage.getItem('ix_enfoque_v1')||'{}').tarea };
   });
   // La tarea sigue al volver a abrir
   o.reabre=await p.evaluate(()=>{ ixEnfoqueSalir(); document.getElementById('ix-enfoque').innerHTML=''; ixAbrirEnfoque(); const v=document.getElementById('enf-tarea').value; ixEnfoqueSalir(); return v; });
   // ── Radio: 10 min sonando, 10 parada ──
   o.radio=await p.evaluate(()=>{ isPlaying=true; return true; });
   // En saltos de 30 s, como el contador (saltar 10 min de golpe sería una
   // pestaña dormida, y esa tiene tope a propósito).
   for(let i=0;i<20;i++) await p.clock.fastForward(30000);
   await p.evaluate(()=>{ isPlaying=false; });
   for(let i=0;i<20;i++) await p.clock.fastForward(30000);
   o.radioMin=await p.evaluate(()=>ixHoyResumen().radioMin);
   // ── Una alarma hoy y otra de otro día ──
   await p.evaluate(()=>{
     icaAddToHistory('7:00 a. m.','Despertar');
     const h=JSON.parse(localStorage.getItem('ica_alarm_history')||'[]');
     h.push({time:'8:00 a. m.', label:'Vieja', date:'1/1/2020'});
     localStorage.setItem('ica_alarm_history', JSON.stringify(h));
   });
   o.tarjeta=await p.evaluate(()=>{ ixAbrirAvisos(); const c=document.getElementById('ix-hoy'); return c ? c.innerText : ''; });
 }
 await b.close(); srv.close();

 const e=o.enf||{};
 const pruebas=[
  ['existe',                                          !o.falta, !o.falta],
  ['sin nada de hoy, no hay tarjeta',                 o.vacio===false, o.vacio],
  ['la tarea se guarda',                              e.guardada==='Correo <b>urgente</b>', e.guardada],
  ['cada sesión TERMINADA se apunta con su tarea',    JSON.stringify(e.hist)==='["Correo <b>urgente</b>:25","Tesis:25","Tesis:25"]', JSON.stringify(e.hist)],
  ['«Hoy: Tesis 50 min · Correo… 25 min»',            e.linea==='Hoy: Tesis 50 min · Correo <b>urgente</b> 25 min', e.linea],
  ['la tarea se escapa',                              e.negrita===false && /&lt;b&gt;/.test(e.html||''), e.html],
  ['sigue puesta al volver a abrir',                  o.reabre==='Correo <b>urgente</b>', o.reabre],
  ['la radio cuenta solo lo que suena (10 min)',      o.radioMin===10, o.radioMin],
  ['Avisos: «Hoy en IXClocK»',                        /Hoy en IXClocK/i.test(o.tarjeta||''), JSON.stringify(o.tarjeta)],
  ['· con el enfoque y en qué',                       /3 sesiones de enfoque · 1 h 15 min \(Tesis 50 min, Correo <b>urgente<\/b> 25 min\)/.test(o.tarjeta||''), o.tarjeta],
  ['· con las alarmas de HOY (no las viejas)',        /1 alarma sonó/.test(o.tarjeta||''), o.tarjeta],
  ['· y la radio',                                    /10 min de radio/.test(o.tarjeta||''), o.tarjeta],
  ['sin errores de página',                           errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
