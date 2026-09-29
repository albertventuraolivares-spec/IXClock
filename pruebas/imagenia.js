// El asistente crea imágenes (idea 15).
//
// El modelo responde con [[IMAGEN prompt="…"]] y la app pinta la imagen en el
// chat (Pollinations, el mismo servicio gratis que ya da el texto). Se prueba
// el camino entero con la conversación de verdad (sendAIMessage), sin red:
// Anthropic se corta, el texto de Pollinations se sustituye por una respuesta
// con la etiqueta, y la imagen por un PNG pequeño. Se comprueba:
//  · la etiqueta no se le enseña al usuario, la imagen sí, con su enlace;
//  · la imagen carga de verdad (tiene tamaño);
//  · una descripción con código se queda en texto (alt) y no se ejecuta;
//  · sin conexión dice que no se pudo, en vez de un hueco vacío.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9292);

const PNG=fs.readFileSync(ROOT+'/favicon-32.png');
let sinRed=false; const pedidas=[];
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1300,height:1000}, locale:'es-ES'});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.route(/image\.pollinations\.ai/, r=>{ pedidas.push(r.request().url()); if(sinRed) return r.abort(); r.fulfill({status:200, contentType:'image/png', body:PNG}); });
 await p.goto('http://localhost:9292/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof sendAIMessage==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 const o=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   try{ ixCerrarBienvenida(); }catch(e){}
   if(!IXA_ACCIONES.IMAGEN) return {falta:true};
   window.siriSpeak=function(){};
   let respuesta='';
   window.callFreeAI=async function(){ return respuesta; };
   const enviar=async(txt, resp)=>{ respuesta=resp; document.getElementById('ai-input').value=txt; await sendAIMessage(); await w(700); };
   const r={};
   await enviar('dibújame un gato astronauta', 'Aquí lo tienes 🐱🚀 [[IMAGEN prompt="a cat astronaut floating in space"]]');
   const msgs=()=>[].slice.call(document.querySelectorAll('#ai-messages .ai-msg')).map(d=>d.innerText);
   const img=document.querySelector('#ai-messages .ai-imagen img');
   r.msgs=msgs();
   r.img=img ? { src:img.src, alt:img.alt, ancho:img.naturalWidth } : null;
   r.enlace=(document.querySelector('#ai-messages .ai-imagen a')||{}).href||'';
   // Con código dentro de la descripción
   window.__pwn=0;
   await enviar('otra', 'Vale [[IMAGEN prompt="<img src=q onerror=window.__pwn=1>"]]');
   const imgs=document.querySelectorAll('#ai-messages .ai-imagen img');
   r.xss={ pwn:window.__pwn, alt:imgs[imgs.length-1] ? imgs[imgs.length-1].alt : null, imgsExtra:document.querySelectorAll('#ai-messages img[src="q"]').length };
   return r;
 });
 // Sin conexión
 sinRed=true;
 o.sinRed=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   ixaPintarImagen('a red bicycle'); await w(800);
   const d=[].slice.call(document.querySelectorAll('#ai-messages .ai-imagen')).pop();
   return d ? d.innerText : '';
 });
 await b.close(); srv.close();

 const pruebas=[
  ['existe la acción IMAGEN',                   !o.falta, !o.falta],
  ['la etiqueta NO se le enseña al usuario',    !!o.msgs && !o.msgs.some(t=>/\[\[IMAGEN/.test(t)) && o.msgs.some(t=>/Aquí lo tienes/.test(t)), JSON.stringify(o.msgs)],
  ['sale la imagen en el chat',                 !!o.img && /image\.pollinations\.ai\/prompt\/a%20cat%20astronaut/.test(o.img.src), o.img&&o.img.src],
  ['y carga de verdad',                         !!o.img && o.img.ancho>0, o.img&&o.img.ancho],
  ['con su descripción como texto alternativo', !!o.img && o.img.alt==='a cat astronaut floating in space', o.img&&o.img.alt],
  ['y un enlace para guardarla',                /image\.pollinations\.ai/.test(o.enlace||''), o.enlace],
  ['confirma «🎨 Imagen: …»',                   !!o.msgs && o.msgs.some(t=>/🎨 Imagen: a cat astronaut/.test(t)), JSON.stringify(o.msgs)],
  ['una descripción con código NO se ejecuta',  !!o.xss && o.xss.pwn===0 && o.xss.imgsExtra===0 && /onerror/.test(o.xss.alt||''), JSON.stringify(o.xss)],
  ['sin conexión lo dice',                      /No se pudo crear la imagen/.test(o.sinRed||''), o.sinRed],
  ['sin errores de página',                     errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
