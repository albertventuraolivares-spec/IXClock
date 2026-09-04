// Accesibilidad: botones que son solo un icono, y menos movimiento.
//
// Un boton que solo tiene un emoji no le dice nada a un lector de pantalla:
// "boton" y ya. Y con todos esos fondos animados, la app ignoraba por completo
// que en el sistema hubieras pedido menos movimiento — que es una peticion de
// accesibilidad de verdad, no una preferencia estetica: hay gente a la que el
// movimiento le da mareo.
//
// La prueba corre DOS navegadores: uno normal y otro con la preferencia de
// menos movimiento puesta, y compara.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9251);

async function arranca(ctx){
  const p=await ctx.newPage();
  p.on('pageerror',e=>{ p._errs=p._errs||[]; p._errs.push(e.message.split('\n')[0]); });
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:9251/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof ixBuscarTodo==='function',null,{timeout:30000}).catch(()=>{});
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
  try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
  return p;
}
// Botones visibles que solo tienen icono y NADIE puede saber que hacen.
const mudos = p => p.evaluate(()=>{
  const fuera=[];
  document.querySelectorAll('button').forEach(b=>{
    if(b.offsetParent===null && b.getClientRects().length===0) return;   // no se ve
    const txt=(b.innerText||'').replace(/\s/g,'');
    // Ojo: \p{Emoji} incluye los digitos ASCII, asi que una tecla «7» salia
    // como boton mudo. Un lector de pantalla la lee perfectamente. Solo son
    // mudos los que son SOLO un pictograma.
    const letras=txt.replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu,'');
    if(letras.length>0) return;                       // tiene algo que leer
    if(b.getAttribute('aria-label') || b.getAttribute('title')) return;
    if(b.getAttribute('aria-hidden')==='true') return;
    fuera.push((b.id||b.className||'').toString().slice(0,40)+' ['+txt.slice(0,6)+']');
  });
  return fuera;
});

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const o={};

 // ═══ NORMAL ═══
 const n1=await b.newContext({viewport:{width:1280,height:1000}});
 let p=await arranca(n1);

 o.mudosInicio = await mudos(p);

 // y también dentro de las apps, que es donde estaban los que faltaban
 o.mudosApps = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const fuera=[];
   for(const f of ['openGarageBand','toggleNotesPanel','toggleCalcPanel','toggleAlarmPanel']){
     try{ window[f](); }catch(e){}
     await w(500);
     document.querySelectorAll('button').forEach(b=>{
       if(b.offsetParent===null && b.getClientRects().length===0) return;
       const txt=(b.innerText||'').replace(/\s/g,'');
       const letras=txt.replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu,'');
       if(letras.length>0) return;
       if(b.getAttribute('aria-label') || b.getAttribute('title')) return;
       if(b.getAttribute('aria-hidden')==='true') return;
       fuera.push(f+': '+(b.id||b.className||'').toString().slice(0,30));
     });
     try{ ixCerrarTodasLasVentanas(); }catch(e){}
     await w(250);
   }
   return fuera;
 });

 // los colores del Modo Fácil y las casillas del secuenciador, por nombre
 o.etiquetas = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const colores=[].slice.call(document.querySelectorAll('.easy-color-sw'))
     .map(b=>b.getAttribute('aria-label'));
   try{ openGarageBand(); }catch(e){}
   await w(600);
   try{ gbBuildBeatSeq&&gbBuildBeatSeq(); }catch(e){}
   await w(400);
   const cel=document.querySelector('.gb-seq-cell');
   const et=cel?cel.getAttribute('aria-label'):null;
   try{ ixCerrarTodasLasVentanas(); }catch(e){}
   return { colores, celda:et };
 });

 // ── cuánto dura una animación con movimiento normal ──
 o.normal = await p.evaluate(()=>{
   const d=document.createElement('div');
   d.style.cssText='position:absolute;left:-9999px;transition:opacity .4s;animation:spin 2s linear infinite;';
   document.body.appendChild(d);
   const cs=getComputedStyle(d);
   const r={ trans:cs.transitionDuration, anim:cs.animationDuration };
   d.remove();
   return r;
 });
 const errs1=p._errs||[];
 await p.close();

 // ═══ CON «MENOS MOVIMIENTO» PEDIDO EN EL SISTEMA ═══
 const n2=await b.newContext({viewport:{width:1280,height:1000}, reducedMotion:'reduce'});
 p=await arranca(n2);
 o.reducido = await p.evaluate(()=>{
   const d=document.createElement('div');
   d.style.cssText='position:absolute;left:-9999px;transition:opacity .4s;animation:spin 2s linear infinite;';
   document.body.appendChild(d);
   const cs=getComputedStyle(d);
   const r={ trans:cs.transitionDuration, anim:cs.animationDuration,
             veces:cs.animationIterationCount,
             loPide: matchMedia('(prefers-reduced-motion: reduce)').matches };
   d.remove();
   return r;
 });
 // el fondo animado se para del todo
 o.fondo = await p.evaluate(()=>{
   const w=document.querySelector('.wallpaper-layer');
   if(!w) return {hay:false};
   return { hay:true, anim:getComputedStyle(w).animationName };
 });
 // y la app SIGUE SIENDO USABLE: los paneles se abren igual
 o.sigueUsable = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   toggleNotesPanel(); await w(500);
   const abierto=document.getElementById('notes-panel').classList.contains('open');
   const visible=getComputedStyle(document.getElementById('notes-panel')).opacity;
   toggleNotesPanel(); await w(400);
   return { abierto, visible:parseFloat(visible) };
 });
 const errs=(p._errs||[]).concat(errs1);
 await p.close();
 await b.close(); srv.close();

 const pruebas=[
  ['ningún botón mudo en el inicio', o.mudosInicio.length===0, o.mudosInicio.slice(0,4).join(' | ')||'ninguno'],
  ['ni dentro de las apps',        o.mudosApps.length===0,  o.mudosApps.slice(0,4).join(' | ')||'ninguno'],
  ['los colores dicen cuál son',   o.etiquetas.colores.length===6 && o.etiquetas.colores.every(x=>/^Color /.test(x||'')), (o.etiquetas.colores||[]).join(', ')],
  ['y las casillas del ritmo',     /paso \d+/.test(o.etiquetas.celda||''), o.etiquetas.celda],
  ['normal: las animaciones duran',parseFloat(o.normal.trans)>0.3 && parseFloat(o.normal.anim)>1, JSON.stringify(o.normal)],
  ['MENOS MOVIMIENTO: se detecta', o.reducido.loPide===true, o.reducido.loPide],
  ['las transiciones casi no duran',parseFloat(o.reducido.trans)<0.01, o.reducido.trans],
  ['y las animaciones tampoco',    parseFloat(o.reducido.anim)<0.01 && o.reducido.veces==='1', JSON.stringify(o.reducido)],
  ['el fondo animado se para',     o.fondo.hay===false || o.fondo.anim==='none', JSON.stringify(o.fondo)],
  ['pero la app SIGUE usándose',   o.sigueUsable.abierto===true && o.sigueUsable.visible>0.5, JSON.stringify(o.sigueUsable)],
  ['sin errores de página',        errs.length===0,         errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})();
