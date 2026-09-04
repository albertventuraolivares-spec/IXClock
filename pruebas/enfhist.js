// Historial del Modo Enfoque: sesiones de hoy, tiempo y racha de dias.
//
// Hasta ahora el modo enfoque no dejaba ningun rastro, asi que no habia forma
// de saber si lo usabas. Lo dificil aqui es la RACHA: los bordes de "dias
// seguidos" son donde estas cosas mienten. Que un descanso no cuente como
// trabajo, que saltar a mitad tampoco, y que la racha no se rompa a las 00:01
// solo porque hoy todavia no has empezado.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9249);

async function arranca(ctx){
  const p=await ctx.newPage();
  p.on('pageerror',e=>{ p._errs=p._errs||[]; p._errs.push(e.message.split('\n')[0]); });
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:9249/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof enfoqueRacha==='function' && typeof ixAbrirEnfoque==='function',
    null,{timeout:30000}).catch(()=>{});
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
  try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
  await p.evaluate(()=>{
    // el reloj se puede adelantar: es la unica forma de terminar 25 minutos
    window.__salto=0;
    const real=Date.now;
    Date.now=()=>real()+window.__salto;
    window.__adelantar=min=>{ window.__salto+=min*60000; };
  });
  return p;
}
// Escribe un historial a mano con dias relativos a hoy.
const sembrar = (p,dias) => p.evaluate(ds=>{
  const n=new Date();
  const clave=k=>{ const d=new Date(n.getFullYear(),n.getMonth(),n.getDate()-k);
    return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); };
  localStorage.setItem('ix_enfoque_hist_v1', JSON.stringify(
    ds.map(x=>({d:clave(x[0]), m:x[1], t:Date.now()-x[0]*86400000}))));
}, dias);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1280,height:1000}});
 let p=await arranca(ctx);
 const o={};

 // --- sin historial, cero de todo y sin romperse ---
 o.vacio = await p.evaluate(()=>{
   localStorage.removeItem('ix_enfoque_hist_v1');
   return { resumen:enfoqueResumen(), racha:enfoqueRacha() };
 });

 // ═══ LA RACHA: los bordes ═══
 o.rachas = await p.evaluate(async()=>{
   const n=new Date();
   const clave=k=>{ const d=new Date(n.getFullYear(),n.getMonth(),n.getDate()-k);
     return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); };
   const poner=ds=>localStorage.setItem('ix_enfoque_hist_v1',
     JSON.stringify(ds.map(k=>({d:clave(k), m:25, t:Date.now()}))));
   const casos=[];
   poner([0]);            casos.push(['solo hoy', enfoqueRacha(), 1]);
   poner([0,1,2]);        casos.push(['hoy y dos antes', enfoqueRacha(), 3]);
   poner([1,2,3]);        casos.push(['ayer y antes, hoy aun no', enfoqueRacha(), 3]);
   poner([2,3]);          casos.push(['anteayer y antes (cortada)', enfoqueRacha(), 0]);
   poner([0,2,3]);        casos.push(['hoy, hueco, y dos antes', enfoqueRacha(), 1]);
   poner([0,0,0,1]);      casos.push(['tres hoy y una ayer', enfoqueRacha(), 2]);
   poner([]);             casos.push(['sin nada', enfoqueRacha(), 0]);
   return casos.map(c=>({ caso:c[0], sale:c[1], esperado:c[2], ok:c[1]===c[2] }));
 });

 // --- el resumen del dia suma bien ---
 o.resumen = await p.evaluate(()=>{
   const n=new Date();
   const clave=k=>{ const d=new Date(n.getFullYear(),n.getMonth(),n.getDate()-k);
     return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); };
   localStorage.setItem('ix_enfoque_hist_v1', JSON.stringify([
     {d:clave(0), m:25}, {d:clave(0), m:25}, {d:clave(0), m:50},
     {d:clave(1), m:25}, {d:clave(5), m:25}
   ]));
   return enfoqueResumen();
 });

 // ═══ SOLO cuenta una sesion de TRABAJO terminada ═══
 o.cuenta = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   localStorage.removeItem('ix_enfoque_hist_v1');
   localStorage.removeItem('ix_enfoque_v1');
   ixAbrirEnfoque(); await w(500);

   // 1) saltar a mano NO cuenta como sesion hecha... o si? se mide
   const antesDeSaltar=_enfHistLeer().length;
   ixEnfoqueSaltar(); await w(300);          // trabajo -> descanso
   const trasSaltar=_enfHistLeer().length;

   // 2) terminar un DESCANSO no apunta nada
   const antesDescanso=_enfHistLeer().length;
   window.__adelantar(10); _enfBucle(); await w(400);   // se acaba el descanso
   const trasDescanso=_enfHistLeer().length;
   const faseAhora=document.getElementById('enf-fase').textContent;

   // 3) terminar el TRABAJO entero SI apunta
   const antesTrabajo=_enfHistLeer().length;
   window.__adelantar(30); _enfBucle(); await w(400);
   const trasTrabajo=_enfHistLeer().length;
   const ultima=_enfHistLeer()[0];
   ixEnfoqueSalir();
   return { trasSaltar:trasSaltar-antesDeSaltar,
            trasDescanso:trasDescanso-antesDescanso,
            trasTrabajo:trasTrabajo-antesTrabajo,
            faseAhora, minutos:ultima?ultima.m:null };
 });

 // --- se ve en pantalla: sesiones, tiempo y racha ---
 o.pantalla = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const n=new Date();
   const clave=k=>{ const d=new Date(n.getFullYear(),n.getMonth(),n.getDate()-k);
     return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); };
   localStorage.setItem('ix_enfoque_hist_v1', JSON.stringify([
     {d:clave(0), m:25},{d:clave(0), m:25},{d:clave(1), m:25},{d:clave(2), m:25}
   ]));
   ixEnfoqueSalir(); await w(200);
   ixAbrirEnfoque(); await w(500);
   const t=document.getElementById('enf-hechos').textContent;
   ixEnfoqueSalir();
   return t;
 });

 // --- con racha de 1 día NO se enseña: eso no es una racha ---
 o.rachaUno = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const n=new Date();
   const clave=k=>{ const d=new Date(n.getFullYear(),n.getMonth(),n.getDate()-k);
     return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); };
   localStorage.setItem('ix_enfoque_hist_v1', JSON.stringify([{d:clave(0), m:25}]));
   ixAbrirEnfoque(); await w(500);
   const t=document.getElementById('enf-hechos').textContent;
   ixEnfoqueSalir();
   return t;
 });

 // --- no crece sin límite ---
 o.tope = await p.evaluate(async()=>{
   localStorage.removeItem('ix_enfoque_hist_v1');
   for(let i=0;i<80;i++) _enfApuntar(25);
   return _enfHistLeer().length;
 });

 // --- un historial corrupto no rompe nada ---
 o.corrupto = await p.evaluate(()=>{
   localStorage.setItem('ix_enfoque_hist_v1','{no es json');
   let revento=false, r=null;
   try{ r=enfoqueResumen(); enfoqueRacha(); }catch(e){ revento=true; }
   localStorage.setItem('ix_enfoque_hist_v1','"tampoco esto"');
   try{ enfoqueResumen(); enfoqueRacha(); }catch(e){ revento=true; }
   return { revento, r };
 });

 // --- el tiempo se dice en horas cuando pasa de 60 min ---
 o.formato = await p.evaluate(()=>({
   corto:_enfMinTexto(25), justo:_enfMinTexto(60), largo:_enfMinTexto(150)
 }));

 // --- SOBREVIVE a recargar ---
 await sembrar(p, [[0,25],[1,25],[2,50]]);
 await p.close();
 p = await arranca(ctx);
 o.trasRecargar = await p.evaluate(()=>({ resumen:enfoqueResumen(), racha:enfoqueRacha() }));
 const errs=p._errs||[];
 await p.close();

 const rachasMal=o.rachas.filter(r=>!r.ok);

 const pruebas=[
  ['sin historial, todo a cero',  o.vacio.racha===0 && o.vacio.resumen.sesionesTotal===0, JSON.stringify(o.vacio.resumen)],
  ['LA RACHA: los 7 casos',       rachasMal.length===0, rachasMal.map(r=>r.caso+': '+r.sale+' (esperaba '+r.esperado+')').join(' | ')||'7 de 7'],
  ['ayer sí y hoy aún no: sigue viva', o.rachas[2].ok===true, o.rachas[2].sale],
  ['un hueco la corta',           o.rachas[4].sale===1,  o.rachas[4].sale],
  ['el resumen suma el día',      o.resumen.sesionesHoy===3 && o.resumen.minutosHoy===100, JSON.stringify(o.resumen)],
  ['y el total',                  o.resumen.sesionesTotal===5 && o.resumen.minutosTotal===150, o.resumen.minutosTotal],
  ['saltar a mano NO apunta',     o.cuenta.trasSaltar===0, o.cuenta.trasSaltar],
  ['un DESCANSO no apunta',       o.cuenta.trasDescanso===0, o.cuenta.trasDescanso+' ('+o.cuenta.faseAhora+')'],
  ['terminar el TRABAJO sí',      o.cuenta.trasTrabajo===1, o.cuenta.trasTrabajo],
  ['con sus minutos',             o.cuenta.minutos===25, o.cuenta.minutos],
  ['la pantalla lo enseña',       /2 sesiones hoy/i.test(o.pantalla||'') && /50 min/.test(o.pantalla||''), o.pantalla],
  ['con la racha',                /3 días seguidos/i.test(o.pantalla||''), o.pantalla],
  ['una racha de 1 día no se enseña', !/seguidos/i.test(o.rachaUno||''), o.rachaUno],
  ['no crece sin límite',         o.tope===60,           o.tope],
  ['un historial corrupto no rompe', o.corrupto.revento===false, JSON.stringify(o.corrupto)],
  ['el tiempo se lee bien',       o.formato.corto==='25 min' && o.formato.justo==='1 h' && o.formato.largo==='2 h 30 min', JSON.stringify(o.formato)],
  ['SOBREVIVE a recargar',        o.trasRecargar.racha===3 && o.trasRecargar.resumen.sesionesTotal===3, JSON.stringify(o.trasRecargar)],
  ['sin errores de página',       errs.length===0,       errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
