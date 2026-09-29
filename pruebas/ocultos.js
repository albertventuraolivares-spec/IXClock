// Archivos internos que no deben verse en la web (idea 70).
//
// `publish = "."` en netlify.toml sube la carpeta ENTERA, así que las reglas
// [[redirects]] con status 404 son lo único que tapa BACKLOG.md, pruebas/, el
// código de las funciones... La prueba no puede levantar Netlify aquí, así que
// lee las reglas del toml y las aplica igual que Netlify (ruta exacta, o
// prefijo con «/*») a CADA archivo del repo.
//
// Lo que la hace útil: cada archivo tiene que estar DECIDIDO. O está en la
// lista de públicos, o lo tapa una regla. Uno nuevo que no esté en ninguna de
// las dos hace fallar la prueba, y así nadie sube un archivo interno sin darse
// cuenta de que queda a la vista.
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const ROOT='/home/user/IXClock';

// Lo que SÍ es la web.
const PUBLICOS=[
  /^index\.html$/, /^privacidad\.html$/, /^robots\.txt$/, /^sitemap\.xml$/, /^sw\.js$/,
  /^manifest\.webmanifest$/, /^tailwind\.css$/, /^favicon[^/]*$/, /^icon-[^/]+\.png$/,
  /^apple-touch-icon\.png$/, /^screenshot-[^/]+\.png$/, /^videos\/[^/]+$/, /^og-image\.jpg$/,
];

// Mini lector de los bloques [[redirects]] del toml
const toml=fs.readFileSync(ROOT+'/netlify.toml','utf8');
const reglas=toml.split(/^\[\[redirects\]\]\s*$/m).slice(1).map(b=>{
  b=b.split(/^\s*\[/m)[0];
  const r={};
  b.split('\n').forEach(l=>{ const m=/^\s*(\w+)\s*=\s*(.+?)\s*$/.exec(l); if(!m) return;
    let v=m[2]; if(/^".*"$/.test(v)) v=v.slice(1,-1); else if(v==='true'||v==='false') v=(v==='true'); else if(/^\d+$/.test(v)) v=+v;
    r[m[1]]=v; });
  return r;
});
const tapa = url => reglas.find(r=> r.from.endsWith('/*') ? url.startsWith(r.from.slice(0,-1)) : url===r.from );

const archivos=execSync('git ls-files',{cwd:ROOT}).toString().trim().split('\n')
  .concat(fs.existsSync(ROOT+'/privacidad.html')?['privacidad.html']:[])
  .filter((v,i,a)=>a.indexOf(v)===i);

const sinDecidir=[], publicosTapados=[], internosVisibles=[];
archivos.forEach(f=>{
  const pub=PUBLICOS.some(re=>re.test(f));
  const r=tapa('/'+f);
  if(pub && r) publicosTapados.push(f);
  if(!pub && !r) internosVisibles.push(f);
});

// Lo que la app pide de su propia carpeta tiene que seguir llegando
const html=fs.readFileSync(ROOT+'/index.html','utf8');
const pedidos=[];
(html.match(/\b(?:src|href)="([^"#?:]+)"/g)||[]).forEach(m=>{
  const u=m.replace(/^\w+="/,'').replace(/"$/,'').replace(/^\.?\//,'');
  if(u && !/^(javascript|mailto|data)/.test(u) && !/[{}$+'`]/.test(u)) pedidos.push(u);
});
const sw=fs.readFileSync(ROOT+'/sw.js','utf8');
const core=(sw.match(/'\.\/[^']*'/g)||[]).map(x=>x.slice(3,-1)).filter(Boolean);
const pedidosTapados=pedidos.concat(core).filter(u=>tapa('/'+u));

const pruebas=[
  ['hay reglas para tapar',                  reglas.length>=5, reglas.length],
  ['todas responden 404',                    reglas.every(r=>r.status===404), reglas.map(r=>r.status).join(',')],
  ['todas con force (si no, no tapan nada)', reglas.every(r=>r.force===true), reglas.map(r=>r.force).join(',')],
  ['BACKLOG.md tapado',                      !!tapa('/BACKLOG.md'), 'ok'],
  ['pruebas/ tapado',                        !!tapa('/pruebas/aislado.js'), 'ok'],
  ['código de las funciones tapado',         !!tapa('/netlify/functions/proxy.js'), 'ok'],
  ['package.json y netlify.toml tapados',    !!tapa('/package.json') && !!tapa('/netlify.toml'), 'ok'],
  ['las FUNCIONES siguen funcionando',       !tapa('/.netlify/functions/proxy') && !tapa('/.netlify/functions/nube'), 'ok'],
  ['la app y la privacidad siguen a la vista', !tapa('/') && !tapa('/index.html') && !tapa('/privacidad.html') && !tapa('/robots.txt'), 'ok'],
  ['NINGÚN archivo sin decidir',             internosVisibles.length===0, internosVisibles.slice(0,5).join(' ')],
  ['ningún público tapado por error',        publicosTapados.length===0, publicosTapados.join(' ')],
  ['lo que carga la app no está tapado',     pedidosTapados.length===0 && pedidos.length>0, pedidosTapados.join(' ')+' (de '+pedidos.length+')'],
];
let ok=0;
pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
console.log('\n'+ok+'/'+pruebas.length);
process.exit(ok===pruebas.length?0:1);
