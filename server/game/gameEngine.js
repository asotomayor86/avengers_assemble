import { CARD_TYPE } from '../../shared/constants.js';
import { buildDeck, shuffle, seededRng } from './deck.js';
import {
  HERO_STATE,
  newSlot,
  heroState,
  isPrepared,
  hasWon,
  countPrepared,
  powerMatchesHero,
  villainMatchesHero,
  allyMatchesHero,
  hasHeroColor,
  findSlot,
  serializeSlot,
  isAction,
} from './selectors.js';

const HAND_SIZE = 3;
const INITIAL_DEAL = 3;
const TURN_LIMIT_MS = 20_000;

/** Error de validación de jugada (mensaje legible para el cliente). */
export class GameError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GameError';
  }
}

// ---------------------------------------------------------------------------
// Creación de partida
// ---------------------------------------------------------------------------

/**
 * Crea el estado inicial de una partida.
 * @param {{id:string, nickname:string}[]} players
 * @param {{seed?:number, deck?:object[]}} [opts]
 */
export function createGame(players, opts = {}) {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const rng = seededRng(seed);
  // Jugador inicial aleatorio: el orden completo se baraja con el mismo RNG
  // sembrado que el mazo, así sigue siendo reproducible si se replica el seed.
  const playerOrder = shuffle(players.map((p) => p.id), rng);
  const deck = opts.deck ? [...opts.deck] : shuffle(buildDeck(), rng);

  const state = {
    playerOrder,
    players: Object.fromEntries(players.map((p) => [p.id, { id: p.id, nickname: p.nickname }])),
    hands: Object.fromEntries(players.map((p) => [p.id, []])),
    teams: Object.fromEntries(players.map((p) => [p.id, []])),
    deck,
    discard: [],
    turnIndex: 0,
    currentPlayer: playerOrder[0],
    status: 'playing',
    winner: null,
    noDraw: Object.fromEntries(players.map((p) => [p.id, 0])),
    pending: null,
    log: [],
    logSeq: 0,
    rngSeed: seed,
    reshuffleCount: 0,
    // Cuenta atrás del turno actual (cliente la usa para mostrar el reloj y para
    // auto-descartar si se agota). Se renueva en cada cambio de turno.
    turnDeadline: Date.now() + TURN_LIMIT_MS,
  };

  // Reparto inicial: 3 cartas a cada jugador.
  for (let i = 0; i < INITIAL_DEAL; i++) {
    for (const id of state.playerOrder) state.hands[id].push(state.deck.shift());
  }
  return state;
}

// ---------------------------------------------------------------------------
// Punto de entrada del motor
// ---------------------------------------------------------------------------

/**
 * Aplica una acción al estado y devuelve { state, events }.
 * Función pura: no muta el estado recibido (trabaja sobre una copia).
 * Lanza GameError si la acción no es válida.
 */
export function applyAction(prevState, action, playerId) {
  const state = structuredClone(prevState);
  const events = [];

  if (state.status === 'finished') throw new GameError('La partida ya ha terminado.');

  if (state.pending) return handlePending(state, action, playerId, events);

  switch (action.type) {
    case 'play':
      return handlePlay(state, action, playerId, events);
    case 'discard':
      return handleDiscard(state, action, playerId, events);
    default:
      throw new GameError('Acción no reconocida.');
  }
}

// ---------------------------------------------------------------------------
// Helpers de mano / mazo / turno
// ---------------------------------------------------------------------------

function log(state, events, text) {
  const entry = { seq: ++state.logSeq, text };
  state.log.push(entry);
  events.push({ type: 'log', ...entry });
}

// Contador monótono para `lastAction` (lo usa el cliente para detectar avisos nuevos
// —descarte, jugada sobre un héroe— sin repetirlos ni mostrar los anteriores al cargar).
function nextActionSeq(state) {
  state.actionSeq = (state.actionSeq || 0) + 1;
  return state.actionSeq;
}

/** Serialización mínima de una carta para enviarla en `lastAction` (animaciones). */
function fxCard(card) {
  return {
    id: card.id,
    type: card.type,
    name: card.name,
    color: card.color,
    colors: card.colors,
    effect: card.effect,
    imageUrl: card.imageUrl,
  };
}

function name(state, playerId) {
  return state.players[playerId]?.nickname || '¿?';
}

