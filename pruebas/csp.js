// Idea 77: la CSP de scripts (hoy en modo informe) no se queja de nada que la
// app use de verdad, y SÍ de un script de un dominio cualquiera.
//
// La cabecera se lee del netlify.toml de verdad y se sirve tal cual. La red
// externa está cortada, pero la CSP se comprueba ANTES de pedir nada, así que
// los avisos (securitypolicyviolation) salen igual.
//
// Para cuando pase a obligatoria: IX_CSP_OBLIGATORIA=1 sirve la misma lista
// como Content-Security-Policy y la prueba tiene que seguir pasando.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};

const toml=fs.readFileSync(ROOT+'/netlify.toml','utf8');
const m=/^\s*Content-Security-Policy(-Report-Only)?\s*=\s*"(script-src[^"]*)"\s*$/m.exec(toml);
const POLITICA=m?m[2]:'';
const NOMBRE=process.env.IX_CSP_OBLIGATORIA?'Content-Security-Policy':('Content-Security-Policy'+(m&&m[1]||''));

const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 const h={'content-type':MIME[path.extname(p)]||'application/octet-stream'};
 if(/\.html$/.test(p) && POLITICA) h[NOMBRE]=POLITICA;
 s.writeHead(200,h);s.end(fs.readFileSync(p));}).listen(9308);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1300,height:900}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.addInitScript(()=>{
   window.__csp=[];
   document.addEventListener('securitypolicyviolation',e=>{
     window.__csp.push(e.effectiveDirective+' '+(e.blockedURI||'')+' ('+e.disposition+')');
   });
 });
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9308/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof openAppleMaps==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2600);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});
 const o={};
 o.alArrancar=await p.evaluate(()=>window.__csp.slice());

 // Lo que la app carga por su cuenta: mapas (Leaflet), la calculadora gráfica
 // (new Function), un onclick en línea, y cada script externo conocido.
 await p.evaluate(()=>{ try{ openAppleMaps(); }catch(e){} });
 await p.waitForTimeout(800);
 o.evalVa=await p.evaluate(()=>{ try{ return new Function('return 2+2')()===4; }catch(e){ return false; } });
 o.inlineVa=await p.evaluate(()=>{ const d=document.createElement('div'); d.setAttribute('onclick','window.__clic=1'); document.body.appendChild(d); d.click(); d.remove(); return window.__clic===1; });
 const usadas=await p.evaluate(()=>[
   'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js',
   'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
   'https://accounts.google.com/gsi/client',
 ].concat((typeof EMU_CDNS!=='undefined'?EMU_CDNS:[]).map(u=>u+'loader.js')));
 o.nUsadas=usadas.length;
 await p.evaluate(us=>us.forEach(u=>{ const s=document.createElement('script'); s.src=u; document.head.appendChild(s); }), usadas);
 await p.waitForTimeout(800);
 o.trasUsar=await p.evaluate(()=>window.__csp.slice());

 // Control: un script de un dominio cualquiera SÍ tiene que dar aviso.
 await p.evaluate(()=>{ const s=document.createElement('script'); s.src='https://malo.example/robar.js'; document.head.appendChild(s); });
 await p.waitForTimeout(500);
 o.final=await p.evaluate(()=>window.__csp.slice());
 o.malo=o.final.filter(x=>/malo\.example/.test(x));

 const pruebas=[
  ['la cabecera está en netlify.toml',   !!POLITICA,                    NOMBRE],
  ['al arrancar no avisa de nada',       o.alArrancar.length===0,       o.alArrancar.slice(0,3).join(' | ')],
  ['las calcs con new Function van',     o.evalVa===true,               o.evalVa],
  ['los onclick en línea van',           o.inlineVa===true,             o.inlineVa],
  ['scripts de la app sin aviso',        o.nUsadas>=7 && o.trasUsar.length===0, o.nUsadas+' · '+o.trasUsar.slice(0,3).join(' | ')],
  ['un dominio cualquiera SÍ avisa',     o.malo.length>=1,              o.malo.join(' | ')],
  ['y no avisa de nada más',             o.final.length===o.malo.length, o.final.filter(x=>!/malo\.example/.test(x)).slice(0,3).join(' | ')],
  ['sin errores de página',              errs.length===0,               errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
