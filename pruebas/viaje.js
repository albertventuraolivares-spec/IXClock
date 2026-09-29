// Modo Viaje (idea 25): de una ciudad del reloj mundial a su moneda.
//
// Cada ciudad lleva un botón «💱 JPY» (su moneda, sacada de la bandera del
// país) que abre la calculadora en Divisas con esa moneda de destino. Se
// comprueba con la pantalla de verdad:
//  · Tokio → JPY, Madrid → EUR; Katmandú (el conversor no tiene su moneda)
//    no ofrece el botón en vez de uno que no funcionaría;
//  · tocarlo abre la calculadora en Divisas, convierte A esa moneda y DESDE
//    la que tenías puesta;
//  · si ya convertías DESDE esa moneda, no deja «JPY → JPY».
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.IX_PW||'/opt/node22/lib/node_modules/playwright/index.js');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const MIME={'.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,s)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/')f='/index.html';
 const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});s.end(fs.readFileSync(p));}).listen(9287);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.IX_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:1300,height:1000}, locale:'es-ES'});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0]));
 await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await p.goto('http://localhost:9287/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof icaRenderWorldClocks==='function',null,{timeout:30000}).catch(()=>{});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{try{_lrConfirm();}catch(e){}});
 try{ await p.click('text=Continuar como invitado',{timeout:3000}); }catch(e){}
 await p.waitForTimeout(2000);
 const o=await p.evaluate(async()=>{
   const w=m=>new Promise(r=>setTimeout(r,m));
   try{ ixCerrarBienvenida(); }catch(e){}
   if(typeof ixViajeMoneda!=='function') return {falta:true};
   const r={};
   r.paises={ sd:ixPaisDeTz('America/Santo_Domingo'), tk:ixPaisDeTz('Asia/Tokyo'), rara:ixPaisDeTz('Marte/Olimpo') };
   localStorage.setItem('ix_cur_pair', JSON.stringify(['USD','EUR']));
   _icaWorldClocks=['Asia/Tokyo','Europe/Madrid','Asia/Kathmandu'];
   icaRenderWorldClocks(); await w(100);
   r.botones=[].slice.call(document.querySelectorAll('#ica-world-list .ica-moneda')).map(b=>b.textContent.trim());
   // Tocar el de Tokio
   const bt=[].slice.call(document.querySelectorAll('#ica-world-list .ica-moneda')).find(b=>/JPY/.test(b.textContent));
   bt.click(); await w(300);
   const panel=document.getElementById('calc-panel'), cur=document.getElementById('calc-currency');
   const val=id=>(document.getElementById(id)||{}).value;
   r.tokio={ abierta:panel.style.opacity==='1', divisas:getComputedStyle(cur).display!=='none', modo:val('calc-mode'),
             desde:val('currency-from'), a:val('currency-to'), resultado:(document.getElementById('currency-result')||{}).textContent };
   // Si ya convertías DESDE yenes
   document.getElementById('currency-from').value='JPY'; document.getElementById('currency-to').value='EUR';
   ixViajeMoneda('Asia/Tokyo'); await w(100);
   r.yaYenes={ desde:val('currency-from'), a:val('currency-to') };
   return r;
 });
 await b.close(); srv.close();

 const pruebas=[
  ['existe',                                    !o.falta, !o.falta],
  ['de la bandera sale el país',                !!o.paises && o.paises.sd==='DO' && o.paises.tk==='JP' && o.paises.rara==='', JSON.stringify(o.paises)],
  ['Tokio → 💱 JPY y Madrid → 💱 EUR',          JSON.stringify(o.botones)===JSON.stringify(['💱 JPY','💱 EUR']), JSON.stringify(o.botones)],
  ['Katmandú (sin su moneda) no ofrece botón',   !!o.botones && o.botones.length===2, JSON.stringify(o.botones)],
  ['tocarlo abre la calculadora en Divisas',     !!o.tokio && o.tokio.abierta && o.tokio.divisas && o.tokio.modo==='currency', JSON.stringify(o.tokio)],
  ['de lo que tenías (USD) a yenes',             !!o.tokio && o.tokio.desde==='USD' && o.tokio.a==='JPY' && /JPY/.test(o.tokio.resultado||''), JSON.stringify(o.tokio)],
  ['si ya era desde yenes, no deja JPY → JPY',   !!o.yaYenes && o.yaYenes.a==='JPY' && o.yaYenes.desde==='EUR', JSON.stringify(o.yaYenes)],
  ['sin errores de página',                      errs.length===0, errs.slice(0,3).join(' | ')],
 ];
 let ok=0;
 pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
 console.log('\n'+ok+'/'+pruebas.length);
 process.exit(ok===pruebas.length?0:1);
})().catch(e=>{ console.log('FALLA  la prueba reventó   ['+e.message+']'); process.exit(1); });
