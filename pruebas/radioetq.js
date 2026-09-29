// Etiquetas en las emisoras favoritas (idea 45) y las alarmas del panel viejo
// en la sincronización (idea 80, se prueba en nubeclaves.js).
//
// Se usa la lista de emisoras de verdad (Sonidos y Radio):
//  · 🏷️ en una favorita va pasando por Dormir → Trabajar → Deporte → Coche →
//    sin etiqueta, y la etiqueta se ve junto al nombre;
//  · tocar 🏷️ NO pone la emisora a sonar (está dentro del botón de la emisora);
//  · arriba salen filtros SOLO de las etiquetas que usas, y filtrar deja solo
//    esas; el filtro se recuerda;
//  · si quitas la última etiqueta de un filtro, el filtro se quita solo (si
//    no, la lista de favoritas se quedaría vacía sin explicación);
//  · las etiquetas viajan con la sincronización.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9279);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1300,height:1000}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9279/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof renderStations==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 const o=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const r={};
   if(typeof radioCambiarEtiqueta!=='function') return {falta:true};
   window.__sonando=[]; const orig=window.setStation; window.setStation=function(id){ window.__sonando.push(id); };
   const ids=STATIONS.slice(0,3).map(s=>s.id);
   ids.forEach(id=>toggleFavoritaRadio(id)); await w(100);
   const boton=id=>document.querySelector('#station-'+CSS.escape(id)+' .radio-etq-btn');
   const etiqueta=id=>{ const e=document.querySelector('#station-'+CSS.escape(id)+' .radio-etq'); return e?e.textContent:''; };
   // Tocar 🏷️ de verdad (click en el elemento)
   boton(ids[0]).click(); await w(50);
   boton(ids[1]).click(); await w(50); boton(ids[1]).click(); await w(50);
   r.etq0=etiqueta(ids[0]); r.etq1=etiqueta(ids[1]); r.etq2=etiqueta(ids[2]);
   r.noSono=window.__sonando.slice();
   r.filtros=[].slice.call(document.querySelectorAll('.radio-etq-filtro')).map(b=>b.textContent);
   // Filtrar por Dormir
   [].slice.call(document.querySelectorAll('.radio-etq-filtro')).find(b=>/Dormir/.test(b.textContent)).click(); await w(50);
   const favsVisibles=()=>{ const cont=document.getElementById('stations-container'); const html=cont.innerHTML; const i=html.indexOf('Tus favoritas'); const j=html.indexOf('height:1px;background:rgba(255,255,255,.1)', i);
     const tmp=document.createElement('div'); tmp.innerHTML=html.slice(i, j); return [].slice.call(tmp.querySelectorAll('.station-btn')).map(b=>b.id.replace('station-','')); };
   r.conFiltro=favsVisibles();
   renderStations(); await w(50);
   r.recuerda=favsVisibles();
   // Pasar Dormir por todas hasta quitarla: el filtro se quita solo
   for(let i=0;i<4;i++){ boton(ids[0]).click(); await w(30); }
   r.trasQuitar={ etq:etiqueta(ids[0]), favs:favsVisibles(), filtros:[].slice.call(document.querySelectorAll('.radio-etq-filtro')).map(b=>b.textContent) };
   r.sube=Object.keys(ixNubeRecoger()).indexOf('ix_radio_etiquetas')>=0;
   r.ids=ids;
   window.setStation=orig;
   return r;
 });
 await b.close(); srv.close();

 const pruebas=[
  ['existe',                                   !o.falta, !o.falta],
  ['🏷️ una vez: 😴 Dormir',                     /Dormir/.test(o.etq0||''), o.etq0],
  ['dos veces: 💼 Trabajar',                    /Trabajar/.test(o.etq1||''), o.etq1],
  ['sin tocar: sin etiqueta',                   (o.etq2||'')==='', o.etq2],
  ['tocar 🏷️ NO pone la emisora a sonar',       (o.noSono||[]).length===0, JSON.stringify(o.noSono)],
  ['filtros: solo los que usas',                JSON.stringify(o.filtros)===JSON.stringify(['Todas','😴 Dormir','💼 Trabajar']), JSON.stringify(o.filtros)],
  ['filtrar Dormir deja solo esa',              !!o.conFiltro && o.conFiltro.length===1 && o.conFiltro[0]===o.ids[0], JSON.stringify(o.conFiltro)],
  ['y el filtro se recuerda',                   JSON.stringify(o.recuerda)===JSON.stringify(o.conFiltro), JSON.stringify(o.recuerda)],
  ['al quitar la última de un filtro, vuelven todas', !!o.trasQuitar && o.trasQuitar.etq==='' && o.trasQuitar.favs.length===3, JSON.stringify(o.trasQuitar)],
  ['las etiquetas se sincronizan',              o.sube===true, o.sube],
  ['sin errores de página',                     errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
