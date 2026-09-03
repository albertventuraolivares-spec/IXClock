// Tema claro / oscuro. Lo importante no es que el boton cambie de color, sino
// que en claro se LEA: antes el 98% del texto seguia siendo casi blanco.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9221);

// Cuenta el texto visible que queda casi blanco: en claro deberia ser casi cero.
const CUENTA = `(()=>{ let total=0,malos=0;
  document.querySelectorAll('*').forEach(e=>{
    if(e.children.length) return;
    const t=(e.textContent||'').trim(); if(t.length<2) return;
    const r=e.getBoundingClientRect(); if(!r.width||!r.height) return;
    total++;
    const m=(getComputedStyle(e).color||'').match(/\\d+/g); if(!m) return;
    const l=(+m[0]*.2126 + +m[1]*.7152 + +m[2]*.0722)/255;
    if(l>0.62) malos++;
  });
  return {total:total, malos:malos, pct:Math.round(malos*100/total)};
})()`;

async function arranca(ctx,url){
  const p=await ctx.newPage();
  p.on('pageerror',e=>{ p._errs=p._errs||[]; p._errs.push(e.message.split('\n')[0]); });
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto(url,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof setMode==='function',
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
const URL='http://localhost:9221/';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1280,height:900}});
 let p=await arranca(ctx,URL);
 const o={};

 // --- de serie, oscuro ---
 o.arrancaOscuro = await p.evaluate(()=>!document.body.classList.contains('light-mode'));
 const oscuro = await p.evaluate(CUENTA);
 o.oscuroBlanco = oscuro.pct;     // en oscuro el texto claro es lo NORMAL

 // --- los cuatro modos existen ---
 o.cuatroModos = await p.evaluate(()=>
   ['mode-oscuro','mode-claro','mode-auto','mode-sol'].every(i=>!!document.getElementById(i)));

 // --- claro: cambia de verdad y SE LEE ---
 await p.evaluate(()=>setMode('light',document.getElementById('mode-claro')));
 await p.waitForTimeout(900);
 o.aplicaClaro = await p.evaluate(()=>document.body.classList.contains('light-mode'));
 const claro = await p.evaluate(CUENTA);
 o.claroBlanco = claro.pct;
 o.detalleClaro = claro.malos+' de '+claro.total;
 o.fondoClaro = await p.evaluate(()=>{
   const m=(getComputedStyle(document.body).backgroundColor||'').match(/\d+/g);
   if(!m) return false;
   return (+m[0]*.2126 + +m[1]*.7152 + +m[2]*.0722)/255 > 0.6;   // fondo claro de verdad
 });
 o.colorScheme = await p.evaluate(()=>document.documentElement.style.colorScheme);
 o.themeColor = await p.evaluate(()=>{
   const m=document.querySelector('meta[name="theme-color"]'); return m?m.getAttribute('content'):'';
 });

 // --- y se GUARDA: al recargar sigue en claro (antes se perdia) ---
 o.guardado = await p.evaluate(()=>localStorage.getItem('ix_modo'));
 await p.close();
 p = await arranca(ctx,URL);
 o.sigueTrasRecargar = await p.evaluate(()=>document.body.classList.contains('light-mode'));
 o.botonMarcado = await p.evaluate(()=>document.getElementById('mode-claro').classList.contains('active'));

 // --- volver a oscuro tambien se guarda ---
 await p.evaluate(()=>setMode('dark',document.getElementById('mode-oscuro')));
 await p.waitForTimeout(500);
 o.vuelveOscuro = await p.evaluate(()=>!document.body.classList.contains('light-mode'));
 await p.close();

 // --- «como el sistema»: con el sistema en claro, la app en claro ---
 const ctxClaro=await b.newContext({viewport:{width:1280,height:900},colorScheme:'light'});
 let p2=await arranca(ctxClaro,URL);
 await p2.evaluate(()=>setMode('auto',document.getElementById('mode-auto')));
 await p2.waitForTimeout(700);
 o.sistemaClaro = await p2.evaluate(()=>document.body.classList.contains('light-mode'));
 await p2.close(); await ctxClaro.close();
 // --- y con el sistema en oscuro, la app en oscuro ---
 const ctxOsc=await b.newContext({viewport:{width:1280,height:900},colorScheme:'dark'});
 let p3=await arranca(ctxOsc,URL);
 await p3.evaluate(()=>setMode('auto',document.getElementById('mode-auto')));
 await p3.waitForTimeout(700);
 o.sistemaOscuro = await p3.evaluate(()=>!document.body.classList.contains('light-mode'));

 // --- «con el sol»: de dia claro, de noche oscuro ---
 o.solDeDia = await p3.evaluate(()=>{
   const D=Date; const F=function(){ return new D(2026,0,15,13,0,0); };
   F.now=D.now; F.prototype=D.prototype; window.Date=F;
   setMode('sol',document.getElementById('mode-sol'));
   const r=document.body.classList.contains('light-mode');
   window.Date=D; return r;
 });
 o.solDeNoche = await p3.evaluate(()=>{
   const D=Date; const F=function(){ return new D(2026,0,15,23,0,0); };
   F.now=D.now; F.prototype=D.prototype; window.Date=F;
   ixAplicarModo();
   const r=!document.body.classList.contains('light-mode');
   window.Date=D; return r;
 });
 const errs=p3._errs||[];
 await p3.close();

 const pruebas=[
  ['de serie arranca en oscuro',   o.arrancaOscuro===true,     o.arrancaOscuro],
  ['hay cuatro modos',             o.cuatroModos===true,       o.cuatroModos],
  ['claro se aplica',              o.aplicaClaro===true,       o.aplicaClaro],
  ['y el fondo se vuelve claro',   o.fondoClaro===true,        o.fondoClaro],
  ['EN CLARO SE LEE (<10% blanco)',o.claroBlanco<10,           o.claroBlanco+'% · '+o.detalleClaro],
  ['avisa al navegador del tema',  o.colorScheme==='light',    o.colorScheme],
  ['y cambia el color de la barra',/ecef|EBEF/i.test(o.themeColor||''), o.themeColor],
  ['queda guardado',               o.guardado==='light',       o.guardado],
  ['SIGUE en claro al recargar',   o.sigueTrasRecargar===true, o.sigueTrasRecargar],
  ['con su botón marcado',         o.botonMarcado===true,      o.botonMarcado],
  ['volver a oscuro funciona',     o.vuelveOscuro===true,      o.vuelveOscuro],
  ['sistema claro → app clara',    o.sistemaClaro===true,      o.sistemaClaro],
  ['sistema oscuro → app oscura',  o.sistemaOscuro===true,     o.sistemaOscuro],
  ['con el sol: de día, claro',    o.solDeDia===true,          o.solDeDia],
  ['con el sol: de noche, oscuro', o.solDeNoche===true,        o.solDeNoche],
  ['sin errores de página',        errs.length===0,            errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\ntexto casi blanco: oscuro '+o.oscuroBlanco+'% (normal) · claro '+o.claroBlanco+'%');
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