function takeFromHand(state, playerId, cardId) {
  const hand = state.hands[playerId];
  const idx = hand.findIndex((c) => c.id === cardId);
  if (idx === -1) throw new GameError('No tienes esa carta en la mano.');
  return hand.splice(idx, 1)[0];
}

function handHasCounter(state, playerId) {
  return (state.hands[playerId] || []).some((c) => isAction(c, 'counter'));
}

function discardCards(state, cards) {
  for (const c of cards) if (c) state.discard.push(c);
}

function drawTo(state, playerId, target) {
  const want = Math.max(0, target);
  while (state.hands[playerId].length < want) {
    if (state.deck.length === 0) {
      if (state.discard.length === 0) break; // no quedan cartas en ningún sitio
      state.reshuffleCount += 1;
      state.deck = shuffle(state.discard, seededRng(state.rngSeed + state.reshuffleCount));
      state.discard = [];
    }
    state.hands[playerId].push(state.deck.shift());
  }
}

function advanceTurn(state) {
  state.turnIndex = (state.turnIndex + 1) % state.playerOrder.length;
  state.currentPlayer = state.playerOrder[state.turnIndex];
  state.turnDeadline = Date.now() + TURN_LIMIT_MS;
}

/** Comprueba victoria: prioridad al jugador en turno, luego el resto. */
function checkVictory(state, actorId) {
  const order = [actorId, ...state.playerOrder.filter((id) => id !== actorId)];
  for (const id of order) if (hasWon(state.teams[id])) return id;
  return null;
}

/**
 * Cierra la acción del turno: comprueba victoria, roba hasta 3 (menos penalización)
 * y pasa el turno (salvo turno extra por carta multicolor).
 */
function finishTurn(state, actorId, extraTurn, events) {
  const winner = checkVictory(state, actorId);
  if (winner) {
    state.status = 'finished';
    state.winner = winner;
    log(state, events, `🏆 ${name(state, winner)} gana la partida con ${countPrepared(state.teams[winner])} héroes preparados.`);
    events.push({ type: 'victory', playerId: winner });
    return { state, events };
  }

  const target = HAND_SIZE - (state.noDraw[actorId] || 0);
  state.noDraw[actorId] = 0;
  drawTo(state, actorId, target);

  if (extraTurn) {
    log(state, events, `↻ ${name(state, actorId)} juega un turno extra (carta multicolor).`);
    state.turnDeadline = Date.now() + TURN_LIMIT_MS;
  } else {
    advanceTurn(state);
  }
  return { state, events };
}

// ---------------------------------------------------------------------------
// Descartar
// ---------------------------------------------------------------------------

function handleDiscard(state, action, playerId, events) {
  if (playerId !== state.currentPlayer) throw new GameError('No es tu turno.');
  const ids = action.cardIds || [];
  if (ids.length === 0) throw new GameError('Selecciona al menos una carta para descartar.');

  const removed = [];
  for (const id of ids) removed.push(takeFromHand(state, playerId, id));
  discardCards(state, removed);
  log(state, events, `${name(state, playerId)} descarta ${removed.length} carta(s).`);
  // Marca el resultado de la acción: lo usa el cliente para avisar al resto del
  // descarte antes de mostrar el cambio de turno.
  state.lastAction = { kind: 'discard', actorId: playerId, count: removed.length, n: nextActionSeq(state) };
  return finishTurn(state, playerId, false, events);
}

// ---------------------------------------------------------------------------
// Jugar carta
// ---------------------------------------------------------------------------

/** Jugador objetivo al que afecta directamente la carta (para la ventana de Contrarrestar). */
function counterTargetOf(card, target) {
  if (card.type === CARD_TYPE.VILLAIN) return target?.ownerId;
  if (isAction(card, 'recruit')) return target?.ownerId;
  if (isAction(card, 'swap')) return target?.ownerId;
  // Espiar y Chasquido se interceptan antes (ventana propia), no abren la ventana genérica.
  return null;
}

