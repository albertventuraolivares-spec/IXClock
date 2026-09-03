// Revision general: abre TODAS las apps en movil y en escritorio y apunta
// errores de JavaScript, desbordes horizontales y textos demasiado pequenos.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9198);

const PANTALLAS=[
  ['móvil pequeño', 320, 568],
  ['móvil normal',  390, 844],
  ['tableta',       820,1180],
  ['escritorio',   1440, 900],
];

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const fallos=[];
 for(const [nombre,w,h] of PANTALLAS){
   // hasTouch activa (pointer: coarse), que es lo que dispara la regla de
   // tamano minimo de los botones: sin esto se probaria otra hoja de estilos.
   const tactil = w<=830;
   const ctx=await b.newContext({viewport:{width:w,height:h}, deviceScaleFactor:1,
     hasTouch:tactil, isMobile:tactil});
   const p=await ctx.newPage();
   const errs=[];
   p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
   p.on('console',m=>{ if(m.type()==='error'){ const t=m.text(); if(!/net::|Failed to load resource|ERR_/.test(t)) errs.push('consola: '+t.slice(0,120)); } });
   await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
   await p.goto('http://localhost:9198/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
   await p.waitForTimeout(2600);
   await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
   try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
   return !l || getComputedStyle(l).display==='none'; }, null, {timeout:20000}).catch(()=>{});
   await p.waitForTimeout(2000);
   await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

   // 1. La pantalla de inicio no se va de ancho
   const desbInicio=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
   if(desbInicio>2) fallos.push([nombre,'inicio','se sale '+desbInicio+'px de ancho']);

   // 2. Cada app: abrir, mirar errores y desborde, cerrar
   const apps=await p.evaluate(()=>IX_APPS.map(a=>({id:a.id,n:a.n,open:a.open})));
   for(const a of apps){
     const antes=errs.length;
     const abrio=await p.evaluate(async(o)=>{
       const w=ms=>new Promise(r=>setTimeout(r,ms));
       const f=window[o]; if(typeof f!=='function') return 'no existe '+o;
       try{ f(); }catch(e){ return 'reventó: '+e.message; }
       await w(700); return true;
     }, a.open);
     if(abrio!==true) fallos.push([nombre,a.n,String(abrio)]);
     const desb=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
     if(desb>2) fallos.push([nombre,a.n,'se sale '+desb+'px de ancho']);
     if(errs.length>antes) fallos.push([nombre,a.n,'error JS: '+errs.slice(antes).join(' | ').slice(0,160)]);
     await p.evaluate(()=>{ try{ ixCerrarTodasLasVentanas(); }catch(e){} });
     await p.waitForTimeout(350);
   }

   // 3. Configuración: sus cuatro pestañas
   for(const t of ['wallpapers','clocks','more','manual']){
     const antes=errs.length;
     await p.evaluate(async(tab)=>{
       const w=ms=>new Promise(r=>setTimeout(r,ms));
       try{ if(!isSidebarVisible) toggleSidebar(); showTab(tab); }catch(e){}
       await w(500);
     }, t);
     const desb=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
     if(desb>2) fallos.push([nombre,'Config·'+t,'se sale '+desb+'px de ancho']);
     if(errs.length>antes) fallos.push([nombre,'Config·'+t,'error JS: '+errs.slice(antes).join(' | ').slice(0,160)]);
   }
   await p.evaluate(()=>{ try{ if(isSidebarVisible) toggleSidebar(); }catch(e){} });

   // 4. Zonas de toque demasiado pequeñas en móvil (mínimo recomendado 44px)
   if(tactil){
     const chicos=await p.evaluate(()=>{
       const mal=[];
       document.querySelectorAll('button,[role=button],a[href]').forEach(function(e){
         const r=e.getBoundingClientRect();
         if(r.width===0||r.height===0) return;                 // oculto
         if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth) return;
         if(r.width<34||r.height<34){
           const t=(e.textContent||e.title||e.id||'').trim().slice(0,28);
           mal.push(t+' ('+Math.round(r.width)+'×'+Math.round(r.height)+')');
         }
       });
       return mal.slice(0,14);
     });
     if(chicos.length) fallos.push([nombre,'toques pequeños',chicos.join(', ')]);
   }
   if(errs.length) fallos.push([nombre,'total','errores JS en la sesión: '+errs.length]);
   await ctx.close();
   console.log('revisado: '+nombre+' ('+w+'×'+h+')');
 }
 console.log('\n===== RESULTADO =====');
 if(!fallos.length) console.log('Sin fallos.');
 else fallos.forEach(f=>console.log('· ['+f[0]+'] '+f[1]+' → '+f[2]));
 console.log('\ntotal de avisos: '+fallos.length);
 await b.close(); srv.close();
})();
