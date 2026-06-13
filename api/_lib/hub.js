// Integración con el Hub familiar usando el paquete reutilizable
// @asotomayor86/hub-client. Este módulo solo adapta la firma a lo que ya usa el
// juego (código + payload) leyendo HUB_URL / HUB_RESULT_SECRET del entorno.
import {
  getHubRoom as getRoom,
  submitResult,
  isPlayer,
} from '@asotomayor86/hub-client/server';

/** Lee la sala del hub por código (o null). */
export function getHubRoom(code) {
  return getRoom(process.env.HUB_URL, code);
}

/** ¿Está el userId entre los jugadores de la sala? */
export { isPlayer as esJugadorDeSala };

/** Envía el resultado de la partida al hub y devuelve { ok, status, ... }. */
export function submitHubResult(code, { kind = 'ranked', results } = {}) {
  return submitResult({
    hubUrl: process.env.HUB_URL,
    secret: process.env.HUB_RESULT_SECRET,
    code,
    kind,
    results,
  });
}