function handlePlay(state, action, playerId, events) {
  if (playerId !== state.currentPlayer) throw new GameError('No es tu turno.');
  const target = action.target || {};

  // Localiza y valida ANTES de retirar de la mano (si lanza, la copia se descarta).
  const hand = state.hands[playerId];
  const card = hand.find((c) => c.id === action.cardId);
  if (!card) throw new GameError('No tienes esa carta en la mano.');

  // El Chasquido y el Espionaje abren ventanas propias (varios pasos / información oculta).
  if (isAction(card, 'snap')) {
    takeFromHand(state, playerId, card.id);
    return startSnap(state, playerId, card, target, events);
  }
  if (isAction(card, 'spy')) {
    if (!target.victimId || target.victimId === playerId) {
      throw new GameError('Debes espiar a otra persona.');
    }
    takeFromHand(state, playerId, card.id);
    return startSpy(state, playerId, card, target, events);
  }

  validatePlay(state, playerId, card, target);

  // Retira la carta de la mano (queda "jugada", comprometida).
  takeFromHand(state, playerId, card.id);

  // ¿Abrir ventana de Contrarrestar? Solo si el objetivo es un rival que tiene un Doctor Strange.
  const victim = counterTargetOf(card, target);
  if (victim && victim !== playerId && handHasCounter(state, victim)) {
    state.pending = {
      kind: 'counter',
      play: { actorId: playerId, card, target },
      responderId: victim,
    };
    log(state, events, `${name(state, playerId)} juega ${card.name} contra ${name(state, victim)}… (puede contrarrestar)`);
    events.push({ type: 'counter-window', responderId: victim });
    return { state, events };
  }

  const { extraTurn } = resolvePlay(state, playerId, card, target, events);
  return finishTurn(state, playerId, extraTurn, events);
}

// ---------------------------------------------------------------------------
// Validación de jugadas
// ---------------------------------------------------------------------------

function validatePlay(state, playerId, card, target) {
  switch (card.type) {
    case CARD_TYPE.HERO:
      return validateHero(state, playerId, card);
    case CARD_TYPE.POWER:
      return validatePower(state, playerId, card, target);
    case CARD_TYPE.VILLAIN:
      return validateVillain(state, playerId, card, target);
    case CARD_TYPE.ALLY:
      return validateAlly(state, playerId, card, target);
    case CARD_TYPE.ACTION:
      return validateActionCard(state, playerId, card, target);
    default:
      throw new GameError('Tipo de carta desconocido.');
  }
}

function validateHero(state, playerId, card) {
  if (hasHeroColor(state.teams[playerId], card.color)) {
    throw new GameError('Ya tienes un héroe de ese color.');
  }
}

function ownSlotOrThrow(state, ownerId, heroId) {
  const slot = findSlot(state.teams[ownerId] || [], heroId);
  if (!slot) throw new GameError('Ese héroe no está en la mesa.');
  return slot;
}

function validatePower(state, playerId, card, target) {
  if (target.ownerId !== playerId) throw new GameError('Solo puedes poner poderes en tus héroes.');
  const slot = ownSlotOrThrow(state, playerId, target.heroId);
  if (!powerMatchesHero(card, slot)) throw new GameError('Ese poder no es del color del héroe.');
  const st = heroState(slot);
  if (st === HERO_STATE.SHIELDED) throw new GameError('Ese héroe ya está blindado.');
  // Héroe multicolor: para blindar hacen falta dos poderes de colores distintos.
  if (st === HERO_STATE.PROTECTED && slot.hero.color === 'multicolor') {
    if (slot.powers[0].color === card.color) {
      throw new GameError('El héroe multicolor necesita dos poderes de colores distintos.');
    }
  }
}

function validateVillain(state, playerId, card, target) {
  if (!target.ownerId || target.ownerId === playerId) {
    throw new GameError('Los villanos se juegan sobre héroes rivales.');
  }
  const slot = ownSlotOrThrow(state, target.ownerId, target.heroId);
  if (slot.hero.intangible) throw new GameError('Visión es intangible: no se le puede bloquear.');
  if (!villainMatchesHero(card, slot)) throw new GameError('Ese villano no puede atacar a ese héroe.');
  const st = heroState(slot);
  if (st === HERO_STATE.SHIELDED) throw new GameError('No se puede atacar a un héroe blindado.');
  // Multicolor bloqueado: el segundo villano debe ser de color distinto.
  if (st === HERO_STATE.BLOCKED && slot.hero.color === 'multicolor') {
    if (slot.villains[0].color === card.color) {
      throw new GameError('El héroe multicolor necesita dos villanos de colores distintos para capturarlo.');
    }
  }
}

