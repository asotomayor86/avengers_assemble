import { wrap, methodGuard } from '../../_lib/handler.js';
import { requireSite } from '../../_lib/auth.js';
import { leaveRoom, serializeRoom } from '../../_lib/rooms.js';

// POST /api/rooms/:code/leave { playerId } → salir de la sala (botón "salir").
export default wrap(async (req, res) => {
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireSite(req, res)) return;
  const result = await leaveRoom(req.query.code, req.body?.playerId);
  res.status(200).json({ room: result ? serializeRoom(result.room) : null });
});
