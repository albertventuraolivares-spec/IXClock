// Reverse proxy for in-app browser. Strips X-Frame-Options / CSP frame-ancestors
// so pages blocked from direct iframe embedding can load same-origin.
// Also rewrites HTML to keep navigation inside the proxy.
const https = require('https');
const http  = require('http');
const { URL } = require('url');
const zlib   = require('zlib');

// Block requests to private / internal addresses (SSRF protection)
const PRIVATE = /^(localhost$|127\.|0\.0\.0\.0|::1$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|fd[0-9a-f]{2}:|fc)/i;

const PROXY_BASE = '/.netlify/functions/proxy?url=';

// Headers stripped from the upstream response
const STRIP_RESP = new Set([
  'x-frame-options', 'content-security-policy', 'content-security-policy-report-only',
  'x-xss-protection', 'content-encoding', 'transfer-encoding', 'connection', 'keep-alive',
  'strict-transport-security',
]);

// Headers NOT forwarded in the outbound request (Netlify / Lambda specific)
const STRIP_REQ = new Set([
  'host', 'x-forwarded-for', 'x-forwarded-proto', 'x-nf-request-id',
  'via', 'x-real-ip', 'cdn-loop',
]);

function fetchUrl(rawUrl) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(rawUrl); } catch(e) { return reject(new Error('URL inválida')); }
    if (!['http:', 'https:'].includes(parsed.protocol)) return reject(new Error('Solo http/https'));
    if (PRIVATE.test(parsed.hostname)) return reject(new Error('Host bloqueado'));

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-419,es;q=0.9,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'Referer': parsed.origin + '/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
      },
      timeout: 9000,
    }, (res) => {
      const bufs = [];
      let stream = res;
      const enc = (res.headers['content-encoding'] || '').toLowerCase();
      if (enc === 'gzip')    stream = res.pipe(zlib.createGunzip());
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      stream.on('data', b => bufs.push(b));
      stream.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(bufs) }));
      stream.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
    req.end();
  });
}

function cleanHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (!STRIP_RESP.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}

// Rewrite a single URL attribute to go through the proxy
function proxify(url, base) {
  if (!url) return url;
  try {
    const abs = new URL(url, base).href;
    if (/^https?:\/\//.test(abs)) return PROXY_BASE + encodeURIComponent(abs);
  } catch(e) {}
  return url;
}

function rewriteHtml(html, pageUrl) {
  // <a href="…">
  html = html.replace(/(<a\b[^>]*?\bhref=)(["'])(https?:\/\/[^"'#][^"']*)\2/gi,
    (_, p, q, u) => p + q + PROXY_BASE + encodeURIComponent(u) + q);

  // <form action="…">
  html = html.replace(/(<form\b[^>]*?\baction=)(["'])(https?:\/\/[^"']*)\2/gi,
    (_, p, q, u) => p + q + PROXY_BASE + encodeURIComponent(u) + q);

  return html;
}

// Injected into every proxied HTML page to catch JS-driven navigation
function injectedScript(pageUrl) {
  const safe = pageUrl.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  return `<script>(function(){
  var P='${PROXY_BASE}',B='${safe}';
  document.addEventListener('click',function(e){
    var a=e.target.closest('a[href]');
    if(!a)return;
    var h=a.getAttribute('href');
    if(!h||h.startsWith('#')||h.startsWith('javascript:'))return;
    try{var abs=new URL(h,B).href;if(/^https?:/.test(abs)){e.preventDefault();e.stopPropagation();location.href=P+encodeURIComponent(abs);}}catch(x){}
  },true);
  var op=history.pushState,or=history.replaceState;
  function w(fn){return function(s,t,u){try{if(u){var abs=new URL(String(u),location.href).href;if(/^https?:/.test(abs)&&!abs.includes('/.netlify/')){location.href=P+encodeURIComponent(abs);return;}}}catch(x){}return fn.call(history,s,t,u);};}
  history.pushState=w(op);history.replaceState=w(or);
})();</script>`;
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const targetUrl = params.url;

  if (!targetUrl) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/plain' }, body: 'Missing ?url=' };
  }

  // Validate URL
  let parsed;
  try {
    parsed = new URL(targetUrl);
    if (!['http:','https:'].includes(parsed.protocol)) throw new Error();
    if (PRIVATE.test(parsed.hostname)) throw new Error('blocked');
  } catch(e) {
    return { statusCode: 400, headers: {'Content-Type':'text/plain'}, body: 'URL inválida o bloqueada' };
  }

  let upstream;
  try {
    upstream = await fetchUrl(targetUrl);
  } catch(e) {
    const msg = e.message || 'Error desconocido';
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;padding:24px;color:#222">
<h2 style="color:#c00">No se pudo cargar la página</h2>
<p>${msg}</p>
<p>URL: <code style="word-break:break-all">${targetUrl}</code></p>
<button onclick="location.reload()" style="padding:8px 16px;background:#0a84ff;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px">Reintentar</button>
</body></html>`
    };
  }

  const hdrs = cleanHeaders(upstream.headers);

  // Netlify Functions require arrays in multiValueHeaders, not headers.
  // Extract set-cookie (always potentially multi-valued) before spreading hdrs.
  const rawCookies = hdrs['set-cookie'];
  delete hdrs['set-cookie'];
  function rewriteCookies(cks) {
    if (!cks) return null;
    const arr = Array.isArray(cks) ? cks : [cks];
    return arr.map(c => c.replace(/;\s*domain=[^;,]*/gi, '').replace(/;\s*samesite=strict/gi, '; SameSite=Lax'));
  }
  const cookies = rewriteCookies(rawCookies);
  const multiValueHeaders = cookies ? { 'set-cookie': cookies } : undefined;

  // Follow redirects through proxy
  if ([301,302,303,307,308].includes(upstream.status) && upstream.headers.location) {
    let loc;
    try { loc = new URL(upstream.headers.location, targetUrl).href; } catch(e) { loc = upstream.headers.location; }
    return {
      statusCode: 302,
      headers: { ...hdrs, 'Location': PROXY_BASE + encodeURIComponent(loc), 'Access-Control-Allow-Origin': '*' },
      ...(multiValueHeaders && { multiValueHeaders }),
      body: ''
    };
  }

  const ct = ((hdrs['content-type'] || '').split(';')[0]).trim().toLowerCase();

  if (ct === 'text/html') {
    let html = upstream.body.toString('utf8');

    // Remove existing <base> tags (we'll add ours)
    html = html.replace(/<base\b[^>]*>/gi, '');

    // Rewrite server-rendered links
    html = rewriteHtml(html, targetUrl);

    // Inject <base> + navigation interception right after <head>
    const inject = `<base href="${targetUrl.replace(/"/g,'&quot;')}">` + injectedScript(targetUrl);
    if (/<head[\s>]/i.test(html)) {
      html = html.replace(/(<head[\s>][^>]*>)/i, '$1' + inject);
    } else {
      html = inject + html;
    }

    return {
      statusCode: upstream.status,
      headers: { ...hdrs, 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'X-Proxy-For': targetUrl },
      ...(multiValueHeaders && { multiValueHeaders }),
      body: html,
    };
  }

  // Non-HTML (images, CSS, JS, fonts, JSON): redirect to original URL.
  // Passive resources load fine cross-origin; only HTML navigation needs proxying.
  return {
    statusCode: 307,
    headers: { 'Location': targetUrl, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
    body: ''
  };
};
