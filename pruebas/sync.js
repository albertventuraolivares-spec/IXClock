// Sincronización entre aparatos: el lado de la APP.
//
// Se levantan DOS navegadores separados —cada uno con su localStorage, o sea
// dos aparatos de verdad, no dos pestañas— y un servidor local que habla el
// mismo idioma que la función de Netlify. En el primero se crean notas,
// alarmas y ciudades, se genera el código, y en el segundo se pone ese mismo
// código y tiene que aparecer todo.
//
// Lo que más importa comprobar aquí, porque es lo que hace daño si falla:
//  · lo que NO debe viajar (la sesión de este aparato, si ya viste la
//    bienvenida) se queda donde está;
//  · un código con Math.random no vale: si no hay crypto, no se genera;
//  · «dejar de sincronizar» no borra los datos del otro aparato.
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};

// ── El servidor: sirve la app Y hace de función de Netlify ──
const cajas={};
const sha=c=>crypto.createHash('sha256').update('ixclock-nube-v1:'+c).digest('hex');
const VALIDO=/^[A-HJ-NP-Z2-9-]{20,40}$/;
let peticiones=0;

const srv=http.createServer((q,s)=>{
  const u=new URL(q.url,'http://localhost');
  if(u.pathname==='/.netlify/functions/nube'){
    peticiones++;
    const cabec={'content-type':'application/json','access-control-allow-origin':'*'};
    if(q.method==='GET'){
      const cod=String(u.searchParams.get('codigo')||'').toUpperCase().replace(/\s+/g,'');
      if(!VALIDO.test(cod)){ s.writeHead(400,cabec); return s.end('{"error":"codigo"}'); }
      const c=cajas[sha(cod)];
      s.writeHead(200,cabec);
      return s.end(JSON.stringify(c ? {ok:true,vacia:false,datos:c.datos,guardado:c.guardado}
                                    : {ok:true,vacia:true,datos:null,guardado:null}));
    }
    if(q.method==='POST'){
      let cuerpo=''; q.on('data',d=>cuerpo+=d);
      return q.on('end',()=>{
        let b; try{ b=JSON.parse(cuerpo); }catch(e){ s.writeHead(400,cabec); return s.end('{"error":"json"}'); }
        const cod=String(b.codigo||'').toUpperCase().replace(/\s+/g,'');
        if(!VALIDO.test(cod)){ s.writeHead(400,cabec); return s.end('{"error":"codigo"}'); }
        const guardado=new Date().toISOString();
        cajas[sha(cod)]={datos:b.datos, guardado};
        s.writeHead(200,cabec); s.end(JSON.stringify({ok:true,guardado}));
      });
    }
    s.writeHead(405,cabec); return s.end('{"error":"metodo"}');
  }
  let f=decodeURIComponent(u.pathname); if(f==='/')f='/index.html';
  const p=path.join(ROOT,f);
  if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
  s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});
  s.end(fs.readFileSync(p));
}).listen(9257);

