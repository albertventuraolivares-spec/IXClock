const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9190);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9190/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof openGarageBand==='function',
   null, {timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2400);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
   return !l || getComputedStyle(l).display==='none'; }, null, {timeout:20000}).catch(()=>{});
 await p.waitForTimeout(2200);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 // El botón del dock existe y abre el buscador con un toque de verdad.
 const hayBoton = await p.locator('#top-dock button[title*="Buscar en todo"]').count();
 await p.click('#top-dock button[title*="Buscar en todo"]');
 await p.waitForTimeout(400);
 const abreConBoton = await p.evaluate(()=>{
   const o=document.getElementById('ix-busqueda');
   return !!o && getComputedStyle(o).display!=='none' && document.activeElement.id==='ix-busq-inp';
 });
 // Escribir de verdad en el campo, con teclado real.
 await p.keyboard.type('mapas');
 await p.waitForTimeout(300);
 const conTexto = await p.evaluate(()=>{
   const f=document.querySelectorAll('.ix-busq-fila');
   return { n:f.length, primero:(f[0]||{}).innerText||'', resaltado:(f[0]||{}).getAttribute('style')||'' };
 });
 // Flechas y Enter: abrir con el teclado.
 await p.keyboard.press('ArrowDown');
 await p.waitForTimeout(150);
 const bajo = await p.evaluate(()=>_ixBusqSel);
 await p.keyboard.press('Escape');
 await p.waitForTimeout(250);
 const cierraConEsc = await p.evaluate(()=>{
   const o=document.getElementById('ix-busqueda');
   return getComputedStyle(o).display==='none' && _ixBusqAbierto===false;
 });
 // Ctrl+K desde cualquier sitio.
 await p.keyboard.press('Control+k');
 await p.waitForTimeout(350);
 const abreCtrlK = await p.evaluate(()=>getComputedStyle(document.getElementById('ix-busqueda')).display!=='none');
 await p.keyboard.press('Escape');
 await p.waitForTimeout(200);

 const r=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms)); const o={};
   const grupos=q=>{ const g={}; ixBuscarTodo(q).forEach(x=>{g[x.grupo]=(g[x.grupo]||0)+1;}); return g; };

   // --- busca en cada sitio, no solo en emisoras ---
   o.gApps    = Object.keys(grupos('mapas')).indexOf('Apps')>=0;
   o.gCiudad  = Object.keys(grupos('tokio')).indexOf('Reloj mundial')>=0;
   o.gAjustes = Object.keys(grupos('pantalla completa')).indexOf('Configuración')>=0;
   o.gRelojes = Object.keys(grupos('reloj')).indexOf('Relojes')>=0;

   // notas: se crea una y tiene que salir
   notes.push({id:'n-test-1',content:'Lista de la compra\nleche y pan',updatedAt:Date.now()});
   const rn=ixBuscarTodo('compra');
   o.gNotas = rn.some(x=>x.grupo==='Notas' && /Lista de la compra/.test(x.titulo));
   o.notaPorElCuerpo = ixBuscarTodo('leche').some(x=>x.grupo==='Notas');

   // --- vacío y sin resultados ---
   o.vacioNoBusca = ixBuscarTodo('').length===0 && ixBuscarTodo('   ').length===0;
   o.sinResultados = ixBuscarTodo('zzqqxwv').length===0;
   ixAbrirBusqueda(); await wait(120);
   ixPintarBusqueda('zzqqxwv'); await wait(120);
   o.pintaSinResultados = /Sin resultados/.test(document.getElementById('ix-busq-res').innerHTML);

   // --- lo que empieza igual va primero ---
   const rr=ixBuscarTodo('mapas');
   o.primeroExacto = rr.length>0 && rr[0].titulo==='Mapas';

   // --- como mucho 6 por grupo ---
   const c={}; ixBuscarTodo('a').forEach(x=>{c[x.grupo]=(c[x.grupo]||0)+1;});
   o.maxSeisPorGrupo = Object.keys(c).every(k=>c[k]<=6);
   o.hayVariosGrupos = Object.keys(c).length>=3;

   // --- elegir un resultado HACE la acción ---
   let abrio=false; const om=window.openAppleMaps; window.openAppleMaps=function(){abrio=true;};
   ixPintarBusqueda('mapas'); await wait(100);
   const iMapas=_ixBusqRes.findIndex(x=>x.grupo==='Apps' && x.titulo==='Mapas');
   ixBusquedaIr(iMapas); await wait(250);
   window.openAppleMaps=om;
   o.abreLaApp = abrio===true;
   o.seCierraAlElegir = getComputedStyle(document.getElementById('ix-busqueda')).display==='none';

   // --- una ciudad se añade de verdad al reloj mundial ---
   const antes=_icaWorldClocks.length;
   ixAbrirBusqueda(); ixPintarBusqueda('tokio'); await wait(120);
   const iTok=_ixBusqRes.findIndex(x=>x.grupo==='Reloj mundial');
   ixBusquedaIr(iTok); await wait(300);
   o.anadeCiudad = _icaWorldClocks.length===antes+1;
   o.abreElReloj = document.getElementById('ios-clock-app').classList.contains('open');

   // --- un ajuste abre Configuración en su pestaña y lo señala ---
   ixAbrirBusqueda(); ixPintarBusqueda('barra de apps'); await wait(120);
   const iAj=_ixBusqRes.findIndex(x=>x.grupo==='Configuración');
   o.hayAjuste = iAj>=0;
   const idAj=iAj>=0?_ixBusqRes[iAj]:null;
   if(iAj>=0) ixBusquedaIr(iAj);
   await wait(700);
   o.abreConfig = document.getElementById('left-sidebar').classList.contains('open');
   o.senalaElAjuste = !!document.querySelector('#left-sidebar [style*="rgba(10, 132, 255"]');
   try{ if(isSidebarVisible) toggleSidebar(); }catch(e){}

   // --- el texto de una nota no puede ejecutar código ---
   let ejecuto=false; window.__busqXSS=()=>{ejecuto=true;};
   notes.push({id:'n-test-2',content:'<img src=x onerror="window.__busqXSS()">',updatedAt:Date.now()});
   ixAbrirBusqueda(); ixPintarBusqueda('img'); await wait(400);
   o.notaEscapada = ejecuto===false;
   o.saleLaNotaMaliciosa = /&lt;img/.test(document.getElementById('ix-busq-res').innerHTML);
   ixCerrarBusqueda();
   notes.length=0;

   // --- cada grupo sale UNA vez, todo junto ---
   ixAbrirBusqueda(); ixPintarBusqueda('can'); await wait(300);
   const cabs=[].slice.call(document.querySelectorAll('#ix-busq-res > div'))
     .filter(d=>/letter-spacing:1px/.test(d.getAttribute('style')||''))
     .map(d=>d.textContent.trim());
   o.cabeceras = cabs.join('|');
   o.gruposUnaVez = cabs.length === new Set(cabs).size;
   // --- el nombre del reloj no se pega a su vista previa ---
   const rel=ixBuscarTodo('candy').filter(x=>x.grupo==='Relojes');
   o.tituloReloj = rel.length?rel[0].titulo:'(ninguno)';
   o.tituloLimpio = rel.length ? !/^\d{1,2}:\d{2}\S/.test(rel[0].titulo) : true;
   ixCerrarBusqueda();

   // --- las tildes no estorban ---
   o.sinTildes = ixBuscarTodo('cancun').some(x=>x.titulo==='Cancún')
              && ixBuscarTodo('CANCÚN').some(x=>x.titulo==='Cancún');

   // --- los ajustes se leen del DOM, no de una lista a mano ---
   const idx=_ixIndiceAjustes();
   o.indiceAjustes = idx.length>=5;
   o.ajustesConPestana = idx.every(x=>x.tab && x.titulo && x.id);
   return o;
 });

 const pruebas=[
  ['hay botón en el dock',          hayBoton===1,             hayBoton],
  ['el botón abre y enfoca',        abreConBoton===true,      abreConBoton],
  ['escribir da resultados',        conTexto.n>0,             conTexto.n+' filas'],
  ['el primero viene resaltado',    /rgba\(10, ?132, ?255/.test(conTexto.resaltado), conTexto.resaltado.slice(-40)],
  ['la flecha baja mueve',          bajo===1,                 bajo],
  ['Esc cierra',                    cierraConEsc===true,      cierraConEsc],
  ['Ctrl+K abre',                   abreCtrlK===true,         abreCtrlK],
  ['encuentra apps',                r.gApps===true,           r.gApps],
  ['encuentra ciudades',            r.gCiudad===true,         r.gCiudad],
  ['encuentra ajustes',             r.gAjustes===true,        r.gAjustes],
  ['encuentra estilos de reloj',    r.gRelojes===true,        r.gRelojes],
  ['encuentra notas por el título', r.gNotas===true,          r.gNotas],
  ['encuentra notas por el cuerpo', r.notaPorElCuerpo===true, r.notaPorElCuerpo],
  ['vacío no busca nada',           r.vacioNoBusca===true,    r.vacioNoBusca],
  ['sin resultados da lista vacía', r.sinResultados===true,   r.sinResultados],
  ['y lo dice en pantalla',         r.pintaSinResultados===true, r.pintaSinResultados],
  ['lo exacto va primero',          r.primeroExacto===true,   r.primeroExacto],
  ['máximo 6 por grupo',            r.maxSeisPorGrupo===true, r.maxSeisPorGrupo],
  ['mezcla varios grupos',          r.hayVariosGrupos===true, r.hayVariosGrupos],
  ['elegir ABRE la app',            r.abreLaApp===true,       r.abreLaApp],
  ['se cierra al elegir',           r.seCierraAlElegir===true,r.seCierraAlElegir],
  ['añade la ciudad de verdad',     r.anadeCiudad===true,     r.anadeCiudad],
  ['y abre el reloj',               r.abreElReloj===true,     r.abreElReloj],
  ['encuentra el ajuste',           r.hayAjuste===true,       r.hayAjuste],
  ['abre Configuración',            r.abreConfig===true,      r.abreConfig],
  ['señala el ajuste',              r.senalaElAjuste===true,  r.senalaElAjuste],
  ['la nota no ejecuta código',     r.notaEscapada===true,    r.notaEscapada],
  ['la nota sale escapada',         r.saleLaNotaMaliciosa===true, r.saleLaNotaMaliciosa],
  ['cada grupo sale una sola vez',  r.gruposUnaVez===true,    r.cabeceras],
  ['el nombre del reloj va limpio', r.tituloLimpio===true,    r.tituloReloj],
  ['«cancun» encuentra «Cancún»',   r.sinTildes===true,       r.sinTildes],
  ['índice de ajustes del DOM',     r.indiceAjustes===true,   r.indiceAjustes],
  ['cada ajuste sabe su pestaña',   r.ajustesConPestana===true, r.ajustesConPestana],
  ['sin errores de página',         errs.length===0,          errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
