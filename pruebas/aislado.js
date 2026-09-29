// Páginas del proxy aisladas + cabeceras de seguridad (idea 66).
//
// El fallo: el navegador interno carga las webs a través de
// /.netlify/functions/proxy, que las sirve DESDE EL ORIGEN DE IXCLOCK. El
// JavaScript de cualquier web corría entonces como si fuera la app, y podía
// leer el localStorage (notas, código de sincronización...). Ni siquiera hacía
// falta abrir la app: bastaba un enlace a proxy?url=<web-mala>.
//
// La prueba monta una «web mala» que intenta leer un secreto del localStorage,
// la pasa por la función de verdad (no por una copia) y comprueba que ya no
// puede, tanto abierta suelta como dentro del navegador de la app. Y que el
// navegador sigue enterándose del título, la URL y los muros anti-bots, que
// antes sacaba mirando dentro del iframe y ahora le cuenta la propia página.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const proxy=require(ROOT+'/netlify/functions/proxy.js');
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json','.txt':'text/plain','.xml':'application/xml','.mp4':'video/mp4'};

// «malo.example» se desvía a un servidor local. El proxy bloquea localhost a
// propósito (SSRF), así que se engancha http.request en vez de relajar eso.
const httpRequest=http.request;
http.request=function(o,cb){
  if(o && o.hostname==='malo.example') o=Object.assign({},o,{hostname:'127.0.0.1',port:9262});
  return httpRequest.call(http,o,cb);
};

const MALA=`<!doctype html><html><head><title>Página Mala</title></head><body><p>hola</p>
<script>
var r; try{ r=localStorage.getItem('ix_prueba_secreto'); }catch(e){ r='BLOQUEADO'; }
document.body.setAttribute('data-robado', r===null?'vacio':r);
try{ parent.postMessage({robado:r},'*'); }catch(e){}
</script></body></html>`;
const BOT=`<!doctype html><html><head><title>Just a moment...</title></head><body>Verify you are human</body></html>`;
const web=http.createServer((q,s)=>{ s.writeHead(200,{'content-type':'text/html; charset=utf-8'}); s.end(q.url.indexOf('/bot')===0?BOT:MALA); }).listen(9262);

// Las cabeceras se leen del netlify.toml de verdad, no se copian aquí.
const toml=fs.readFileSync(ROOT+'/netlify.toml','utf8');
const CAB={};
const bloque=(toml.split('[headers.values]')[1]||'').split(/\n\s*\[/)[0];   // solo hasta la siguiente sección
bloque.split('\n').forEach(l=>{ const m=/^\s*([A-Za-z-]+)\s*=\s*"(.*)"\s*$/.exec(l); if(m) CAB[m[1]]=m[2]; });

const app=http.createServer(async(q,s)=>{
  const u=new URL(q.url,'http://localhost');
  if(u.pathname==='/.netlify/functions/proxy'){
    const r=await proxy.handler({queryStringParameters:Object.fromEntries(u.searchParams)});
    // Se ponen también las del toml por si Netlify las aplicara a las
    // funciones: la prueba tiene que valer en el peor caso.
    const h=Object.assign({},CAB,r.headers||{});
    Object.keys(r.multiValueHeaders||{}).forEach(k=>{ h[k]=r.multiValueHeaders[k]; });
    delete h['content-length']; delete h['Content-Length'];
    s.writeHead(r.statusCode,h); return s.end(r.body||'');
  }
  if(u.pathname==='/__semilla'){
    s.writeHead(200,Object.assign({'content-type':'text/html'},CAB));
    return s.end('<script>localStorage.setItem("ix_prueba_secreto","SECRETO")</script>ok');
  }
  let f=decodeURIComponent(u.pathname); if(f==='/')f='/index.html';
  const p=path.join(ROOT,f);
  if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404,CAB);return s.end('nf');}
  s.writeHead(200,Object.assign({'content-type':MIME[path.extname(p)]||'application/octet-stream'},CAB));
  s.end(fs.readFileSync(p));
}).listen(9263);

