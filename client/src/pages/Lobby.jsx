import { useState, useEffect } from 'react';
import { EVENTS, ROOM_STATUS } from '../../../shared/constants.js';
import { emitAsync, listActiveRooms, accessAdmin, checkAuth } from '../socket.js';
import HowToPlay from '../components/HowToPlay.jsx';

const STATUS_LABEL = {
  [ROOM_STATUS.WAITING]: 'En espera',
  [ROOM_STATUS.PLAYING]: 'En curso',
  [ROOM_STATUS.FINISHED]: 'Terminada',
};

/** Texto del tiempo que lleva una sala sin movimiento. */
function formatIdle(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'activa ahora';
  if (min < 60) return `${min} min sin actividad`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min sin actividad`;
}

// Lobby: crear o unirse a una sala.
export default function Lobby({ notice, onEnterRoom, onLogout }) {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminMode, setAdminMode] = useState(false); // mostrando el formulario de login admin
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState(null);

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

  // ¿Ya hay cookie de admin? (para no pedir la contraseña otra vez)
  useEffect(() => {
    checkAuth()
      .then(({ isAdmin }) => setIsAdmin(!!isAdmin))
      .catch(() => {});
  }, []);

  const adminLogin = async (e) => {
    e.preventDefault();
    setAdminError(null);
    try {
      await accessAdmin(adminPass);
      setIsAdmin(true);
      setAdminMode(false);
      setAdminPass('');
    } catch (err) {
      setAdminError(err.message);
    }
  };

  const closeRoom = async (roomCode) => {
    setError(null);
    try {
      const res = await emitAsync(EVENTS.ADMIN_CLOSE, { code: roomCode });
      setRooms(res.rooms || []);
    } catch (err) {
      setError(err.message);
    }
  };

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
                      <div className="rooms-item-foot">
                        <span className="muted small">⏱ {formatIdle(r.idleMs)}</span>
                        {isAdmin && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => closeRoom(r.code)}
                          >
                            Cerrar
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {error && <p className="error">{error}</p>}

              {/* Acceso de administrador para poder cerrar salas */}
              {!isAdmin && !adminMode && (
                <button
                  className="btn btn-ghost btn-sm admin-toggle"
                  onClick={() => setAdminMode(true)}
                >
                  🔒 Cerrar salas (admin)
                </button>
              )}
              {!isAdmin && adminMode && (
                <form onSubmit={adminLogin} className="admin-login">
                  <input
                    className="input"
                    type="password"
                    autoFocus
                    placeholder="Contraseña de administrador"
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                  />
                  {adminError && <p className="error">{adminError}</p>}
                  <div className="admin-login-btns">
                    <button className="btn btn-primary btn-sm" disabled={!adminPass}>
                      Entrar
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setAdminMode(false);
                        setAdminError(null);
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
              {isAdmin && (
                <p className="muted small center">
                  Modo administrador activo · puedes cerrar salas.
                </p>
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
