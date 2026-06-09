import { wrap, methodGuard } from '../../_lib/handler.js';
import { requireSite } from '../../_lib/auth.js';
import {
  joinRoom,
  reconnect,
  startGame,
  leaveRoom,
  applyGameAction,
  serializeRoom,
  gameStateFor,
} from '../../_lib/rooms.js';

// Dispatcher único para las mutaciones de una sala. Un solo archivo = una sola
// función serverless (el plan Hobby limita a 12). El segmento dinámico :action
// (join | reconnect | start | leave | action) selecciona la operación.
export default wrap(async (req, res) => {
  if (!methodGuard(req, res, ['POST', 'PUT'])) return;
  if (!requireSite(req, res)) return;

  const code = req.query.code;
  const body = req.body || {};

  switch (req.query.action) {
    case 'join': {
      const { room, playerId, version } = await joinRoom(code, body.nickname);
      return res
        .status(200)
        .json({ code: room.code, playerId, version, room: serializeRoom(room) });
    }
    case 'reconnect': {
      const { room, version } = await reconnect(code, body.playerId);
      return res.status(200).json({
        code: room.code,
        playerId: body.playerId,
        version,
        room: serializeRoom(room),
        game: gameStateFor(room, body.playerId),
      });
    }
    case 'start': {
      const { room, version } = await startGame(code, body.playerId);
      return res.status(200).json({ version, room: serializeRoom(room) });
    }
    case 'leave': {
      const result = await leaveRoom(code, body.playerId);
      return res.status(200).json({ room: result ? serializeRoom(result.room) : null });
    }
    case 'action': {
      const { room, version } = await applyGameAction(code, body.playerId, body.action);
      return res.status(200).json({
        version,
        room: serializeRoom(room),
        game: gameStateFor(room, body.playerId),
      });
    }
    default:
      return res.status(404).json({ error: 'Acción de sala no encontrada.' });
  }
});
