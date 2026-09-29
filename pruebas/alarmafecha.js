// Un recordatorio con fecha suena SOLO ese día, y una sola vez.
//
// Había dos comprobadores de alarmas de la app Reloj funcionando a la vez.
// El viejo (cada 5 s) miraba solo la hora: un recordatorio para el día 5 a
// las 9:00 sonaba el día 1, el 2, el 3... a las 9:00, y el día 5 podía sonar
// dos veces. Aquí se mueve el reloj del navegador de verdad (sin tocar el
// código de la app) y se cuenta cuántas veces suena cada alarma.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9272);

const ALARMAS=[
  {time:'9:00', label:'Recordatorio del 5', on:true, tone:'radial', fecha:'2026-10-05'},
  {time:'9:00', label:'Diaria', on:true, tone:'radial'},
];

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1200,height:900}, timezoneId:'America/Santo_Domingo'});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.clock.install({time:new Date('2026-10-01T08:58:00-04:00')});
 await p.addInitScript(a=>{ try{ if(!sessionStorage.getItem('s')){ localStorage.setItem('ica_alarms',a); sessionStorage.setItem('s','1'); } }catch(e){} }, JSON.stringify(ALARMAS));
 await p.goto('http://localhost:9272/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ringAlarm==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 // Cuántas veces suena cada una. Se cuenta y se silencia al momento.
 await p.evaluate(()=>{
   window.__suena=[]; window.__hist=[];
   const orig=window.ringAlarm;
   window.ringAlarm=function(a){ window.__suena.push(a.label); };
   const h=window.icaAddToHistory;
   window.icaAddToHistory=function(t,l){ window.__hist.push(l); };
 });
 const cuenta=()=>p.evaluate(()=>{ const c={}; window.__suena.forEach(l=>c[l]=(c[l]||0)+1); window.__suena=[]; const h=window.__hist.slice(); window.__hist=[]; return {c,h}; });

 const o={};
 // Día 1: de 8:59 a 9:02
 await p.clock.setSystemTime(new Date('2026-10-01T08:59:30-04:00'));
 await p.clock.runFor(3*60*1000);
 o.dia1=await cuenta();
 // Día 2
 await p.clock.setSystemTime(new Date('2026-10-02T08:59:30-04:00'));
 await p.clock.runFor(3*60*1000);
 o.dia2=await cuenta();
 // Día 5: el suyo
 await p.clock.setSystemTime(new Date('2026-10-05T08:59:30-04:00'));
 await p.clock.runFor(3*60*1000);
 o.dia5=await cuenta();
 o.trasSonar=await p.evaluate(()=>_icaAlarms.map(a=>({l:a.label,on:a.on})));
 // Día 6: ya no
 await p.clock.setSystemTime(new Date('2026-10-06T08:59:30-04:00'));
 await p.clock.runFor(3*60*1000);
 o.dia6=await cuenta();
 await b.close(); srv.close();

 const R='Recordatorio del 5', D='Diaria';
 const pruebas=[
  ['día 1: el recordatorio del 5 NO suena',  !o.dia1.c[R], JSON.stringify(o.dia1.c)],
  ['día 1: la diaria suena UNA vez',         o.dia1.c[D]===1, JSON.stringify(o.dia1.c)],
  ['día 2: el recordatorio sigue sin sonar', !o.dia2.c[R] && o.dia2.c[D]===1, JSON.stringify(o.dia2.c)],
  ['DÍA 5: el recordatorio suena UNA vez',   o.dia5.c[R]===1, JSON.stringify(o.dia5.c)],
  ['y la diaria también una sola',           o.dia5.c[D]===1, JSON.stringify(o.dia5.c)],
  ['después se apaga solo',                  o.trasSonar.find(a=>a.l===R).on===false && o.trasSonar.find(a=>a.l===D).on===true, JSON.stringify(o.trasSonar)],
  ['día 6: el recordatorio ya no suena',     !o.dia6.c[R] && o.dia6.c[D]===1, JSON.stringify(o.dia6.c)],
  ['cada vez que suena queda en el historial', o.dia5.h.filter(l=>l===R).length===1 && o.dia1.h.filter(l=>l===D).length===1, JSON.stringify([o.dia1.h,o.dia5.h])],
  ['sin errores de página',                  errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
