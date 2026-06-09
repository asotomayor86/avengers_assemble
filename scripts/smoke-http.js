import { execSync } from 'node:child_process';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
const { siteToken } = await import('../api/_lib/auth.js');

// Smoke HTTP contra producción usando `vercel curl` (que añade el bypass de
// Deployment Protection automáticamente). Uso: node scripts/smoke-http.js <BASE_URL>
const BASE = process.argv[2];
if (!BASE) {
  console.error('Falta BASE_URL. Uso: node scripts/smoke-http.js https://...');
  process.exit(1);
}
const COOKIE = 'aa_site=' + siteToken();

function call(method, path, body) {
  const args = [
    `vercel curl "${BASE}${path}"`,
    `-X ${method}`,
    `-H "Content-Type: application/json"`,
    `-H "Cookie: ${COOKIE}"`,
  ];
  if (body) args.push(`-d '${JSON.stringify(body)}'`);
  const out = execSync(args.join(' '), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    return JSON.parse(out.trim());
  } catch {
    throw new Error(`Respuesta no-JSON de ${method} ${path}: ${out.slice(0, 200)}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error('FALLO: ' + msg);
  console.log('  ok:', msg);
}

const created = call('POST', '/api/rooms', { nickname: 'Tony' });
assert(created.code && created.playerId, 'sala creada: ' + created.code);

const joined = call('POST', `/api/rooms/${created.code}/join`, { nickname: 'Steve' });
assert(joined.playerId, 'segundo jugador unido');

const started = call('POST', `/api/rooms/${created.code}/start`, { playerId: created.playerId });
assert(started.room.status === 'playing', 'partida iniciada (status playing)');

const view = call('GET', `/api/rooms/${created.code}?playerId=${created.playerId}`);
const current = view.game.currentPlayer;
const myView = call('GET', `/api/rooms/${created.code}?playerId=${current}`);
const cardId = myView.game.hand[0].id;
const acted = call('PUT', `/api/rooms/${created.code}/action`, {
  playerId: current,
  action: { type: 'discard', cardIds: [cardId] },
});
assert(acted.version === view.version + 1, `jugada aplicada, version +1 (${acted.version})`);

// Limpieza
call('POST', `/api/rooms/${created.code}/leave`, { playerId: created.playerId });
call('POST', `/api/rooms/${created.code}/leave`, { playerId: joined.playerId });
console.log('\n✓ Smoke HTTP (partida completa en producción) OK');
