// Controles del sistema para la radio: Media Session (idea 43).
//
// Lo que ve la persona en la pantalla de bloqueo del móvil sale de
// navigator.mediaSession: el título (la emisora), el «artista» (su
// descripción) y si está sonando o en pausa. Y lo que hacen los botones de
// esa pantalla son los manejadores registrados. Se comprueba las dos cosas:
//  · al sonar una emisora, el sistema la conoce por su NOMBRE y sabe que suena;
//  · al pararla, pasa a «en pausa»;
//  · pausa / siguiente / anterior desde el sistema hacen lo que dicen.
// Sin red no hay emisoras reales: el reproductor finge que arranca bien.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9271);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 // Se apuntan los manejadores que registra la app, para pulsarlos luego
 // como lo haría el sistema.
 await p.addInitScript(()=>{
   window.__acciones={};
   try{
     const orig=navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
     navigator.mediaSession.setActionHandler=function(a,f){ window.__acciones[a]=f; try{ orig(a,f); }catch(e){} };
   }catch(e){}
   // Sin red, cada emisora daría error de carga: se corta aquí, antes de
   // que llegue a la app, para probar el camino de cuando SÍ suena.
   window.addEventListener('error', e=>{ if(e.target instanceof HTMLMediaElement && !window.__dejarError) e.stopImmediatePropagation(); }, true);
   // El audio «arranca bien» sin red
   HTMLMediaElement.prototype.play=function(){ Object.defineProperty(this,'paused',{configurable:true,get:()=>false}); this.dispatchEvent(new Event('playing')); return Promise.resolve(); };
   const pausa=HTMLMediaElement.prototype.pause;
   HTMLMediaElement.prototype.pause=function(){ Object.defineProperty(this,'paused',{configurable:true,get:()=>true}); try{ pausa.call(this); }catch(e){} this.dispatchEvent(new Event('pause')); };
 });
 await p.goto('http://localhost:9271/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof setStation==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 const o={};
 o.estado=()=>p.evaluate(()=>({ titulo:navigator.mediaSession.metadata && navigator.mediaSession.metadata.title,
   artista:navigator.mediaSession.metadata && navigator.mediaSession.metadata.artist,
   arte:navigator.mediaSession.metadata ? navigator.mediaSession.metadata.artwork.length : 0,
   estado:navigator.mediaSession.playbackState, suena:isPlaying, estacion:currentStation }));

 o.acciones=await p.evaluate(()=>Object.keys(window.__acciones).sort());
 o.emisora=await p.evaluate(()=>{ const st=STATIONS.find(s=>s.type==='stream'); return st ? {id:st.id, title:st.title, idx:STATIONS.indexOf(st)} : null; });
 await p.evaluate(id=>setStation(id), o.emisora.id);
 await p.waitForTimeout(300);
 o.sonando=await o.estado();
 // Pausa desde el sistema
 await p.evaluate(()=>{ window.__acciones.pause && window.__acciones.pause(); });
 await p.waitForTimeout(200);
 o.pausa=await o.estado();
 // Play desde el sistema
 await p.evaluate(()=>{ window.__acciones.play && window.__acciones.play(); });
 await p.waitForTimeout(300);
 o.play=await o.estado();
 // Siguiente y anterior
 await p.evaluate(()=>{ window.__acciones.nexttrack && window.__acciones.nexttrack(); });
 await p.waitForTimeout(300);
 o.siguiente=await o.estado();
 o.esperadaSig=await p.evaluate(i=>STATIONS[(i+1)%STATIONS.length].id, o.emisora.idx);
 await p.evaluate(()=>{ window.__acciones.previoustrack && window.__acciones.previoustrack(); });
 await p.waitForTimeout(300);
 o.anterior=await o.estado();
 // Una emisora que falla: el sistema no puede seguir diciendo «sonando»
 o.caida=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__dejarError=true;
   Object.defineProperty(streamPlayer,'error',{configurable:true,get:()=>({code:2})});
   streamPlayer.dispatchEvent(new Event('error'));
   await w(100);
   const r=navigator.mediaSession.playbackState;
   delete streamPlayer.error; window.__dejarError=false;
   return r;
 });
 // Parar desde la app
 await p.evaluate(()=>stopAudio());
 await p.waitForTimeout(200);
 o.parada=await o.estado();
 await b.close(); srv.close();

 const pruebas=[
  ['la app registra pausa, play, siguiente y anterior', ['nexttrack','pause','play','previoustrack'].every(a=>o.acciones.includes(a)), o.acciones.join(',')],
  ['AL SONAR: el sistema ve el nombre de la emisora',  o.sonando.titulo===o.emisora.title, o.sonando.titulo+' / '+o.emisora.title],
  ['con descripción e icono',                          !!o.sonando.artista && o.sonando.arte>=1, JSON.stringify(o.sonando)],
  ['y sabe que está sonando',                          o.sonando.estado==='playing', o.sonando.estado],
  ['PAUSA del sistema la para',                        o.pausa.suena===false && o.pausa.estado==='paused', JSON.stringify(o.pausa)],
  ['PLAY del sistema la vuelve a poner',               o.play.suena===true && o.play.estado==='playing' && o.play.estacion===o.emisora.id, JSON.stringify(o.play)],
  ['SIGUIENTE cambia a la siguiente emisora',          o.siguiente.estacion===o.esperadaSig && o.siguiente.estacion!==o.emisora.id, o.siguiente.estacion+' / '+o.esperadaSig],
  ['y el sistema enseña la nueva',                     o.siguiente.titulo && o.siguiente.titulo!==o.emisora.title, o.siguiente.titulo],
  ['ANTERIOR vuelve a la de antes',                    o.anterior.estacion===o.emisora.id, o.anterior.estacion],
  ['si la emisora falla, pasa a «en pausa»',          o.caida==='paused', o.caida],
  ['al parar desde la app pasa a «en pausa»',          o.parada.estado==='paused', o.parada.estado],
  ['sin errores de página',                            errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
