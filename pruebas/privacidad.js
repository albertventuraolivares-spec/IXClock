// Página de privacidad y condiciones (idea 71).
//
// Una política de privacidad que miente es peor que no tener ninguna. Así que
// lo importante aquí no es que la página exista, sino que CUADRE CON EL
// CÓDIGO: si la app manda datos a un servicio, la página tiene que nombrarlo;
// y si la página dice «sin cookies propias», la app no puede poner ninguna.
// Si mañana alguien añade otro servicio y no lo cuenta, esta prueba falla.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9265);

const CORREO='albertventuraolivares@gmail.com';
const app=fs.readFileSync(ROOT+'/index.html','utf8');
const funciones=fs.readdirSync(ROOT+'/netlify/functions').map(f=>fs.readFileSync(ROOT+'/netlify/functions/'+f,'latin1')).join('\n');
// Si el código contiene esto → la página tiene que nombrar aquello.
const SERVICIOS=[
  [/api\.pollinations\.ai|text\.pollinations\.ai/, app,        /Pollinations/],
  [/image\.pollinations\.ai/,                     app,        /imagen, la descripción se envía también a Pollinations/],
  [/api\.anthropic\.com/,                          app,        /Anthropic/],
  [/open-meteo\.com/,                              app,        /Open-Meteo/],
  [/tile\.openstreetmap\.org/,                     app,        /OpenStreetMap/],
  [/nominatim\.openstreetmap\.org/,                app,        /Nominatim/],
  [/translate\.googleapis\.com/,                   app,        /Google Translate/],
  [/lingva/,                                       app,        /Lingva/],
  [/open\.er-api\.com/,                            app,        /open\.er-api\.com/],
  [/api\.frankfurter\.app/,                        app,        /Frankfurter/],
  [/accounts\.google\.com\/gsi/,                   app,        /Google/],
  [/api\.resend\.com/,                             funciones,  /Resend/],
  [/@netlify\/blobs/,                              funciones,  /Netlify/],
];

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:390,height:844}});
 const p=await ctx.newPage();
 const errs=[], fuera=[];
 p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>{ fuera.push(r.request().url()); r.abort(); });

 // ═══ LA PÁGINA ═══
 const resp=await p.goto('http://localhost:9265/privacidad.html',{waitUntil:'load'});
 o={};
 o.pag=await p.evaluate(()=>({
   lang:document.documentElement.lang, titulo:document.title,
   viewport:!!document.querySelector('meta[name=viewport]'),
   h1:document.querySelectorAll('h1').length,
   mailto:[].slice.call(document.querySelectorAll('a[href^="mailto:"]')).map(a=>a.getAttribute('href')),
   texto:document.body.innerText,
   volver:!!document.querySelector('a[href="./"]'),
   ancho:document.documentElement.scrollWidth, vista:innerWidth,
 }));
 o.status=resp.status();
 o.fueraPagina=fuera.slice();

 // ═══ LA APP: el enlace y las cookies ═══
 await p.goto('http://localhost:9265/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof showTab==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 o.enlace=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   if(!document.getElementById('left-sidebar').classList.contains('open')) toggleSidebar();
   showTab('more'); await w(600);
   const a=document.getElementById('ix-privacidad');
   if(!a) return null;
   const r=a.getBoundingClientRect();
   return { href:a.getAttribute('href'), visible:r.width>0&&r.height>0, texto:a.innerText.trim(),
            borrarTodo:typeof ixBorrarTodo==='function' };
 });
 // Se abre de verdad desde el enlace
 let nueva=null;
 try{
   const [pp]=await Promise.all([ctx.waitForEvent('page',{timeout:5000}), p.click('#ix-privacidad',{timeout:3000})]);
   await pp.waitForLoadState('load'); nueva=await pp.title(); await pp.close();
 }catch(e){ nueva='(no se abrió: '+e.message.split('\n')[0]+')'; }
 o.nueva=nueva;
 o.cookies=(await ctx.cookies()).filter(c=>/localhost/.test(c.domain));
 o.docCookie=await p.evaluate(()=>document.cookie);
 await b.close(); srv.close();

 const t=o.pag.texto;
 const pruebas=[
  ['la página se sirve',                     o.status===200, o.status],
  ['en español, con título y viewport',      o.pag.lang==='es' && /Privacidad/.test(o.pag.titulo) && o.pag.viewport, JSON.stringify({l:o.pag.lang,t:o.pag.titulo})],
  ['un solo <h1>',                           o.pag.h1===1, o.pag.h1],
  ['lleva el correo de contacto',            o.pag.mailto.length>0 && o.pag.mailto.every(h=>h==='mailto:'+CORREO), o.pag.mailto.join(' ')],
  ['y un enlace para volver a la app',       o.pag.volver, o.pag.volver],
  ['NO carga nada de fuera',                 o.fueraPagina.length===0, o.fueraPagina.slice(0,3).join(' ')],
  ['cabe en un móvil sin scroll lateral',    o.pag.ancho<=o.pag.vista, o.pag.ancho+' / '+o.pag.vista],
  ['dice cómo borrar los datos',             /Borrar todos los datos/.test(t) && !!(o.enlace&&o.enlace.borrarTodo), 'ok'],
  ['explica la sincronización',              /Sincronizar/.test(t) && /código/.test(t), 'ok'],
  ['avisa de que las opiniones son públicas',/Opiniones/.test(t) && /públicos/.test(t), 'ok'],
  ['incluye condiciones de uso',             /Condiciones de uso/.test(t) && /tal cual/.test(t), 'ok'],
 ];
 SERVICIOS.forEach(([enCodigo, donde, enPagina])=>{
   if(enCodigo.test(donde)) pruebas.push(['CUADRA CON EL CÓDIGO: nombra '+enPagina.source, enPagina.test(t), enCodigo.source]);
 });
 pruebas.push(
  ['«sin cookies propias» es verdad',         o.cookies.length===0 && o.docCookie==='', JSON.stringify(o.cookies.map(c=>c.name))+' '+o.docCookie],
  ['el enlace está en Configuración → Más',   !!o.enlace && o.enlace.href==='privacidad.html' && o.enlace.visible, JSON.stringify(o.enlace)],
  ['y abre la página',                        /Privacidad/.test(o.nueva||''), o.nueva],
  ['sin errores de página',                   errs.length===0, errs.slice(0,3).join(' | ')],
 );
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
var o;
