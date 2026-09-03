const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9180);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1100,height:850}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9180/',{waitUntil:'domcontentloaded'});
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
   openGarageBand(); await wait(400);
   _gbBpm=240;   // 4 tiempos = 1 s, para no esperar tanto
   o.botones=!!document.getElementById('gb-count-btn') && !!document.getElementById('gb-compas-btn');
   // --- sin cuenta atras, grabar empieza YA ---
   _gbCuentaAtras=false; if(_gbRecording) gbRecord();
   gbRecord(); await wait(60);
   o.sinCuentaGrabaYa=_gbRecording===true;
   gbRecord(); await wait(60);
   // --- con cuenta atras: NO graba hasta terminar la claqueta ---
   gbToggleCuentaAtras(); o.activada=_gbCuentaAtras===true;
   let tics=0; const ot=window._gbTick; window._gbTick=function(a){tics++; return ot.apply(this,arguments);};
   gbRecord(); await wait(120);
   o.aunNoGraba=_gbRecording===false;
   o.avisoVisible=(()=>{const e=document.getElementById('gb-cuenta');return !!e && getComputedStyle(e).display!=='none';})();
   o.numeroGrande=(document.getElementById('gb-cuenta')||{}).textContent;
   await wait(1400);   // 4 tiempos a 240bpm = 1s
   window._gbTick=ot;
   o.grabaTrasCuenta=_gbRecording===true;
   o.ticsDeClaqueta=tics;
   o.avisoOculto=(()=>{const e=document.getElementById('gb-cuenta');return !e || getComputedStyle(e).display==='none';})();
   gbRecord(); await wait(80);
   // --- pulsar durante la cuenta la cancela ---
   gbRecord(); await wait(150);
   o.cuentaEnMarcha=_gbCuentaTimer!==null;
   gbRecord(); await wait(150);
   o.cancelada=_gbCuentaTimer===null && _gbRecording===false;
   // --- COMPAS ---
   _gbCompas=4;
   const b1=document.getElementById('gb-compas-btn');
   gbCambiarCompas(); o.c1={n:_gbCompas,t:b1.textContent};
   gbCambiarCompas(); o.c2={n:_gbCompas,t:b1.textContent};
   gbCambiarCompas(); o.c3={n:_gbCompas,t:b1.textContent};
   gbCambiarCompas(); o.vuelta={n:_gbCompas,t:b1.textContent};
   // la claqueta cuenta segun el compas
   _gbCompas=3; let t3=0; const ot2=window._gbTick; window._gbTick=function(){t3++;};
   await new Promise(res=>gbCuentaAtrasYGraba(res));
   window._gbTick=ot2; o.claqueta3=t3;
   // el LCD usa el compas elegido
   // El LCD solo avanza mientras grabas o suenan los loops: hay que simularlo.
   _gbCompas=3; _gbRecording=true; _gbBeatStart=Date.now()-((60000/240)*4);
   gbStartLCD(); await wait(200);
   o.lcd=(document.getElementById('gb-lcd-beat')||{}).textContent;   // 4 tiempos en 3/4 = compas 2, tiempo 2
   _gbRecording=false; _gbCompas=4; _gbCuentaAtras=false; _gbBpm=120;
   return o;
 });
 console.log(JSON.stringify(r,null,1));
 const ok=(k,v)=>console.log((v?'  ✓ ':'  ✗ ')+k);
 console.log('--- CUENTA ATRÁS Y COMPÁS ---');
 ok('botones de cuenta atrás y compás en la barra', r.botones);
 ok('sin cuenta atrás, ⏺ graba al instante (como antes)', r.sinCuentaGrabaYa);
 ok('con cuenta atrás NO graba hasta terminar la claqueta', r.activada && r.aunNoGraba);
 ok('se ve el número grande contando', r.avisoVisible && /^[1-9]$/.test(r.numeroGrande||''));
 ok('al acabar la claqueta empieza a grabar y el número desaparece', r.grabaTrasCuenta && r.avisoOculto);
 ok('la claqueta suena 4 veces en 4/4', r.ticsDeClaqueta===4);
 ok('pulsar ⏺ durante la cuenta la cancela', r.cuentaEnMarcha && r.cancelada);
 ok('el compás rota 4/4 → 3/4 → 6/8 → 2/4 → 4/4', r.c1.t==='3/4'&&r.c2.t==='6/8'&&r.c3.t==='2/4'&&r.vuelta.t==='4/4');
 ok('en 3/4 la claqueta cuenta 3', r.claqueta3===3);
 ok('el LCD cuenta compases según el compás elegido', r.lcd==='2.2');
 console.log('ERRORES JS:',errs.length?[...new Set(errs)].slice(0,3).join(' | '):'(ninguno)');
 await b.close();srv.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
