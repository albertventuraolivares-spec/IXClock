// Sincronización de IXClocK entre aparatos (iPhone, iPad, ordenador).
//
// «Mi Nube» nunca fue una nube: eran claves de localStorage de ESE aparato.
// Esto sí lo es. Reaprovecha la misma tubería que ya funcionaba para las
// opiniones (@netlify/blobs), que estaba montada y probada y solo se usaba
// para una cosa.
//
// CÓMO SE IDENTIFICA UN USUARIO, y por qué así:
// Un código personal largo que genera el navegador. No hay contraseñas, no hay
// correos, no hay nada que registrar — y sobre todo, no hay nada personal
// guardado aquí que pueda filtrarse.
//
// El código NUNCA se guarda: lo que se guarda es su SHA-256, y eso es lo que
// hace de nombre de la caja. Quien pudiera mirar el almacén vería hashes y
// datos, pero no podría entrar en la caja de nadie ni deducir ningún código.
//
// LO QUE HAY QUE TENER CLARO, y se dice tal cual en la pantalla: el código ES
// la llave. Quien lo tenga, tiene los datos. Por eso lo genera el navegador
// con crypto y son 100 bits: adivinarlo a base de intentos no es viable, pero
// mandárselo a alguien por WhatsApp sí le da acceso.
import { getStore } from '@netlify/blobs';

const HEADERS = {
	'content-type': 'application/json',
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET, POST, OPTIONS',
	'access-control-allow-headers': 'content-type',
};

// 1 MB por caja. Notas, alarmas, ciudades y ajustes caben de sobra; el tope
// está para que un fallo (o alguien con ganas) no llene el almacén.
const TOPE = 1024 * 1024;

// Mismo alfabeto que usa el navegador al generarlo: sin 0/O ni 1/I/L, que son
// las que la gente confunde al copiarlas a mano de una pantalla a otra.
const VALIDO = /^[A-HJ-NP-Z2-9-]{20,40}$/;

function normaliza(codigo) {
	return String(codigo || '').toUpperCase().replace(/\s+/g, '');
}

async function claveDe(codigo) {
	// SHA-256 del código. Es lo único que llega a tocar el almacén.
	const datos = new TextEncoder().encode('ixclock-nube-v1:' + codigo);
	const hash = await crypto.subtle.digest('SHA-256', datos);
	return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async (req) => {
	if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });

	const store = getStore('ixnube');

	if (req.method === 'GET') {
		const url = new URL(req.url);
		const codigo = normaliza(url.searchParams.get('codigo'));
		if (!VALIDO.test(codigo)) {
			return new Response('{"error":"codigo"}', { status: 400, headers: HEADERS });
		}
		const caja = await store.get(await claveDe(codigo), { type: 'json' });
		// Una caja que no existe NO es un error: es un código nuevo todavía sin
		// nada dentro. Devolverlo como 404 haría que el móvil creyera que se
		// equivocó de código cuando en realidad aún no había subido nada.
		if (!caja) {
			return new Response(JSON.stringify({ ok: true, vacia: true, datos: null, guardado: null }),
				{ status: 200, headers: HEADERS });
		}
		return new Response(JSON.stringify({ ok: true, vacia: false, datos: caja.datos, guardado: caja.guardado }),
			{ status: 200, headers: HEADERS });
	}

	if (req.method === 'POST') {
		let body;
		try { body = await req.json(); } catch (e) {
			return new Response('{"error":"json"}', { status: 400, headers: HEADERS });
		}
		const codigo = normaliza(body.codigo);
		if (!VALIDO.test(codigo)) {
			return new Response('{"error":"codigo"}', { status: 400, headers: HEADERS });
		}
		if (!body.datos || typeof body.datos !== 'object' || Array.isArray(body.datos)) {
			return new Response('{"error":"datos"}', { status: 400, headers: HEADERS });
		}
		const crudo = JSON.stringify(body.datos);
		if (crudo.length > TOPE) {
			return new Response('{"error":"grande"}', { status: 413, headers: HEADERS });
		}
		const guardado = new Date().toISOString();
		await store.setJSON(await claveDe(codigo), { datos: body.datos, guardado });
		return new Response(JSON.stringify({ ok: true, guardado }), { status: 200, headers: HEADERS });
	}

	return new Response('{"error":"metodo"}', { status: 405, headers: HEADERS });
};
