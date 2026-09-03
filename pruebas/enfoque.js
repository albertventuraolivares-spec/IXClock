// Modo enfoque (pomodoro) 25/5 a pantalla completa.
//
// Lo que de verdad se prueba aqui es la cuenta atras. Un pomodoro se usa
// mientras trabajas EN OTRA PESTAÑA, y los navegadores frenan los
// temporizadores de las pestañas que no miras: restando un segundo por tic,
// 25 minutos acaban siendo 40 y la app te miente. Por eso se adelanta el reloj
// a mano y se comprueba que la cuenta sigue el reloj y no los tics.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9231);

async function arranca(ctx){
  const p=await ctx.newPage();
  p.on('pageerror',e=>{ p._errs=p._errs||[]; p._errs.push(e.message.split('\n')[0]); });
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:9231/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof ixAbrirEnfoque==='function' && typeof setStation==='function',
    null,{timeout:30000}).catch(()=>{});
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
  try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
  await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
    return !l || getComputedStyle(l).display==='none'; },null,{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(1800);
  await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
  // El reloj se puede adelantar a mano: es la unica forma de probar 25 minutos
  // sin esperarlos.
  await p.evaluate(()=>{
    window.__salto=0;
    const real=Date.now;
    Date.now=()=>real()+window.__salto;
    window.__adelantar=min=>{ window.__salto+=min*60000; };
  });
  return p;
}
const leer = p => p.evaluate(()=>({
  tiempo: (document.getElementById('enf-tiempo')||{}).textContent,
  fase: (document.getElementById('enf-fase')||{}).textContent,
  pausa: (document.getElementById('enf-pausa')||{}).textContent,
  hechos: (document.getElementById('enf-hechos')||{}).textContent,
  titulo: document.title
}));

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
   args:['--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:1280,height:900}});
 let p=await arranca(ctx);
 const o={};

 // --- esta en el lanzador de apps y en el buscador ---
 o.enLaLista = await p.evaluate(()=>({
   enApps: IX_APPS.some(a=>a.id==='enfoque' && a.open==='ixAbrirEnfoque'),
   enBuscador: ixBuscarTodo('enfoque').some(r=>/enfoque/i.test(r.titulo||r.t||''))
 }));

 // --- arranca en trabajo, con los 25 minutos enteros ---
 await p.evaluate(()=>{ localStorage.removeItem('ix_enfoque_v1'); ixAbrirEnfoque(); });
 await p.waitForTimeout(600);
 o.arranque = await leer(p);
 o.abierto = await p.evaluate(()=>ixEnfoqueAbierto());

 // --- LA PRUEBA GORDA: 24 minutos de reloj = 01:00 restante ---
 o.reloj = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__adelantar(24);
   _enfBucle(); await w(200);
   return document.getElementById('enf-tiempo').textContent;
 });

 // --- al llegar a cero pasa SOLO al descanso, y cuenta la sesion ---
 o.cambio = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__adelantar(2);
   _enfBucle(); await w(300);
   return { fase:document.getElementById('enf-fase').textContent,
            tiempo:document.getElementById('enf-tiempo').textContent,
            hechos:document.getElementById('enf-hechos').textContent,
            guardado:(JSON.parse(localStorage.getItem('ix_enfoque_v1')||'{}').hechos) };
 });

 // --- el descanso largo llega a la cuarta, no antes ---
 o.largo = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const fases=[];
   for(let i=0;i<6;i++){
     ixEnfoqueSaltar(); await w(120);
     fases.push(document.getElementById('enf-fase').textContent);
   }
   return { fases, hechos:JSON.parse(localStorage.getItem('ix_enfoque_v1')||'{}').hechos };
 });

 // --- PAUSAR congela la cuenta aunque pase el tiempo ---
 o.pausa = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   localStorage.removeItem('ix_enfoque_v1');
   ixEnfoqueSalir(); ixAbrirEnfoque(); await w(300);
   ixEnfoquePausar(); await w(200);
   const antes=document.getElementById('enf-tiempo').textContent;
   window.__adelantar(10);
   _enfBucle(); await w(300);
   const despues=document.getElementById('enf-tiempo').textContent;
   const boton=document.getElementById('enf-pausa').textContent;
   ixEnfoquePausar(); await w(200);                 // reanudar
   window.__adelantar(1);
   _enfBucle(); await w(200);
   const traReanudar=document.getElementById('enf-tiempo').textContent;
   return { antes, despues, boton, traReanudar };
 });

 // --- cambiar de ritmo se marca y reinicia la fase ---
 o.preset = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   ixEnfoquePreset('50'); await w(300);
   const t=document.getElementById('enf-tiempo').textContent;
   const marcados=[].slice.call(document.querySelectorAll('#ix-enfoque button'))
     .filter(b=>/50 \/ 10/.test(b.textContent) && /rgba\(255, 255, 255, 0\.16\)/.test(b.style.background));
   const guardado=JSON.parse(localStorage.getItem('ix_enfoque_v1')||'{}').preset;
   ixEnfoquePreset('25'); await w(300);
   return { tiempo50:t, seMarca:marcados.length===1, guardado,
            vuelve:document.getElementById('enf-tiempo').textContent };
 });

 // --- el sonido de ambiente suena en trabajo y CALLA en el descanso ---
 o.sonido = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   let puesto=null, parado=0;
   const os=window.setStation, op=window.stopAudio;
   window.setStation=id=>{ puesto=id; };
   window.stopAudio=()=>{ parado++; };
   ixEnfoqueSonido('cafe'); await w(250);
   const enTrabajo=puesto;
   const antesDeSaltar=parado;
   ixEnfoqueSaltar(); await w(250);                 // pasa a descanso
   const caloEnDescanso = parado>antesDeSaltar;
   const faseAhora=document.getElementById('enf-fase').textContent;
   puesto=null;
   ixEnfoqueSaltar(); await w(250);                 // vuelve a trabajo
   const vuelveASonar=puesto;
   // sin sonido elegido, no se toca la radio
   puesto=null;
   ixEnfoqueSonido(''); await w(250);
   ixEnfoqueSaltar(); await w(150); ixEnfoqueSaltar(); await w(250);
   const sinSonido=puesto;
   window.setStation=os; window.stopAudio=op;
   return { enTrabajo, caloEnDescanso, faseAhora, vuelveASonar, sinSonido };
 });

 // --- al salir se para todo: nada de sonido ni de reloj corriendo detras ---
 o.salir = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   ixEnfoqueSalir(); await w(300);          // la prueba anterior lo dejo abierto
   const tituloAntes=document.title;
   ixAbrirEnfoque(); await w(300);
   const enModo=document.title;
   let parado=0; const op=window.stopAudio; window.stopAudio=()=>{ parado++; };
   ixEnfoqueSalir(); await w(300);
   window.stopAudio=op;
   const ov=document.getElementById('ix-enfoque');
   return { cerrado:getComputedStyle(ov).display==='none',
            sinTemporizador:_enfTic===null,
            paroElSonido:parado>0,
            tituloVuelve:document.title!==enModo,
            cambioElTitulo:enModo!==tituloAntes };
 });

 // --- Esc sale del modo enfoque y no de lo que hubiera debajo ---
 o.esc = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   // toggleAlarmPanel abre la app de Reloj, no el panel viejo. Y es un toggle:
   // se insiste hasta dejarla abierta.
   const ab=()=>document.getElementById('ios-clock-app').classList.contains('open');
   for(let i=0;i<3 && !ab();i++){ toggleAlarmPanel(); await w(350); }
   const alarmaAbierta=ab();
   ixAbrirEnfoque(); await w(300);
   return { alarmaAbierta };
 });
 await p.keyboard.press('Escape');
 await p.waitForTimeout(400);
 o.escResultado = await p.evaluate(()=>({
   enfoqueCerrado: !ixEnfoqueAbierto(),
   alarmaSigueAbierta: document.getElementById('ios-clock-app').classList.contains('open')
 }));
 await p.evaluate(()=>{ try{ toggleAlarmPanel(); }catch(e){} });

 // --- las sesiones de ayer no cuentan hoy ---
 o.dia = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   localStorage.setItem('ix_enfoque_v1', JSON.stringify({preset:'25',sonido:'',hechos:7,dia:'2020-1-1'}));
   const g=JSON.parse(localStorage.getItem('ix_enfoque_v1'));
   Object.assign(_enfCfg, g);
   ixAbrirEnfoque(); await w(300);
   const t=document.getElementById('enf-hechos').textContent;
   ixEnfoqueSalir();
   return { texto:t, cero:/^0 /.test(t) };
 });

 // --- se ve bien en un movil ---
 await p.setViewportSize({width:390,height:844});
 await p.evaluate(()=>ixAbrirEnfoque());
 await p.waitForTimeout(600);
 o.movil = await p.evaluate(()=>{
   const ov=document.getElementById('ix-enfoque');
   const r=ov.getBoundingClientRect();
   const t=document.getElementById('enf-tiempo').getBoundingClientRect();
   return { cabe: ov.scrollWidth<=window.innerWidth+2,
            tiempoDentro: t.left>=0 && t.right<=window.innerWidth+1,
            noSeCorta: ov.scrollHeight<=window.innerHeight+4 };
 });
 await p.evaluate(()=>ixEnfoqueSalir());
 await p.setViewportSize({width:1280,height:900});

 // --- el ritmo elegido SOBREVIVE a recargar ---
 await p.evaluate(()=>{ ixEnfoquePreset('15'); ixEnfoqueSalir(); });
 await p.close();
 p = await arranca(ctx);
 o.trasRecargar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   ixAbrirEnfoque(); await w(400);
   const t=document.getElementById('enf-tiempo').textContent;
   ixEnfoqueSalir();
   return t;
 });
 const errs=p._errs||[];
 await p.close();

 const pruebas=[
  ['está en el lanzador',         o.enLaLista.enApps===true,     o.enLaLista.enApps],
  ['y en el buscador',            o.enLaLista.enBuscador===true, o.enLaLista.enBuscador],
  ['arranca con 25:00',           o.arranque.tiempo==='25:00',   o.arranque.tiempo],
  ['en fase de enfoque',          /enfoque/i.test(o.arranque.fase||''), o.arranque.fase],
  ['LA CUENTA SIGUE AL RELOJ',    o.reloj==='01:00',             o.reloj+' tras adelantar 24 min'],
  ['al acabar pasa al descanso',  /descanso/i.test(o.cambio.fase||''), o.cambio.fase],
  ['con sus 5 minutos',           o.cambio.tiempo==='05:00',     o.cambio.tiempo],
  ['y apunta la sesión',          o.cambio.guardado===1,         o.cambio.hechos],
  ['el descanso largo, a la 4ª',  o.largo.fases.filter(f=>/largo/i.test(f)).length===1, o.largo.fases.join(' → ')],
  ['PAUSAR congela la cuenta',    o.pausa.antes===o.pausa.despues, o.pausa.antes+' → '+o.pausa.despues],
  ['y el botón lo dice',          /reanudar/i.test(o.pausa.boton||''), o.pausa.boton],
  ['al reanudar sigue contando',  o.pausa.traReanudar!==o.pausa.despues, o.pausa.despues+' → '+o.pausa.traReanudar],
  ['cambiar de ritmo lo aplica',  o.preset.tiempo50==='50:00',   o.preset.tiempo50],
  ['y se marca cuál está puesto', o.preset.seMarca===true,       o.preset.seMarca],
  ['y se guarda',                 o.preset.guardado==='50',      o.preset.guardado],
  ['el ambiente suena trabajando',o.sonido.enTrabajo==='cafe',   o.sonido.enTrabajo],
  ['y CALLA en el descanso',      o.sonido.caloEnDescanso===true, o.sonido.faseAhora],
  ['y vuelve al trabajar',        o.sonido.vuelveASonar==='cafe', o.sonido.vuelveASonar],
  ['sin sonido no toca la radio', o.sonido.sinSonido===null,     o.sonido.sinSonido],
  ['salir cierra de verdad',      o.salir.cerrado===true && o.salir.sinTemporizador===true, JSON.stringify(o.salir)],
  ['salir para el sonido',        o.salir.paroElSonido===true,   o.salir.paroElSonido],
  ['y devuelve el título',        o.salir.cambioElTitulo===true && o.salir.tituloVuelve===true, JSON.stringify(o.salir)],
  ['Esc sale del enfoque',        o.escResultado.enfoqueCerrado===true, o.escResultado.enfoqueCerrado],
  ['sin cerrar lo de debajo',     o.esc.alarmaAbierta===true && o.escResultado.alarmaSigueAbierta===true, JSON.stringify(o.escResultado)],
  ['las sesiones de ayer no cuentan', o.dia.cero===true,         o.dia.texto],
  ['se ve bien en móvil',         o.movil.cabe===true && o.movil.tiempoDentro===true && o.movil.noSeCorta===true, JSON.stringify(o.movil)],
  ['el ritmo SOBREVIVE a recargar', o.trasRecargar==='15:00',    o.trasRecargar],
  ['sin errores de página',       errs.length===0,               errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
