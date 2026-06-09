import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// Smoke test de la capa de salas contra la Neon real (no toca HTTP).
const { createRoom, joinRoom, startGame, getRoom, leaveRoom, listRooms } = await import(
  '../api/_lib/rooms.js'
);

function assert(cond, msg) {
  if (!cond) throw new Error('FALLO: ' + msg);
  console.log('  ok:', msg);
}

const { room, playerId: hostId } = await createRoom('Tony');
console.log('Sala creada:', room.code, 'host:', hostId);
assert(room.status === 'esperando' || room.status, 'sala con estado inicial');

const joined = await joinRoom(room.code, 'Steve');
assert(joined.room.players.length === 2, 'segundo jugador unido (2 en sala)');

try {
  await joinRoom(room.code, 'Steve');
  throw new Error('no debería permitir apodo duplicado');
} catch (e) {
  assert(/apodo/i.test(e.message), 'rechaza apodo duplicado: ' + e.message);
}

try {
  await startGame(room.code, joined.playerId); // no es host
  throw new Error('no debería dejar empezar a un no-anfitrión');
} catch (e) {
  assert(/anfitri/i.test(e.message), 'solo el anfitrión empieza: ' + e.message);
}

const started = await startGame(room.code, hostId);
assert(started.room.status === 'jugando' || started.room.game, 'partida iniciada con game');
assert(started.version >= 1, 'version incrementada tras empezar (v=' + started.version + ')');

const view = await getRoom(room.code);
assert(view.room.game, 'getRoom devuelve game');

const list = await listRooms();
assert(list.some((r) => r.code === room.code), 'la sala aparece en listRooms');

// Limpieza: ambos salen → sala eliminada.
await leaveRoom(room.code, hostId);
const afterHostLeft = await getRoom(room.code);
assert(afterHostLeft && afterHostLeft.room.hostId === joined.playerId, 'anfitrión reasignado');
const gone = await leaveRoom(room.code, joined.playerId);
assert(gone === null, 'sala eliminada al quedar vacía');
assert((await getRoom(room.code)) === null, 'getRoom null tras eliminar');

console.log('\n✓ Smoke de salas OK');
process.exit(0);
