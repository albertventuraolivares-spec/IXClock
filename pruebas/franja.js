// Franja de resumen: clima, siguiente alarma, proxima festividad y fase lunar
// en una sola linea, encima del reloj. Los cuatro datos ya existian pero
// repartidos por la pantalla.
//
// Lo que de verdad se prueba aqui no es que salga texto, sino que el texto
// COINCIDA con el panel que tiene al lado: una franja que se contradiga con el
// panel del clima es peor que no tener franja.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9227);

async function arranca(ctx){
  const p=await ctx.newPage();
  p.on('pageerror',e=>{ p._errs=p._errs||[]; p._errs.push(e.message.split('\n')[0]); });
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:9227/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof ixPintarFranja==='function' && typeof obtenerFeriados==='function',
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
const txt = (p,id) => p.evaluate(i=>{ const e=document.getElementById(i);
  return e && getComputedStyle(e).display!=='none' ? e.innerText.replace(/\s+/g,' ').trim() : null; }, id);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1280,height:1000}});
 let p=await arranca(ctx);
 const o={};

 // --- sin datos, ninguna ficha inventa nada ---
 o.vacio = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   _lastWeatherRaw=null; alarms.length=0;
   ixPintarFranja(); await w(200);
   const v=id=>{ const e=document.getElementById(id); return getComputedStyle(e).display!=='none'; };
   return { clima:v('fr-clima'), alarma:v('fr-alarma') };
 });

 // --- la franja esta ENCIMA del reloj y en UNA sola linea ---
 o.sitio = await p.evaluate(()=>{
   const f=document.getElementById('ix-franja'), c=document.getElementById('clock-display');
   const a=f.getBoundingClientRect(), d=c.getBoundingClientRect();
   const luna=document.getElementById('luna-row');
   return { encima: a.bottom<=d.top+1,
            lunaDentro: f.contains(luna),
            centrada: Math.abs((a.left+a.right)/2 - (d.left+d.right)/2) < 30 };
 });

 // --- CLIMA: la ficha dice lo mismo que el panel ---
 o.clima = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   _lastWeatherRaw={ cur:{temperature_2m:21.4, weathercode:61, apparent_temperature:20,
                          relativehumidity_2m:80, windspeed_10m:9},
                     daily:{precipitation_probability_max:[70], temperature_2m_max:[24],
                            temperature_2m_min:[18], sunrise:['2026-01-01T06:10'], sunset:['2026-01-01T18:20']},
                     hourly:{temperature_2m:[], precipitation_probability:[], uv_index:[]} };
   reapplyWeatherDisplay();          // pinta el panel con esos mismos datos
   ixPintarFranja(); await w(200);
   const f=document.getElementById('fr-clima').innerText.replace(/\s+/g,' ').trim();
   return { ficha:f, panel:document.getElementById('curr-temp').innerText.trim(),
            redondea:/21°/.test(f), lluvia:/🌧/.test(f) };
 });

 // --- ALARMA: la mas cercana, y si la de hoy ya paso cuenta para manana ---
 o.alarma = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const n=new Date(), ahora=n.getHours()*60+n.getMinutes();
   const de=m=>{ const t=((ahora+m)%1440+1440)%1440; return {hour:Math.floor(t/60), minute:t%60}; };
   const a2=de(120), a1=de(30), ay=de(-60);
   alarms.length=0;
   alarms.push({id:'a',...a2,label:'lejos',enabled:true});
   alarms.push({id:'b',...a1,label:'cerca',enabled:true});
   ixPintarFranja(); await w(200);
   const elegida=document.getElementById('fr-alarma').innerText.replace(/\s+/g,' ').trim();

   // una apagada no cuenta
   alarms.length=0;
   alarms.push({id:'c',...a1,label:'apagada',enabled:false});
   ixPintarFranja(); await w(150);
   const apagada=getComputedStyle(document.getElementById('fr-alarma')).display!=='none';

   // la de hace una hora es la de MANANA, no una hora negativa
   alarms.length=0;
   alarms.push({id:'d',...ay,label:'ayer',enabled:true});
   ixPintarFranja(); await w(150);
   const pasada=document.getElementById('fr-alarma').innerText.replace(/\s+/g,' ').trim();

   return { elegida, esperada:fmtAMPM(a1.hour,a1.minute), apagada,
            pasada, sinNegativos:!/-\d/.test(pasada), horaPasada:fmtAMPM(ay.hour,ay.minute) };
 });

 // --- poner una alarma se ve YA, sin esperar al minuto ---
 o.alRenderizar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   alarms.length=0; ixPintarFranja(); await w(150);
   const n=new Date(), t=(n.getHours()*60+n.getMinutes()+45)%1440;
   alarms.push({id:'e',hour:Math.floor(t/60),minute:t%60,label:'nueva',enabled:true});
   renderAlarms(); await w(200);   // lo que hace la app al guardar una alarma
   return getComputedStyle(document.getElementById('fr-alarma')).display!=='none';
 });

 // --- FESTIVIDAD: la misma que encabeza el panel ---
 o.fest = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   renderizarFeriados(); ixPintarFranja(); await w(300);
   const ficha=document.getElementById('fr-fest').innerText.replace(/\s+/g,' ').trim();
   const primera=document.getElementById('events-box').children[0].innerText.replace(/\s+/g,' ').trim();
   // el nombre puede venir recortado con '…': se compara por el principio,
   // que ya identifica la festividad sin lugar a dudas
   const nombre=ficha.split('·')[0].trim().replace(/…$/,'').trim();
   const el=document.getElementById('fr-fest');
   return { ficha, primera, nombre, globito:el.title,
            coincide: nombre.length>3 && primera.toLowerCase().indexOf(nombre.toLowerCase())>=0,
            globitoEntero: el.title.indexOf('…')<0,
            tieneCuenta:/·/.test(ficha) };
 });

 // --- LUNA: sigue siendo la misma que antes, dentro de la franja ---
 o.luna = await p.evaluate(()=>{
   updateMoonPhase();
   const l=document.getElementById('luna-nombre').innerText.trim();
   return { texto:l, hay:l.length>0,
            visible:getComputedStyle(document.getElementById('luna-row')).display!=='none' };
 });

 // --- un nombre de festividad con codigo no se ejecuta ---
 o.xss = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__pwn=0;
   const orig=window.obtenerFeriados;
   window.obtenerFeriados=function(y){
     return [{name:'<img src=x onerror="window.__pwn=1">', emoji:'🎉',
              date:new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()+2),
              pais:'x'}];
   };
   ixPintarFranja(); await w(400);
   window.obtenerFeriados=orig; ixPintarFranja(); await w(200);
   return window.__pwn===0;
 });

 // --- cada ficha se puede ocultar por separado, y ocultar MANDA ---
 o.visibilidad = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const enLista=['fr-clima','fr-alarma','fr-fest'].every(id=>VISIBILITY_ITEMS.some(v=>v.id===id));
   toggleVisibility('fr-fest'); await w(200);
   const oculta=getComputedStyle(document.getElementById('fr-fest')).display==='none';
   ixPintarFranja(); await w(200);      // el repintado NO la debe resucitar
   const sigueOculta=getComputedStyle(document.getElementById('fr-fest')).display==='none';
   toggleVisibility('fr-fest'); await w(300);
   const vuelve=document.getElementById('fr-fest').innerText.trim().length>0;
   return { enLista, oculta, sigueOculta, vuelve };
 });

 // --- un nombre larguisimo se recorta por el NOMBRE, nunca por los dias ---
 o.largo = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const orig=window.obtenerFeriados;
   const n=new Date();
   window.obtenerFeriados=()=>[{name:'Dia Internacional de Algo Con Un Nombre Interminable',
     emoji:'🎉', date:new Date(n.getFullYear(), n.getMonth(), n.getDate()+3), pais:'x'}];
   ixPintarFranja(); await w(300);
   const el=document.getElementById('fr-fest');
   const t=el.innerText.replace(/\s+/g,' ').trim();
   // que se vea entero: si el navegador lo corta, scrollWidth pasa de clientWidth
   const cortadoPorCss = el.scrollWidth > el.clientWidth+2;
   window.obtenerFeriados=orig; ixPintarFranja(); await w(200);
   return { texto:t, quedanLosDias:/3\s*D[IÍ]AS/i.test(t), recortado:/…/.test(t), cortadoPorCss };
 });

 // --- en movil la linea envuelve en vez de desbordar ---
 await p.setViewportSize({width:390,height:844});
 await p.waitForTimeout(500);
 o.movil = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const orig=window.obtenerFeriados;
   const n=new Date();
   window.obtenerFeriados=()=>[{name:'Dia Internacional de Algo Con Un Nombre Interminable',
     emoji:'🎉', date:new Date(n.getFullYear(), n.getMonth(), n.getDate()+3), pais:'x'}];
   ixPintarFranja(); await w(300);
   const f=document.getElementById('ix-franja'), el=document.getElementById('fr-fest');
   const r={ desborda: f.scrollWidth > f.clientWidth+2,
             fuera: f.getBoundingClientRect().right > window.innerWidth+1,
             diasEnMovil: /3\s*D[IÍ]AS/i.test(el.innerText),
             cortadoPorCss: el.scrollWidth > el.clientWidth+2 };
   window.obtenerFeriados=orig; ixPintarFranja(); await w(200);
   return r;
 });
 await p.setViewportSize({width:1280,height:1000});
 await p.waitForTimeout(400);

 // --- sobrevive a recargar (y la ficha oculta sigue oculta) ---
 await p.evaluate(()=>{ toggleVisibility('fr-clima'); });
 await p.close();
 p = await arranca(ctx);
 await p.waitForTimeout(1800);
 o.trasRecargar = await p.evaluate(()=>({
   climaOculta: getComputedStyle(document.getElementById('fr-clima')).display==='none',
   franjaExiste: !!document.getElementById('ix-franja'),
   lunaSigue: document.getElementById('luna-nombre').innerText.trim().length>0
 }));
 const errs=p._errs||[];
 await p.close();

 const pruebas=[
  ['sin datos no inventa nada',   o.vacio.clima===false && o.vacio.alarma===false, JSON.stringify(o.vacio)],
  ['está encima del reloj',       o.sitio.encima===true,     o.sitio.encima],
  ['y centrada con él',           o.sitio.centrada===true,   o.sitio.centrada],
  ['la luna va en la misma línea',o.sitio.lunaDentro===true, o.sitio.lunaDentro],
  ['CLIMA: sale la temperatura',  o.clima.redondea===true,   o.clima.ficha],
  ['con el icono del tiempo',     o.clima.lluvia===true,     o.clima.ficha],
  ['y coincide con el panel',     o.clima.panel==='21°',     o.clima.ficha+' vs panel '+o.clima.panel],
  ['ALARMA: elige la más cercana',o.alarma.elegida.indexOf(o.alarma.esperada)>=0, o.alarma.elegida+' (esperaba '+o.alarma.esperada+')'],
  ['una apagada no cuenta',       o.alarma.apagada===false,  o.alarma.apagada],
  ['la de hoy ya pasada es mañana',o.alarma.sinNegativos===true && o.alarma.pasada.indexOf(o.alarma.horaPasada)>=0, o.alarma.pasada],
  ['ponerla se ve al momento',    o.alRenderizar===true,     o.alRenderizar],
  ['FESTIVIDAD: la misma del panel',o.fest.coincide===true,  o.fest.ficha+'  |  panel: '+o.fest.primera],
  ['con los días que faltan',     o.fest.tieneCuenta===true, o.fest.ficha],
  ['y el globito lo dice entero', o.fest.globitoEntero===true, o.fest.globito],
  ['LUNA: sigue en su sitio',     o.luna.hay===true && o.luna.visible===true, o.luna.texto],
  ['un nombre con código no se ejecuta', o.xss===true,       o.xss],
  ['las tres se pueden ocultar',  o.visibilidad.enLista===true, o.visibilidad.enLista],
  ['ocultar manda sobre repintar',o.visibilidad.oculta===true && o.visibilidad.sigueOculta===true, JSON.stringify(o.visibilidad)],
  ['y se puede volver a mostrar', o.visibilidad.vuelve===true, o.visibilidad.vuelve],
  ['un nombre larguísimo se recorta', o.largo.recortado===true, o.largo.texto],
  ['pero los días sobreviven',    o.largo.quedanLosDias===true && o.largo.cortadoPorCss===false, o.largo.texto],
  ['en móvil no desborda',        o.movil.desborda===false && o.movil.fuera===false, JSON.stringify(o.movil)],
  ['y en móvil también quedan',   o.movil.diasEnMovil===true && o.movil.cortadoPorCss===false, JSON.stringify(o.movil)],
  ['SOBREVIVE a recargar',        o.trasRecargar.franjaExiste===true && o.trasRecargar.climaOculta===true && o.trasRecargar.lunaSigue===true, JSON.stringify(o.trasRecargar)],
  ['sin errores de página',       errs.length===0,           errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
