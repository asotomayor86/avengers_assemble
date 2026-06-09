import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// Smoke de jugada + concurrencia contra Neon real.
const { createRoom, joinRoom, startGame, applyGameAction, getRoom, gameStateFor, leaveRoom } =
  await import('../api/_lib/rooms.js');

function assert(cond, msg) {
  if (!cond) throw new Error('FALLO: ' + msg);
  console.log('  ok:', msg);
}

const { room, playerId: hostId } = await createRoom('Tony');
const { playerId: p2 } = await joinRoom(room.code, 'Steve');
const started = await startGame(room.code, hostId);
const baseVersion = started.version;

// ¿Quién tiene el turno y qué carta puede descartar?
const cur = await getRoom(room.code);
const view = gameStateFor(cur.room, cur.room.game.currentPlayer);
const currentPlayer = view.currentPlayer;
const cardId = view.hand[0].id;
console.log('Turno de', currentPlayer, '— descarta carta', cardId, '| version base', baseVersion);

// Dos descartes IDÉNTICOS concurrentes del jugador en turno.
// Esperado: exactamente uno triunfa; el otro se revalida sobre el nuevo estado y falla.
const results = await Promise.allSettled([
  applyGameAction(room.code, currentPlayer, { type: 'discard', cardIds: [cardId] }),
  applyGameAction(room.code, currentPlayer, { type: 'discard', cardIds: [cardId] }),
]);
const ok = results.filter((r) => r.status === 'fulfilled');
const fail = results.filter((r) => r.status === 'rejected');
assert(ok.length === 1, `exactamente 1 jugada aplicada (aplicadas=${ok.length})`);
assert(fail.length === 1, `exactamente 1 jugada rechazada (rechazadas=${fail.length})`);
console.log('  motivo rechazo:', fail[0].reason.message);

// El estado quedó consistente: version subió SOLO 1 respecto a la base.
const after = await getRoom(room.code);
assert(
  after.version === baseVersion + 1,
  `version +1 exacta (base=${baseVersion}, ahora=${after.version})`
);

await leaveRoom(room.code, hostId);
await leaveRoom(room.code, p2);
console.log('\n✓ Smoke de jugada + concurrencia OK');
process.exit(0);
