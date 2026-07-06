// Resuelve de una vez las URLs reales de video y portada de cada wallpaper
// leyendo sus páginas de origen. Se ejecuta en GitHub Actions (con internet
// completo) y deja el resultado en wallpapers-resolved.json.
import { readFileSync, writeFileSync } from 'fs';

const html = readFileSync('index.html', 'utf8');
const entryRe = /\{id:'(lw-[a-z]+-\d+)',[^\n]*?page:'([^']+)'(?:,alt:'([^']+)')?/g;
const entries = [];
let m;
while ((m = entryRe.exec(html))) entries.push({ id: m[1], page: m[2], alt: m[3] || null });
console.log('entries found:', entries.length);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

async function fetchPage(url) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.8,es;q=0.6',
      },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const txt = await r.text();
    if (!txt || txt.length < 500) return null;
    if (/<title>[^<]*(404|not found|nothing found)/i.test(txt)) return null;
    return txt;
  } catch (e) { return null; }
}

function extract(doc, baseUrl) {
  if (!doc) return null;
  const fix = (u) => {
    if (!u) return null;
    u = u.replace(/&amp;/g, '&').replace(/\\\//g, '/');
    if (!/^http/.test(u)) { try { u = new URL(u, baseUrl).href; } catch (e) { return null; } }
    return u;
  };
  let baseHost = '';
  try { baseHost = new URL(baseUrl).hostname.replace(/^www\./, ''); } catch (e) {}
  const cand = [];
  (doc.match(/https?:\/\/[^"'\s\\)>]+\.mp4[^"'\s\\)>]*/gi) || []).forEach(u => cand.push(u));
  (doc.match(/<source[^>]+src=["']([^"']+\.mp4[^"']*)["']/gi) || []).forEach(s => {
    const mm = s.match(/src=["']([^"']+)["']/i); if (mm) cand.push(mm[1]);
  });
  const ov = doc.match(/property=["']og:video(?::url|:secure_url)?["'][^>]*content=["']([^"']+\.mp4[^"']*)["']/i);
  if (ov) cand.push(ov[1]);
  (doc.match(/href=["']([^"']*\/(?:dl|download)\/[^"']*)["']/gi) || []).forEach(s => {
    const mm = s.match(/href=["']([^"']+)["']/i);
    if (mm && /4k|uhd|2160/i.test(mm[1])) cand.push(mm[1]);
  });
  const fixed = cand.map(fix).filter(Boolean);
  let pool = fixed.filter(u => {
    try {
      const h = new URL(u).hostname;
      return h.endsWith(baseHost) || h.endsWith('.b-cdn.net') || h === 'cdn.pixabay.com' || h.endsWith('motionbgs.com');
    } catch (e) { return false; }
  });
  if (!pool.length) pool = fixed;
  const q = u => /2160|4k|uhd/i.test(u) ? 3 : /1440|2k(?!\d)/i.test(u) ? 2 : /1080|fhd/i.test(u) ? 1 : 0;
  pool.sort((a, b) => q(b) - q(a));
  const video = pool[0] || null;

  let mt = doc.match(/property=["']og:image(?::url|:secure_url)?["'][^>]*content=["']([^"']+)["']/i)
        || doc.match(/content=["']([^"']+)["'][^>]*property=["']og:image/i)
        || doc.match(/name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
  let poster = fix(mt ? mt[1] : null);
  if (!poster) {
    const imgs = (doc.match(/https?:\/\/[^"'\s\\)>]+\.(?:jpg|jpeg|png|webp)[^"'\s\\)>]*/gi) || []).map(fix).filter(Boolean)
      .filter(u => !/logo|icon|favicon|avatar|sprite|emoji/i.test(u));
    poster = imgs.find(u => /wp-content\/uploads|poster|thumb|preview|cover|\/media\//i.test(u)) || imgs[0] || null;
  }
  if (!video && !poster) return null;
  return { video, poster };
}

const out = {};
let okCount = 0;
for (const e of entries) {
  let meta = null, src = null;
  for (const [label, url] of [['page', e.page], ['alt', e.alt]]) {
    if (!url || url.includes('pixabay.com/videos/search')) continue; // las búsquedas no son páginas de video
    const doc = await fetchPage(url);
    meta = extract(doc, url);
    if (meta) { src = label; break; }
  }
  // para las búsquedas de pixabay solo existe el alt
  if (!meta && e.page.includes('pixabay.com') && e.alt) {
    const doc = await fetchPage(e.alt);
    meta = extract(doc, e.alt);
    if (meta) src = 'alt';
  }
  if (meta) { okCount++; out[e.id] = { ...meta, src }; }
  else out[e.id] = null;
  console.log(e.id, '->', meta ? (src + ' | video:' + !!meta.video + ' poster:' + !!meta.poster) : 'FALLÓ');
  await new Promise(r => setTimeout(r, 350)); // no martillar los sitios
}
console.log('RESUELTOS:', okCount, 'de', entries.length);
writeFileSync('wallpapers-resolved.json', JSON.stringify(out, null, 1));
