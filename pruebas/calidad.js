// Rendimiento y accesibilidad: lo que miran las tiendas de aplicaciones y lo
// que decide si la app se siente rapida o pesada en un movil normal.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9212);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 // 4x mas lento que este ordenador: se parece a un movil de gama media.
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const p=await ctx.newPage();
 const cdp=await ctx.newCDPSession(p);
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());

 const t0=Date.now();
 await p.goto('http://localhost:9212/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 const tDom=Date.now()-t0;
 await p.waitForTimeout(3000);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:4000}); }catch(e){}
 await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
   return !l || getComputedStyle(l).display==='none'; }, null, {timeout:20000}).catch(()=>{});
 await p.waitForTimeout(2200);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const perf=await p.evaluate(()=>{
   const n=performance.getEntriesByType('navigation')[0]||{};
   const pintado=performance.getEntriesByType('paint').map(x=>[x.name,Math.round(x.startTime)]);
   return { dom:Math.round(n.domContentLoadedEventEnd||0),
            carga:Math.round(n.loadEventEnd||0),
            pintado:pintado,
            nodos:document.querySelectorAll('*').length,
            oyentes:document.querySelectorAll('[onclick]').length };
 });

 // Accesibilidad: botones que solo tienen un icono y no dicen que hacen.
 const a11y=await p.evaluate(()=>{
   const mudos=[];
   document.querySelectorAll('button,[role=button]').forEach(function(e){
     const r=e.getBoundingClientRect();
     if(r.width===0||r.height===0) return;
     const txt=(e.textContent||'').replace(/[\s​]/g,'');
     const nombre=e.getAttribute('aria-label')||e.getAttribute('title')||'';
     // Solo emoji o simbolo, sin titulo ni aria-label: un lector de pantalla
     // no puede decir que hace ese boton.
     const soloIcono = txt.length>0 && txt.length<=3 && !/[a-zA-Z0-9áéíóúñ]/.test(txt);
     if((soloIcono || txt.length===0) && !nombre){
       mudos.push((txt||'(vacío)')+' #'+(e.id||'sin-id'));
     }
   });
   return mudos;
 });

 // Contraste del texto pequeno sobre su fondo (aproximado)
 const contraste=await p.evaluate(()=>{
   const lum=c=>{ const m=c.match(/\d+/g); if(!m) return null;
     const v=m.slice(0,3).map(x=>{ x=x/255; return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4); });
     return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2]; };
   const flojos=[];
   document.querySelectorAll('div,span,p,label,button').forEach(function(e){
     if(e.children.length) return;
     const t=(e.textContent||'').trim(); if(t.length<3) return;
     const r=e.getBoundingClientRect(); if(r.width===0||r.height===0) return;
     const st=getComputedStyle(e);
     const op=parseFloat(st.opacity||'1');
     const fs=parseFloat(st.fontSize||'16');
     if(fs>=14 || op>=0.55) return;         // solo el texto pequeno Y palido
     flojos.push(t.slice(0,24)+' ('+Math.round(fs)+'px, opacidad '+op+')');
   });
   return flojos.slice(0,12);
 });

 const tam=fs.statSync(path.join(ROOT,'index.html')).size;
 console.log('=== RENDIMIENTO (movil, procesador 4x mas lento) ===');
 console.log('  index.html                : '+(tam/1024/1024).toFixed(2)+' MB');
 console.log('  DOM listo                 : '+perf.dom+' ms');
 console.log('  carga completa            : '+perf.carga+' ms');
 perf.pintado.forEach(([n,t])=>console.log('  '+n.padEnd(26)+': '+t+' ms'));
 console.log('  nodos en la pagina        : '+perf.nodos);
 console.log('  elementos con onclick     : '+perf.oyentes);
 console.log('\n=== ACCESIBILIDAD ===');
 console.log('  botones sin nombre        : '+a11y.length);
 a11y.slice(0,20).forEach(x=>console.log('     · '+x));
 console.log('\n=== TEXTO PEQUEÑO Y PÁLIDO (<14px y opacidad <0.55) ===');
 console.log('  encontrados               : '+contraste.length);
 contraste.forEach(x=>console.log('     · '+x));
 await b.close(); srv.close();
})();
