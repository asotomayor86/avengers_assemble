import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// Verifica: reingreso a una partida en curso por apodo + listado de salas.
const { createRoom, joinRoom, startGame, leaveRoom, listRooms, getRoom } = await import(
  '../api/_lib/rooms.js'
);
function assert(c, m) {
  if (!c) throw new Error('FALLO: ' + m);
  console.log('  ok:', m);
}

const { room, playerId: host } = await createRoom('Tony');
const { playerId: steve } = await joinRoom(room.code, 'Steve');
await startGame(room.code, host);

// Steve se sale por error (partida en curso).
await leaveRoom(room.code, steve);
let cur = await getRoom(room.code);
assert(!cur.room.players.some((p) => p.id === steve), 'Steve sale de la sala (ya no figura)');
assert(cur.room.game.players[steve], 'pero su sitio sigue en la partida (mano/equipo intactos)');

// Reingreso por apodo → recupera el MISMO id.
const back = await joinRoom(room.code, 'Steve');
assert(back.playerId === steve, 'reingreso devuelve el mismo playerId (' + (back.playerId === steve) + ')');

// Un desconocido NO puede colarse en la partida en curso.
let blocked = false;
try {
  await joinRoom(room.code, 'Intruso');
} catch (e) {
  blocked = /empezado/i.test(e.message);
}
assert(blocked, 'un apodo nuevo NO puede unirse a una partida en curso');

// Listado: la sala aparece con estado y jugadores.
const list = await listRooms();
const mine = list.find((r) => r.code === room.code);
assert(mine && mine.status === 'playing', 'listRooms muestra la sala como en curso');
assert(mine.players.some((p) => p.nickname === 'Steve'), 'el listado incluye a Steve (reingresado)');

await leaveRoom(room.code, host);
await leaveRoom(room.code, steve);
console.log('\n✓ Smoke reingreso + listado OK');
process.exit(0);
