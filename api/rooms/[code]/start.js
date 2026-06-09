import { wrap, methodGuard } from '../../_lib/handler.js';
import { requireSite } from '../../_lib/auth.js';
import { startGame, serializeRoom } from '../../_lib/rooms.js';

// POST /api/rooms/:code/start { playerId } → el anfitrión empieza (o reinicia) la partida.
export default wrap(async (req, res) => {
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireSite(req, res)) return;
  const { room, version } = await startGame(req.query.code, req.body?.playerId);
  res.status(200).json({ version, room: serializeRoom(room) });
});
