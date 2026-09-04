// Recordatorios por fecha: "el 15 a las 9", no solo alarmas diarias.
//
// Lo delicado de una alarma con fecha son los bordes: que NO suene los otros
// dias, que suene el suyo, que se apague sola despues (si no, se queda armada
// para siempre y vuelve a sonar el ano que viene) y que una fecha que ya paso
// no cuente como "proxima".
//
// Y de paso se comprueba algo que estaba mal: la franja de resumen leia la
// lista de alarmas VIEJA, no la de la app de Reloj, o sea que las alarmas que
// pone el usuario no salian en la franja.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9235);

async function arranca(ctx){
  const p=await ctx.newPage();
  p.on('pageerror',e=>{ p._errs=p._errs||[]; p._errs.push(e.message.split('\n')[0]); });
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:9235/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof icaFaltanPara==='function' && typeof ixPintarFranja==='function',
    null,{timeout:30000}).catch(()=>{});
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
  try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
  await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
    return !l || getComputedStyle(l).display==='none'; },null,{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(1800);
  await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
  await p.evaluate(()=>{ try{ toggleAlarmPanel(); }catch(e){} });   // abre la app de Reloj
  await p.waitForTimeout(500);
  return p;
}

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1280,height:1000}});
 let p=await arranca(ctx);
 const o={};

 // --- lo de siempre sigue igual: sin fecha, suena todos los dias ---
 o.diaria = await p.evaluate(()=>{
   const n=new Date();
   const t=(h,m)=>h+':'+String(m).padStart(2,'0');
   const en30=new Date(n.getTime()+30*60000);
   const hace60=new Date(n.getTime()-60*60000);
   return {
     futura: icaFaltanPara({on:true, time:t(en30.getHours(),en30.getMinutes())}),
     pasada: icaFaltanPara({on:true, time:t(hace60.getHours(),hace60.getMinutes())}),
     apagada: icaFaltanPara({on:false, time:'07:00'}),
     horaMala: icaFaltanPara({on:true, time:'99:99'})
   };
 });

 // --- con fecha: cuenta hasta ESE dia, y una fecha pasada NO cuenta ---
 o.conFecha = await p.evaluate(()=>{
   const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
   const n=new Date();
   const dentro=new Date(n.getFullYear(), n.getMonth(), n.getDate()+3);
   const antes =new Date(n.getFullYear(), n.getMonth(), n.getDate()-3);
   const hoy   =new Date(n.getFullYear(), n.getMonth(), n.getDate());
   const en20  =new Date(n.getTime()+20*60000);
   return {
     dentroDe3: icaFaltanPara({on:true, time:'09:00', fecha:iso(dentro)}),
     esperado3: Math.floor((new Date(dentro.getFullYear(),dentro.getMonth(),dentro.getDate(),9,0)-n)/60000),
     yaPaso:    icaFaltanPara({on:true, time:'09:00', fecha:iso(antes)}),
     hoyMasTarde: icaFaltanPara({on:true, time:en20.getHours()+':'+String(en20.getMinutes()).padStart(2,'0'), fecha:iso(hoy)}),
     fechaInventada: icaFaltanPara({on:true, time:'09:00', fecha:'2026-02-31'}),
     fechaBasura:    icaFaltanPara({on:true, time:'09:00', fecha:'mañana'})
   };
 });

 // --- SOLO suena su dia: los demas dias no ---
 o.suena = await p.evaluate(()=>{
   const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
   const hoy=new Date(2026,8,15,9,0,0);
   const otro=new Date(2026,8,16,9,0,0);
   _icaAlarms.length=0;
   _icaAlarms.push({time:'9:00', label:'dentista', on:true, tone:'radial', fecha:iso(hoy)});
   _icaFired={}; _ixMinIca=null;
   let sonaron=[];
   const orig=window.ringAlarm;
   window.ringAlarm=a=>{ sonaron.push(a.label); };
   checkIcaAlarms(otro);                 // otro dia: no
   const elOtroDia=sonaron.length;
   _ixMinIca=null;
   checkIcaAlarms(hoy);                  // su dia: si
   const suDia=sonaron.length;
   const seApago=_icaAlarms[0].on===false;
   // y no vuelve a sonar aunque se recompruebe
   _icaFired={}; _ixMinIca=null;
   checkIcaAlarms(hoy);
   const noRepite=sonaron.length===suDia;
   window.ringAlarm=orig;
   return { elOtroDia, suDia, seApago, noRepite,
            guardado: (JSON.parse(localStorage.getItem('ica_alarms')||'[]')[0]||{}).on };
 });

 // --- una alarma diaria sigue sonando cualquier dia ---
 o.diariaSuena = await p.evaluate(()=>{
   _icaAlarms.length=0;
   _icaAlarms.push({time:'9:00', label:'gimnasio', on:true, tone:'radial'});
   _icaFired={};
   let n=0; const orig=window.ringAlarm; window.ringAlarm=()=>{ n++; };
   // El minuto ya comprobado no se vuelve a comprobar (eso es lo que evita que
   // una alarma suene dos veces), asi que hay que soltar esa marca entre saltos.
   _ixMinIca=null;
   checkIcaAlarms(new Date(2026,8,15,9,0,0));
   _icaFired={}; _ixMinIca=null;
   checkIcaAlarms(new Date(2027,2,3,9,0,0));
   window.ringAlarm=orig;
   return { veces:n, sigueEncendida:_icaAlarms[0].on===true };
 });

 // --- la lista lo enseña en palabras ---
 o.texto = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
   const n=new Date();
   const d=k=>iso(new Date(n.getFullYear(), n.getMonth(), n.getDate()+k));
   const r={ hoy:icaTextoFecha(d(0)), manana:icaTextoFecha(d(1)),
             lejos:icaTextoFecha(d(20)), pasada:icaTextoFecha(d(-5)),
             basura:icaTextoFecha('xxx') };
   _icaAlarms.length=0;
   _icaAlarms.push({time:'9:00', label:'dentista', on:true, tone:'radial', fecha:d(3)});
   _icaAlarms.push({time:'7:00', label:'gimnasio', on:true, tone:'radial'});
   icaRenderAlarms(); await w(300);
   const t=document.getElementById('ica-alarms-list').innerText;
   r.saleLaFecha=/🗓️/.test(t);
   r.soloUna=(t.match(/🗓️/g)||[]).length===1;
   // una caducada no puede quedarse con el interruptor verde: dice que va a
   // sonar y no va a sonar
   _icaAlarms.length=0;
   _icaAlarms.push({time:'9:00', label:'vieja', on:true, tone:'radial', fecha:d(-4)});
   _icaAlarms.push({time:'9:00', label:'buena', on:true, tone:'radial', fecha:d(4)});
   icaRenderAlarms(); await w(300);
   r.caducadaApagada=_icaAlarms[0].on===false;
   r.buenaSigue=_icaAlarms[1].on===true;
   r.seGuardo=(JSON.parse(localStorage.getItem('ica_alarms')||'[]')[0]||{}).on===false;
   return r;
 });

 // --- crear una desde la hoja, con el boton de "un dia concreto" ---
 o.hoja = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   _icaAlarms.length=0;
   icaAddAlarm(); await w(400);
   const campo=document.getElementById('ica-alarm-fecha');
   const ocultoAlPrincipio=getComputedStyle(campo).display==='none';
   icaAlarmaRepetir(1); await w(200);
   const seVe=getComputedStyle(campo).display!=='none';
   const traeHoy=campo.value===campo.min;
   const n=new Date(); const f=new Date(n.getFullYear(), n.getMonth(), n.getDate()+5);
   campo.value=f.getFullYear()+'-'+String(f.getMonth()+1).padStart(2,'0')+'-'+String(f.getDate()).padStart(2,'0');
   document.getElementById('ica-alarm-label').value='cumple de mamá';
   document.getElementById('ica-alarm-h').value='09';
   document.getElementById('ica-alarm-m').value='30';
   icaGuardarAlarma(); await w(400);
   const g=JSON.parse(localStorage.getItem('ica_alarms')||'[]')[0]||{};
   // y volver a "todos los dias" quita la fecha
   icaAddAlarm(); await w(300);
   icaAlarmaRepetir(1); await w(150);
   icaAlarmaRepetir(0); await w(150);
   const seEsconde=getComputedStyle(document.getElementById('ica-alarm-fecha')).display==='none';
   icaGuardarAlarma(); await w(300);
   const g2=JSON.parse(localStorage.getItem('ica_alarms')||'[]')[1]||{};
   return { ocultoAlPrincipio, seVe, traeHoy, seEsconde,
            fecha:g.fecha, hora:g.time, etiqueta:g.label, sinFecha:!g2.fecha };
 });

 // --- editar una con fecha la conserva ---
 o.editar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const antes=JSON.parse(localStorage.getItem('ica_alarms')||'[]')[0];
   icaChangeAlarmTone(0); await w(400);
   const campoLleno=document.getElementById('ica-alarm-fecha').value===antes.fecha;
   const botonMarcado=/rgba\(10, 132, 255/.test(document.getElementById('ica-rep-fecha').style.background);
   icaGuardarAlarma(); await w(300);
   const despues=JSON.parse(localStorage.getItem('ica_alarms')||'[]')[0];
   return { campoLleno, botonMarcado, conserva:despues.fecha===antes.fecha };
 });

 // --- LA FRANJA lee la lista de la app de Reloj, no solo la vieja ---
 o.franja = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   alarms.length=0; _icaAlarms.length=0;
   const n=new Date(), t=m=>{ const d=new Date(n.getTime()+m*60000);
     return d.getHours()+':'+String(d.getMinutes()).padStart(2,'0'); };
   _icaAlarms.push({time:t(40), label:'reloj', on:true, tone:'radial'});
   ixPintarFranja(); await w(250);
   const el=document.getElementById('fr-alarma');
   const sale=getComputedStyle(el).display!=='none';
   const texto=el.innerText.replace(/\s+/g,' ').trim();

   // si hay una en las dos listas, gana la mas cercana
   alarms.push({id:'v', hour:new Date(n.getTime()+10*60000).getHours(),
                minute:new Date(n.getTime()+10*60000).getMinutes(), label:'vieja', enabled:true});
   ixPintarFranja(); await w(250);
   const conLasDos=document.getElementById('fr-alarma').innerText.replace(/\s+/g,' ').trim();

   // una con fecha lejana se cuenta en dias, no en "en 120 h"
   alarms.length=0; _icaAlarms.length=0;
   const f=new Date(n.getFullYear(), n.getMonth(), n.getDate()+5);
   _icaAlarms.push({time:'9:00', label:'lejos', on:true, tone:'radial',
     fecha:f.getFullYear()+'-'+String(f.getMonth()+1).padStart(2,'0')+'-'+String(f.getDate()).padStart(2,'0')});
   ixPintarFranja(); await w(250);
   const lejana=document.getElementById('fr-alarma').innerText.replace(/\s+/g,' ').trim();
   // Cuantos dias son de verdad: a las 23:00 de hoy, una alarma dentro de 5
   // dias a las 9:00 son 4 dias y pico, no 5. Se comprueba la cuenta, no un
   // numero escrito a mano.
   const diasReales=Math.round((new Date(f.getFullYear(),f.getMonth(),f.getDate(),9,0)-new Date())/86400000);

   // y una caducada no sale
   _icaAlarms.length=0;
   const v=new Date(n.getFullYear(), n.getMonth(), n.getDate()-2);
   _icaAlarms.push({time:'9:00', label:'caducada', on:true, tone:'radial',
     fecha:v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0')});
   ixPintarFranja(); await w(250);
   const caducadaSale=getComputedStyle(document.getElementById('fr-alarma')).display!=='none';
   return { sale, texto, conLasDos, lejana, caducadaSale, diasReales,
            esperado40:t(40), esperado10:t(10) };
 });

 // --- una etiqueta con código no se ejecuta ---
 o.xss = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__pwn=0;
   _icaAlarms.length=0;
   _icaAlarms.push({time:'9:00', label:'<img src=x onerror="window.__pwn=1">', on:true,
                    tone:'radial', fecha:'2030-01-01'});
   icaRenderAlarms(); await w(400);
   return window.__pwn===0;
 });

 // --- SOBREVIVE a recargar ---
 await p.evaluate(()=>{
   const n=new Date(), f=new Date(n.getFullYear(), n.getMonth(), n.getDate()+7);
   const iso=f.getFullYear()+'-'+String(f.getMonth()+1).padStart(2,'0')+'-'+String(f.getDate()).padStart(2,'0');
   localStorage.setItem('ica_alarms', JSON.stringify([{time:'9:30',label:'dentista',on:true,tone:'radial',fecha:iso}]));
 });
 await p.close();
 p = await arranca(ctx);
 o.trasRecargar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   icaRenderAlarms(); await w(300);
   return { fecha:_icaAlarms[0].fecha, cuenta:icaFaltanPara(_icaAlarms[0])>0,
            enPantalla:/🗓️/.test(document.getElementById('ica-alarms-list').innerText) };
 });
 const errs=p._errs||[];
 await p.close();

 const pruebas=[
  ['sin fecha cuenta hasta hoy',   o.diaria.futura>=29 && o.diaria.futura<=31, o.diaria.futura+' min'],
  ['la de hoy ya pasada, mañana',  o.diaria.pasada>=1379 && o.diaria.pasada<=1381, o.diaria.pasada+' min'],
  ['una apagada no cuenta',        o.diaria.apagada===null,   o.diaria.apagada],
  ['una hora imposible tampoco',   o.diaria.horaMala===null,  o.diaria.horaMala],
  ['CON FECHA cuenta hasta ese día', Math.abs(o.conFecha.dentroDe3-o.conFecha.esperado3)<=1, o.conFecha.dentroDe3+' vs '+o.conFecha.esperado3],
  ['una fecha pasada NO cuenta',   o.conFecha.yaPaso===null,  o.conFecha.yaPaso],
  ['hoy más tarde sí cuenta',      o.conFecha.hoyMasTarde>=19 && o.conFecha.hoyMasTarde<=21, o.conFecha.hoyMasTarde+' min'],
  ['el 31 de febrero no existe',   o.conFecha.fechaInventada===null, o.conFecha.fechaInventada],
  ['ni una fecha que no lo es',    o.conFecha.fechaBasura===null, o.conFecha.fechaBasura],
  ['NO suena los otros días',      o.suena.elOtroDia===0,     o.suena.elOtroDia],
  ['sí suena el suyo',             o.suena.suDia===1,         o.suena.suDia],
  ['y se apaga sola después',      o.suena.seApago===true && o.suena.guardado===false, JSON.stringify(o.suena)],
  ['sin volver a sonar',           o.suena.noRepite===true,   o.suena.noRepite],
  ['la diaria sigue sonando siempre', o.diariaSuena.veces===2 && o.diariaSuena.sigueEncendida===true, JSON.stringify(o.diariaSuena)],
  ['dice Hoy / Mañana / la fecha', o.texto.hoy==='Hoy' && o.texto.manana==='Mañana' && o.texto.lejos.length>2, [o.texto.hoy,o.texto.manana,o.texto.lejos].join(' · ')],
  ['y Caducada si ya pasó',        o.texto.pasada==='Caducada', o.texto.pasada],
  ['una fecha basura no pinta nada', o.texto.basura==='',     JSON.stringify(o.texto.basura)],
  ['solo la fechada lleva 🗓️',     o.texto.saleLaFecha===true && o.texto.soloUna===true, JSON.stringify({s:o.texto.saleLaFecha,u:o.texto.soloUna})],
  ['una caducada se apaga sola',   o.texto.caducadaApagada===true && o.texto.seGuardo===true, JSON.stringify({a:o.texto.caducadaApagada,g:o.texto.seGuardo})],
  ['y no toca a las demás',        o.texto.buenaSigue===true, o.texto.buenaSigue],
  ['el campo de fecha viene oculto', o.hoja.ocultoAlPrincipio===true, o.hoja.ocultoAlPrincipio],
  ['y sale al elegir un día',      o.hoja.seVe===true && o.hoja.traeHoy===true, JSON.stringify(o.hoja)],
  ['se guarda con su fecha',       !!o.hoja.fecha && o.hoja.hora==='9:30' && o.hoja.etiqueta==='cumple de mamá', o.hoja.fecha+' '+o.hoja.hora+' '+o.hoja.etiqueta],
  ['volver a diaria quita la fecha', o.hoja.seEsconde===true && o.hoja.sinFecha===true, JSON.stringify({e:o.hoja.seEsconde,s:o.hoja.sinFecha})],
  ['editarla conserva la fecha',   o.editar.campoLleno===true && o.editar.conserva===true, JSON.stringify(o.editar)],
  ['con el botón ya marcado',      o.editar.botonMarcado===true, o.editar.botonMarcado],
  ['LA FRANJA ve las del Reloj',   o.franja.sale===true && o.franja.texto.indexOf(o.franja.esperado40.replace(/^(\d):/,'$1:'))>=0 || /40 MIN/.test(o.franja.texto), o.franja.texto],
  ['y elige la más cercana de las dos', /EN 10 MIN/.test(o.franja.conLasDos), o.franja.conLasDos],
  ['una lejana se cuenta en días', new RegExp(o.franja.diasReales+' D[IÍ]AS?','i').test(o.franja.lejana), o.franja.lejana+'  (son '+o.franja.diasReales+' días)'],
  ['una caducada no sale',         o.franja.caducadaSale===false, o.franja.caducadaSale],
  ['una etiqueta con código no se ejecuta', o.xss===true, o.xss],
  ['SOBREVIVE a recargar',         !!o.trasRecargar.fecha && o.trasRecargar.cuenta===true && o.trasRecargar.enPantalla===true, JSON.stringify(o.trasRecargar)],
  ['sin errores de página',        errs.length===0,           errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
