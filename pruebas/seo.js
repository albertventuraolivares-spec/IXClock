// robots.txt, sitemap.xml y canonical (ideas 64 y 65 del backlog).
//
// Lo que importa no es que existan los tres, sino que DIGAN LO MISMO: un
// canonical que apunta a una URL y un sitemap que lista otra son dos mensajes
// contradictorios para un buscador, y eso es peor que no tener ninguno.
//
// Se sirven igual que los sirve Netlify (publish = "." en netlify.toml) y se
// leen como los leería un buscador: por HTTP, no abriendo el archivo del disco.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.txt':'text/plain','.xml':'application/xml','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9261);

const RAIZ='https://ixclockplus.netlify.app/';
const baja=u=>new Promise(r=>http.get('http://localhost:9261'+u,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r({status:res.statusCode,tipo:res.headers['content-type'],cuerpo:d}));}));

(async()=>{
 const o={};
 o.robots=await baja('/robots.txt');
 o.sitemap=await baja('/sitemap.xml');

 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());

 // El XML se pasa por el parser del navegador: si está mal formado lo dice.
 await p.goto('about:blank');
 o.xml=await p.evaluate(txt=>{
   const d=new DOMParser().parseFromString(txt,'application/xml');
   const err=d.getElementsByTagName('parsererror').length>0;
   const ns=d.documentElement.namespaceURI;
   const locs=[].slice.call(d.getElementsByTagName('loc')).map(x=>x.textContent.trim());
   const mods=[].slice.call(d.getElementsByTagName('lastmod')).map(x=>x.textContent.trim());
   return { err, raiz:d.documentElement.nodeName, ns, locs, mods };
 }, o.sitemap.cuerpo);

 // El canonical, en la página y en una de las «?app=», que es la que importa.
 const canon=async url=>{
   await p.goto('http://localhost:9261'+url,{waitUntil:'domcontentloaded'});
   return p.evaluate(()=>[].slice.call(document.querySelectorAll('link[rel="canonical"]')).map(l=>l.getAttribute('href')));
 };
 o.canonRaiz=await canon('/');
 o.canonApp=await canon('/?app=ixband');
 await p.waitForTimeout(1500);
 await b.close(); srv.close();

 const lineas=o.robots.cuerpo.split('\n').map(l=>l.trim());
 const sitemapEnRobots=(lineas.find(l=>/^Sitemap:/i.test(l))||'').replace(/^Sitemap:\s*/i,'');
 const bloqueaTodo=lineas.some(l=>/^Disallow:\s*\/\s*$/i.test(l));
 const pruebas=[
  ['robots.txt se sirve',                   o.robots.status===200 && /text\/plain/.test(o.robots.tipo), o.robots.status+' '+o.robots.tipo],
  ['NO bloquea la web entera',              bloqueaTodo===false, 'Disallow: / → '+bloqueaTodo],
  ['y apunta al sitemap',                   sitemapEnRobots===RAIZ+'sitemap.xml', sitemapEnRobots],
  ['aparta las funciones del servidor',     lineas.includes('Disallow: /.netlify/'), 'ok'],
  ['sitemap.xml se sirve como XML',         o.sitemap.status===200 && /xml/.test(o.sitemap.tipo), o.sitemap.status+' '+o.sitemap.tipo],
  ['el XML está bien formado',              o.xml.err===false && o.xml.raiz==='urlset', JSON.stringify({err:o.xml.err,raiz:o.xml.raiz})],
  ['con el espacio de nombres del estándar',o.xml.ns==='http://www.sitemaps.org/schemas/sitemap/0.9', o.xml.ns],
  ['lista la raíz',                         o.xml.locs.length===1 && o.xml.locs[0]===RAIZ, o.xml.locs.join(' ')],
  ['y NINGÚN «?app=» (contradiría al canonical)', o.xml.locs.every(l=>l.indexOf('?')<0), o.xml.locs.join(' ')],
  ['fecha en formato válido',               o.xml.mods.every(m=>/^\d{4}-\d{2}-\d{2}$/.test(m)), o.xml.mods.join(' ')],
  ['la página lleva UN canonical',          o.canonRaiz.length===1, JSON.stringify(o.canonRaiz)],
  ['absoluto y a la raíz',                  o.canonRaiz[0]===RAIZ, o.canonRaiz[0]],
  ['un «?app=» apunta también a la raíz',   o.canonApp.length===1 && o.canonApp[0]===RAIZ, JSON.stringify(o.canonApp)],
  ['CANONICAL Y SITEMAP DICEN LO MISMO',    o.canonRaiz[0]===o.xml.locs[0], o.canonRaiz[0]+' = '+o.xml.locs[0]],
  ['sin errores de página',                 errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
