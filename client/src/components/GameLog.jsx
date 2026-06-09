import { useState } from 'react';

// Registro de jugadas, plegable para no ocupar espacio en móvil.
export default function GameLog({ log }) {
  const [open, setOpen] = useState(false);
  const last = log[log.length - 1];

  return (
    <div className={`game-log ${open ? 'open' : ''}`}>
      <button className="log-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="log-last">{last ? last.text : 'Registro de jugadas'}</span>
        <span className="muted">{open ? '▼' : '▲'}</span>
      </button>
      {open && (
        <ul className="log-list">
          {[...log].reverse().map((entry) => (
            <li key={entry.seq}>{entry.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