function validateAlly(state, playerId, card, target) {
  if (target.ownerId !== playerId) throw new GameError('Solo puedes poner aliados en tus héroes.');
  const slot = ownSlotOrThrow(state, playerId, target.heroId);
  if (slot.hero.intangible) throw new GameError('A Visión no se le pueden añadir aliados.');
  if (!allyMatchesHero(card, slot)) throw new GameError('Ese aliado no es de un color del héroe.');
  if (heroState(slot) === HERO_STATE.SHIELDED) throw new GameError('Ese héroe ya está blindado.');
}

// La validación de cada acción se delega a su módulo (recruit/swap/snap/spy/counter).
function validateActionCard(state, playerId, card, target) {
  validateAction(state, playerId, card, target);
}

// ---------------------------------------------------------------------------
// Resolución de jugadas (muta el estado)
// ---------------------------------------------------------------------------

function resolvePlay(state, playerId, card, target, events) {
  // Si la carta se juega SOBRE un héroe (villano/poder/aliado/acción dirigida),
  // marcamos la jugada para que el cliente anime la carta actuando sobre ese héroe.
  if (target && target.heroId) {
    state.lastAction = {
      kind: 'play',
      actorId: playerId,
      card: fxCard(card),
      target: { ownerId: target.ownerId, heroId: target.heroId },
      n: nextActionSeq(state),
    };
  }
  switch (card.type) {
    case CARD_TYPE.HERO:
      return resolveHero(state, playerId, card, events);
    case CARD_TYPE.POWER:
      return resolvePower(state, playerId, card, target, events);
    case CARD_TYPE.VILLAIN:
      return resolveVillain(state, playerId, card, target, events);
    case CARD_TYPE.ALLY:
      return resolveAlly(state, playerId, card, target, events);
    case CARD_TYPE.ACTION:
      return resolveAction(state, playerId, card, target, events);
    default:
      throw new GameError('Tipo de carta desconocido.');
  }
}

function resolveHero(state, playerId, card, events) {
  state.teams[playerId].push(newSlot(card));
  // Efecto al aparecer el héroe por primera vez (sobre su propio slot recién creado).
  state.lastAction = {
    kind: 'play',
    actorId: playerId,
    card: fxCard(card),
    target: { ownerId: playerId, heroId: card.id },
    n: nextActionSeq(state),
  };
  const extraTurn = card.color === 'multicolor';
  log(state, events, `${name(state, playerId)} pone a ${card.name} en su equipo.`);
  return { extraTurn };
}

function resolvePower(state, playerId, card, target, events) {
  const slot = findSlot(state.teams[playerId], target.heroId);
  const st = heroState(slot);
  if (st === HERO_STATE.BLOCKED) {
    // El poder combate al villano: ambos al descarte, el héroe queda libre.
    discardCards(state, [...slot.villains, card]);
    slot.villains = [];
    log(state, events, `${card.name} derrota al villano sobre ${slot.hero.name}: queda libre.`);
  } else {
    slot.powers.push(card);
    const after = heroState(slot);
    log(state, events, `${slot.hero.name} queda ${after}.`);
  }
  return { extraTurn: false };
}

function resolveVillain(state, playerId, card, target, events) {
  const team = state.teams[target.ownerId];
  const slot = findSlot(team, target.heroId);
  const st = heroState(slot);
  const extraTurn = card.color === 'multicolor';

  if (st === HERO_STATE.FREE) {
    slot.villains.push(card);
    log(state, events, `${name(state, playerId)} bloquea a ${slot.hero.name} de ${name(state, target.ownerId)}.`);
  } else if (st === HERO_STATE.PROTECTED) {
    discardCards(state, [...slot.powers, card]);
    slot.powers = [];
    log(state, events, `${card.name} destruye el poder de ${slot.hero.name}: queda libre.`);
  } else if (st === HERO_STATE.BLOCKED) {
    // Captura: el héroe y los dos villanos al descarte.
    discardCards(state, [slot.hero, ...slot.villains, card]);
    const idx = team.indexOf(slot);
    team.splice(idx, 1);
    log(state, events, `💥 ${name(state, playerId)} captura y destruye a ${slot.hero.name}.`);
  }
  return { extraTurn };
}

function resolveAlly(state, playerId, card, target, events) {
  const slot = findSlot(state.teams[playerId], target.heroId);
  if (slot.villains.length) {
    discardCards(state, slot.villains);
    slot.villains = [];
  }
  slot.ally = card;
  log(state, events, `${card.name} blinda a ${slot.hero.name}.`);
  return { extraTurn: false };
}

