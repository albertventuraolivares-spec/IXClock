// Temporizador para dormir con la radio: baja el volumen poco a poco y apaga
// la musica, sin que suene ninguna alarma.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9209);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1100,height:950}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9209/',{waitUntil:'domcontentloaded'});
 await p.waitForTimeout(2600);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const r=await p.evaluate(async()=>{
   const w=ms=>new Promise(r=>setTimeout(r,ms)); const o={};
   document.getElementById('ios-clock-app').classList.add('open');
   icaSwitchTab('timer'); await w(250);

   // --- los botones estan ahi ---
   const bot=document.getElementById('ica-dormir-botones');
   o.hayBotones = (bot.innerHTML.match(/icaDormirEn\(/g)||[]).length===5;
   o.empiezaOculto = getComputedStyle(document.getElementById('ica-dormir-estado')).display==='none';

   // --- se pone en marcha y enseña lo que queda ---
   icaDormirEn(30); await w(1100);
   o.arranca = _icaDormirFin!==null && _icaDormirTimer!==null;
   o.saleElEstado = getComputedStyle(document.getElementById('ica-dormir-estado')).display!=='none';
   const q=document.getElementById('ica-dormir-queda').textContent;
   o.cuentaAtras = /^(29|30):\d{2}$/.test(q);
   o.detalleCuenta=q;

   // --- cancelar lo para y lo esconde ---
   icaDormirCancelar(); await w(150);
   o.cancela = _icaDormirFin===null && _icaDormirTimer===null
     && getComputedStyle(document.getElementById('ica-dormir-estado')).display==='none';

   // --- el volumen baja SOLO en el ultimo medio minuto ---
   streamPlayer.volume=1;
   icaDormirEn(30);
   _icaDormirFin=Date.now()+120000;          // faltan 2 minutos
   _icaDormirTic();
   o.lejosNoBaja = streamPlayer.volume===1;
   _icaDormirFin=Date.now()+15000;           // faltan 15 s: mitad de volumen
   _icaDormirTic();
   o.cercaBaja = streamPlayer.volume>0.4 && streamPlayer.volume<0.6;
   o.volumenA15s = Math.round(streamPlayer.volume*100)/100;

   // --- al llegar a cero apaga la radio, NO suena ninguna alarma ---
   let paro=false, sono=false;
   const os=window.stopAudio, or=window.ringAlarm;
   window.stopAudio=function(){ paro=true; };
   window.ringAlarm=function(){ sono=true; };
   _icaDormirFin=Date.now()-10;
   _icaDormirTic(); await w(150);
   window.stopAudio=os; window.ringAlarm=or;
   o.apagaLaRadio = paro===true;
   o.noSuenaAlarma = sono===false;
   o.devuelveElVolumen = streamPlayer.volume===1;   // no deja la radio muda
   o.quedaLimpio = _icaDormirFin===null && _icaDormirTimer===null;
   o.estadoOculto = getComputedStyle(document.getElementById('ica-dormir-estado')).display==='none';

   // --- pedir otro reemplaza al anterior, no se acumulan ---
   icaDormirEn(15); const t1=_icaDormirTimer;
   icaDormirEn(60); const t2=_icaDormirTimer;
   o.noSeAcumulan = t1!==t2 && _icaDormirTimer===t2;
   const quedan=(_icaDormirFin-Date.now())/60000;
   o.usaElNuevo = quedan>59 && quedan<=60;

   // --- cerrar todas las ventanas tambien lo cancela ---
   ixCerrarTodasLasVentanas(); await w(250);
   o.cerrarTodoLoCancela = _icaDormirFin===null && _icaDormirTimer===null;

   // --- si no hay reproductor, no revienta ---
   const sp=window.streamPlayer;
   try{ window.streamPlayer=null; icaDormirEn(15); _icaDormirFin=Date.now()+10000; _icaDormirTic(); o.sinRadioNoRompe=true; }
   catch(e){ o.sinRadioNoRompe=false; }
   icaDormirCancelar(); window.streamPlayer=sp;
   return o;
 });

 const pruebas=[
  ['hay 5 duraciones',             r.hayBotones===true,        r.hayBotones],
  ['empieza oculto',               r.empiezaOculto===true,     r.empiezaOculto],
  ['arranca al elegir',            r.arranca===true,           r.arranca],
  ['sale el aviso',                r.saleElEstado===true,      r.saleElEstado],
  ['con la cuenta atrás',          r.cuentaAtras===true,       r.detalleCuenta],
  ['cancelar lo para',             r.cancela===true,           r.cancela],
  ['lejos del final no baja',      r.lejosNoBaja===true,       r.lejosNoBaja],
  ['a 15 s va por la mitad',       r.cercaBaja===true,         r.volumenA15s],
  ['al final APAGA la radio',      r.apagaLaRadio===true,      r.apagaLaRadio],
  ['y NO suena ninguna alarma',    r.noSuenaAlarma===true,     r.noSuenaAlarma],
  ['devuelve el volumen',          r.devuelveElVolumen===true, r.devuelveElVolumen],
  ['queda todo limpio',            r.quedaLimpio===true,       r.quedaLimpio],
  ['y el aviso se esconde',        r.estadoOculto===true,      r.estadoOculto],
  ['pedir otro no se acumula',     r.noSeAcumulan===true,      r.noSeAcumulan],
  ['y vale el nuevo',              r.usaElNuevo===true,        r.usaElNuevo],
  ['cerrar todo lo cancela',       r.cerrarTodoLoCancela===true, r.cerrarTodoLoCancela],
  ['sin radio no revienta',        r.sinRadioNoRompe===true,   r.sinRadioNoRompe],
  ['sin errores de página',        errs.length===0,            errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
