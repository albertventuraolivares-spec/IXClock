// IXBand exporta MIDI de verdad (idea 32).
//
// Se monta una canción con tomas conocidas (dos secciones, una pista
// silenciada, piano, bajo y batería), se exporta con la función real y el
// archivo se LEE con un lector de MIDI escrito aquí, que no comparte código
// con la app. Así se comprueba lo que vería un programa de música:
//  · cabecera correcta (formato 1, 480 ticks por negra) y el tempo de la
//    canción (120 bpm → 500.000 µs por negra);
//  · una pista por toma que suena, con su nombre; la silenciada NO va;
//  · el La 440 es la nota 69, y el Do central (261,63 Hz) la 60;
//  · la batería va al canal 10 con los números GM (bombo 36, caja 38);
//  · la sección B empieza donde acaba la A + 400 ms, como al reproducir;
//  · el bajo lleva su instrumento (programa 33);
//  · y el botón «🎹 MIDI» descarga un archivo .mid.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9291);

// ── Lector de MIDI independiente ──
function leerMidi(buf){
  let i=0; const u8=()=>buf[i++], u16=()=>(buf[i++]<<8)|buf[i++], u32=()=>((buf[i++]<<24)|(buf[i++]<<16)|(buf[i++]<<8)|buf[i++])>>>0;
  const vlq=()=>{ let n=0,b; do{ b=buf[i++]; n=(n<<7)|(b&0x7F); }while(b&0x80); return n; };
  const tag=()=>String.fromCharCode(buf[i++],buf[i++],buf[i++],buf[i++]);
  if(tag()!=='MThd') throw new Error('sin MThd');
  u32(); const formato=u16(), n=u16(), division=u16();
  const pistas=[];
  for(let k=0;k<n;k++){
    if(tag()!=='MTrk') throw new Error('sin MTrk '+k);
    const len=u32(), fin=i+len; let t=0, estado=0; const ev=[]; let nombre='', tempo=null, programa=null, finPista=false;
    while(i<fin){
      t+=vlq(); let b=buf[i];
      if(b===0xFF){ i++; const tipo=u8(), l=vlq(); const d=buf.slice(i,i+l); i+=l;
        if(tipo===0x03) nombre=Buffer.from(d).toString('utf8');
        if(tipo===0x51) tempo=(d[0]<<16)|(d[1]<<8)|d[2];
        if(tipo===0x2F) finPista=true;
        continue; }
      if(b&0x80){ estado=b; i++; }
      const tipo=estado&0xF0, canal=estado&0x0F;
      if(tipo===0x90||tipo===0x80){ const nota=u8(), vel=u8(); ev.push({t, on:tipo===0x90&&vel>0, canal, nota, vel}); }
      else if(tipo===0xC0){ programa=u8(); }
      else { u8(); u8(); }
    }
    pistas.push({nombre, tempo, programa, ev, finPista});
  }
  return {formato, n, division, pistas};
}

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1300,height:1000}, locale:'es-ES', acceptDownloads:true});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9291/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof openGarageBand==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 const datos=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   try{ ixCerrarBienvenida(); }catch(e){}
   openGarageBand(); await w(500);
   if(typeof ixMidiDeCancion!=='function') return null;
   _gbBpm=120;
   _gbSecciones=[{id:'s1',nombre:'A'},{id:'s2',nombre:'B'}];
   _gbTakes=[
     {name:'piano', sec:'s1', muted:false, solo:false, vol:1, pan:0, events:[{at:0,freq:440,type:'sine',vel:1},{at:500,freq:261.63,type:'sine',vel:0.5}]},
     {name:'drums', sec:'s1', muted:false, solo:false, vol:1, pan:0, events:[{at:0,type:'drum',drumType:'kick',vel:1,freq:60},{at:1000,type:'drum',drumType:'snare',vel:1,freq:200}]},
     {name:'silenciada', sec:'s1', muted:true, solo:false, vol:1, pan:0, events:[{at:0,freq:880,type:'sine',vel:1}]},
     {name:'bass', sec:'s2', muted:false, solo:false, vol:1, pan:0, events:[{at:0,freq:110,type:'sine',vel:0.8}]},
   ];
   try{ gbRenderTracks(); }catch(e){}
   return Array.from(ixMidiDeCancion());
 });
 // El botón descarga un .mid
 let descarga=null;
 try{
   const [d]=await Promise.all([p.waitForEvent('download',{timeout:5000}), p.evaluate(()=>{ const bt=[].slice.call(document.querySelectorAll('.gb-chip')).find(x=>/MIDI/.test(x.textContent)); bt.click(); })]);
   descarga={ nombre:d.suggestedFilename() };
 }catch(e){ descarga={error:e.message.split('\n')[0]}; }
 await b.close(); srv.close();

 let m=null, err=null;
 try{ m=datos && leerMidi(Buffer.from(datos)); }catch(e){ err=e.message; }
 const pista=nm=>m && m.pistas.find(x=>x.nombre===nm);
 const on=pt=>pt ? pt.ev.filter(e=>e.on) : [];
 const piano=pista('piano'), bat=pista('drums'), bajo=pista('bass');
 const tick=ms=>Math.round(ms*480*120/60000);
 const pruebas=[
  ['se genera un MIDI legible',                !!m && !err, err||(m&&m.n+' pistas')],
  ['formato 1 y 480 ticks por negra',          !!m && m.formato===1 && m.division===480, m&&(m.formato+' '+m.division)],
  ['tempo de la canción: 120 bpm',             !!m && m.pistas[0].tempo===500000, m&&m.pistas[0].tempo],
  ['una pista por toma que suena (+ tempo)',   !!m && m.n===4 && !!piano && !!bat && !!bajo, m&&m.pistas.map(x=>x.nombre).join(',')],
  ['la silenciada NO va',                      !pista('silenciada'), 'ok'],
  ['La 440 → nota 69, Do central → 60',        JSON.stringify(on(piano).map(e=>e.nota))==='[69,60]', JSON.stringify(on(piano).map(e=>e.nota))],
  ['a su tiempo (0 y 500 ms)',                  JSON.stringify(on(piano).map(e=>e.t))===JSON.stringify([0,tick(500)]), JSON.stringify(on(piano).map(e=>e.t))],
  ['con su fuerza (vel 1 → 127, 0,5 → 64)',     JSON.stringify(on(piano).map(e=>e.vel))==='[127,64]', JSON.stringify(on(piano).map(e=>e.vel))],
  ['la batería al canal 10, bombo 36 y caja 38', on(bat).every(e=>e.canal===9) && JSON.stringify(on(bat).map(e=>e.nota))==='[36,38]', JSON.stringify(on(bat))],
  ['cada nota se apaga',                        !!m && m.pistas.slice(1).every(pt=>pt.ev.filter(e=>e.on).length===pt.ev.filter(e=>!e.on).length) && m.pistas.every(pt=>pt.finPista), 'ok'],
  ['la sección B empieza tras la A + 400 ms',   on(bajo).length===1 && on(bajo)[0].t===tick(1000+400), on(bajo)[0] && on(bajo)[0].t+' vs '+tick(1400)],
  ['el bajo lleva su instrumento (33)',         !!bajo && bajo.programa===33 && on(bajo)[0].nota===45, bajo&&(bajo.programa+' nota '+on(bajo)[0].nota)],
  ['el botón descarga un .mid',                 !!descarga && /\.mid$/.test(descarga.nombre||''), JSON.stringify(descarga)],
  ['sin errores de página',                     errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
