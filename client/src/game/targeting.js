// Cálculo de objetivos válidos en el cliente, SOLO para resaltar en la UI.
// Reutiliza los selectores puros del motor (el servidor sigue siendo la autoridad).
import {
  HERO_STATE,
  heroState,
  powerMatchesHero,
  villainMatchesHero,
  allyMatchesHero,
  hasHeroColor,
} from '../../../server/game/selectors.js';

export const slotKey = (ownerId, heroId) => `${ownerId}:${heroId}`;

// --- Predicados de validez (espejo del motor) ---

export function powerOk(card, slot) {
  if (!powerMatchesHero(card, slot)) return false;
  const st = heroState(slot);
  if (st === HERO_STATE.SHIELDED) return false;
  if (st === HERO_STATE.PROTECTED && slot.hero.color === 'multicolor' && slot.powers[0]?.color === card.color) {
    return false;
  }
  return true;
}

export function villainOk(card, slot) {
  if (slot.hero.intangible) return false;
  if (!villainMatchesHero(card, slot)) return false;
  const st = heroState(slot);
  if (st === HERO_STATE.SHIELDED) return false;
  if (st === HERO_STATE.BLOCKED && slot.hero.color === 'multicolor' && slot.villains[0]?.color === card.color) {
    return false;
  }
  return true;
}

export function allyOk(card, slot) {
  if (!allyMatchesHero(card, slot)) return false;
  return heroState(slot) !== HERO_STATE.SHIELDED;
}

export function recruitOk(slot, myTeam) {
  if (heroState(slot) === HERO_STATE.SHIELDED) return false;
  return !hasHeroColor(myTeam, slot.hero.color);
}

export function heroPlayable(card, myTeam) {
  return !hasHeroColor(myTeam, card.color);
}

/**
 * Describe cómo se juega una carta y qué objetivos resaltar.
 * Devuelve { mode, slotKeys:Set, players:Set, immediate:boolean, modal:string|null, playable:boolean }
 *   mode: 'self' | 'own-hero' | 'rival-hero' | 'player' | null
 */
export function describeTargeting(card, game, myId) {
  const myTeam = game.teams[myId] || [];
  const others = game.players.map((p) => p.id).filter((id) => id !== myId);
  const empty = { mode: null, slotKeys: new Set(), players: new Set(), immediate: false, modal: null, playable: true };

  if (!card) return empty;

  if (card.type === 'hero') {
    return { ...empty, mode: 'self', immediate: true, playable: heroPlayable(card, myTeam) };
  }
  if (card.type === 'power') {
    const keys = new Set(myTeam.filter((s) => powerOk(card, s)).map((s) => slotKey(myId, s.hero.id)));
    return { ...empty, mode: 'own-hero', slotKeys: keys, playable: keys.size > 0 };
  }
  if (card.type === 'ally') {
    const keys = new Set(myTeam.filter((s) => allyOk(card, s)).map((s) => slotKey(myId, s.hero.id)));
    return { ...empty, mode: 'own-hero', slotKeys: keys, playable: keys.size > 0 };
  }
  if (card.type === 'villain') {
    const keys = new Set();
    for (const pid of others) for (const s of game.teams[pid]) if (villainOk(card, s)) keys.add(slotKey(pid, s.hero.id));
    return { ...empty, mode: 'rival-hero', slotKeys: keys, playable: keys.size > 0 };
  }
  if (card.type === 'action') {
    if (card.effect === 'recruit') {
      const keys = new Set();
      for (const pid of others) for (const s of game.teams[pid]) if (recruitOk(s, myTeam)) keys.add(slotKey(pid, s.hero.id));
      return { ...empty, mode: 'rival-hero', slotKeys: keys, playable: keys.size > 0 };
    }
    if (card.effect === 'swap') {
      return { ...empty, mode: 'player', players: new Set(others), playable: others.length > 0 };
    }
    if (card.effect === 'spy') {
      const valid = others.filter((id) => (game.players.find((p) => p.id === id)?.handCount || 0) > 0);
      return { ...empty, mode: 'player', players: new Set(valid), modal: 'spy', playable: valid.length > 0 };
    }
    if (card.effect === 'snap') {
      return { ...empty, mode: 'self', immediate: true, playable: true };
    }
    if (card.effect === 'counter') {
      // Contrarrestar solo se juega como respuesta, no de forma proactiva.
      return { ...empty, mode: null, playable: false };
    }
  }
  return empty;
}
