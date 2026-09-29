// El modo sin conexión tiene que abrir LA APP, no la última página visitada.
//
// El service worker guardaba CUALQUIER página que se abriera como si fuera
// index.html. Así, abrir la política de privacidad (o una dirección que da
// 404) y quedarse luego sin conexión hacía que IXClocK abriera ESA página en
// vez de la app. Aquí se hace tal cual con un navegador real: se instala el
// service worker, se visitan esas páginas, se corta la red y se abre la app.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json','.jpg':'image/jpeg'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404,{'content-type':'text/html'});return s.end('<!doctype html><title>404</title><h1>No existe</h1>');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9283);
// Para cortar la red DE VERDAD hay que apagar el servidor: el «offline» de
// Playwright no alcanza a lo que pide el propio service worker.
const sockets=new Set(); srv.on('connection',c=>{ sockets.add(c); c.on('close',()=>sockets.delete(c)); });
const apagar=()=>new Promise(r=>{ srv.close(()=>r()); sockets.forEach(c=>c.destroy()); });

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1000,height:800}});
 await ctx.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 const p=await ctx.newPage();
 const o={};
 await p.goto('http://localhost:9283/',{waitUntil:'domcontentloaded'});
 // Que el service worker esté instalado y controlando
 o.sw=await p.evaluate(async()=>{
   if(!('serviceWorker' in navigator)) return 'sin-soporte';
   try{ await navigator.serviceWorker.register('sw.js'); }catch(e){}
   const reg=await Promise.race([navigator.serviceWorker.ready, new Promise(r=>setTimeout(()=>r(null),15000))]);
   return reg ? 'listo' : 'no';
 });
 await p.reload({waitUntil:'domcontentloaded'});
 await p.waitForTimeout(1500);
 o.controla=await p.evaluate(()=>!!navigator.serviceWorker.controller);
 // Visitar la privacidad y una dirección que no existe
 await p.goto('http://localhost:9283/privacidad.html',{waitUntil:'domcontentloaded'});
 await p.waitForTimeout(800);
 await p.goto('http://localhost:9283/no-existe-esto',{waitUntil:'domcontentloaded'});
 await p.waitForTimeout(800);
 // Sin conexión: se apaga el servidor y se abre la app
 await apagar();
 const abrir=async u=>{ try{ await p.goto(u,{waitUntil:'domcontentloaded',timeout:15000}); return await p.title(); }catch(e){ return 'ERROR '+e.message.split('\n')[0]; } };
 o.app=await abrir('http://localhost:9283/');
 o.appApp=await abrir('http://localhost:9283/?app=mesita');
 o.privacidad=await abrir('http://localhost:9283/privacidad.html');
 await b.close();

 const esApp=t=>/Universal OS Dashboard/.test(t||'');
 const pruebas=[
  ['el service worker se instala y controla', o.sw==='listo' && o.controla===true, o.sw+' '+o.controla],
  ['SIN CONEXIÓN, «/» abre la app',            esApp(o.app), o.app],
  ['y un acceso directo (?app=) también',      esApp(o.appApp), o.appApp],
  ['la privacidad sigue abriéndose sin conexión', /Privacidad/.test(o.privacidad||''), o.privacidad],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
