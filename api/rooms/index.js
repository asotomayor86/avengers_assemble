import { wrap, methodGuard } from '../_lib/handler.js';
import { requireSite } from '../_lib/auth.js';
import { createRoom, serializeRoom } from '../_lib/rooms.js';

// POST /api/rooms { nickname } → crea una sala. El creador es anfitrión.
export default wrap(async (req, res) => {
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireSite(req, res)) return;
  const { room, playerId, version } = await createRoom(req.body?.nickname);
  res.status(200).json({ code: room.code, playerId, version, room: serializeRoom(room) });
});
