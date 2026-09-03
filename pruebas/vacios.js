const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9140);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1050,height:850}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9140/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2400);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); await p.waitForTimeout(600);}catch(e){}
 const r=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms)); const o={};
   const tieneVacio=el=>{ if(!el) return false; const h=el.innerHTML;
     return /font-size:40px/.test(h) && /font-weight:800/.test(h); };
   // El componente escapa lo que le pasen
   o.escapa=!/<img/.test(ixVacio('x','<img src=x onerror=1>','<b>hola</b>'));
   // 1) NOTAS vacias
   notes=[]; renderNotesList(); await wait(250);
   const nl=document.getElementById('notes-list');
   o.notas=tieneVacio(nl) && /No tienes notas/.test(nl.textContent);
   // notas con busqueda sin resultados -> mensaje distinto
   notes=[{id:'n1',content:'hola',updatedAt:Date.now()}];
   renderNotesList('zzzz'); await wait(200);   // el filtro va por parametro
   o.notasSinResultados=/Sin resultados/.test(document.getElementById('notes-list').textContent);
   notes=[]; renderNotesList();
   // 2) PISTAS de IXBand vacias
   openGarageBand(); await wait(300); _gbTakes.length=0; gbView('tracks'); gbRenderTracks(); await wait(250);
   const tr=document.getElementById('gb-tracks');
   o.pistas=tieneVacio(tr) && /Sin pistas/.test(tr.textContent);
   ixCerrarTodasLasVentanas(); await wait(200);
   // 3) MI NUBE: galeria vacia (antes no decia NADA)
   localStorage.removeItem('custom_wallpapers');
   openCloudPanel(); await wait(350); cloudTab('gallery'); await wait(300);
   const gal=document.querySelector('#cloud-content')||document.querySelector('[id*="cloud"]');
   o.nubeTexto=gal?gal.textContent:'';
   o.nube=/galería está vacía/i.test(o.nubeTexto);
   ixCerrarTodasLasVentanas(); await wait(150);
   return o;
 });
 console.log(JSON.stringify({...r,nubeTexto:(r.nubeTexto||'').replace(/\s+/g,' ').slice(0,90)},null,1));
 const ok=(k,v)=>console.log((v?'  ✓ ':'  ✗ ')+k);
 console.log('--- ESTADOS VACIOS ---');
 ok('el componente escapa el texto que recibe', r.escapa);
 ok('Notas: estado vacío con icono y explicación', r.notas);
 ok('Notas: mensaje distinto si la búsqueda no encuentra', r.notasSinResultados);
 ok('Pistas de IXBand: estado vacío con gracia', r.pistas);
 ok('Mi Nube: la galería vacía ya dice algo (antes nada)', r.nube);
 console.log('ERRORES JS:',errs.length?[...new Set(errs)].slice(0,3).join(' | '):'(ninguno)');
 await b.close();srv.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
