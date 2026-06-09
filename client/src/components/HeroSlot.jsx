import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Card from './Card.jsx';

// Un héroe en la mesa. El estado se ve en la carta (gris=bloqueado, borde dorado=blindado)
// y, al CAMBIAR de estado, aparece y se difumina un texto grande en blanco sobre la carta.
const STATE_LABEL = {
  libre: 'Libre',
  protegido: 'Protegido',
  blindado: 'Blindado',
  bloqueado: 'Bloqueado',
};

export default function HeroSlot({ slot, size = 'sm', fluid, ownerId, selectable, selected, onClick }) {
  const { hero, powers, state } = slot;
  const slotRef = useRef(null);
  const prevState = useRef(state);
  const seqRef = useRef(0);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    if (prevState.current === state) return undefined;
    prevState.current = state;
    seqRef.current += 1;
    const seq = seqRef.current;
    const el = slotRef.current;
    if (!el) return undefined;
    const r = el.getBoundingClientRect();
    setFlash({ state, seq, x: r.left + r.width / 2, y: r.top + r.height / 2 });
    const t = setTimeout(() => setFlash((f) => (f && f.seq === seq ? null : f)), 1300);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div className="hero-slot" ref={slotRef} data-drop="slot" data-owner={ownerId} data-hero={hero.id}>
      <Card card={hero} size={size} fluid={fluid} state={state} selectable={selectable} selected={selected} onClick={onClick} />
      {powers.length > 0 && (
        <div className="hero-pips">
          {powers.map((p) => (
            <span key={p.id} className={`pip pip-${p.color}`} title={p.name} />
          ))}
        </div>
      )}
      {flash &&
        createPortal(
          <div key={flash.seq} className="hero-flash" style={{ left: flash.x, top: flash.y }}>
            {STATE_LABEL[flash.state]}
          </div>,
          document.body
        )}
    </div>
  );
}
