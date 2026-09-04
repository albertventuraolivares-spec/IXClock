// Dos fallos mas que salieron de las auditorias.
//
// 1. "Cerrar todas las ventanas" no cerraba el Modo Enfoque. Y no es solo que
//    se quedara el overlay: seguian corriendo el temporizador, el bloqueo de
//    pantalla y el sonido de ambiente. Este me lo comi yo al anadir el Modo
//    Enfoque: el overlay se crea al vuelo, asi que no estaba en las listas de
//    ids que recorre esa funcion.
// 2. En el Traductor, con el mismo idioma en "de" y "a", el resultado salia
//    pero el boton de copiar se quedaba invisible encima de un texto que si
//    estaba.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9242);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
   args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1280,height:1000}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9242/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixAbrirEnfoque==='function' && typeof translateText==='function',
   null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const o={};

 // ═══ 1. CERRAR TODAS cierra tambien el Modo Enfoque, y de verdad ═══
 o.enfoque = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   // se cuentan las paradas de sonido y se finge el bloqueo de pantalla
   let sueltas=0;
   const origWL=navigator.wakeLock;
   Object.defineProperty(navigator,'wakeLock',{configurable:true, value:{
     request:()=>Promise.resolve({ release(){ sueltas++; }, addEventListener(){} })
   }});
   let parado=0; const op=window.stopAudio; window.stopAudio=()=>{ parado++; };
   let sono=null; const os=window.setStation; window.setStation=id=>{ sono=id; };

   ixEnfoqueSonido('cafe');
   ixAbrirEnfoque(); await w(600);
   const antes = {
     visible: getComputedStyle(document.getElementById('ix-enfoque')).display!=='none',
     temporizador: _enfTic!==null,
     sonando: sono
   };
   const paradoAntes=parado;
   ixCerrarTodasLasVentanas(); await w(600);
   const despues = {
     visible: getComputedStyle(document.getElementById('ix-enfoque')).display!=='none',
     temporizador: _enfTic!==null,
     paroSonido: parado>paradoAntes,
     soltoPantalla: sueltas>0
   };
   window.stopAudio=op; window.setStation=os;
   Object.defineProperty(navigator,'wakeLock',{configurable:true, value:origWL});
   ixEnfoqueSonido('');
   return { antes, despues };
 });

 // el aviso no puede mentir: si dice que cerro N, esas N estaban abiertas
 o.cuenta = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   ixCerrarTodasLasVentanas(); await w(400);
   const conNada=ixCerrarTodasLasVentanas();
   await w(300);
   openCloudPanel(); await w(400);
   const conUna=ixCerrarTodasLasVentanas();
   await w(300);
   return { conNada, conUna };
 });

 // y sin el Modo Enfoque abierto, cerrar todo no revienta
 o.sinEnfoque = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   let revento=false;
   try{ ixCerrarTodasLasVentanas(); }catch(e){ revento=true; }
   await w(300);
   return !revento;
 });

 // ═══ 2. TRADUCTOR con el mismo idioma en «de» y «a» ═══
 o.traductor = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   try{ if(!translatorOpen) toggleTranslator(); }catch(e){}
   await w(500);
   const inp=document.getElementById('trans-input');
   const out=document.getElementById('trans-output');
   const from=document.getElementById('trans-from');
   const to=document.getElementById('trans-to');
   const copia=document.getElementById('trans-copy-btn');
   if(!inp||!out||!from||!to||!copia) return {falta:true};

   // se parte de un boton escondido, como al abrir
   copia.style.opacity='0';
   from.value=from.options[0].value;
   to.value=from.value;                       // MISMO idioma
   inp.value='hola qué tal';
   await translateText();
   await w(400);
   await w(600);                              // la opacidad va con transicion
   return { falta:false,
            salida: out.value,
            opacidad: parseFloat(getComputedStyle(copia).opacity),
            mismoIdioma: from.value===to.value,
            aviso: (document.getElementById('trans-status')||{}).textContent||'' };
 });

 // y copiar de verdad copia lo que hay
 o.copiar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   let copiado=null;
   const orig=navigator.clipboard;
   Object.defineProperty(navigator,'clipboard',{configurable:true,
     value:{ writeText:t=>{ copiado=t; return Promise.resolve(); } }});
   try{ document.getElementById('trans-copy-btn').click(); }catch(e){}
   await w(400);
   Object.defineProperty(navigator,'clipboard',{configurable:true, value:orig});
   return copiado;
 });

 // sin texto no se enseña un botón que no copiaría nada
 o.vacio = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const copia=document.getElementById('trans-copy-btn');
   copia.style.opacity='0';
   document.getElementById('trans-input').value='   ';
   await translateText();
   await w(300);
   await w(600);
   return { opacidad:parseFloat(getComputedStyle(copia).opacity),
            salida:document.getElementById('trans-output').value };
 });

 // ═══ 3. XSS en Mi Nube → Mis Datos ═══
 // El "Estado" lo escribe el usuario a mano y acaba en innerHTML.
 o.nube = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__pwn=0;
   localStorage.setItem('user_status','<img src=x onerror="window.__pwn=1">');
   localStorage.setItem('cal_events','{"x":["<img src=x onerror=\\"window.__pwn=2\\">"]}');
   openCloudPanel(); await w(500);
   cloudTab('data'); await w(600);
   const cont=document.getElementById('cloud-content');
   const txt=cont?cont.innerText:'';
   const imgs=cont?cont.querySelectorAll('img').length:0;
   const r={ pwn:window.__pwn, imgs,
             seVeElTexto:/img src=x/.test(txt),
             saleLaClave:/user_status/.test(txt) };
   localStorage.removeItem('user_status');
   localStorage.removeItem('cal_events');
   try{ ixCerrarTodasLasVentanas(); }catch(e){}
   await w(300);
   return r;
 });

 await p.close();

 const pruebas=[
  ['ENFOQUE: se abre',            o.enfoque.antes.visible===true && o.enfoque.antes.temporizador===true, JSON.stringify(o.enfoque.antes)],
  ['con su sonido de ambiente',   o.enfoque.antes.sonando==='cafe', o.enfoque.antes.sonando],
  ['«cerrar todo» lo cierra',     o.enfoque.despues.visible===false, o.enfoque.despues.visible],
  ['y para el temporizador',      o.enfoque.despues.temporizador===false, o.enfoque.despues.temporizador],
  ['y el sonido',                 o.enfoque.despues.paroSonido===true, o.enfoque.despues.paroSonido],
  ['y suelta la pantalla',        o.enfoque.despues.soltoPantalla===true, o.enfoque.despues.soltoPantalla],
  ['el aviso no miente',          o.cuenta.conNada===0 && o.cuenta.conUna>=1, JSON.stringify(o.cuenta)],
  ['sin nada abierto no revienta',o.sinEnfoque===true,       o.sinEnfoque],
  ['TRADUCTOR: mismo idioma, sale el texto', o.traductor.falta!==true && o.traductor.salida==='hola qué tal', o.traductor.salida],
  ['y el botón de copiar SE VE',  o.traductor.opacidad>0.9,  o.traductor.opacidad],
  ['y dice por qué no traduce',   /mismo idioma/i.test(o.traductor.aviso||''), o.traductor.aviso],
  ['copiar copia lo que hay',     o.copiar==='hola qué tal', o.copiar],
  ['sin texto no sale el botón',  o.vacio.opacidad<0.1 && o.vacio.salida==='', JSON.stringify(o.vacio)],
  ['MI NUBE: no se ejecuta',      o.nube.pwn===0,            o.nube.pwn],
  ['ni se crea la etiqueta',      o.nube.imgs===0,           o.nube.imgs+' <img>'],
  ['pero el valor se sigue viendo',o.nube.seVeElTexto===true && o.nube.saleLaClave===true, JSON.stringify(o.nube)],
  ['sin errores de página',       errs.length===0,           errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