// ---------------------------------------------------------------------------
// Ventana de Contrarrestar / re-objetivo
// ---------------------------------------------------------------------------

function handlePending(state, action, playerId, events) {
  if (state.pending.kind === 'counter') return handleCounterResponse(state, action, playerId, events);
  if (state.pending.kind === 'retarget') return handleRetarget(state, action, playerId, events);
  if (state.pending.kind === 'snap') return handleSnapSelect(state, action, playerId, events);
  if (state.pending.kind === 'spy') return handleSpyChoice(state, action, playerId, events);
  throw new GameError('Estado de espera desconocido.');
}

function handleCounterResponse(state, action, playerId, events) {
  const { play, responderId } = state.pending;
  if (action.type !== 'respond') throw new GameError('Hay una carta pendiente de respuesta.');
  if (playerId !== responderId) throw new GameError('No te toca responder.');

  if (action.decision === 'pass') {
    state.pending = null;
    const { extraTurn } = resolvePlay(state, play.actorId, play.card, play.target, events);
    return finishTurn(state, play.actorId, extraTurn, events);
  }

  if (action.decision === 'counter') {
    const counter = (state.hands[responderId] || []).find((c) => isAction(c, 'counter'));
    if (!counter) throw new GameError('No tienes una carta de Contrarrestar.');
    takeFromHand(state, responderId, counter.id);
    discardCards(state, [counter]);
    state.noDraw[responderId] = (state.noDraw[responderId] || 0) + 1; // tras Contrarrestar no roba
    log(state, events, `🛡️ ${name(state, responderId)} contrarresta ${play.card.name}.`);
    // Doctor Strange se ve sobre la zona (lado derecho) del atacante contrarrestado.
    state.lastAction = {
      kind: 'play',
      actorId: responderId,
      card: fxCard(counter),
      target: { ownerId: play.actorId },
      n: nextActionSeq(state),
    };

    // El rival busca un nuevo objetivo válido (sin contar al que contrarrestó).
    const validTargets = computeValidTargets(state, play.actorId, play.card, responderId);
    if (validTargets.length === 0) {
      discardCards(state, [play.card]);
      state.pending = null;
      log(state, events, `${play.card.name} no encuentra otro objetivo y se descarta.`);
      return finishTurn(state, play.actorId, false, events);
    }
    state.pending = {
      kind: 'retarget',
      play: { actorId: play.actorId, card: play.card },
      validTargets,
    };
    events.push({ type: 'retarget', actorId: play.actorId, validTargets });
    return { state, events };
  }

  throw new GameError('Respuesta no válida.');
}

function handleRetarget(state, action, playerId, events) {
  const { play, validTargets } = state.pending;
  if (playerId !== play.actorId) throw new GameError('No te toca elegir objetivo.');
  if (action.type !== 'retarget') throw new GameError('Debes elegir un nuevo objetivo (o saltar).');

  if (action.skip) {
    discardCards(state, [play.card]);
    state.pending = null;
    log(state, events, `${name(state, play.actorId)} descarta ${play.card.name} sin nuevo objetivo.`);
    return finishTurn(state, play.actorId, false, events);
  }

  const chosen = action.target || {};
  const ok = validTargets.some((t) => sameTarget(t, chosen));
  if (!ok) throw new GameError('Ese objetivo no es válido.');

  state.pending = null;
  // El re-objetivo no abre otra ventana de Contrarrestar.
  const { extraTurn } = resolvePlay(state, play.actorId, play.card, chosen, events);
  return finishTurn(state, play.actorId, extraTurn, events);
}

function sameTarget(a, b) {
  return a.ownerId === b.ownerId && a.heroId === b.heroId && a.victimId === b.victimId;
}

/** Lista de objetivos válidos para una carta (usado al re-objetivar tras Contrarrestar). */
function computeValidTargets(state, actorId, card, excludeId) {
  const targets = [];
  const others = state.playerOrder.filter((id) => id !== actorId && id !== excludeId);

  if (card.type === CARD_TYPE.VILLAIN) {
    for (const pid of others) {
      for (const slot of state.teams[pid]) {
        const t = { ownerId: pid, heroId: slot.hero.id };
        try {
          validateVillain(state, actorId, card, t);
          targets.push(t);
        } catch { /* objetivo no válido */ }
      }
    }
  } else if (isAction(card, 'recruit')) {
    for (const pid of others) {
      for (const slot of state.teams[pid]) {
        const t = { ownerId: pid, heroId: slot.hero.id };
        try {
          validateRecruit(state, actorId, t);
          targets.push(t);
        } catch { /* no válido */ }
      }
    }
  } else if (isAction(card, 'swap')) {
    for (const pid of others) targets.push({ ownerId: pid });
  }
  // spy: el re-objetivo encadenado no se soporta en esta fase (TODO).
  return targets;
}

