import { useState, useEffect } from 'react';
import { EVENTS, ROOM_STATUS } from '../../../shared/constants.js';
import { emitAsync, listActiveRooms } from '../socket.js';
import HowToPlay from '../components/HowToPlay.jsx';

const STATUS_LABEL = {
  [ROOM_STATUS.WAITING]: 'En espera',
  [ROOM_STATUS.PLAYING]: 'En curso',
  [ROOM_STATUS.FINISHED]: 'Terminada',
};

// Lobby: crear o unirse a una sala.
export default function Lobby({ notice, onEnterRoom, onLogout }) {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [rooms, setRooms] = useState([]);

  // En la pantalla inicial, refrescar la lista de salas activas cada 4 s.
  useEffect(() => {
    if (mode !== null) return;
    let alive = true;
    const load = () =>
      listActiveRooms()
        .then((d) => alive && setRooms(d.rooms || []))
        .catch(() => {});
    load();
    const id = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [mode]);

  const create = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await emitAsync(EVENTS.ROOM_CREATE, { nickname });
      onEnterRoom(res, nickname);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const join = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await emitAsync(EVENTS.ROOM_JOIN, { code, nickname });
      onEnterRoom(res, nickname);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen">
      <header className="topbar">
        <h1 className="title">ASSEMBLE!</h1>
        <button className="btn btn-ghost btn-sm" onClick={onLogout}>
          Salir
        </button>
      </header>

      <div className="content">
        {notice && <p className="notice">{notice}</p>}

        {mode === null && (
          <div className="stack">
            <button className="btn btn-primary btn-lg" onClick={() => setMode('create')}>
              Crear sala
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => setMode('join')}>
              Unirse a sala
            </button>
            <button className="btn btn-ghost btn-sm howto-link" onClick={() => setShowHelp(true)}>
              ¿Cómo se juega?
            </button>

            <div className="rooms-active">
              <h2 className="subtitle">Salas activas</h2>
              {rooms.length === 0 ? (
                <p className="muted center">No hay salas abiertas ahora mismo.</p>
              ) : (
                <ul className="rooms-list">
                  {rooms.map((r) => (
                    <li key={r.code} className="rooms-item">
                      <div className="rooms-item-head">
                        <span className="room-code-sm">{r.code}</span>
                        <span className={`tag tag-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                      </div>
                      <div className="rooms-item-players">
                        {r.players.length
                          ? r.players.map((p) => p.nickname).join(', ')
                          : 'Sin jugadores'}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={create} className="form">
            <h2 className="subtitle">Crear sala</h2>
            <label className="label">Tu apodo</label>
            <input
              className="input"
              autoFocus
              maxLength={20}
              placeholder="Apodo"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" disabled={loading || !nickname.trim()}>
              {loading ? 'Creando…' : 'Crear'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode(null)}>
              Volver
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={join} className="form">
            <h2 className="subtitle">Unirse a sala</h2>
            <label className="label">Código de sala</label>
            <input
              className="input input-code"
              autoFocus
              maxLength={6}
              placeholder="ABCD"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <label className="label">Tu apodo</label>
            <input
              className="input"
              maxLength={20}
              placeholder="Apodo"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            {error && <p className="error">{error}</p>}
            <button
              className="btn btn-primary"
              disabled={loading || !nickname.trim() || !code.trim()}
            >
              {loading ? 'Entrando…' : 'Unirse'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode(null)}>
              Volver
            </button>
          </form>
        )}
      </div>
      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}
