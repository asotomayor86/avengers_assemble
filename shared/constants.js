// Constantes compartidas entre cliente y servidor.
// Mantener este archivo libre de dependencias para poder importarlo en ambos lados.

/** Estado de una sala. */
export const ROOM_STATUS = {
  WAITING: 'waiting',   // sala de espera, aún no ha empezado la partida
  PLAYING: 'playing',   // partida en curso
  FINISHED: 'finished', // partida terminada
};

/** Límites de jugadores por sala. */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;

/** Roles de sesión. */
export const ROLE = {
  PLAYER: 'player',
  ADMIN: 'admin',
};

/** Eventos de Socket.IO (un único catálogo para evitar strings sueltos). */
export const EVENTS = {
  // Cliente -> Servidor
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_RECONNECT: 'room:reconnect',
  ROOM_LEAVE: 'room:leave',
  ROOM_START: 'room:start',
  ROOM_RESTART: 'room:restart',
  GAME_ACTION: 'game:action',
  ADMIN_LIST: 'admin:list',
  ADMIN_CLOSE: 'admin:close',

  // Servidor -> Cliente
  ROOM_UPDATE: 'room:update',
  ROOM_CLOSED: 'room:closed',
  ADMIN_ROOMS: 'admin:rooms',
  GAME_STATE: 'game:state',
  GAME_LOG: 'game:log',
  ERROR: 'app:error',
};

/** Tipos y colores de carta (se usan ya en el modelo, aunque el juego llega en fase 2). */
export const CARD_TYPE = {
  HERO: 'hero',
  POWER: 'power',
  VILLAIN: 'villain',
  ALLY: 'ally',
  ACTION: 'action',
};

export const CARD_COLOR = {
  RED: 'red',
  YELLOW: 'yellow',
  GREEN: 'green',
  BLUE: 'blue',
  MULTICOLOR: 'multicolor',
  GRAY: 'gray',
  PURPLE: 'purple',
};
