import { wrap, methodGuard } from '../../_lib/handler.js';
import { requireSite } from '../../_lib/auth.js';
import { applyGameAction, serializeRoom, gameStateFor } from '../../_lib/rooms.js';

// PUT /api/rooms/:code/action { playerId, action } → aplica una jugada.
// El motor valida (autoridad del servidor) y el guardado usa CAS con reintento:
// dos jugadas casi simultáneas se serializan y se revalidan sobre el último estado.
export default wrap(async (req, res) => {
  if (!methodGuard(req, res, ['PUT', 'POST'])) return;
  if (!requireSite(req, res)) return;
  const { playerId, action } = req.body || {};
  const { room, version } = await applyGameAction(req.query.code, playerId, action);
  res.status(200).json({
    version,
    room: serializeRoom(room),
    game: gameStateFor(room, playerId),
  });
});
