const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9110);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1024,height:768}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9110/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2400);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); await p.waitForTimeout(600);}catch(e){}
 const r=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms)); const o={};
   o.enLista=/'stopAudio'/.test(ixCerrarTodasLasVentanas.toString());
   o.existe=typeof stopAudio==='function';
   // Simula radio sonando + una ventana abierta
   isPlaying=true;
   openGarageBand(); await wait(250);
   o.antesCasa=_isHomeScreen(); o.antesSonando=isPlaying;
   const n=ixCerrarTodasLasVentanas(); await wait(250);
   o.ventanasCerradas=n; o.ahoraCasa=_isHomeScreen();
   o.audioParado=isPlaying===false;
   o.botonPlayReset=(document.getElementById('global-play')||{}).innerHTML||'';
   // Aunque falle algo, el resto de paradas siguen: comprobamos con el Drummer
   isPlaying=true;
   openGarageBand(); await wait(200); gbOpenInstrument('drummer'); gbDrummerStart(); await wait(150);
   ixCerrarTodasLasVentanas(); await wait(200);
   o.drummerParado=_gbDrummerTimer===null; o.audioParado2=isPlaying===false;
   return o;
 });
 console.log(JSON.stringify(r,null,1));
 const ok=(k,v)=>console.log((v?'  ✓ ':'  ✗ ')+k);
 console.log('--- stopAudio en cerrar todas ---');
 ok('stopAudio existe y está en la lista', r.existe && r.enLista);
 ok('cerrar todas para la radio/música (isPlaying pasa a false)', r.antesSonando && r.audioParado);
 ok('el botón de reproducir vuelve a ▶️', /▶/.test(r.botonPlayReset));
 ok('sigue cerrando las ventanas', !r.antesCasa && r.ventanasCerradas>0 && r.ahoraCasa);
 ok('convive con las demás paradas (Drummer + audio a la vez)', r.drummerParado && r.audioParado2);
 console.log('ERRORES JS:',errs.length?[...new Set(errs)].slice(0,3).join(' | '):'(ninguno)');
 await b.close();srv.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
