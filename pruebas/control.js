// Rendimiento y control: calidad de los efectos, panel ancho y velocidad de
// arrastre. (Ideas 12, 13 y 14 del usuario.)
//
// Dos de las tres piden cuidado, porque el navegador NO puede hacer lo que
// suena que hacen: los Hz de la pantalla y la sensibilidad del raton los manda
// el sistema operativo. Asi que la prueba comprueba las dos cosas:
//   1) que lo que SI se puede hacer se hace de verdad (el desenfoque baja, el
//      panel se ensancha, el arrastre se multiplica), medido en pixeles y en
//      estilos calculados — no mirando si existe el boton;
//   2) que la pantalla lo CUENTA como es, sin prometer hercios ni ratones.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9252);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1400,height:1000}});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9252/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixPonerCalidad==='function' && typeof ixVelArrastre==='function',
   null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const o={};

 // ═══════════ CALIDAD DE LOS EFECTOS ═══════════
 // Se mide el backdrop-filter DE VERDAD, en un .glass que este en pantalla.
 // Ojo con cual: el primer .glass del documento es el boton del engranaje,
 // que tiene su propio fondo y no representa a los paneles. Se coge una
 // ficha de Configuracion, que es cristal de verdad.
 o.calidad = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   if(!document.getElementById('left-sidebar').classList.contains('open')) toggleSidebar();
   showTab('more'); await w(500);
   const g=document.querySelector('#tab-more .glass');
   const desenfoque=()=>{
     const f=getComputedStyle(g).backdropFilter||getComputedStyle(g).webkitBackdropFilter||'none';
     const m=/blur\(([\d.]+)px\)/.exec(f);
     return { texto:f.slice(0,40), px: m?parseFloat(m[1]):0 };
   };
   const sombra=()=>getComputedStyle(g).boxShadow;

   // Cada espera es de 600 ms a proposito: .glass lleva una transicion de
   // 300 ms en el backdrop-filter, y midiendo antes se lee un valor a medio
   // camino en vez del que toca.
   ixPonerCalidad('alta');   await w(600);
   const alta={ ...desenfoque(), clases:document.body.className.indexOf('ix-cal-')>=0, sombra:sombra() };
   ixPonerCalidad('media');  await w(600);
   const media={ ...desenfoque(), clase:document.body.classList.contains('ix-cal-media') };
   ixPonerCalidad('ahorro'); await w(600);
   const ahorro={ ...desenfoque(), clase:document.body.classList.contains('ix-cal-ahorro'),
                  fondo:getComputedStyle(g).backgroundColor,
                  guardado:localStorage.getItem('ix_calidad') };
   // y volviendo a Alta se recupera lo de antes: no es un camino de ida
   ixPonerCalidad('alta');   await w(600);
   const vuelta={ ...desenfoque() };
   return { alta, media, ahorro, vuelta };
 });

 // El fondo animado se para en Ahorro. El fondo que sale por defecto no lleva
 // animacion, asi que medirlo tal cual no probaria nada: se le pone una a
 // proposito, como hacen los fondos animados de la app, y se comprueba que
 // Ahorro la para igual.
 o.fondo = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const el=document.querySelector('.wallpaper-layer');
   if(!el) return {hay:false};
   const st=document.createElement('style');
   st.textContent='@keyframes ixPruebaMover{from{opacity:.9}to{opacity:1}}'
                 +'.wallpaper-layer{animation:ixPruebaMover 6s linear infinite;}';
   document.head.appendChild(st);
   ixPonerCalidad('alta');   await w(200);
   const a=getComputedStyle(el).animationName;
   ixPonerCalidad('ahorro'); await w(200);
   const b=getComputedStyle(el).animationName;
   ixPonerCalidad('alta');   await w(150);
   st.remove();
   return { hay:true, alta:a, ahorro:b };
 });

 // un valor basura guardado a mano no rompe nada: se cae a 'alta'
 o.basura = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   localStorage.setItem('ix_calidad','<script>lo que sea');
   const c=ixCalidad();
   ixAplicarCalidad(); await w(150);
   const sucio=document.body.className.indexOf('ix-cal-')>=0;
   localStorage.setItem('ix_calidad','alta'); ixAplicarCalidad();
   return { calidad:c, sucio };
 });

 // ═══════════ CONFIGURACIÓN A PANTALLA COMPLETA ═══════════
 o.ancha = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const sb=document.getElementById('left-sidebar');
   if(!document.getElementById('left-sidebar').classList.contains('open')) toggleSidebar();
   await w(700);
   const estrecho=sb.getBoundingClientRect().width;
   ixCfgToggleAncha(); await w(700);
   const ancho=sb.getBoundingClientRect().width;
   const btn=document.getElementById('cfg-ancha-btn');
   const texto=btn?btn.textContent:'';
   // y se recuerda
   const guardado=localStorage.getItem('ix_cfg_ancha');
   ixCfgToggleAncha(); await w(700);
   const vuelta=sb.getBoundingClientRect().width;
   return { estrecho, ancho, vuelta, texto, guardado, ventana:window.innerWidth };
 });

 // al recargar sigue ancha (que es lo que significa «se recuerda»)
 await p.evaluate(()=>{ localStorage.setItem('ix_cfg_ancha','1'); });
 await p.reload({waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixCfgAncha==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 o.trasRecargar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const sb=document.getElementById('left-sidebar');
   const clase=sb.classList.contains('ancha');
   if(!sb.classList.contains('open')) toggleSidebar();
   await w(700);
   const ancho=sb.getBoundingClientRect().width;
   localStorage.setItem('ix_cfg_ancha','0'); ixCfgAplicarAncha(); await w(600);
   return { clase, ancho };
 });

 // ═══════════ VELOCIDAD AL ARRASTRAR ═══════════
 // Se arrastra una ventana de verdad y se miden los pixeles que se mueve,
 // primero a 1×, luego a 2× y luego a 0,5×. Si el ajuste fuera de mentira,
 // los tres numeros saldrian iguales.
 //
 // Con el raton DE VERDAD de Playwright, no con eventos inventados: el
 // arrastre usa setPointerCapture, y a un PointerEvent hecho a mano el
 // navegador le dice que no hay puntero activo con ese id.
 await p.evaluate(()=>{
   const el=document.createElement('div');
   el.id='ixPruebaVentana';
   el.style.cssText='position:fixed;left:100px;top:100px;width:300px;height:200px;z-index:99999;background:#222;';
   el.innerHTML='<div class="bwin-titlebar" style="height:40px;background:#333;"></div>';
   document.body.appendChild(el);
   _bwinSetupDrag(el, el.querySelector('.bwin-titlebar'));
 });
 const arrastrar = async (vel)=>{
   await p.evaluate(v=>{
     ixPonerVelArrastre(v);
     const el=document.getElementById('ixPruebaVentana');
     el.style.left='100px'; el.style.top='100px';
   }, vel);
   await p.mouse.move(150, 120);
   await p.mouse.down();
   await p.mouse.move(200, 120, {steps:5});
   await p.mouse.move(250, 120, {steps:5});   // 100 px en total
   const movido = await p.evaluate(()=>parseFloat(document.getElementById('ixPruebaVentana').style.left)-100);
   await p.mouse.up();
   return movido;
 };
 o.arrastre = { normal: await arrastrar(1), doble: await arrastrar(2), mitad: await arrastrar(0.5) };
 await p.evaluate(()=>{ ixPonerVelArrastre(1); document.getElementById('ixPruebaVentana').remove(); });

 // el deslizador se acota: ni 0 ni 99, y la basura vale 1
 o.limites = await p.evaluate(()=>{
   const r={};
   r.alto = ixPonerVelArrastre(99);
   r.bajo = ixPonerVelArrastre(0);
   r.nada = ixPonerVelArrastre('hola');
   localStorage.setItem('ix_vel_arrastre','-40');
   r.leidoSucio = ixVelArrastre();
   ixPonerVelArrastre(1);
   return r;
 });

 // y al arrancar, el deslizador de la pantalla enseña lo guardado
 o.deslizador = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   localStorage.setItem('ix_vel_arrastre','1.5');
   ixArrancarPantallaControl(); await w(150);
   const s=document.getElementById('cfg-vel');
   const lbl=document.getElementById('cfg-vel-lbl');
   const r={ valor:s?s.value:null, etiqueta:lbl?lbl.textContent:null };
   localStorage.setItem('ix_vel_arrastre','1'); ixArrancarPantallaControl();
   return r;
 });

 // ═══════════ QUE LA PANTALLA LO CUENTE COMO ES ═══════════
 o.texto = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   showTab('more'); await w(500);
   const t=document.getElementById('tab-more').innerText;
   return {
     hercios: /hercios[^.]*no se pueden cambiar|no se pueden cambiar desde una página web/i.test(t),
     raton:   /sensibilidad del ratón la manda tu sistema/i.test(t),
     hayTres: !!document.getElementById('cfg-cal-alta')
           && !!document.getElementById('cfg-cal-media')
           && !!document.getElementById('cfg-cal-ahorro'),
     hayVel:  !!document.getElementById('cfg-vel'),
     hayAncha:!!document.getElementById('cfg-ancha-btn'),
   };
 });

 // el botón marcado es el de la calidad puesta
 o.marcado = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   ixPonerCalidad('media'); await w(200);
   const r={ media:document.getElementById('cfg-cal-media').classList.contains('active'),
             alta: document.getElementById('cfg-cal-alta').classList.contains('active') };
   ixPonerCalidad('alta');
   return r;
 });

 await p.close(); await b.close(); srv.close();

 const c=o.calidad;
 const pruebas=[
  ['los tres botones de calidad están', o.texto.hayTres===true, JSON.stringify(o.texto)],
  ['ALTA: el cristal va desenfocado',   c.alta.px>=30,          c.alta.px+'px'],
  ['MEDIA: baja el desenfoque',         c.media.clase===true && c.media.px>0 && c.media.px<c.alta.px/2, c.media.px+'px vs '+c.alta.px],
  ['AHORRO: se quita del todo',         c.ahorro.clase===true && c.ahorro.px===0, c.ahorro.texto],
  ['y pone fondo sólido para que se lea', /^rgba?\(/.test(c.ahorro.fondo) && !/, ?0\)$/.test(c.ahorro.fondo), c.ahorro.fondo],
  ['se guarda la elección',             c.ahorro.guardado==='ahorro', c.ahorro.guardado],
  ['volver a ALTA lo recupera',         Math.abs(c.vuelta.px-c.alta.px)<1, c.vuelta.px+' vs '+c.alta.px],
  ['AHORRO para el fondo animado',      o.fondo.hay===false || (o.fondo.ahorro==='none' && o.fondo.alta!==undefined), JSON.stringify(o.fondo)],
  ['una calidad basura guardada no cuela', o.basura.calidad==='alta' && o.basura.sucio===false, JSON.stringify(o.basura)],
  ['el botón marcado es el que toca',   o.marcado.media===true && o.marcado.alta===false, JSON.stringify(o.marcado)],
  ['PANEL ANCHO: se ensancha de verdad',o.ancha.ancho > o.ancha.estrecho*2, o.ancha.estrecho+' → '+o.ancha.ancho],
  ['sin salirse de la ventana',         o.ancha.ancho <= o.ancha.ventana, o.ancha.ancho+' / '+o.ancha.ventana],
  ['y se puede volver a estrecho',      Math.abs(o.ancha.vuelta-o.ancha.estrecho)<2, o.ancha.vuelta+' vs '+o.ancha.estrecho],
  ['el botón dice cómo volver',         /estrecho/i.test(o.ancha.texto), o.ancha.texto],
  ['sigue ancho al recargar',           o.trasRecargar.clase===true && o.trasRecargar.ancho>600, JSON.stringify(o.trasRecargar)],
  ['ARRASTRE 1×: mueve lo que arrastras', Math.abs(o.arrastre.normal-100)<2, o.arrastre.normal],
  ['2×: mueve el doble',                Math.abs(o.arrastre.doble-200)<3,  o.arrastre.doble],
  ['0,5×: mueve la mitad',              Math.abs(o.arrastre.mitad-50)<3,   o.arrastre.mitad],
  ['no se pasa de 2× ni baja de 0,5×',  o.limites.alto===2 && o.limites.bajo===0.5, JSON.stringify(o.limites)],
  ['y la basura vale 1×',               o.limites.nada===1 && o.limites.leidoSucio===0.5, JSON.stringify(o.limites)],
  ['el deslizador enseña lo guardado',  parseFloat(o.deslizador.valor)===1.5 && /1\.5×/.test(o.deslizador.etiqueta||''), JSON.stringify(o.deslizador)],
  ['DICE que los Hz no se tocan',       o.texto.hercios===true, o.texto.hercios],
  ['y que el ratón lo manda el sistema',o.texto.raton===true,   o.texto.raton],
  ['sin errores de página',             errs.length===0,        errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})();
