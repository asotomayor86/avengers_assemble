import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { EVENTS } from '../../../shared/constants.js';
import { emitAsync } from '../socket.js';
import { describeTargeting, slotKey } from '../game/targeting.js';
import PlayerZone from '../components/PlayerZone.jsx';
import HeroSlot from '../components/HeroSlot.jsx';
import Hand from '../components/Hand.jsx';
import Card from '../components/Card.jsx';
import GameLog from '../components/GameLog.jsx';

export default function GameBoard({ room, game, myId, onLeave }) {
  const [selectedId, setSelectedId] = useState(null);
  const [discardSet, setDiscardSet] = useState(new Set()); // cartas en cola para descartar
  const [error, setError] = useState(null);
  const [dragCard, setDragCard] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  // Animaciones de héroes a nivel de tablero: deslizar al moverse (incl. Wanda entre zonas)
  // y "Eliminada" + encoger solo cuando un héroe desaparece de todos los equipos.
  const boardRef = useRef(null);
  const heroRectsRef = useRef(new Map());
  const heroSlotsRef = useRef(new Map());
  const prevRectsRef = useRef(new Map()); // posiciones de héroes ANTES de la última actualización
  const seqRef = useRef(0);
  const [dying, setDying] = useState([]);

  useLayoutEffect(() => {
    const oldRects = heroRectsRef.current;
    const oldSlots = heroSlotsRef.current;
    prevRectsRef.current = oldRects; // para situar efectos sobre héroes recién eliminados
    if (game.status !== 'playing') {
      heroRectsRef.current = new Map();
      heroSlotsRef.current = new Map();
      return;
    }
    const newSlots = new Map();
    for (const pid of Object.keys(game.teams)) {
      for (const slot of game.teams[pid]) newSlots.set(slot.hero.id, slot);
    }
    const newRects = new Map();
    const board = boardRef.current;
    const els = board ? board.querySelectorAll('[data-hero]') : [];
    els.forEach((el) => {
      const id = el.getAttribute('data-hero');
      const r = el.getBoundingClientRect();
      newRects.set(id, r);
      const old = oldRects.get(id);
      if (old) {
        const dx = old.left - r.left;
        const dy = old.top - r.top;
        if (dx || dy) {
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          el.style.transition = 'transform 0s';
          requestAnimationFrame(() => {
            el.style.transition = 'transform 0.42s ease';
            el.style.transform = '';
          });
        }
      }
    });
    // Eliminados: estaban antes y ya no existen en NINGÚN equipo → "Eliminada".
    const adds = [];
    for (const [id, rect] of oldRects) {
      if (!newSlots.has(id)) {
        const slot = oldSlots.get(id);
        if (slot) adds.push({ key: `${id}:${seqRef.current++}`, slot, rect });
      }
    }
    heroRectsRef.current = newRects;
    heroSlotsRef.current = newSlots;
    if (adds.length) {
      setDying((d) => [...d, ...adds]);
      const keys = new Set(adds.map((a) => a.key));
      setTimeout(() => setDying((d) => d.filter((x) => !keys.has(x.key))), 1300);
    }
  }, [game]);

  const nick = (id) => game.players.find((p) => p.id === id)?.nickname || '¿?';
  const me = game.players.find((p) => p.id === myId);
  const opponents = game.players.filter((p) => p.id !== myId);
  const pending = game.pending;
  const canAct = game.currentPlayer === myId && !pending && game.status === 'playing';
  const myTurn = game.currentPlayer === myId;
  const finished = game.status === 'finished';

  // Aviso de descarte: cuando otro jugador se descarta, mostramos un mensaje al
  // resto ANTES del cambio de turno (sustituye brevemente a la línea de turno).
  // Avisos derivados de lastAction (descarte y jugada sobre un héroe). Un único
  // contador monótono `n` evita repetir avisos y reproducir los anteriores al cargar.
  const seenActionN = useRef(null);
  const [discardActor, setDiscardActor] = useState(null);
  const [playFx, setPlayFx] = useState(null);
  useEffect(() => {
    const la = game.lastAction;
    if (!la) return;
    if (seenActionN.current === null) {
      seenActionN.current = la.n; // primera carga: no reproducir avisos anteriores
      return;
    }
    if (la.n <= seenActionN.current) return;
    seenActionN.current = la.n;
    if (la.kind === 'discard') {
      if (la.actorId !== myId) setDiscardActor(la.actorId);
    } else if (la.kind === 'play' && la.card) {
      let pos = null;
      if (la.target?.heroId) {
        // Sobre el héroe objetivo. Si ya no está en el tablero (lo destruyó este
        // mismo villano), usamos su última posición conocida para que la carta se
        // vea actuar ANTES de la animación de "Eliminada".
        const el = boardRef.current?.querySelector(`[data-hero="${la.target.heroId}"]`);
        const r = el ? el.getBoundingClientRect() : prevRectsRef.current?.get(la.target.heroId);
        if (r) {
          pos = { x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.max(r.width, 72) };
        }
      } else if (la.target?.ownerId) {
        // Sin héroe (Wanda, Viuda Negra): sobre el lado derecho de la zona del afectado.
        const el = boardRef.current?.querySelector(`[data-player="${la.target.ownerId}"]`);
        if (el) {
          const r = el.getBoundingClientRect();
          pos = {
            x: r.left + r.width * 0.72,
            y: r.top + r.height / 2,
            w: Math.min(Math.max(r.height * 0.82, 60), 120),
          };
        }
      }
      if (pos) setPlayFx({ card: la.card, pos, kind: la.card.type, seq: la.n });
    }
  }, [game, myId]);
  useEffect(() => {
    if (!discardActor) return undefined;
    const t = setTimeout(() => setDiscardActor(null), 2300);
    return () => clearTimeout(t);
  }, [discardActor]);
  useEffect(() => {
    if (!playFx) return undefined;
    const t = setTimeout(() => setPlayFx(null), 1000);
    return () => clearTimeout(t);
  }, [playFx]);

  const handCards = (game.hand || []).filter((c) => !discardSet.has(c.id));
  const selectedCard = handCards.find((c) => c.id === selectedId) || null;

  const send = async (action) => {
    setError(null);
    try {
      await emitAsync(EVENTS.GAME_ACTION, { action });
      setSelectedId(null);
      setDiscardSet(new Set());
    } catch (err) {
      setError(err.message);
    }
  };

  // Carta "activa" para resaltar objetivos: la que arrastras o la seleccionada al tocar.
  const retargeting = pending?.kind === 'retarget' && pending.isActor;
  const activeCard = retargeting ? null : dragCard || (canAct && discardSet.size === 0 ? selectedCard : null);
  const activeTargeting = describeTargeting(activeCard, game, myId);

  let activeSlotKeys = new Set();
  let activePlayers = new Set();
  let onSlotClick = () => {};
  let onPlayerClick = () => {};

  if (retargeting) {
    activeSlotKeys = new Set((pending.validTargets || []).filter((t) => t.heroId).map((t) => slotKey(t.ownerId, t.heroId)));
    activePlayers = new Set((pending.validTargets || []).filter((t) => !t.heroId).map((t) => t.ownerId));
    onSlotClick = (ownerId, slot) => send({ type: 'retarget', target: { ownerId, heroId: slot.hero.id } });
    onPlayerClick = (pid) => send({ type: 'retarget', target: { ownerId: pid } });
  } else if (activeCard) {
    activeSlotKeys = activeTargeting.slotKeys;
    activePlayers = new Set(activeTargeting.players);
    if (activeCard.type === 'hero' || activeCard.effect === 'snap') activePlayers.add(myId);
    // Flujo de TAP (sin arrastrar): tocar carta y luego el objetivo resaltado.
    if (canAct && selectedCard && !dragCard) {
      onSlotClick = (ownerId, slot) => send({ type: 'play', cardId: selectedCard.id, target: { ownerId, heroId: slot.hero.id } });
      onPlayerClick = (pid) => {
        if ((selectedCard.type === 'hero' || selectedCard.effect === 'snap') && pid === myId) {
          return send({ type: 'play', cardId: selectedCard.id, target: {} });
        }
        send({ type: 'play', cardId: selectedCard.id, target: selectedCard.effect === 'spy' ? { victimId: pid } : { ownerId: pid } });
      };
    }
  }

  const playImmediate = () => send({ type: 'play', cardId: selectedCard.id, target: {} });

  // --- Descartar: arrastrar cartas al montón de descarte y confirmar ---
  const stageDiscard = (id) => setDiscardSet((prev) => new Set(prev).add(id));
  const confirmDiscard = () => send({ type: 'discard', cardIds: [...discardSet] });
  const cancelDiscard = () => setDiscardSet(new Set());

  // --- Arrastrar cartas (eventos de puntero: vale para ratón y táctil) ---
  const performDrop = (dropEl, card) => {
    if (!dropEl || !canAct) return;
    const kind = dropEl.dataset.drop;
    if (kind === 'discard') return stageDiscard(card.id);
    const t = describeTargeting(card, game, myId);
    const pid = dropEl.dataset.player || dropEl.dataset.owner;
    // Héroe o Chasquido: soltar en cualquier parte de mi zona lo juega.
    if ((card.type === 'hero' || card.effect === 'snap') && pid === myId) {
      return send({ type: 'play', cardId: card.id, target: {} });
    }
    if (kind === 'slot') {
      const owner = dropEl.dataset.owner;
      const hero = dropEl.dataset.hero;
      if (t.slotKeys.has(slotKey(owner, hero))) {
        send({ type: 'play', cardId: card.id, target: { ownerId: owner, heroId: hero } });
      }
      return;
    }
    if (kind === 'zone' && t.players.has(pid)) {
      send({ type: 'play', cardId: card.id, target: card.effect === 'spy' ? { victimId: pid } : { ownerId: pid } });
    }
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return;
    if (!d.moved) {
      d.moved = true;
      setSelectedId(null);
      setDragCard(d.card);
    }
    setDragPos({ x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e) => {
    const d = dragRef.current;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    dragRef.current = null;
    if (d && d.moved) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      performDrop(el?.closest('[data-drop]') || null, d.card);
    } else if (d) {
      setSelectedId((prev) => (prev === d.card.id ? null : d.card.id));
    }
    setDragCard(null);
  };
  const onCardPointerDown = (e, card) => {
    if (!canAct) return;
    dragRef.current = { card, x0: e.clientX, y0: e.clientY, moved: false };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="screen board" ref={boardRef}>
      <GameLog log={game.log || []} />

      <header className="board-top">
        <div className="board-counts">
          <span title="Mazo">🂠 {game.deckCount}</span>
          <span title="Descarte">🗑 {game.discardCount}</span>
        </div>
        <button className="btn btn-ghost btn-sm board-leave" onClick={onLeave}>
          Salir
        </button>
      </header>

      {game.status === 'playing' && (
        <div key={game.currentPlayer} className={`turn-line ${myTurn ? 'mine' : 'other'}`}>
          {myTurn ? 'Tu turno' : `Turno de ${nick(game.currentPlayer)}`}
        </div>
      )}

      {/* Al terminar la partida, las zonas y la mano desaparecen (pantalla de victoria limpia). */}
      {!finished && (
      <>
      {/* Zonas rivales: se apilan arriba y hacen scroll si hay muchas. */}
      <div className="opponents-scroll">
        {opponents.map((p) => (
          <PlayerZone
            key={p.id}
            player={p}
            team={game.teams[p.id] || []}
            isMe={false}
            isCurrent={game.currentPlayer === p.id}
            selectableSlotKeys={activeSlotKeys}
            onSlotClick={onSlotClick}
            selectablePlayer={activePlayers.has(p.id)}
            onPlayerClick={onPlayerClick}
            discard={discardActor === p.id}
          />
        ))}
      </div>

      {/* Mi zona: fija, justo encima de mi mano. */}
      <div className="my-zone-fixed">
        <PlayerZone
          player={me}
          team={game.teams[myId] || []}
          isMe
          isCurrent={game.currentPlayer === myId}
          selectableSlotKeys={activeSlotKeys}
          onSlotClick={onSlotClick}
          selectablePlayer={activePlayers.has(myId)}
          onPlayerClick={onPlayerClick}
          discard={discardActor === myId}
        />
      </div>

      {error && <p className="error board-error">{error}</p>}

      <div className="hand-row">
        <div className="deck-pile" title={`Mazo: ${game.deckCount} cartas`}>
          <div className="deck">
            <div className="deck-card">
              <span className="deck-label">MAZO</span>
              <span className="deck-count">{game.deckCount}</span>
            </div>
          </div>
        </div>

        <Hand
          cards={handCards}
          selectedId={selectedId}
          onCardPointerDown={onCardPointerDown}
          disabled={!canAct}
        />

        <div className="deck-pile" data-drop="discard" title={`Descarte: ${game.discardCount} cartas`}>
          <div className={`deck deck--discard ${dragCard ? 'deck--drop' : ''}`}>
            <div className="deck-card">
              <span className="deck-label">DESCARTE</span>
              <span className="deck-count">{game.discardCount}</span>
              {discardSet.size > 0 && <span className="deck-staged">+{discardSet.size}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de acción (debajo del todo) */}
      {discardSet.size > 0 ? (
        <div className="action-bar">
          <span className="muted">{discardSet.size} carta(s) en el descarte</span>
          <div className="action-bar-btns">
            <button className="btn btn-primary btn-sm" onClick={confirmDiscard}>
              Descartar ({discardSet.size})
            </button>
            <button className="btn btn-ghost btn-sm" onClick={cancelDiscard}>
              Cancelar
            </button>
          </div>
        </div>
      ) : canAct && selectedCard ? (
        <div className="action-bar">
          <ActionHint card={selectedCard} targeting={activeTargeting} onPlay={playImmediate} onCancel={() => setSelectedId(null)} />
        </div>
      ) : canAct ? (
        <div className="action-bar">
          <span className="muted">Arrastra una carta a un héroe o zona para jugarla, o al descarte.</span>
        </div>
      ) : (
        // No es tu turno: visor vacío para reservar el espacio y que la pantalla no salte.
        <div className="action-bar action-bar--empty" />
      )}
      </>
      )}

      {/* Ventanas (pending) y fin de partida */}
      {pending?.kind === 'counter' && <CounterModal pending={pending} nick={nick} onRespond={send} />}
      {pending?.kind === 'retarget' && !pending.isActor && (
        <Banner text={`${nick(pending.actorId)} busca un nuevo objetivo para ${pending.cardName}…`} />
      )}
      {pending?.kind === 'retarget' && pending.isActor && (
        <Banner
          text={`Tu ${pending.cardName} fue contrarrestada. Elige un nuevo objetivo resaltado.`}
          action={<button className="btn btn-ghost btn-sm" onClick={() => send({ type: 'retarget', skip: true })}>Descartar sin objetivo</button>}
        />
      )}
      {pending?.kind === 'snap' && pending.needsMe && (
        <SnapModal pending={pending} team={game.teams[myId] || []} onSubmit={send} />
      )}
      {pending?.kind === 'snap' && !pending.needsMe && (
        <Banner text={`Chasquido de ${nick(pending.actorId)}: esperando elecciones…`} />
      )}
      {pending?.kind === 'spy' && pending.isActor && (
        <SpyModal pending={pending} game={game} myId={myId} onPlay={send} />
      )}
      {pending?.kind === 'spy' && !pending.isActor && pending.victimId === myId && (
        <Banner text={`${nick(pending.actorId)} está espiando tu mano…`} />
      )}
      {pending?.kind === 'spy' && !pending.isActor && pending.victimId !== myId && (
        <Banner text={`${nick(pending.actorId)} espía a ${nick(pending.victimId)}…`} />
      )}

      {game.status === 'finished' && (
        <EndOverlay game={game} room={room} myId={myId} nick={nick} onLeave={onLeave} onRestart={() => emitAsync(EVENTS.ROOM_RESTART, {})} />
      )}

      {/* Carta fantasma que sigue al dedo/ratón mientras arrastras */}
      {dragCard && (
        <div className="drag-ghost" style={{ left: dragPos.x, top: dragPos.y }}>
          <Card card={dragCard} fluid />
        </div>
      )}

      {/* Efecto: la carta jugada (villano/poder/aliado/acción) actúa sobre el héroe objetivo */}
      {playFx &&
        createPortal(
          <div
            key={playFx.seq}
            className={`play-fx play-fx--${playFx.kind}`}
            style={{ left: playFx.pos.x, top: playFx.pos.y, width: playFx.pos.w }}
          >
            <span className="play-fx-burst" />
            <span className="play-fx-card">
              <Card card={playFx.card} fluid />
            </span>
          </div>,
          document.body
        )}

      {/* Héroes destruidos: se encogen con el mensaje "Eliminada" */}
      {dying.map((d) => [
        createPortal(
          <div key={`${d.key}-c`} className="hero-dying" style={{ left: d.rect.left, top: d.rect.top, width: d.rect.width }}>
            <Card card={d.slot.hero} fluid state={d.slot.state} />
          </div>,
          document.body
        ),
        createPortal(
          <div key={`${d.key}-t`} className="hero-flash" style={{ left: d.rect.left + d.rect.width / 2, top: d.rect.top + d.rect.height / 2 }}>
            Eliminada
          </div>,
          document.body
        ),
      ])}
    </div>
  );
}

// --- Barra de acción ---
function ActionHint({ card, targeting, onPlay, onCancel }) {
  let hint = `Elige objetivo para ${card.name}`;
  if (targeting.mode === 'player') hint = `Elige a quién aplicar ${card.name}`;
  if (!targeting.playable) {
    hint =
      card.effect === 'counter'
        ? 'Contrarrestar solo se juega como respuesta en el turno rival.'
        : `No hay objetivos válidos para ${card.name}.`;
  }
  return (
    <>
      <span className="muted">{hint}</span>
      <div className="action-bar-btns">
        {targeting.immediate && targeting.playable && (
          <button className="btn btn-primary btn-sm" onClick={onPlay}>
            Jugar {card.name}
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </>
  );
}

// --- Banner informativo ---
function Banner({ text, action }) {
  return (
    <div className="banner">
      <span>{text}</span>
      {action}
    </div>
  );
}

// --- Modal de Contrarrestar ---
// Carta de previsualización de Doctor Strange (la que jugarías al contrarrestar).
const STRANGE_CARD = {
  id: 'strange-preview',
  type: 'action',
  name: 'Doctor Strange',
  effect: 'counter',
  color: 'purple',
  imageUrl: null,
};

function CounterModal({ pending, nick, onRespond }) {
  if (!pending.canRespond) {
    return <Banner text={`${nick(pending.actorId)} juega ${pending.cardName} contra ${nick(pending.responderId)}…`} />;
  }
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>¿Contrarrestar?</h3>
        <p className="muted">
          {nick(pending.actorId)} juega <strong>{pending.cardName}</strong> contra ti.
        </p>
        <div className="counter-card">
          <Card card={STRANGE_CARD} fluid />
        </div>
        <div className="modal-btns">
          <button className="btn btn-primary" onClick={() => onRespond({ type: 'respond', decision: 'counter' })}>
            Jugar Doctor Strange
          </button>
          <button className="btn btn-ghost" onClick={() => onRespond({ type: 'respond', decision: 'pass' })}>
            Dejar pasar
          </button>
        </div>
        <p className="small muted">Si contrarrestas, no robarás al final de este turno.</p>
      </div>
    </div>
  );
}

// --- Modal de Chasquido ---
function SnapModal({ pending, team, onSubmit }) {
  const [sel, setSel] = useState(new Set());
  const need = pending.mustSelect;
  const toggle = (id) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else if (next.size < need) next.add(id);
    setSel(next);
  };
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Chasquido 🫰</h3>
        <p className="muted">Elige {need} héroe(s) de tu equipo para eliminar.</p>
        <div className="modal-heroes">
          {team.map((slot) => (
            <HeroSlot key={slot.hero.id} slot={slot} selectable selected={sel.has(slot.hero.id)} onClick={() => toggle(slot.hero.id)} />
          ))}
        </div>
        <div className="modal-btns">
          <button className="btn btn-primary" disabled={sel.size !== need} onClick={() => onSubmit({ type: 'snap-select', heroIds: [...sel] })}>
            Eliminar ({sel.size}/{need})
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Modal de Espiar ---
function SpyModal({ pending, game, myId, onPlay }) {
  const [chosen, setChosen] = useState(null);
  const hand = pending.victimHand || [];
  const targeting = describeTargeting(chosen, game, myId);

  const playCard = (target) => onPlay({ type: 'spy-play', cardId: chosen.id, play: target || {} });

  const myTeam = game.teams[myId] || [];
  const targetSlots = (ownerId, team) => team.filter((s) => targeting.slotKeys.has(slotKey(ownerId, s.hero.id)));

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Espiar 🕵️</h3>
        {!chosen && (
          <>
            <p className="muted">Mano de {game.players.find((p) => p.id === pending.victimId)?.nickname}. Debes jugar una carta si puedes.</p>
            <div className="spy-hand">
              {hand.map((c) => {
                const blocked = c.type === 'action' && (c.effect === 'spy' || c.effect === 'counter' || c.effect === 'snap');
                return <Card key={c.id} card={c} size="md" selectable={!blocked} onClick={blocked ? undefined : () => setChosen(c)} />;
              })}
            </div>
            <div className="modal-btns">
              <button className="btn btn-ghost" onClick={() => onPlay({ type: 'spy-skip' })}>
                No jugar ninguna
              </button>
            </div>
          </>
        )}

        {chosen && (
          <>
            <p className="muted">
              Vas a jugar <strong>{chosen.name}</strong>.{' '}
              {targeting.mode && targeting.mode !== 'self' ? 'Elige objetivo:' : ''}
            </p>

            {(targeting.immediate || targeting.mode === 'self') && (
              <div className="modal-btns">
                <button className="btn btn-primary" onClick={() => playCard({})}>
                  Jugar {chosen.name}
                </button>
              </div>
            )}

            {targeting.mode === 'own-hero' && (
              <div className="modal-heroes">
                {targetSlots(myId, myTeam).map((s) => (
                  <HeroSlot key={s.hero.id} slot={s} selectable onClick={() => playCard({ ownerId: myId, heroId: s.hero.id })} />
                ))}
              </div>
            )}

            {targeting.mode === 'rival-hero' && (
              <div className="modal-heroes">
                {game.players
                  .filter((p) => p.id !== myId)
                  .flatMap((p) =>
                    targetSlots(p.id, game.teams[p.id] || []).map((s) => (
                      <HeroSlot key={s.hero.id} slot={s} selectable onClick={() => playCard({ ownerId: p.id, heroId: s.hero.id })} />
                    ))
                  )}
              </div>
            )}

            {targeting.mode === 'player' && (
              <div className="modal-btns">
                {[...targeting.players].map((pid) => (
                  <button key={pid} className="btn btn-secondary" onClick={() => playCard({ ownerId: pid })}>
                    {game.players.find((p) => p.id === pid)?.nickname}
                  </button>
                ))}
              </div>
            )}

            <div className="modal-btns">
              <button className="btn btn-ghost btn-sm" onClick={() => setChosen(null)}>
                ← Otra carta
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Fin de partida ---
function EndOverlay({ game, room, myId, nick, onLeave, onRestart }) {
  // Al ganar, el fondo gana presencia (más opaco) para celebrarlo.
  useEffect(() => {
    document.body.classList.add('celebrate');
    return () => document.body.classList.remove('celebrate');
  }, []);

  const isHost = room.players.find((p) => p.id === myId)?.isHost;
  const iWon = game.winner === myId;
  return (
    <div className="end-overlay">
      <div className="end-content">
        <p className="end-sub">{iWon ? '¡Victoria!' : 'Fin de la partida'}</p>
        <h2 className={`end-title ${iWon ? 'win' : ''}`}>
          {iWon ? '¡Has ganado!' : `Gana ${nick(game.winner)}`}
        </h2>
        <div className="modal-btns">
          {isHost ? (
            <button className="btn btn-primary" onClick={onRestart}>
              Jugar otra
            </button>
          ) : (
            <p className="muted">Esperando a que el anfitrión empiece otra…</p>
          )}
          <button className="btn btn-ghost" onClick={onLeave}>
            Volver al lobby
          </button>
        </div>
      </div>
    </div>
  );
}
