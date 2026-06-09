import HeroSlot from './HeroSlot.jsx';
import { slotKey } from '../game/targeting.js';

// Zona de un jugador: nombre lateral + sus héroes + número de "listos".
// Las animaciones (mover/eliminar héroes) las gestiona GameBoard a nivel de tablero,
// porque necesita ver todas las zonas a la vez (p. ej. Wanda mueve cartas entre zonas).
export default function PlayerZone({
  player,
  team,
  isMe,
  isCurrent,
  selectableSlotKeys,
  onSlotClick,
  selectablePlayer,
  onPlayerClick,
  discard,
}) {
  const clickableZone = selectablePlayer ? () => onPlayerClick(player.id) : undefined;
  const readyCount = team.filter((s) => s.state !== 'bloqueado').length;

  return (
    <div
      className={[
        'player-zone',
        isMe ? 'zone-me' : '',
        isCurrent ? 'zone-current' : '',
        selectablePlayer ? 'zone-selectable' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={clickableZone}
      data-drop="zone"
      data-player={player.id}
    >
      <div className="zone-side">
        <span className="zone-name-vert">{isMe ? 'Tú' : player.nickname}</span>
      </div>

      <div className="zone-heroes">
        {team.length === 0 && <span className="muted small">Sin héroes</span>}
        {team.map((slot) => {
          const key = slotKey(player.id, slot.hero.id);
          const selectable = Boolean(selectableSlotKeys?.has(key));
          return (
            <HeroSlot
              key={slot.hero.id}
              slot={slot}
              ownerId={player.id}
              fluid
              selectable={selectable}
              onClick={
                selectable
                  ? (e) => {
                      e.stopPropagation();
                      onSlotClick(player.id, slot);
                    }
                  : undefined
              }
            />
          );
        })}
      </div>

      {/* Número grande y difuminado de héroes listos (no bloqueados), a la derecha */}
      <div className="zone-count">{readyCount}</div>

      {/* Aviso de descarte: superpuesto sobre la zona del jugador que se descarta */}
      {discard && <div className="zone-discard">Descarte</div>}
    </div>
  );
}
