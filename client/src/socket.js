import { io } from 'socket.io-client';

// Socket singleton. Se conecta al mismo origen (en dev, Vite hace proxy a :3000).
let socket = null;

/** Conecta (o reconecta) el socket con el token de sesión actual. */
export function connectSocket(token) {
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io({
    auth: { token },
    autoConnect: true,
  });
  return socket;
}

export function getSocket() {
  return socket;
}

/**
 * Emite un evento y devuelve una promesa con el ack del servidor.
 * Rechaza si el servidor responde { ok: false }.
 */
export function emitAsync(event, payload) {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Sin conexión.'));
    socket.emit(event, payload, (res) => {
      if (res && res.ok) resolve(res);
      else reject(new Error(res?.error || 'Error desconocido.'));
    });
  });
}
