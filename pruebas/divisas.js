// Divisas: historial de 30 días con mini-gráfico (idea 42) y avisos de cambio
// (idea 41).
//
// Los dos servicios de fuera (open.er-api para el cambio de hoy, Frankfurter
// para la serie) se sustituyen por respuestas preparadas. Se comprueba:
//  · USD→EUR pinta la línea de 30 días, con la subida en % y el mín./máx.;
//  · se guarda para el día: volver a mirarlo no pide nada otra vez;
//  · una moneda que el BCE no publica (DOP) lo dice en vez de un gráfico vacío;
//  · un aviso que se cumple AVISA (sistema/centro de avisos) y se quita solo;
//    uno que no se cumple se queda;
//  · con las tasas de respaldo (sin conexión) NO avisa: serían inventadas;
//  · y con un aviso pendiente, al abrir la app se comprueba solo, sin tocar
//    la calculadora.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9290);

const TASAS={USD:1, EUR:0.86, JPY:150, DOP:60, MXN:18, GBP:0.75};
let pidenHist=[];
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1300,height:1000}, locale:'es-ES'});
 const montar=async(inicial)=>{
   const p=await ctx.newPage();
   const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
   await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
   await p.route(/open\.er-api\.com/, r=>r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({result:'success', rates:TASAS})}));
   await p.route(/api\.frankfurter\.app/, r=>{
     const u=new URL(r.request().url()); pidenHist.push(u.pathname+u.search);
     const to=u.searchParams.get('to');
     if(to==='DOP') return r.fulfill({status:404, contentType:'application/json', body:'{"message":"not found"}'});
     const rates={}; ['2026-09-01','2026-09-08','2026-09-15','2026-09-22','2026-09-29'].forEach((d,i)=>{ rates[d]={}; rates[d][to]=+(0.84+i*0.005).toFixed(3); });
     r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({base:u.searchParams.get('from'), rates})});
   });
   if(inicial) await p.addInitScript(inicial);
   await p.goto('http://localhost:9290/',{waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>typeof convertCurrency==='function',null,{timeout:30000}).catch(()=>{});
   await p.waitForTimeout(2500);
   await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
   try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
   await p.waitForTimeout(1500);
   await p.evaluate(()=>{ try{ ixCerrarBienvenida(); }catch(e){} });
   return {p, errs};
 };
 const o={};
 // ═══ 1: historial y avisos a mano ═══
 {
   const {p, errs}=await montar(()=>{ try{ ['ix_cur_hist_v1','ix_cur_alertas_v1','ix_rates','ix_avisos_v1'].forEach(k=>localStorage.removeItem(k)); localStorage.setItem('ix_cur_pair','["USD","EUR"]'); }catch(e){} });
   o.falta=await p.evaluate(()=>typeof ixDivisaHistorial!=='function');
   const ver=()=>p.evaluate(()=>{ const c=document.getElementById('currency-hist'); return { txt:c?c.innerText.replace(/\s+/g,' '):'', linea:!!(c&&c.querySelector('polyline')) }; });
   await p.evaluate(async()=>{ if(document.getElementById('calc-panel').style.opacity!=='1') toggleCalcPanel(); document.getElementById('calc-mode').value='currency'; switchCalcMode('currency'); });
   await p.waitForTimeout(1500);
   o.hist=await ver();
   o.pedidas1=pidenHist.length;
   // Otra vez: sale de lo guardado
   await p.evaluate(async()=>{ _ixHistPedido=''; convertCurrency(); });
   await p.waitForTimeout(600);
   o.pedidas2=pidenHist.length;
   // DOP
   await p.evaluate(()=>{ document.getElementById('currency-to').value='DOP'; convertCurrency(); });
   await p.waitForTimeout(800);
   o.dop=await ver();
   // Avisos
   o.avisos=await p.evaluate(async()=>{
     const w=m=>new Promise(r=>setTimeout(r,m));
     document.getElementById('currency-to').value='EUR'; convertCurrency(); await w(200);
     window.__not=[]; const orig=window.ixNotificar; window.ixNotificar=function(t,c){ window.__not.push(t+' | '+c); return orig(t,c); };
     await _ixLoadRates();
     ixDivisaCrearAlerta('USD','EUR','<',0.85);   // hoy 0,86: no se cumple
     ixDivisaCrearAlerta('USD','EUR','>',0.80);   // se cumple
     const filasAntes=document.querySelectorAll('#currency-alertas .currency-alerta').length;
     const n=ixDivisaComprobarAlertas();
     const quedan=ixDivisaAlertas();
     // Con tasas de respaldo NO se avisa
     _ixRatesLive=false; ixDivisaCrearAlerta('USD','EUR','>',0.5);
     const conRespaldo=ixDivisaComprobarAlertas();
     _ixRatesLive=true;
     return { filasAntes, avisados:n, not:window.__not.slice(), quedan:quedan.map(a=>a.dir+a.valor), conRespaldo,
              centro:(JSON.parse(localStorage.getItem('ix_avisos_v1')||'[]')[0]||{}).titulo };
   });
   o.errs1=errs.slice();
   await p.close();
 }
 // ═══ 2: al abrir la app, un aviso pendiente se comprueba solo ═══
 {
   const {p, errs}=await montar(()=>{ try{ if(!sessionStorage.getItem('s')){ localStorage.removeItem('ix_rates'); localStorage.removeItem('ix_avisos_v1'); localStorage.setItem('ix_cur_alertas_v1', JSON.stringify([{f:'USD',t:'JPY',dir:'>',valor:140,creada:1}])); sessionStorage.setItem('s','1'); } }catch(e){} });
   await p.waitForTimeout(4000);
   o.solo=await p.evaluate(()=>({ quedan:ixDivisaAlertas().length, centro:(JSON.parse(localStorage.getItem('ix_avisos_v1')||'[]')[0]||{}).titulo||'' }));
   o.errs2=errs.slice();
   await p.close();
 }
 await b.close(); srv.close();

 const errs=(o.errs1||[]).concat(o.errs2||[]);
 const a=o.avisos||{};
 const pruebas=[
  ['existe',                                         !o.falta, !o.falta],
  ['USD→EUR: pinta la línea de 30 días',              o.hist.linea===true, o.hist.txt],
  ['con la subida en % (0,84 → 0,86: +2,4 %)',        /↗ \+2,4 %/.test(o.hist.txt), o.hist.txt],
  ['y el mínimo y el máximo',                         /min 0,84/.test(o.hist.txt) && /max 0,86/.test(o.hist.txt), o.hist.txt],
  ['se guarda del día: no vuelve a pedirlo',          o.pedidas1===1 && o.pedidas2===1, o.pedidas1+' → '+o.pedidas2],
  ['DOP (el BCE no la publica) lo dice',              /Sin historial/.test(o.dop.txt) && !o.dop.linea, o.dop.txt],
  ['los avisos creados se ven',                       a.filasAntes===2, a.filasAntes],
  ['el que se cumple AVISA',                          a.avisados===1 && (a.not||[]).length===1 && /1 USD = 0,86 EUR/.test(a.not[0]) && /subido de 0,8/.test(a.not[0]), JSON.stringify(a.not)],
  ['y se quita; el que no, se queda',                 JSON.stringify(a.quedan)===JSON.stringify(['<0.85']), JSON.stringify(a.quedan)],
  ['queda en el centro de avisos',                    /💱 1 USD/.test(a.centro||''), a.centro],
  ['con tasas de respaldo NO avisa',                  a.conRespaldo===0, a.conRespaldo],
  ['AL ABRIR LA APP se comprueba solo',               o.solo.quedan===0 && /💱 1 USD = 150 JPY/.test(o.solo.centro), JSON.stringify(o.solo)],
  ['sin errores de página',                           errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