// ---------------------------------------------------------------------------
// Acciones (recruit / swap / snap / spy / counter)
// ---------------------------------------------------------------------------

function validateAction(state, playerId, card, target) {
  switch (card.effect) {
    case 'recruit':
      return validateRecruit(state, playerId, target);
    case 'swap':
      return validateSwap(state, playerId, target);
    case 'counter':
      throw new GameError('Contrarrestar solo se juega en respuesta a una carta jugada contra ti.');
    // 'snap' y 'spy' se interceptan en handlePlay (ventana propia), no llegan aquí.
    default:
      throw new GameError('Acción desconocida.');
  }
}

function resolveAction(state, playerId, card, target, events) {
  let result = { extraTurn: false };
  switch (card.effect) {
    case 'recruit':
      resolveRecruit(state, playerId, target, events);
      break;
    case 'swap':
      resolveSwap(state, playerId, target, events);
      // Wanda no actúa sobre un héroe concreto: el efecto se muestra sobre la zona
      // (lado derecho) de la persona con la que se intercambia el equipo.
      state.lastAction = {
        kind: 'play',
        actorId: playerId,
        card: fxCard(card),
        target: { ownerId: target.ownerId },
        n: nextActionSeq(state),
      };
      break;
    default:
      throw new GameError('Acción desconocida.');
  }
  discardCards(state, [card]);
  return result;
}

// --- Reclutar (Nick Furia) ---
function validateRecruit(state, playerId, target) {
  if (!target.ownerId || target.ownerId === playerId) {
    throw new GameError('Debes reclutar un héroe de otra persona.');
  }
  const slot = ownSlotOrThrow(state, target.ownerId, target.heroId);
  if (heroState(slot) === HERO_STATE.SHIELDED) {
    throw new GameError('No puedes reclutar un héroe blindado.');
  }
  if (hasHeroColor(state.teams[playerId], slot.hero.color)) {
    throw new GameError('Ya tienes un héroe de ese color.');
  }
}

function resolveRecruit(state, playerId, target, events) {
  const victimTeam = state.teams[target.ownerId];
  const slot = findSlot(victimTeam, target.heroId);
  victimTeam.splice(victimTeam.indexOf(slot), 1);
  state.teams[playerId].push(slot);
  log(state, events, `${name(state, playerId)} recluta a ${slot.hero.name} de ${name(state, target.ownerId)}.`);
}

// --- Alterar la realidad (Wanda) ---
function validateSwap(state, playerId, target) {
  if (!target.ownerId || target.ownerId === playerId) {
    throw new GameError('Debes intercambiar tu equipo con el de otra persona.');
  }
  if (!state.teams[target.ownerId]) throw new GameError('Ese jugador no existe.');
}

function resolveSwap(state, playerId, target, events) {
  const mine = state.teams[playerId];
  state.teams[playerId] = state.teams[target.ownerId];
  state.teams[target.ownerId] = mine;
  log(state, events, `🔄 ${name(state, playerId)} intercambia su equipo con ${name(state, target.ownerId)}.`);
}

// --- Chasquido (Guantelete de Thanos) ---
// Cada persona elimina la mitad (redondeando abajo) de sus héroes, a su elección.
// Dos vías: (a) selecciones completas en el payload → se resuelve al instante;
// (b) sin selecciones → se abre una ventana donde cada jugador afectado elige.

function snapQuotas(state) {
  const toRemove = {};
  for (const pid of state.playerOrder) {
    const n = Math.floor(state.teams[pid].length / 2);
    if (n > 0) toRemove[pid] = n;
  }
  return toRemove;
}

