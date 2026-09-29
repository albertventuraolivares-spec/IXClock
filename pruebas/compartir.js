// Imagen al compartir el enlace + caché de los estáticos (ideas 73 y 79).
//
// Compartir: la etiqueta og:image decía «icon-512.png», una dirección a medias.
// WhatsApp y Facebook necesitan la dirección COMPLETA, así que el enlace salía
// sin foto. Aquí se comprueba que la dirección es completa, que apunta a un
// archivo que existe y que ese archivo mide de verdad lo que dicen las
// etiquetas (una imagen que no mide lo que declara sale recortada).
//
// Caché: cada imagen de la carpeta tiene su Cache-Control, y lo que cambia con
// cada versión (index.html, sw.js, tailwind.css) NO lo tiene, porque dejarlo
// en caché haría que una actualización tardara días en verse.
const fs=require('fs'),path=require('path');
const ROOT=process.env.IXROOT||'/home/user/IXClock';
const html=fs.readFileSync(ROOT+'/index.html','utf8');
const meta=(atr,nombre)=>{ const m=new RegExp('<meta\\s+'+atr+'="'+nombre.replace(/[:.]/g,'\\$&')+'"\\s+content="([^"]*)"','i').exec(html); return m?m[1]:null; };
const canon=(/<link rel="canonical" href="([^"]+)"/.exec(html)||[])[1];

// Tamaño real de un JPEG: se lee del marcador SOF, sin librerías.
function medidaJpeg(buf){
  if(buf[0]!==0xFF||buf[1]!==0xD8) return null;
  let i=2;
  while(i<buf.length){
    if(buf[i]!==0xFF) return null;
    const m=buf[i+1], len=buf.readUInt16BE(i+2);
    if(m>=0xC0 && m<=0xCF && m!==0xC4 && m!==0xC8 && m!==0xCC) return {alto:buf.readUInt16BE(i+5), ancho:buf.readUInt16BE(i+7)};
    i+=2+len;
  }
  return null;
}

const img=meta('property','og:image')||'';
const local=img.startsWith(canon)? path.join(ROOT, img.slice(canon.length)) : null;
const existe=!!local && fs.existsSync(local);
const buf=existe?fs.readFileSync(local):null;
const med=buf?medidaJpeg(buf):null;

// Reglas de cabeceras del toml: [{for, values}]
const toml=fs.readFileSync(ROOT+'/netlify.toml','utf8');
const reglas=toml.split(/^\[\[headers\]\]\s*$/m).slice(1).map(b=>{
  b=b.split(/^\[\[/m)[0];
  const r={values:{}};
  const f=/^\s*for\s*=\s*"([^"]+)"/m.exec(b); r.for=f?f[1]:'';
  (b.split('[headers.values]')[1]||'').split('\n').forEach(l=>{ const m=/^\s*([A-Za-z-]+)\s*=\s*"(.*)"\s*$/.exec(l); if(m) r.values[m[1]]=m[2]; });
  return r;
});
const aplica=(r,url)=> r.for.endsWith('/*') ? url.startsWith(r.for.slice(0,-1)) : (r.for==='/*' || r.for===url);
const cache=url=>{ const r=reglas.filter(r=>aplica(r,url) && r.values['Cache-Control']); return r.length?r[r.length-1].values['Cache-Control']:null; };
const maxAge=cc=>{ const m=/max-age=(\d+)/.exec(cc||''); return m?+m[1]:0; };

const imagenes=fs.readdirSync(ROOT).filter(f=>/\.(png|jpe?g|svg|ico)$/i.test(f));
const sinCache=imagenes.filter(f=>maxAge(cache('/'+f))<86400);
const noDeben=['/index.html','/sw.js','/tailwind.css','/privacidad.html','/','/manifest.webmanifest'].filter(u=>cache(u));

const pruebas=[
  ['og:image con la dirección COMPLETA',      /^https:\/\//.test(img), img],
  ['y del propio sitio',                      !!canon && img.startsWith(canon), img+' / '+canon],
  ['el archivo existe',                       existe, local],
  ['es un JPEG de verdad',                    !!med, JSON.stringify(med)],
  ['mide lo que dicen las etiquetas',         !!med && String(med.ancho)===meta('property','og:image:width') && String(med.alto)===meta('property','og:image:height'), JSON.stringify(med)+' vs '+meta('property','og:image:width')+'x'+meta('property','og:image:height')],
  ['proporción de redes (1200×630)',          !!med && med.ancho===1200 && med.alto===630, JSON.stringify(med)],
  ['pesa poco (WhatsApp corta las grandes)',  !!buf && buf.length<300*1024, buf?Math.round(buf.length/1024)+' KB':'-'],
  ['lleva texto alternativo',                 (meta('property','og:image:alt')||'').length>10, meta('property','og:image:alt')],
  ['tarjeta grande en X/Twitter',             meta('name','twitter:card')==='summary_large_image', meta('name','twitter:card')],
  ['og:url = canonical',                      meta('property','og:url')===canon, meta('property','og:url')],
  ['título y descripción en español',         /reloj/i.test(meta('property','og:title')||'') && /música/.test(meta('property','og:description')||''), meta('property','og:title')],
  ['CACHÉ: todas las imágenes la llevan',     sinCache.length===0 && imagenes.length>5, sinCache.join(' ')||imagenes.length+' imágenes'],
  ['sin «immutable» (los nombres no cambian)',reglas.every(r=>!/immutable/.test(r.values['Cache-Control']||'')), 'ok'],
  ['la app, el sw y el CSS NO se quedan en caché', noDeben.length===0, noDeben.join(' ')],
  ['las cabeceras de seguridad siguen en «/*»', reglas.some(r=>r.for==='/*' && r.values['X-Content-Type-Options']==='nosniff'), 'ok'],
];
let ok=0;
pruebas.forEach(([n,v,d])=>{ if(v) ok++; console.log((v?'PASA':'FALLA')+'  '+n+'   ['+d+']'); });
console.log('\n'+ok+'/'+pruebas.length);
process.exit(ok===pruebas.length?0:1);