// Otra web que intenta meter IXClocK en un iframe (clickjacking)
const otra=http.createServer((q,s)=>{ s.writeHead(200,{'content-type':'text/html'}); s.end('<iframe id="f" src="http://localhost:9263/robots.txt" width=400 height=300></iframe>'); }).listen(9264);

const PX='/.netlify/functions/proxy?url=';
(async()=>{
 const o={};
 // ═══ LA RESPUESTA DEL PROXY LLEVA LA CSP AISLADA ═══
 const r1=await proxy.handler({queryStringParameters:{url:'http://malo.example/'}});
 const csp1=(r1.headers||{})['Content-Security-Policy']||'';
 o.csp={ status:r1.statusCode, csp:csp1 };
 const r2=await proxy.handler({queryStringParameters:{url:'https://noexiste-ixclock-prueba.invalid/'}});
 o.csp502=(r2.headers||{})['Content-Security-Policy']||'';

 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1200,height:900}});
 const p=await ctx.newPage();
 const errs=[], mime=[];
 p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 p.on('console',m=>{ if(m.type()==='error' && /MIME|nosniff|Refused to (execute|apply)/i.test(m.text())) mime.push(m.text().slice(0,120)); });
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());

 // ═══ ABIERTA SUELTA (el enlace malicioso) ═══
 await p.goto('http://localhost:9263/__semilla');
 await p.goto('http://localhost:9263'+PX+encodeURIComponent('http://malo.example/'),{waitUntil:'load'});
 await p.waitForTimeout(300);
 o.suelta=await p.evaluate(()=>({ robado:document.body.getAttribute('data-robado'), origen:String(self.origin), texto:document.body.innerText.trim() }));

 // ═══ LA APP ARRANCA CON LAS CABECERAS PUESTAS ═══
 const resp=await p.goto('http://localhost:9263/',{waitUntil:'domcontentloaded'});
 o.cab=resp.headers();
 await p.waitForFunction(()=>typeof openBrowser==='function' && typeof browserNewTab==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 o.secretoApp=await p.evaluate(()=>localStorage.getItem('ix_prueba_secreto'));

 // ═══ DENTRO DEL NAVEGADOR DE LA APP ═══
 o.nav=await p.evaluate(async(PX)=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__robos=[];
   addEventListener('message',e=>{ if(e.data && 'robado' in e.data) window.__robos.push(e.data.robado); });
   openBrowser(); await w(300);
   browserNewTab(); browserLoadUrl(PX+encodeURIComponent('http://malo.example/')); await w(2500);
   const t=getActiveTab();
   return { robos:window.__robos.slice(), titulo:t&&t.title, url:(document.getElementById('browser-url')||{}).value,
            tabUrl:t&&t.url, barra:(document.getElementById('browser-tabbar')||{}).innerText };
 }, PX);

 // ═══ UN MURO ANTI-BOTS SE SIGUE DETECTANDO ═══
 o.bot=await p.evaluate(async(PX)=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   browserNewTab(); browserLoadUrl(PX+encodeURIComponent('http://malo.example/bot')); await w(4000);
   const t=getActiveTab();
   const pane=document.getElementById('browser-pane-'+t.id);
   const b=pane && pane.querySelector('.browser-stuck-banner');
   return { visible:!!b && b.style.display!=='none', texto:b?b.innerText:'' };
 }, PX);

 // ═══ Y EN LAS VENTANAS DE NAVEGADOR ═══
 o.ventana=await p.evaluate(async(PX)=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   try{ document.getElementById('browser-modal').style.display='none'; }catch(e){}
   window.__robos=[];
   openBrowserWindow(); await w(200);
   const win=_bwins[_bwins.length-1];
   _bwinLoad(win.id, PX+encodeURIComponent('http://malo.example/')); await w(2500); const el=_bwinEl(win.id);
   return { robos:window.__robos.slice(), titulo:(el.querySelector('.bwin-title')||{}).textContent, url:(el.querySelector('.bwin-url')||{}).value };
 }, PX);

 // ═══ OTRA WEB NO PUEDE ENMARCARNOS ═══
 const p2=await ctx.newPage();
 await p2.goto('http://localhost:9264/',{waitUntil:'load'});
 await p2.waitForTimeout(800);
 const fr=p2.frames().find(f=>f!==p2.mainFrame());
 let txt=''; try{ txt=await fr.evaluate(()=>document.body?document.body.innerText:''); }catch(e){ txt='(inaccesible)'; }
 o.marco={ url:fr?fr.url():'', txt:txt.slice(0,40) };
 await p2.close();

 await b.close(); web.close(); app.close(); otra.close();

 const aislada = c => /(^|;)\s*sandbox\b/.test(c) && !/allow-same-origin/.test(c) && /allow-scripts/.test(c);
 const pruebas=[
  ['el proxy sirve la página',                   o.csp.status===200, o.csp.status],
  ['con CSP «sandbox» SIN allow-same-origin',    aislada(o.csp.csp), o.csp.csp],
  ['la página de error también',                 aislada(o.csp502), o.csp502],
  ['ENLACE SUELTO: la web NO lee el localStorage', o.suelta.robado==='BLOQUEADO', JSON.stringify(o.suelta)],
  ['y queda en un origen opaco',                 o.suelta.origen==='null', o.suelta.origen],
  ['pero se ve y su script corre',               /hola/.test(o.suelta.texto) && o.suelta.robado!==null, o.suelta.texto],
  ['el secreto sigue en la app',                 o.secretoApp==='SECRETO', o.secretoApp],
  ['EN EL NAVEGADOR: tampoco lo lee',            o.nav.robos.length>0 && o.nav.robos.every(x=>x==='BLOQUEADO'), JSON.stringify(o.nav.robos)],
  ['la pestaña coge el título de la web',        o.nav.titulo==='Página Mala' && /Página Mala/.test(o.nav.barra||''), JSON.stringify({t:o.nav.titulo})],
  ['y la barra enseña la URL real',              o.nav.url==='http://malo.example/' && o.nav.tabUrl==='http://malo.example/', o.nav.url],
  ['el muro anti-bots se sigue detectando',      o.bot.visible===true && /anti-bots/i.test(o.bot.texto), JSON.stringify(o.bot)],
  ['VENTANA: tampoco lo lee',                    o.ventana.robos.length>0 && o.ventana.robos.every(x=>x==='BLOQUEADO'), JSON.stringify(o.ventana.robos)],
  ['y coge título y URL',                        o.ventana.titulo==='Página Mala' && o.ventana.url==='http://malo.example/', JSON.stringify(o.ventana)],
  ['cabecera nosniff',                           o.cab['x-content-type-options']==='nosniff', o.cab['x-content-type-options']],
  ['X-Frame-Options SAMEORIGIN',                 o.cab['x-frame-options']==='SAMEORIGIN', o.cab['x-frame-options']],
  ["frame-ancestors 'self'",                     /frame-ancestors 'self'/.test(o.cab['content-security-policy']||''), o.cab['content-security-policy']],
  ['Referrer-Policy',                            o.cab['referrer-policy']==='strict-origin-when-cross-origin', o.cab['referrer-policy']],
  ['Permissions-Policy NO cierra ubicación ni micro', !/geolocation|microphone|fullscreen/.test(o.cab['permissions-policy']||'x') && !!o.cab['permissions-policy'], o.cab['permissions-policy']],
  ['OTRA WEB no puede meternos en un iframe',    !/User-agent/i.test(o.marco.txt), JSON.stringify(o.marco)],
  ['con nosniff todo sigue cargando',            mime.length===0, mime.slice(0,2).join(' | ')],
  ['sin errores de página',                      errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