function startSnap(state, actorId, card, target, events) {
  // Efecto "bomba" del Guantelete: a pantalla completa, antes de la selección.
  state.lastAction = { kind: 'snap', actorId, card: fxCard(card), n: nextActionSeq(state) };
  const toRemove = snapQuotas(state);

  // Nadie pierde héroes: el Chasquido no hace nada.
  if (Object.keys(toRemove).length === 0) {
    discardCards(state, [card]);
    log(state, events, `🫰 ${name(state, actorId)} chasquea, pero nadie tiene héroes que perder.`);
    return finishTurn(state, actorId, false, events);
  }

  // Vía (a): el actor aportó selecciones explícitas → validar y resolver ya.
  if (target.selections && Object.keys(target.selections).length > 0) {
    validateSnapSelections(state, toRemove, target.selections);
    applySnap(state, target.selections);
    discardCards(state, [card]);
    log(state, events, `🫰 ${name(state, actorId)} chasquea: cada equipo pierde la mitad de sus héroes.`);
    return finishTurn(state, actorId, false, events);
  }

  // Vía (b): abrir ventana de selección por jugador.
  state.pending = { kind: 'snap', actorId, card, toRemove, selections: {} };
  log(state, events, `🫰 ${name(state, actorId)} chasquea: cada equipo debe descartar la mitad de sus héroes.`);
  events.push({ type: 'snap-window', toRemove });
  return { state, events };
}

function validateSnapSelections(state, toRemove, selections) {
  for (const [pid, n] of Object.entries(toRemove)) {
    const chosen = selections[pid] || [];
    if (chosen.length !== n) throw new GameError(`${name(state, pid)} debe eliminar ${n} héroe(s).`);
    for (const heroId of chosen) {
      if (!findSlot(state.teams[pid], heroId)) throw new GameError('Selección de Chasquido no válida.');
    }
  }
}

function applySnap(state, selections) {
  for (const pid of state.playerOrder) {
    for (const heroId of selections[pid] || []) {
      const team = state.teams[pid];
      const slot = findSlot(team, heroId);
      if (!slot) continue;
      discardCards(state, [slot.hero, ...slot.powers, ...slot.villains, slot.ally].filter(Boolean));
      team.splice(team.indexOf(slot), 1);
    }
  }
}

function handleSnapSelect(state, action, playerId, events) {
  const p = state.pending;
  if (action.type !== 'snap-select') throw new GameError('Debes elegir tus héroes para el Chasquido.');
  if (!p.toRemove[playerId]) throw new GameError('No tienes que descartar héroes en este Chasquido.');
  if (p.selections[playerId]) throw new GameError('Ya has elegido tus héroes.');

  const heroIds = action.heroIds || [];
  if (heroIds.length !== p.toRemove[playerId]) {
    throw new GameError(`Debes elegir exactamente ${p.toRemove[playerId]} héroe(s).`);
  }
  for (const heroId of heroIds) {
    if (!findSlot(state.teams[playerId], heroId)) throw new GameError('Selección no válida.');
  }
  p.selections[playerId] = heroIds;
  log(state, events, `${name(state, playerId)} elige sus héroes para el Chasquido.`);

  const allReady = Object.keys(p.toRemove).every((pid) => p.selections[pid]);
  if (!allReady) return { state, events };

  const { actorId, card, selections } = p;
  state.pending = null;
  applySnap(state, selections);
  discardCards(state, [card]);
  log(state, events, '🫰 El Chasquido se completa: cada equipo pierde la mitad de sus héroes.');
  return finishTurn(state, actorId, false, events);
}

// --- Espiar (Viuda Negra) ---
// Abre una ventana de "revelado": solo el espía ve la mano de la víctima y elige
// una carta para jugarla como si fuera suya. La víctima no roba ese turno.
// TODO: Contrarrestar sobre Espiar no está soportado (Espiar usa su propia ventana).

function startSpy(state, actorId, card, target, events) {
  if (!target.victimId || target.victimId === actorId) {
    throw new GameError('Debes espiar a otra persona.');
  }
  if (!state.hands[target.victimId]) throw new GameError('Ese jugador no existe.');
  state.pending = { kind: 'spy', actorId, victimId: target.victimId, card };
  // Viuda Negra no actúa sobre un héroe: el efecto se muestra sobre la zona (lado
  // derecho) de la persona espiada.
  state.lastAction = {
    kind: 'play',
    actorId,
    card: fxCard(card),
    target: { ownerId: target.victimId },
    n: nextActionSeq(state),
  };
  log(state, events, `🕵️ ${name(state, actorId)} espía la mano de ${name(state, target.victimId)}.`);
  events.push({ type: 'spy-window', actorId, victimId: target.victimId });
  return { state, events };
}

