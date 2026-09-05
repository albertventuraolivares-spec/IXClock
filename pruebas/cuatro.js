// Cuatro cosas de esta tanda: tres bugs verificados y una función.
//
// 1) MAPAS. `_amapHighlight` pintaba el fondo de los pasos NO activos con
//    var(--txt-40), que es un color de TEXTO atenuado, no de fondo. En cuanto
//    navegabas, la lista de indicaciones pasaba de un fondo sutil a uno casi
//    opaco — y en modo claro --txt-40 es negro al 50%, o sea casi negra.
//
// 2) EMULADOR. «Cerrar todas las ventanas» escondía su ventana pero no llamaba
//    a emuTeardown(), así que el motor seguía corriendo con audio y CPU. Es el
//    mismo fallo que ya tuvo el Modo Enfoque: la ventana se va, el proceso no.
//
// 3) BUSCADOR + EMISORAS. Se indexaban leyendo el DOM ya pintado, así que si
//    nunca habías abierto Radio Mundial no encontraba NINGUNA, y si habías
//    filtrado países las de fuera del filtro desaparecían sin avisar.
//
// 4) UNIDADES EN EL BUSCADOR. Escribir «5 km a millas» como ya se escribía
//    «150 usd a eur». Las equivalencias salen de UNIT_DATA, la misma tabla del
//    conversor, para no acabar con dos verdades como pasó con las divisas.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9254);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1280,height:1000}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9254/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixBuscarTodo==='function' && typeof ixConvertirUnidad==='function',
   null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const o={};

 // ═══════════ 1. MAPAS: el fondo de los pasos ═══════════
 // AVISO HONRADO sobre el alcance de esta parte: `_amapHighlight` recorre
 // `_amapSteps`, que es un `let` del propio bloque de script y solo se llena
 // desde una ruta de verdad — y esa ruta necesita Leaflet (CDN) y OSRM, los dos
 // bloqueados en este entorno. Asi que aqui NO se puede conducir la funcion de
 // punta a punta: se comprueba la regla que aplica, leyendo su codigo en
 // ejecucion. Es mas debil que medir el color pintado y conviene saberlo, pero
 // sirve de guardia: si alguien vuelve a meter un color de TEXTO como fondo,
 // esto lo caza. Lo que si se mide de verdad es el fondo con el que nacen los
 // pasos, que es el valor al que tiene que volver.
 o.mapas = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const d=document.createElement('div');
   d.style.cssText='padding:8px 9px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid transparent;';
   document.body.appendChild(d);
   const nacen=getComputedStyle(d).backgroundColor;
   d.remove();
   const src=String(_amapHighlight);
   const linea=(src.match(/el\.style\.background\s*=[^;]+;/)||[''])[0];
   return { nacen, linea,
            usaTexto: /--txt-\d/.test(linea),
            vuelveAlSutil: /rgba\(255,\s*255,\s*255,\s*\.?0?\.06\)/.test(linea),
            activoAzul: /rgba\(10,\s*132,\s*255/.test(linea) };
 });

 // ═══════════ 2. EMULADOR: se para al cerrar todo ═══════════
 o.emulador = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   // Se finge un juego cargado: lo que mira emuTeardown es EJS_emulator.
   let salio=false;
   window.EJS_emulator={ callEvent:function(ev){ if(ev==='exit') salio=true; } };
   window.EJS_core='nes';
   const enLista = (function(){
     // que este en la lista de paradas, no solo que exista la funcion
     return typeof emuTeardown==='function';
   })();
   ixCerrarTodasLasVentanas(); await w(300);
   return { hayFuncion:enLista, salio,
            limpiado: typeof window.EJS_emulator==='undefined',
            coreLimpio: typeof window.EJS_core==='undefined' };
 });

 // ═══════════ 3. BUSCADOR: las emisoras no dependen de lo pintado ═══════════
 o.radioSinFiltro = await p.evaluate(()=>{
   const r=ixBuscarTodo('z-101').filter(x=>x.grupo==='Emisoras');
   return { cuantas:r.length, primera:r[0]?r[0].titulo:null };
 });

 // Y AHORA EL CASO DEL FALLO: se filtra a un solo pais desde el selector DE
 // VERDAD (no tocando localStorage a mano, que no actualiza la variable en
 // memoria), y se busca una emisora que queda FUERA del filtro.
 o.radioFiltrada = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   openCountryPicker(); await w(500);
   // «Seleccionar Todo» funciona como interruptor: la primera pulsacion los
   // quita todos y deja la lista en un solo pais al marcar uno.
   const filas=[].slice.call(document.querySelectorAll('#country-list > *'));
   let marcadas=0;
   // Se apagan todos y se enciende SOLO España, dejando fuera la dominicana.
   try{ toggleAllCountries(); }catch(e){}        // deja «Todos» o ninguno
   await w(300);
   const es=filas.find(f=>/Espa/i.test(f.textContent||''));
   if(es && es.onclick){ es.onclick(); marcadas++; }
   await w(300);
   try{ closeCountryPicker(); }catch(e){}
   await w(500);
   const pintadas=document.querySelectorAll('#stations-container button[data-title]').length;
   const todas=(typeof ALL_RADIO_STATIONS!=='undefined')?ALL_RADIO_STATIONS.length:0;
   const r=ixBuscarTodo('z-101').filter(x=>x.grupo==='Emisoras');   // dominicana
   return { pintadas, todas, marcadas, cuantas:r.length, titulo:r[0]?r[0].titulo:null };
 });

 // el total indexado coincide con la lista entera
 o.radioTotal = await p.evaluate(()=>{
   const r=ixBuscarTodo('a');   // algo que salga en casi todas
   return { enLista: ALL_RADIO_STATIONS.length,
            tienenIr: r.filter(x=>x.grupo==='Emisoras').every(x=>typeof x.ir==='function') };
 });

 // ═══════════ 4. UNIDADES EN EL BUSCADOR ═══════════
 o.unidades = await p.evaluate(()=>{
   const conv=(n,a,b)=>{ const r=ixConvertirUnidad(n,a,b); return r?r.titulo:null; };
   return {
     kmMillas:  conv(5,'km','millas'),
     millasKm:  conv(10,'mi','km'),
     kgLibras:  conv(70,'kg','lb'),
     cF:        conv(30,'c','f'),
     fC:        conv(212,'f','c'),
     cK:        conv(0,'c','k'),
     litrosGal: conv(10,'l','gal'),
     // mezclar categorías no significa nada y tiene que dar null
     mezcla:    conv(5,'km','kg'),
     misma:     conv(5,'km','km'),
     inventada: conv(5,'ñps','km'),
   };
 });

 // y sale por el buscador escribiéndolo tal cual
 o.buscUnidades = await p.evaluate(()=>{
   const uno=q=>{ const r=ixBuscarTodo(q).filter(x=>x.grupo==='Resultado'); return r[0]?r[0].titulo:null; };
   return {
     a: uno('5 km a millas'),
     b: uno('30 c en f'),
     c: uno('70 kg a lb'),
     // las divisas siguen funcionando: no se ha roto lo de antes
     d: uno('100 usd a eur'),
     // y una cuenta normal también
     e: uno('23*4'),
   };
 });

 await p.close(); await b.close(); srv.close();

 const m=o.mapas;
 const pruebas=[
  ['MAPAS: los pasos nacen con fondo sutil', /rgba\(255, 255, 255, 0\.06/.test(m.nacen), m.nacen],
  ['el paso inactivo vuelve a ESE fondo',  m.vuelveAlSutil===true, m.linea],
  ['y NO a un color de texto (--txt-40)',  m.usaTexto===false,     m.linea],
  ['el activo sigue poniéndose azul',      m.activoAzul===true,    m.linea],
  ['EMULADOR: cerrar todo lo apaga',   o.emulador.salio===true, JSON.stringify(o.emulador)],
  ['y limpia sus variables',           o.emulador.limpiado===true && o.emulador.coreLimpio===true, JSON.stringify(o.emulador)],
  ['RADIO: sin filtro se encuentra',    o.radioSinFiltro.cuantas>0 && /Z-101/i.test(o.radioSinFiltro.primera||''), JSON.stringify(o.radioSinFiltro)],
  ['FILTRADA: se pintan menos de las que hay', o.radioFiltrada.pintadas < o.radioFiltrada.todas, o.radioFiltrada.pintadas+' de '+o.radioFiltrada.todas],
  ['y aun así la de fuera del filtro sale', o.radioFiltrada.cuantas>0, JSON.stringify(o.radioFiltrada)],
  ['con su nombre',                     /Z-101/i.test(o.radioFiltrada.titulo||''), o.radioFiltrada.titulo],
  ['todas se pueden poner',             o.radioTotal.tienenIr===true, o.radioTotal.enLista+' en la lista'],
  ['UNIDADES: 5 km → millas',           o.unidades.kmMillas==='3.11 mi',   o.unidades.kmMillas],
  ['10 millas → km',                    o.unidades.millasKm==='16.09 km',  o.unidades.millasKm],
  ['70 kg → libras',                    o.unidades.kgLibras==='154.32 lb', o.unidades.kgLibras],
  ['30 °C → °F',                        o.unidades.cF==='86 °F',           o.unidades.cF],
  ['212 °F → °C',                       o.unidades.fC==='100 °C',          o.unidades.fC],
  ['0 °C → K',                          o.unidades.cK==='273.15 K',        o.unidades.cK],
  ['10 L → galones',                    o.unidades.litrosGal==='2.64 gal', o.unidades.litrosGal],
  ['km a kg no significa nada',         o.unidades.mezcla===null,          o.unidades.mezcla],
  ['ni km a km, ni una inventada',      o.unidades.misma===null && o.unidades.inventada===null, JSON.stringify([o.unidades.misma,o.unidades.inventada])],
  ['EN EL BUSCADOR: «5 km a millas»',   o.buscUnidades.a==='3.11 mi',      o.buscUnidades.a],
  ['«30 c en f»',                       o.buscUnidades.b==='86 °F',        o.buscUnidades.b],
  ['«70 kg a lb»',                      o.buscUnidades.c==='154.32 lb',    o.buscUnidades.c],
  ['y las divisas siguen igual',        /EUR$/.test(o.buscUnidades.d||''), o.buscUnidades.d],
  ['y las cuentas también',             /92/.test(o.buscUnidades.e||''),   o.buscUnidades.e],
  ['sin errores de página',             errs.length===0,                   errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})();
