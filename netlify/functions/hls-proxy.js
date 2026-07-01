// HLS relay: some IPTV channels (e.g. CDN / CDN Deportes from República
// Dominicana) only publish a plain http:// stream. Browsers block http://
// media loaded from an https:// page ("mixed content"), so the raw URL can
// never play in <video>. This function fetches the manifest/segments from
// the origin (http or https) server-side and re-serves them from our own
// https origin, rewriting playlist URIs to keep pointing back through here.
const https = require('https');
const http  = require('http');
const { URL } = require('url');

const PRIVATE = /^(localhost$|127\.|0\.0\.0\.0|::1$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|fd[0-9a-f]{2}:|fc)/i;
const PROXY_BASE = '/.netlify/functions/hls-proxy?url=';

function fetchBinary(rawUrl, redirects) {
  redirects = redirects || 0;
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Demasiadas redirecciones'));
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
        'Accept': '*/*',
      },
      timeout: 9000,
    }, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        let loc;
        try { loc = new URL(res.headers.location, rawUrl).href; } catch(e) { loc = res.headers.location; }
        return fetchBinary(loc, redirects + 1).then(resolve, reject);
      }
      const bufs = [];
      res.on('data', b => bufs.push(b));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(bufs) }));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
    req.end();
  });
}

function isPlaylist(url, contentType) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('mpegurl')) return true;
  return /\.m3u8(\?|$)/i.test(url);
}

// Rewrite every segment/sub-playlist URI (and URI="..." attributes used by
// EXT-X-KEY / EXT-X-MAP) so playback keeps flowing back through this proxy.
function rewritePlaylist(text, baseUrl) {
  return text.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith('#')) {
      return trimmed.replace(/URI="([^"]+)"/i, (m, u) => {
        try { return `URI="${PROXY_BASE}${encodeURIComponent(new URL(u, baseUrl).href)}"`; }
        catch(e) { return m; }
      });
    }
    try { return PROXY_BASE + encodeURIComponent(new URL(trimmed, baseUrl).href); }
    catch(e) { return line; }
  }).join('\n');
}

exports.handler = async (event) => {
  const targetUrl = (event.queryStringParameters || {}).url;
  if (!targetUrl) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/plain' }, body: 'Missing ?url=' };
  }

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
    upstream = await fetchBinary(targetUrl);
  } catch(e) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' },
      body: 'No se pudo conectar: ' + (e.message || 'error desconocido'),
    };
  }

  const contentType = upstream.headers['content-type'] || '';
  const baseHeaders = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' };

  if (isPlaylist(targetUrl, contentType)) {
    return {
      statusCode: upstream.status,
      headers: { ...baseHeaders, 'Content-Type': 'application/vnd.apple.mpegurl' },
      body: rewritePlaylist(upstream.body.toString('utf8'), targetUrl),
    };
  }

  return {
    statusCode: upstream.status,
    headers: { ...baseHeaders, 'Content-Type': contentType || 'application/octet-stream' },
    isBase64Encoded: true,
    body: upstream.body.toString('base64'),
  };
};
