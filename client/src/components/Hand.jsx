import { useEffect, useRef } from 'react';
import Card from './Card.jsx';

// La mano del jugador (abajo). Cada carta se puede arrastrar (drag & drop) y, si se toca
// sin arrastrar, se selecciona. Las cartas recién robadas entran con una animación.
export default function Hand({ cards, selectedId, onCardPointerDown, disabled }) {
  const prevIds = useRef(new Set());
  const isNew = (id) => !prevIds.current.has(id);
  useEffect(() => {
    prevIds.current = new Set(cards.map((c) => c.id));
  });

  return (
    <div className="hand">
      {cards.length === 0 && <span className="muted">Sin cartas</span>}
      {cards.map((card) => (
        <div
          className={`hand-card ${isNew(card.id) ? 'dealt' : ''}`}
          key={card.id}
          style={{ touchAction: 'none' }}
          onPointerDown={disabled ? undefined : (e) => onCardPointerDown(e, card)}
        >
          <Card card={card} fluid selected={selectedId === card.id} />
        </div>
      ))}
    </div>
  );
}
