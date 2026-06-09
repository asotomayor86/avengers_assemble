import { EVENTS } from '../../shared/constants.js';
import { session } from './state/session.js';

// Capa de transporte sobre la API REST + SSE (sustituye a socket.io).
// Mantiene la firma `emitAsync(evento, payload)` para que las pantallas existentes
// (Lobby, RoomScreen, GameBoard, AdminScreen) no necesiten cambios: cada antiguo
// evento socket.io se traduce a una llamada HTTP. La autenticación va por cookie
// httpOnly (credentials: 'same-origin'), no por token en el cliente.

async function http(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta sin cuerpo */
  }
  if (!res.ok) throw new Error(data?.error || 'Error de red.');
  return data || {};
}

/** Traduce los eventos socket.io originales a llamadas REST. */
export async function emitAsync(event, payload = {}) {
  const { code, playerId } = session.getRoom();
  const enc = encodeURIComponent;

  switch (event) {
    case EVENTS.ROOM_CREATE: {
      const r = await http('POST', '/api/rooms', { nickname: payload.nickname });
      return { roomCode: r.code, playerId: r.playerId, room: r.room };
    }
    case EVENTS.ROOM_JOIN: {
      const r = await http('POST', `/api/rooms/${enc(payload.code)}/join`, {
        nickname: payload.nickname,
      });
      return { roomCode: r.code, playerId: r.playerId, room: r.room };
    }
    case EVENTS.ROOM_RECONNECT: {
      const r = await http('POST', `/api/rooms/${enc(payload.code)}/reconnect`, {
        playerId: payload.playerId,
      });
      return { roomCode: r.code, playerId: r.playerId, room: r.room, game: r.game };
    }
    case EVENTS.ROOM_START:
    case EVENTS.ROOM_RESTART: {
      const r = await http('POST', `/api/rooms/${enc(code)}/start`, { playerId });
      return { room: r.room };
    }
    case EVENTS.ROOM_LEAVE: {
      const r = await http('POST', `/api/rooms/${enc(code)}/leave`, { playerId });
      return { room: r.room };
    }
    case EVENTS.GAME_ACTION: {
      const r = await http('PUT', `/api/rooms/${enc(code)}/action`, {
        playerId,
        action: payload.action,
      });
      return { room: r.room, game: r.game };
    }
    case EVENTS.ADMIN_LIST:
      return http('GET', '/api/admin/rooms');
    case EVENTS.ADMIN_CLOSE:
      return http('DELETE', `/api/admin/rooms/${enc(payload.code)}`);
    default:
      throw new Error('Evento no soportado: ' + event);
  }
}

/** Estado de autenticación actual (la cookie es httpOnly; lo consulta el servidor). */
export function checkAuth() {
  return http('GET', '/api/me');
}

/** Lista de salas activas (código, estado, jugadores) para el lobby. */
export function listActiveRooms() {
  return http('GET', '/api/rooms');
}

/** Cierra sesión (caduca la cookie en el servidor). */
export function logout() {
  return http('DELETE', '/api/access').catch(() => {});
}

/**
 * Suscripción en tiempo real a una sala vía SSE. Llama a onUpdate({version, room, game})
 * en cada cambio y a onGone() si la sala desaparece. El navegador reconecta solo cuando
 * el servidor cierra el stream por fin de vida (~45 s). Devuelve una función para cancelar.
 */
export function subscribeRoom(code, playerId, { onUpdate, onGone } = {}) {
  const url = `/api/rooms/${encodeURIComponent(code)}/stream?playerId=${encodeURIComponent(
    playerId || ''
  )}`;
  const es = new EventSource(url, { withCredentials: true });
  es.addEventListener('update', (e) => {
    try {
      onUpdate?.(JSON.parse(e.data));
    } catch {
      /* ignora frames corruptos */
    }
  });
  es.addEventListener('gone', () => {
    es.close();
    onGone?.();
  });
  // El evento 'reconnect' (fin de vida del stream) no requiere acción: al cerrarse la
  // conexión, EventSource reconecta automáticamente.
  return () => es.close();
}
