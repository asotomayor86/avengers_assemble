import { wrap, methodGuard } from '../../_lib/handler.js';
import { requireSite } from '../../_lib/auth.js';
import { joinRoom, serializeRoom } from '../../_lib/rooms.js';

// POST /api/rooms/:code/join { nickname } → unirse a una sala existente.
export default wrap(async (req, res) => {
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireSite(req, res)) return;
  const { room, playerId, version } = await joinRoom(req.query.code, req.body?.nickname);
  res.status(200).json({ code: room.code, playerId, version, room: serializeRoom(room) });
});
