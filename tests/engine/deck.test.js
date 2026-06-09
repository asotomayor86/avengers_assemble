import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck } from '../../server/game/deck.js';
import { createGame } from '../../server/game/gameEngine.js';

test('la baraja tiene exactamente 82 cartas', () => {
  assert.equal(buildDeck().length, 82);
});

test('composición por tipo correcta', () => {
  const deck = buildDeck();
  const count = (t) => deck.filter((c) => c.type === t).length;
  assert.equal(count('hero'), 22);
  assert.equal(count('power'), 20);
  assert.equal(count('villain'), 20);
  assert.equal(count('ally'), 6);
  assert.equal(count('action'), 14);
});

test('todas las cartas tienen id único y campo imageUrl previsto', () => {
  const deck = buildDeck();
  const ids = new Set(deck.map((c) => c.id));
  assert.equal(ids.size, 82);
  assert.ok(deck.every((c) => 'imageUrl' in c));
});

test('createGame reparte 3 cartas a cada jugador', () => {
  const players = [
    { id: 'A', nickname: 'Ana' },
    { id: 'B', nickname: 'Beto' },
    { id: 'C', nickname: 'Cira' },
  ];
  const state = createGame(players, { seed: 42 });
  for (const p of players) assert.equal(state.hands[p.id].length, 3);
  assert.equal(state.deck.length, 82 - 3 * 3);
  assert.equal(state.currentPlayer, 'A');
});
