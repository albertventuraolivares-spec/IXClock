// Rendimiento: menos cosas pintadas al abrir (idea 81, primer paso).
//
// Al abrir, IXClocK montaba 7.578 elementos. Dos listas largas que casi
// nadie recorre enteras se llevaban ~2.300: las fechas que vienen (~245
// filas) y el historial de novedades (~70 versiones, en una pestaña oculta).
// Ahora se pintan las primeras y el resto con un botón. Se comprueba:
//  · la página abre con menos de 6.000 elementos;
//  · fechas: 30 próximas + TODAS las tuyas del calendario, y el botón dice
//    cuántas quedan y las pinta todas (sin duplicar);
//  · novedades: las 3 últimas versiones (la primera con «NUEVO») y el botón
//    pinta el historial entero;
//  · estilos de reloj: no se pintan al abrir, sí al abrir «Relojes», con el
//    guardado marcado, y el buscador de IXClocK los encuentra igual.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9301);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1300,height:1000}, locale:'es-ES'});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.addInitScript(()=>{ try{
   // Un evento tuyo dentro de 200 días: tiene que salir aunque quede lejos.
   const d=new Date(Date.now()+200*86400000);
   const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
   const ev={}; ev[k]=['Viaje a Lima'];
   localStorage.setItem('cal_events', JSON.stringify(ev));
   localStorage.setItem('saved_clock_style','neon-tokyo');
 }catch(e){} });
 await p.goto('http://localhost:9301/',{waitUntil:'load'});
 await p.waitForTimeout(3000);
 const o={};
 o.dom=await p.evaluate(()=>document.getElementsByTagName('*').length);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(1500);
 o.fest=await p.evaluate(()=>{
   try{ ixCerrarBienvenida(); }catch(e){}
   try{ renderizarFeriados(); }catch(e){}
   const filas=()=>[].slice.call(document.querySelectorAll('#events-box > div'));
   const r={ antes:filas().length, mias:filas().filter(d=>d.classList.contains('ix-fest-mio')).map(d=>d.innerText.replace(/\s+/g,' ')),
             boton:(document.getElementById('fest-ver-mas')||{}).textContent||null };
   const bt=document.getElementById('fest-ver-mas'); if(bt) bt.click();
   const t=filas().map(d=>d.innerText.replace(/\s+/g,' '));
   r.despues=t.length; r.unicas=new Set(t).size; r.botonTras=!!document.getElementById('fest-ver-mas');
   return r;
 });
 o.nov=await p.evaluate(()=>{
   const c=document.getElementById('novedades-card');
   const vers=()=>c.querySelectorAll("span").length && [].slice.call(c.querySelectorAll("span")).filter(x=>/^v\d+(\.\d+)+$/.test(x.textContent)).length;
   const r={ antes:vers(), nuevo:!!c.querySelector('.nov-nuevo'), boton:(document.getElementById('nov-ver-todo')||{}).textContent||null, total:IX_CHANGELOG.length };
   const bt=document.getElementById('nov-ver-todo'); if(bt) bt.click();
   r.despues=vers(); r.botonTras=!!document.getElementById('nov-ver-todo');
   return r;
 });
 o.rel=await p.evaluate(()=>{
   const r={ alAbrir:document.querySelectorAll('.clock-style-btn').length, estilos:CLOCK_STYLES.length };
   showTab('clocks');
   r.trasTab=document.querySelectorAll('.clock-style-btn').length;
   const act=document.querySelector('.clock-style-btn.active'); r.activo=act?act.id:null;
   showTab('wallpapers');
   return r;
 });
 // El buscador los encuentra aunque la pestaña no se haya abierto (página nueva)
 const p2=await b.newPage({viewport:{width:1300,height:1000}, locale:'es-ES'});
 await p2.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p2.goto('http://localhost:9301/',{waitUntil:'load'});
 await p2.waitForTimeout(2500);
 o.busca=await p2.evaluate(()=>{
   const antes=document.querySelectorAll('.clock-style-btn').length;
   let hay=false;
   try{ const nombre=CLOCK_STYLES[3].name; const t=ixBuscarTodo(nombre)||[]; hay=t.some(x=>x.grupo==='Relojes'); }catch(e){}
   return { antes, despues:document.querySelectorAll('.clock-style-btn').length, hay };
 });
 await b.close(); srv.close();

 const f=o.fest||{}, n=o.nov||{};
 const m=/Ver las (\d+) fechas siguientes/.exec(f.boton||'');
 const pruebas=[
  ['abre con menos de 6.000 elementos',             o.dom<6000, o.dom],
  ['fechas: 30 próximas + las tuyas',               f.antes===31 && f.mias.length===1 && /Viaje a Lima/.test(f.mias[0]), f.antes+' '+JSON.stringify(f.mias)],
  ['el botón dice cuántas quedan',                  !!m && +m[1]===f.despues-f.antes, f.boton+' → '+f.despues],
  ['y las pinta todas, sin duplicar',               f.despues>100 && f.unicas===f.despues && f.botonTras===false, f.despues+' / '+f.unicas],
  ['novedades: las 3 últimas, con «NUEVO»',         n.antes===3 && n.nuevo, n.antes],
  ['el botón pinta el historial entero',            new RegExp('\\('+n.total+' versiones\\)').test(n.boton||'') && n.despues===n.total && !n.botonTras, (n.boton||'')+' → '+n.despues],
  ['relojes: no se pintan al abrir',                 !!o.rel && o.rel.alAbrir===0, o.rel&&o.rel.alAbrir],
  ['sí al abrir «Relojes», con el guardado marcado', !!o.rel && o.rel.trasTab===o.rel.estilos && o.rel.activo==='clockbtn-neon-tokyo', JSON.stringify(o.rel)],
  ['el buscador de IXClocK los encuentra',          !!o.busca && o.busca.antes===0 && o.busca.despues>0 && o.busca.hay, JSON.stringify(o.busca)],
  ['sin errores de página',                         errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([nn,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+nn+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
