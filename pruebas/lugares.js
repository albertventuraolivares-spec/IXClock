// Recordatorios por ubicación (idea 39).
//
// Con el GPS simulado de Playwright (setGeolocation dispara watchPosition)
// y el Leaflet falso de pruebas/mapaslugar.js. Se comprueba:
//  · la ficha del lugar ofrece «Avísame al llegar» y «al salir»;
//  · al llegar (a menos de 200 m) avisa por ixNotificar y el aviso se quita;
//  · «al salir» NO salta si nunca estuviste dentro; sí al entrar y salir;
//  · no se duplica el mismo aviso;
//  · la app Avisos los lista con ✕ y dice el límite (solo con la app abierta);
//  · al abrir la app SIN permiso de ubicación no se pide nada ni se vigila;
//    con el permiso ya dado, vuelve a vigilar sola.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9302);

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


let NOMINATIM=[{lat:'18.47860', lon:'-69.93100', display_name:'Farmacia Carol, Santo Domingo, República Dominicana', address:{country:'RD', country_code:'do'}}];
(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const montar=async(conPermiso, limpiar)=>{
   const ctx=await b.newContext({viewport:{width:1280,height:1000}, locale:'es-ES', permissions:conPermiso?['geolocation']:[], geolocation:{latitude:18.50, longitude:-69.93}});
   const p=await ctx.newPage();
   const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
   await p.addInitScript(LEAFLET);
   await p.addInitScript(()=>{ window.__watch=0; const g=navigator.geolocation; const w=g.watchPosition.bind(g); g.watchPosition=function(){ window.__watch++; return w.apply(null, arguments); }; });
   if(limpiar) await p.addInitScript(()=>{ try{ if(!sessionStorage.getItem('s')){ localStorage.removeItem('ix_lugares_aviso_v1'); localStorage.removeItem('ix_avisos_v1'); sessionStorage.setItem('s','1'); } }catch(e){} });
   await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
   await p.route(/nominatim\.openstreetmap\.org\/search/, r=>r.fulfill({status:200, contentType:'application/json', body:JSON.stringify(NOMINATIM)}));
   await p.goto('http://localhost:9302/',{waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>typeof amapSearch==='function',null,{timeout:30000}).catch(()=>{});
   await p.waitForTimeout(2500);
   await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
   try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
   await p.waitForTimeout(2000);
   await p.evaluate(()=>{ try{ixCerrarBienvenida();}catch(e){}; try{ openAppleMaps(); }catch(e){}
     let hay=false; try{ hay=!!_aplMap; }catch(e){} if(!hay){ try{ _aplMap=L.map('x'); }catch(e){} }
     window.__not=[]; const n=window.ixNotificar; window.ixNotificar=function(t,c){ window.__not.push(t); try{ return n.apply(this,arguments); }catch(e){} };
     window.__toasts=[]; const t=window.ixToast; window.ixToast=function(m){ window.__toasts.push(m); try{ t(m); }catch(e){} }; });
   return {ctx, p, errs};
 };
 const o={};
 let {ctx, p, errs}=await montar(true, true);
 o.falta=await p.evaluate(()=>typeof amapAvisoLugar!=='function');
 if(!o.falta){
   o.dist=await p.evaluate(()=>Math.round(ixDistanciaM(18,-69.9,19,-69.9)/1000));
   await p.evaluate(()=>amapSearch('Farmacia')); await p.waitForTimeout(500);
   o.botones=await p.evaluate(()=>({ llegar:!!document.querySelector('#__popup .amap-llegar'), salir:!!document.querySelector('#__popup .amap-salir') }));
   await p.evaluate(()=>document.querySelector('#__popup .amap-llegar').click()); await p.waitForTimeout(300);
   await p.evaluate(()=>document.querySelector('#__popup .amap-llegar').click()); await p.waitForTimeout(300);
   o.creado=await p.evaluate(()=>({ n:ixLugaresLeer().length, toasts:window.__toasts.slice(), vigila:window.__watch }));
   // Todavía lejos (2 km): nada
   await ctx.setGeolocation({latitude:18.4970, longitude:-69.9310}); await p.waitForTimeout(800);
   o.lejos=await p.evaluate(()=>window.__not.slice());
   // Llega (a ~50 m)
   await ctx.setGeolocation({latitude:18.4790, longitude:-69.9312}); await p.waitForTimeout(800);
   o.llega=await p.evaluate(()=>({ not:window.__not.slice(), quedan:ixLugaresLeer().length, centro:(JSON.parse(localStorage.getItem('ix_avisos_v1')||'[]')[0]||{}).titulo }));
   // «Al salir» creado estando lejos: moverse lejos NO avisa
   await ctx.setGeolocation({latitude:18.50, longitude:-69.93}); await p.waitForTimeout(600);
   await p.evaluate(()=>{ window.__not.length=0; });
   await p.evaluate(()=>document.querySelector('#__popup .amap-salir').click()); await p.waitForTimeout(300);
   await ctx.setGeolocation({latitude:18.51, longitude:-69.93}); await p.waitForTimeout(800);
   o.salirLejos=await p.evaluate(()=>({ not:window.__not.slice(), quedan:ixLugaresLeer().length }));
   // Entra y sale: ahora sí
   await ctx.setGeolocation({latitude:18.4787, longitude:-69.9310}); await p.waitForTimeout(800);
   o.dentro=await p.evaluate(()=>window.__not.slice());
   await ctx.setGeolocation({latitude:18.4900, longitude:-69.9310}); await p.waitForTimeout(800);
   o.sale=await p.evaluate(()=>({ not:window.__not.slice(), quedan:ixLugaresLeer().length }));
   // Avisos lista y ✕
   o.lista=await p.evaluate(async()=>{
     const w=m=>new Promise(r=>setTimeout(r,m));
     amapAvisoLugar('llegar');
     ixAbrirAvisos(); await w(200);
     const c=document.getElementById('ix-lugares');
     const r={ txt:c?c.innerText.replace(/\s+/g,' '):'' };
     const x=document.querySelector('#ix-lugares button'); if(x) x.click(); await w(200);
     r.tras=ixLugaresLeer().length; r.oculto=!document.getElementById('ix-lugares');
     amapAvisoLugar('llegar');   // deja uno para la recarga
     return r;
   });
   o.errs1=errs.slice();
   // Recarga con permiso: vigila sola
   await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(5500);
   o.recarga=await p.evaluate(()=>({ vigila:window.__watch, hay:ixLugaresLeer().length }));
   await ctx.close();
   // Sin permiso: no pregunta ni vigila
   ({ctx, p, errs}=await montar(false, false));
   await p.evaluate(()=>{ localStorage.setItem('ix_lugares_aviso_v1', JSON.stringify([{id:'x', nombre:'Casa', lat:18.4, lon:-69.9, tipo:'llegar'}])); });
   await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(5500);
   o.sinPermiso=await p.evaluate(()=>window.__watch);
   o.errs2=errs.slice();
   await ctx.close();
 }
 await b.close(); srv.close();

 const errsT=(o.errs1||[]).concat(o.errs2||[]);
 const pruebas=[
  ['existe',                                          !o.falta, !o.falta],
  ['distancia bien calculada (1° lat ≈ 111 km)',      o.dist===111, o.dist],
  ['la ficha ofrece «al llegar» y «al salir»',        !!o.botones && o.botones.llegar && o.botones.salir, JSON.stringify(o.botones)],
  ['crea UNO (el repetido no) y empieza a vigilar',   !!o.creado && o.creado.n===1 && o.creado.vigila===1 && o.creado.toasts.some(t=>/Te avisaré al llegar a Farmacia Carol/.test(t)) && o.creado.toasts.some(t=>/Ya tienes ese aviso/.test(t)), JSON.stringify(o.creado)],
  ['lejos no avisa',                                  JSON.stringify(o.lejos)==='[]', JSON.stringify(o.lejos)],
  ['al llegar avisa y se quita',                      !!o.llega && o.llega.not.some(t=>/Has llegado a Farmacia Carol/.test(t)) && o.llega.quedan===0 && /Has llegado/.test(o.llega.centro||''), JSON.stringify(o.llega)],
  ['«al salir» sin haber estado dentro: no salta',    !!o.salirLejos && o.salirLejos.not.length===0 && o.salirLejos.quedan===1, JSON.stringify(o.salirLejos)],
  ['entrar no dispara «al salir»',                    JSON.stringify(o.dentro)==='[]', JSON.stringify(o.dentro)],
  ['al salir, avisa y se quita',                      !!o.sale && o.sale.not.some(t=>/Has salido de Farmacia Carol/.test(t)) && o.sale.quedan===0, JSON.stringify(o.sale)],
  ['Avisos los lista y dice el límite',               !!o.lista && /Al llegar a Farmacia Carol/.test(o.lista.txt) && /con la app cerrada/.test(o.lista.txt), o.lista&&o.lista.txt],
  ['✕ lo quita',                                      !!o.lista && o.lista.tras===0 && o.lista.oculto, JSON.stringify(o.lista)],
  ['con permiso dado, al volver vigila sola',         !!o.recarga && o.recarga.vigila===1 && o.recarga.hay===1, JSON.stringify(o.recarga)],
  ['SIN permiso, al abrir no pide ni vigila',         o.sinPermiso===0, o.sinPermiso],
  ['sin errores de página',                           errsT.length===0, errsT.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
