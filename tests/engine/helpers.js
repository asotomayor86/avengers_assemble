// Utilidades para construir estados de juego controlados en los tests.
import { CARD_TYPE, CARD_COLOR } from '../../shared/constants.js';

let seq = 0;
const uid = (p) => `${p}_${++seq}`;

export function hero(color, opts = {}) {
  return { id: uid('hero'), type: CARD_TYPE.HERO, name: `Heroe-${color}`, color, imageUrl: null, ...opts };
}
export const vision = () =>
  ({ id: uid('vision'), type: CARD_TYPE.HERO, name: 'Visión', color: CARD_COLOR.GRAY, intangible: true, imageUrl: null });

export function power(color, opts = {}) {
  return { id: uid('power'), type: CARD_TYPE.POWER, name: `Poder-${color}`, color, imageUrl: null, ...opts };
}
export function villain(color, opts = {}) {
  return { id: uid('villain'), type: CARD_TYPE.VILLAIN, name: `Villano-${color}`, color, imageUrl: null, ...opts };
}
export function ally(colors, opts = {}) {
  return { id: uid('ally'), type: CARD_TYPE.ALLY, name: `Aliado-${colors.join('+')}`, colors, imageUrl: null, ...opts };
}
export function action(effect, opts = {}) {
  return { id: uid('action'), type: CARD_TYPE.ACTION, name: `Accion-${effect}`, effect, color: CARD_COLOR.PURPLE, imageUrl: null, ...opts };
}

/** Construye un slot de héroe con cartas encima. */
export function slot(heroCard, { powers = [], villains = [], ally: a = null } = {}) {
  return { hero: heroCard, powers, villains, ally: a };
}

/** Estado mínimo válido. `deck` se rellena con relleno suficiente para robar. */
export function makeGame(ids, { deck } = {}) {
  return {
    playerOrder: [...ids],
    players: Object.fromEntries(ids.map((id) => [id, { id, nickname: id }])),
    hands: Object.fromEntries(ids.map((id) => [id, []])),
    teams: Object.fromEntries(ids.map((id) => [id, []])),
    deck: deck || filler(20),
    discard: [],
    turnIndex: 0,
    currentPlayer: ids[0],
    status: 'playing',
    winner: null,
    noDraw: Object.fromEntries(ids.map((id) => [id, 0])),
    pending: null,
    log: [],
    logSeq: 0,
    rngSeed: 1,
    reshuffleCount: 0,
  };
}

/** Cartas de relleno neutras para el mazo (poderes morados ficticios, no se juegan). */
export function filler(n) {
  return Array.from({ length: n }, () => power('gray', { name: 'relleno' }));
}
