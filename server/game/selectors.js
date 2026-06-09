import { CARD_COLOR, CARD_TYPE } from '../../shared/constants.js';

// Selectores puros sobre el estado de juego. Sin efectos secundarios.
// Un "slot" representa un héroe en la mesa con las cartas apiladas encima:
//   { hero, powers: Card[], villains: Card[], ally: Card|null }

export const HERO_STATE = {
  FREE: 'libre',
  PROTECTED: 'protegido',
  SHIELDED: 'blindado',
  BLOCKED: 'bloqueado',
};

/** Número de héroes preparados necesarios para ganar. */
export const HEROES_TO_WIN = 4;

/** Crea un slot de héroe nuevo (libre). */
export function newSlot(hero) {
  return { hero, powers: [], villains: [], ally: null };
}

/** Calcula el estado de un héroe a partir de las cartas que tiene encima. */
export function heroState(slot) {
  if (slot.hero.intangible) return HERO_STATE.FREE; // Visión nunca tiene cartas encima
  if (slot.ally) return HERO_STATE.SHIELDED;
  if (slot.villains.length >= 1) return HERO_STATE.BLOCKED;
  if (slot.powers.length >= 2) return HERO_STATE.SHIELDED;
  if (slot.powers.length === 1) return HERO_STATE.PROTECTED;
  return HERO_STATE.FREE;
}

/** ¿El héroe está "preparado"? (libre, protegido o blindado; es decir, no bloqueado). */
export function isPrepared(slot) {
  return heroState(slot) !== HERO_STATE.BLOCKED;
}

/** Cuenta los héroes preparados de un equipo. */
export function countPrepared(team) {
  return team.filter(isPrepared).length;
}

/** ¿El equipo ya cumple la condición de victoria? */
export function hasWon(team) {
  return countPrepared(team) >= HEROES_TO_WIN;
}

const isMulticolor = (card) => card.color === CARD_COLOR.MULTICOLOR;

/**
 * ¿Un poder puede colocarse/combatir sobre este héroe (por color)?
 * Un poder vale si su color coincide con el del héroe, o si el héroe es multicolor.
 */
export function powerMatchesHero(power, slot) {
  if (slot.hero.intangible) return false;
  if (isMulticolor(slot.hero)) return true;
  return power.color === slot.hero.color;
}

/**
 * ¿Un villano puede colocarse sobre este héroe (por color)?
 * Vale si el villano es multicolor, el héroe es multicolor, o coinciden colores.
 */
export function villainMatchesHero(villain, slot) {
  if (slot.hero.intangible) return false;
  if (isMulticolor(villain)) return true;
  if (isMulticolor(slot.hero)) return true;
  return villain.color === slot.hero.color;
}

/** ¿Un aliado puede colocarse sobre este héroe? (uno de sus dos colores, o héroe multicolor). */
export function allyMatchesHero(ally, slot) {
  if (slot.hero.intangible) return false;
  if (isMulticolor(slot.hero)) return true;
  return (ally.colors || []).includes(slot.hero.color);
}

/** ¿El jugador ya tiene un héroe de ese color? (no se permiten dos del mismo color). */
export function hasHeroColor(team, color) {
  return team.some((slot) => slot.hero.color === color);
}

/** Busca un slot por id de héroe dentro de un equipo. */
export function findSlot(team, heroId) {
  return team.find((slot) => slot.hero.id === heroId) || null;
}

/** Vista pública de un slot (idéntica por ahora; punto único para añadir/ocultar datos). */
export function serializeSlot(slot) {
  return {
    hero: slot.hero,
    powers: slot.powers,
    villains: slot.villains,
    ally: slot.ally,
    state: heroState(slot),
  };
}

/** ¿Esta carta es una acción de un efecto concreto? */
export function isAction(card, effect) {
  return card.type === CARD_TYPE.ACTION && card.effect === effect;
}
