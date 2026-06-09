// Persistencia ligera de sesión en localStorage.
// - token/role: sesión de acceso a la web (o admin).
// - roomCode/playerId/nickname: para reconectar a la sala tras recargar o caída.

const KEYS = {
  token: 'vm_token',
  role: 'vm_role',
  roomCode: 'vm_roomCode',
  playerId: 'vm_playerId',
  nickname: 'vm_nickname',
};

export const session = {
  getToken: () => localStorage.getItem(KEYS.token),
  getRole: () => localStorage.getItem(KEYS.role),
  setAuth(token, role) {
    localStorage.setItem(KEYS.token, token);
    localStorage.setItem(KEYS.role, role);
  },
  clearAuth() {
    localStorage.removeItem(KEYS.token);
    localStorage.removeItem(KEYS.role);
  },

  getRoom: () => ({
    code: localStorage.getItem(KEYS.roomCode),
    playerId: localStorage.getItem(KEYS.playerId),
    nickname: localStorage.getItem(KEYS.nickname),
  }),
  setRoom(code, playerId, nickname) {
    localStorage.setItem(KEYS.roomCode, code);
    localStorage.setItem(KEYS.playerId, playerId);
    if (nickname) localStorage.setItem(KEYS.nickname, nickname);
  },
  clearRoom() {
    localStorage.removeItem(KEYS.roomCode);
    localStorage.removeItem(KEYS.playerId);
  },
};
