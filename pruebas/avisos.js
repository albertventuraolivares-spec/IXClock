// Avisos del sistema, pantalla encendida, y el fallo que hacia inutil lo
// primero.
//
// Hasta ahora una alarma solo sonaba con la app abierta y delante. Pero poner
// una notificacion no arregla nada por si solo: la comprobacion de alarmas
// exigia que el tic cayera justo en el segundo 0, y con la pestaña de fondo el
// navegador frena ese temporizador, asi que el minuto de la alarma se saltaba
// y NO sonaba. Eso es lo que mas se prueba aqui.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9238);

async function arranca(ctx){
  const p=await ctx.newPage();
  p.on('pageerror',e=>{ p._errs=p._errs||[]; p._errs.push(e.message.split('\n')[0]); });
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:9238/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof ixNotificar==='function' && typeof checkIcaAlarms==='function',
    null,{timeout:30000}).catch(()=>{});
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
  try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
  await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
    return !l || getComputedStyle(l).display==='none'; },null,{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(1800);
  await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
  return p;
}

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 // Sin permiso concedido: se prueba primero que sin permiso NO se manda nada.
 const ctx=await b.newContext({viewport:{width:1280,height:1000}});
 let p=await arranca(ctx);
 const o={};

 // --- sin permiso, ixNotificar no manda nada y no revienta ---
 o.sinPermiso = await p.evaluate(()=>{
   let mandadas=0;
   const orig=window.Notification;
   function Falsa(){ mandadas++; }
   Falsa.permission='default';
   Falsa.requestPermission=()=>Promise.resolve('default');
   window.Notification=Falsa;
   const r=ixNotificar('x','y','z');
   window.Notification=orig;
   return { devuelve:r, mandadas };
 });

 // --- el boton de Configuracion dice en qué estado estás ---
 o.boton = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const orig=window.Notification;
   function F(){}
   F.permission='default'; F.requestPermission=()=>Promise.resolve('default');
   window.Notification=F;
   ixNotifPintar(); await w(100);
   const pidiendo=document.getElementById('cfg-notif-btn').textContent;
   F.permission='granted';
   ixNotifPintar(); await w(100);
   const dado=document.getElementById('cfg-notif-btn').textContent;
   const textoDado=document.getElementById('cfg-notif-txt').textContent;
   F.permission='denied';
   ixNotifPintar(); await w(100);
   const negado=document.getElementById('cfg-notif-btn').textContent;
   const textoNegado=document.getElementById('cfg-notif-txt').textContent;
   window.Notification=undefined;
   ixNotifPintar(); await w(100);
   const sinSoporte=document.getElementById('cfg-notif-btn').textContent;
   window.Notification=orig;
   ixNotifPintar();
   return { pidiendo, dado, negado, sinSoporte, textoDado, textoNegado };
 });

 // --- con permiso, una alarma que suena manda el aviso ---
 o.alarma = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const orig=window.Notification;
   const enviadas=[];
   function F(t,op){ enviadas.push({t, body:op&&op.body, tag:op&&op.tag}); }
   F.permission='granted';
   window.Notification=F;
   // sin service worker en la prueba, cae al camino clasico
   const sw=navigator.serviceWorker;
   Object.defineProperty(navigator,'serviceWorker',{value:undefined, configurable:true});
   try{ ringAlarm({id:'t1', hour:7, minute:30, label:'gimnasio', tone:'radial'}); }catch(e){}
   await w(400);
   try{ if(typeof stopAlarmRinging==='function') stopAlarmRinging(); }catch(e){}
   try{ if(typeof ringingAudioStop==='function') ringingAudioStop(); }catch(e){}
   Object.defineProperty(navigator,'serviceWorker',{value:sw, configurable:true});
   window.Notification=orig;
   return { n:enviadas.length, titulo:(enviadas[0]||{}).t, cuerpo:(enviadas[0]||{}).body };
 });

 // --- EL FALLO GORDO: el minuto se comprueba aunque el tic no caiga en :00 ---
 o.minuto = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   _icaAlarms.length=0;
   _icaAlarms.push({time:'9:00', label:'x', on:true, tone:'radial'});
   _icaFired={};
   let n=0; const orig=window.ringAlarm; window.ringAlarm=()=>{ n++; };
   // el tic cae en el segundo 37, que es lo normal con la pestaña de fondo
   _ixMinIca=null;
   checkIcaAlarms(new Date(2026,8,15,9,0,37));
   const conSegundo37=n;
   // y no suena dos veces en el mismo minuto aunque se compruebe otra vez
   checkIcaAlarms(new Date(2026,8,15,9,0,52));
   const noRepite=n===conSegundo37;
   // el minuto siguiente ya no es el suyo
   checkIcaAlarms(new Date(2026,8,15,9,1,10));
   const otroMinuto=n===conSegundo37;
   window.ringAlarm=orig;
   return { conSegundo37, noRepite, otroMinuto };
 });

 // --- y se recuperan hasta DOS minutos perdidos, no ocho horas ---
 o.recupera = await p.evaluate(()=>{
   const r1=_ixMinutosPendientes(new Date(2026,8,15,9,0,0), null);
   const base=Math.floor(new Date(2026,8,15,9,0,0).getTime()/60000);
   const r2=_ixMinutosPendientes(new Date(2026,8,15,9,2,30), base);
   const r3=_ixMinutosPendientes(new Date(2026,8,15,17,0,0), base);
   const r4=_ixMinutosPendientes(new Date(2026,8,15,9,0,50), base);
   return { primeraVez:r1.lista.length, dosPerdidos:r2.lista.length,
            ochoHoras:r3.lista.length, mismoMinuto:r4.lista.length };
 });

 // --- una alarma diaria SUENA de verdad con el tic descolocado ---
 o.diaria = await p.evaluate(()=>{
   alarms.length=0;
   alarms.push({id:'v', hour:9, minute:0, label:'vieja', enabled:true});
   let n=0; const orig=window.ringAlarm; window.ringAlarm=()=>{ n++; };
   _ixMinAlarms=null;
   checkAlarms(new Date(2026,8,15,9,0,44));
   window.ringAlarm=orig;
   alarms.length=0;
   return n;
 });

 // --- el TEMPORIZADOR va por reloj, no por tics ---
 o.timer = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const real=Date.now; let salto=0;
   Date.now=()=>real()+salto;
   let sono=0; const orig=window.ringAlarm; window.ringAlarm=()=>{ sono++; };
   _icaTimerArrancar(600);                 // 10 minutos
   const alEmpezar=_icaTimerRemaining;
   salto=9*60000;                          // pasan 9 minutos de reloj
   await w(1200);
   const aLos9=_icaTimerRemaining;
   salto=11*60000;                         // y se pasa de los 10
   await w(1300);
   const sonoAlFinal=sono;
   const paro=_icaTimerInterval===null;
   Date.now=real; window.ringAlarm=orig;
   try{ icaTimerCancel(); }catch(e){}
   return { alEmpezar, aLos9, sonoAlFinal, paro };
 });

 // --- pantalla encendida: se guarda y el botón lo dice ---
 o.pantalla = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   let pedidas=0, sueltas=0;
   const orig=navigator.wakeLock;
   Object.defineProperty(navigator,'wakeLock',{configurable:true, value:{
     request:()=>{ pedidas++; return Promise.resolve({ release(){ sueltas++; }, addEventListener(){} }); }
   }});
   localStorage.removeItem('ix_pantalla_siempre');
   _ixWakeQuiere=false; _ixWake=null;
   const on=ixPantallaSiempre(); await w(300);
   const textoOn=document.getElementById('cfg-wake-btn').textContent;
   const guardadoOn=localStorage.getItem('ix_pantalla_siempre');
   const off=ixPantallaSiempre(); await w(300);
   const guardadoOff=localStorage.getItem('ix_pantalla_siempre');
   Object.defineProperty(navigator,'wakeLock',{configurable:true, value:orig});
   return { on, off, pedidas, sueltas, textoOn, guardadoOn, guardadoOff };
 });

 // --- sin soporte, lo dice en vez de fingir ---
 o.sinWakeLock = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const orig=navigator.wakeLock;
   Object.defineProperty(navigator,'wakeLock',{configurable:true, value:undefined});
   _ixWakeQuiere=false;
   const r=ixPantallaSiempre(); await w(150);
   ixWakePintar();
   const t=document.getElementById('cfg-wake-btn').textContent;
   Object.defineProperty(navigator,'wakeLock',{configurable:true, value:orig});
   return { devuelve:r, texto:t };
 });

 // --- SOBREVIVE a recargar ---
 await p.evaluate(()=>localStorage.setItem('ix_pantalla_siempre','1'));
 await p.close();
 p = await arranca(ctx);
 o.trasRecargar = await p.evaluate(()=>({
   quiere:_ixWakeQuiere,
   boton:document.getElementById('cfg-wake-btn').textContent
 }));
 const errs=p._errs||[];
 await p.close();

 const pruebas=[
  ['sin permiso no manda nada',   o.sinPermiso.mandadas===0 && o.sinPermiso.devuelve===false, JSON.stringify(o.sinPermiso)],
  ['el botón pide permiso',       /permitir/i.test(o.boton.pidiendo||''),  o.boton.pidiendo],
  ['dice cuándo están activados', /activados/i.test(o.boton.dado||''),     o.boton.dado],
  ['y dice lo que NO puede hacer',/cerrado del todo/i.test(o.boton.textoDado||''), o.boton.textoDado],
  ['dice cuándo están bloqueados',/bloqueados/i.test(o.boton.negado||''),  o.boton.negado],
  ['y cómo desbloquearlos',       /ajustes del navegador/i.test(o.boton.textoNegado||''), o.boton.textoNegado],
  ['sin soporte, lo dice',        /no tiene avisos/i.test(o.boton.sinSoporte||''), o.boton.sinSoporte],
  ['una alarma manda el aviso',   o.alarma.n===1,                          o.alarma.titulo],
  ['con la etiqueta y la hora',   /gimnasio/.test(o.alarma.titulo||'') && /7:30|07:30/.test(o.alarma.cuerpo||''), o.alarma.titulo+' / '+o.alarma.cuerpo],
  ['SUENA con el tic en :37',     o.minuto.conSegundo37===1,               o.minuto.conSegundo37],
  ['sin repetir en el mismo minuto', o.minuto.noRepite===true,             o.minuto.noRepite],
  ['y no suena al minuto siguiente', o.minuto.otroMinuto===true,           o.minuto.otroMinuto],
  ['la alarma vieja también',     o.diaria===1,                            o.diaria],
  ['la primera vez mira 1 minuto',o.recupera.primeraVez===1,               o.recupera.primeraVez],
  ['recupera 2 minutos perdidos', o.recupera.dosPerdidos===2,              o.recupera.dosPerdidos],
  ['pero NO ocho horas',          o.recupera.ochoHoras===3,                o.recupera.ochoHoras+' minutos (tope 3)'],
  ['dentro del mismo minuto, nada', o.recupera.mismoMinuto===0,            o.recupera.mismoMinuto],
  ['TEMPORIZADOR: empieza entero',o.timer.alEmpezar===600,                 o.timer.alEmpezar],
  ['va por reloj, no por tics',   o.timer.aLos9>=55 && o.timer.aLos9<=65,  o.timer.aLos9+' s a los 9 min'],
  ['y suena al pasarse',          o.timer.sonoAlFinal===1 && o.timer.paro===true, JSON.stringify(o.timer)],
  ['PANTALLA: se enciende',       o.pantalla.on===true && o.pantalla.pedidas>=1, JSON.stringify(o.pantalla)],
  ['el botón lo dice',            /tocar para apagar/i.test(o.pantalla.textoOn||''), o.pantalla.textoOn],
  ['y se apaga',                  o.pantalla.off===false && o.pantalla.sueltas>=1, o.pantalla.sueltas],
  ['se guarda',                   o.pantalla.guardadoOn==='1' && o.pantalla.guardadoOff==='0', o.pantalla.guardadoOn+'/'+o.pantalla.guardadoOff],
  ['sin soporte, lo dice',        o.sinWakeLock.devuelve===false && /no disponible/i.test(o.sinWakeLock.texto||''), o.sinWakeLock.texto],
  ['SOBREVIVE a recargar',        o.trasRecargar.quiere===true,            o.trasRecargar.boton],
  ['sin errores de página',       errs.length===0,                         errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
