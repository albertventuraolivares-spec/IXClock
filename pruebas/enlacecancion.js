// IXBand: compartir una canción por enlace.
//
// Dos navegadores distintos (dos «personas»): una crea el enlace y la otra lo
// abre. Se comprueba:
//  · el enlace lleva la canción comprimida detrás de «#» (no llega al
//    servidor) y abre IXBand;
//  · quien lo abre la recibe en Mis canciones, abierta, con las mismas notas,
//    secciones y tempo, y el «#…» desaparece (recargar no la duplica);
//  · «compartir» manda el enlace; sin él, se copia al portapapeles;
//  · un enlace roto avisa y no añade nada;
//  · un enlace con datos maliciosos no ejecuta nada y se limpia (el nombre
//    raro se queda como TEXTO: al pintarlo se escapa; lo que no es válido
//    —un id con comillas, un tipo con HTML, números que no son números— fuera);
//  · una canción enorme no genera un enlace que luego se cortaría.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const pedidas=[];
const srv=http.createServer((q,s)=>{pedidas.push(q.url);let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9303);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const abrir=async(url, permisos)=>{
   const ctx=await b.newContext({viewport:{width:1300,height:1000}, locale:'es-ES', permissions:permisos||[]});
   const p=await ctx.newPage();
   const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
   await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
   await p.addInitScript(()=>{ window.__pwn=0; window.__toasts=[]; });
   await p.goto(url,{waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>typeof openGarageBand==='function',null,{timeout:30000}).catch(()=>{});
   await p.evaluate(()=>{ const t=window.ixToast; window.ixToast=function(m){ window.__toasts.push(m); try{ t(m); }catch(e){} }; });
   await p.waitForTimeout(2500);
   await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
   try{ await p.click('text=Continuar como invitado',{timeout:2500}); }catch(e){}
   await p.waitForTimeout(1500);
   await p.evaluate(()=>{ try{ ixCerrarBienvenida(); }catch(e){} });
   return {ctx,p,errs};
 };
 const o={};
 // ── Persona A: crea el enlace ──
 const A=await abrir('http://localhost:9303/', ['clipboard-read','clipboard-write']);
 o.falta=await A.p.evaluate(()=>typeof gbEnlaceCancion!=='function');
 if(!o.falta){
   o.a=await A.p.evaluate(async()=>{
     openGarageBand(); await new Promise(r=>setTimeout(r,400));
     _gbBpm=96;
     _gbSecciones=[{id:'s1',nombre:'Estrofa'},{id:'s2',nombre:'Estribillo'}]; _gbSecActiva='s1';
     _gbTakes=[
       {name:'piano', sec:'s1', muted:false, solo:false, vol:0.8, pan:-0.5, events:[{at:0,freq:440,type:'piano',vel:1},{at:250,freq:523.251,type:'piano',vel:0.5}]},
       {name:'drums', sec:'s2', muted:false, solo:false, vol:1, pan:0, events:[{at:0,type:'drum',drumType:'kick',freq:60,vel:1}]},
     ];
     gbRenderTracks();
     const url=await gbEnlaceCancion();
     // Compartir con el del sistema
     let comp=null; navigator.share=async function(x){ comp=x; };
     await gbCompartirEnlace();
     // Sin él: al portapapeles
     navigator.share=undefined;
     await gbCompartirEnlace();
     const copiado=await navigator.clipboard.readText().catch(()=>'');
     // Un enlace con datos maliciosos
     const malo=await _ixComprimir(JSON.stringify({ bpm:'<b>', secciones:[{id:'s1', nombre:'<img src=x onerror=window.__pwn=1>'}, {id:'"><svg onload=window.__pwn=1>', nombre:'x'}],
       takes:[{name:'<img src=x onerror=window.__pwn=1>', sec:'s1', vol:99, events:[{at:0,freq:440,type:'piano',vel:5},{at:10,type:'"><img src=x onerror=window.__pwn=1>',vel:1},{at:'x',freq:'y',type:'piano'}]}] }));
     // Una canción enorme
     const g=[]; for(let i=0;i<15000;i++) g.push({at:i*37+Math.floor(Math.random()*9), freq:Math.random()*2000, type:'piano', vel:Math.random()});
     const guard=_gbTakes; _gbTakes=[{name:'piano', sec:'s1', events:g}];
     const enorme=await gbEnlaceCancion(); const estadoEnorme=document.getElementById('gb-status').textContent;
     _gbTakes=guard;
     return { url, comp:comp&&{title:comp.title, url:comp.url}, copiado, malo, enorme, estadoEnorme };
   });
   await A.ctx.close();
   // ── Persona B: abre el enlace ──
   const antes=pedidas.length;
   const B=await abrir(o.a.url);
   await B.p.waitForTimeout(2500);
   o.b=await B.p.evaluate(()=>({
     modal:(()=>{ const m=document.getElementById('garageband-modal'); return !!m && getComputedStyle(m).display!=='none'; })(),
     lista:gbCargarLista().map(c=>c.nombre), bpm:_gbBpm, secciones:_gbSecciones.map(x=>x.nombre),
     notas:_gbTakes.map(t=>t.name+':'+t.events.map(e=>e.type==='drum'?e.drumType:Math.round(e.freq)).join('/')),
     vol:_gbTakes[0]&&_gbTakes[0].vol, pan:_gbTakes[0]&&_gbTakes[0].pan, hash:location.hash, search:location.search,
     estado:(document.getElementById('gb-status')||{}).textContent }));
   o.alServidor=pedidas.slice(antes).filter(u=>/cancion=/.test(u));
   await B.p.reload({waitUntil:'domcontentloaded'}); await B.p.waitForTimeout(4500);
   o.trasRecarga=await B.p.evaluate(()=>gbCargarLista().length);
   o.errsB=B.errs.slice();
   await B.ctx.close();
   // ── Enlace roto ──
   const C=await abrir('http://localhost:9303/?app=ixband#cancion=AAAAtodo-roto');
   await C.p.waitForTimeout(2500);
   o.roto=await C.p.evaluate(()=>({ toasts:window.__toasts.slice(), n:gbCargarLista().length }));
   o.errsC=C.errs.slice();
   await C.ctx.close();
   // ── Enlace malicioso ──
   const D=await abrir('http://localhost:9303/?app=ixband#cancion='+o.a.malo);
   await D.p.waitForTimeout(2500);
   o.malo=await D.p.evaluate(()=>{ try{ gbRenderTracks(); }catch(e){}
     const c=gbCargarLista()[0]||{}; const d=c.datos||{};
     return { pwn:window.__pwn, bpm:d.bpm, secs:(d.secciones||[]).map(x=>x.id+':'+x.nombre), takes:(d.takes||[]).map(t=>({n:t.name, v:t.vol, ev:t.events.map(e=>e.type+':'+e.at+':'+e.vel)})),
              imgs:document.querySelectorAll('#garageband-modal img[src="x"]').length }; });
   await D.p.waitForTimeout(500);
   o.maloPwn=await D.p.evaluate(()=>window.__pwn);
   o.errsD=D.errs.slice();
   await D.ctx.close();
 }
 await b.close(); srv.close();

 const a=o.a||{}, bb=o.b||{}, m=o.malo||{};
 const errs=(o.errsB||[]).concat(o.errsC||[]).concat(o.errsD||[]);
 const pruebas=[
  ['existe',                                         !o.falta, !o.falta],
  ['el enlace abre IXBand y lleva la canción tras «#»', /^http:\/\/localhost:9303\/\?app=ixband#cancion=[A-Za-z0-9_-]{20,}$/.test(a.url||''), (a.url||'').slice(0,80)+'… ('+(a.url||'').length+')'],
  ['«compartir» manda ese enlace',                   !!a.comp && a.comp.url===a.url && /IXBand/.test(a.comp.title), JSON.stringify(a.comp&&a.comp.title)],
  ['sin «compartir», se copia al portapapeles',      a.copiado===a.url, (a.copiado||'').slice(0,60)],
  ['la canción NO llega al servidor',                Array.isArray(o.alServidor) && o.alServidor.length===0, JSON.stringify(o.alServidor)],
  ['quien lo abre: IXBand abierto',                  bb.modal===true, bb.modal],
  ['…la tiene en Mis canciones',                     (bb.lista||[]).length===1 && /^Recibida/.test(bb.lista[0]), JSON.stringify(bb.lista)],
  ['…con las mismas notas, secciones y tempo',       bb.bpm===96 && JSON.stringify(bb.secciones)==='["Estrofa","Estribillo"]' && JSON.stringify(bb.notas)==='["piano:440/523","drums:kick"]' && bb.vol===0.8 && bb.pan===-0.5, JSON.stringify([bb.bpm,bb.secciones,bb.notas,bb.vol,bb.pan])],
  ['…y se lo dice',                                  /Te han pasado una canción/.test(bb.estado||''), bb.estado],
  ['el «#…» se quita y recargar no la duplica',      bb.hash==='' && o.trasRecarga===1, bb.hash+' '+o.trasRecarga],
  ['enlace roto: avisa y no añade nada',             !!o.roto && o.roto.n===0 && o.roto.toasts.some(t=>/roto o incompleto/.test(t)), JSON.stringify(o.roto)],
  ['malicioso: no ejecuta nada',                     m.pwn===0 && o.maloPwn===0 && m.imgs===0, m.pwn+' '+o.maloPwn+' '+m.imgs],
  ['malicioso: se limpia campo a campo',             m.bpm===120 && JSON.stringify(m.secs)==='["s1:<img src=x onerror=window.__pwn=1>"]' && (m.takes||[]).length===1 && m.takes[0].n==='piano' && m.takes[0].v===1.5 && JSON.stringify(m.takes[0].ev)==='["piano:0:1","piano:0:0.8"]', JSON.stringify(m)],
  ['una canción enorme no da un enlace que se corte', a.enorme===null && /demasiado larga/.test(a.estadoEnorme||''), a.estadoEnorme],
  ['sin errores de página',                          errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
