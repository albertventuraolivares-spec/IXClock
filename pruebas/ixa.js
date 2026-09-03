// Acciones del asistente. Antes solo sabia poner alarmas; ahora tambien
// temporizadores, notas, ciudades, abrir apps, fondos y radio.
// No se llama al modelo: se le da la respuesta ya escrita con las etiquetas,
// que es exactamente lo que llega del modelo, y se comprueba que la app HACE
// lo que dicen y que la etiqueta no se le enseña al usuario.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9222);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9222/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixaExtraerAcciones==='function' && typeof ixBuscarTodo==='function',
   null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2200);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
   return !l || getComputedStyle(l).display==='none'; },null,{timeout:20000}).catch(()=>{});
 await p.waitForTimeout(1800);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const r=await p.evaluate(async()=>{
   const w=ms=>new Promise(r=>setTimeout(r,ms)); const o={};

   // --- el analizador: saca la etiqueta y deja el texto limpio ---
   const e1=ixaExtraerAcciones('Claro, ya está.\n[[ALARM time="07:30" label="gimnasio"]]');
   o.limpiaLaEtiqueta = e1.cleaned==='Claro, ya está.';
   o.sacaLaAccion = e1.acciones.length===1 && e1.acciones[0].tipo==='ALARM'
                 && e1.acciones[0].args.time==='07:30' && e1.acciones[0].args.label==='gimnasio';

   // varias a la vez
   const e2=ixaExtraerAcciones('Hecho.[[TIMER min="10" label="pasta"]][[NOTA texto="comprar pan"]]');
   o.variasALaVez = e2.acciones.length===2;
   o.textoSinRestos = !/\[\[/.test(e2.cleaned);

   // sin etiquetas no inventa nada
   o.sinEtiquetasNada = ixaExtraerAcciones('Hola, ¿qué tal?').acciones.length===0;

   // --- ALARMA ---
   const nA=(typeof alarms!=='undefined'?alarms.length:0);
   ixaEjecutarAcciones(ixaExtraerAcciones('[[ALARM time="07:30" label="gimnasio"]]').acciones);
   await w(200);
   o.creaAlarma = alarms.length===nA+1 &&
     alarms.some(a=>a.hour===7&&a.minute===30&&/gimnasio/.test(a.label||''));
   // una hora imposible no crea nada
   const nB=alarms.length;
   ixaEjecutarAcciones(ixaExtraerAcciones('[[ALARM time="99:99" label="x"]]').acciones);
   o.horaImposible = alarms.length===nB;

   // --- TEMPORIZADOR ---
   clearInterval(_icaTimerInterval); _icaTimerInterval=null; _icaTimerRemaining=0;
   const av=ixaEjecutarAcciones(ixaExtraerAcciones('[[TIMER min="10" label="pasta"]]').acciones);
   await w(200);
   o.poneTimer = _icaTimerRemaining>=595 && _icaTimerRemaining<=600 && _icaTimerInterval!==null;
   o.timerAvisa = av.length===1 && /10 minutos/.test(av[0]);
   o.segundos=_icaTimerRemaining;
   clearInterval(_icaTimerInterval); _icaTimerInterval=null;

   // --- NOTA ---
   notes.length=0;
   ixaEjecutarAcciones(ixaExtraerAcciones('[[NOTA texto="comprar pan y leche"]]').acciones);
   await w(200);
   o.creaNota = notes.length===1 && /comprar pan y leche/.test(notes[0].content);

   // --- CIUDAD (y sin tildes) ---
   _icaWorldClocks=[];
   ixaEjecutarAcciones(ixaExtraerAcciones('[[CIUDAD nombre="Tokio"]]').acciones);
   await w(200);
   o.anadeCiudad = _icaWorldClocks.indexOf('Asia/Tokyo')>=0;
   ixaEjecutarAcciones(ixaExtraerAcciones('[[CIUDAD nombre="mexico"]]').acciones);
   await w(200);
   o.ciudadSinTildes = _icaWorldClocks.length===2;
   // una ciudad inventada no rompe ni añade
   const nC=_icaWorldClocks.length;
   const sinNada=ixaEjecutarAcciones(ixaExtraerAcciones('[[CIUDAD nombre="Zzyzx"]]').acciones);
   o.ciudadInventada = _icaWorldClocks.length===nC && sinNada.length===0;

   // --- ABRIR una app ---
   let abrio=false; const orig=window.openGarageBand;
   window.openGarageBand=function(){ abrio=true; };
   ixaEjecutarAcciones(ixaExtraerAcciones('[[ABRIR app="ixband"]]').acciones);
   await w(500);
   window.openGarageBand=orig;
   o.abreApp = abrio===true;
   const noApp=ixaEjecutarAcciones(ixaExtraerAcciones('[[ABRIR app="noexiste"]]').acciones);
   o.appInventada = noApp.length===0;

   // --- FONDO ---
   let fondo=null; const of_=window.setWallpaper;
   window.setWallpaper=function(id){ fondo=id; };
   const avF=ixaEjecutarAcciones(ixaExtraerAcciones('[[FONDO nombre="tokio"]]').acciones);
   window.setWallpaper=of_;
   o.cambiaFondo = fondo!==null && avF.length===1;
   o.fondoElegido = fondo;

   // --- RADIO ---
   let emi=null; const oe=window.setStation;
   window.setStation=function(id){ emi=id; };
   const avR=ixaEjecutarAcciones(ixaExtraerAcciones('[[RADIO nombre="jazz"]]').acciones);
   window.setStation=oe;
   o.poneRadio = emi!==null && avR.length===1;

   // --- el prompt le cuenta al modelo lo que puede hacer ---
   const pr=getAISystemPrompt();
   o.promptCompleto = ['[[TIMER','[[NOTA','[[CIUDAD','[[ABRIR','[[FONDO','[[RADIO']
     .every(t=>pr.indexOf(t)>=0);

   // --- lo de antes sigue funcionando igual ---
   const viejo=extractAlarmTags('Vale.[[ALARM time="08:00" label="x"]]');
   o.compatible = viejo.found.length===1 && viejo.found[0].hour===8 && viejo.cleaned==='Vale.';

   // --- una etiqueta con codigo no se ejecuta al confirmarla en el chat ---
   window.__pwn=0;
   notes.length=0;
   const acc=ixaExtraerAcciones('[[NOTA texto="<img src=x onerror=\'window.__pwn=1\'>"]]').acciones;
   ixaEjecutarAcciones(acc);
   appendAIMessage('bot','x');
   await w(400);
   o.notaMaliciosaNoEjecuta = window.__pwn===0;
   notes.length=0;
   return o;
 });

 const pruebas=[
  ['quita la etiqueta del texto',  r.limpiaLaEtiqueta===true,  r.limpiaLaEtiqueta],
  ['y saca bien sus datos',        r.sacaLaAccion===true,      r.sacaLaAccion],
  ['varias acciones a la vez',     r.variasALaVez===true,      r.variasALaVez],
  ['no quedan restos en el texto', r.textoSinRestos===true,    r.textoSinRestos],
  ['sin etiquetas no hace nada',   r.sinEtiquetasNada===true,  r.sinEtiquetasNada],
  ['ALARMA: la crea',              r.creaAlarma===true,        r.creaAlarma],
  ['y una hora imposible no',      r.horaImposible===true,     r.horaImposible],
  ['TIMER: lo pone en marcha',     r.poneTimer===true,         r.segundos+' s'],
  ['y lo confirma',                r.timerAvisa===true,        r.timerAvisa],
  ['NOTA: la apunta',              r.creaNota===true,          r.creaNota],
  ['CIUDAD: la añade',             r.anadeCiudad===true,       r.anadeCiudad],
  ['sin importar las tildes',      r.ciudadSinTildes===true,   r.ciudadSinTildes],
  ['una ciudad inventada no rompe',r.ciudadInventada===true,   r.ciudadInventada],
  ['ABRIR: abre la app',           r.abreApp===true,           r.abreApp],
  ['una app inventada no',         r.appInventada===true,      r.appInventada],
  ['FONDO: lo cambia',             r.cambiaFondo===true,       r.fondoElegido],
  ['RADIO: la pone',               r.poneRadio===true,         r.poneRadio],
  ['el prompt lo explica todo',    r.promptCompleto===true,    r.promptCompleto],
  ['las alarmas de antes igual',   r.compatible===true,        r.compatible],
  ['una nota con código no lo ejecuta', r.notaMaliciosaNoEjecuta===true, r.notaMaliciosaNoEjecuta],
  ['sin errores de página',        errs.length===0,            errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
