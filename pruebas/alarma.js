const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9130);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1000,height:850}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 // Si algo abriera un prompt(), lo detectamos: los dialogos quedan registrados
 const dialogos=[]; p.on('dialog',async d=>{dialogos.push(d.type()+':'+d.message().slice(0,40)); await d.dismiss();});
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9130/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2400);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); await p.waitForTimeout(600);}catch(e){}
 const r=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms)); const o={};
   localStorage.removeItem('ica_alarms'); _icaAlarms.length=0;
   toggleIOSClockApp(); await wait(300); icaSwitchTab('alarms'); await wait(250);
   // Crear alarma: debe salir la hoja, no un prompt
   icaAddAlarm(); await wait(350);
   const hoja=document.getElementById('ica-alarm-sheet');
   o.hojaSale=!!hoja;
   o.tieneHoraMin=!!document.getElementById('ica-alarm-h') && !!document.getElementById('ica-alarm-m');
   o.tonosEnRejilla=document.querySelectorAll('.ica-tono').length;
   o.horasEnSelector=document.getElementById('ica-alarm-h').options.length;
   o.minutosEnSelector=document.getElementById('ica-alarm-m').options.length;
   // Elegir hora, etiqueta y tono, y guardar
   document.getElementById('ica-alarm-h').value='06';
   document.getElementById('ica-alarm-m').value='45';
   document.getElementById('ica-alarm-label').value='Gimnasio';
   icaProbarTono('campana'); await wait(120);
   o.tonoElegido=document.getElementById('ica-alarm-tone').value;
   icaGuardarAlarma(); await wait(300);
   o.hojaCerrada=!document.getElementById('ica-alarm-sheet');
   o.creada=_icaAlarms.length===1 && _icaAlarms[0].time==='6:45' && _icaAlarms[0].label==='Gimnasio' && _icaAlarms[0].tone==='campana';
   o.guardadaEnDisco=JSON.parse(localStorage.getItem('ica_alarms')||'[]').length===1;
   o.saleEnLista=/Gimnasio/.test(document.getElementById('ica-alarms-list').innerHTML);
   // Editar: tocar la etiqueta abre la hoja con los datos puestos
   icaChangeAlarmTone(0); await wait(300);
   o.editaCargaDatos=document.getElementById('ica-alarm-h').value==='06'
     && document.getElementById('ica-alarm-m').value==='45'
     && document.getElementById('ica-alarm-label').value==='Gimnasio';
   document.getElementById('ica-alarm-label').value='Correr';
   icaGuardarAlarma(); await wait(250);
   o.editada=_icaAlarms.length===1 && _icaAlarms[0].label==='Correr';
   // La alarma sigue sonando a su hora
   let sono=null; const orig=window.ringAlarm; window.ringAlarm=function(a){sono=a;};
   const ahora=new Date(); ahora.setSeconds(0);
   _icaAlarms[0].time=ahora.getHours()+':'+ahora.getMinutes(); _icaFired={};
   checkIcaAlarms(ahora); await wait(60); window.ringAlarm=orig;
   o.sigueSonando = sono && sono.label==='Correr';
   // Temporizador: etiqueta y tono tambien con hoja
   icaSwitchTab('timer'); await wait(250);
   icaPickTimerLabel(); await wait(300);
   o.timerHoja=!!document.getElementById('ica-hoja-txt');
   document.getElementById('ica-hoja-txt').value='Pasta';
   document.getElementById('ica-hoja-ok').click(); await wait(200);
   o.timerEtiqueta=_icaTimerLabel==='Pasta';
   icaPickTimerTone(); await wait(300);
   o.timerTonos=document.querySelectorAll('.ica-tono').length;
   icaProbarTono('apex'); await wait(120); icaGuardarTonoTimer(); await wait(200);
   o.timerTono=_icaTimerTone==='apex';
   // XSS: una etiqueta con codigo no debe ejecutarse
   window.__pwned=undefined;
   _icaAlarms=[{time:'7:00',label:'<img src=x onerror="window.__pwned=1">',on:true,tone:'radial'}];
   icaRenderAlarms(); await wait(400);
   o.xssAlarmaIca=window.__pwned!==1;
   _icaAlarms=[]; icaRenderAlarms();
   return o;
 });
 console.log(JSON.stringify(r,null,1));
 console.log('DIALOGOS DEL NAVEGADOR:', dialogos.length?dialogos:'(ninguno)');
 const ok=(k,v)=>console.log((v?'  ✓ ':'  ✗ ')+k);
 console.log('--- ALARMAS Y TEMPORIZADOR SIN VENTANITAS ---');
 ok('crear alarma abre una hoja propia, no un prompt', r.hojaSale && dialogos.length===0);
 ok('selector de hora (24) y minutos (60) + 8 tonos audibles', r.horasEnSelector===24 && r.minutosEnSelector===60 && r.tonosEnRejilla===8);
 ok('elegir tono lo marca y lo guarda', r.tonoElegido==='campana');
 ok('guarda la alarma, la persiste y la muestra', r.creada && r.guardadaEnDisco && r.saleEnLista && r.hojaCerrada);
 ok('editar carga los datos y los actualiza', r.editaCargaDatos && r.editada);
 ok('la alarma sigue sonando a su hora', r.sigueSonando);
 ok('temporizador: etiqueta y tono con hoja propia', r.timerHoja && r.timerEtiqueta && r.timerTonos===8 && r.timerTono);
 ok('etiqueta con código no se ejecuta', r.xssAlarmaIca);
 console.log('ERRORES JS:',errs.length?[...new Set(errs)].slice(0,3).join(' | '):'(ninguno)');
 await b.close();srv.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
