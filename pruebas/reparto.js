// Dividir la cuenta en la Calculadora (idea 55).
//
// Lo delicado no es la pantalla, son los CÉNTIMOS: con decimales normales,
// 110 entre 3 da 36,666… y al redondear o sobra o falta un céntimo. Aquí se
// comprueba que el reparto CUADRA SIEMPRE (lo que paga cada uno, sumado, es
// exactamente el total con propina) y que la pantalla dice quién paga el
// céntimo de más o cuánto sobra al redondear.
//
// La parte de pantalla se hace como una persona: elegir el modo en el menú,
// escribir el total con el teclado, tocar la propina y los botones − y +.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9268);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1200,height:1000},locale:'es-ES'});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9268/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof switchCalcMode==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 const o={};

 // ═══ LAS CUENTAS ═══
 o.casos=await p.evaluate(()=>{
   if(typeof ixDividirCuenta!=='function') return null;
   const cuadra=(r)=>{ if(!r) return false;
     const c=Math.round(r.porPersona*100), tot=Math.round(r.total*100), sobra=Math.round(r.sobra*100);
     return c*r.personas + r.conCentimoMas === tot + sobra; };
   const casos=[
     ['100 +10% entre 3',   ixDividirCuenta(100,10,3,false)],
     ['19,99 +15% entre 4', ixDividirCuenta(19.99,15,4,false)],
     ['0,10 entre 3',       ixDividirCuenta(0.1,0,3,false)],
     ['100 +10% entre 3 redondeando', ixDividirCuenta(100,10,3,true)],
     ['87,45 +20% entre 7', ixDividirCuenta(87.45,20,7,false)],
   ];
   return { lista:casos.map(([n,r])=>({n, r, cuadra:cuadra(r)})),
            cero:ixDividirCuenta(0,10,3,false), vacio:ixDividirCuenta('',10,3,false),
            cienPersonas:(ixDividirCuenta(100,0,500,false)||{}).personas, ceroPersonas:(ixDividirCuenta(100,0,0,false)||{}).personas };
 });

 // ═══ LA PANTALLA, COMO UNA PERSONA ═══
 await p.evaluate(()=>{ if(typeof toggleCalcPanel==='function') toggleCalcPanel(); });
 await p.waitForTimeout(500);
 await p.selectOption('#calc-mode','split',{timeout:3000}).catch(()=>{});
 await p.waitForTimeout(300);
 o.visible=await p.evaluate(()=>{ const el=document.getElementById('calc-split'); return !!el && getComputedStyle(el).display!=='none'; });
 o.vacio=await p.evaluate(()=>(document.getElementById('split-resultado')||{}).innerText||'');
 try{ await p.click('#split-total',{timeout:3000}); await p.keyboard.type('100'); }catch(e){}
 await p.waitForTimeout(200);
 o.con10=await p.evaluate(()=>(document.getElementById('split-resultado')||{}).innerText||'');
 try{ await p.click('#split-propinas button:has-text("20 %")',{timeout:3000}); }catch(e){}
 try{ await p.click('button[aria-label="Una persona más"]',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(200);
 o.con20y3=await p.evaluate(()=>({ txt:(document.getElementById('split-resultado')||{}).innerText||'',
   personas:(document.getElementById('split-personas')||{}).textContent,
   pulsada:[].slice.call(document.querySelectorAll('#split-propinas button')).filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.textContent) }));
 try{ await p.check('#split-redondear',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(200);
 o.redondeo=await p.evaluate(()=>(document.getElementById('split-resultado')||{}).innerText||'');
 // − no baja de 1
 for(let i=0;i<6;i++){ try{ await p.click('button[aria-label="Una persona menos"]',{timeout:2000}); }catch(e){} }
 o.minimo=await p.evaluate(()=>(document.getElementById('split-personas')||{}).textContent);
 // El número de la calculadora básica se puede traer
 o.traer=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   if(typeof ixSplitUsarCalculadora!=='function') return null;
   calcVal='42.5'; ixSplitUsarCalculadora(); await w(100);
   return (document.getElementById('split-total')||{}).value;
 });
 await b.close(); srv.close();

 const c=o.casos||{lista:[]};
 const caso=n=>(c.lista.find(x=>x.n===n)||{}).r||{};
 const pruebas=[
  ['existe la función del reparto',          !!o.casos, !!o.casos],
  ['100 +10% entre 3 = 36,66',               caso('100 +10% entre 3').porPersona===36.66 && caso('100 +10% entre 3').total===110, JSON.stringify(caso('100 +10% entre 3'))],
  ['y 2 personas pagan un céntimo más',      caso('100 +10% entre 3').conCentimoMas===2, caso('100 +10% entre 3').conCentimoMas],
  ['EL REPARTO CUADRA en todos los casos',   c.lista.length===5 && c.lista.every(x=>x.cuadra), c.lista.map(x=>x.n+':'+x.cuadra).join(' | ')],
  ['19,99 +15%: propina redondeada al céntimo', caso('19,99 +15% entre 4').propina===3, JSON.stringify(caso('19,99 +15% entre 4'))],
  ['redondeando: 37 cada uno y sobra 1',     caso('100 +10% entre 3 redondeando').porPersona===37 && caso('100 +10% entre 3 redondeando').sobra===1, JSON.stringify(caso('100 +10% entre 3 redondeando'))],
  ['sin total no inventa nada',              c.cero===null && c.vacio===null, JSON.stringify([c.cero,c.vacio])],
  ['personas entre 1 y 99',                  c.cienPersonas===99 && c.ceroPersonas===1, c.cienPersonas+' '+c.ceroPersonas],
  ['PANTALLA: el modo sale en el menú',      o.visible===true, o.visible],
  ['sin total pide escribirlo',              /Escribe el total/.test(o.vacio), o.vacio],
  ['escribiendo 100 (10%, 2): 55,00',        /55,00/.test(o.con10) && /110,00/.test(o.con10), o.con10.replace(/\n/g,' ')],
  ['20% y 3 personas: 40,00',                /40,00/.test(o.con20y3.txt) && o.con20y3.personas==='3', o.con20y3.txt.replace(/\n/g,' ')],
  ['el botón de propina se marca',           o.con20y3.pulsada.length===1 && /20/.test(o.con20y3.pulsada[0]), JSON.stringify(o.con20y3.pulsada)],
  ['− no baja de 1 persona',                 o.minimo==='1', o.minimo],
  ['trae el número de la calculadora',       o.traer==='42.5', o.traer],
  ['sin errores de página',                  errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
