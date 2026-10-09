// Buscador de IXClocK: también emisoras del mundo (idea 11).
//
// Radio-Browser se sustituye por respuestas preparadas y se cuentan las
// peticiones. Se escribe en el buscador de verdad, letra a letra. Se comprueba:
//  · PRIVACIDAD: escribir NO manda nada fuera (el buscador también mira tus
//    notas); sale la fila «🌍 Buscar … en emisoras del mundo»;
//  · al tocarla: UNA petición, el buscador sigue abierto y enseña las
//    emisoras; moverse con las flechas no vuelve a pedir;
//  · Enter en una de ellas la pone a sonar (playWorldStation con esa emisora);
//  · lo de IXClocK sale antes que lo del mundo;
//  · con 2 letras no se ofrece; sin conexión avisa y deja volver a probar;
//  · un nombre de emisora con código no se ejecuta;
//  · y lo que escribes se ve tal cual («<b>», no «&lt;b&gt;»).
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9305);

const pedidas=[]; let sinRed=false;
(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1300,height:1000}, locale:'es-ES'});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.route(/radio-browser\.info\/json\/stations\/search/, r=>{
   const u=new URL(r.request().url()); pedidas.push(u.searchParams.get('name'));
   if(sinRed) return r.abort();
   r.fulfill({status:200, contentType:'application/json', body:JSON.stringify([
     {name:'Jazz FM London', url_resolved:'https://ejemplo.uk/jazz', country:'United Kingdom', codec:'MP3', bitrate:128, countrycode:'GB', stationuuid:'u1'},
     {name:'<img src=x onerror=window.__pwn=1>', url_resolved:'https://ejemplo.fr/x', country:'France', codec:'AAC', countrycode:'FR', stationuuid:'u2'},
     {name:'Sin URL', country:'XX'} ])});
 });
 await p.goto('http://localhost:9305/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixAbrirBusqueda==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(1500);
 const o={};
 o.falta=await p.evaluate(()=>{ try{ ixCerrarBienvenida(); }catch(e){} return typeof _ixRemotoPedir!=='function'; });
 const caja=()=>p.evaluate(()=>{ const c=document.getElementById('ix-busq-res'); return { txt:c?c.innerText.replace(/\s+/g,' '):'', grupos:[].slice.call(document.querySelectorAll('#ix-busq-res > div')).filter(d=>!d.classList.contains('ix-busq-fila')).map(d=>d.innerText.trim()), filas:document.querySelectorAll('.ix-busq-fila').length }; });
 const escribir=async t=>{ await p.fill('#ix-busq-inp',''); await p.click('#ix-busq-inp'); await p.keyboard.type(t,{delay:60}); };
 if(!o.falta){
   await p.evaluate(()=>{ window.__pwn=0; window.__sonada=null; window.playWorldStation=function(rb){ window.__sonada=rb.name; }; ixAbrirBusqueda(); });
   await p.waitForTimeout(300);
   // 1. Algo que no está en IXClocK: escribir no manda nada
   await escribir('jazzfmx');
   await p.waitForTimeout(900);
   o.mientras=await caja();
   o.pedidasEscribir=pedidas.length;
   // Enter en la única fila («Buscar en emisoras del mundo»)
   await p.keyboard.press('Enter');
   await p.waitForTimeout(700);
   o.luego=await caja();
   o.abierto=await p.evaluate(()=>_ixBusqAbierto);
   o.pedidas1=pedidas.slice();
   // Flechas: no vuelve a pedir
   await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowUp');
   await p.waitForTimeout(700);
   o.pedidas2=pedidas.length;
   o.pwn=await p.evaluate(()=>window.__pwn);
   // Enter en la primera (Jazz FM London)
   await p.keyboard.press('Enter'); await p.waitForTimeout(400);
   o.sonada=await p.evaluate(()=>window.__sonada);
   // 2. Algo que SÍ está en IXClocK: lo de aquí primero
   const local=await p.evaluate(()=>STATIONS[0].title);
   await p.evaluate(()=>ixAbrirBusqueda()); await p.waitForTimeout(200);
   await escribir(local); await p.waitForTimeout(900);
   o.mixto=await caja();
   o.mixtoPedidas=pedidas.length;
   // 3. Dos letras: nada
   const n=pedidas.length;
   await escribir('qz'); await p.waitForTimeout(800);
   o.dos={ pedidas:pedidas.length-n, ofrece:/emisoras del mundo/i.test((await caja()).txt) };
   await escribir('<q'); await p.waitForTimeout(300);
   o.vacio=await caja();
   // 4. Sin conexión
   sinRed=true;
   await p.evaluate(()=>{ window.__toasts=[]; const t=window.ixToast; window.ixToast=function(m){ window.__toasts.push(m); try{ t(m); }catch(e){} }; });
   await escribir('<b>zzyy'); await p.waitForTimeout(500);
   o.sinRed=await caja();
   await p.keyboard.press('Enter'); await p.waitForTimeout(800);
   o.sinRedTras=await caja();
   o.sinRedToasts=await p.evaluate(()=>window.__toasts.slice());
   o.pwn2=await p.evaluate(()=>window.__pwn);
 }
 await b.close(); srv.close();

 const L=o.luego||{}, M=o.mixto||{};
 const pruebas=[
  ['existe',                                          !o.falta, !o.falta],
  ['escribir NO manda nada fuera',                   o.pedidasEscribir===0, o.pedidasEscribir],
  ['ofrece «Buscar … en emisoras del mundo»',         /Buscar «jazzfmx» en emisoras del mundo/.test((o.mientras||{}).txt||''), (o.mientras||{}).txt],
  ['al pedirlo enseña las emisoras del mundo',        /Jazz FM London/.test(L.txt||'') && /United Kingdom · MP3 · 128 kbps/.test(L.txt||''), L.txt],
  ['y el buscador sigue abierto',                     o.abierto===true, o.abierto],
  ['las que no tienen dirección no salen',            L.filas===2 && !/Sin URL/.test(L.txt||''), L.filas],
  ['UNA petición, con lo que escribiste',             JSON.stringify(o.pedidas1)==='["jazzfmx"]', JSON.stringify(o.pedidas1)],
  ['las flechas no vuelven a pedir',                  o.pedidas2===1, o.pedidas2],
  ['Enter la pone a sonar',                           o.sonada==='Jazz FM London', o.sonada],
  ['lo de IXClocK primero, el mundo al final',        (M.grupos||[]).length>=2 && /mundo/i.test(M.grupos[M.grupos.length-1]) && !/mundo/i.test(M.grupos[0]) && o.mixtoPedidas===1, JSON.stringify(M.grupos)+' '+o.mixtoPedidas],
  ['con 2 letras no se ofrece ni se pide',            !!o.dos && o.dos.pedidas===0 && !o.dos.ofrece, JSON.stringify(o.dos)],
  ['«Sin resultados» enseña lo escrito tal cual',     /coincida con «<q»/.test((o.vacio||{}).txt||'') && !/&lt;/.test((o.vacio||{}).txt||''), (o.vacio||{}).txt],
  ['lo escrito se ve tal cual («<b>», no «&lt;»)',    /«<b>zzyy»/.test((o.sinRed||{}).txt||'') && !/&lt;/.test((o.sinRed||{}).txt||''), (o.sinRed||{}).txt],
  ['sin conexión avisa y deja volver a probar',       (o.sinRedToasts||[]).some(t=>/Sin conexión/.test(t)) && /Buscar «<b>zzyy» en emisoras del mundo/.test((o.sinRedTras||{}).txt||''), JSON.stringify(o.sinRedToasts)+' '+(o.sinRedTras||{}).txt],
  ['un nombre con código no se ejecuta',              o.pwn===0 && o.pwn2===0, o.pwn+' '+o.pwn2],
  ['sin errores de página',                           errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([nn,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+nn+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
