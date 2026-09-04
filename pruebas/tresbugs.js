// Tres fallos que reporto el usuario, verificados aqui uno por uno.
//
// 1. El conmutador de 3 dedos ignoraba 6 de las 14 apps: las abrias y seguia
//    diciendo "todavia no abriste ninguna app", que era falso.
// 2. Las estaciones se calculaban dando por hecho el hemisferio norte: en
//    septiembre ponia OTONO, y en Argentina o Chile es primavera.
// 3. "Cerrar todas las ventanas" y Esc dejaban abiertas cuatro: Radio Mundial,
//    Apps de Musica, VPN y el Buscador de canales.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9240);

async function arranca(ctx){
  const p=await ctx.newPage();
  p.on('pageerror',e=>{ p._errs=p._errs||[]; p._errs.push(e.message.split('\n')[0]); });
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:9240/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof getSeason==='function' && typeof _wireAppSwitcherTracking==='function'
    && typeof ixAbrirEnfoque==='function', null,{timeout:30000}).catch(()=>{});
  await p.waitForTimeout(2500);
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
 // Hemisferio SUR: es lo que hacia mal la app.
 const sur=await b.newContext({viewport:{width:1280,height:1000}, timezoneId:'America/Argentina/Buenos_Aires'});
 let p=await arranca(sur);
 const o={};

 // ═══ 1. CONMUTADOR ═══
 o.registro = await p.evaluate(()=>{
   const ids=APP_SWITCHER_REGISTRY.map(a=>a.id);
   // cada entrada tiene que apuntar a una funcion que EXISTA: una mal escrita
   // se saltaria en silencio, que es justo lo que pasaba
   const rotas=APP_SWITCHER_REGISTRY.filter(a=>typeof window[a.fn]!=='function').map(a=>a.fn);
   return { n:ids.length, ids, rotas,
            enganchadas:Object.keys(_appSwitcherEnganchadas).length };
 });

 o.abrir = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   _recentApps.length=0;
   const abiertas=[];
   for(const id of ['radio','nube','brujula','canales','buscar','enfoque']){
     const a=APP_SWITCHER_REGISTRY.find(x=>x.id===id);
     if(!a) continue;
     try{ window[a.fn](); }catch(e){}
     await w(220);
     // se cierra lo que se pueda para que no se estorben
     try{ ixCerrarTodasLasVentanas(); }catch(e){}
     try{ ixEnfoqueSalir(); }catch(e){}
     await w(120);
     abiertas.push(id);
   }
   const registradas=_recentApps.map(a=>a.id);
   return { abiertas, registradas,
            faltan: abiertas.filter(id=>registradas.indexOf(id)<0) };
 });

 o.switcher = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   openAppSwitcher(); await w(500);
   const t=(document.getElementById('app-switcher-modal')||{}).innerText||'';
   try{ closeAppSwitcher(); }catch(e){}
   return { diceVacio:/todav[ií]a no abriste/i.test(t),
            saleNube:/Mi Nube/i.test(t), saleRadio:/Radio Mundial/i.test(t) };
 });

 // no cuenta dos veces por haberse enganchado en dos momentos
 o.noDoble = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   _recentApps.length=0;
   openCloudPanel(); await w(300);
   try{ ixCerrarTodasLasVentanas(); }catch(e){}
   return { veces:_recentApps.filter(a=>a.id==='nube').length, total:_recentApps.length };
 });

 // ═══ 2. ESTACIONES (en Buenos Aires) ═══
 o.sur = await p.evaluate(()=>{
   const nombres=[0,1,2,3,4,5,6,7,8,9,10,11].map(m=>getSeason(m).name);
   return { hemisferio:ixHemisferioSur(), tz:Intl.DateTimeFormat().resolvedOptions().timeZone,
            septiembre:getSeason(8).name, enero:getSeason(0).name,
            julio:getSeason(6).name, abril:getSeason(3).name, nombres };
 });
 o.surPantalla = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   try{ _easyTick(); }catch(e){}
   await w(300);
   const el=document.getElementById('easy-estacion') || document.body;
   const pill=document.getElementById('pill-season');
   return { pill: pill?pill.innerText:'', facil: (el.innerText||'').slice(0,400) };
 });
 const errsSur=p._errs||[];
 await p.close();

 // ═══ y en el NORTE tiene que seguir igual que siempre ═══
 const norte=await b.newContext({viewport:{width:1280,height:1000}, timezoneId:'Europe/Madrid'});
 p=await arranca(norte);
 o.norte = await p.evaluate(()=>({
   hemisferio:ixHemisferioSur(),
   septiembre:getSeason(8).name, enero:getSeason(0).name,
   julio:getSeason(6).name, abril:getSeason(3).name
 }));

 // ═══ 3. CERRAR TODAS LAS VENTANAS ═══
 o.cerrar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const ids=['world-radio-modal','music-apps-modal','vpn-apps-modal','smart-finder-modal'];
   const abrir=['openWorldRadioModal','openMusicAppsModal','openVpnModal','openSmartFinderModal'];
   for(const f of abrir){ try{ window[f](); }catch(e){} await w(250); }
   const abiertas=ids.filter(id=>{ const e=document.getElementById(id);
     return e && getComputedStyle(e).display!=='none'; });
   ixCerrarTodasLasVentanas(); await w(500);
   const siguen=ids.filter(id=>{ const e=document.getElementById(id);
     return e && getComputedStyle(e).display!=='none'; });
   return { abiertas, siguen, enLaLista: ids.every(id=>_HOME_DISPLAY_PANELS.indexOf(id)>=0) };
 });

 // y Esc cierra la de encima, que usa la misma lista
 o.esc = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   try{ openWorldRadioModal(); }catch(e){}
   await w(400);
   const antes=getComputedStyle(document.getElementById('world-radio-modal')).display!=='none';
   const cerro=ixCerrarVentanaDeArriba();
   await w(300);
   const despues=getComputedStyle(document.getElementById('world-radio-modal')).display!=='none';
   return { antes, cerro, despues };
 });
 // ═══ 4. Nada de prompt() del navegador en Alarmas ═══
 o.prompt = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   try{ ixCerrarTodasLasVentanas(); }catch(e){}
   await w(300);
   let salio=false;
   const orig=window.prompt;
   window.prompt=function(){ salio=true; return null; };
   try{ toggleAlarmPanel(); }catch(e){}
   await w(400);
   try{ icaSwitchTab('alarms'); }catch(e){}
   await w(300);
   const cab=document.querySelector('#ica-view-alarms .ica-header');
   const txt=cab?cab.innerText:'';
   // se pulsa TODO lo que haya en la cabecera, que es donde estaba el boton
   const botones=cab?[].slice.call(cab.querySelectorAll('button')):[];
   for(const bt of botones){ try{ bt.click(); }catch(e){} await w(180); }
   try{ _icaCerrarHoja(); }catch(e){}
   window.prompt=orig;
   return { salio, cabecera:txt.replace(/\s+/g,' ').trim(),
            sigueLaFuncion: typeof window.icaEditAlarms==='function',
            hayMas: !!document.querySelector('#ica-view-alarms .ica-header-btn') };
 });

 // el «+» no se ha desplazado al quitar el boton
 o.masCentrado = await p.evaluate(()=>{
   const cab=document.querySelector('#ica-view-alarms .ica-header');
   const mas=cab?cab.querySelector('.ica-header-btn'):null;
   if(!cab||!mas) return null;
   const c=cab.getBoundingClientRect(), m=mas.getBoundingClientRect();
   // sigue pegado a la derecha, no en medio
   return { aLaDerecha: (c.right - m.right) < (m.left - c.left) };
 });

 const errs=(p._errs||[]).concat(errsSur);
 await p.close();

 const pruebas=[
  ['el registro tiene las 14 apps', o.registro.n===14,          o.registro.n+': '+o.registro.ids.join(',')],
  ['ninguna apunta a algo que no existe', o.registro.rotas.length===0, o.registro.rotas.join(',')||'ninguna'],
  ['y las 14 quedan enganchadas', o.registro.enganchadas===14,  o.registro.enganchadas],
  ['las 6 que faltaban se registran', o.abrir.faltan.length===0, 'faltan: '+(o.abrir.faltan.join(',')||'ninguna')],
  ['el conmutador ya no dice que está vacío', o.switcher.diceVacio===false, o.switcher.diceVacio],
  ['y las enseña por su nombre', o.switcher.saleNube===true && o.switcher.saleRadio===true, JSON.stringify(o.switcher)],
  ['no cuenta dos veces',         o.noDoble.veces===1,          JSON.stringify(o.noDoble)],
  ['SUR: se detecta el hemisferio', o.sur.hemisferio===true,    o.sur.tz],
  ['en septiembre es PRIMAVERA',  o.sur.septiembre==='Primavera', o.sur.septiembre],
  ['en enero, VERANO',            o.sur.enero==='Verano',       o.sur.enero],
  ['en julio, INVIERNO',          o.sur.julio==='Invierno',     o.sur.julio],
  ['en abril, OTOÑO',             o.sur.abril==='Otoño',        o.sur.abril],
  ['las cuatro estaciones salen',  new Set(o.sur.nombres).size===4, o.sur.nombres.join(',')],
  ['y la pastilla lo dice',       /primavera/i.test(o.surPantalla.pill||''), o.surPantalla.pill],
  ['NORTE: sigue como siempre',   o.norte.hemisferio===false && o.norte.septiembre==='Otoño' && o.norte.enero==='Invierno' && o.norte.julio==='Verano' && o.norte.abril==='Primavera', JSON.stringify(o.norte)],
  ['CERRAR: las 4 estaban en la lista', o.cerrar.enLaLista===true, o.cerrar.enLaLista],
  ['se abren de verdad',          o.cerrar.abiertas.length===4, o.cerrar.abiertas.join(',')],
  ['y se cierran todas',          o.cerrar.siguen.length===0,   'siguen: '+(o.cerrar.siguen.join(',')||'ninguna')],
  ['Esc cierra la de encima',     o.esc.antes===true && o.esc.cerro===true && o.esc.despues===false, JSON.stringify(o.esc)],
  ['nada de prompt() en Alarmas', o.prompt.salio===false,       JSON.stringify(o.prompt)],
  ['sin «Editar» en la cabecera', !/editar/i.test(o.prompt.cabecera||''), o.prompt.cabecera],
  ['y la función muerta se fue',  o.prompt.sigueLaFuncion===false, o.prompt.sigueLaFuncion],
  ['el «+» sigue estando',        o.prompt.hayMas===true,       o.prompt.hayMas],
  ['y no se ha desplazado',       o.masCentrado && o.masCentrado.aLaDerecha===true, JSON.stringify(o.masCentrado)],
  ['sin errores de página',       errs.length===0,              errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
