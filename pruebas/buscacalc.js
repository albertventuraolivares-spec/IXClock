// El buscador global tambien calcula y cambia divisas.
//
// Lo facil es que salga el resultado. Lo dificil, y lo que se prueba aqui, es
// que NO salga cuando no toca: escribir "7" buscando una nota no puede
// soltarte "7 = 7" delante de lo que buscabas, y "150 xyz a abc" no es una
// conversion. Y que siga sin ejecutar codigo, que el evaluador es el mismo que
// se acaba de cerrar en Notas Matematicas.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9245);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1280,height:1000}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 p.on('dialog',d=>{ p._alerta=true; d.dismiss(); });
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9245/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixCalculoRapido==='function' && typeof ixBuscarTodo==='function',
   null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const o={};

 // --- CUENTAS ---
 o.cuentas = await p.evaluate(()=>{
   const casos=[['23*4','92'],['(7+3)/2','5'],['2^10','1024'],['100-35','65'],
                ['10%3','1'],['1.5*4','6'],['sqrt(144)+1','13'],['-4*2','-8']];
   return casos.map(([q,esperado])=>{
     const r=ixCalculoRapido(q);
     return { q, esperado, sale:r?r.titulo:null, ok:!!r && r.titulo===esperado };
   });
 });

 // --- lo que NO debe dar resultado ---
 o.noCuenta = await p.evaluate(()=>{
   const casos=['7','notas','radio','2026','clima madrid','alarma 7','hola','',
                'a=alert(1)','fetch("x")','1+1;window.__pwn=1','`${1+1}`'];
   return casos.map(q=>({ q, r:!!ixCalculoRapido(q) }));
 });

 // --- y sobre todo: no ejecuta nada ---
 o.seguridad = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__pwn=0;
   ['a=alert(1)','1+alert(1)','1+window.__pwn=1','[].constructor',
    'Function("window.__pwn=1")()','1+`${window.__pwn=1}`','eval("1+1")']
     .forEach(q=>{ try{ ixCalculoRapido(q); }catch(e){} });
   await w(400);
   return window.__pwn;
 });

 // --- DIVISAS ---
 o.divisas = await p.evaluate(()=>{
   if(!_ixRates) _ixRates=IX_RATES_FALLBACK;
   const casos=['150 usd a eur','150usd eur','100 EUR to USD','20 dolares en pesos',
                '1 btc a usd','1.500,50 usd a eur','1,500.50 usd a eur'];
   return casos.map(q=>{
     const r=ixCalculoRapido(q);
     return { q, titulo:r?r.titulo:null, sub:r?r.sub:null, hay:!!r };
   });
 });

 // --- la cuenta de la conversión es la MISMA que la de la calculadora ---
 o.mismaCuenta = await p.evaluate(()=>{
   if(!_ixRates) _ixRates=IX_RATES_FALLBACK;
   const r=ixCalculoRapido('150 usd a eur');
   const aMano=_ixFmt(150*(_ixRates.EUR/_ixRates.USD),'EUR')+' EUR';
   return { delBuscador:r?r.titulo:null, aMano, iguales:!!r && r.titulo===aMano };
 });

 // --- los dos formatos de número dan lo mismo ---
 o.numeros = await p.evaluate(()=>({
   europeo:_ixNumero('1.500,50'), americano:_ixNumero('1,500.50'),
   simple:_ixNumero('1500.5'), coma:_ixNumero('150,5'),
   milEuropeo:_ixNumero('1.500'), basura:_ixNumero('abc')
 }));

 // --- monedas que no existen: nada ---
 o.monedaMala = await p.evaluate(()=>({
   inventada: !!ixCalculoRapido('150 xyz a abc'),
   mismaMoneda: !!ixCalculoRapido('150 usd a usd'),
   sinNumero: !!ixCalculoRapido('usd a eur')
 }));

 // --- sale EL PRIMERO en el buscador, no al final ---
 o.enElBuscador = await p.evaluate(()=>{
   const r1=ixBuscarTodo('23*4');
   const r2=ixBuscarTodo('150 usd a eur');
   const r3=ixBuscarTodo('radio');
   return { cuentaPrimero: r1.length>0 && r1[0].grupo==='Resultado' && r1[0].titulo==='92',
            divisaPrimero: r2.length>0 && r2[0].grupo==='Resultado',
            sinCuentaNoSale: r3.every(x=>x.grupo!=='Resultado'),
            siguenLasApps: ixBuscarTodo('radio').length>1 };
 });

 // --- tocar el resultado abre la calculadora con los datos puestos ---
 o.abrir = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const r=ixCalculoRapido('150 usd a eur');
   r.ir(); await w(700);
   const amt=document.getElementById('currency-amount');
   const f=document.getElementById('currency-from'), t=document.getElementById('currency-to');
   const res=document.getElementById('currency-result');
   const out={ cantidad:amt?amt.value:null, de:f?f.value:null, a:t?t.value:null,
               resultado:res?res.textContent:null, modo:(typeof calcMode!=='undefined'?calcMode:null) };
   try{ if(calcPanelOpen) toggleCalcPanel(); }catch(e){}
   return out;
 });

 // --- un texto raro en la consulta no se ejecuta al pintarlo ---
 o.xss = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__pwn=0;
   ixAbrirBusqueda(); await w(400);
   const inp=document.getElementById('ix-busq-inp');
   inp.value='<img src=x onerror="window.__pwn=1">*2';
   ixPintarBusqueda(inp.value); await w(500);
   const r=window.__pwn;
   try{ ixCerrarBusqueda(); }catch(e){}
   return r;
 });

 const alerta=p._alerta===true;
 await p.close();

 const cuentasMal=o.cuentas.filter(c=>!c.ok);
 const falsosPositivos=o.noCuenta.filter(c=>c.r);
 const divisasMal=o.divisas.filter(d=>!d.hay);

 const pruebas=[
  ['CUENTAS: todas bien',         cuentasMal.length===0,     cuentasMal.map(c=>c.q+' → '+c.sale).join(' | ')||'8 de 8'],
  ['un número suelto NO es cuenta',falsosPositivos.length===0, falsosPositivos.map(c=>c.q).join(' | ')||'ninguno'],
  ['y NO ejecuta nada',           o.seguridad===0 && alerta===false, o.seguridad],
  ['DIVISAS: las 7 formas salen', divisasMal.length===0,     divisasMal.map(d=>d.q).join(' | ')||'7 de 7'],
  ['da lo mismo que la calculadora', o.mismaCuenta.iguales===true, o.mismaCuenta.delBuscador+' vs '+o.mismaCuenta.aMano],
  ['dice la tasa usada',          /1 USD = /.test(o.divisas[0].sub||''), o.divisas[0].sub],
  ['1.500,50 y 1,500.50 son igual', o.numeros.europeo===1500.5 && o.numeros.americano===1500.5, o.numeros.europeo+' / '+o.numeros.americano],
  ['1.500 son mil quinientos',    o.numeros.milEuropeo===1500, o.numeros.milEuropeo],
  ['y una basura no es número',   isNaN(o.numeros.basura),   o.numeros.basura],
  ['una moneda inventada, nada',  o.monedaMala.inventada===false, o.monedaMala.inventada],
  ['la misma moneda, nada',       o.monedaMala.mismaMoneda===false, o.monedaMala.mismaMoneda],
  ['sin número, nada',            o.monedaMala.sinNumero===false, o.monedaMala.sinNumero],
  ['sale EL PRIMERO en el buscador', o.enElBuscador.cuentaPrimero===true && o.enElBuscador.divisaPrimero===true, JSON.stringify(o.enElBuscador)],
  ['y no estorba al buscar normal', o.enElBuscador.sinCuentaNoSale===true && o.enElBuscador.siguenLasApps===true, o.enElBuscador.sinCuentaNoSale],
  ['tocarlo abre la calculadora', o.abrir.modo==='currency', o.abrir.modo],
  ['con los datos ya puestos',    String(o.abrir.cantidad)==='150' && o.abrir.de==='USD' && o.abrir.a==='EUR', JSON.stringify(o.abrir)],
  ['y el mismo resultado',        /EUR/.test(o.abrir.resultado||''), o.abrir.resultado],
  ['una consulta con código no se ejecuta', o.xss===0, o.xss],
  ['sin errores de página',       errs.length===0,           errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
