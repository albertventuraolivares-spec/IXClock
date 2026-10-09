// Compartir un fondo por enlace.
//
// Dos navegadores: uno comparte, el otro abre. Se comprueba:
//  · un fondo de la galería da «?fondo=<id>»; uno de YouTube, «?fondo=yt:ID»;
//  · una foto tuya o el dinámico NO se comparten (y lo dice);
//  · quien abre el enlace ve el fondo puesto y guardado, el «?fondo=» se va
//    de la dirección, y «Deshacer» le devuelve el suyo;
//  · un fondo que no existe (o un valor raro) avisa y no toca nada.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9304);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const abrir=async(url, permisos)=>{
   const ctx=await b.newContext({viewport:{width:1300,height:1000}, locale:'es-ES', permissions:permisos||[]});
   const p=await ctx.newPage();
   const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
   await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
   await p.addInitScript(()=>{ window.__toasts=[]; });
   await p.goto(url,{waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>typeof setWallpaper==='function',null,{timeout:30000}).catch(()=>{});
   await p.evaluate(()=>{ const t=window.ixToast; window.ixToast=function(m){ window.__toasts.push(m); try{ t(m); }catch(e){} }; });
   await p.waitForTimeout(2500);
   await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
   try{ await p.click('text=Continuar como invitado',{timeout:2500}); }catch(e){}
   await p.waitForTimeout(1000);
   await p.evaluate(()=>{ try{ ixCerrarBienvenida(); }catch(e){} });
   return {ctx,p,errs};
 };
 const o={};
 const A=await abrir('http://localhost:9304/', ['clipboard-read','clipboard-write']);
 o.falta=await A.p.evaluate(()=>typeof ixCompartirFondo!=='function');
 if(!o.falta){
   o.a=await A.p.evaluate(async()=>{
     const w=m=>new Promise(r=>setTimeout(r,m));
     const id=WALLPAPERS.find(x=>x.id!=='ios27' && x.type==='gradient' || x.type==='photo' && x.id!=='ios27').id;
     window.setWallpaper(id); await w(300);
     navigator.share=undefined;
     document.getElementById('wp-compartir').click(); await w(400);
     const galeria=await navigator.clipboard.readText();
     _applyCustomWallpaper({ id:'yt-dQw4w9WgXcQ', name:'YouTube', tags:'', type:'youtube', videoId:'dQw4w9WgXcQ' }); await w(200);
     const yt=await ixCompartirFondo();
     _applyCustomWallpaper({ id:'foto', name:'Mi foto', type:'photo', url:'data:image/png;base64,AAAA' }); await w(200);
     window.__toasts.length=0;
     const foto=await ixCompartirFondo();
     return { id, galeria, yt, foto, toasts:window.__toasts.slice() };
   });
   await A.ctx.close();
   // Abre el de la galería
   const B=await abrir(o.a.galeria);
   await B.p.waitForTimeout(800);
   o.b=await B.p.evaluate(()=>({ guardado:localStorage.getItem('saved_wallpaper'), dir:location.search,
     aviso:(document.getElementById('ix-fondo-recibido')||{}).innerText||'' }));
   await B.p.evaluate(()=>{ const bt=document.querySelector('#ix-fondo-recibido button'); if(bt) bt.click(); });
   await B.p.waitForTimeout(400);
   o.deshecho=await B.p.evaluate(()=>({ guardado:localStorage.getItem('saved_wallpaper'), aviso:!!document.getElementById('ix-fondo-recibido') }));
   o.errsB=B.errs.slice(); await B.ctx.close();
   // YouTube
   const C=await abrir(o.a.yt||'http://localhost:9304/');
   await C.p.waitForTimeout(800);
   o.c=await C.p.evaluate(()=>{ const c=JSON.parse(localStorage.getItem('saved_wallpaper_custom')||'null'); return c&&c.type+':'+c.videoId; });
   o.errsC=C.errs.slice(); await C.ctx.close();
   // No existe / raro
   const D=await abrir('http://localhost:9304/?fondo=%3Cimg%20src%3Dx%3E&app=nada');
   await D.p.waitForTimeout(800);
   o.d=await D.p.evaluate(()=>({ guardado:localStorage.getItem('saved_wallpaper'), toasts:window.__toasts.slice(), dir:location.search, aviso:!!document.getElementById('ix-fondo-recibido') }));
   o.errsD=D.errs.slice(); await D.ctx.close();
 }
 await b.close(); srv.close();

 const a=o.a||{};
 const errs=(o.errsB||[]).concat(o.errsC||[]).concat(o.errsD||[]);
 const pruebas=[
  ['existe',                                          !o.falta, !o.falta],
  ['galería: «?fondo=<id>» (copiado)',                a.galeria==='http://localhost:9304/?fondo='+encodeURIComponent(a.id||''), a.galeria],
  ['YouTube: «?fondo=yt:ID»',                         a.yt==='http://localhost:9304/?fondo=yt%3AdQw4w9WgXcQ', a.yt],
  ['una foto tuya no se comparte, y lo dice',         a.foto===null && (a.toasts||[]).some(t=>/no se puede compartir/.test(t)), JSON.stringify(a.toasts)],
  ['quien lo abre lo tiene puesto y guardado',        !!o.b && o.b.guardado===a.id, JSON.stringify(o.b)],
  ['…se lo dice y el «?fondo=» se va',                !!o.b && /Te han pasado un fondo/.test(o.b.aviso) && o.b.dir==='', JSON.stringify(o.b)],
  ['«Deshacer» le devuelve el suyo',                  !!o.deshecho && o.deshecho.guardado==='ios27' && !o.deshecho.aviso, JSON.stringify(o.deshecho)],
  ['el de YouTube llega como YouTube',                o.c==='youtube:dQw4w9WgXcQ', o.c],
  ['valor raro: avisa, no toca nada, deja lo demás',  !!o.d && o.d.guardado==='ios27' && o.d.toasts.some(t=>/ya no existe/.test(t)) && !o.d.aviso && o.d.dir==='?app=nada', JSON.stringify(o.d)],
  ['sin errores de página',                           errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
