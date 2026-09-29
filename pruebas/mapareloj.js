// Mapas → reloj mundial (idea 27).
//
// La ficha del lugar lleva «🕐 Al reloj mundial». Un lugar no trae su zona
// horaria: se pide a Open-Meteo (timezone=auto). Nominatim, Open-Meteo y
// Leaflet se sustituyen (mismo Leaflet falso que pruebas/mapaslugar.js).
// Se comprueba:
//  · buscar «Kioto» y tocarlo añade Asia/Tokyo al reloj mundial y lo dice
//    («Kioto → hora de Tokio · hh:mm»), con la hora de allí;
//  · se pregunta por las coordenadas del sitio;
//  · tocarlo otra vez no lo duplica («ya está»);
//  · con una ciudad que es la de su zona, no repite el nombre;
//  · sin conexión o con una zona rara, avisa y no añade nada.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9297);

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


let NOMINATIM=null, sinRed=false, ZONA='Asia/Tokyo'; const pedidos=[];
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1280,height:1000}, locale:'es-ES'});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.addInitScript(LEAFLET);
 await p.addInitScript(()=>{ try{ localStorage.setItem('ica_world_clocks','[]'); }catch(e){} });
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.route(/nominatim\.openstreetmap\.org\/search/, r=>r.fulfill({status:200, contentType:'application/json', body:JSON.stringify(NOMINATIM)}));
 await p.route(/api\.open-meteo\.com\/v1\/forecast/, r=>{
   const u=r.request().url(); if(/timezone=auto/.test(u)) pedidos.push(u);
   if(sinRed) return r.abort();
   r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({timezone:ZONA, current:{temperature_2m:20}})});
 });
 await p.goto('http://localhost:9297/',{waitUntil:'domcontentloaded'});
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
 const buscar=async q=>{ await p.evaluate(q=>{ amapSearch(q); }, q); await p.waitForTimeout(500); };
 const tocar=async()=>{ await p.evaluate(()=>{ window.__toasts=[]; const b=document.querySelector('#__popup .amap-reloj'); if(b) b.click(); }); await p.waitForTimeout(600);
   return p.evaluate(()=>({ relojes:_icaWorldClocks.slice(), guardado:JSON.parse(localStorage.getItem('ica_world_clocks')||'[]'), toasts:window.__toasts.slice(),
     hora:new Date().toLocaleTimeString('es',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit'}),
     lista:(document.getElementById('ica-world-list')||{}).innerText||'' })); };

 NOMINATIM=[{lat:'35.01160', lon:'135.76802', display_name:'Kioto, Prefectura de Kioto, Japón', address:{country:'Japón', country_code:'jp'}}];
 await buscar('Kioto');
 o.boton=await p.evaluate(()=>{ const b=document.querySelector('#__popup .amap-reloj'); return b ? b.textContent : null; });
 o.kioto=await tocar();
 o.pedido=pedidos[0]||'';
 o.otra=await tocar();
 NOMINATIM=[{lat:'40.41650', lon:'-3.70256', display_name:'Madrid, Comunidad de Madrid, España', address:{country:'España', country_code:'es'}}];
 ZONA='Europe/Madrid';
 await buscar('Madrid');
 o.madrid=await tocar();
 sinRed=true;
 NOMINATIM=[{lat:'51.5', lon:'-0.12', display_name:'Londres, Reino Unido', address:{country:'Reino Unido', country_code:'gb'}}];
 await buscar('Londres');
 o.sinRed=await tocar();
 sinRed=false; ZONA='Nada/Falsa';
 o.rara=await tocar();
 await b.close(); srv.close();

 const k=o.kioto||{};
 const pruebas=[
  ['la ficha lleva «🕐 Al reloj mundial»',             /Al reloj mundial/.test(o.boton||''), o.boton],
  ['Kioto añade Asia/Tokyo al reloj mundial',          JSON.stringify(k.relojes)==='["Asia/Tokyo"]' && JSON.stringify(k.guardado)==='["Asia/Tokyo"]', JSON.stringify(k.relojes)],
  ['y lo dice con la hora de allí',                    (k.toasts||[]).some(t=>t==='🕐 Kioto → hora de Tokio · '+k.hora), JSON.stringify(k.toasts)+' '+k.hora],
  ['sale en la lista del reloj',                       /Tokio/.test(k.lista||''), (k.lista||'').slice(0,80)],
  ['pregunta por las coordenadas del sitio',           /latitude=35\.0116/.test(o.pedido) && /longitude=135\.768/.test(o.pedido), o.pedido],
  ['otra vez: no se duplica y dice «ya está»',         JSON.stringify((o.otra||{}).relojes)==='["Asia/Tokyo"]' && (o.otra.toasts||[]).some(t=>/Tokio ya está en tu reloj mundial/.test(t)), JSON.stringify(o.otra&&o.otra.toasts)],
  ['Madrid: sin repetir el nombre',                    ((o.madrid||{}).relojes||[]).indexOf('Europe/Madrid')>=0 && (o.madrid.toasts||[]).some(t=>/^🕐 Madrid · \d\d:\d\d$/.test(t)), JSON.stringify(o.madrid&&o.madrid.toasts)],
  ['sin conexión avisa y no añade',                    ((o.sinRed||{}).relojes||[]).length===2 && (o.sinRed.toasts||[]).some(t=>/Sin conexión/.test(t)), JSON.stringify(o.sinRed)],
  ['zona rara: tampoco añade',                         ((o.rara||{}).relojes||[]).length===2 && !(o.rara.relojes||[]).includes('Nada/Falsa'), JSON.stringify(o.rara&&o.rara.relojes)],
  ['sin errores de página',                            errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
