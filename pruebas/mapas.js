// XSS en Mapas: el texto que devuelve OpenStreetMap iba a innerHTML sin
// escapar. Lo reporto el usuario y aqui se comprueba de verdad.
//
// Es el mismo patron que ya se cerro con el terremoto: texto de un servidor
// externo metido en HTML. Aqui "externo" es cualquiera que edite el mapa: el
// nombre de un sitio y el de una calle los escribe gente, no nosotros.
//
// Leaflet viene de una CDN que este entorno bloquea, asi que se sirve un
// Leaflet falso que hace lo MISMO que el de verdad en lo que importa:
// bindPopup mete la cadena como HTML. Si el falso no hiciera eso, la prueba
// pasaria sin probar nada.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9239);

// Leaflet falso: lo justo para que el codigo de Mapas corra, y con bindPopup
// comportandose como el de verdad (la cadena entra como HTML).
const LEAFLET = `
window.__popups=[];
function _cap(){ const o={}; ['addTo','setView','fitBounds','remove','removeLayer','openPopup','flyTo','panTo',
  'setLatLng','getBounds','invalidateSize','on','off','setZoom','getZoom','addLayer','setStyle',
  'closePopup','eachLayer','removeFrom','bringToFront','setOpacity','getLatLng']
  .forEach(function(k){ o[k]=function(){ return o; }; });
  o.getZoom=function(){return 13;}; o.getBounds=function(){return {};};
  o.bindPopup=function(html){
    // Como Leaflet de verdad: la cadena se mete tal cual en el DOM.
    const d=document.createElement('div');
    d.style.cssText='position:absolute;left:-9999px;top:-9999px;';
    d.innerHTML=html;
    document.body.appendChild(d);
    window.__popups.push(html);
    return o;
  };
  return o;
}
window.L={ map:_cap, tileLayer:_cap, marker:_cap, polyline:_cap, layerGroup:_cap,
           circle:_cap, divIcon:function(){return {};}, icon:function(){return {};},
           latLng:function(a,b){return {lat:a,lng:b};}, control:{ scale:_cap } };
`;

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1280,height:1000}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.addInitScript(LEAFLET);
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9239/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof _amapManeuver==='function' && typeof escapeHtml==='function',
   null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2200);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 // Mapas se monta al abrirlo: sin eso no existen ni #amap-steps ni _aplMap.
 await p.evaluate(()=>{ try{ openAppleMaps(); }catch(e){} });
 await p.waitForTimeout(1200);

 const o={};
 // _aplMap es una `let`, no cuelga de window. Y si abrir la app no llega a
 // crear el mapa (aqui no hay Leaflet de verdad), se pone uno del falso: lo
 // unico que hace amapSearch con el es flyTo y removeLayer.
 o.mapaAbierto = await p.evaluate(()=>{
   let hay=false;
   try{ hay = !!_aplMap; }catch(e){}
   if(!hay){ try{ _aplMap = L.map('x'); hay = !!_aplMap; }catch(e){} }
   return hay && !!document.getElementById('amap-steps');
 });

 // --- lo primero: el Leaflet falso SI ejecuta HTML. Si no, no probamos nada ---
 o.elFalsoSirve = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__pwn=0;
   L.marker([0,0]).bindPopup('<img src=x onerror="window.__pwn=1">');
   await w(300);
   return window.__pwn===1;
 });

 // --- BUSCAR un sitio: display_name lo escribe quien edita OpenStreetMap ---
 o.buscar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__pwn=0; window.__popups=[];
   const of_=window.fetch;
   window.fetch=async()=>({ ok:true, json:async()=>[{
     lat:'18.47', lon:'-69.9',
     display_name:'<img src=x onerror="window.__pwn=1">, Santo Domingo, RD' }] });
   let lanzada=false;
   try{ amapSearch('lo que sea'); lanzada=true; }catch(e){}
   await w(700);
   window.fetch=of_;
   return { lanzada, pwn:window.__pwn,
            salioElNombre: window.__popups.some(h=>/Santo Domingo/.test(h)),
            escapado: window.__popups.some(h=>/&lt;img/.test(h)) };
 });

 // --- INDICACIONES giro a giro: el nombre de la calle acaba en innerHTML ---
 o.calle = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__pwn=0;
   const mv=_amapManeuver({ name:'<img src=x onerror="window.__pwn=1">',
                            maneuver:{type:'turn', modifier:'left'}, distance:120 });
   // se mete donde lo mete la app de verdad
   const d=document.createElement('div');
   d.innerHTML=mv[1];
   document.body.appendChild(d);
   await w(400);
   d.remove();
   return { pwn:window.__pwn, escapado:/&lt;img/.test(mv[1]),
            sigueLegible:/izquierda/i.test(mv[1]), texto:mv[1].slice(0,70) };
 });

 // --- la lista entera de indicaciones, como la pinta la app ---
 o.lista = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__pwn=0;
   _amapSteps=[{ name:'<img src=x onerror="window.__pwn=1">',
                 maneuver:{type:'depart'}, distance:50 },
               { name:'Calle Normal', maneuver:{type:'arrive'}, distance:10 }];
   try{ amapRenderSteps(); }catch(e){}
   await w(500);
   const caja=document.getElementById('amap-steps');
   const txt=caja?caja.innerText:'';
   _amapSteps=[];
   return { pwn:window.__pwn, saleLaNormal:/Calle Normal/.test(txt) };
 });

 // --- la rotonda tambien: el numero de salida viene del servidor ---
 o.rotonda = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__pwn=0;
   const mv=_amapManeuver({ name:'Vía', maneuver:{type:'roundabout',
     exit:'<img src=x onerror="window.__pwn=1">'}, distance:80 });
   const d=document.createElement('div'); d.innerHTML=mv[1]; document.body.appendChild(d);
   await w(400); d.remove();
   return { pwn:window.__pwn, escapado:/&lt;img/.test(mv[1]) };
 });

 // --- una calle con acentos y comillas se sigue leyendo bien ---
 o.normal = await p.evaluate(()=>{
   const mv=_amapManeuver({ name:'Avenida Perú "La Vieja" & Co',
                            maneuver:{type:'turn', modifier:'right'}, distance:200 });
   const d=document.createElement('div'); d.innerHTML=mv[1];
   return { comoSeVe:d.textContent, bien:/Avenida Perú "La Vieja" & Co/.test(d.textContent) };
 });

 // --- y la voz no lee las etiquetas ---
 o.voz = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   let dicho=null;
   const orig=window.SpeechSynthesisUtterance;
   window.SpeechSynthesisUtterance=function(t){ dicho=t; this.lang=''; this.rate=1; };
   const os=window.speechSynthesis;
   Object.defineProperty(window,'speechSynthesis',{configurable:true,
     value:{ cancel(){}, speak(){} }});
   _amapVoiceOn=true;
   _amapSay(_amapManeuver({name:'Calle Mayor', maneuver:{type:'turn',modifier:'left'}, distance:10})[1]);
   await w(200);
   Object.defineProperty(window,'speechSynthesis',{configurable:true, value:os});
   window.SpeechSynthesisUtterance=orig;
   return { dicho, sinEtiquetas: dicho!==null && dicho.indexOf('<')<0 };
 });

 await p.close();

 const pruebas=[
  ['el Leaflet falso SÍ ejecuta HTML', o.elFalsoSirve===true, o.elFalsoSirve],
  ['la app de Mapas se abre',         o.mapaAbierto===true,     o.mapaAbierto],
  ['BUSCAR: no se ejecuta el código', o.buscar.pwn===0,        JSON.stringify(o.buscar)],
  ['y el nombre sigue saliendo',      o.buscar.salioElNombre===true, o.buscar.salioElNombre],
  ['escapado, no borrado',            o.buscar.escapado===true, o.buscar.escapado],
  ['CALLE: no se ejecuta',            o.calle.pwn===0,          o.calle.texto],
  ['escapada, no borrada',            o.calle.escapado===true,  o.calle.escapado],
  ['y la indicación se entiende',     o.calle.sigueLegible===true, o.calle.texto],
  ['LISTA de indicaciones: no se ejecuta', o.lista.pwn===0,     o.lista.pwn],
  ['y las normales siguen saliendo',  o.lista.saleLaNormal===true, o.lista.saleLaNormal],
  ['ROTONDA: no se ejecuta',          o.rotonda.pwn===0 && o.rotonda.escapado===true, JSON.stringify(o.rotonda)],
  ['una calle con tildes se lee bien',o.normal.bien===true,     o.normal.comoSeVe],
  ['la voz no lee las etiquetas',     o.voz.sinEtiquetas===true, o.voz.dicho],
  ['sin errores de página',           errs.length===0,          errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
