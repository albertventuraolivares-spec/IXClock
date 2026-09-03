const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9187);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1100,height:850}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9187/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2400);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
   return !l || getComputedStyle(l).display==='none'; }, null, {timeout:20000}).catch(()=>{});
 await p.waitForTimeout(1800);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const r=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms)); const o={};
   const SR=44100;
   // Genera una onda con armonicos, como suena un instrumento de verdad:
   // el afinador debe dar la fundamental, no el armonico mas fuerte.
   const tono=(f,n)=>{ const a=new Float32Array(n);
     for(let i=0;i<n;i++){ const t=i/SR;
       a[i]=0.6*Math.sin(2*Math.PI*f*t)+0.35*Math.sin(4*Math.PI*f*t)+0.2*Math.sin(6*Math.PI*f*t); }
     return a; };

   // --- 1. deteccion de tono sobre señales conocidas ---
   const medir=f=>_gbFrecuenciaDe(tono(f,2048),SR);
   o.la440    = medir(440);      // La4, referencia
   o.miGrave  = medir(82.41);    // 6a cuerda de guitarra
   o.mi329    = medir(329.63);   // 1a cuerda de guitarra
   o.desafinada = medir(448);    // La4 subida ~31 centesimas
   o.silencio = _gbFrecuenciaDe(new Float32Array(2048), SR);   // debe ser -1
   o.ruido    = _gbFrecuenciaDe(Float32Array.from({length:2048},()=>Math.random()*0.002-0.001), SR);

   // --- 2. conversion a nota ---
   const n440=_gbNotaDe(440), n261=_gbNotaDe(261.626), n448=_gbNotaDe(448), n82=_gbNotaDe(82.41);
   o.nota440 = n440.nombre+n440.octava+'/'+n440.cents;
   o.nota261 = n261.nombre+n261.octava+'/'+n261.cents;
   o.nota448 = n448.nombre+n448.octava+'/'+n448.cents;
   o.nota82  = n82.nombre+n82.octava;

   // --- 3. el afinador aparece como instrumento y se dibuja ---
   openGarageBand(); await wait(400);
   o.enLista = GB_BROWSER_CARDS.some(x=>x.id==='tuner');
   gbOpenInstrument('tuner'); await wait(300);
   const area=document.getElementById('gb-tuner-area');
   o.areaVisible = !!area && getComputedStyle(area).display!=='none';
   o.hayBoton = !!document.getElementById('gb-af-btn');
   o.hayAguja = !!document.getElementById('gb-af-aguja');

   // --- 4. la pantalla reacciona al tono ---
   gbAfinadorPintar(440);
   o.pintaAfinada = document.getElementById('gb-af-nota').textContent;
   o.agujaVerde = document.getElementById('gb-af-aguja').style.background;
   o.agujaCentro = document.getElementById('gb-af-aguja').style.left;
   gbAfinadorPintar(448);
   o.pintaAlta = document.getElementById('gb-af-hz').textContent;
   o.agujaFuera = document.getElementById('gb-af-aguja').style.left;
   o.agujaNoVerde = document.getElementById('gb-af-aguja').style.background;

   // --- 5. microfono de verdad: se pide, SUENA y se suelta ---
   // En vez de un objeto falso se usa un MediaStream real generado por la
   // propia tarjeta de sonido con un tono de 440 Hz dentro: asi se comprueba
   // que el afinador lee de verdad lo que entra por el microfono.
   let paradas=0, pedidos=0;
   const ctx=_gbAudioCtx||new (window.AudioContext||window.webkitAudioContext)();
   navigator.mediaDevices.getUserMedia=()=>{ pedidos++;
     const dest=ctx.createMediaStreamDestination();
     const osc=ctx.createOscillator(); osc.type='sawtooth'; osc.frequency.value=440;
     const g=ctx.createGain(); g.gain.value=0.5;
     osc.connect(g); g.connect(dest); osc.start();
     const st=dest.stream, tr=st.getTracks()[0], orig=tr.stop.bind(tr);
     tr.stop=function(){ paradas++; try{osc.stop();}catch(e){} orig(); };
     return Promise.resolve(st); };
   gbAfinadorEmpezar(); await wait(700);
   o.pidioMic = pedidos===1;
   o.escuchando = _gbAfOn===true;
   o.botonParar = (document.getElementById('gb-af-btn')||{}).textContent;
   o.leeEnVivo = document.getElementById('gb-af-nota').textContent;   // deberia ser La4
   gbAfinadorParar(); await wait(120);
   o.soltoMic = paradas===1;
   o.parado = _gbAfOn===false && _gbAfStream===null && _gbAfRAF===null;
   o.botonVuelve = (document.getElementById('gb-af-btn')||{}).textContent;

   // --- 6. cambiar de instrumento tambien suelta el microfono ---
   gbAfinadorEmpezar(); await wait(500);
   gbOpenInstrument('keyboard'); await wait(250);
   o.sueltaAlCambiar = paradas===2 && _gbAfOn===false;

   // --- 6b. si el montaje del audio falla, NO se queda el microfono abierto ---
   gbOpenInstrument('tuner'); await wait(250);
   let paradasRotas=0;
   navigator.mediaDevices.getUserMedia=()=>{
     const dest=ctx.createMediaStreamDestination();
     const st=dest.stream, tr=st.getTracks()[0], orig=tr.stop.bind(tr);
     tr.stop=function(){ paradasRotas++; orig(); };
     return Promise.resolve(st); };
   const crearOrig=ctx.createAnalyser.bind(ctx);
   ctx.createAnalyser=()=>{ throw new Error('fallo simulado de audio'); };
   gbAfinadorEmpezar(); await wait(400);
   ctx.createAnalyser=crearOrig;
   o.sueltaSiFalla = paradasRotas===1 && _gbAfOn===false && _gbAfStream===null;
   o.avisaSiFalla = document.getElementById('gb-af-hz').textContent;

   // --- 7. no bloquea: 20 lecturas seguidas deben ir rapidas ---
   const t0=performance.now();
   for(let i=0;i<20;i++) _gbFrecuenciaDe(tono(220,2048),SR);
   o.msPorLectura = +((performance.now()-t0)/20).toFixed(1);
   return o;
 });

 const cerca=(a,b,tol)=>Math.abs(a-b)<=tol;
 const pruebas=[
  ['440 Hz detectado',            cerca(r.la440,440,3),        r.la440],
  ['Mi grave 82 Hz detectado',    cerca(r.miGrave,82.41,2),    r.miGrave],
  ['Mi agudo 330 Hz detectado',   cerca(r.mi329,329.63,3),     r.mi329],
  ['448 Hz (desafinada)',         cerca(r.desafinada,448,3),   r.desafinada],
  ['silencio -> sin nota',        r.silencio===-1,             r.silencio],
  ['ruido bajo -> sin nota',      r.ruido===-1,                r.ruido],
  ['440 Hz = La4 a 0 cents',      r.nota440==='La4/0',         r.nota440],
  ['261.6 Hz = Do4',              r.nota261==='Do4/0',         r.nota261],
  ['448 Hz = La4 alta',           /^La4\/(2[5-9]|3[0-9])$/.test(r.nota448), r.nota448],
  ['82.41 Hz = Mi2',              r.nota82==='Mi2',            r.nota82],
  ['esta en la lista',            r.enLista===true,            r.enLista],
  ['se abre el panel',            r.areaVisible===true,        r.areaVisible],
  ['tiene boton y aguja',         r.hayBoton&&r.hayAguja,      r.hayBoton+'/'+r.hayAguja],
  ['pinta La4 afinada',           r.pintaAfinada==='La4',      r.pintaAfinada],
  ['aguja verde y centrada',      /rgb\(48, ?209, ?88\)/.test(r.agujaVerde)&&r.agujaCentro==='50%', r.agujaVerde+' '+r.agujaCentro],
  ['avisa de que esta alta',      /alto/.test(r.pintaAlta),    r.pintaAlta],
  ['aguja se desplaza',           r.agujaFuera!=='50%'&&!/48, ?209/.test(r.agujaNoVerde), r.agujaFuera+' '+r.agujaNoVerde],
  ['pide el microfono',           r.pidioMic===true,           r.pidioMic],
  ['queda escuchando',            r.escuchando===true,         r.escuchando],
  ['el boton pasa a Parar',       /Parar/.test(r.botonParar||''), r.botonParar],
  ['LEE 440 Hz del microfono',    r.leeEnVivo==='La4',         r.leeEnVivo],
  ['SUELTA el microfono',         r.soltoMic===true,           r.soltoMic],
  ['queda todo limpio',           r.parado===true,             r.parado],
  ['el boton vuelve a Escuchar',  /Escuchar/.test(r.botonVuelve||''), r.botonVuelve],
  ['suelta al cambiar de instr.', r.sueltaAlCambiar===true,    r.sueltaAlCambiar],
  ['suelta si el audio falla',    r.sueltaSiFalla===true,      r.sueltaSiFalla],
  ['avisa si el audio falla',     /No se pudo abrir/.test(r.avisaSiFalla||''), r.avisaSiFalla],
  ['lectura rapida (<25 ms)',     r.msPorLectura<25,           r.msPorLectura+' ms'],
  ['sin errores de pagina',       errs.length===0,             errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
