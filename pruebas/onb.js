const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9150);
const nueva = async (b)=>{ const ctx=await b.newContext({viewport:{width:1000,height:820}});
 const p=await ctx.newPage(); await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9150/',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(2300);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}}); return {ctx,p}; };
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const errs=[];
 // --- PRIMERA VEZ: entra como invitado y debe salir la bienvenida ---
 const A=await nueva(b); A.p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await A.p.click('text=Continuar como invitado'); await A.p.waitForTimeout(1600);
 const r1=await A.p.evaluate(()=>{
   const d=document.getElementById('ix-onb');
   return {sale:!!d, texto:d?d.textContent.replace(/\s+/g,' ').slice(0,70):'', puntos:d?d.querySelectorAll('span[style*="border-radius:50%"]').length:0};
 });
 // recorrer los 3 pasos
 const pasos=await A.p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms)); const vistos=[];
   for(let i=0;i<3;i++){
     vistos.push(document.getElementById('ix-onb').textContent.replace(/\s+/g,' ').slice(0,34));
     if(i<2){ ixSiguienteBienvenida(); await wait(160); }
   }
   const ultimoBoton=document.getElementById('ix-onb').textContent.includes('¡Vamos!');
   ixCerrarBienvenida(); await wait(160);
   return {vistos, ultimoBoton, cerrada:!document.getElementById('ix-onb'), marcada:localStorage.getItem('ix_onboarding_v1')==='1'};
 });
 // --- SEGUNDA VISITA en el mismo perfil: NO debe volver a salir ---
 const p2=await A.ctx.newPage(); await p2.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p2.goto('http://localhost:9150/',{waitUntil:'domcontentloaded'}); await p2.waitForTimeout(3000);
 const r2=await p2.evaluate(()=>({onb:!!document.getElementById('ix-onb'), marcada:localStorage.getItem('ix_onboarding_v1')==='1'}));
 // --- se puede volver a ver a mano ---
 const r3=await p2.evaluate(async()=>{
   ixRepetirBienvenida(); await new Promise(r=>setTimeout(r,250));
   const ok=!!document.getElementById('ix-onb');
   ixCerrarBienvenida();
   return {reabre:ok, vuelveAMarcar:localStorage.getItem('ix_onboarding_v1')==='1'};
 });
 // --- perfil NUEVO: vuelve a salir ---
 const B=await nueva(b);
 await B.p.click('text=Continuar como invitado'); await B.p.waitForTimeout(1600);
 const r4=await B.p.evaluate(()=>!!document.getElementById('ix-onb'));
 console.log(JSON.stringify({r1,pasos,r2,r3,r4},null,1));
 const ok=(k,v)=>console.log((v?'  ✓ ':'  ✗ ')+k);
 console.log('--- BIENVENIDA DE 3 PASOS ---');
 ok('sale la primera vez al entrar', r1.sale && /IXClocK/.test(r1.texto));
 ok('tiene 3 pasos distintos y se recorren', pasos.vistos.length===3 && new Set(pasos.vistos).size===3);
 ok('el último paso dice «¡Vamos!»', pasos.ultimoBoton);
 ok('al cerrarla se marca como vista', pasos.cerrada && pasos.marcada);
 ok('NO vuelve a salir en la siguiente visita', !r2.onb && r2.marcada);
 ok('se puede volver a ver desde la Ayuda', r3.reabre && r3.vuelveAMarcar);
 ok('en un dispositivo nuevo sí sale', r4===true);
 console.log('ERRORES JS:',errs.length?[...new Set(errs)].slice(0,3).join(' | '):'(ninguno)');
 await b.close();srv.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
