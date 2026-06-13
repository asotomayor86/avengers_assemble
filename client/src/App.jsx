import { useEffect, useState, useCallback, useRef } from 'react';
import { EVENTS, ROOM_STATUS } from '../../shared/constants.js';
import { emitAsync, subscribeRoom, checkAuth, logout } from './socket.js';
import { session } from './state/session.js';
import LoginScreen from './pages/LoginScreen.jsx';
import Lobby from './pages/Lobby.jsx';
import RoomScreen from './pages/RoomScreen.jsx';
import GameBoard from './pages/GameBoard.jsx';
import AdminScreen from './pages/AdminScreen.jsx';

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
  const unsubRef = useRef(null);

  const stopSub = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
  }, []);

  // Abre el stream SSE de la sala: cada 'update' trae room + game ya filtrados.
  const startSub = useCallback(
    (code, playerId) => {
      stopSub();
      unsubRef.current = subscribeRoom(code, playerId, {
        onUpdate: ({ room, game }) => {
          setRoom(room);
          setGame(game ?? null);
          setScreen('room');
        },
        onGone: () => {
          stopSub();
          session.clearRoom();
          setRoom(null);
          setGame(null);
          setNotice('La sala se ha cerrado.');
          setScreen('lobby');
        },
      });
    },
    [stopSub]
  );

  // Arranque: comprobar acceso (cookie) e intentar reconectar a la sala guardada.
  useEffect(() => {
    let cancelled = false;
    checkAuth()
      .then(({ isSite }) => {
        if (cancelled) return;
        if (!isSite) {
          setScreen('access');
          return;
        }
        const saved = session.getRoom();
        if (saved.code && saved.playerId) {
          emitAsync(EVENTS.ROOM_RECONNECT, { code: saved.code, playerId: saved.playerId })
            .then((res) => {
              if (cancelled) return;
              setRoom(res.room);
              if (res.game) setGame(res.game);
              setScreen('room');
              startSub(saved.code, saved.playerId);
            })
            .catch(() => {
              if (cancelled) return;
              session.clearRoom();
              setScreen('lobby');
            });
        } else {
          setScreen('lobby');
        }
      })
      .catch(() => {
        if (!cancelled) setScreen('access');
      });
    return () => {
      cancelled = true;
      stopSub();
    };
  }, [startSub, stopSub]);

  const handleAccessGranted = () => {
    setNotice(null);
    setScreen('lobby');
  };

  const handleEnterRoom = (res, nickname) => {
    session.setRoom(res.roomCode, res.playerId, nickname);
    setRoom(res.room);
    setNotice(null);
    setScreen('room');
    startSub(res.roomCode, res.playerId);
  };

  const handleLeaveRoom = async () => {
    stopSub();
    try {
      await emitAsync(EVENTS.ROOM_LEAVE, {});
    } catch {
      /* salimos igualmente en el cliente */
    }
    session.clearRoom();
    setRoom(null);
    setGame(null);
    setScreen('lobby');
  };

  const handleLogout = async () => {
    stopSub();
    try {
      await emitAsync(EVENTS.ROOM_LEAVE, {});
    } catch {
      /* puede que no estuviéramos en sala */
    }
    session.clearRoom();
    await logout();
    setRoom(null);
    setGame(null);
    setScreen('access');
  };

  if (screen === 'loading') {
    return <div className="screen center">Cargando…</div>;
  }
  if (screen === 'access') {
    return <LoginScreen notice={notice} onGranted={handleAccessGranted} />;
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
