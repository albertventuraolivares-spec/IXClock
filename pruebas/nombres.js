// Lo que Lighthouse marcaba en accesibilidad (idea 69), comprobado sin
// Lighthouse para que corra en la suite:
//  · TODO campo y desplegable de la página tiene nombre para el lector de
//    pantalla (label, aria-label, aria-labelledby o title). Se mira la página
//    entera, no una lista: si mañana se añade un <select> sin nombre, falla;
//  · los enlaces que abren algo al tocarlos llevan href (sin él, el teclado
//    no llega y los buscadores no los ven);
//  · los títulos no se saltan niveles (de <h1> a <h4> sin <h2>);
//  · la etiqueta de la estación (blanco sobre el color de acento) tiene el
//    contraste mínimo de 4,5 : 1.
// Puntuaciones reales de Lighthouse el 29 de sept: accesibilidad 86 → 98,
// SEO 92 → 100 (están en BACKLOG.md).
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9275);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9275/',{waitUntil:'domcontentloaded'});
 await p.waitForTimeout(3000);
 // Se mira ANTES de entrar, con la pantalla de región y la de inicio de
 // sesión puestas: son las primeras que ve alguien nuevo.
 const o=await p.evaluate(()=>{
   const nombre=el=>{
     if(el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')||el.getAttribute('title')) return true;
     if(el.id && document.querySelector('label[for="'+CSS.escape(el.id)+'"]')) return true;
     if(el.closest('label')) return true;
     if(el.type==='hidden'||el.type==='submit'||el.type==='button') return true;
     if(el.placeholder) return 'solo-placeholder';
     return false;
   };
   const campos=[].slice.call(document.querySelectorAll('input,select,textarea'));
   const sinNombre=campos.filter(el=>nombre(el)===false).map(el=>el.tagName.toLowerCase()+'#'+(el.id||'?'));
   const enlaces=[].slice.call(document.querySelectorAll('a[onclick]')).filter(a=>!a.hasAttribute('href')).map(a=>a.textContent.trim().slice(0,30));
   // Títulos del inicio (dentro de <main> y de los paneles de la portada)
   const hs=[].slice.call(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h=>+h.tagName[1]);
   let salto=null; for(let i=1;i<hs.length;i++){ if(hs[i]>hs[i-1]+1){ salto=hs[i-1]+'→'+hs[i]; break; } }
   // Contraste de la etiqueta de la estación
   const pill=document.getElementById('pill-season');
   let ratio=null;
   if(pill){
     const rgb=c=>{ const m=c.match(/[\d.]+/g); return m? m.slice(0,3).map(Number):[0,0,0]; };
     const lum=([r,g,b])=>{ const f=v=>{ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
     const cs=getComputedStyle(pill);
     const fg=rgb(cs.color), bg=rgb(cs.backgroundColor);
     const L1=lum(fg), L2=lum(bg);
     ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
   }
   return { total:campos.length, sinNombre, enlaces, hs, salto, ratio };
 });
 // Y también con la app ya abierta (hay controles que se crean después)
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 o.despues=await p.evaluate(()=>{
   const campos=[].slice.call(document.querySelectorAll('input,select,textarea'));
   return campos.filter(el=>!(el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')||el.getAttribute('title')
     ||(el.id&&document.querySelector('label[for="'+CSS.escape(el.id)+'"]'))||el.closest('label')||el.placeholder
     ||['hidden','submit','button'].includes(el.type))).map(el=>el.tagName.toLowerCase()+'#'+(el.id||'?'));
 });
 await b.close(); srv.close();

 const pruebas=[
  ['se revisan los campos de la página',      o.total>20, o.total],
  ['TODO campo tiene nombre (al cargar)',      o.sinNombre.length===0, o.sinNombre.slice(0,6).join(' ')],
  ['y con la app ya abierta',                  o.despues.length===0, o.despues.slice(0,6).join(' ')],
  ['los enlaces con acción llevan href',       o.enlaces.length===0, o.enlaces.join(' | ')],
  ['los títulos no se saltan niveles',         o.salto===null, o.salto+' '+o.hs.slice(0,12).join(',')],
  ['la etiqueta de la estación: contraste ≥ 4,5', o.ratio!==null && o.ratio>=4.5, o.ratio && o.ratio.toFixed(2)],
  ['sin errores de página',                    errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
