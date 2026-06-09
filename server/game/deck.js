import { CARD_TYPE, CARD_COLOR } from '../../shared/constants.js';

// Definición de la baraja: 82 cartas (ver tabla del enunciado).
// Cada entrada genera `copies` cartas idénticas con id único por copia.
const DEFINITIONS = [
  // --- Héroes (22) ---
  { type: CARD_TYPE.HERO, name: 'Iron Man', color: CARD_COLOR.RED, copies: 5, slug: 'ironman' },
  { type: CARD_TYPE.HERO, name: 'Thor', color: CARD_COLOR.YELLOW, copies: 5, slug: 'thor' },
  { type: CARD_TYPE.HERO, name: 'Hulk', color: CARD_COLOR.GREEN, copies: 5, slug: 'hulk' },
  { type: CARD_TYPE.HERO, name: 'Capitán América', color: CARD_COLOR.BLUE, copies: 5, slug: 'capamerica' },
  { type: CARD_TYPE.HERO, name: 'Capitana Marvel', color: CARD_COLOR.MULTICOLOR, copies: 1, slug: 'capmarvel' },
  { type: CARD_TYPE.HERO, name: 'Visión', color: CARD_COLOR.GRAY, copies: 1, slug: 'vision', intangible: true },

  // --- Poderes (20) ---
  { type: CARD_TYPE.POWER, name: 'Guante de Iron Man', color: CARD_COLOR.RED, copies: 5, slug: 'guante' },
  { type: CARD_TYPE.POWER, name: 'Mjölnir', color: CARD_COLOR.YELLOW, copies: 5, slug: 'mjolnir' },
  { type: CARD_TYPE.POWER, name: 'Puño de Hulk', color: CARD_COLOR.GREEN, copies: 5, slug: 'puno' },
  { type: CARD_TYPE.POWER, name: 'Escudo del Capitán América', color: CARD_COLOR.BLUE, copies: 5, slug: 'escudo' },

  // --- Villanos (20) ---
  { type: CARD_TYPE.VILLAIN, name: 'Ultron', color: CARD_COLOR.RED, copies: 4, slug: 'ultron' },
  { type: CARD_TYPE.VILLAIN, name: 'Loki', color: CARD_COLOR.YELLOW, copies: 4, slug: 'loki' },
  { type: CARD_TYPE.VILLAIN, name: 'Abominación', color: CARD_COLOR.GREEN, copies: 4, slug: 'abominacion' },
  { type: CARD_TYPE.VILLAIN, name: 'Barón Zemo', color: CARD_COLOR.BLUE, copies: 4, slug: 'zemo' },
  { type: CARD_TYPE.VILLAIN, name: 'Thanos', color: CARD_COLOR.MULTICOLOR, copies: 4, slug: 'thanos' },

  // --- Aliados (6, bicolor, 1 copia cada uno) ---
  { type: CARD_TYPE.ALLY, name: 'Hawkeye', colors: [CARD_COLOR.YELLOW, CARD_COLOR.GREEN], copies: 1, slug: 'hawkeye' },
  { type: CARD_TYPE.ALLY, name: 'Bucky Barnes', colors: [CARD_COLOR.GREEN, CARD_COLOR.BLUE], copies: 1, slug: 'bucky' },
  { type: CARD_TYPE.ALLY, name: 'Falcon', colors: [CARD_COLOR.BLUE, CARD_COLOR.YELLOW], copies: 1, slug: 'falcon' },
  { type: CARD_TYPE.ALLY, name: 'Black Panther', colors: [CARD_COLOR.BLUE, CARD_COLOR.RED], copies: 1, slug: 'panther' },
  { type: CARD_TYPE.ALLY, name: 'Avispa', colors: [CARD_COLOR.YELLOW, CARD_COLOR.RED], copies: 1, slug: 'avispa' },
  { type: CARD_TYPE.ALLY, name: 'Ant-Man', colors: [CARD_COLOR.RED, CARD_COLOR.GREEN], copies: 1, slug: 'antman' },

  // --- Acciones (14, moradas) ---
  { type: CARD_TYPE.ACTION, name: 'Nick Furia', effect: 'recruit', color: CARD_COLOR.PURPLE, copies: 4, slug: 'nickfuria' },
  { type: CARD_TYPE.ACTION, name: 'Doctor Strange', effect: 'counter', color: CARD_COLOR.PURPLE, copies: 4, slug: 'strange' },
  { type: CARD_TYPE.ACTION, name: 'Viuda Negra', effect: 'spy', color: CARD_COLOR.PURPLE, copies: 4, slug: 'viuda' },
  { type: CARD_TYPE.ACTION, name: 'Wanda', effect: 'swap', color: CARD_COLOR.PURPLE, copies: 1, slug: 'wanda' },
  { type: CARD_TYPE.ACTION, name: 'Guantelete de Thanos', effect: 'snap', color: CARD_COLOR.PURPLE, copies: 1, slug: 'guantelete' },
];

/** Construye la baraja completa ordenada (82 cartas). */
export function buildDeck() {
  const cards = [];
  for (const def of DEFINITIONS) {
    for (let i = 1; i <= def.copies; i++) {
      const card = {
        id: `${def.type}_${def.slug}_${i}`,
        type: def.type,
        name: def.name,
        imageUrl: null, // preparado para imágenes futuras
      };
      if (def.color) card.color = def.color;
      if (def.colors) card.colors = def.colors;
      if (def.effect) card.effect = def.effect;
      if (def.intangible) card.intangible = true;
      cards.push(card);
    }
  }
  return cards;
}

/**
 * Baraja in-place usando un generador de números aleatorios inyectable
 * (Fisher-Yates). El rng por defecto es Math.random; los tests pueden pasar uno fijo.
 */
export function shuffle(cards, rng = Math.random) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/** Generador pseudoaleatorio determinista (mulberry32) para tests reproducibles. */
export function seededRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
