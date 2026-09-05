// Las teclas de la calculadora, dichas en voz alta. Y el «=» sin ejecutar código.
//
// Dos cosas que parecían una sola:
//
// 1) ACCESIBILIDAD. `pruebas/acceso.js` daba las teclas de operación por buenas
//    porque TIENEN texto. Pero tener texto y poder leerse no es lo mismo: un
//    lector de pantalla con «×» dice «signo de multiplicación» o se lo salta,
//    «−» (el menos matemático, no el guion) muchos no lo dicen, y «.» o «+/-»
//    no significan nada dichos sueltos. `pruebas/calidad.js` sí las cazaba: 9
//    botones sin nombre.
//
// 2) EL «=». Usaba Function() con la expresión entera. Hoy solo pueden llegar
//    dígitos y operadores del teclado fijo, así que NO era explotable — eso hay
//    que decirlo tal cual, sin inflarlo. Pero bastaba con que algo metiera
//    texto en calcVal para que pasara a ejecutar código. Ahora lo filtra
//    `_mathSeguro`, el mismo que ya guarda las Notas Matemáticas.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9253);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1280,height:1000}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9253/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof renderCalcGrid==='function' && typeof calcEq==='function',
   null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const o={};

 // ═══════════ NOMBRES DE LAS TECLAS ═══════════
 o.teclado = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   toggleCalcPanel(); await w(700);
   const lee=sel=>[].slice.call(document.querySelectorAll(sel)).map(b=>({
     t:(b.textContent||'').trim(), n:b.getAttribute('aria-label')
   }));
   const basica=lee('#calc-basic button');
   const sciT=lee('#calc-sci-top button');
   const sciB=lee('#calc-sci-bot button');
   return { basica, sciT, sciB };
 });

 // Los 9 que sacaba calidad.js, uno por uno y por su nombre esperado.
 const ESPERADO={'+/-':'Cambiar el signo','%':'Por ciento','÷':'Dividir',
                 '×':'Multiplicar','−':'Restar','+':'Sumar','=':'Igual',
                 '.':'Coma decimal','AC':'Borrar todo'};
 o.losNueve = Object.keys(ESPERADO).map(function(k){
   const b=o.teclado.basica.find(x=>x.t===k);
   return { tecla:k, tiene: !!b && b.n===ESPERADO[k], puesto: b?b.n:'NO ESTÁ' };
 });

 // Y ninguna tecla se queda sin nombre en las tres rejillas.
 o.sinNombre = []
   .concat(o.teclado.basica, o.teclado.sciT, o.teclado.sciB)
   .filter(x=>!x.n).map(x=>x.t);

 // Los números NO se renombran: «7» ya se lee bien y ponerle «siete» sería
 // duplicar. El nombre tiene que ser el propio dígito.
 o.numeros = ['7','0','3'].map(function(d){
   const b=o.teclado.basica.find(x=>x.t===d);
   return { d, n:b?b.n:null };
 });

 // ═══════════ Y EL TECLADO NO SE DUPLICA ═══════════
 // Encontrado tirando del hilo de esta misma prueba: decia «30 teclas» donde
 // solo hay 15. renderCalcGrid() se llama en CADA apertura del panel y vaciaba
 // la rejilla basica pero no las dos cientificas, asi que crecian 15 y 16
 // botones por apertura. A la decima vez habia mas de trescientos apilados.
 o.duplicado = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const n=()=>({top:document.querySelectorAll('#calc-sci-top button').length,
                 bot:document.querySelectorAll('#calc-sci-bot button').length,
                 basica:document.querySelectorAll('#calc-basic button').length});
   const una=n();
   for(let i=0;i<3;i++){ toggleCalcPanel(); await w(250); toggleCalcPanel(); await w(250); }
   toggleCalcPanel(); await w(500);
   return { una, cuatro:n() };
 });

 // ═══════════ QUE LA CALCULADORA SIGA CALCULANDO ═══════════
 // Lo importante de un filtro nuevo: que no rompa lo que ya funcionaba.
 o.cuentas = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const hacer=async(a,op,c)=>{
     calcExprStr=''; calcVal='0'; calcJustResult=false;
     String(a).split('').forEach(d=>calcDigit(d));
     calcOp(op);
     String(c).split('').forEach(d=>calcDigit(d));
     calcEq(); await w(60);
     return calcVal;
   };
   return {
     suma:      await hacer(12,'+',30),
     resta:     await hacer(50,'-',8),
     por:       await hacer(7,'*',6),
     entre:     await hacer(90,'/',4),
     entreCero: await hacer(5,'/',0),
   };
 });

 // Con coma decimal, que es el camino que pasa por el punto.
 o.decimal = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   calcExprStr=''; calcVal='0'; calcJustResult=false;
   calcDigit('1'); calcVal+='.'; calcDigit('5');
   calcOp('*'); calcDigit('2');
   calcEq(); await w(60);
   return calcVal;
 });

 // ═══════════ EL «=» NO EJECUTA CÓDIGO ═══════════
 // Se mete a mano en calcVal lo que hoy no puede llegar por las teclas, que es
 // justo el escenario del que protege el filtro.
 o.seguridad = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__ixColado=false;
   const probar=async(expr)=>{
     calcExprStr=''; calcJustResult=false; calcVal=expr;
     calcEq(); await w(60);
     return calcVal;
   };
   const r={};
   r.asigna   = await probar('(window.__ixColado=true)');
   r.alerta   = await probar('alert(1)');
   r.fetch    = await probar('fetch("//x")');
   r.consCtor = await probar('constructor.constructor("return 1")()');
   r.colado   = window.__ixColado;
   // y una cuenta normal después: el filtro no deja la calculadora tonta
   calcExprStr=''; calcVal='0'; calcJustResult=false;
   calcDigit('8'); calcOp('+'); calcDigit('9'); calcEq(); await w(60);
   r.sigueSumando = calcVal;
   return r;
 });

 await p.close(); await b.close(); srv.close();

 const nueveMal = o.losNueve.filter(x=>!x.tiene);
 const pruebas=[
  ['las 9 teclas que salían sin nombre ya lo tienen', nueveMal.length===0,
     nueveMal.map(x=>x.tecla+'→'+x.puesto).join(' | ')||'las 9'],
  ['«×» se dice Multiplicar',   (o.teclado.basica.find(x=>x.t==='×')||{}).n==='Multiplicar', (o.teclado.basica.find(x=>x.t==='×')||{}).n],
  ['«−» se dice Restar',        (o.teclado.basica.find(x=>x.t==='−')||{}).n==='Restar',      (o.teclado.basica.find(x=>x.t==='−')||{}).n],
  ['«.» se dice Coma decimal',  (o.teclado.basica.find(x=>x.t==='.')||{}).n==='Coma decimal',(o.teclado.basica.find(x=>x.t==='.')||{}).n],
  ['ninguna tecla se queda muda',o.sinNombre.length===0, o.sinNombre.slice(0,6).join(' ')||'ninguna'],
  ['los números se quedan como están', o.numeros.every(x=>x.n===x.d), JSON.stringify(o.numeros)],
  ['también la científica tiene nombres', o.teclado.sciT.length===15 && o.teclado.sciT.every(x=>!!x.n), o.teclado.sciT.length+' teclas'],
  ['√ se dice Raíz cuadrada',   (o.teclado.sciT.find(x=>x.t==='√')||{}).n==='Raíz cuadrada', (o.teclado.sciT.find(x=>x.t==='√')||{}).n],
  ['la científica tiene sus 15 teclas', o.duplicado.una.top===15, o.duplicado.una.top],
  ['abrir 4 veces NO las duplica',  o.duplicado.cuatro.top===o.duplicado.una.top
                                 && o.duplicado.cuatro.bot===o.duplicado.una.bot, JSON.stringify(o.duplicado)],
  ['y la básica sigue igual',       o.duplicado.cuatro.basica===o.duplicado.una.basica, o.duplicado.cuatro.basica],
  ['SIGUE SUMANDO   12+30',     o.cuentas.suma==='42',      o.cuentas.suma],
  ['restando        50−8',      o.cuentas.resta==='42',     o.cuentas.resta],
  ['multiplicando   7×6',       o.cuentas.por==='42',       o.cuentas.por],
  ['dividiendo      90÷4',      o.cuentas.entre==='22.5',   o.cuentas.entre],
  ['dividir entre 0 da Error',  o.cuentas.entreCero==='Error', o.cuentas.entreCero],
  ['y con decimales 1.5×2',     o.decimal==='3',            o.decimal],
  ['SEGURIDAD: no asigna nada', o.seguridad.asigna==='Error' && o.seguridad.colado===false, o.seguridad.asigna+' colado='+o.seguridad.colado],
  ['no llama a alert',          o.seguridad.alerta==='Error',   o.seguridad.alerta],
  ['no llama a fetch',          o.seguridad.fetch==='Error',    o.seguridad.fetch],
  ['ni por constructor.constructor', o.seguridad.consCtor==='Error', o.seguridad.consCtor],
  ['y después sigue sumando 8+9',o.seguridad.sigueSumando==='17', o.seguridad.sigueSumando],
  ['sin errores de página',     errs.length===0,            errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})();
