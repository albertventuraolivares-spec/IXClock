const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9197);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
   args:['--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream']});
 const ctx=await b.newContext({viewport:{width:1200,height:900},acceptDownloads:true});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9197/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2400);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
   return !l || getComputedStyle(l).display==='none'; }, null, {timeout:20000}).catch(()=>{});
 await p.waitForTimeout(1900);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const o={};
 // --- sin nada grabado no exporta ---
 o.previos = await p.evaluate(async()=>{
   const w=ms=>new Promise(r=>setTimeout(r,ms));
   openGarageBand(); await w(400);
   localStorage.removeItem('ixband_canciones_v1');
   gbBorrarCancionGuardada(); gbCargarLista(); await w(200);
   gbView('tracks'); gbRenderTracks(); await w(150);
   gbExportarCancion(); await w(200);
   return { vacio:/No hay nada que exportar/.test(document.getElementById('gb-status').textContent),
            noQuedaExportando:_gbExportando===false,
            hayFormato:_gbFormatoAudio()!==null,
            hayBoton:/Exportar audio/.test(document.getElementById('gb-tracks').innerHTML) };
 });

 // --- exportación real: se espera la descarga del navegador ---
 const espera = p.waitForEvent('download',{timeout:30000}).catch(()=>null);
 await p.evaluate(async()=>{
   const w=ms=>new Promise(r=>setTimeout(r,ms));
   const ev=[]; for(let i=0;i<6;i++) ev.push({at:i*250,freq:262+i*40,type:'piano',vel:1});
   _gbTakes=[{name:'piano',sec:_gbSecActiva,muted:false,solo:false,vol:1,pan:0,events:ev}];
   gbGuardarComo(); await w(200);          // le pone nombre "Canción 1"
   gbRenombrarCancion(_gbCancionActual); await w(120);
   const i=document.getElementById('gb-cancion-inp');
   if(i){ i.value='Tema de prueba'; i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); }
   await w(200);
   gbView('tracks'); gbRenderTracks(); await w(150);
   gbExportarCancion();
 });
 await p.waitForTimeout(700);
 o.marcaGrabando = await p.evaluate(()=>_gbExportando===true);
 o.botonCambia   = await p.evaluate(()=>/Grabando…/.test(document.getElementById('gb-tracks').innerHTML));
 o.cuentaAtras   = await p.evaluate(()=>/Grabando la canción/.test(document.getElementById('gb-status').textContent));
 // No deja lanzar una segunda a la vez: se comprueba el resultado, no el
 // mensaje, porque la cuenta atras esta reescribiendo la linea de estado.
 o.noDoble = await p.evaluate(()=>gbExportarCancion()===false);
 await p.waitForTimeout(250);
 o.avisaDoble = await p.evaluate(()=>{
   const t=document.getElementById('ix-toast');
   return !!t && /Ya se está grabando/.test(t.textContent) && t.style.display!=='none';
 });

 const dl = await espera;
 o.hayDescarga = !!dl;
 if(dl){
   o.nombre = dl.suggestedFilename();
   const ruta = await dl.path();
   o.bytes = ruta ? fs.statSync(ruta).size : 0;
 }
 await p.waitForTimeout(900);
 o.terminaLimpio = await p.evaluate(()=>_gbExportando===false);
 o.avisaFinal    = await p.evaluate(()=>/Exportada/.test(document.getElementById('gb-status').textContent));
 o.botonVuelve   = await p.evaluate(()=>/Exportar audio/.test(document.getElementById('gb-tracks').innerHTML));
 // El maestro no se queda enganchado a un destino que ya nadie escucha
 o.sinFugas = await p.evaluate(()=>{
   try{ _gbBusOut.disconnect(); _gbBusOut.connect(_gbAudioCtx.destination); return true; }catch(e){ return false; }
 });
 // --- compartir: sale el boton solo si el dispositivo puede, y comparte ---
 o.sinBotonSiNoPuede = await p.evaluate(()=>
   gbPuedeCompartir()===false && !/📤 Compartir/.test(document.getElementById('gb-tracks').innerHTML));
 o.compartir = await p.evaluate(async()=>{
   const w=ms=>new Promise(r=>setTimeout(r,ms));
   // Se finge un movil que si sabe compartir archivos.
   let recibido=null;
   navigator.canShare=()=>true;
   navigator.share=d=>{ recibido=d; return Promise.resolve(); };
   gbRenderTracks(); await w(150);
   const hayBoton=/📤 Compartir/.test(document.getElementById('gb-tracks').innerHTML);
   gbCompartirCancion(); await w(250);
   return { hayBoton:hayBoton,
            mandoArchivo: !!recibido && !!recibido.files && recibido.files.length===1,
            nombreOk: !!recibido && recibido.files[0].name===_gbUltimoExport.nombre,
            pesaAlgo: !!recibido && recibido.files[0].size>500,
            avisa: /Compartida/.test(document.getElementById('gb-status').textContent) };
 });
 await p.evaluate(()=>{ delete navigator.share; delete navigator.canShare; });

 // --- exportar en WAV: cabecera de verdad y sin comprimir ---
 await p.evaluate(()=>{ document.getElementById('gb-status').textContent=''; });
 o.hayBotonWav = await p.evaluate(()=>/Exportar WAV/.test(document.getElementById('gb-tracks').innerHTML));
 const esperaWav = p.waitForEvent('download',{timeout:40000}).catch(()=>null);
 await p.evaluate(()=>gbExportarCancion('wav'));
 const dlw = await esperaWav;
 o.hayWav = !!dlw;
 if(dlw){
   o.nombreWav = dlw.suggestedFilename();
   const ruta = await dlw.path();
   if(ruta){
     const buf = fs.readFileSync(ruta);
     o.bytesWav = buf.length;
     // Cabecera WAV de verdad: RIFF....WAVEfmt , PCM (1) y 16 bits
     o.cabeceraRiff = buf.slice(0,4).toString()==='RIFF' && buf.slice(8,12).toString()==='WAVE';
     o.esPcm16 = buf.readUInt16LE(20)===1 && buf.readUInt16LE(34)===16;
     o.tamCuadra = buf.readUInt32LE(4)===buf.length-8;
     o.sinComprimir = buf.length > 200000;   // pesa mucho mas que el webm de 41 KB
   }
 }
 await p.waitForTimeout(600);
 o.wavLimpio = await p.evaluate(()=>_gbExportando===false);

 // Y se puede volver a exportar
 await p.evaluate(()=>{ document.getElementById('gb-status').textContent=''; });
 const espera2 = p.waitForEvent('download',{timeout:30000}).catch(()=>null);
 await p.evaluate(()=>gbExportarCancion());
 const dl2 = await espera2;
 o.segundaVez = !!dl2;

 const pruebas=[
  ['sin nada no exporta',          o.previos.vacio===true,           o.previos.vacio],
  ['no se queda marcado',          o.previos.noQuedaExportando===true, o.previos.noQuedaExportando],
  ['el navegador puede grabar',    o.previos.hayFormato===true,      o.previos.hayFormato],
  ['hay botón de exportar',        o.previos.hayBoton===true,        o.previos.hayBoton],
  ['se pone a grabar',             o.marcaGrabando===true,           o.marcaGrabando],
  ['el botón dice Grabando',       o.botonCambia===true,             o.botonCambia],
  ['enseña lo que queda',          o.cuentaAtras===true,             o.cuentaAtras],
  ['no deja lanzar dos a la vez',  o.noDoble===true,                 o.noDoble],
  ['y lo avisa por encima',        o.avisaDoble===true,              o.avisaDoble],
  ['SALE UN ARCHIVO de verdad',    o.hayDescarga===true,             o.hayDescarga],
  ['con el nombre de la canción',  /^Tema de prueba\.(webm|m4a|ogg)$/.test(o.nombre||''), o.nombre],
  ['y con audio dentro',           (o.bytes||0)>500,                 (o.bytes||0)+' bytes'],
  ['termina limpio',               o.terminaLimpio===true,           o.terminaLimpio],
  ['avisa de que acabó',           o.avisaFinal===true,              o.avisaFinal],
  ['el botón vuelve',              o.botonVuelve===true,             o.botonVuelve],
  ['el maestro queda suelto',      o.sinFugas===true,                o.sinFugas],
  ['sin Compartir si no se puede', o.sinBotonSiNoPuede===true,       o.sinBotonSiNoPuede],
  ['sale Compartir si se puede',   o.compartir.hayBoton===true,      o.compartir.hayBoton],
  ['manda el archivo al sistema',  o.compartir.mandoArchivo===true,  o.compartir.mandoArchivo],
  ['con su nombre',                o.compartir.nombreOk===true,      o.compartir.nombreOk],
  ['y con audio dentro',           o.compartir.pesaAlgo===true,      o.compartir.pesaAlgo],
  ['avisa de que se compartió',    o.compartir.avisa===true,         o.compartir.avisa],
  ['hay botón de WAV',             o.hayBotonWav===true,             o.hayBotonWav],
  ['SALE UN WAV',                  o.hayWav===true,                  o.hayWav],
  ['con nombre .wav',              /\.wav$/.test(o.nombreWav||''),    o.nombreWav],
  ['cabecera RIFF/WAVE',           o.cabeceraRiff===true,            o.cabeceraRiff],
  ['PCM de 16 bits',               o.esPcm16===true,                 o.esPcm16],
  ['el tamaño del RIFF cuadra',    o.tamCuadra===true,               o.tamCuadra],
  ['pesa como algo sin comprimir', o.sinComprimir===true,            (o.bytesWav||0)+' bytes'],
  ['termina limpio',               o.wavLimpio===true,               o.wavLimpio],
  ['se puede exportar otra vez',   o.segundaVez===true,              o.segundaVez],
  ['sin errores de página',        errs.length===0,                  errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
