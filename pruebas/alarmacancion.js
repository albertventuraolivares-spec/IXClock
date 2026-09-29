// Despertar con tu canción de IXBand (idea 61).
//
// Se guardan canciones de IXBand como las guarda la app (Mis canciones y «lo
// último que tocaste») y se usa la hoja de alarma de verdad. Las notas se
// cuentan envolviendo gbPlayNote/gbPlayDrum, que es por donde sale todo el
// sonido de IXBand. Se comprueba:
//  · la hoja ofrece las canciones que suenan (no las vacías ni las mudas);
//  · elegir una la deja puesta, apaga el tono y la hace sonar de prueba;
//  · la alarma guardada la recuerda y la lista la nombra («🎸 Mi riff»);
//  · al sonar la alarma (por el comprobador de cada minuto) toca la canción
//    EN BUCLE, con batería, sin la pista silenciada, y se calla al pararla;
//  · si la canción ya no existe, suena el tono de siempre: nunca muda.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9293);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1300,height:1000}, locale:'es-ES'});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.addInitScript(()=>{ try{
   const riff={ bpm:120, secciones:[{id:'s1',nombre:'A'},{id:'s2',nombre:'B'}], takes:[
     {name:'piano', sec:'s1', events:[{at:0,freq:440,type:'piano',vel:1},{at:300,freq:523.25,type:'piano',vel:1}]},
     {name:'muda',  sec:'s1', muted:true, events:[{at:0,freq:880,type:'piano',vel:1}]},
     {name:'drums', sec:'s2', events:[{at:0,type:'drum',drumType:'kick',freq:60,vel:1}]},
   ]};
   const muda={ bpm:120, secciones:[{id:'s1',nombre:'A'}], takes:[{name:'x', sec:'s1', muted:true, events:[{at:0,freq:440,type:'piano',vel:1}]}] };
   localStorage.setItem('ixband_canciones_v1', JSON.stringify([
     {id:'c1', nombre:'Mi riff', fecha:1, datos:riff},
     {id:'c2', nombre:'Toda muda', fecha:1, datos:muda},
     {id:'c3', nombre:'Vacía', fecha:1, datos:{takes:[]}},
   ]));
   localStorage.setItem('ixband_cancion_v1', JSON.stringify({v:1, takes:[]}));
   localStorage.removeItem('ica_alarms');
 }catch(e){} });
 await p.goto('http://localhost:9293/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof _icaHojaAlarma==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 const o=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   try{ ixCerrarBienvenida(); }catch(e){}
   if(typeof ixCancionesParaAlarma!=='function') return {falta:true};
   const notas=[], tonos=[];
   const pn=window.gbPlayNote, pd=window.gbPlayDrum, pt=window.playAlarmTone;
   window.gbPlayNote=function(f,t,v){ notas.push(Math.round(f)); };
   window.gbPlayDrum=function(t){ notas.push(t); };
   window.playAlarmTone=function(id){ tonos.push(id); return function(){}; };
   const r={};
   // ── La hoja ──
   _icaHojaAlarma(); await w(200);
   const botones=[].slice.call(document.querySelectorAll('#ica-alarm-sheet .ica-cancion'));
   r.ofrece=botones.map(x=>x.textContent.trim());
   const bt=botones.find(x=>/Mi riff/.test(x.textContent));
   if(bt) bt.click();
   await w(700);
   r.input=document.getElementById('ica-alarm-tone').value;
   r.marcado=bt ? bt.style.background : '';
   r.tonosApagados=[].slice.call(document.querySelectorAll('.ica-tono')).every(x=>x.style.background.indexOf('10, 132, 255')<0 && x.style.background.indexOf('10,132,255')<0);
   r.prueba=notas.slice();
   // Cambiar a un tono apaga la canción
   icaProbarTono('apex');
   r.trasTono={ input:document.getElementById('ica-alarm-tone').value, bt:bt?bt.style.background:'' };
   if(bt) bt.click(); await w(100);
   document.getElementById('ica-alarm-h').value='07'; document.getElementById('ica-alarm-m').value='30';
   icaGuardarAlarma(); await w(200);
   try{ if(_icaTonoPrueba){ _icaTonoPrueba(); _icaTonoPrueba=null; } }catch(e){}
   r.guardada=(_icaAlarms[_icaAlarms.length-1]||{}).tone;
   r.nombre=icaToneName('ixband:c1');
   // ── Suena la alarma (por el comprobador de verdad) ──
   await w(300); notas.length=0; tonos.length=0;
   const d=new Date(); d.setHours(7,30,0,0);
   _checkIcaMinuto(d);
   await w(4200);   // una vuelta dura ~2,7 s: la segunda tiene que haber sonado entera
   r.sonando=document.getElementById('alarm-ringing-overlay').classList.contains('show');
   r.notas=notas.slice(); r.tonosAlSonar=tonos.slice();
   stopRinging();
   const n=notas.length; await w(3000);
   r.trasParar=notas.length-n;
   // ── La canción ya no existe ──
   notas.length=0; tonos.length=0;
   ringAlarm({id:'x', hour:8, minute:0, label:'Otra', tone:'ixband:borrada'});
   await w(600);
   r.borrada={ tonos:tonos.slice(), notas:notas.length };
   stopRinging();
   window.gbPlayNote=pn; window.gbPlayDrum=pd; window.playAlarmTone=pt;
   return r;
 });
 await b.close(); srv.close();

 const cuenta=(a,x)=>(a||[]).filter(v=>v===x).length;
 const pruebas=[
  ['existe',                                         !o.falta, !o.falta],
  ['la hoja ofrece SOLO las canciones que suenan',   JSON.stringify(o.ofrece)==='["🎸 Mi riff"]', JSON.stringify(o.ofrece)],
  ['elegirla la deja puesta',                        o.input==='ixband:c1', o.input],
  ['se ve marcada y los tonos apagados',             /10, 132, 255/.test(o.marcado||'') && o.tonosApagados, o.marcado+' '+o.tonosApagados],
  ['y suena de prueba',                              cuenta(o.prueba,440)>=1 && cuenta(o.prueba,523)>=1, JSON.stringify(o.prueba)],
  ['elegir un tono la desmarca',                     !!o.trasTono && o.trasTono.input==='apex' && !/10, 132, 255/.test(o.trasTono.bt), JSON.stringify(o.trasTono)],
  ['la alarma guardada la recuerda',                 o.guardada==='ixband:c1', o.guardada],
  ['y la lista la nombra «🎸 Mi riff»',              o.nombre==='🎸 Mi riff', o.nombre],
  ['AL SONAR toca la canción',                       o.sonando===true && cuenta(o.notas,440)>=1 && cuenta(o.notas,523)>=1, JSON.stringify(o.notas)],
  ['con su batería (sección B)',                     cuenta(o.notas,'kick')>=1, JSON.stringify(o.notas)],
  ['EN BUCLE (dos vueltas)',                         cuenta(o.notas,440)>=2 && cuenta(o.notas,'kick')>=2, JSON.stringify(o.notas)],
  ['sin la pista silenciada',                        cuenta(o.notas,880)===0, JSON.stringify(o.notas)],
  ['sin el tono encima',                             (o.tonosAlSonar||[]).length===0, JSON.stringify(o.tonosAlSonar)],
  ['al pararla se calla',                            o.trasParar===0, o.trasParar],
  ['canción borrada → suena el tono de siempre',     !!o.borrada && JSON.stringify(o.borrada.tonos)==='["radial"]' && o.borrada.notas===0, JSON.stringify(o.borrada)],
  ['sin errores de página',                          errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
