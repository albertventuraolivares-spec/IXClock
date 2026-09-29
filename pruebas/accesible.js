// Accesibilidad y SEO de la pantalla de inicio (ideas 67, 68, 72 y 76).
//
// Se prueba como lo usaría alguien con teclado o con lector de pantalla, no
// mirando el HTML:
//  · el PRIMER Tab tiene que caer en «Saltar al contenido», que hasta entonces
//    no se ve, y al pulsarlo el foco tiene que pasar a la pantalla;
//  · la pantalla de inicio tiene un <h1> que lee el lector pero no se ve;
//  · las imágenes que crea la app llevan alt, y el botón de quitar un fondo
//    dice QUÉ quita (antes decía «Cerrar»);
//  · los datos para Google son JSON válido y dicen la verdad (gratis, web).
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9266);

const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9266/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof showTab==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}; document.activeElement && document.activeElement.blur(); window.scrollTo(0,0);});
 await p.waitForTimeout(300);
 const o={};

 // ═══ SALTAR AL CONTENIDO ═══
 o.antes=await p.evaluate(()=>{ const a=document.querySelector('a.ix-saltar'); if(!a) return null; const r=a.getBoundingClientRect(); return {bottom:r.bottom}; });
 // Recargar sin tocar nada: el Tab empieza desde donde fue el último clic,
 // y la preparación de arriba hace clics. Una visita real empieza de cero.
 await p.reload({waitUntil:'domcontentloaded'});
 await p.waitForTimeout(3500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}; try{ixCerrarBienvenida();}catch(e){}});
 await p.waitForTimeout(300);
 await p.keyboard.press('Tab');
 await p.waitForTimeout(250);
 o.primerTab=await p.evaluate(()=>{ const a=document.activeElement; const r=a.getBoundingClientRect();
   return { texto:(a.innerText||'').trim(), visible:r.top>=0 && r.bottom>0 && r.width>0, clase:a.className }; });
 await p.keyboard.press('Enter');
 await p.waitForTimeout(250);
 o.trasEnter=await p.evaluate(()=>{ const m=document.getElementById('ix-contenido'); return { focoEnMain: document.activeElement===m, esMain: m && m.tagName }; });

 // ═══ <h1> DE INICIO ═══
 o.h1=await p.evaluate(()=>{
   const m=document.getElementById('ix-contenido');
   const h=m && m.querySelector('h1');
   if(!h) return null;
   const r=h.getBoundingClientRect(), cs=getComputedStyle(h);
   return { texto:h.textContent.trim(), invisible:r.width<=1 && r.height<=1, noDisplayNone:cs.display!=='none' && cs.visibility!=='hidden' };
 });
 const snap=await p.accessibility.snapshot({interestingOnly:true}).catch(()=>null);
 const busca=(n,f)=>{ if(!n) return null; if(f(n)) return n; for(const c of (n.children||[])){ const r=busca(c,f); if(r) return r; } return null; };
 o.h1Lector=!!busca(snap,n=>n.role==='heading' && n.level===1 && /IXClocK/.test(n.name||''));
 o.nav=(await p.getByRole('navigation',{name:'Apps'}).count())===1;

 // ═══ IMÁGENES CREADAS POR LA APP ═══
 o.fondos=await p.evaluate((PNG)=>{
   localStorage.setItem('custom_wallpapers', JSON.stringify([{url:PNG,name:'a'},{url:PNG,name:'b'}]));
   const div=document.createElement('div'); document.body.appendChild(div);
   renderCloudGallery(div);
   const r=[].slice.call(div.querySelectorAll('#custom-wp-grid img')).map(i=>({alt:i.getAttribute('alt'), boton:i.nextElementSibling && i.nextElementSibling.getAttribute('aria-label')}));
   div.remove(); localStorage.removeItem('custom_wallpapers');
   return r;
 }, PNG);
 o.tv=await p.evaluate(()=>{
   // La lista de canales necesita red para rellenarse; se mira la plantilla
   return { tieneAlt: /<img src="\$\{escapeHtml\(c\.logo\)\}" alt=""/.test([].slice.call(document.scripts).map(s=>s.textContent).join('\n')) };
 });

 // ═══ DATOS PARA GOOGLE ═══
 o.ld=await p.evaluate(()=>[].slice.call(document.querySelectorAll('script[type="application/ld+json"]')).map(s=>{ try{ return JSON.parse(s.textContent); }catch(e){ return {roto:e.message}; } }));
 o.canon=await p.evaluate(()=>(document.querySelector('link[rel=canonical]')||{}).href);
 await b.close(); srv.close();

 const ld=o.ld[0]||{};
 const pruebas=[
  ['«Saltar al contenido» no se ve de entrada', !!o.antes && o.antes.bottom<=0, JSON.stringify(o.antes)],
  ['el PRIMER Tab cae en él',                   /Saltar al contenido/.test(o.primerTab.texto), JSON.stringify(o.primerTab)],
  ['y entonces SÍ se ve',                       o.primerTab.visible===true, JSON.stringify(o.primerTab)],
  ['Enter lleva el foco a la pantalla',         o.trasEnter.focoEnMain===true && o.trasEnter.esMain==='MAIN', JSON.stringify(o.trasEnter)],
  ['la pantalla de inicio tiene <h1>',          !!o.h1 && /IXClocK/.test(o.h1.texto), JSON.stringify(o.h1)],
  ['que no se ve',                              !!o.h1 && o.h1.invisible, JSON.stringify(o.h1)],
  ['pero el lector de pantalla SÍ lo lee',      o.h1Lector===true, o.h1Lector],
  ['la barra de apps es navegación «Apps»',     o.nav===true, o.nav],
  ['las miniaturas de fondos llevan alt',       !!o.fondos && o.fondos.length===2 && o.fondos.every((f,i)=>f.alt==='Tu fondo '+(i+1)), JSON.stringify(o.fondos)],
  ['y «quitar» dice qué quita',                 !!o.fondos && o.fondos.every((f,i)=>f.boton==='Quitar tu fondo '+(i+1)), JSON.stringify(o.fondos)],
  ['el logo de canal de TV lleva alt vacío',    o.tv.tieneAlt===true, o.tv.tieneAlt],
  ['datos para Google: JSON válido',            o.ld.length===1 && !ld.roto, JSON.stringify(o.ld).slice(0,120)],
  ['dicen que es una app web',                  ld['@type']==='WebApplication' && ld.operatingSystem==='Web' && ld.name==='IXClocK', ld['@type']],
  ['gratis (el cobro sigue en pausa)',          ld.offers && ld.offers.price==='0', JSON.stringify(ld.offers)],
  ['misma dirección que el canonical',          ld.url===o.canon, ld.url+' = '+o.canon],
  ['sin errores de página',                     errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
