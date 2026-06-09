import { wrap, methodGuard } from '../../_lib/handler.js';
import { requireSite } from '../../_lib/auth.js';
import { reconnect, serializeRoom, gameStateFor } from '../../_lib/rooms.js';

// POST /api/rooms/:code/reconnect { playerId } → reanudar sesión tras recargar.
export default wrap(async (req, res) => {
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireSite(req, res)) return;
  const { room, version } = await reconnect(req.query.code, req.body?.playerId);
  res.status(200).json({
    code: room.code,
    playerId: req.body?.playerId,
    version,
    room: serializeRoom(room),
    game: gameStateFor(room, req.body?.playerId),
  });
});
