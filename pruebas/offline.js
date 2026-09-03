// Comprueba que la app abre SIN INTERNET despues de haberla visitado una vez.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
let peticiones=0;
const srv=http.createServer((q,s)=>{peticiones++;let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9201);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1100,height:850}});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());

 // --- 1a visita: con red, se instala el service worker ---
 await p.goto('http://localhost:9201/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(3000);
 const o={};
 o.swRegistrado = await p.evaluate(async()=>{
   if(!navigator.serviceWorker) return false;
   const r=await navigator.serviceWorker.getRegistration();
   return !!r;
 });
 // Espera a que el service worker tome el control y termine de guardar
 o.swActivo = await p.evaluate(async()=>{
   const r=await navigator.serviceWorker.ready.catch(()=>null);
   return !!(r && r.active);
 });
 await p.waitForTimeout(3500);
 o.guardoArmazon = await p.evaluate(async()=>{
   const nombres=await caches.keys();
   for(const n of nombres){
     const c=await caches.open(n);
     const k=await c.keys();
     const urls=k.map(x=>x.url);
     if(urls.some(u=>/index\.html$/.test(u)) && urls.some(u=>/tailwind\.css$/.test(u))) return true;
   }
   return false;
 });
 o.queGuardo = await p.evaluate(async()=>{
   const nombres=await caches.keys(); const todo=[];
   for(const n of nombres){ const c=await caches.open(n); (await c.keys()).forEach(x=>todo.push(x.url.split('/').pop()||'/')); }
   return todo.sort();
 });

 // --- 2a visita: sin red Y CON EL SERVIDOR APAGADO ---
 // Se apaga de verdad en vez de contar peticiones: el service worker revalida
 // en segundo plano y ese conteo daba falsos positivos. Si el servidor no
 // existe y la pagina abre igual, no hay duda de que sale del cache.
 await new Promise(r=>srv.close(r));
 await ctx.setOffline(true);
 o.servidorApagado = !srv.listening;
 await p.goto('http://localhost:9201/',{waitUntil:'domcontentloaded'}).catch(e=>{ o.errorAlCargar=e.message.split('\n')[0]; });
 await p.waitForTimeout(3500);
 o.hayTitulo = await p.evaluate(()=>/IXCloc/i.test(document.title||''));
 o.pintaAlgo = await p.evaluate(()=>document.body && document.body.innerText.trim().length>60);
 o.hayEstilos = await p.evaluate(()=>{
   // tailwind.css compilado: si no cargo, los .glass no tendrian fondo
   const d=document.createElement('div'); d.className='flex'; document.body.appendChild(d);
   const ok=getComputedStyle(d).display==='flex'; d.remove(); return ok;
 });
 o.hayJs = await p.evaluate(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function');
 // Una app entera funciona sin red
 o.abreIXBand = await p.evaluate(async()=>{
   const w=ms=>new Promise(r=>setTimeout(r,ms));
   try{ openGarageBand(); }catch(e){ return 'reventó: '+e.message; }
   await w(700);
   const m=document.getElementById('garageband-modal');
   return !!m && getComputedStyle(m).display!=='none';
 });
 o.buscadorFunciona = await p.evaluate(()=>{
   try{ return ixBuscarTodo('mapas').length>0; }catch(e){ return false; }
 });
 await ctx.setOffline(false);

 const pruebas=[
  ['el service worker se registra', o.swRegistrado===true,      o.swRegistrado],
  ['y queda activo',                o.swActivo===true,          o.swActivo],
  ['guarda el armazón',             o.guardoArmazon===true,     (o.queGuardo||[]).length+' archivos'],
  ['SIN RED, la página abre',       !o.errorAlCargar,           o.errorAlCargar||'sin error'],
  ['con el servidor apagado',       o.servidorApagado===true,   o.servidorApagado],
  ['con su título',                 o.hayTitulo===true,         o.hayTitulo],
  ['y con contenido',               o.pintaAlgo===true,         o.pintaAlgo],
  ['los estilos cargaron',          o.hayEstilos===true,        o.hayEstilos],
  ['el código cargó',               o.hayJs===true,             o.hayJs],
  ['IXBand abre sin red',           o.abreIXBand===true,        o.abreIXBand],
  ['el buscador funciona sin red',  o.buscadorFunciona===true,  o.buscadorFunciona],
  ['sin errores de página',         errs.length===0,            errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\nguardado en cache: '+(o.queGuardo||[]).join(', '));
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); try{srv.close();}catch(e){} process.exit(ok===pruebas.length?0:1);
})();
