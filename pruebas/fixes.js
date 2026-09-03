const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9120);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1100,height:850}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9120/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2400);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); await p.waitForTimeout(600);}catch(e){}
 const r=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms)); const o={};
   const PAYLOAD='<img src=x onerror="window.__pwned=1">';
   // 1) atajos del manifest apuntan a ids reales
   const m=await (await fetch('manifest.webmanifest')).json();
   const ids=IX_APPS.map(a=>a.id);
   o.atajos=m.shortcuts.map(s=>s.url.split('app=')[1]);
   o.atajosValidos=o.atajos.every(id=>ids.includes(id));
   // 2) tarjeta del buscador
   const bus=IX_APPS.find(a=>a.id==='buscador');
   o.buscador={n:bus.n,d:bus.d};
   o.noPrometeGlobal=!/todo IXClocK/i.test(bus.d) && /canal|emisora/i.test(bus.n+' '+bus.d);
   // 3) XSS en NOTAS
   notes=[{id:'x1',content:PAYLOAD+'\n'+PAYLOAD,updatedAt:Date.now()}];
   renderNotesList(); await wait(400);
   o.notaPwned=window.__pwned===1;
   const nrow=document.querySelector('.note-row');
   o.notaImgs=nrow?nrow.querySelectorAll('img').length:-1;
   o.notaTextoLiteral=nrow?/img src=x/.test(nrow.textContent):false;
   // 4) XSS en ALARMAS
   window.__pwned=undefined;
   alarms=[{id:'a1',hour:7,minute:0,label:PAYLOAD,enabled:true,tone:'radial'}];
   renderAlarms(); await wait(400);
   o.alarmaPwned=window.__pwned===1;
   const al=document.querySelector('.alarm-label');
   o.alarmaImgs=al?al.querySelectorAll('img').length:-1;
   o.alarmaTextoLiteral=al?/img src=x/.test(al.textContent):false;
   notes=[]; alarms=[];
   return o;
 });
 // 5) el atajo abre el navegador de verdad
 const p2=await b.newPage({viewport:{width:1000,height:800}});
 await p2.route(/^https?:\/\/(?!localhost)/,rr=>rr.abort());
 await p2.goto('http://localhost:9120/?app=navegador',{waitUntil:'domcontentloaded'});
 await p2.waitForTimeout(3400);
 r.atajoAbre=await p2.evaluate(()=>{const m=document.getElementById('browser-modal');return !!m && getComputedStyle(m).display!=='none';});
 console.log(JSON.stringify(r,null,1));
 const ok=(k,v)=>console.log((v?'  ✓ ':'  ✗ ')+k);
 console.log('--- 3 FIXES ---');
 ok('los atajos del manifest apuntan a apps reales', r.atajosValidos && r.atajos.includes('navegador'));
 ok('el atajo /?app=navegador ABRE el navegador', r.atajoAbre);
 ok('la tarjeta ya no promete búsqueda global', r.noPrometeGlobal);
 ok('XSS en notas NEUTRALIZADO (no ejecuta, sale como texto)', !r.notaPwned && r.notaImgs===0 && r.notaTextoLiteral);
 ok('XSS en alarmas NEUTRALIZADO', !r.alarmaPwned && r.alarmaImgs===0 && r.alarmaTextoLiteral);
 console.log('ERRORES JS:',errs.length?[...new Set(errs)].slice(0,3).join(' | '):'(ninguno)');
 await b.close();srv.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
