// Notas Matematicas ejecutaba JavaScript de verdad, y la etiqueta del
// temporizador no se escapaba.
//
// Lo primero NO es un fallo de escapado: el "evaluador de matematicas" pasaba
// lo de la derecha del igual a new Function() tal cual, con cada tecla. O sea
// que escribir "a=alert(1)" ejecutaba el alert. Y como las notas viven en
// localStorage, y "Importar datos (JSON)" restaura localStorage entero, una
// nota asi podia venir escondida en una copia de seguridad compartida.
//
// Aqui se comprueba lo dificil de verdad: que se corta la ejecucion SIN
// romper las matematicas, que es lo que hace inutil una lista blanca mal hecha.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright/index.js');
const ROOT='/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9241);

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1280,height:1000}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 p.on('dialog',d=>{ p._alerta=true; d.dismiss(); });
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9241/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof evalMathNote==='function' && typeof _mathSeguro==='function',
   null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}});

 const o={};

 // --- LO QUE DE VERDAD IMPORTA: nada de ejecutar ---
 o.ataques = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const inp=document.getElementById('math-input');
   const casos=[
     'a=alert(1)',
     'a=window.alert(1)',
     'a=fetch("//x")',
     'a=document.cookie',
     'a=localStorage.getItem("x")',
     'a=eval("1+1")',
     'a=[].constructor',
     'a=this["ale"+"rt"](1)',
     'a=(()=>{window.__pwn=1})()',
     'a=Function("window.__pwn=1")()',
     'a=1;window.__pwn=1',
     'a=`${window.__pwn=1}`',
     'a=x=>window.__pwn=1',
   ];
   const salida=[];
   for(const c of casos){
     window.__pwn=0;
     inp.value=c;
     try{ evalMathNote(); }catch(e){}
     await w(80);
     salida.push({ caso:c, pwn:window.__pwn,
                   seguro:_mathSeguro(c.split('=').slice(1).join('=')) });
   }
   inp.value='';
   try{ evalMathNote(); }catch(e){}
   return salida;
 });

 // --- pero las matematicas TIENEN que seguir funcionando ---
 o.mates = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const inp=document.getElementById('math-input'), res=document.getElementById('math-result');
   const casos=[
     ['a = 5', '= 5'],
     ['a = 2\nb = 3\nc = a*b', '= 6'],
     ['a = 2^10', '= 1024'],
     ['a = sqrt(144)', '= 12'],
     ['a = sin(0)', '= 0'],
     ['a = log(1000)', '= 3'],
     ['a = (7+3)/2', '= 5'],
     ['a = 10 % 3', '= 1'],
     ['a = -4.5 * 2', '= -9'],
   ];
   const salida=[];
   for(const [txt,esperado] of casos){
     inp.value=txt;
     try{ evalMathNote(); }catch(e){}
     await w(90);
     const t=(res.textContent||'');
     salida.push({ txt:txt.replace(/\n/g,' ⏎ '), esperado,
                   sale:t.split('\n').pop(), ok:t.indexOf(esperado)>=0 });
   }
   inp.value=''; try{ evalMathNote(); }catch(e){}
   return salida;
 });

 // --- la gráfica de y=f(x) tampoco se rompe ---
 o.grafica = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const inp=document.getElementById('math-input'), can=document.getElementById('math-canvas');
   inp.value='y = x^2';
   try{ evalMathNote(); }catch(e){}
   await w(300);
   const visible=getComputedStyle(can).display!=='none';
   const texto=(document.getElementById('math-result').textContent||'');
   inp.value=''; try{ evalMathNote(); }catch(e){}
   return { visible, dice:/Gr[áa]fica/.test(texto) };
 });

 // --- una línea que no es una asignación se queda como texto, sin más ---
 o.texto = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   const inp=document.getElementById('math-input'), res=document.getElementById('math-result');
   inp.value='comprar pan\na = 2+2\nrecordar llamar a mamá';
   try{ evalMathNote(); }catch(e){}
   await w(150);
   const t=res.textContent||'';
   inp.value=''; try{ evalMathNote(); }catch(e){}
   return { conserva:/comprar pan/.test(t) && /mam/.test(t), calcula:/= 4/.test(t) };
 });

 // --- una nota guardada con código tampoco se ejecuta al cargarla ---
 o.guardada = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__pwn=0;
   localStorage.setItem('math_notes', JSON.stringify([
     { text:'a=(()=>{window.__pwn=1})()', date:'hoy' },
     { text:'<img src=x onerror="window.__pwn=2">', date:'<b>ayer</b>' }
   ]));
   try{ mathRenderSaved(); }catch(e){}
   await w(300);
   const listaOK = window.__pwn===0;
   try{ mathLoadSaved(0); }catch(e){}
   await w(400);
   const cargarOK = window.__pwn===0;
   localStorage.removeItem('math_notes');
   const inp=document.getElementById('math-input'); if(inp) inp.value='';
   try{ evalMathNote(); mathRenderSaved(); }catch(e){}
   return { listaOK, cargarOK };
 });

 // --- y la etiqueta del temporizador ---
 o.timer = await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   window.__pwn=0;
   localStorage.setItem('ica_timer_recents', JSON.stringify([
     '<img src=x onerror="window.__pwn=1"> — 0h 5m 0s',
     'Pasta — 0h 10m 0s'
   ]));
   try{ icaRenderRecents(); }catch(e){}
   await w(400);
   const el=document.getElementById('ica-timer-recents');
   const txt=el?el.innerText:'';
   localStorage.removeItem('ica_timer_recents');
   try{ icaRenderRecents(); }catch(e){}
   return { pwn:window.__pwn, saleLaNormal:/Pasta/.test(txt) };
 });

 // --- la tarjeta ya no promete radio si solo hace TV ---
 o.tarjeta = await p.evaluate(()=>{
   const a=IX_APPS.find(x=>x.id==='buscador');
   return { d:a?a.d:'', prometeRadio:/emisoras de radio/i.test(a?a.d:''),
            diceTV:/TV/.test(a?a.d:'') };
 });

 const seEjecutoAlgo = p._alerta===true;
 await p.close();

 const fallaron=o.ataques.filter(a=>a.pwn!==0);
 const permitidos=o.ataques.filter(a=>a.seguro===true);
 const matesMal=o.mates.filter(m=>!m.ok);

 const pruebas=[
  ['NINGÚN ataque se ejecuta',    fallaron.length===0,          fallaron.map(a=>a.caso).join(' | ')||'ninguno'],
  ['y ninguno pasa la lista blanca', permitidos.length===0,     permitidos.map(a=>a.caso).join(' | ')||'ninguno'],
  ['no salta ningún alert()',     seEjecutoAlgo===false,        seEjecutoAlgo],
  ['LAS MATES siguen funcionando', matesMal.length===0,         matesMal.map(m=>m.txt+' → '+m.sale).join(' | ')||'todas bien'],
  ['con variables entre líneas',  o.mates[1] && o.mates[1].ok===true, o.mates[1] && o.mates[1].sale],
  ['con potencias y raíces',      o.mates[2].ok===true && o.mates[3].ok===true, o.mates[2].sale+' / '+o.mates[3].sale],
  ['con seno y logaritmo',        o.mates[4].ok===true && o.mates[5].ok===true, o.mates[4].sale+' / '+o.mates[5].sale],
  ['la gráfica sigue saliendo',   o.grafica.visible===true && o.grafica.dice===true, JSON.stringify(o.grafica)],
  ['el texto normal se conserva', o.texto.conserva===true && o.texto.calcula===true, JSON.stringify(o.texto)],
  ['una nota guardada no ejecuta',o.guardada.listaOK===true,    o.guardada.listaOK],
  ['ni al abrirla',               o.guardada.cargarOK===true,   o.guardada.cargarOK],
  ['TEMPORIZADOR: no se ejecuta', o.timer.pwn===0,              o.timer.pwn],
  ['y la etiqueta normal se ve',  o.timer.saleLaNormal===true,  o.timer.saleLaNormal],
  ['la tarjeta ya no promete radio', o.tarjeta.prometeRadio===false && o.tarjeta.diceTV===true, o.tarjeta.d],
  ['sin errores de página',       errs.length===0,              errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 await b.close(); srv.close(); process.exit(ok===pruebas.length?0:1);
})();
