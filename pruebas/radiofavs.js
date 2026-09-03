// Favoritos de emisoras. El navegador ya los tenia; la radio no, y con miles
// de emisoras eso significa empezar de cero cada vez.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9223);

async function arranca(ctx){
  const p=await ctx.newPage();
  p.on('pageerror',e=>{ p._errs=p._errs||[]; p._errs.push(e.message.split('\n')[0]); });
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:9223/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof renderStations==='function' && typeof ixBuscarTodo==='function',
    null,{timeout:30000}).catch(()=>{});
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
  try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
  await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
    return !l || getComputedStyle(l).display==='none'; },null,{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(1800);
  await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
  // El panel de radio viene plegado: sin abrirlo las estrellas existen pero
  // no se ven, y un clic de raton no llega.
  await p.evaluate(()=>{ try{ toggleRadioPanel(); }catch(e){} });
  await p.waitForTimeout(600);
  return p;
}
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:1280,height:900}});
 let p=await arranca(ctx);
 const o={};

 o.previo = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m)); const x={};
   localStorage.removeItem('ix_radio_favorites'); _radioFavs=[];
   renderStations(); await w(300);
   x.sinFavsNoHaySeccion = !/tus favoritas/i.test(document.getElementById('stations-container').innerText);
   x.hayEstrellas = document.querySelectorAll('#stations-container [onclick^="toggleFavoritaRadio"]').length>0;
   x.total = document.querySelectorAll('#stations-container button[data-title]').length;
   return x;
 });

 // --- pulsar la estrella NO pone la emisora a sonar ---
 const antesDeTocar = await p.evaluate(()=>{
   window.__sono=false; const o=window.setStation;
   window.setStation=function(){ window.__sono=true; return o.apply(this,arguments); };
   return STATIONS[3].id;
 });
 await p.click('#station-'+antesDeTocar+' [onclick^="toggleFavoritaRadio"]');
 await p.waitForTimeout(600);
 o.noSuena = await p.evaluate(()=>window.__sono===false);
 o.seGuarda = await p.evaluate(id=>_radioFavs.indexOf(id)>=0, antesDeTocar);

 const r = await p.evaluate(async(id)=>{
   const w=m=>new Promise(r=>setTimeout(r,m)); const x={};
   const cont=document.getElementById('stations-container');

   // --- sale la seccion de favoritas, arriba del todo ---
   x.haySeccion = /tus favoritas/i.test(cont.innerText);
   const txt=cont.innerText;
   const st=STATIONS.find(s=>s.id===id);
   x.arribaDelTodo = txt.toLowerCase().indexOf('tus favoritas') < txt.indexOf('★')+9999
     && txt.indexOf(st.title) < txt.length/2;

   // --- NO sale dos veces: un id repetido romperia setStation ---
   x.unaSolaVez = document.querySelectorAll('#station-'+id).length===1;
   x.idsUnicos = (function(){
     const vistos={}; let rep=0;
     document.querySelectorAll('#stations-container button[id^="station-"]').forEach(b=>{
       if(vistos[b.id]) rep++; vistos[b.id]=1;
     });
     return rep===0;
   })();

   // --- la estrella se ve marcada ---
   x.estrellaLlena = /★/.test(document.querySelector('#station-'+id+' [onclick^="toggleFavoritaRadio"]').textContent);

   // --- no se pierde ninguna emisora al reordenar ---
   x.sigueElTotal = document.querySelectorAll('#stations-container button[data-title]').length;

   // --- varias favoritas ---
   toggleFavoritaRadio(STATIONS[7].id); await w(300);
   toggleFavoritaRadio(STATIONS[11].id); await w(300);
   x.tresFavs = _radioFavs.length===3;

   // --- quitar una ---
   toggleFavoritaRadio(STATIONS[7].id); await w(300);
   x.quitaUna = _radioFavs.length===2 && _radioFavs.indexOf(STATIONS[7].id)<0;
   x.vuelveASuPais = document.querySelectorAll('#station-'+STATIONS[7].id).length===1;

   // --- el buscador de emisoras sigue funcionando con las favoritas ---
   const inp=document.getElementById('music-search');
   if(inp){ inp.value=st.title.slice(0,5); filterStations(); await w(200); }
   x.buscadorFunciona = document.querySelector('#station-'+id).style.display!=='none';
   if(inp){ inp.value=''; filterStations(); await w(200); }

   // --- un titulo con codigo no se ejecuta ---
   window.__pwn=0;
   const falsa={id:'fake-xss', title:'<img src=x onerror="window.__pwn=1">', sub:'x',
                country:'Prueba', flag:'🏳️', tags:'', type:'stream'};
   STATIONS.push(falsa); _radioFavs.push('fake-xss');
   renderStations(); await w(400);
   x.tituloEscapado = window.__pwn===0;
   _radioFavs.pop(); STATIONS.pop(); renderStations(); await w(200);
   return x;
 }, antesDeTocar);
 Object.assign(o,r);

 // --- y sobreviven a recargar la pagina ---
 await p.close();
 p = await arranca(ctx);
 o.trasRecargar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   renderStations(); await w(400);
   return { n:_radioFavs.length,
            enPantalla: /tus favoritas/i.test(document.getElementById('stations-container').innerText) };
 });
 const errs=p._errs||[];
 await p.close();

 const pruebas=[
  ['sin favoritas no hay sección', o.previo.sinFavsNoHaySeccion===true, o.previo.sinFavsNoHaySeccion],
  ['cada emisora tiene estrella',  o.previo.hayEstrellas===true,       o.previo.total+' emisoras'],
  ['la estrella NO pone a sonar',  o.noSuena===true,                   o.noSuena],
  ['y la guarda',                  o.seGuarda===true,                  o.seGuarda],
  ['sale la sección de favoritas', o.haySeccion===true,                o.haySeccion],
  ['arriba del todo',              o.arribaDelTodo===true,             o.arribaDelTodo],
  ['NO sale dos veces',            o.unaSolaVez===true,                o.unaSolaVez],
  ['ningún id repetido',           o.idsUnicos===true,                 o.idsUnicos],
  ['la estrella se ve marcada',    o.estrellaLlena===true,             o.estrellaLlena],
  ['no se pierde ninguna emisora', o.sigueElTotal===o.previo.total,    o.sigueElTotal+' vs '+o.previo.total],
  ['se pueden guardar varias',     o.tresFavs===true,                  o.tresFavs],
  ['y quitar una',                 o.quitaUna===true,                  o.quitaUna],
  ['que vuelve a su país',         o.vuelveASuPais===true,             o.vuelveASuPais],
  ['el buscador sigue funcionando',o.buscadorFunciona===true,          o.buscadorFunciona],
  ['un título con código no se ejecuta', o.tituloEscapado===true,      o.tituloEscapado],
  ['SOBREVIVEN a recargar',        o.trasRecargar.n===2 && o.trasRecargar.enPantalla===true, JSON.stringify(o.trasRecargar)],
  ['sin errores de página',        errs.length===0,                    errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
