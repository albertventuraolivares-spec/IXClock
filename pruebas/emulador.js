// El motor del emulador viene de servidores de fuera, y aqui no se puede
// llegar a ellos. Se sustituyen por un servidor local que puede portarse de
// tres maneras: no responder, servir un loader que se descarga pero no
// arranca nada, o servir uno que arranca de verdad. Se comprueba que la app
// reacciona bien a las tres, que es lo que decide lo que ve el usuario.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{
 let f=decodeURIComponent(q.url.split('?')[0]);
 if(f==='/muerto/loader.js'){                      // se descarga pero no hace nada
   s.writeHead(200,{'content-type':'text/javascript'}); return s.end('/* aqui no arranca nada */');
 }
 if(f==='/vivo/loader.js'){                        // arranca de verdad
   s.writeHead(200,{'content-type':'text/javascript'});
   return s.end('window.EJS_emulator={callEvent:function(){}};'
     +'var g=document.getElementById("game");'
     +'if(g){var c=document.createElement("canvas");c.width=64;c.height=64;g.appendChild(c);}');
 }
 if(f==='/') f='/index.html';
 const p=path.join(ROOT,f);
 if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});
 s.end(fs.readFileSync(p));
}).listen(9203);

const BASE='http://localhost:9203/';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1100,height:850}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto(BASE,{waitUntil:'domcontentloaded'});
 await p.waitForTimeout(2600);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForFunction(()=>{ const l=document.getElementById('login-overlay');
   return !l || getComputedStyle(l).display==='none'; }, null, {timeout:20000}).catch(()=>{});
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const preparar = espejos => p.evaluate(e=>{
   EMU_CDNS.splice(0, EMU_CDNS.length);            // es const, pero se puede vaciar
   e.forEach(x=>EMU_CDNS.push(x));
   document.getElementById('emu-modal').style.display='flex';
   document.getElementById('game').innerHTML='';
   try{ delete window.EJS_emulator; }catch(x){ window.EJS_emulator=undefined; }
   _emuLog=[];
   _emuLoadEngine(document.getElementById('emu-hint'), document.getElementById('emu-hint-text'), 0);
 }, espejos);
 const texto = () => p.evaluate(()=>(document.getElementById('emu-hint-text')||{}).innerText||'');
 const o={};

 // --- 1. TODOS los espejos caidos: mensaje claro, no se queda colgado ---
 await preparar([BASE+'no-existe-1/', BASE+'no-existe-2/']);
 await p.waitForTimeout(2500);
 const t1=await texto();
 o.avisaDelFallo   = /No se pudo cargar el motor/.test(t1);
 o.diceCuantos     = /Se probaron 2 servidores/.test(t1);
 o.listaLosDos     = (t1.match(/no responde o está bloqueado/g)||[]).length===2;
 o.explicaQueHacer = /datos móviles|bloqueador/.test(t1);
 o.hintVisible     = await p.evaluate(()=>getComputedStyle(document.getElementById('emu-hint')).display!=='none');

 // --- 2. Un loader que se descarga pero NO arranca: pasa al siguiente ---
 await preparar([BASE+'muerto/', BASE+'no-existe/']);
 await p.waitForTimeout(1200);
 o.diceQueDescargo = /arrancando/.test(await texto());
 await p.waitForTimeout(11000);                    // la comprobacion tarda 9 s
 const t2=await texto();
 o.detectaQueNoArranco = /no llegó a arrancar/.test(t2);
 o.pasaAlSiguiente     = /Se probaron 2 servidores/.test(t2) && /no responde o está bloqueado/.test(t2);

 // --- 3. Un loader que SI arranca: no se toca nada ni sale ningun error ---
 await preparar([BASE+'muerto/', BASE+'vivo/']);
 await p.waitForTimeout(12000);
 const t3=await texto();
 o.acabaArrancando = await p.evaluate(()=>!!window.EJS_emulator && !!document.querySelector('#game canvas'));
 o.sinErrorAlFinal = !/No se pudo cargar el motor/.test(t3);
 o.usoElSegundo    = await p.evaluate(()=>/vivo\//.test(window.EJS_pathtodata||''));

 // --- 4. Si el usuario cierra mientras carga, no se sigue insistiendo ---
 await preparar([BASE+'muerto/', BASE+'no-existe/']);
 await p.waitForTimeout(800);
 await p.evaluate(()=>{ document.getElementById('emu-modal').style.display='none'; _emuLog=[]; });
 await p.waitForTimeout(10500);
 o.noInsisteSiCierras = await p.evaluate(()=>_emuLog.length===0);

 const pruebas=[
  ['avisa si fallan todos',        o.avisaDelFallo===true,        o.avisaDelFallo],
  ['dice cuántos probó',           o.diceCuantos===true,          o.diceCuantos],
  ['y qué pasó con cada uno',      o.listaLosDos===true,          o.listaLosDos],
  ['explica qué hacer',            o.explicaQueHacer===true,      o.explicaQueHacer],
  ['el aviso se ve',               o.hintVisible===true,          o.hintVisible],
  ['avisa de que descargó',        o.diceQueDescargo===true,      o.diceQueDescargo],
  ['DETECTA que no arrancó',       o.detectaQueNoArranco===true,  o.detectaQueNoArranco],
  ['y prueba el siguiente',        o.pasaAlSiguiente===true,      o.pasaAlSiguiente],
  ['con un espejo bueno, arranca', o.acabaArrancando===true,      o.acabaArrancando],
  ['sin dar error al final',       o.sinErrorAlFinal===true,      o.sinErrorAlFinal],
  ['y usa el espejo que sirvió',   o.usoElSegundo===true,         o.usoElSegundo],
  ['si cierras, deja de insistir', o.noInsisteSiCierras===true,   o.noInsisteSiCierras],
  ['sin errores de página',        errs.length===0,               errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
