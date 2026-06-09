import { useEffect, useState, useCallback } from 'react';
import { EVENTS } from '../../shared/constants.js';
import { connectSocket, emitAsync, getSocket } from './socket.js';
import { session } from './state/session.js';
import AccessScreen from './pages/AccessScreen.jsx';
import Lobby from './pages/Lobby.jsx';
import RoomScreen from './pages/RoomScreen.jsx';
import GameBoard from './pages/GameBoard.jsx';
import AdminScreen from './pages/AdminScreen.jsx';
import { ROOM_STATUS } from '../../shared/constants.js';

// El panel de administración vive en la ruta con hash #admin.
const IS_ADMIN_ROUTE =
  typeof window !== 'undefined' && window.location.hash.replace('#', '') === 'admin';

export default function App() {
  if (IS_ADMIN_ROUTE) return <AdminScreen />;
  return <PlayerApp />;
}

function PlayerApp() {
  const [screen, setScreen] = useState('loading'); // loading | access | lobby | room
  const [room, setRoom] = useState(null);
  const [game, setGame] = useState(null);
  const [notice, setNotice] = useState(null);

  // Suscripción a eventos de sala/juego, válida mientras haya socket.
  const attachListeners = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.off(EVENTS.ROOM_UPDATE);
    socket.off(EVENTS.ROOM_CLOSED);
    socket.off(EVENTS.GAME_STATE);
    socket.off('connect_error');
    socket.on(EVENTS.ROOM_UPDATE, (r) => {
      setRoom(r);
      setScreen('room');
    });
    socket.on(EVENTS.GAME_STATE, (g) => setGame(g));
    socket.on(EVENTS.ROOM_CLOSED, ({ reason }) => {
      session.clearRoom();
      setRoom(null);
      setGame(null);
      setNotice(reason || 'La sala se ha cerrado.');
      setScreen('lobby');
    });
    // Si el token ya no es válido (p. ej. el servidor se reinició), no nos quedamos
    // colgados: limpiamos la sesión y volvemos a pedir el código de acceso.
    socket.on('connect_error', (err) => {
      if (/autoriz/i.test(err.message)) {
        socket.disconnect();
        session.clearAuth();
        session.clearRoom();
        setRoom(null);
        setGame(null);
        setNotice('Tu sesión ha caducado. Vuelve a introducir el código de acceso.');
        setScreen('access');
      }
    });
  }, []);

  // Arranque: si hay token, conectar e intentar reconexión a la sala guardada.
  useEffect(() => {
    const token = session.getToken();
    if (!token) {
      setScreen('access');
      return;
    }
    connectSocket(token);
    attachListeners();

    const saved = session.getRoom();
    if (saved.code && saved.playerId) {
      emitAsync(EVENTS.ROOM_RECONNECT, { code: saved.code, playerId: saved.playerId })
        .then((res) => {
          setRoom(res.room);
          if (res.game) setGame(res.game);
          setScreen('room');
        })
        .catch(() => {
          session.clearRoom();
          setScreen('lobby');
        });
    } else {
      setScreen('lobby');
    }
  }, [attachListeners]);

  const handleAccessGranted = (token) => {
    connectSocket(token);
    attachListeners();
    setScreen('lobby');
  };

  const handleEnterRoom = (res, nickname) => {
    session.setRoom(res.roomCode, res.playerId, nickname);
    setRoom(res.room);
    setNotice(null);
    setScreen('room');
  };

  const handleLeaveRoom = async () => {
    try {
      await emitAsync(EVENTS.ROOM_LEAVE, {});
    } catch {
      /* ignorar: igualmente salimos en el cliente */
    }
    session.clearRoom();
    setRoom(null);
    setGame(null);
    setScreen('lobby');
  };

  const handleLogout = () => {
    const socket = getSocket();
    if (socket) socket.disconnect();
    session.clearRoom();
    session.clearAuth();
    setRoom(null);
    setGame(null);
    setScreen('access');
  };

  if (screen === 'loading') {
    return <div className="screen center">Cargando…</div>;
  }
  if (screen === 'access') {
    return <AccessScreen notice={notice} onGranted={handleAccessGranted} />;
  }
  if (screen === 'room' && room) {
    const inGame = room.status === ROOM_STATUS.PLAYING || room.status === ROOM_STATUS.FINISHED;
    if (inGame) {
      if (!game) return <div className="screen center">Cargando partida…</div>;
      const myId = session.getRoom().playerId;
      return <GameBoard room={room} game={game} myId={myId} onLeave={handleLeaveRoom} />;
    }
    return <RoomScreen room={room} onLeave={handleLeaveRoom} />;
  }
  return <Lobby notice={notice} onEnterRoom={handleEnterRoom} onLogout={handleLogout} />;
}
