// Boton de instalar de verdad.
//
// Antes "Instalar" solo enseñaba un cartel con instrucciones, tambien en
// Android y en el ordenador, donde el navegador ofrece el dialogo del sistema.
//
// Lo delicado es el evento: el navegador lo lanza UNA vez y hay que quedarselo
// antes de que el usuario pulse nada, y despues de usarlo ya no vale. Ademas
// en iOS ese evento NO EXISTE, asi que ahi el cartel tiene que seguir saliendo:
// quitarlo dejaria a los iPhone sin forma de instalar.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9250);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1100,height:1000}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 let carteles=0;
 p.on('dialog',d=>{ carteles++; p._ultimoCartel=d.message(); d.dismiss(); });
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9250/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixInstalarAhora==='function' && typeof ixRenderDownloads==='function',
   null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const o={};

 // --- de entrada, sin evento: sale el botón de «cómo instalar» ---
 o.sinEvento = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   ixRenderDownloads(); await w(300);
   const btn=document.getElementById('ix-instalar');
   return { hayBoton:!!btn, texto:btn?btn.textContent:'', sePuede:ixSePuedeInstalar() };
 });

 // --- pulsarlo sin evento enseña las instrucciones, no se queda mudo ---
 o.instrucciones = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const r=await ixInstalarAhora(); await w(400);
   return r;
 });
 o.cartelSalio = carteles>0;
 o.textoCartel = p._ultimoCartel||'';

 // ═══ LLEGA EL EVENTO DEL NAVEGADOR ═══
 o.conEvento = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   let prevenido=false, pedido=0;
   const ev=new Event('beforeinstallprompt');
   ev.preventDefault=function(){ prevenido=true; };
   ev.prompt=function(){ pedido++; };
   ev.userChoice=Promise.resolve({outcome:'accepted'});
   window.dispatchEvent(ev); await w(300);
   const btn=document.getElementById('ix-instalar');
   return { prevenido, sePuede:ixSePuedeInstalar(),
            texto:btn?btn.textContent:'', pedidoAntes:pedido };
 });

 // --- pulsarlo ahora abre el diálogo DE VERDAD, sin cartel ---
 const cartelesAntesDelDialogo = carteles;
 o.dialogo = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   let pedido=0;
   const ev=new Event('beforeinstallprompt');
   ev.preventDefault=function(){};
   ev.prompt=function(){ pedido++; };
   ev.userChoice=Promise.resolve({outcome:'accepted'});
   window.dispatchEvent(ev); await w(250);
   const r=await ixInstalarAhora(); await w(400);
   return { resultado:r, pedido, sePuedeDespues:ixSePuedeInstalar() };
 });
 o.sinCartelExtra = (carteles===cartelesAntesDelDialogo);

 // --- si lo rechazas, se dice, y el evento ya no vale ---
 o.rechazo = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const ev=new Event('beforeinstallprompt');
   ev.preventDefault=function(){};
   ev.prompt=function(){};
   ev.userChoice=Promise.resolve({outcome:'dismissed'});
   window.dispatchEvent(ev); await w(250);
   const r=await ixInstalarAhora(); await w(300);
   return { resultado:r, sePuedeDespues:ixSePuedeInstalar() };
 });

 // --- cuando se instala, el panel lo dice y el botón desaparece ---
 o.instalada = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.dispatchEvent(new Event('appinstalled')); await w(400);
   const btn=document.getElementById('ix-instalar');
   const t=document.getElementById('ix-downloads').innerText;
   const r=await ixInstalarAhora();
   return { hayBoton:!!btn, loDice:/está instalada/i.test(t), alPulsar:r };
 });

 // --- y las apps sueltas siguen con su cartel: el diálogo instalaría
 //     IXClocK entera, no esa app ---
 o.appSuelta = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   let abierta=null;
   const ow=window.open; window.open=(u)=>{ abierta=u; return null; };
   ixInstallApp('ixband'); await w(400);
   window.open=ow;
   return abierta;
 });
 o.cartelesTotal = carteles;

 await p.close();

 // ═══ Y AHORA EN iOS, donde ese evento NO EXISTE ═══
 const ios=await b.newContext({viewport:{width:390,height:844},
   userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
   isMobile:true, hasTouch:true});
 const p2=await ios.newPage();
 let carteles2=0, texto2='';
 p2.on('dialog',d=>{ carteles2++; texto2=d.message(); d.dismiss(); });
 await p2.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p2.goto('http://localhost:9250/',{waitUntil:'domcontentloaded'});
 await p2.waitForFunction(()=>typeof ixInstalarAhora==='function',null,{timeout:30000}).catch(()=>{});
 await p2.waitForTimeout(2500);
 await p2.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p2.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p2.waitForTimeout(2500);
 await p2.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 o.ios = await p2.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   ixRenderDownloads(); await w(300);
   const btn=document.getElementById('ix-instalar');
   const r=await ixInstalarAhora(); await w(400);
   return { esIOS:ixEsIOS(), hayBoton:!!btn, texto:btn?btn.textContent:'', resultado:r };
 });
 o.iosCartel=carteles2; o.iosTexto=texto2;
 const errs2=[]; await p2.close();

 const pruebas=[
  ['sin evento sale el botón',    o.sinEvento.hayBoton===true && /cómo instalar/i.test(o.sinEvento.texto), o.sinEvento.texto],
  ['y explica cómo hacerlo',      o.instrucciones==='instrucciones' && o.cartelSalio===true, o.textoCartel.split('\n')[0]],
  ['el evento se captura',        o.conEvento.prevenido===true && o.conEvento.sePuede===true, JSON.stringify({p:o.conEvento.prevenido,s:o.conEvento.sePuede})],
  ['y el botón cambia a «Instalar»', /^📲 Instalar IXClocK/.test(o.conEvento.texto), o.conEvento.texto],
  ['pulsarlo abre el DIÁLOGO',    o.dialogo.pedido===1 && o.dialogo.resultado==='aceptada', JSON.stringify(o.dialogo)],
  ['y el evento ya no vale',      o.dialogo.sePuedeDespues===false, o.dialogo.sePuedeDespues],
  ['sin cartel de instrucciones', o.sinCartelExtra===true,   o.sinCartelExtra],
  ['si lo rechazas, se sabe',     o.rechazo.resultado==='rechazada', o.rechazo.resultado],
  ['instalada: lo dice',          o.instalada.loDice===true && o.instalada.hayBoton===false, JSON.stringify(o.instalada)],
  ['y ya no vuelve a pedirlo',    o.instalada.alPulsar==='instalada', o.instalada.alPulsar],
  ['una app suelta sigue con su enlace', /\?app=ixband/.test(o.appSuelta||''), o.appSuelta],
  ['EN iOS se detecta',           o.ios.esIOS===true,        o.ios.esIOS],
  ['ahí sí sale el cartel',       o.ios.resultado==='instrucciones' && o.iosCartel>0, o.ios.resultado],
  ['con los pasos del iPhone',    /Compartir/.test(o.iosTexto||''), (o.iosTexto||'').split('\n')[2]||o.iosTexto],
  ['sin errores de página',       errs.length===0,           errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
