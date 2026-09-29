// Bucle de práctica en IXBand (idea 62).
//
// Repite la sección que estás viendo más despacio y sube el tempo en cada
// vuelta. Se prueba con el reloj de la página controlado (sin esperas de
// verdad) y contando las notas por donde sale todo el sonido de IXBand
// (gbPlayNote); los tiempos, de lo que la práctica programa. Se comprueba:
//  · empieza al 70 %: dos notas separadas 300 ms suenan a ~429 ms;
//  · cada vuelta sube un 5 % (400 ms, 375 ms…) y lo dice en la barra;
//  · llega al tempo de verdad (300 ms) y ahí se queda, sin pasarse;
//  · solo suena la sección que estás viendo y no las pistas silenciadas;
//  · el botón cambia a «Parar» y la para; cambiar de sección también;
//  · en una sección vacía lo dice en vez de quedarse callada.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9294);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1300,height:1000}, locale:'es-ES'});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.addInitScript(()=>{ try{ localStorage.removeItem('ixband_cancion_v1'); }catch(e){} });
 await p.goto('http://localhost:9294/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof openGarageBand==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 const o={};
 o.falta=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   try{ ixCerrarBienvenida(); }catch(e){}
   openGarageBand(); await w(500);
   if(typeof gbPracticaToggle!=='function') return true;
   _gbBpm=100;
   _gbSecciones=[{id:'s1',nombre:'A'},{id:'s2',nombre:'B'},{id:'s3',nombre:'C'}];
   _gbSecActiva='s1';
   _gbTakes=[
     {name:'piano', sec:'s1', muted:false, solo:false, vol:1, pan:0, events:[{at:0,freq:440,type:'piano',vel:1},{at:300,freq:523.25,type:'piano',vel:1}]},
     {name:'muda',  sec:'s1', muted:true,  solo:false, vol:1, pan:0, events:[{at:0,freq:880,type:'piano',vel:1}]},
     {name:'otra',  sec:'s2', muted:false, solo:false, vol:1, pan:0, events:[{at:0,freq:220,type:'piano',vel:1}]},
   ];
   gbView('tracks'); gbRenderTracks();
   window.__n=[];
   window.gbPlayNote=function(f){ window.__n.push({f:Math.round(f), t:Date.now()}); };
   return false;
 });
 if(!o.falta){
   await p.clock.install();
   // Los tiempos se leen de lo que la práctica PROGRAMA (setTimeout desde
   // «ronda»), que es exacto; medir cuándo suena depende de la máquina.
   await p.evaluate(()=>{ window.__d=[]; const st=window.setTimeout;
     window.setTimeout=function(f,ms){ if(typeof f==='function' && /gbPlayNote/.test(String(f)) && /ronda/.test(new Error().stack||'')) window.__d.push(ms); return st.apply(this, arguments); }; });
   const estado=()=>p.evaluate(()=>({ txt:(document.getElementById('gb-status')||{}).textContent||'', btn:(document.getElementById('gb-practica-btn')||{}).textContent||'' }));
   await p.click('#gb-practica-btn');
   await p.clock.runFor(3300);   // vuelta 1 (1600 ms) + vuelta 2 (1533 ms) + empieza la 3
   o.tres=await estado();
   o.n1=await p.evaluate(()=>window.__n.slice()); o.d1=await p.evaluate(()=>window.__d.slice());
   await p.clock.runFor(15000);
   o.tope=await estado();
   o.n2=await p.evaluate(()=>window.__n.slice()); o.d2=await p.evaluate(()=>window.__d.slice());
   // Parar con el botón
   await p.click('#gb-practica-btn');
   o.parada=await estado();
   await p.clock.runFor(5000);
   o.trasParar=(await p.evaluate(()=>window.__n.length))-o.n2.length;
   // Cambiar de sección la para
   await p.click('#gb-practica-btn');
   await p.clock.runFor(200);
   await p.evaluate(()=>{ gbSecIr('s2'); });
   const n=await p.evaluate(()=>window.__n.length);
   await p.clock.runFor(5000);
   o.trasSeccion=(await p.evaluate(()=>window.__n.length))-n;
   o.btnSeccion=(await estado()).btn;
   // Sección vacía
   await p.evaluate(()=>{ gbSecIr('s3'); });
   await p.click('#gb-practica-btn');
   o.vacia=await estado();
 }
 await b.close(); srv.close();

 // Distancia entre cada 440 y el 523 que le sigue, vuelta a vuelta
 // Cada vuelta programa [nota 1, nota 2, siguiente vuelta]: la 2.ª es la distancia
 const pasos=d=>{ const r=[]; for(let i=0;i+1<(d||[]).length;i+=3) r.push(Math.round(d[i+1])); return r; };
 const p1=pasos(o.d1), p2=pasos(o.d2);
 const cerca=(a,b)=>Math.abs(a-b)<=6;
 const pruebas=[
  ['existe',                                         !o.falta, !o.falta],
  ['empieza al 70 %: 300 ms suenan a ~429 ms',       p1.length>=1 && cerca(p1[0],429), JSON.stringify(p1)],
  ['cada vuelta sube un 5 % (400, 375 ms)',          p1.length>=2 && cerca(p1[1],400) && (p1.length<3 || cerca(p1[2],375)), JSON.stringify(p1)],
  ['y lo dice: «vuelta 3 · 80 % (80 bpm)»',          !!o.tres && /vuelta 3 · 80 % \(80 bpm\)/.test(o.tres.txt), o.tres&&o.tres.txt],
  ['el botón pasa a «Parar práctica»',               !!o.tres && /Parar práctica/.test(o.tres.btn), o.tres&&o.tres.btn],
  ['llega al tempo de verdad (300 ms)…',             p2.length>=7 && cerca(p2[p2.length-1],300), JSON.stringify(p2)],
  ['…y no se pasa',                                  p2.length>0 && p2.every(d=>d>=294), JSON.stringify(p2)],
  ['la barra dice «100 % · ¡a tempo!»',              !!o.tope && /100 % \(100 bpm\) · ¡a tempo!/.test(o.tope.txt), o.tope&&o.tope.txt],
  ['solo la sección que ves, sin la silenciada',     !!o.n2 && o.n2.every(x=>x.f===440||x.f===523), JSON.stringify([...new Set((o.n2||[]).map(x=>x.f))])],
  ['el botón la para',                               o.trasParar===0 && !!o.parada && /parada/.test(o.parada.txt) && /Práctica lenta/.test(o.parada.btn), o.trasParar+' '+JSON.stringify(o.parada)],
  ['cambiar de sección también',                     o.trasSeccion===0 && /Práctica lenta/.test(o.btnSeccion||''), o.trasSeccion+' '+o.btnSeccion],
  ['en una sección vacía lo dice',                   !!o.vacia && /No hay nada que practicar/.test(o.vacia.txt) && /Práctica lenta/.test(o.vacia.btn), JSON.stringify(o.vacia)],
  ['sin errores de página',                          errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
