// Reordenar los paneles de inicio arrastrando, y ocultar los que no uses.
// Se arrastra con el raton de verdad, no llamando a funciones: asi se prueba
// tambien que el asa recibe el gesto y que el panel salta de sitio.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9226);

async function arranca(ctx){
  const p=await ctx.newPage();
  p.on('pageerror',e=>{ p._errs=p._errs||[]; p._errs.push(e.message.split('\n')[0]); });
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:9226/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof ixIniciarPaneles==='function' && typeof ixBuscarTodo==='function',
    null,{timeout:30000}).catch(()=>{});
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
  try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
  await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
    return !l || getComputedStyle(l).display==='none'; },null,{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(1800);
  await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
  await p.evaluate(()=>{ try{ ixIniciarPaneles(); }catch(e){} });
  await p.waitForTimeout(400);
  return p;
}
const orden = p => p.evaluate(()=>
  [].slice.call(document.querySelectorAll('aside')[1].querySelectorAll(':scope > [data-panel]'))
    .map(e=>e.getAttribute('data-panel')));

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1280,height:1000}});
 let p=await arranca(ctx);
 await p.evaluate(()=>localStorage.removeItem('ix_orden_paneles'));
 const o={};

 o.cuatroPaneles = (await orden(p)).length===4;
 o.ordenInicial = (await orden(p)).join(',');
 o.hayAsas = await p.evaluate(()=>
   document.querySelectorAll('aside')[1].querySelectorAll(':scope > [data-panel] > .ix-asa').length);

 // --- arrastrar el ultimo por encima del primero, con el raton ---
 const caja = await p.evaluate(()=>{
   const ps=[].slice.call(document.querySelectorAll('aside')[1].querySelectorAll(':scope > [data-panel]'));
   const ult=ps[ps.length-1], pri=ps[0];
   const a=ult.querySelector('.ix-asa').getBoundingClientRect();
   const d=pri.getBoundingClientRect();
   return { asaX:a.left+a.width/2, asaY:a.top+a.height/2, destinoY:d.top+8,
            ultimo:ult.getAttribute('data-panel'), primero:pri.getAttribute('data-panel') };
 });
 await p.mouse.move(caja.asaX, caja.asaY);
 await p.mouse.down();
 // en varios pasos: un salto seco no dispara los pointermove intermedios
 for(let i=1;i<=8;i++){
   await p.mouse.move(caja.asaX, caja.asaY + (caja.destinoY-caja.asaY)*i/8);
   await p.waitForTimeout(60);
 }
 await p.mouse.up();
 await p.waitForTimeout(500);

 const tras = await orden(p);
 o.seMovio = tras[0]===caja.ultimo;
 o.detalle = caja.ultimo+' → posición '+(tras.indexOf(caja.ultimo)+1)+' de '+tras.length+'  ['+tras.join(',')+']';
 o.siguenLosCuatro = tras.length===4 && new Set(tras).size===4;
 o.seGuardo = await p.evaluate(()=>{
   const v=JSON.parse(localStorage.getItem('ix_orden_paneles')||'null');
   return Array.isArray(v)&&v.length===4;
 });

 // --- y SOBREVIVE a recargar ---
 await p.close();
 p = await arranca(ctx);
 const trasRecargar = await orden(p);
 o.persiste = trasRecargar.join(',')===tras.join(',');
 o.trasRecargar = trasRecargar.join(',');

 // --- un panel guardado que ya no exista no rompe ni pierde los demas ---
 o.ordenRaroNoRompe = await p.evaluate(()=>{
   localStorage.setItem('ix_orden_paneles', JSON.stringify(['no-existe','radio','clima']));
   let revento=false;
   try{ ixAplicarOrden(); }catch(e){ revento=true; }
   const n=document.querySelectorAll('aside')[1].querySelectorAll(':scope > [data-panel]').length;
   return !revento && n===4;
 });
 // --- un guardado corrupto tampoco ---
 o.corruptoNoRompe = await p.evaluate(()=>{
   localStorage.setItem('ix_orden_paneles','{no es json');
   let revento=false;
   try{ ixAplicarOrden(); }catch(e){ revento=true; }
   return !revento && ixOrdenGuardado()===null;
 });

 // --- restablecer ---
 o.reset = await p.evaluate(()=>{
   localStorage.setItem('ix_orden_paneles', JSON.stringify(['radio','clima']));
   ixResetOrdenPaneles();
   return localStorage.getItem('ix_orden_paneles')===null;
 });

 // --- cada panel se puede ocultar por separado ---
 o.enVisibilidad = await p.evaluate(()=>
   ['panel-clima','panel-radio','panel-fest','panel-pron']
     .every(id=>VISIBILITY_ITEMS.some(v=>v.id===id)));
 o.ocultarFunciona = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   toggleVisibility('panel-clima'); await w(400);
   const el=document.querySelector('[data-panel="clima"]');
   const oculto = !el || getComputedStyle(el).display==='none';
   toggleVisibility('panel-clima'); await w(400);
   const vuelve = getComputedStyle(document.querySelector('[data-panel="clima"]')).display!=='none';
   return oculto && vuelve;
 });

 // --- el asa no se traga el clic normal del panel ---
 o.radioSigueAbriendo = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const antes=document.getElementById('radio-body');
   const eraVisible = antes ? getComputedStyle(antes).display!=='none' : null;
   toggleRadioPanel(); await w(400);
   const ahora=document.getElementById('radio-body');
   const cambio = ahora ? (getComputedStyle(ahora).display!=='none')!==eraVisible : false;
   toggleRadioPanel(); await w(300);
   return cambio;
 });
 const errs=p._errs||[];
 await p.close();

 const pruebas=[
  ['hay cuatro paneles',          o.cuatroPaneles===true,   o.ordenInicial],
  ['cada uno con su asa',         o.hayAsas===4,            o.hayAsas],
  ['ARRASTRAR lo mueve',          o.seMovio===true,         o.detalle],
  ['y no se pierde ninguno',      o.siguenLosCuatro===true, o.siguenLosCuatro],
  ['el orden se guarda',          o.seGuardo===true,        o.seGuardo],
  ['SOBREVIVE a recargar',        o.persiste===true,        o.trasRecargar],
  ['un panel que ya no está no rompe', o.ordenRaroNoRompe===true, o.ordenRaroNoRompe],
  ['un guardado corrupto tampoco',o.corruptoNoRompe===true, o.corruptoNoRompe],
  ['se puede restablecer',        o.reset===true,           o.reset],
  ['los cuatro se pueden ocultar',o.enVisibilidad===true,   o.enVisibilidad],
  ['y ocultar funciona',          o.ocultarFunciona===true, o.ocultarFunciona],
  ['el panel sigue plegándose',   o.radioSigueAbriendo===true, o.radioSigueAbriendo],
  ['sin errores de página',       errs.length===0,          errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
