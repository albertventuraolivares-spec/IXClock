// Opiniones públicas de IXClock: se guardan en Netlify Blobs para que
// TODOS los visitantes puedan verlas (localStorage solo vive en cada
// aparato). GET = lista de opiniones; POST = publicar una nueva.
import { getStore } from '@netlify/blobs';

const HEADERS = {
	'content-type': 'application/json',
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET, POST, OPTIONS',
	'access-control-allow-headers': 'content-type',
};

export default async (req) => {
	if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: HEADERS });
	const store = getStore('opiniones');

	if (req.method === 'GET') {
		const data = (await store.get('all', { type: 'json' })) || [];
		// las más nuevas primero, máximo 100 para no inflar la respuesta
		return new Response(JSON.stringify(data.slice(-100).reverse()), { status: 200, headers: HEADERS });
	}

	if (req.method === 'POST') {
		let body;
		try { body = await req.json(); } catch (e) {
			return new Response('{"error":"json"}', { status: 400, headers: HEADERS });
		}
		const name = String(body.name || 'Anónimo').replace(/[<>]/g, '').trim().slice(0, 40) || 'Anónimo';
		const stars = Math.max(1, Math.min(5, parseInt(body.stars, 10) || 5));
		const text = String(body.text || '').replace(/[<>]/g, '').trim().slice(0, 500);
		if (!text) return new Response('{"error":"vacia"}', { status: 400, headers: HEADERS });
		const data = (await store.get('all', { type: 'json' })) || [];
		data.push({ name, stars, text, date: new Date().toISOString().slice(0, 10) });
		if (data.length > 500) data.splice(0, data.length - 500); // tope de almacenamiento
		await store.setJSON('all', data);
		return new Response('{"ok":true}', { status: 200, headers: HEADERS });
	}

	return new Response('{"error":"metodo"}', { status: 405, headers: HEADERS });
};
