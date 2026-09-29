// IXBench recomienda la calidad de los efectos (idea 59).
//
// El banco de pruebas medía y ahí se quedaba. Ahora, al terminar, recomienda
// Alta / Media / Ahorro y la aplica con un toque. Las medidas de verdad
// tardan y dependen de la máquina, así que se fijan los resultados de cada
// prueba y se ejecuta la función real del banco (_benchRun) de punta a punta:
//  · un aparato lento → Ahorro; uno normal → Media; uno potente → Alta;
//  · «Aplicar» cambia la calidad DE VERDAD (clase en <body>) y lo dice;
//  · si ya tienes esa, no ofrece aplicar;
//  · NUNCA la cambia sola: recomendar no es aplicar.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9282);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1200,height:900}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9282/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof openBenchmark==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 await p.evaluate(()=>{try{ixCerrarBienvenida();}catch(e){}; localStorage.setItem('ix_calidad','alta'); try{ ixAplicarCalidad(); }catch(e){} openBenchmark(); });
 await p.waitForTimeout(500);
 // Cada prueba del banco «mide» lo que se le diga
 const correr=(cada)=>p.evaluate(async(cada)=>{
   window._benchCPU=async()=>cada; window._benchGPU=async()=>cada; window._benchMem=async()=>cada; window._benchAI=async()=>cada;
   const antes=ixCalidad();
   await _benchRun();
   const c=document.getElementById('bench-sugerencia');
   return { texto:c?c.innerText.replace(/\s+/g,' '):'', boton:!!(c&&c.querySelector('button')), calidadAntes:antes, calidadDespues:ixCalidad() };
 }, cada);
 const o={};
 o.lento=await correr(400);     // 1.600 puntos
 o.normal=await correr(1250);   // 5.000
 o.potente=await correr(2400);  // 9.600
 // Aplicar la recomendación del normal
 await correr(1250);
 await p.click('#bench-sugerencia button',{timeout:3000}).catch(()=>{});
 await p.waitForTimeout(200);
 o.aplicada=await p.evaluate(()=>({ calidad:ixCalidad(), clase:document.body.classList.contains('ix-cal-media'), texto:(document.getElementById('bench-sugerencia')||{}).innerText||'' }));
 o.umbral=await p.evaluate(()=>[ixBenchSugerir(0), ixBenchSugerir(3999), ixBenchSugerir(4000), ixBenchSugerir(6999), ixBenchSugerir(7000)]);
 await b.close(); srv.close();

 const pruebas=[
  ['aparato lento: recomienda Ahorro',      /Ahorro/.test(o.lento.texto) && o.lento.boton, o.lento.texto],
  ['normal: Media',                          /Media/.test(o.normal.texto), o.normal.texto],
  ['potente: Alta, y como ya la tiene no ofrece aplicar', /Alta/.test(o.potente.texto) && !o.potente.boton && /Ya la tienes/.test(o.potente.texto), o.potente.texto],
  ['NUNCA la cambia sola',                   [o.lento,o.normal,o.potente].every(x=>x.calidadAntes===x.calidadDespues), JSON.stringify([o.lento.calidadDespues,o.normal.calidadDespues])],
  ['«Aplicar» la pone de verdad',            o.aplicada.calidad==='media' && o.aplicada.clase===true, JSON.stringify(o.aplicada)],
  ['y después dice que ya la tienes',        /Ya la tienes/.test(o.aplicada.texto), o.aplicada.texto],
  ['umbrales 4.000 y 7.000',                 JSON.stringify(o.umbral)===JSON.stringify([null,'ahorro','media','media','alta']), JSON.stringify(o.umbral)],
  ['sin errores de página',                  errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
