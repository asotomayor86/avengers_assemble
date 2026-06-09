// Smoke público contra producción (sin bypass de protección): login por cookie,
// partida completa por REST y verificación de un evento SSE. Replica lo que hace
// el navegador de un jugador. Uso: node scripts/smoke-public.js https://...
const BASE = process.argv[2];
if (!BASE) {
  console.error('Uso: node scripts/smoke-public.js <BASE_URL>');
  process.exit(1);
}

let cookie = '';
async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${data.error || ''}`);
  return data;
}
function assert(c, m) {
  if (!c) throw new Error('FALLO: ' + m);
  console.log('  ok:', m);
}

const CODE = 'FamiliaSotomayorAlonso2019';

// 1) Login → cookie httpOnly
await api('POST', '/api/access', { code: CODE });
assert(cookie.startsWith('aa_site='), 'login deja cookie de sesión');

// 2) Crear + unir + empezar
const room = await api('POST', '/api/rooms', { nickname: 'Tony' });
assert(room.code, 'sala creada: ' + room.code);
await api('POST', `/api/rooms/${room.code}/join`, { nickname: 'Steve' });
const started = await api('POST', `/api/rooms/${room.code}/start`, { playerId: room.playerId });
assert(started.room.status === 'playing', 'partida en juego');

// 3) SSE: abrir el stream y leer el primer 'update'
const ac = new AbortController();
const sseRes = await fetch(`${BASE}/api/rooms/${room.code}/stream?playerId=${room.playerId}`, {
  headers: { Cookie: cookie, Accept: 'text/event-stream' },
  signal: ac.signal,
});
const reader = sseRes.body.getReader();
const dec = new TextDecoder();
let buf = '';
let sawUpdate = false;
const deadline = Date.now() + 6000;
while (Date.now() < deadline && !sawUpdate) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  if (/event:\s*update/.test(buf)) sawUpdate = true;
}
ac.abort();
assert(sawUpdate, 'SSE entrega un evento update al conectar');

// 4) Jugada: descartar la primera carta del jugador en turno
const view = await api('GET', `/api/rooms/${room.code}?playerId=${room.playerId}`);
const cur = view.game.currentPlayer;
const meView = await api('GET', `/api/rooms/${room.code}?playerId=${cur}`);
const cardId = meView.game.hand[0].id;
const acted = await api('PUT', `/api/rooms/${room.code}/action`, {
  playerId: cur,
  action: { type: 'discard', cardIds: [cardId] },
});
assert(acted.version === view.version + 1, `jugada aplicada (version ${acted.version})`);

// 5) Limpieza
await api('POST', `/api/rooms/${room.code}/leave`, { playerId: room.playerId }).catch(() => {});
console.log('\n✓ Smoke PÚBLICO (navegador real, REST + SSE) OK');