async function aparato(b){
  const ctx=await b.newContext({viewport:{width:1100,height:900}});
  const p=await ctx.newPage();
  p._errs=[]; p.on('pageerror',e=>p._errs.push(e.message.split('\n')[0]));
  // Todo lo externo se corta MENOS localhost, que es donde vive la función.
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:9257/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof ixNubeGenerar==='function',null,{timeout:30000}).catch(()=>{});
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
  try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
  await p.waitForTimeout(2000);
  await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
  return p;
}

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const o={};

 // ═══════════ APARATO 1: el «iPhone» ═══════════
 const uno=await aparato(b);

 // Se le mete contenido de las cuatro cosas que tienen que viajar.
 await uno.evaluate(()=>{
   localStorage.setItem('notes', JSON.stringify([{id:1,title:'La compra',body:'pan y café',updatedAt:Date.now()}]));
   localStorage.setItem('ica_alarms', JSON.stringify([{h:7,m:30,on:true,label:'Trabajo'}]));
   localStorage.setItem('ica_world_clocks', JSON.stringify(['Asia/Tokyo','Europe/Madrid']));
   localStorage.setItem('cal_events', JSON.stringify({'2026-12-25':['Navidad']}));
   localStorage.setItem('ix_calidad','ahorro');
   // Y cosas que son de ESTE aparato y NO deben viajar:
   localStorage.setItem('uos_session','Invitado');
   localStorage.setItem('ix_onboarding_visto','1');
 });

 o.generar = await uno.evaluate(()=>{
   const c=ixNubeGenerar();
   return { codigo:c, largo:(c||'').replace(/-/g,'').length,
            valido:ixNubeValido(c),
            // sin letras que se confundan al copiarlas a mano
            sinConfusas: !/[01ILO]/.test(c||''),
            // dos seguidos nunca salen iguales
            distinto: ixNubeGenerar()!==c };
 });

 o.activar = await uno.evaluate(async(c)=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   ixNubePonerCodigo(c);
   const r=await ixNubeSubir();
   await w(200);
   return { activa:ixNubeActiva(), guardado:ixNubeCodigo()===c.toUpperCase(), subida:r };
 }, o.generar.codigo);

 // Lo que se manda al servidor: ni más ni menos de lo debido.
 o.enviado = await uno.evaluate(()=>{
   const d=ixNubeRecoger();
   return { claves:Object.keys(d).sort(),
            llevaNotas: d.notes!==undefined,
            llevaSesion: d.uos_session!==undefined,
            llevaOnboarding: d.ix_onboarding_visto!==undefined };
 });

 const errs1=uno._errs;
 await uno.close();

 // ═══════════ APARATO 2: el «iPad», limpio ═══════════
 const dos=await aparato(b);

 o.antes = await dos.evaluate(()=>({
   notas: localStorage.getItem('notes'),
   alarmas: localStorage.getItem('ica_alarms'),
   sesion: localStorage.getItem('uos_session'),
 }));

 o.bajar = await dos.evaluate(async(c)=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   // Se hace por el camino de verdad: se pone el código y se trae.
   ixNubePonerCodigo(c);
   const r=await ixNubeBajar();
   await w(300);
   return { r,
     notas: localStorage.getItem('notes'),
     alarmas: localStorage.getItem('ica_alarms'),
     ciudades: localStorage.getItem('ica_world_clocks'),
     calendario: localStorage.getItem('cal_events'),
     calidad: localStorage.getItem('ix_calidad'),
     // la sesión de ESTE aparato no se pisa
     sesion: localStorage.getItem('uos_session'),
   };
 }, o.generar.codigo);

 // Un código que existe pero sin nada dentro: no es un error
 o.vacio = await dos.evaluate(async()=>{
   const otro='2345-6789-ABCD-EFGH-JKMN';
   ixNubePonerCodigo(otro);
   const r=await ixNubeBajar();
   return r;
 });

 // Uno que no vale ni se intenta
 o.invalido = await dos.evaluate(()=>({
   corto: ixNubeValido('ABC'),
   confusas: ixNubeValido('0000-1111-IIII-LLLL-OOOO'),
   bueno: ixNubeValido('ABCD-EFGH-JKMN-PQRS-TUVW'),
   minusculas: ixNubeValido('abcd-efgh-jkmn-pqrs-tuvw'),
 }));

 // Apagar aquí NO borra lo del servidor
 o.apagar = await dos.evaluate(async(c)=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   ixNubePonerCodigo(c);
   ixNubeApagar(); await w(200);
   const apagada=!ixNubeActiva();
   // y volviendo a poner el código, los datos siguen ahí
   ixNubePonerCodigo(c);
   const r=await ixNubeBajar();
   return { apagada, siguen: r.ok && !r.vacia };
 }, o.generar.codigo);

 // La ficha de Configuración enseña el código y avisa de lo que hay que saber
 o.pantalla = await dos.evaluate(async(c)=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   ixNubePonerCodigo(c);
   if(!document.getElementById('left-sidebar').classList.contains('open')) toggleSidebar();
   showTab('more'); await w(600);
   const caja=document.getElementById('ix-nube');
   const t=caja?caja.innerText:'';
   return { hay:!!caja, saleCodigo:t.indexOf(c.toUpperCase())>=0,
            avisa:/quien tenga el código tiene tus datos/i.test(t),
            aviso2:/si lo pierdes no hay forma de recuperarlo/i.test(t),
            hayBotones:/Guardar ahora/.test(t) && /Traer/.test(t) };
 }, o.generar.codigo);

 // Sin código, la ficha ofrece crear uno o unirse
 o.pantallaSin = await dos.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   ixNubeApagar(); await w(400);
   const t=(document.getElementById('ix-nube')||{}).innerText||'';
   return { crear:/Crear mi código/.test(t), unirse:/Traer mis datos/.test(t),
            hayCampo: !!document.getElementById('ix-nube-input') };
 });

 const errs=(dos._errs||[]).concat(errs1);
 await dos.close(); await b.close(); srv.close();

 const g=o.generar, ba=o.bajar;
 const pruebas=[
  ['el código se genera largo',       g.largo===20 && g.valido===true, g.codigo],
  ['sin letras que se confundan',     g.sinConfusas===true,   g.codigo],
  ['y nunca sale el mismo dos veces', g.distinto===true,      g.distinto],
  ['al activarlo, sube solo',         o.activar.activa===true && o.activar.subida.ok===true, JSON.stringify(o.activar.subida)],
  ['se manda lo que toca',            o.enviado.llevaNotas===true, o.enviado.claves.join(' ')],
  ['NO se manda la sesión',           o.enviado.llevaSesion===false, o.enviado.llevaSesion],
  ['ni si viste la bienvenida',       o.enviado.llevaOnboarding===false, o.enviado.llevaOnboarding],
  ['el 2º aparato empieza vacío',     o.antes.notas===null && o.antes.alarmas===null, JSON.stringify(o.antes)],
  ['y al poner el código LE LLEGAN LAS NOTAS', /La compra/.test(ba.notas||''), (ba.notas||'').slice(0,50)],
  ['las alarmas',                     /Trabajo/.test(ba.alarmas||''), ba.alarmas],
  ['las ciudades',                    /Tokyo/.test(ba.ciudades||''),  ba.ciudades],
  ['el calendario',                   /Navidad/.test(ba.calendario||''), ba.calendario],
  ['y los ajustes',                   ba.calidad==='ahorro',  ba.calidad],
  ['pero NO le pisa su sesión',       ba.sesion==='Invitado', ba.sesion],
  ['un código sin nada no es error',  o.vacio.ok===true && o.vacio.vacia===true, JSON.stringify(o.vacio)],
  ['un código malo se rechaza antes', o.invalido.corto===false && o.invalido.confusas===false, JSON.stringify(o.invalido)],
  ['uno bueno vale, en mayús o minús',o.invalido.bueno===true && o.invalido.minusculas===true, JSON.stringify(o.invalido)],
  ['apagar aquí NO borra lo de allá', o.apagar.apagada===true && o.apagar.siguen===true, JSON.stringify(o.apagar)],
  ['la ficha enseña el código',       o.pantalla.hay===true && o.pantalla.saleCodigo===true, JSON.stringify(o.pantalla.saleCodigo)],
  ['y AVISA de que es la llave',      o.pantalla.avisa===true, o.pantalla.avisa],
  ['y de que no se recupera',         o.pantalla.aviso2===true, o.pantalla.aviso2],
  ['con sus botones',                 o.pantalla.hayBotones===true, o.pantalla.hayBotones],
  ['sin código, ofrece crear o unirse',o.pantallaSin.crear===true && o.pantallaSin.unirse===true && o.pantallaSin.hayCampo===true, JSON.stringify(o.pantallaSin)],
  ['sin errores de página',           errs.length===0,        errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length+'   (peticiones al servidor: '+peticiones+')');
 process.exit(ok===pruebas.length?0:1);
})();