function handleSpyChoice(state, action, playerId, events) {
  const p = state.pending;
  if (playerId !== p.actorId) throw new GameError('No te toca elegir en el espionaje.');

  // La víctima ya ha perdido la carta espiada en el momento del espionaje
  // (Viuda Negra). Antes se aplicaba una penalización adicional al final de
  // su próximo turno (robar 1 menos); ahora la quitamos: al terminar su
  // jugada la víctima recupera las 3 cartas normales.
  const finishSpy = (extraTurn) => {
    discardCards(state, [p.card]);
    state.pending = null;
    return finishTurn(state, p.actorId, extraTurn, events);
  };

  if (action.type === 'spy-skip') {
    log(state, events, `${name(state, p.actorId)} no juega ninguna carta espiada.`);
    return finishSpy(false);
  }

  if (action.type !== 'spy-play') throw new GameError('Debes elegir una carta espiada (o pasar).');

  const card = (state.hands[p.victimId] || []).find((c) => c.id === action.cardId);
  if (!card) throw new GameError('Esa carta no está en la mano espiada.');
  if (card.type === CARD_TYPE.ACTION && (card.effect === 'spy' || card.effect === 'counter')) {
    throw new GameError('No se puede encadenar Espiar/Contrarrestar mediante Espiar.');
  }
  // El espía la juega como si fuera suya.
  validatePlay(state, p.actorId, card, action.play || {});
  takeFromHand(state, p.victimId, card.id);
  const { extraTurn } = resolvePlay(state, p.actorId, card, action.play || {}, events);
  log(state, events, `${name(state, p.actorId)} juega ${card.name} (robada con Espiar).`);
  return finishSpy(extraTurn);
}

// ---------------------------------------------------------------------------
// Serialización para el cliente (oculta las manos ajenas)
// ---------------------------------------------------------------------------

/** Serializa el estado de espera (ventana) con los datos que necesita cada cliente. */
function serializePending(pending, viewerId, state) {
  if (!pending) return null;
  if (pending.kind === 'counter') {
    return {
      kind: 'counter',
      actorId: pending.play.actorId,
      responderId: pending.responderId,
      cardName: pending.play.card.name,
      canRespond: pending.responderId === viewerId,
    };
  }
  if (pending.kind === 'retarget') {
    return {
      kind: 'retarget',
      actorId: pending.play.actorId,
      cardName: pending.play.card.name,
      isActor: pending.play.actorId === viewerId,
      validTargets: pending.validTargets,
    };
  }
  if (pending.kind === 'snap') {
    return {
      kind: 'snap',
      actorId: pending.actorId,
      toRemove: pending.toRemove,
      submitted: Object.keys(pending.selections),
      mustSelect: pending.toRemove[viewerId] || 0,
      needsMe: Boolean(pending.toRemove[viewerId]) && !pending.selections[viewerId],
    };
  }
  if (pending.kind === 'spy') {
    const isActor = pending.actorId === viewerId;
    return {
      kind: 'spy',
      actorId: pending.actorId,
      victimId: pending.victimId,
      isActor,
      // Solo el espía ve la mano de la víctima.
      victimHand: isActor ? state.hands[pending.victimId] : undefined,
    };
  }
  return { kind: pending.kind };
}

/** Vista del estado para un jugador concreto (o vista pública si viewerId es null). */
export function serializeState(state, viewerId = null) {
  return {
    players: state.playerOrder.map((id) => ({
      id,
      nickname: state.players[id].nickname,
      handCount: state.hands[id].length,
      preparedCount: countPrepared(state.teams[id]),
    })),
    currentPlayer: state.currentPlayer,
    status: state.status,
    winner: state.winner,
    teams: Object.fromEntries(
      state.playerOrder.map((id) => [id, state.teams[id].map(serializeSlot)])
    ),
    hand: viewerId ? state.hands[viewerId] : [],
    deckCount: state.deck.length,
    discardCount: state.discard.length,
    topDiscard: state.discard[state.discard.length - 1] || null,
    pending: serializePending(state.pending, viewerId, state),
    log: state.log.slice(-30),
    lastAction: state.lastAction || null,
    // Reloj del turno: el cliente compara `turnDeadline - serverNow` con su
    // propio reloj para corregir el desfase.
    turnDeadline: state.turnDeadline || null,
    serverNow: Date.now(),
  };
}
