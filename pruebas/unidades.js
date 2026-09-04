// Una sola fuente para las divisas.
//
// La app tenia DOS conversores de divisas con tablas distintas: el de
// Calculadora -> Divisas, que baja las tasas del dia, y el de Calculadora ->
// Conversion -> Divisas, con siete monedas escritas a mano y congeladas. Se
// contradecian hasta un 2,5%, y en cuanto llegaban las tasas reales la
// diferencia crecia sin limite, porque una se actualizaba y la otra no.
//
// Lo que se prueba: que las dos den EXACTAMENTE lo mismo, incluso despues de
// que lleguen tasas nuevas. Y que el conversor de unidades normal (metros,
// kilos, grados) siga funcionando igual que siempre.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9248);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1000,height:1000}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9248/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof convertUnits==='function' && typeof _unitDivisasAlDia==='function',
   null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 // se abre la calculadora, que es donde vive todo esto
 await p.evaluate(()=>{ try{ if(!calcPanelOpen) toggleCalcPanel(); }catch(e){} });
 await p.waitForTimeout(600);

 const o={};

 // --- LAS DOS TABLAS DICEN LO MISMO ---
 o.coinciden = await p.evaluate(()=>{
   if(!_ixRates) _ixRates=IX_RATES_FALLBACK;
   _unitDivisasAlDia();
   const malas=[];
   IX_CURRENCIES.forEach(c=>{
     const cod=c[0];
     const enUnidades=UNIT_DATA.currency.base[cod];
     if(enUnidades===undefined) return;
     const porUSD_unidades = 1/enUnidades;
     const porUSD_divisas  = _ixRates[cod];
     if(Math.abs(porUSD_unidades-porUSD_divisas) > Math.abs(porUSD_divisas)*1e-9)
       malas.push(cod+': '+porUSD_unidades+' vs '+porUSD_divisas);
   });
   return { malas, cuantas:Object.keys(UNIT_DATA.currency.base).length };
 });

 // --- y siguen coincidiendo cuando llegan tasas NUEVAS ---
 o.trasTasasNuevas = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   // llegan tasas del dia, bien distintas de las de respaldo
   _ixRates = Object.assign({}, IX_RATES_FALLBACK, {EUR:0.80, DOP:75, JPY:190, BRL:6.9});
   _ixRatesLive = true;
   document.getElementById('unit-category').value='currency';
   loadUnitCategory(); await w(300);
   const malas=[];
   ['EUR','DOP','JPY','BRL'].forEach(c=>{
     const porUSD = 1/UNIT_DATA.currency.base[c];
     if(Math.abs(porUSD-_ixRates[c]) > _ixRates[c]*1e-9) malas.push(c+': '+porUSD+' vs '+_ixRates[c]);
   });
   return malas;
 });

 // --- convertir de verdad da el mismo numero en los dos sitios ---
 o.mismoResultado = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   // Primero la pestaña de DIVISAS: al abrirla, initCurrencyCalc reinicia las
   // tasas antes de ir a buscarlas. Si se midiera al reves, se compararian dos
   // momentos distintos y el desajuste seria de la prueba, no de la app.
   switchCalcMode('currency'); await w(600);
   document.getElementById('currency-from').value='USD';
   document.getElementById('currency-to').value='DOP';
   document.getElementById('currency-amount').value='150';
   convertCurrency(); await w(250);
   const porDivisas=document.getElementById('currency-result').textContent;
   const tasa=_ixRates.DOP;                 // la que se acaba de usar
   const r=ixCalculoRapido('150 usd a dop');
   // y ahora, con esas mismas tasas, por el conversor de UNIDADES
   switchCalcMode('unit'); await w(400);
   document.getElementById('unit-category').value='currency';
   loadUnitCategory(); await w(250);
   document.getElementById('unit-from').value='USD';
   document.getElementById('unit-to').value='DOP';
   document.getElementById('unit-val-from').value='150';
   convertUnits('from'); await w(250);
   const porUnidades=parseFloat(document.getElementById('unit-val-to').value);
   const formula=document.getElementById('unit-formula').textContent;
   return { porUnidades, porDivisas, porBuscador:r?r.titulo:null,
            esperado:150*tasa, formula };
 });

 // --- el aviso de si son del día o aproximadas ---
 o.aviso = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   switchCalcMode('unit'); await w(300);
   document.getElementById('unit-category').value='currency';
   loadUnitCategory(); await w(250);
   _ixRatesLive=true; convertUnits('from'); await w(200);
   const conRed=document.getElementById('unit-formula').textContent;
   _ixRatesLive=false; convertUnits('from'); await w(200);
   const sinRed=document.getElementById('unit-formula').textContent;
   return { conRed, sinRed };
 });

 // --- salen MUCHAS más monedas que las 7 de antes ---
 o.cuantas = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   document.getElementById('unit-category').value='currency';
   loadUnitCategory(); await w(250);
   const f=document.getElementById('unit-from');
   return { enElMenu:f.options.length,
            hayDOP:[].slice.call(f.options).some(o=>o.value==='DOP'||o.text==='DOP'),
            hayCLP:[].slice.call(f.options).some(o=>o.value==='CLP'||o.text==='CLP') };
 });

 // --- y las unidades NORMALES siguen exactamente igual ---
 o.normales = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const casos=[
     ['length','km','m',1,1000],
     ['length','mi','km',1,1.609344],
     ['weight','kg','lb',1,2.204623],
     ['temp','°C','°F',100,212],
     ['temp','°F','°C',32,0],
     ['speed','km/h','m/s',36,10],
     ['volume','L','mL',2,2000]
   ];
   const out=[];
   for(const [cat,de,a,val,esperado] of casos){
     document.getElementById('unit-category').value=cat;
     loadUnitCategory(); await w(160);
     document.getElementById('unit-from').value=de;
     document.getElementById('unit-to').value=a;
     document.getElementById('unit-val-from').value=String(val);
     convertUnits('from'); await w(160);
     const sale=parseFloat(document.getElementById('unit-val-to').value);
     out.push({ caso:val+' '+de+' → '+a, sale, esperado,
                ok: Math.abs(sale-esperado) < Math.max(0.01, Math.abs(esperado)*0.001) });
   }
   return out;
 });

 // --- sin tasas ninguna no revienta ---
 o.sinTasas = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const guardadas=_ixRates;
   _ixRates=null;
   let revento=false;
   try{ _unitDivisasAlDia(); document.getElementById('unit-category').value='currency';
        loadUnitCategory(); convertUnits('from'); }catch(e){ revento=true; }
   await w(250);
   const hayAlgo=Object.keys(UNIT_DATA.currency.base).length>1;
   _ixRates=guardadas;
   return { revento, hayAlgo };
 });

 await p.close();

 const normalesMal=o.normales.filter(n=>!n.ok);

 const pruebas=[
  ['LAS DOS TABLAS COINCIDEN',    o.coinciden.malas.length===0, o.coinciden.malas.slice(0,3).join(' | ')||o.coinciden.cuantas+' monedas, todas iguales'],
  ['y siguen igual con tasas nuevas', o.trasTasasNuevas.length===0, o.trasTasasNuevas.join(' | ')||'las 4 iguales'],
  ['convertir da lo mismo por unidades', Math.abs(o.mismoResultado.porUnidades-o.mismoResultado.esperado)<0.01, o.mismoResultado.porUnidades+' (esperado '+o.mismoResultado.esperado+')'],
  ['y por el conversor de divisas',   new RegExp(String(Math.round(o.mismoResultado.esperado))).test(o.mismoResultado.porDivisas||''), o.mismoResultado.porDivisas],
  ['y por el buscador',               new RegExp(String(Math.round(o.mismoResultado.esperado))).test(o.mismoResultado.porBuscador||''), o.mismoResultado.porBuscador],
  ['dice si son del día',         /del día/i.test(o.aviso.conRed||''),  o.aviso.conRed],
  ['o que son aproximadas',       /aproximadas/i.test(o.aviso.sinRed||''), o.aviso.sinRed],
  ['ahora hay muchas más monedas',o.cuantas.enElMenu>=40,   o.cuantas.enElMenu+' (antes 7)'],
  ['incluido el peso dominicano', o.cuantas.hayDOP===true && o.cuantas.hayCLP===true, JSON.stringify(o.cuantas)],
  ['LAS UNIDADES NORMALES IGUAL', normalesMal.length===0,   normalesMal.map(n=>n.caso+' → '+n.sale).join(' | ')||'7 de 7'],
  ['sin tasas no revienta',       o.sinTasas.revento===false && o.sinTasas.hayAlgo===true, JSON.stringify(o.sinTasas)],
  ['sin errores de página',       errs.length===0,          errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
