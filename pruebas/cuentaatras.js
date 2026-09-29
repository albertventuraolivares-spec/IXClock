// Tus eventos del calendario en «Próximas festividades» (idea 54) y el año de
// las fiestas del año que viene.
//
// Se comprueba lo que ve la persona:
//  · un evento tuyo dentro de 5 días sale en la lista, con «5 días», 📌 y
//    «Tu calendario», en su sitio por fecha;
//  · lo de ayer y lo de dentro de más de un año no salen;
//  · lo que escribiste se ve como TEXTO (si lleva <b>, se lee «<b>»);
//  · tocarlo (o Enter con el teclado) abre el calendario en ese día;
//  · añadir o borrar un evento cambia la lista al momento;
//  · un evento tuyo HOY no se hace pasar por festivo (el cartel de fiesta);
//  · y el Año Nuevo que viene sale con el año que viene, no con el de ahora.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9269);

const clave=d=>{ const x=new Date(); x.setHours(0,0,0,0); x.setDate(x.getDate()+d);
  return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); };

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1400,height:1000}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 const ev={};
 ev[clave(5)]=['Viaje a Tokio <b>ya</b>'];
 ev[clave(-1)]=['Cosa de ayer'];
 ev[clave(400)]=['Muy lejos'];
 ev[clave(0)]=['Mi cita de hoy'];
 await p.addInitScript(e=>{ try{ if(!sessionStorage.getItem('sembrado')){ localStorage.setItem('cal_events', e); sessionStorage.setItem('sembrado','1'); } }catch(x){} }, JSON.stringify(ev));
 await p.goto('http://localhost:9269/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof renderizarFeriados==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}; try{ renderizarFeriados(); }catch(e){}});
 const o={};
 const filas=()=>p.evaluate(()=>[].slice.call(document.querySelectorAll('#events-box > div')).map(d=>({ t:d.innerText.replace(/\s+/g,' ').trim(), mio:d.classList.contains('ix-fest-mio'), html:d.innerHTML })));

 o.filas=await filas();
 o.banner=await p.evaluate(()=>{ const b=document.getElementById('holiday-banner'); return b ? { visible:!b.classList.contains('hidden'), nombre:(document.getElementById('holiday-banner-name')||{}).innerText } : null; });

 // Tocar el evento abre el calendario en ese día
 try{ await p.click('#events-box .ix-fest-mio:has-text("Tokio")',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(500);
 o.abre=await p.evaluate(()=>({ opacidad:(document.getElementById('cal-panel')||{style:{}}).style.opacity, dia:typeof calSelDay!=='undefined'?calSelDay:null }));
 await p.evaluate(()=>{ try{ toggleCalendar(); }catch(e){} });
 await p.waitForTimeout(300);
 // Con el teclado
 await p.focus('#events-box .ix-fest-mio >> nth=1').catch(()=>{});
 await p.keyboard.press('Enter');
 await p.waitForTimeout(500);
 o.teclado=await p.evaluate(()=>(document.getElementById('cal-panel')||{style:{}}).style.opacity);

 // Añadir y borrar desde el calendario: la lista cambia al momento
 o.vivo=await p.evaluate(async(k)=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   calSelDay=k;
   const inp=document.getElementById('cal-new-event'); inp.value='Examen de mates';
   addCalEvent(); await w(200);
   const trasAnadir=document.getElementById('events-box').innerText;
   delCalEvt(k, calEvts[k].length-1); await w(200);
   const trasBorrar=document.getElementById('events-box').innerText;
   return { anadido:/Examen de mates/.test(trasAnadir), borrado:!/Examen de mates/.test(trasBorrar) };
 }, clave(10));

 // El Año Nuevo que viene
 o.anoNuevo=await p.evaluate(()=>{
   const fila=[].slice.call(document.querySelectorAll('#events-box > div')).find(d=>/A[ñn]o Nuevo/i.test(d.innerText) && !/Chino/i.test(d.innerText));
   return fila ? fila.innerText.replace(/\s+/g,' ') : null;
 });
 const esteAno=new Date().getFullYear();
 await b.close(); srv.close();

 const tokio=o.filas.find(f=>/Tokio/.test(f.t));
 const idxTokio=o.filas.indexOf(tokio);
 const antes=o.filas[idxTokio-1], despues=o.filas[idxTokio+1];
 const dias=t=>{ const m=/(\d+) d[ií]as/i.exec(t||''); if(m) return +m[1]; if(/Mañana/i.test(t||'')) return 1; if(/Hoy/i.test(t||'')) return 0; return null; };
 const pruebas=[
  ['tu evento sale en la lista',             !!tokio, tokio && tokio.t],
  ['con «5 días», 📌 y «Tu calendario»',      !!tokio && /5 d[ií]as/i.test(tokio.t) && /📌/.test(tokio.t) && /Tu calendario/i.test(tokio.t), tokio && tokio.t],
  ['en su sitio por fecha',                  !!tokio && (!antes || dias(antes.t)<=5) && (!despues || dias(despues.t)>=5), [antes&&antes.t, despues&&despues.t].join(' | ')],
  ['lo de ayer NO sale',                     !o.filas.some(f=>/Cosa de ayer/.test(f.t)), 'ok'],
  ['lo de dentro de un año largo NO sale',   !o.filas.some(f=>/Muy lejos/.test(f.t)), 'ok'],
  ['lo que escribiste se ve como texto',     !!tokio && /<b>ya<\/b>/.test(tokio.t) && !/<b>ya<\/b>/.test(tokio.html), tokio && tokio.t],
  ['tu cita de hoy sale como «Hoy»',         o.filas.some(f=>/Mi cita de hoy/.test(f.t) && /Hoy/i.test(f.t)), 'ok'],
  ['pero NO se hace pasar por festivo',      !o.banner || !o.banner.visible || !/Mi cita/.test(o.banner.nombre||''), JSON.stringify(o.banner)],
  ['tocarlo abre el calendario en ese día',  o.abre.opacidad==='1' && o.abre.dia===clave(5), JSON.stringify(o.abre)],
  ['y con el teclado también',               o.teclado==='1', o.teclado],
  ['añadir un evento lo pone al momento',    o.vivo.anadido===true, JSON.stringify(o.vivo)],
  ['y borrarlo lo quita',                    o.vivo.borrado===true, JSON.stringify(o.vivo)],
  ['el Año Nuevo que viene lleva SU año',    !!o.anoNuevo && new RegExp(String(esteAno+1)).test(o.anoNuevo), o.anoNuevo],
  ['sin errores de página',                  errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
