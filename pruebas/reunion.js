// La mejor hora para quedar (idea 31).
//
// El comparador de horas ya decía qué hora es en cada ciudad a una hora tuya,
// pero había que ir probando hora a hora. Ahora dice él solo la franja en que
// TODAS las ciudades (y la tuya) están en horario bueno, y la marca en la
// tira de horas. Casos hechos a mano, con el navegador en Santo Domingo
// (UTC−4) el 1 de octubre de 2026:
//  · con Madrid (UTC+2, 6 h por delante): buena para todos de 09:00 a 13:00;
//  · con Tokio (13 h por delante) no hay hora de trabajo común; lo menos
//    malo, sin nadie durmiendo: 07:00–10:00 y 18:00–23:00;
//  · con Tokio, Londres y Los Ángeles no hay hora sin alguien durmiendo.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9277);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1200,height:900}, timezoneId:'America/Santo_Domingo', locale:'es-ES'});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.clock.install({time:new Date('2026-10-01T10:00:00-04:00')});
 await p.goto('http://localhost:9277/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof icaPintarComparador==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 const caso=zonas=>p.evaluate(zonas=>{
   _icaWorldClocks=zonas.slice();
   _icaCompAbierto=false; icaToggleComparador();
   const c=document.getElementById('ica-comparador');
   const mejor=document.getElementById('ica-comp-mejor');
   const buenas=[].slice.call(c.querySelectorAll('button[data-buena="1"]')).map(b=>+b.textContent);
   return { texto:mejor?mejor.textContent:'', buenas };
 }, zonas);
 const o={};
 o.madrid=await caso(['Europe/Madrid']);
 o.tokio=await caso(['Asia/Tokyo']);
 o.imposible=await caso(['Asia/Tokyo','Europe/London','America/Los_Angeles']);
 await b.close(); srv.close();

 const pruebas=[
  ['MADRID: buena para todos 09:00–13:00',    /Buena hora para todos/.test(o.madrid.texto) && /09:00–13:00/.test(o.madrid.texto), o.madrid.texto],
  ['y se marcan esas horas en la tira',        JSON.stringify(o.madrid.buenas)==='[9,10,11,12]', JSON.stringify(o.madrid.buenas)],
  ['TOKIO: no hay hora de trabajo común',      /No hay hora de trabajo para todos/.test(o.tokio.texto) && o.tokio.buenas.length===0, o.tokio.texto],
  ['y da lo menos malo: 07:00–10:00 · 18:00–23:00', /07:00–10:00 · 18:00–23:00/.test(o.tokio.texto), o.tokio.texto],
  ['TOKIO+LONDRES+L.A.: alguien siempre duerme', /durmiendo/.test(o.imposible.texto), o.imposible.texto],
  ['sin errores de página',                    errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
