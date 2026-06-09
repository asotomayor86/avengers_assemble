import { useState } from 'react';
import { session } from '../state/session.js';
import { ROLE } from '../../../shared/constants.js';

// Pantalla de acceso a la web mediante el código compartido.
export default function AccessScreen({ onGranted, notice }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto.');
      session.setAuth(data.token, ROLE.PLAYER);
      onGranted(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen center">
      <div className="card-panel">
        <h1 className="title">Virus! MARVEL</h1>
        <p className="subtitle">Introduce el código de acceso</p>
        {notice && <p className="notice">{notice}</p>}
        <form onSubmit={submit} className="form">
          <input
            className="input"
            type="password"
            inputMode="text"
            autoFocus
            placeholder="Código de acceso"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" disabled={loading || !code}>
            {loading ? 'Comprobando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
