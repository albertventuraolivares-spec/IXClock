// Despertar con una emisora de radio en vez de un tono.
//
// Lo que de verdad importa aqui no es que suene la radio: es que SUENE ALGO.
// Un despertador que se queda mudo porque el stream no cargo, o porque no hay
// internet a las 7 de la manana, no es un despertador. Por eso el tono arranca
// igual, siempre, y solo se calla cuando la emisora ha empezado de verdad.
// Eso es lo que mas se prueba: los tres finales (la radio entra, la radio
// tarda, no hay red).
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9243);

async function arranca(ctx){
  const p=await ctx.newPage();
  p.on('pageerror',e=>{ p._errs=p._errs||[]; p._errs.push(e.message.split('\n')[0]); });
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:9243/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof playRingingSound==='function' && typeof esTonoDeRadio==='function'
    && typeof toggleFavoritaRadio==='function', null,{timeout:30000}).catch(()=>{});
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
  try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
  await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
    return !l || getComputedStyle(l).display==='none'; },null,{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(1800);
  await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
  return p;
}

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
   args:['--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:1280,height:1000}});
 let p=await arranca(ctx);
 const o={};

 // --- el tono se guarda como "radio:<id>" y se sabe leer ---
 o.formato = await p.evaluate(()=>({
   loReconoce: esTonoDeRadio('radio:jazz'),
   sacaElId: emisoraDelTono('radio:jazz'),
   unTonoNormalNo: esTonoDeRadio('radial'),
   nadaNoRompe: esTonoDeRadio(null)===false && emisoraDelTono('radial')===null
 }));

 // --- en la lista se dice con QUE te despierta, no "Radial" ---
 o.nombre = await p.evaluate(()=>{
   const st=STATIONS[3];
   return { conEmisora: icaToneName('radio:'+st.id),
            esperado: st.title,
            conTono: icaToneName('campana'),
            emisoraBorrada: icaToneName('radio:no-existe-ya') };
 });

 // ═══ LO IMPORTANTE: los tres finales ═══

 // 1) La emisora ENTRA: suena el tono primero y se calla al arrancar la radio
 o.entra = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   let tonos=0, parados=0, puesta=null;
   const opa=window.playAlarmTone, os=window.setStation;
   window.playAlarmTone=()=>{ tonos++; return ()=>{ parados++; }; };
   window.setStation=id=>{ puesta=id; };
   isPlaying=false;
   playRingingSound('radio:jazz'); await w(300);
   const alPrincipio={ tonoSonando: tonos===1, tonoParado: parados, radioPedida: puesta };
   isPlaying=true;                       // la emisora arranca de verdad
   await w(900);
   const despues={ tonoParado: parados>0 };
   try{ ringingAudioStop&&ringingAudioStop(); }catch(e){}
   window.playAlarmTone=opa; window.setStation=os; isPlaying=false;
   return { alPrincipio, despues };
 });

 // 2) La emisora NO entra (sin red): el tono sigue sonando, no te quedas mudo
 o.sinRed = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   let tonos=0, parados=0, radioCortada=0;
   const opa=window.playAlarmTone, os=window.setStation, ost=window.stopAudio;
   window.playAlarmTone=()=>{ tonos++; return ()=>{ parados++; }; };
   window.setStation=()=>{ throw new Error('sin red'); };   // lo peor: revienta
   window.stopAudio=()=>{ radioCortada++; };
   isPlaying=false;
   let revento=false;
   try{ playRingingSound('radio:jazz'); }catch(e){ revento=true; }
   await w(1200);
   const r={ revento, tonoSonando: tonos===1, tonoSigue: parados===0 };
   try{ ringingAudioStop&&ringingAudioStop(); }catch(e){}
   await w(200);
   r.alApagar = parados>0;
   window.playAlarmTone=opa; window.setStation=os; window.stopAudio=ost;
   return r;
 });

 // 3) Apagar la alarma para las DOS cosas y no deja nada corriendo
 o.apagar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   let parados=0, radioCortada=0;
   const opa=window.playAlarmTone, os=window.setStation, ost=window.stopAudio;
   window.playAlarmTone=()=>()=>{ parados++; };
   window.setStation=()=>{};
   window.stopAudio=()=>{ radioCortada++; };
   isPlaying=false;
   playRingingSound('radio:jazz'); await w(300);
   stopRinging(); await w(400);
   const r={ tono:parados>0, radio:radioCortada>0, vigilante:_radioDespertarVigila===null };
   window.playAlarmTone=opa; window.setStation=os; window.stopAudio=ost;
   return r;
 });

 // --- un tono normal sigue funcionando exactamente igual que antes ---
 o.tonoNormal = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   let cual=null, tocoRadio=false;
   const opa=window.playAlarmTone, os=window.setStation;
   window.playAlarmTone=(id)=>{ cual=id; return ()=>{}; };
   window.setStation=()=>{ tocoRadio=true; };
   playRingingSound('campana'); await w(300);
   try{ ringingAudioStop&&ringingAudioStop(); }catch(e){}
   window.playAlarmTone=opa; window.setStation=os;
   return { cual, tocoRadio };
 });

 // --- la hoja: sin favoritas se explica cómo marcarlas ---
 o.sinFavs = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   localStorage.removeItem('ix_radio_favorites'); _radioFavs=[];
   _icaAlarms.length=0;
   icaAddAlarm(); await w(400);
   const h=document.getElementById('ica-alarm-sheet');
   const t=h?h.innerText:'';
   const botones=h?h.querySelectorAll('.ica-emisora').length:0;
   _icaCerrarHoja();
   return { explica:/marca emisoras/i.test(t), botones };
 });

 // --- con favoritas, salen y se pueden elegir ---
 o.conFavs = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   _radioFavs=[STATIONS[3].id, STATIONS[7].id];
   localStorage.setItem('ix_radio_favorites', JSON.stringify(_radioFavs));
   icaAddAlarm(); await w(400);
   const h=document.getElementById('ica-alarm-sheet');
   const botones=[].slice.call(h.querySelectorAll('.ica-emisora'));
   const salenLosNombres = botones.some(b=>b.textContent.indexOf(STATIONS[3].title)>=0);
   // se elige una
   icaElegirEmisora(STATIONS[3].id); await w(250);
   const valor=document.getElementById('ica-alarm-tone').value;
   const marcada=botones.filter(b=>/rgba\(10, 132, 255/.test(b.style.background)).length;
   // y elegir un TONO la desmarca: es uno u otro
   icaProbarTono('campana'); await w(250);
   const trasTono={ valor:document.getElementById('ica-alarm-tone').value,
                    emisorasMarcadas:botones.filter(b=>/rgba\(10, 132, 255/.test(b.style.background)).length };
   // se vuelve a la emisora y se guarda
   icaElegirEmisora(STATIONS[3].id); await w(200);
   document.getElementById('ica-alarm-h').value='07';
   document.getElementById('ica-alarm-m').value='00';
   document.getElementById('ica-alarm-label').value='despertar';
   icaGuardarAlarma(); await w(400);
   const g=JSON.parse(localStorage.getItem('ica_alarms')||'[]')[0]||{};
   const lista=document.getElementById('ica-alarms-list');
   return { nBotones:botones.length, salenLosNombres, valor, marcada, trasTono,
            guardado:g.tone, enLaLista:(lista?lista.innerText:'') };
 });

 // --- un nombre de emisora con código no se ejecuta ---
 o.xss = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__pwn=0;
   STATIONS.push({id:'mala', title:'<img src=x onerror="window.__pwn=1">', sub:'x',
                  country:'Prueba', flag:'🏳️', tags:'', type:'stream'});
   _radioFavs=['mala'];
   _icaAlarms.length=0;
   _icaAlarms.push({time:'7:00', label:'x', on:true, tone:'radio:mala'});
   icaRenderAlarms(); await w(300);
   const enLista=window.__pwn;
   icaAddAlarm(); await w(400);
   const enHoja=window.__pwn;
   _icaCerrarHoja();
   STATIONS.pop(); _radioFavs=[];
   return { enLista, enHoja };
 });

 // --- SOBREVIVE a recargar ---
 await p.evaluate(()=>{
   _radioFavs=[STATIONS[3].id];
   localStorage.setItem('ix_radio_favorites', JSON.stringify(_radioFavs));
   localStorage.setItem('ica_alarms', JSON.stringify(
     [{time:'7:00', label:'despertar', on:true, tone:'radio:'+STATIONS[3].id}]));
 });
 await p.close();
 p = await arranca(ctx);
 o.trasRecargar = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   icaRenderAlarms(); await w(300);
   return { tono:_icaAlarms[0].tone,
            loDice:/📻/.test(document.getElementById('ica-alarms-list').innerText) };
 });
 const errs=p._errs||[];
 await p.close();

 const pruebas=[
  ['reconoce el tono de radio',   o.formato.loReconoce===true && o.formato.sacaElId==='jazz', JSON.stringify(o.formato)],
  ['y un tono normal no lo es',   o.formato.unTonoNormalNo===false && o.formato.nadaNoRompe===true, o.formato.unTonoNormalNo],
  ['la lista dice QUÉ emisora',   o.nombre.conEmisora.indexOf(o.nombre.esperado)>=0, o.nombre.conEmisora],
  ['y con tono dice el tono',     o.nombre.conTono==='Campana',  o.nombre.conTono],
  ['una emisora borrada no rompe',/radio/i.test(o.nombre.emisoraBorrada), o.nombre.emisoraBorrada],
  ['EL TONO SUENA DESDE EL PRIMER SEGUNDO', o.entra.alPrincipio.tonoSonando===true, JSON.stringify(o.entra.alPrincipio)],
  ['y se pide la emisora',        o.entra.alPrincipio.radioPedida==='jazz', o.entra.alPrincipio.radioPedida],
  ['al entrar la radio, se calla el tono', o.entra.despues.tonoParado===true, o.entra.despues.tonoParado],
  ['SIN RED no revienta',         o.sinRed.revento===false,      o.sinRed.revento],
  ['y el tono te despierta igual',o.sinRed.tonoSonando===true && o.sinRed.tonoSigue===true, JSON.stringify(o.sinRed)],
  ['y se para al apagar',         o.sinRed.alApagar===true,      o.sinRed.alApagar],
  ['apagar corta tono Y radio',   o.apagar.tono===true && o.apagar.radio===true, JSON.stringify(o.apagar)],
  ['sin dejar nada corriendo',    o.apagar.vigilante===true,     o.apagar.vigilante],
  ['un tono normal va como antes',o.tonoNormal.cual==='campana' && o.tonoNormal.tocoRadio===false, JSON.stringify(o.tonoNormal)],
  ['sin favoritas se explica',    o.sinFavs.explica===true && o.sinFavs.botones===0, JSON.stringify(o.sinFavs)],
  ['con favoritas salen',         o.conFavs.nBotones===2 && o.conFavs.salenLosNombres===true, o.conFavs.nBotones+' emisoras'],
  ['elegir una la marca',         o.conFavs.marcada===1,         o.conFavs.marcada],
  ['y guarda radio:<id>',         /^radio:.+/.test(o.conFavs.valor||''), o.conFavs.valor],
  ['elegir un tono la desmarca',  o.conFavs.trasTono.valor==='campana' && o.conFavs.trasTono.emisorasMarcadas===0, JSON.stringify(o.conFavs.trasTono)],
  ['la alarma se guarda con la emisora', /^radio:/.test(o.conFavs.guardado||''), o.conFavs.guardado],
  ['y la lista lo enseña',        /📻/.test(o.conFavs.enLaLista||''), (o.conFavs.enLaLista||'').split('\n').slice(0,3).join(' · ')],
  ['un nombre con código no se ejecuta', o.xss.enLista===0 && o.xss.enHoja===0, JSON.stringify(o.xss)],
  ['SOBREVIVE a recargar',        /^radio:/.test(o.trasRecargar.tono||'') && o.trasRecargar.loDice===true, JSON.stringify(o.trasRecargar)],
  ['sin errores de página',       errs.length===0,               errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
