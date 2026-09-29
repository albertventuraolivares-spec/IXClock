// Tarjeta del día para compartir (idea 38).
//
// Con el tiempo, una alarma y un evento puestos a mano, y la pantalla de
// verdad (botón «📤 Compartir mi día» en Avisos). Se comprueba:
//  · la tarjeta lleva la hora, la fecha y los mismos datos que la franja de
//    arriba (tiempo, próxima alarma, evento) y los minutos de enfoque;
//  · es una imagen 1080×1350 (formato de móvil) y no está en blanco;
//  · con «compartir» del sistema, manda un PNG «ixclock-hoy.png»;
//  · sin él (ordenador), se descarga ese PNG;
//  · cancelar el compartir no descarga nada;
//  · sin datos, sale igual con la hora y la fecha.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9299);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1300,height:1000}, locale:'es-ES', acceptDownloads:true});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.addInitScript(()=>{ try{ ['ica_alarms','ix_enfoque_hist_v1','ix_avisos_v1'].forEach(k=>localStorage.removeItem(k)); }catch(e){} });
 await p.goto('http://localhost:9299/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixAbrirAvisos==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 const o={};
 o.falta=await p.evaluate(()=>{ try{ ixCerrarBienvenida(); }catch(e){} return typeof ixTarjetaDatos!=='function'; });
 if(!o.falta){
   o.sinDatos=await p.evaluate(()=>{ try{ _lastWeatherRaw=null; }catch(e){} const d=ixTarjetaDatos(); return d; });
   o.datos=await p.evaluate(()=>{
     _lastWeatherRaw={cur:{temperature_2m:21.4, weathercode:0}};
     const n=new Date(Date.now()+3*3600000);
     _icaAlarms=[{time:n.getHours()+':'+String(n.getMinutes()).padStart(2,'0'), label:'Gimnasio', on:true, tone:'radial'}];
     localStorage.setItem('ix_enfoque_hist_v1', JSON.stringify([{d:_enfHoy(), m:50, t:Date.now(), tarea:'Tesis'}]));
     const d=ixTarjetaDatos();
     d.horaAhora=String(new Date().getHours()).padStart(2,'0')+':'+String(new Date().getMinutes()).padStart(2,'0');
     d.alarma=_frAlarma().texto;
     const cv=ixTarjetaCanvas();
     const g=cv.getContext('2d');
     const px=a=>Array.from(g.getImageData(a[0],a[1],1,1).data).join(',');
     d.cv={ w:cv.width, h:cv.height, puntos:[px([20,20]),px([540,360]),px([1060,1330]),px([540,760])] };
     return d;
   });
   // Con «compartir» del sistema
   o.share=await p.evaluate(async()=>{
     let recibido=null;
     navigator.canShare=function(x){ return !!(x&&x.files&&x.files.length); };
     navigator.share=async function(x){ recibido={ n:x.files.length, nombre:x.files[0].name, tipo:x.files[0].type, tam:x.files[0].size, titulo:x.title }; };
     ixAbrirAvisos();
     document.getElementById('ix-compartir-dia').click();
     for(let i=0;i<50 && !recibido;i++) await new Promise(r=>setTimeout(r,200));
     return recibido;
   });
   // Cancelar no descarga
   let descargas=0; p.on('download',()=>descargas++);
   o.cancelada=await p.evaluate(async()=>{ navigator.share=async function(){ throw new DOMException('x','AbortError'); }; return ixCompartirDia(); });
   await p.waitForTimeout(500);
   o.descargasTrasCancelar=descargas;
   // Sin «compartir»: descarga
   await p.evaluate(()=>{ navigator.share=undefined; navigator.canShare=undefined; });
   try{
     const [d]=await Promise.all([p.waitForEvent('download',{timeout:15000}), p.click('#ix-compartir-dia')]);
     const ruta=await d.path(); const buf=fs.readFileSync(ruta);
     o.descarga={ nombre:d.suggestedFilename(), png:buf.slice(1,4).toString()==='PNG', tam:buf.length };
   }catch(e){ o.descarga={error:e.message.split('\n')[0]}; }
 }
 await b.close(); srv.close();

 const d=o.datos||{}, pts=(d.cv||{}).puntos||[];
 const pruebas=[
  ['existe',                                         !o.falta, !o.falta],
  ['lleva la hora y la fecha',                       d.hora===d.horaAhora && /^[A-ZÁÉ]/.test(d.fecha||'') && /septiembre|octubre|\d/.test(d.fecha||''), d.hora+' · '+d.fecha],
  ['el tiempo, como la franja',                      (d.filas||[]).includes('☀️ 21°'), JSON.stringify(d.filas)],
  ['la próxima alarma, como la franja',              (d.filas||[]).includes('⏰ '+d.alarma), JSON.stringify(d.filas)+' / '+d.alarma],
  ['y el enfoque de hoy',                            (d.filas||[]).some(f=>/🎯 50 min de enfoque/.test(f)), JSON.stringify(d.filas)],
  ['imagen 1080×1350',                               !!d.cv && d.cv.w===1080 && d.cv.h===1350, d.cv&&(d.cv.w+'×'+d.cv.h)],
  ['y no está en blanco',                            new Set(pts).size>=3 && pts.every(x=>!/^0,0,0,0$/.test(x)), JSON.stringify(pts)],
  ['compartir manda «ixclock-hoy.png»',              !!o.share && o.share.n===1 && o.share.nombre==='ixclock-hoy.png' && o.share.tipo==='image/png' && o.share.tam>10000, JSON.stringify(o.share)],
  ['cancelar no descarga nada',                      o.cancelada==='cancelada' && o.descargasTrasCancelar===0, o.cancelada+' '+o.descargasTrasCancelar],
  ['sin «compartir», se descarga el PNG',            !!o.descarga && o.descarga.nombre==='ixclock-hoy.png' && o.descarga.png && o.descarga.tam>10000, JSON.stringify(o.descarga)],
  ['sin datos sale igual (hora y fecha)',            !!o.sinDatos && /^\d\d:\d\d$/.test(o.sinDatos.hora) && !!o.sinDatos.fecha, JSON.stringify(o.sinDatos)],
  ['sin errores de página',                          errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,dd])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+dd+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
