// Centro de avisos (idea 44): lo que te ha avisado IXClocK queda guardado.
// (Los permisos de notificación del sistema los prueba pruebas/avisos.js.)
//
// Se prueba con los avisos de verdad: una alarma que suena (ringAlarm) pasa
// por ixNotificar igual que en la vida real. Se comprueba que:
//  · se guarda AUNQUE el navegador no tenga permiso para notificar;
//  · la app «🔔 Avisos» los lista del más nuevo al más viejo, y lo que
//    llega con código se ve como texto;
//  · abrirla los marca como leídos;
//  · si llega uno con la lista abierta, aparece al momento;
//  · no crece sin fin (50 como mucho) y «Borrar todo» los quita;
//  · se cierra tocando fuera o con «cerrar todas las ventanas».
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9285);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1200,height:900}, locale:'es-ES'});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9285/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixNotificar==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 const o=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   try{ ixCerrarBienvenida(); }catch(e){}
   const r={};
   if(typeof ixAbrirAvisos!=='function') return {falta:true};
   r.permiso=(typeof Notification!=='undefined')?Notification.permission:'no';
   r.registrada=!!IX_APPS.find(a=>a.id==='avisos') && !!APP_SWITCHER_REGISTRY.find(a=>a.id==='avisos'&&typeof window[a.fn]==='function');
   localStorage.removeItem('ix_avisos_v1');
   ixAbrirAvisos(); await w(100);
   r.vacio=(document.getElementById('ix-avisos-lista')||{}).innerText||'';
   ixAvisosCerrar();
   ringAlarm({id:'x', hour:7, minute:30, label:'Trabajo', tone:'radial'}); await w(100);
   try{ stopRinging(); }catch(e){}
   ixNotificar('Mi aviso <img src=x onerror="window.__pwn=1">', 'detalle');
   r.guardados=ixAvisosLeer().map(a=>a.titulo);
   r.sinLeerAntes=ixAvisosSinLeer();
   ixAbrirAvisos(); await w(100);
   const filas=()=>[].slice.call(document.querySelectorAll('#ix-avisos .ix-aviso')).map(d=>d.innerText.replace(/\s+/g,' '));
   r.lista=filas();
   r.pwn=window.__pwn===1;
   r.sinLeerDespues=ixAvisosSinLeer();
   ixNotificar('🌧️ Lluvia fuerte en Tokio','14°'); await w(50);
   r.enVivo=filas()[0]||'';
   for(let i=0;i<60;i++) ixNotificar('Aviso '+i,'');
   r.tope=ixAvisosLeer().length;
   r.primero=ixAvisosLeer()[0].titulo;
   const ov=document.getElementById('ix-avisos');
   ov.dispatchEvent(new MouseEvent('click',{bubbles:true}));
   await w(50);
   r.fueraCierra=getComputedStyle(ov).display==='none';
   ixAbrirAvisos(); await w(50);
   try{ ixCerrarTodasLasVentanas(); }catch(e){}
   await w(50);
   r.cerrarTodo=getComputedStyle(ov).display==='none';
   ixAbrirAvisos(); await w(50);
   ixAvisosBorrar(); await w(50);
   r.borrado={ n:ixAvisosLeer().length, txt:(document.getElementById('ix-avisos-lista')||{}).innerText||'' };
   return r;
 });
 await b.close(); srv.close();

 const pruebas=[
  ['existe y está en la lista de apps',            !o.falta && o.registrada, JSON.stringify({f:o.falta,r:o.registrada})],
  ['sin avisos lo explica',                        /Sin avisos/.test(o.vacio||''), o.vacio],
  ['una alarma que suena queda guardada',          (o.guardados||[]).some(t=>/Trabajo/.test(t)), JSON.stringify(o.guardados)],
  ['aunque el navegador no tenga permiso',         o.permiso!=='granted' && (o.guardados||[]).length===2, o.permiso],
  ['la lista va del más nuevo al más viejo',       /Mi aviso/.test((o.lista||[])[0]||'') && /Trabajo/.test((o.lista||[])[1]||''), JSON.stringify(o.lista)],
  ['lo que llega con código se ve como texto',     o.pwn===false && /<img src=x/.test((o.lista||[])[0]||''), (o.lista||[])[0]],
  ['abrirla los marca como leídos',                o.sinLeerAntes===2 && o.sinLeerDespues===0, o.sinLeerAntes+' → '+o.sinLeerDespues],
  ['si llega uno con la lista abierta, aparece',   /Lluvia fuerte en Tokio/.test(o.enVivo||''), o.enVivo],
  ['no crece sin fin: 50 como mucho',              o.tope===50 && o.primero==='Aviso 59', o.tope+' '+o.primero],
  ['tocar fuera la cierra',                        o.fueraCierra===true, o.fueraCierra],
  ['«cerrar todas las ventanas» también',          o.cerrarTodo===true, o.cerrarTodo],
  ['«Borrar todo» los quita',                      !!o.borrado && o.borrado.n===0 && /Sin avisos/.test(o.borrado.txt), JSON.stringify(o.borrado)],
  ['sin errores de página',                        errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
