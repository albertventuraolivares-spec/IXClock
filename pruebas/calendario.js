// Los eventos del Calendario, en el buscador y en la franja de resumen.
//
// El buscador promete «buscar en todo: apps, ajustes, notas, ciudades, fondos y
// emisoras» y los eventos que TÚ escribes eran lo único que se dejaba fuera.
// Y la franja de resumen junta clima, alarma, festividad y luna —datos que
// viven en otras apps y que si no hay que ir a buscar uno por uno—, pero
// tampoco miraba el Calendario.
//
// Ojo con un detalle de scope que podía romperlo sin avisar: `calEvts` es un
// `let` de su bloque de <script>, y el buscador vive en OTRO bloque. Por eso
// `ixEventosCal()` se define junto a `calEvts` y se llama desde fuera: las
// declaraciones de función sí cruzan bloques, las de `let` no. La prueba lo
// comprueba en ejecución en vez de darlo por hecho.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9256);

// Fechas relativas a HOY, para que la prueba no caduque con el calendario.
const hoy=new Date();
const clave=d=>{ const x=new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate()+d);
  return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); };

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1280,height:1000}});
 // Eventos ya guardados ANTES de que cargue la app: calEvts se lee al arrancar.
 await ctx.addInitScript(([ayer,hoyK,manana,lejos])=>{
   localStorage.setItem('cal_events', JSON.stringify({
     [ayer]:   ['Cosa vieja que ya pasó'],
     [hoyK]:   ['Dentista a las 5'],
     [manana]: ['Cumpleaños de Ana'],
     [lejos]:  ['Vuelo a Madrid'],
     'basura': ['clave con mala pinta'],
   }));
 }, [clave(-3), clave(0), clave(1), clave(20)]);
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9256/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixEventosCal==='function' && typeof ixBuscarTodo==='function',
   null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const o={};

 // ═══ LEER LOS EVENTOS: en orden, y sin tragarse la clave inventada ═══
 o.lista = await p.evaluate(()=>{
   const l=ixEventosCal();
   return { cuantos:l.length, textos:l.map(x=>x.texto), claves:l.map(x=>x.clave) };
 });

 // ═══ EN EL BUSCADOR ═══
 o.buscar = await p.evaluate(()=>{
   const g=q=>ixBuscarTodo(q).filter(x=>x.grupo==='Calendario');
   const uno=g('dentista');
   return {
     dentista: uno.length,
     titulo:   uno[0]?uno[0].titulo:null,
     sub:      uno[0]?uno[0].sub:null,
     tieneIr:  uno[0]?typeof uno[0].ir==='function':false,
     ana:      g('cumpleaños').length,
     madrid:   g('madrid').length,
     // los pasados también se pueden buscar: un evento viejo sigue siendo tuyo
     vieja:    g('cosa vieja').length,
     nada:     g('zzzzzznoexiste').length,
   };
 });

 // y al elegirlo, abre el Calendario en ESE día
 o.ir = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const r=ixBuscarTodo('cumpleaños').filter(x=>x.grupo==='Calendario')[0];
   if(!r) return {hay:false};
   r.ir(); await w(700);
   const panel=document.getElementById('cal-panel');
   const etiqueta=(document.getElementById('cal-selected-label')||{}).textContent||'';
   const lista=(document.getElementById('cal-events-list')||{}).innerText||'';
   const abierto=panel && panel.style.opacity==='1';
   try{ toggleCalendar(); }catch(e){}
   await w(400);
   return { hay:true, abierto, etiqueta, lista, diaSel:calSelDay };
 });

 // ═══ LA QUINTA FICHA DE LA FRANJA ═══
 o.franja = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   ixPintarFranja(); await w(300);
   const el=document.getElementById('fr-evento');
   if(!el) return {hay:false};
   return { hay:true,
            visible: el.style.display!=='none',
            texto: el.innerText.replace(/\s+/g,' ').trim(),
            titulo: el.getAttribute('title')||'',
            pinchable: typeof el.onclick==='function',
            ir: el.getAttribute('data-ir') };
 });

 // el próximo es el de HOY, no el de pasado mañana ni el que ya pasó
 o.proximo = await p.evaluate(()=>{
   const e=ixProximoEvento();
   return e?{ texto:e.texto, cuando:ixCuandoEvento(e) }:null;
 });

 // y al pinchar la ficha se abre el Calendario en su día
 o.franjaIr = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const el=document.getElementById('fr-evento');
   if(!el || typeof el.onclick!=='function') return {hay:false};
   el.onclick(); await w(700);
   const abierto=(document.getElementById('cal-panel')||{}).style.opacity==='1';
   const lista=(document.getElementById('cal-events-list')||{}).innerText||'';
   try{ toggleCalendar(); }catch(e){}
   return { hay:true, abierto, lista };
 });

 // ═══ SIN EVENTOS NO SE INVENTA NADA ═══
 o.vacio = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const guardado=localStorage.getItem('cal_events');
   for(const k in calEvts) delete calEvts[k];
   ixPintarFranja(); await w(300);
   const el=document.getElementById('fr-evento');
   const r={ oculta: el ? el.style.display==='none' : true,
             enBusca: ixBuscarTodo('dentista').filter(x=>x.grupo==='Calendario').length,
             proximo: ixProximoEvento() };
   try{ localStorage.setItem('cal_events', guardado); }catch(e){}
   return r;
 });

 // ═══ UN EVENTO CON CÓDIGO DENTRO NO SE EJECUTA ═══
 // El texto lo escribe el usuario y acaba en la franja, en el buscador y en la
 // lista del día. Tres sitios nuevos por donde podría colarse.
 o.xss = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__calXss=false;
   const hoyK=(function(){ const x=new Date();
     return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); })();
   calEvts[hoyK]=['<img src=x onerror="window.__calXss=true">'];
   ixPintarFranja(); await w(400);
   const franja=document.getElementById('fr-evento').innerHTML;
   const r=ixBuscarTodo('img').filter(x=>x.grupo==='Calendario')[0];
   if(r){ r.ir(); await w(700); }
   const listaHtml=(document.getElementById('cal-events-list')||{}).innerHTML||'';
   try{ toggleCalendar(); }catch(e){}
   await w(300);
   return { colado: window.__calXss===true,
            franjaCruda: /<img/i.test(franja),
            listaCruda: /<img/i.test(listaHtml),
            franjaEscapada: /&lt;img/i.test(franja) };
 });

 await p.close(); await b.close(); srv.close();

 const pruebas=[
  ['se leen los 4 eventos, no la clave inventada', o.lista.cuantos===4 && !o.lista.claves.includes('basura'), o.lista.cuantos+' · '+o.lista.claves.join(' ')],
  ['y salen en orden de fecha',      o.lista.textos[0]==='Cosa vieja que ya pasó' && o.lista.textos[3]==='Vuelo a Madrid', o.lista.textos.join(' | ')],
  ['BUSCADOR: encuentra el de hoy',  o.buscar.dentista===1 && o.buscar.titulo==='Dentista a las 5', JSON.stringify(o.buscar)],
  ['con su fecha y el cuándo',       /\d+\/\d+\/\d{4} · /.test(o.buscar.sub||'') && /Hoy/i.test(o.buscar.sub||''), o.buscar.sub],
  ['encuentra los otros',            o.buscar.ana===1 && o.buscar.madrid===1, o.buscar.ana+' '+o.buscar.madrid],
  ['y también los ya pasados',       o.buscar.vieja===1, o.buscar.vieja],
  ['no inventa resultados',          o.buscar.nada===0, o.buscar.nada],
  ['al elegirlo abre el Calendario', o.ir.abierto===true, JSON.stringify({a:o.ir.abierto,d:o.ir.diaSel})],
  ['en el día del evento',           /Cumpleaños de Ana/.test(o.ir.lista||''), (o.ir.lista||'').split('\n')[0]],
  ['con la fecha en el título',      /de \d{4}$/.test((o.ir.etiqueta||'').trim()), o.ir.etiqueta],
  ['FRANJA: sale la quinta ficha',   o.franja.hay===true && o.franja.visible===true, JSON.stringify(o.franja)],
  ['con el evento y el cuándo',      /Dentista/i.test(o.franja.texto||'') && /Hoy/i.test(o.franja.texto||''), o.franja.texto],
  ['el próximo es el de hoy',        o.proximo && o.proximo.texto==='Dentista a las 5', JSON.stringify(o.proximo)],
  ['el globito lleva la fecha entera', /Dentista a las 5 · \d+\/\d+\/\d{4}/.test(o.franja.titulo||''), o.franja.titulo],
  ['y al pincharla abre el día',     o.franjaIr.abierto===true && /Dentista/.test(o.franjaIr.lista||''), JSON.stringify(o.franjaIr)],
  ['SIN EVENTOS: la ficha se esconde',o.vacio.oculta===true,  o.vacio.oculta],
  ['y el buscador no saca nada',     o.vacio.enBusca===0 && o.vacio.proximo===null, JSON.stringify(o.vacio)],
  ['SEGURIDAD: no se ejecuta nada',  o.xss.colado===false,    'colado='+o.xss.colado],
  ['ni en la franja',                o.xss.franjaCruda===false && o.xss.franjaEscapada===true, JSON.stringify(o.xss)],
  ['ni en la lista del día',         o.xss.listaCruda===false, o.xss.listaCruda],
  ['sin errores de página',          errs.length===0,         errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})();
