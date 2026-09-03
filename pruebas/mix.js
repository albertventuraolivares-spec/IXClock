const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9170);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1150,height:850}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9170/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2400);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); await p.waitForTimeout(700);}catch(e){}
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 const r=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms)); const o={};
   openGarageBand(); await wait(350);
   // 3 pistas de prueba
   _gbTakes.length=0;
   for(const n of ['piano','guitar','drums']){
     _gbTakes.push({name:n,muted:false,solo:false,vol:1,pan:0,
       events:[{at:0,type:n==='drums'?'drum':n,freq:440,drumType:'kick',vel:0.9}]});
   }
   gbView('tracks'); gbRenderTracks(); await wait(300);
   o.filas=document.querySelectorAll('.gb-mix').length;
   o.deslizadores=document.querySelectorAll('.gb-mix input[type=range]').length;
   o.botonSolo=document.querySelectorAll('[onclick^="gbToggleSolo"]').length;
   // --- VOLUMEN llega al nodo de ganancia ---
   gbSetVol(0,0.4); o.volGuardado=_gbTakes[0].vol===0.4;
   o.volEtiqueta=document.getElementById('gb-vol-0').textContent==='40%';
   const canal=_gbCanalPista(_gbTakes[0]);
   o.volEnAudio=Math.abs(canal.gain.value-0.4)<0.001;
   // --- PANEO crea el nodo y lo coloca ---
   gbSetPan(1,-0.8); o.panGuardado=_gbTakes[1].pan===-0.8;
   o.panEtiqueta=document.getElementById('gb-pan-1').textContent;
   let panEncontrado=null;
   const origPan=_gbAudioCtx.createStereoPanner.bind(_gbAudioCtx);
   _gbAudioCtx.createStereoPanner=function(){ const n=origPan(); panEncontrado=n; return n; };
   _gbCanalPista(_gbTakes[1]);
   _gbAudioCtx.createStereoPanner=origPan;
   o.panEnAudio=panEncontrado && Math.abs(panEncontrado.pan.value-(-0.8))<0.001;
   // paneo al centro no crea nodo de mas
   panEncontrado=null;
   _gbAudioCtx.createStereoPanner=function(){ const n=origPan(); panEncontrado=n; return n; };
   _gbCanalPista({vol:1,pan:0}); _gbAudioCtx.createStereoPanner=origPan;
   o.centroSinNodo=panEncontrado===null;
   // --- SILENCIO y SOLO deciden quien suena ---
   _gbTakes.forEach(t=>{t.muted=false;t.solo=false;});
   o.todasSuenan=_gbTakes.every(t=>_gbPistaSuena(t));
   _gbTakes[0].muted=true;
   o.silenciada=!_gbPistaSuena(_gbTakes[0]) && _gbPistaSuena(_gbTakes[1]);
   _gbTakes[0].muted=false; _gbTakes[1].solo=true;
   o.soloAisla=_gbPistaSuena(_gbTakes[1]) && !_gbPistaSuena(_gbTakes[0]) && !_gbPistaSuena(_gbTakes[2]);
   _gbTakes[1].muted=true;
   o.silencioGanaASolo=!_gbPistaSuena(_gbTakes[1]);
   _gbTakes.forEach(t=>{t.muted=false;t.solo=false;});
   // --- la mezcla respeta solo ---
   _gbTakes[2].solo=true;
   let sonaron=[]; const on=window.gbPlayNote, od=window.gbPlayDrum;
   window.gbPlayNote=function(f,t){sonaron.push(t);return on.apply(this,arguments);};
   window.gbPlayDrum=function(t){sonaron.push('drum');return od.apply(this,arguments);};
   gbPlayAllTakes(); await wait(400);
   window.gbPlayNote=on; window.gbPlayDrum=od;
   o.mezclaSoloDrums = sonaron.length>0 && sonaron.every(x=>x==='drum');
   _gbTakes.forEach(t=>{t.solo=false;});
   // --- al reproducir, la salida vuelve a la normal ---
   gbPlayTake(0); await wait(300);
   o.salidaRestaurada=_gbSalidaPista===null;
   // --- una toma nueva nace con vol y pan ---
   _gbRecorded=[{time:Date.now(),freq:440,type:'piano'}];
   _gbSelectedInstrument='piano'; gbSaveTake();
   const nueva=_gbTakes[_gbTakes.length-1];
   o.tomaNueva=nueva.vol===1 && nueva.pan===0 && nueva.solo===false;
   _gbTakes.length=0; gbRenderTracks();
   return o;
 });
 console.log(JSON.stringify(r,null,1));
 const ok=(k,v)=>console.log((v?'  ✓ ':'  ✗ ')+k);
 console.log('--- MEZCLADOR DE IXBAND ---');
 ok('3 pistas con sus controles (volumen + paneo) y botón Solo', r.filas===3 && r.deslizadores===6 && r.botonSolo===3);
 ok('el volumen llega de verdad al audio', r.volGuardado && r.volEtiqueta && r.volEnAudio);
 ok('el paneo coloca la pista en el estéreo', r.panGuardado && /Izq 80/.test(r.panEtiqueta) && r.panEnAudio);
 ok('centrado no crea nodo de paneo de más', r.centroSinNodo);
 ok('silenciar quita solo esa pista', r.todasSuenan && r.silenciada);
 ok('Solo aísla su pista y silencia las demás', r.soloAisla);
 ok('silenciar manda sobre Solo', r.silencioGanaASolo);
 ok('la mezcla respeta el Solo', r.mezclaSoloDrums);
 ok('tras reproducir, la salida vuelve al bus normal', r.salidaRestaurada);
 ok('una toma nueva nace con volumen y paneo', r.tomaNueva);
 console.log('ERRORES JS:',errs.length?[...new Set(errs)].slice(0,3).join(' | '):'(ninguno)');
 await b.close();srv.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
