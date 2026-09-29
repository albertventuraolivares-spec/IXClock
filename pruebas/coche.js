// Modo coche (idea 40): hora grande, próxima alarma y la radio con tres
// botones enormes, en negro y blanco, para el soporte del coche.
//
// En pantalla de móvil (390×844). La radio se sustituye por una de mentira
// (setStation/togglePlayPause) para no depender de streams. Se comprueba:
//  · está entre las apps y en el conmutador;
//  · la hora es la de ahora y sale la próxima alarma;
//  · ⏭/⏮ pasan por TUS FAVORITAS en orden y dan la vuelta;
//  · sin favoritas, usa la lista de emisoras;
//  · el botón del centro pone y pausa, y lo dice (▶/⏸ y su aria-label);
//  · los tres botones miden al menos 96 px de alto y caben sin salirse;
//  · pide que la pantalla no se apague y lo suelta al salir;
//  · «Mapas» sale y abre Mapas; Esc y «cerrar todas» también lo cierran.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9300);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:390,height:844}, locale:'es-ES', isMobile:true, hasTouch:true});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.addInitScript(()=>{
   window.__wake={pedidas:0, soltadas:0};
   try{ Object.defineProperty(navigator,'wakeLock',{configurable:true, value:{ request:async()=>{ window.__wake.pedidas++; return { release:async()=>{ window.__wake.soltadas++; } }; } }}); }catch(e){}
 });
 await p.goto('http://localhost:9300/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof setStation==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 const o={};
 o.falta=await p.evaluate(()=>{ try{ ixCerrarBienvenida(); }catch(e){} return typeof ixAbrirCoche!=='function'; });
 if(!o.falta){
   o.pre=await p.evaluate(()=>{
     window.__radio=[]; window.__mapas=0;
     window.setStation=function(id){ currentStation=id; isPlaying=true; window.__radio.push(id); };
     window.togglePlayPause=function(){ isPlaying=!isPlaying; };
     window.openAppleMaps=function(){ window.__mapas++; };
     try{ stopAudio(); }catch(e){}
     isPlaying=false; currentStation=null;
     const ids=STATIONS.slice(0,3).map(x=>x.id);
     _radioFavs=[ids[1], ids[2]];
     const n=new Date(Date.now()+2*3600000);
     _icaAlarms=[{time:n.getHours()+':'+String(n.getMinutes()).padStart(2,'0'), label:'Recoger', on:true, tone:'radial'}];
     const a=IX_APPS.find(x=>x.id==='coche');
     if(a) window[a.open]();
     return { ids, apps:!!a, switcher:!!APP_SWITCHER_REGISTRY.find(x=>x.id==='coche' && typeof window[x.fn]==='function') };
   });
   await p.waitForTimeout(300);
   const ver=()=>p.evaluate(()=>{ const ov=document.getElementById('ix-coche'); if(!ov) return null;
     const bt=['ix-coche-ant','ix-coche-pausa','ix-coche-sig'].map(id=>{ const r=document.getElementById(id).getBoundingClientRect(); return {h:Math.round(r.height), der:Math.round(r.right), izq:Math.round(r.left)}; });
     return { visible:getComputedStyle(ov).display!=='none', hora:document.getElementById('ix-coche-hora').textContent, alarma:document.getElementById('ix-coche-alarma').textContent,
              radio:document.getElementById('ix-coche-radio').textContent, pausa:document.getElementById('ix-coche-pausa').textContent,
              aria:document.getElementById('ix-coche-pausa').getAttribute('aria-label'), bt, ancho:innerWidth, scroll:document.documentElement.scrollWidth,
              ahora:String(new Date().getHours()).padStart(2,'0')+':'+String(new Date().getMinutes()).padStart(2,'0'),
              franja:(_frAlarma()||{}).texto, fondo:getComputedStyle(ov).backgroundColor }; });
   o.ini=await ver();
   // ⏭ ⏭ ⏭ ⏮
   for(const id of ['#ix-coche-sig','#ix-coche-sig','#ix-coche-sig','#ix-coche-ant']){ await p.click(id); await p.waitForTimeout(100); }
   o.orden=await p.evaluate(()=>window.__radio.slice());
   o.sonando=await ver();
   await p.click('#ix-coche-pausa'); await p.waitForTimeout(150);
   o.pausada=await ver();
   // Sin favoritas
   o.sinFavs=await p.evaluate(()=>{ _radioFavs=[]; currentStation=null; window.__radio.length=0; ixCocheEmisora(1); return window.__radio.slice(); });
   o.wake1=await p.evaluate(()=>Object.assign({},window.__wake));
   // Mapas
   await p.click('#ix-coche button:has-text("Mapas")');
   await p.waitForTimeout(200);
   o.mapas=await p.evaluate(()=>({ mapas:window.__mapas, abierto:ixCocheAbierto(), wake:Object.assign({},window.__wake) }));
   // Esc y cerrar todas
   await p.evaluate(()=>ixAbrirCoche()); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
   o.esc=await p.evaluate(()=>ixCocheAbierto());
   await p.evaluate(()=>{ ixAbrirCoche(); try{ ixCerrarTodasLasVentanas(); }catch(e){} }); await p.waitForTimeout(150);
   o.todas=await p.evaluate(()=>ixCocheAbierto());
 }
 await b.close(); srv.close();

 const i=o.ini||{}, ids=(o.pre||{}).ids||[];
 const pruebas=[
  ['existe',                                          !o.falta, !o.falta],
  ['está entre las apps y en el conmutador',          !!o.pre && o.pre.apps && o.pre.switcher, JSON.stringify(o.pre)],
  ['se abre a pantalla completa, en negro',           i.visible===true && i.fondo==='rgb(0, 0, 0)', i.fondo],
  ['la hora es la de ahora',                          i.hora===i.ahora, i.hora+' vs '+i.ahora],
  ['sale la próxima alarma (como la franja)',         i.alarma==='⏰ '+i.franja, i.alarma],
  ['sin emisora, dice cómo elegir',                   /Elige una emisora/.test(i.radio||'') && i.pausa==='▶', i.radio+' '+i.pausa],
  ['⏭/⏮ pasan por tus favoritas y dan la vuelta',    JSON.stringify(o.orden)===JSON.stringify([ids[1],ids[2],ids[1],ids[2]]), JSON.stringify(o.orden)+' favs '+JSON.stringify(ids.slice(1))],
  ['dice qué suena y el botón pasa a ⏸',              !!o.sonando && /^📻 /.test(o.sonando.radio) && !/Elige/.test(o.sonando.radio) && o.sonando.pausa==='⏸' && /Pausar/.test(o.sonando.aria), JSON.stringify(o.sonando&&[o.sonando.radio,o.sonando.pausa,o.sonando.aria])],
  ['pausar vuelve a ▶',                               !!o.pausada && o.pausada.pausa==='▶' && /Poner/.test(o.pausada.aria), o.pausada&&o.pausada.pausa],
  ['sin favoritas usa la lista',                      JSON.stringify(o.sinFavs)===JSON.stringify([ids[0]]), JSON.stringify(o.sinFavs)],
  ['botones de ≥96 px de alto',                       (i.bt||[]).length===3 && i.bt.every(x=>x.h>=96), JSON.stringify(i.bt)],
  ['caben sin salirse (390 px)',                      (i.bt||[]).every(x=>x.izq>=0 && x.der<=i.ancho) && i.scroll<=i.ancho, JSON.stringify(i.bt)+' '+i.scroll],
  ['pide pantalla encendida',                         !!o.wake1 && o.wake1.pedidas>=1, JSON.stringify(o.wake1)],
  ['«Mapas» sale, abre Mapas y suelta la pantalla',   !!o.mapas && o.mapas.mapas===1 && !o.mapas.abierto && o.mapas.wake.soltadas>=1, JSON.stringify(o.mapas)],
  ['Esc lo cierra',                                   o.esc===false, o.esc],
  ['«cerrar todas» también',                          o.todas===false, o.todas],
  ['sin errores de página',                           errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
