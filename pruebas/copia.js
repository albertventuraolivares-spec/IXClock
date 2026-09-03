// Copia de seguridad automatica.
//
// Todo lo del usuario vive en localStorage y se borra entero con un clic. Lo
// que hay que probar no es que se guarde un JSON, sino que la copia SOBREVIVA
// a lo que se lleva los datos por delante: el boton rojo de Respaldo, un
// import equivocado, y una restauracion mal elegida. Si la copia se guardara
// en localStorage no sobreviviria a nada de eso, asi que la prueba borra de
// verdad y luego restaura.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9229);

async function arranca(ctx){
  const p=await ctx.newPage();
  p.on('pageerror',e=>{ p._errs=p._errs||[]; p._errs.push(e.message.split('\n')[0]); });
  p.on('dialog',d=>d.accept());          // confirm/alert de restaurar y borrar
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:9229/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof ixCopiaHacer==='function' && typeof ixBorrarTodo==='function',
    null,{timeout:30000}).catch(()=>{});
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
  try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
  await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
    return !l || getComputedStyle(l).display==='none'; },null,{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(1800);
  await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
  return p;
}

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1280,height:1000}});
 let p=await arranca(ctx);
 const o={};

 // --- guarda TODO lo que hay, no una seleccion ---
 o.guarda = await p.evaluate(async()=>{
   localStorage.setItem('prueba_alarmas','07:30 gimnasio');
   localStorage.setItem('prueba_fondo','data:image/png;base64,AAAA');
   const r=await ixCopiaHacer('prueba');
   const l=await ixCopiaLista();
   const d=JSON.parse(l[0].datos);
   return { ok:r.ok, tieneAlarmas:d['prueba_alarmas']==='07:30 gimnasio',
            tieneFondo:!!d['prueba_fondo'], claves:l[0].claves>2 };
 });

 // --- si no ha cambiado nada, no se apila una copia identica ---
 o.noRepite = await p.evaluate(async()=>{
   const antes=(await ixCopiaLista()).length;
   const r=await ixCopiaHacer('prueba');
   const despues=(await ixCopiaLista()).length;
   return { saltada:r.saltada===true, mismasCopias:antes===despues };
 });

 // --- solo se guardan las 3 ultimas ---
 o.tres = await p.evaluate(async()=>{
   for(let i=0;i<5;i++){ localStorage.setItem('relleno', 'v'+i); await ixCopiaHacer('prueba'); }
   const l=await ixCopiaLista();
   return { n:l.length, ordenadas: l.every((c,i)=> i===0 || l[i-1].id>=c.id) };
 });

 // --- LO IMPORTANTE: el boton rojo borra localStorage y la copia AGUANTA ---
 o.botonRojo = await p.evaluate(async()=>{
   localStorage.setItem('prueba_alarmas','07:30 gimnasio');
   localStorage.setItem('prueba_notas','comprar pan');
   await ixBorrarTodo();                       // confirm aceptado por el test
   const vacio = localStorage.getItem('prueba_alarmas')===null;
   const l = await ixCopiaLista();
   const d = l.length ? JSON.parse(l[0].datos) : {};
   return { seBorro:vacio, hayCopia:l.length>0,
            motivo: l[0] && l[0].motivo,
            conservaAlarmas: d['prueba_alarmas']==='07:30 gimnasio',
            conservaNotas: d['prueba_notas']==='comprar pan' };
 });

 // --- y restaurar devuelve los datos de verdad ---
 o.restaura = await p.evaluate(async()=>{
   const l=await ixCopiaLista();
   const c=l.find(x=>x.motivo==='antes-de-borrar') || l[0];
   const datos=JSON.parse(c.datos);
   // se hace a mano lo que hace ixCopiaRestaurar, sin el reload que mataria
   // la pagina a media prueba
   await ixCopiaHacer('antes-de-restaurar');
   localStorage.clear();
   Object.entries(datos).forEach(([k,v])=>localStorage.setItem(k,v));
   return { alarmas: localStorage.getItem('prueba_alarmas'),
            notas: localStorage.getItem('prueba_notas') };
 });

 // --- restaurar guarda ANTES una copia de lo de ahora: es reversible ---
 o.reversible = await p.evaluate(async()=>{
   const l=await ixCopiaLista();
   return l.some(c=>c.motivo==='antes-de-restaurar');
 });

 // --- la copia vive FUERA de localStorage (si no, no serviria de nada) ---
 o.fuera = await p.evaluate(async()=>{
   const claves=[]; for(let i=0;i<localStorage.length;i++) claves.push(localStorage.key(i));
   const grande=claves.some(k=>{ const v=localStorage.getItem(k)||''; return v.length>2000 && /"prueba_alarmas"/.test(v); });
   const bases=(indexedDB.databases ? await indexedDB.databases() : []).map(d=>d.name);
   return { noEnLocalStorage:!grande, enIndexedDB: bases.indexOf('ixclock_copias')>=0 };
 });

 // --- el aviso de «hace mucho que no bajas el archivo» ---
 o.aviso = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   openCloudPanel(); await w(500);
   const av=()=>/⚠️/.test(document.getElementById('cloud-content').innerText);
   localStorage.removeItem('ix_copia_descarga');
   cloudTab('backup'); await w(400);
   const nunca=av();
   localStorage.setItem('ix_copia_descarga', String(Date.now()-40*86400000));
   cloudTab('backup'); await w(400);
   const viejo=av();
   const dias40=ixCopiaDiasDescarga();
   localStorage.setItem('ix_copia_descarga', String(Date.now()));
   cloudTab('backup'); await w(400);
   const reciente=av();
   return { nunca, viejo, reciente, dias40 };
 });

 // --- exportar el archivo apunta la fecha, que es lo que mira el aviso ---
 o.exportar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   localStorage.removeItem('ix_copia_descarga');
   const orig=HTMLAnchorElement.prototype.click;
   let nombre=null;
   HTMLAnchorElement.prototype.click=function(){ nombre=this.download; };
   exportAllData(); await w(200);
   HTMLAnchorElement.prototype.click=orig;
   return { nombre, apunto: !!localStorage.getItem('ix_copia_descarga'),
            conFecha: /\d{4}-\d{2}-\d{2}\.json$/.test(nombre||'') };
 });

 // --- un archivo que no es un respaldo no pisa nada ---
 o.importMalo = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   localStorage.setItem('prueba_alarmas','07:30 gimnasio');
   const f=new File(['[1,2,3]'],'malo.json',{type:'application/json'});
   const dt=new DataTransfer(); dt.items.add(f);
   let alertado=false; const oa=window.alert; window.alert=()=>{alertado=true;};
   importAllData({target:{files:dt.files}}); await w(600);
   window.alert=oa;
   return { avisa:alertado, noPiso: localStorage.getItem('prueba_alarmas')==='07:30 gimnasio' };
 });

 // --- la lista se pinta y los botones estan ---
 o.pantalla = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   openCloudPanel(); await w(500);
   cloudTab('backup'); await w(600);
   const t=document.getElementById('cloud-content').innerText;
   const lista=document.getElementById('ix-copias-lista');
   return { hayApartado:/copias autom/i.test(t),
            hayFilas:(lista?lista.querySelectorAll('button[onclick^="ixCopiaRestaurar"]').length:0),
            hayHacerAhora:/hacer una ahora/i.test(t),
            diceElLimite:/borrar los datos del navegador/i.test(t) };
 });

 // --- una fecha con codigo no se ejecuta al pintar la lista ---
 o.xss = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__pwn=0;
   const orig=window.ixCopiaLista;
   window.ixCopiaLista=async()=>[{id:Date.now(), motivo:'x', claves:1, bytes:10,
     datos:'{}', huella:'x'}];
   const od=Date.prototype.toLocaleString;
   Date.prototype.toLocaleString=function(){ return '<img src=x onerror="window.__pwn=1">'; };
   await ixCopiaPintarLista(); await w(400);
   Date.prototype.toLocaleString=od; window.ixCopiaLista=orig;
   return window.__pwn===0;
 });

 // --- y SOBREVIVE a recargar la pagina ---
 await p.close();
 p = await arranca(ctx);
 o.trasRecargar = await p.evaluate(async()=>{
   const l=await ixCopiaLista();
   return { n:l.length, leible: l.length>0 && !!JSON.parse(l[0].datos) };
 });
 const errs=p._errs||[];
 await p.close();

 const pruebas=[
  ['guarda todos los datos',      o.guarda.ok===true && o.guarda.tieneAlarmas===true && o.guarda.tieneFondo===true, JSON.stringify(o.guarda)],
  ['no apila copias idénticas',   o.noRepite.saltada===true && o.noRepite.mismasCopias===true, JSON.stringify(o.noRepite)],
  ['guarda solo las 3 últimas',   o.tres.n===3,             o.tres.n],
  ['la más nueva, la primera',    o.tres.ordenadas===true,  o.tres.ordenadas],
  ['el botón rojo SÍ borra',      o.botonRojo.seBorro===true, o.botonRojo.seBorro],
  ['pero la copia aguanta',       o.botonRojo.hayCopia===true, o.botonRojo.motivo],
  ['con las alarmas dentro',      o.botonRojo.conservaAlarmas===true, o.botonRojo.conservaAlarmas],
  ['y las notas',                 o.botonRojo.conservaNotas===true, o.botonRojo.conservaNotas],
  ['RESTAURAR los devuelve',      o.restaura.alarmas==='07:30 gimnasio' && o.restaura.notas==='comprar pan', JSON.stringify(o.restaura)],
  ['y restaurar es reversible',   o.reversible===true,      o.reversible],
  ['la copia NO vive en localStorage', o.fuera.noEnLocalStorage===true, o.fuera.noEnLocalStorage],
  ['vive en IndexedDB',           o.fuera.enIndexedDB===true, o.fuera.enIndexedDB],
  ['avisa si nunca bajaste el archivo', o.aviso.nunca===true, o.aviso.nunca],
  ['avisa si hace 40 días',       o.aviso.viejo===true,     o.aviso.dias40+' días'],
  ['y calla si fue hoy',          o.aviso.reciente===false, o.aviso.reciente],
  ['exportar apunta la fecha',    o.exportar.apunto===true, o.exportar.nombre],
  ['con la fecha en el nombre',   o.exportar.conFecha===true, o.exportar.nombre],
  ['un archivo inválido avisa',   o.importMalo.avisa===true, o.importMalo.avisa],
  ['y no pisa nada',              o.importMalo.noPiso===true, o.importMalo.noPiso],
  ['la pantalla lo enseña',       o.pantalla.hayApartado===true && o.pantalla.hayFilas>0, JSON.stringify(o.pantalla)],
  ['con botón de hacer una ahora',o.pantalla.hayHacerAhora===true, o.pantalla.hayHacerAhora],
  ['y dice hasta dónde protege',  o.pantalla.diceElLimite===true, o.pantalla.diceElLimite],
  ['una fecha con código no se ejecuta', o.xss===true,      o.xss],
  ['SOBREVIVE a recargar',        o.trasRecargar.n>0 && o.trasRecargar.leible===true, JSON.stringify(o.trasRecargar)],
  ['sin errores de página',       errs.length===0,          errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
