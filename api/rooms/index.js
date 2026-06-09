import { wrap, methodGuard } from '../_lib/handler.js';
import { requireSite } from '../_lib/auth.js';
import { createRoom, listRooms, serializeRoom } from '../_lib/rooms.js';

// GET  /api/rooms          → lista de salas activas (código, estado, jugadores).
// POST /api/rooms {nick}   → crea una sala (el creador es anfitrión).
export default wrap(async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  if (!requireSite(req, res)) return;

  if (req.method === 'GET') {
    return res.status(200).json({ rooms: await listRooms() });
  }

  const { room, playerId, version } = await createRoom(req.body?.nickname);
  res.status(200).json({ code: room.code, playerId, version, room: serializeRoom(room) });
});
