// Lo que la sincronización promete llevar, ¿existe de verdad?
//
// La lista de claves que viajan entre aparatos (IX_NUBE_CLAVES) decía
// «radio_favs», pero las favoritas de la radio se guardan como
// «ix_radio_favorites»: las emisoras favoritas NUNCA pasaban de un aparato a
// otro, y la pantalla decía que sí. Aquí se comprueba:
//  · con la app de verdad: marcar una favorita, crear una alarma y un evento,
//    y que ixNubeRecoger() (lo que se sube) los lleve;
//  · y que cada clave de la lista la escribe ALGÚN sitio del código, para que
//    un nombre mal escrito no vuelva a colarse sin que nadie lo vea.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9273);

const html=fs.readFileSync(ROOT+'/index.html','utf8');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9273/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof ixNubeRecoger==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 const o=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const st=STATIONS.find(s=>s.type==='stream');
   toggleFavoritaRadio(st.id); await w(100);
   // Una alarma como las que pone el asistente («ponme una alarma a las 7»)
   addAlarm(7, 15, 'Del asistente'); await w(200);
   const sube=ixNubeRecoger();
   let favSubida=null; for(const k in sube){ if(sube[k].indexOf(st.id)>=0 && /fav/i.test(k)) favSubida=k; }
   return { claves:IX_NUBE_CLAVES.slice(), fav:st.id, favSubida, subeFav:Object.keys(sube).filter(k=>/fav/i.test(k)),
            alarmaSubida:(sube.alarms||'').indexOf('Del asistente')>=0,
            // Y al revés: lo que baja se aplica y, al recargar, la app lo lee
            aplica:(function(){ localStorage.removeItem('ix_radio_favorites'); ixNubeAplicar(sube); return localStorage.getItem('ix_radio_favorites'); })() };
 });
 await b.close(); srv.close();

 // Cada clave de la lista la escribe algún sitio (directamente o a través
 // de una constante IX_…='clave', o de window.storage.set).
 const escrita=k=>{
   const lit="['\"]"+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+"['\"]";
   if(new RegExp('setItem\\(\\s*'+lit).test(html)) return true;
   if(new RegExp('storage\\.set\\(\\s*'+lit).test(html)) return true;
   const c=new RegExp('(IX_[A-Z_]+)\\s*=\\s*'+lit).exec(html);
   return !!c && new RegExp('setItem\\(\\s*'+c[1]+'\\b').test(html);
 };
 const huerfanas=o.claves.filter(k=>!escrita(k));
 const pruebas=[
  ['una favorita marcada SE SUBE a la nube',   o.favSubida==='ix_radio_favorites', o.favSubida+' '+JSON.stringify(o.subeFav)],
  ['y al bajarla se guarda donde la app lee',  (o.aplica||'').indexOf(o.fav)>=0, o.aplica],
  ['las alarmas que pone el asistente también se suben', o.alarmaSubida===true, o.alarmaSubida],
  ['la lista ya no nombra «radio_favs»',       o.claves.indexOf('radio_favs')<0, o.claves.join(',')],
  ['TODA clave de la lista la escribe alguien',huerfanas.length===0, huerfanas.join(' ')||o.claves.length+' claves'],
  ['sin errores de página',                    errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
