// Entrar con Google.
//
// El ID de cliente se pega en Configuración en vez de ir escrito en el código,
// y eso es a propósito: lo crea el dueño de la app en Google Cloud Console, y
// hasta que exista no hay nada que poner. Así, el día que lo cree lo pega y
// funciona al momento, sin tener que volver a tocar el código ni desplegar.
//
// Lo que hay que comprobar aquí, y por qué:
//  · sin ID no se pide NADA a Google — si no, sería cargar un script suyo en
//    cada arranque para nada;
//  · pegar el «secreto de cliente» o media URL por error no cuela en silencio:
//    lo dice, en vez de dejar al usuario esperando un botón que no va a salir;
//  · el token se lee, pero la firma NO se verifica, y eso solo vale para
//    ENSEÑAR el nombre. La prueba deja claro el límite metiendo un token
//    inventado y comprobando que no se le da ningún poder.
//
// La librería de Google está bloqueada en este entorno, así que se sirve un
// doble en local: hace lo mismo que la de verdad (initialize, renderButton) y
// deja disparar el callback a mano, que es justo lo que Google haría al elegir
// una cuenta.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9258);

const ID_BUENO='123456789012-abcdefghijklmnop.apps.googleusercontent.com';

// Un JWT como el que manda Google: cabecera.datos.firma, en base64url.
function tokenFalso(datos){
  const b=o=>Buffer.from(JSON.stringify(o)).toString('base64')
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return b({alg:'RS256'})+'.'+b(datos)+'.firmaInventada';
}

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1200,height:1000}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));

 await p.route(/^https?:\/\/(?!localhost)/, r=>r.abort());

 // Cuántas veces se le pide algo a Google. Sin ID tiene que ser CERO.
 // Esta ruta va DESPUÉS del «cortar todo» a propósito: Playwright da
 // preferencia a la última que se registra, así que al revés no se aplicaría.
 let pedidasAGoogle=0;
 await p.route(/accounts\.google\.com\/gsi\/client/, r=>{
   pedidasAGoogle++;
   r.fulfill({status:200, contentType:'text/javascript', body:`
     window.google={accounts:{id:{
       initialize:function(c){ window.__gInit=c; },
       renderButton:function(el){ el.innerHTML='<button id="g-falso">Entrar con Google</button>'; window.__gPintado=true; },
       disableAutoSelect:function(){ window.__gSalio=true; },
     }}};
   `});
 });

 await p.goto('http://localhost:9258/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixGooglePintar==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const o={};

 // ═══ SIN ID: no se le pide nada a Google, y se explica qué falta ═══
 o.sinId = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   if(!document.getElementById('left-sidebar').classList.contains('open')) toggleSidebar();
   showTab('more'); await w(700);
   const c=document.getElementById('ix-google');
   const t=c?c.innerText:'';
   return { hay:!!c, hayCampo:!!document.getElementById('ix-google-input'),
            explica:/ID de cliente/i.test(t),
            diceQueEsPublico:/es público/i.test(t),
            diceSecretoNo:/secreto de cliente.*no hace falta/i.test(t) };
 });
 o.pedidasSinId = pedidasAGoogle;

 // ═══ UN ID QUE NO LO ES: se rechaza y se dice ═══
 o.malos = await p.evaluate(()=>({
   secreto:  ixGooglePonerId('GOCSPX-abcdefghijklmnopqrstuvwx'),
   media:    ixGooglePonerId('https://console.cloud.google.com/apis'),
   inventado:ixGooglePonerId('hola que tal'),
   vacio:    ixGooglePonerId(''),
   guardadoTrasFallo: ixGoogleId(),
 }));

 // ═══ EL ID BUENO: se guarda y sale el botón ═══
 o.bueno = await p.evaluate(async(id)=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const ok=ixGooglePonerId(id);
   await w(1200);
   return { ok, guardado:ixGoogleId()===id,
            pintado:window.__gPintado===true,
            hayBoton:!!document.getElementById('g-falso'),
            idQueRecibio: window.__gInit ? null : 'no-init' };
 }, ID_BUENO);
 o.pedidasConId = pedidasAGoogle;

 // ═══ ELEGIR CUENTA: se lee el nombre y el correo ═══
 o.entrar = await p.evaluate(async(tok)=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const r=ixGoogleEntro({credential:tok});
   await w(400);
   const t=(document.getElementById('ix-google')||{}).innerText||'';
   return { perfil:r, guardado:ixGooglePerfil(),
            saleNombre:/Albert Ventura/.test(t),
            saleCorreo:/albert@ejemplo\.com/.test(t),
            diceQueNoSale:/no se mandan a ningún sitio/i.test(t) };
 }, tokenFalso({name:'Albert Ventura', email:'albert@ejemplo.com',
                picture:'https://ejemplo.test/foto.jpg', sub:'1'}));

 // ═══ UN TOKEN CON CÓDIGO DENTRO NO EJECUTA NADA ═══
 // El nombre y la foto vienen de fuera y se pintan: hay que escaparlos.
 o.xss = await p.evaluate(async(tok)=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__gXss=false;
   ixGoogleEntro({credential:tok});
   await w(500);
   const html=(document.getElementById('ix-google')||{}).innerHTML||'';
   return { colado:window.__gXss===true,
            crudo:/<img src=x/i.test(html),
            escapado:/&lt;img/i.test(html) };
 }, tokenFalso({name:'<img src=x onerror="window.__gXss=true">',
                email:'malo@ejemplo.com', picture:'x" onerror="window.__gXss=true', sub:'2'}));

 // ═══ TOKENS ROTOS: no revientan ni dejan entrar ═══
 o.rotos = await p.evaluate(()=>({
   vacio:    ixGoogleLeerToken(''),
   trozos:   ixGoogleLeerToken('solo.dos'),
   basura:   ixGoogleLeerToken('a.b.c'),
   sinCorreo:ixGoogleLeerToken(null),
 }));

 // ═══ SALIR ═══
 o.salir = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   ixGoogleSalir(); await w(400);
   const t=(document.getElementById('ix-google')||{}).innerText||'';
   return { perfil:ixGooglePerfil(), avisoAGoogle:window.__gSalio===true,
            vuelveElBoton:/Quitar el ID/.test(t) };
 });

 // ═══ QUITAR EL ID: vuelve a pedir el ID ═══
 o.quitar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   ixGooglePonerId(''); await w(400);
   return { id:ixGoogleId(), hayCampo:!!document.getElementById('ix-google-input') };
 });

 await p.close(); await b.close(); srv.close();

 const m=o.malos;
 const pruebas=[
  ['SIN ID: la ficha explica qué falta', o.sinId.hay===true && o.sinId.explica===true, JSON.stringify(o.sinId)],
  ['y NO se le pide nada a Google',      o.pedidasSinId===0,   o.pedidasSinId],
  ['dice que el ID es público',          o.sinId.diceQueEsPublico===true, o.sinId.diceQueEsPublico],
  ['y que el secreto no hace falta',     o.sinId.diceSecretoNo===true,    o.sinId.diceSecretoNo],
  ['pegar el SECRETO no cuela',          m.secreto===false,    m.secreto],
  ['ni media URL',                       m.media===false,      m.media],
  ['ni cualquier cosa',                  m.inventado===false,  m.inventado],
  ['y nada de eso se queda guardado',    m.guardadoTrasFallo==='', m.guardadoTrasFallo],
  ['un ID bueno sí se guarda',           o.bueno.ok===true && o.bueno.guardado===true, JSON.stringify(o.bueno)],
  ['y entonces SÍ se carga Google',      o.pedidasConId===1,   o.pedidasConId],
  ['y sale su botón',                    o.bueno.pintado===true && o.bueno.hayBoton===true, JSON.stringify(o.bueno)],
  ['al elegir cuenta, se lee el nombre', o.entrar.perfil && o.entrar.perfil.nombre==='Albert Ventura', JSON.stringify(o.entrar.perfil)],
  ['y el correo',                        o.entrar.perfil && o.entrar.perfil.correo==='albert@ejemplo.com', o.entrar.perfil&&o.entrar.perfil.correo],
  ['se ven en la pantalla',              o.entrar.saleNombre===true && o.entrar.saleCorreo===true, JSON.stringify({n:o.entrar.saleNombre,c:o.entrar.saleCorreo})],
  ['y dice que no se mandan a nadie',    o.entrar.diceQueNoSale===true, o.entrar.diceQueNoSale],
  ['SEGURIDAD: un nombre con código no se ejecuta', o.xss.colado===false, 'colado='+o.xss.colado],
  ['sale escapado',                      o.xss.crudo===false && o.xss.escapado===true, JSON.stringify(o.xss)],
  ['un token roto no revienta',          o.rotos.vacio===null && o.rotos.trozos===null && o.rotos.sinCorreo===null, JSON.stringify(o.rotos)],
  ['ni uno con basura dentro',           o.rotos.basura===null, o.rotos.basura],
  ['salir borra el perfil',              o.salir.perfil===null, JSON.stringify(o.salir.perfil)],
  ['y se lo dice a Google',              o.salir.avisoAGoogle===true, o.salir.avisoAGoogle],
  ['quitar el ID vuelve al principio',   o.quitar.id==='' && o.quitar.hayCampo===true, JSON.stringify(o.quitar)],
  ['sin errores de página',              errs.length===0,      errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})();
