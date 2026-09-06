// Avisos por correo: el lado de la APP.
//
// El servidor ya está probado aparte (`pruebas/correo.js`). Aquí lo que importa
// es lo que ve y hace el usuario:
//  · que el interruptor se recuerde;
//  · que al sonar una alarma salga el correo, PERO solo si está activado — que
//    mandar correos sin permiso sería peor que no mandarlos;
//  · que el correo NO sustituya al aviso del sistema, se suma;
//  · y sobre todo, que cuando falle DIGA POR QUÉ. «No me llegan los correos»
//    sin más no hay por dónde cogerlo; lo útil es que ponga qué falta.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};

// El servidor local hace de función de correo, y se le puede decir qué
// responder para probar cada caso de fallo.
let recibidos=[];
let respuesta={status:200, cuerpo:{ok:true,id:'x1'}};

const srv=http.createServer((q,s)=>{
  const u=new URL(q.url,'http://localhost');
  if(u.pathname==='/.netlify/functions/correo'){
    let cuerpo=''; q.on('data',d=>cuerpo+=d);
    return q.on('end',()=>{
      try{ recibidos.push(JSON.parse(cuerpo||'{}')); }catch(e){ recibidos.push({roto:true}); }
      s.writeHead(respuesta.status,{'content-type':'application/json','access-control-allow-origin':'*'});
      s.end(JSON.stringify(respuesta.cuerpo));
    });
  }
  let f=decodeURIComponent(u.pathname); if(f==='/')f='/index.html';
  const p=path.join(ROOT,f);
  if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
  s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});
  s.end(fs.readFileSync(p));
}).listen(9259);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1200,height:1000}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9259/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixCorreoEnviar==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const o={};

 // ═══ LA FICHA ═══
 o.ficha = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   if(!document.getElementById('left-sidebar').classList.contains('open')) toggleSidebar();
   showTab('more'); await w(700);
   const c=document.getElementById('ix-correo');
   const t=c?c.innerText:'';
   return { hay:!!c, apagadoPorDefecto:/apagados/i.test(t),
            hayPrueba:/correo de prueba/i.test(t),
            explicaAppCerrada:/aunque tengas la app cerrada/i.test(t),
            explicaDestino:/no se puede elegir desde aquí/i.test(t) };
 });

 // ═══ EL INTERRUPTOR SE RECUERDA ═══
 o.interruptor = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const a=ixCorreoActivo();
   const b=ixCorreoAlternar(); await w(200);
   const t=(document.getElementById('ix-correo')||{}).innerText||'';
   return { antes:a, despues:b, guardado:localStorage.getItem('ix_correo_avisos'),
            loDice:/ACTIVADOS/.test(t) };
 });

 // ═══ EL BOTÓN DE PRUEBA MANDA UN CORREO ═══
 recibidos=[];
 o.prueba = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const r=await ixCorreoProbar(); await w(400);
   return { r, estado:(document.getElementById('ix-correo-estado')||{}).textContent };
 });
 o.pruebaEnviada = recibidos[0]||null;

 // ═══ UNA ALARMA MANDA CORREO... SOLO SI ESTÁ ACTIVADO ═══
 recibidos=[];
 o.conAvisos = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   localStorage.setItem('ix_correo_avisos','1');
   ixNotificar('⏰ Trabajo','Son las 7:30');
   await w(600);
   return { activo:ixCorreoActivo() };
 });
 o.correosConAvisos = recibidos.length;
 o.contenido = recibidos[0]||null;

 recibidos=[];
 o.sinAvisos = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   localStorage.setItem('ix_correo_avisos','0');
   ixNotificar('⏰ Otra','No debería salir correo');
   await w(600);
   return { activo:ixCorreoActivo() };
 });
 o.correosSinAvisos = recibidos.length;

 // ═══ CUANDO FALLA, DICE POR QUÉ ═══
 o.fallos = {};
 const casos = [
   ['sinConfigurar', 503, {ok:false,error:'sin-configurar',falta:['RESEND_API_KEY']}, /Falta configurarlo en Netlify.*RESEND_API_KEY/],
   ['tope',          429, {ok:false,error:'tope'},                                    /Demasiados correos/],
   ['resend',        502, {ok:false,error:'resend',motivo:'Domain is not verified'},   /Resend lo rechazó.*not verified/],
 ];
 for(const [nombre, status, cuerpo, patron] of casos){
   respuesta={status, cuerpo};
   const txt=await p.evaluate(async()=>{
     const w=m=>new Promise(r=>setTimeout(r,m));
     await ixCorreoProbar(); await w(300);
     return (document.getElementById('ix-correo-estado')||{}).textContent||'';
   });
   o.fallos[nombre]={ texto:txt, bien:patron.test(txt) };
 }
 respuesta={status:200, cuerpo:{ok:true,id:'x1'}};

 // ═══ SI EL SERVIDOR NO ESTÁ, NO REVIENTA ═══
 await p.route(/\/\.netlify\/functions\/correo/, r=>r.abort());
 o.sinRed = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const r=await ixCorreoEnviar('a','b'); await w(200);
   return r;
 });

 await p.close(); await b.close(); srv.close();

 const f=o.fallos;
 const pruebas=[
  ['la ficha está',                  o.ficha.hay===true,  JSON.stringify(o.ficha)],
  ['y arranca APAGADA',              o.ficha.apagadoPorDefecto===true, o.ficha.apagadoPorDefecto],
  ['explica que llega con la app cerrada', o.ficha.explicaAppCerrada===true, o.ficha.explicaAppCerrada],
  ['y que el destino no se elige aquí',    o.ficha.explicaDestino===true,    o.ficha.explicaDestino],
  ['el interruptor se enciende',     o.interruptor.despues===true && o.interruptor.guardado==='1', JSON.stringify(o.interruptor)],
  ['y la pantalla lo dice',          o.interruptor.loDice===true, o.interruptor.loDice],
  ['el botón de prueba manda correo',o.prueba.r.ok===true && !!o.pruebaEnviada, JSON.stringify(o.prueba.r)],
  ['con asunto y texto',             !!o.pruebaEnviada && /funciona/i.test(o.pruebaEnviada.asunto) && o.pruebaEnviada.texto.length>10, o.pruebaEnviada&&o.pruebaEnviada.asunto],
  ['y NO manda destinatario',        !!o.pruebaEnviada && o.pruebaEnviada.to===undefined && o.pruebaEnviada.para===undefined, JSON.stringify(Object.keys(o.pruebaEnviada||{}))],
  ['lo dice en pantalla al salir bien', /Enviado/.test(o.prueba.estado||''), o.prueba.estado],
  ['ALARMA con avisos ON: sale correo', o.correosConAvisos===1, o.correosConAvisos],
  ['con el texto de la alarma',      o.contenido && /Trabajo/.test(o.contenido.asunto) && /7:30/.test(o.contenido.texto), JSON.stringify(o.contenido)],
  ['con avisos OFF: NO sale ninguno',o.correosSinAvisos===0, o.correosSinAvisos],
  ['sin configurar: dice qué falta', f.sinConfigurar.bien===true, f.sinConfigurar.texto],
  ['con tope: lo dice',              f.tope.bien===true,          f.tope.texto],
  ['si Resend rechaza: dice el motivo', f.resend.bien===true,     f.resend.texto],
  ['sin servidor no revienta',       o.sinRed.ok===false && o.sinRed.error==='red', JSON.stringify(o.sinRed)],
  ['sin errores de página',          errs.length===0,             errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})();
