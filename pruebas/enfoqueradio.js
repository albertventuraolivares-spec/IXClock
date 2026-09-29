// El Modo Enfoque calla la radio al entrar y la devuelve al salir (idea 60).
//
// Antes: con «Sin sonido» la radio SEGUÍA sonando mientras intentabas
// concentrarte; y con un sonido de ambiente la radio se cortaba y al salir ya
// no volvía. Las emisoras de verdad no se pueden oír aquí (no hay red), así
// que se vigilan las llamadas al reproductor: qué se para y qué se vuelve a
// poner, que es justo lo que decide lo que oye la persona.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9270);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9270/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixAbrirEnfoque==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 // Espías sobre el reproductor: una emisora «suena» en cuanto se pone.
 await p.evaluate(()=>{
   window.__log=[];
   window.setStation=function(id){ window.__log.push('poner:'+id); currentStation=id; isPlaying=true; };
   window.stopAudio=function(){ window.__log.push('parar'); isPlaying=false; };
   streamPlayer.pause=function(){ window.__log.push('pausa-local'); };
   streamPlayer.play=function(){ window.__log.push('sigue-local'); return Promise.resolve(); };
 });
 const caso=(prep)=>p.evaluate(async(prep)=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   try{ ixEnfoqueSalir(); }catch(e){}
   window.__log=[]; isPlaying=false; currentStation=null; _localAudioActive=false;
   _enfCfg.sonido=prep.sonido;
   if(prep.radio){ currentStation=prep.radio; isPlaying=true; }
   if(prep.local){ _localAudioActive=true; isPlaying=true; currentStation=null; }
   ixAbrirEnfoque(); await w(150);
   const dentro={ suena:isPlaying, estacion:currentStation, log:window.__log.slice() };
   if(prep.reabrir){ ixAbrirEnfoque(); await w(100); }
   window.__log=[];
   ixEnfoqueSalir(); await w(150);
   return { dentro, fuera:{ log:window.__log.slice(), suena:isPlaying, estacion:currentStation } };
 }, prep);

 const o={};
 o.sinSonido=await caso({radio:'r-los40', sonido:''});
 o.conAmbiente=await caso({radio:'r-los40', sonido:'rain'});
 o.nadaSonaba=await caso({sonido:'rain'});
 o.reabrir=await caso({radio:'r-cadena', sonido:'cafe', reabrir:true});
 o.local=await caso({local:true, sonido:''});
 await b.close(); srv.close();

 const s=o.sinSonido, a=o.conAmbiente, n=o.nadaSonaba, r=o.reabrir, l=o.local;
 const pruebas=[
  ['SIN SONIDO: al entrar la radio se calla',   s.dentro.suena===false && s.dentro.log.includes('parar'), JSON.stringify(s.dentro)],
  ['y al salir vuelve la MISMA emisora',        s.fuera.log.includes('poner:r-los40') && s.fuera.estacion==='r-los40' && s.fuera.suena===true, JSON.stringify(s.fuera)],
  ['CON AMBIENTE: dentro suena el ambiente',    a.dentro.estacion==='rain' && a.dentro.suena===true, JSON.stringify(a.dentro)],
  ['y al salir se quita y vuelve la radio',     a.fuera.log.indexOf('parar')>=0 && a.fuera.log.indexOf('parar')<a.fuera.log.indexOf('poner:r-los40') && a.fuera.estacion==='r-los40', JSON.stringify(a.fuera)],
  ['si no sonaba nada, al salir NO pone nada',  !n.fuera.log.some(x=>/^poner:/.test(x)) && n.fuera.suena===false, JSON.stringify(n.fuera)],
  ['reabrir dentro NO olvida la radio de antes',r.fuera.estacion==='r-cadena', JSON.stringify(r.fuera)],
  ['UN ARCHIVO TUYO se pausa (no se borra)',    l.dentro.log.includes('pausa-local') && !l.dentro.log.includes('parar'), JSON.stringify(l.dentro)],
  ['y al salir sigue donde iba',                l.fuera.log.includes('sigue-local') && l.fuera.suena===true, JSON.stringify(l.fuera)],
  ['sin errores de página',                     errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
