// IXBand: exportar las pistas por separado (idea 33).
//
// Con la exportación de verdad (graba la salida mientras suena) y una canción
// corta de tres tomas, una de ellas silenciada. Se espía por dónde sale cada
// nota para saber qué sonaba durante cada grabación. Se comprueba:
//  · salen DOS archivos (las que suenan), cada uno con el nombre de su pista;
//  · mientras se graba la pista 1 solo suena el piano; en la 2, solo la batería;
//  · cada grabación dura la canción entera (para que encajen al importarlas);
//  · al acabar, cada pista vuelve a estar como estaba (la silenciada, también);
//  · el botón no deja empezar otra mientras graba;
//  · con una sola pista que suene, es la exportación normal (un archivo).
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9306);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
   args:['--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:1300,height:1000}, locale:'es-ES', acceptDownloads:true});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 const bajadas=[]; p.on('download',async d=>{ const r=await d.path().catch(()=>null); bajadas.push({ nombre:d.suggestedFilename(), tam:r?fs.statSync(r).size:0 }); });
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.addInitScript(()=>{ try{ localStorage.removeItem('ixband_cancion_v1'); }catch(e){} });
 await p.goto('http://localhost:9306/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof openGarageBand==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(1500);
 const o={};
 o.falta=await p.evaluate(async()=>{
   try{ ixCerrarBienvenida(); }catch(e){}
   openGarageBand(); await new Promise(r=>setTimeout(r,400));
   if(typeof gbExportarPistas!=='function') return true;
   _gbBpm=120; _gbSecciones=[{id:'s1',nombre:'A'}]; _gbSecActiva='s1';
   _gbTakes=[
     {name:'piano', sec:'s1', muted:false, solo:false, vol:1, pan:0, events:[{at:0,freq:440,type:'piano',vel:1},{at:500,freq:523.25,type:'piano',vel:1}]},
     {name:'drums', sec:'s1', muted:false, solo:false, vol:1, pan:0, events:[{at:0,type:'drum',drumType:'kick',freq:60,vel:1},{at:500,type:'drum',drumType:'snare',freq:200,vel:1}]},
     {name:'bajo',  sec:'s1', muted:true,  solo:false, vol:1, pan:0, events:[{at:0,freq:110,type:'bass',vel:1}]},
   ];
   gbView('tracks'); gbRenderTracks();
   // Qué suena y qué pistas estaban activas en ese momento
   window.__oido=[];
   const pn=window.gbPlayNote, pd=window.gbPlayDrum;
   const activas=()=>_gbTakes.filter(t=>!t.muted).map(t=>t.name).join('+');
   window.gbPlayNote=function(f,t,v){ window.__oido.push(activas()+':'+Math.round(f)); return pn.apply(this,arguments); };
   window.gbPlayDrum=function(t){ window.__oido.push(activas()+':'+t); return pd.apply(this,arguments); };
   window.__inicios=[]; const ex=window.gbExportarCancion;
   window.gbExportarCancion=function(f,s){ window.__inicios.push({t:Date.now(), sufijo:s||''}); return ex.apply(this,arguments); };
   return false;
 });
 if(!o.falta){
   o.res=await p.evaluate(async()=>{
     const pr=gbExportarPistas();
     await new Promise(r=>setTimeout(r,300));
     const bt=[].slice.call(document.querySelectorAll('.gb-chip')).find(x=>/Pistas sueltas/.test(x.textContent));
     const mientras={ deshabilitado:!!(bt&&bt.disabled), otra:await gbExportarPistas() };
     const hechas=await pr;
     return { hechas, mientras, oido:window.__oido.slice(), inicios:window.__inicios.slice(),
              despues:_gbTakes.map(t=>t.name+':'+(t.muted?'M':'-')+(t.solo?'S':'-')), estado:document.getElementById('gb-status').textContent };
   });
   await p.waitForTimeout(1500);
   o.bajadas1=bajadas.slice();
   // Una sola pista que suena: exportación normal
   o.una=await p.evaluate(async()=>{
     _gbTakes=[_gbTakes[0]];
     window.__inicios.length=0;
     const r=await gbExportarPistas();
     await new Promise(res=>{ (function m(){ _gbExportando ? setTimeout(m,200) : res(); })(); });
     return { r, inicios:window.__inicios.slice() };
   });
   await p.waitForTimeout(2000);
   o.bajadas2=bajadas.slice(o.bajadas1.length);
 }
 await b.close(); srv.close();

 const r=o.res||{}, oido=r.oido||[];
 const ini=r.inicios||[];
 const pruebas=[
  ['existe',                                          !o.falta, !o.falta],
  ['salen DOS archivos, con el nombre de su pista',   (o.bajadas1||[]).length===2 && / - 1 piano\.(webm|m4a|ogg)$/.test(o.bajadas1[0].nombre) && / - 2 drums\.(webm|m4a|ogg)$/.test(o.bajadas1[1].nombre), JSON.stringify(o.bajadas1)],
  ['y tienen audio',                                  (o.bajadas1||[]).length===2 && o.bajadas1.every(x=>x.tam>1000), JSON.stringify((o.bajadas1||[]).map(x=>x.tam))],
  ['pista 1: solo el piano (440 y 523)',              oido.filter(x=>/^piano:/.test(x)).join(',')==='piano:440,piano:523', JSON.stringify(oido)],
  ['pista 2: solo la batería (kick y snare)',         oido.filter(x=>/^drums:/.test(x)).join(',')==='drums:kick,drums:snare', JSON.stringify(oido)],
  ['nunca suenan dos a la vez ni la silenciada',      oido.length===4 && oido.every(x=>/^(piano|drums):/.test(x)), JSON.stringify(oido)],
  ['cada grabación dura la canción entera',           ini.length===2 && (ini[1].t-ini[0].t)>=1300, ini.length===2 ? (ini[1].t-ini[0].t)+' ms entre una y otra' : JSON.stringify(ini)],
  ['al acabar, todo como estaba',                     JSON.stringify(r.despues)==='["piano:--","drums:--","bajo:M-"]', JSON.stringify(r.despues)],
  ['y lo dice',                                       /2 pistas exportadas por separado/.test(r.estado||''), r.estado],
  ['no deja empezar otra mientras graba',             !!r.mientras && r.mientras.deshabilitado && r.mientras.otra===0, JSON.stringify(r.mientras)],
  ['una sola pista: exportación normal, un archivo',  !!o.una && o.una.r===1 && o.una.inicios.length===1 && o.una.inicios[0].sufijo==='' && (o.bajadas2||[]).length===1 && !/ - 1 /.test(o.bajadas2[0].nombre), JSON.stringify([o.una, o.bajadas2])],
  ['sin errores de página',                           errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
