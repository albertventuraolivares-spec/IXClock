// XSS reflejado en la página de error del proxy del Navegador.
//
// El proxy (`netlify/functions/proxy.js`) es lo que usa la app «Navegador» para
// cargar páginas dentro de IXClocK. Cuando la carga falla (DNS, timeout,
// conexión rechazada) devuelve una página de error 502 que metía la URL pedida
// TAL CUAL dentro del HTML.
//
// Por qué importa de verdad: esa página se sirve desde el MISMO ORIGEN que
// IXClocK, así que el código que se cuele ahí corre con acceso al localStorage
// de la app — notas, alarmas, ajustes, todo.
//
// Y no basta con que la URL pase el `new URL()` de validación: una URL
// perfectamente válida puede llevar comillas y etiquetas en la ruta, como
// https://noexiste.invalid/"><script>...</script>
//
// La prueba llama a la función DE VERDAD (no a una copia), coge el HTML que
// devuelve, lo sirve en un navegador real y comprueba que no se ejecuta nada.
const http=require('http');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const proxy=require('/home/user/IXClock/netlify/functions/proxy.js');

// Un dominio que no existe: así el fetch falla y entramos por la rama del 502,
// que es justo donde estaba el fallo.
const PAYLOADS=[
  'https://noexiste-ixclock-prueba.invalid/"><script>window.__xss=1;</script>',
  'https://noexiste-ixclock-prueba.invalid/?a=<img src=x onerror="window.__xss=1">',
  "https://noexiste-ixclock-prueba.invalid/'><svg onload='window.__xss=1'>",
];

(async()=>{
 const respuestas=[];
 for(const u of PAYLOADS){
   const r=await proxy.handler({queryStringParameters:{url:u}});
   respuestas.push(r);
 }

 // Una normal, para comprobar que la página de error SIGUE SIRVIENDO.
 const normal=await proxy.handler({queryStringParameters:{url:'https://noexiste-ixclock-prueba.invalid/pagina'}});

 const srv=http.createServer((q,s)=>{
   const i=parseInt((q.url||'/0').slice(1),10)||0;
   const cuerpo = i<respuestas.length ? respuestas[i].body : normal.body;
   s.writeHead(200,{'content-type':'text/html; charset=utf-8'});
   s.end(cuerpo);
 }).listen(9255);

 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ejecutado=[];
 for(let i=0;i<PAYLOADS.length;i++){
   const p=await b.newPage();
   let alerta=false;
   p.on('dialog',d=>{ alerta=true; d.dismiss(); });
   await p.goto('http://localhost:9255/'+i,{waitUntil:'domcontentloaded'});
   await p.waitForTimeout(600);
   const colado=await p.evaluate(()=>window.__xss===1);
   ejecutado.push({colado, alerta});
   await p.close();
 }

 // La página normal se sigue leyendo bien
 const p2=await b.newPage();
 await p2.goto('http://localhost:9255/99',{waitUntil:'domcontentloaded'});
 await p2.waitForTimeout(400);
 const util=await p2.evaluate(()=>({
   titulo:(document.querySelector('h2')||{}).textContent||'',
   url:(document.querySelector('code')||{}).textContent||'',
   boton:!!document.querySelector('button'),
 }));
 await p2.close();
 await b.close(); srv.close();

 const cuerpos=respuestas.map(r=>r.body);
 const pruebas=[
  ['la rama de error responde 502',   respuestas.every(r=>r.statusCode===502), respuestas.map(r=>r.statusCode).join(',')],
  ['NADA se ejecuta en el navegador', ejecutado.every(x=>!x.colado),  JSON.stringify(ejecutado)],
  ['ni salta ningún cartel',          ejecutado.every(x=>!x.alerta),  JSON.stringify(ejecutado)],
  ['no queda un <script> vivo',       cuerpos.every(c=>!/<script>window\.__xss/.test(c)), 'ok'],
  ['ni un onerror suelto',            cuerpos.every(c=>!/<img src=x onerror=/.test(c)),   'ok'],
  ['ni un onload de svg',             cuerpos.every(c=>!/<svg onload=/.test(c)),          'ok'],
  ['los signos salen escapados',      cuerpos.every(c=>/&lt;|&gt;|&quot;/.test(c)),       'ok'],
  ['la página de error SIGUE sirviendo', /No se pudo cargar/.test(util.titulo), util.titulo],
  ['y enseña la URL que falló',       /noexiste-ixclock-prueba/.test(util.url), util.url],
  ['con su botón de reintentar',      util.boton===true, util.boton],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})();
