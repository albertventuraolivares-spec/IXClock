// Alarma con la hora de otra ciudad (idea 23): «despiértame a las 9 de Tokio».
//
// El navegador está en Santo Domingo (UTC−4) y Tokio va 13 horas por delante,
// así que las 9:00 de Tokio son las 20:00 del DÍA ANTERIOR aquí. Se comprueba
// con la hoja de verdad (elegir ciudad, hora, guardar) y moviendo el reloj:
//  · la hoja avisa «Aquí sonará a las 20:00» antes de guardar;
//  · la lista dice de qué ciudad es la hora y cuándo suena aquí;
//  · suena a las 20:00 de aquí, y NO a las 9:00 de aquí;
//  · con fecha, la fecha que cuenta es la de Tokio;
//  · sin ciudades en el reloj mundial, la hoja lo explica en vez de un
//    selector vacío; y una alarma normal sigue igual.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9274);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1200,height:900}, timezoneId:'America/Santo_Domingo'});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.clock.install({time:new Date('2026-10-01T12:00:00-04:00')});
 await p.addInitScript(()=>{ try{ if(!sessionStorage.getItem('s')){ localStorage.setItem('ica_alarms','[]'); localStorage.setItem('ica_world_clocks','[]'); sessionStorage.setItem('s','1'); } }catch(e){} });
 await p.goto('http://localhost:9274/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof icaAddAlarm==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 const o={};

 // ═══ SIN CIUDADES: la hoja lo explica ═══
 o.sinCiudades=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   icaAddAlarm(); await w(150);
   const r={ select:!!document.getElementById('ica-alarm-tz'), texto:(document.getElementById('ica-alarm-sheet')||{}).innerText||'' };
   _icaCerrarHoja(); return r;
 });

 // ═══ CON TOKIO: la hoja de verdad ═══
 await p.evaluate(()=>{ _icaWorldClocks=['Asia/Tokyo']; localStorage.setItem('ica_world_clocks','["Asia/Tokyo"]'); icaAddAlarm(); });
 await p.waitForTimeout(200);
 o.opciones=await p.evaluate(()=>[].slice.call(document.querySelectorAll('#ica-alarm-tz option')).map(x=>x.textContent));
 await p.selectOption('#ica-alarm-h','09').catch(()=>{});
 await p.selectOption('#ica-alarm-m','00').catch(()=>{});
 await p.selectOption('#ica-alarm-tz','Asia/Tokyo').catch(()=>{});
 await p.fill('#ica-alarm-label','Llamar a Tokio').catch(()=>{});
 await p.waitForTimeout(100);
 o.aviso=await p.evaluate(()=>(document.getElementById('ica-alarm-tz-aviso')||{}).textContent||'');
 await p.evaluate(()=>icaGuardarAlarma());
 await p.waitForTimeout(200);
 o.guardada=await p.evaluate(()=>_icaAlarms[_icaAlarms.length-1]);
 o.lista=await p.evaluate(()=>{ const z=document.querySelector('#ica-alarms-list .ica-alarm-zona'); return z?z.innerText:''; });

 // Una normal a las 9:00 de aquí, y una con fecha en Tokio
 await p.evaluate(()=>{
   _icaAlarms.push({time:'9:00', label:'Normal', on:true, tone:'radial'});
   _icaAlarms.push({time:'9:00', label:'Tokio día 3', on:true, tone:'radial', tz:'Asia/Tokyo', fecha:'2026-10-03'});
   _icaAlarms.push({time:'10:00', label:'Zona rota', on:true, tone:'radial', tz:'Marte/Olimpo'});
   localStorage.setItem('ica_alarms', JSON.stringify(_icaAlarms));
   window.__suena=[]; window.ringAlarm=function(a){ window.__suena.push(a.label); };
 });
 const cuenta=async(desde)=>{ await p.clock.setSystemTime(new Date(desde)); await p.clock.runFor(100*1000);
   return p.evaluate(()=>{ const r=window.__suena.slice(); window.__suena=[]; return r; }); };
 o.a09aqui   = await cuenta('2026-10-01T08:59:30-04:00');   // 9:00 aquí = 22:00 Tokio
 o.a20aqui   = await cuenta('2026-10-01T19:59:30-04:00');   // 20:00 aquí = 9:00 Tokio del día 2
 o.dia2a20   = await cuenta('2026-10-02T19:59:30-04:00');   // 9:00 Tokio del día 3
 o.dia3a09   = await cuenta('2026-10-03T08:59:30-04:00');   // día 3 aquí, 22:00 Tokio
 o.rota      = await cuenta('2026-10-03T09:59:30-04:00');   // zona inválida → hora de aquí
 await b.close(); srv.close();

 const n=(arr,l)=>arr.filter(x=>x===l).length;
 const pruebas=[
  ['sin ciudades: lo explica, sin selector vacío', !o.sinCiudades.select && /Reloj mundial/.test(o.sinCiudades.texto), JSON.stringify(o.sinCiudades.select)],
  ['con ciudades: «Aquí» y Tokio para elegir',   o.opciones.length===2 && /Aquí/.test(o.opciones[0]) && /Tokio|Tokyo/.test(o.opciones[1]), o.opciones.join(' | ')],
  ['la hoja avisa: aquí sonará a las 20:00',     /20:00/.test(o.aviso), o.aviso],
  ['se guarda con la zona',                      !!o.guardada && o.guardada.tz==='Asia/Tokyo' && o.guardada.time==='9:00', JSON.stringify(o.guardada)],
  ['la lista dice «Hora de Tokio · aquí 20:00»', /Tokio|Tokyo/.test(o.lista) && /20:00/.test(o.lista), o.lista],
  ['a las 9:00 de AQUÍ no suena la de Tokio',    n(o.a09aqui,'Llamar a Tokio')===0, JSON.stringify(o.a09aqui)],
  ['pero la normal sí, una vez',                 n(o.a09aqui,'Normal')===1, JSON.stringify(o.a09aqui)],
  ['a las 20:00 de aquí SUENA la de Tokio, una vez', n(o.a20aqui,'Llamar a Tokio')===1 && n(o.a20aqui,'Normal')===0, JSON.stringify(o.a20aqui)],
  ['con fecha: la del día 3 de Tokio suena el 2 a las 20:00 de aquí', n(o.dia2a20,'Tokio día 3')===1, JSON.stringify(o.dia2a20)],
  ['y NO el día 3 de aquí',                      n(o.dia3a09,'Tokio día 3')===0, JSON.stringify(o.dia3a09)],
  ['una zona rota cuenta como hora de aquí',     n(o.rota,'Zona rota')===1, JSON.stringify(o.rota)],
  ['sin errores de página',                      errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
