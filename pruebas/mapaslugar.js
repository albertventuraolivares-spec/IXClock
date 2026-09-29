// Mapas: la ficha del lugar encontrado lleva «📻 Radio de aquí» y «📝 Guardar
// en una nota» (ideas 26 y 48), y el buscador ya no usa alert() ni se queda
// callado sin conexión.
//
// OpenStreetMap y Radio-Browser se sustituyen por respuestas preparadas y
// Leaflet por uno falso (viene de una CDN bloqueada aquí; ver pruebas/mapas.js),
// que mete la ficha en la página como el de verdad para poder tocar sus
// botones. Se comprueba:
//  · buscar «Tokio» pone la ficha con los dos botones;
//  · «Guardar en una nota» crea la nota con el nombre y un enlace con las
//    coordenadas, y la abre;
//  · «Radio de aquí» abre Radio Mundial buscando por el código del país (JP)
//    y enseña sus emisoras;
//  · un lugar sin país no ofrece radio;
//  · «no encontrado» y «sin conexión» avisan con un aviso de la app, sin
//    ventanitas del navegador y sin errores.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9284);

const LEAFLET = `
function _cap(){ const o={}; ['addTo','setView','fitBounds','remove','removeLayer','openPopup','flyTo','panTo',
  'setLatLng','getBounds','invalidateSize','on','off','setZoom','getZoom','addLayer','setStyle',
  'closePopup','eachLayer','removeFrom','bringToFront','setOpacity','getLatLng']
  .forEach(function(k){ o[k]=function(){ return o; }; });
  o.getZoom=function(){return 13;}; o.getBounds=function(){return {};};
  o.bindPopup=function(html){
    let d=document.getElementById('__popup'); if(!d){ d=document.createElement('div'); d.id='__popup'; document.body.appendChild(d); }
    d.innerHTML=html; return o;
  };
  return o;
}
window.L={ map:_cap, tileLayer:_cap, marker:_cap, polyline:_cap, layerGroup:_cap,
           circle:_cap, divIcon:function(){return {};}, icon:function(){return {};},
           latLng:function(a,b){return {lat:a,lng:b};}, control:{ scale:_cap } };
`;

let NOMINATIM=null, sinRed=false; const pedidosRadio=[];
(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1280,height:1000}, locale:'es-ES'});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 const dialogos=[]; p.on('dialog',d=>{ dialogos.push(d.message()); d.dismiss(); });
 await p.addInitScript(LEAFLET);
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.route(/nominatim\.openstreetmap\.org\/search/, r=>{
   if(sinRed) return r.abort();
   r.fulfill({status:200, contentType:'application/json', body:JSON.stringify(NOMINATIM)});
 });
 await p.route(/api\.radio-browser\.info\/json\/stations\/search/, r=>{
   pedidosRadio.push(r.request().url());
   r.fulfill({status:200, contentType:'application/json', body:JSON.stringify([
     {name:'J-Wave Tokio', url_resolved:'https://ejemplo.jp/jwave', countrycode:'JP', country:'Japan', codec:'MP3', stationuuid:'a1'},
     {name:'NHK Radio', url_resolved:'https://ejemplo.jp/nhk', countrycode:'JP', country:'Japan', codec:'AAC', stationuuid:'a2'} ])});
 });
 await p.goto('http://localhost:9284/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof amapSearch==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}; try{ openAppleMaps(); }catch(e){} });
 await p.waitForTimeout(800);
 await p.evaluate(()=>{ let hay=false; try{ hay=!!_aplMap; }catch(e){} if(!hay){ try{ _aplMap=L.map('x'); }catch(e){} }
   window.__toasts=[]; const t=window.ixToast; window.ixToast=function(m){ window.__toasts.push(m); try{ t(m); }catch(e){} }; });
 const o={};
 const buscar=async q=>{ await p.evaluate(q=>{ window.__toasts=[]; amapSearch(q); }, q); await p.waitForTimeout(500);
   return p.evaluate(()=>{ const d=document.getElementById('__popup'); return { html:d?d.innerHTML:'', texto:d?d.innerText:'', radio:!!(d&&d.querySelector('.amap-radio')), nota:!!(d&&d.querySelector('.amap-nota')), toasts:window.__toasts.slice() }; }); };

 NOMINATIM=[{lat:'35.68950', lon:'139.69171', display_name:'Tokio, Japón, Asia', address:{country:'Japón', country_code:'jp'}}];
 o.tokio=await buscar('Tokio');
 // Guardar en una nota
 o.nota=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const antes=notes.length;
   document.querySelector('#__popup .amap-nota').click(); await w(400);
   const n=notes[notes.length-1];
   return { nuevas:notes.length-antes, contenido:n&&n.content, abierta:currentNoteId===(n&&n.id), panel:notesPanelOpen };
 });
 // Radio de aquí
 o.radio=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   try{ if(notesPanelOpen) toggleNotesPanel(); }catch(e){}
   document.querySelector('#__popup .amap-radio').click(); await w(1200);
   const r=document.getElementById('world-radio-results');
   return { texto:r?r.innerText:'' };
 });
 o.pedidoRadio=pedidosRadio.slice();
 // Un sitio sin país (en el mar)
 NOMINATIM=[{lat:'0', lon:'0', display_name:'Golfo de Guinea', address:{}}];
 o.sinPais=await buscar('0,0');
 // No encontrado
 NOMINATIM=[];
 o.noHay=await buscar('xyzxyz');
 // Sin conexión
 sinRed=true;
 o.offline=await buscar('Madrid');
 await b.close(); srv.close();

 const pruebas=[
  ['la ficha del lugar lleva los dos botones',  o.tokio.radio && o.tokio.nota && /Tokio/.test(o.tokio.texto), o.tokio.texto.replace(/\n/g,' ')],
  ['«Guardar en una nota» crea UNA nota',        o.nota.nuevas===1, o.nota.nuevas],
  ['con el nombre y un enlace con las coordenadas', /📍 Tokio, Japón\n/.test(o.nota.contenido||'') && /openstreetmap\.org\/\?mlat=35\.6895\d*&mlon=139\.6917\d*/.test(o.nota.contenido||''), JSON.stringify(o.nota.contenido)],
  ['y la abre',                                  o.nota.abierta===true && o.nota.panel===true, JSON.stringify(o.nota)],
  ['«Radio de aquí» busca por el país (JP)',     o.pedidoRadio.some(u=>/countrycode=JP/.test(u)), o.pedidoRadio.slice(-1)[0]],
  ['y enseña sus emisoras',                      /J-Wave Tokio/.test(o.radio.texto) && /NHK/.test(o.radio.texto), o.radio.texto.slice(0,80)],
  ['un sitio sin país no ofrece radio',          o.sinPais.nota && !o.sinPais.radio, JSON.stringify({r:o.sinPais.radio,n:o.sinPais.nota})],
  ['«no encontrado» avisa con la app',           o.noHay.toasts.some(t=>/no encontrado/i.test(t)), JSON.stringify(o.noHay.toasts)],
  ['sin conexión también avisa',                 o.offline.toasts.some(t=>/Sin conexión/i.test(t)), JSON.stringify(o.offline.toasts)],
  ['sin ventanitas del navegador (alert)',       dialogos.length===0, JSON.stringify(dialogos)],
  ['sin errores de página',                      errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
