import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../../server/game/gameEngine.js';
import { heroState, HERO_STATE } from '../../server/game/selectors.js';
import { makeGame, slot, hero, power, villain, ally } from './helpers.js';

const RED = 'red';
const play = (state, playerId, cardId, target) =>
  applyAction(state, { type: 'play', cardId, target }, playerId);

// --- PODER ---

test('poder sobre héroe libre → protegido', () => {
  const g = makeGame(['A', 'B']);
  const h = hero(RED);
  const p = power(RED);
  g.teams.A = [slot(h)];
  g.hands.A = [p];
  const { state } = play(g, 'A', p.id, { ownerId: 'A', heroId: h.id });
  assert.equal(heroState(state.teams.A[0]), HERO_STATE.PROTECTED);
});

test('poder sobre héroe protegido → blindado', () => {
  const g = makeGame(['A', 'B']);
  const h = hero(RED);
  g.teams.A = [slot(h, { powers: [power(RED)] })];
  const p = power(RED);
  g.hands.A = [p];
  const { state } = play(g, 'A', p.id, { ownerId: 'A', heroId: h.id });
  assert.equal(heroState(state.teams.A[0]), HERO_STATE.SHIELDED);
});

test('poder sobre héroe blindado → error', () => {
  const g = makeGame(['A', 'B']);
  const h = hero(RED);
  g.teams.A = [slot(h, { powers: [power(RED), power(RED)] })];
  const p = power(RED);
  g.hands.A = [p];
  assert.throws(() => play(g, 'A', p.id, { ownerId: 'A', heroId: h.id }), /blindado/i);
});

test('poder sobre héroe bloqueado → combate: villano y poder al descarte, héroe libre', () => {
  const g = makeGame(['A', 'B']);
  const h = hero(RED);
  const v = villain(RED);
  g.teams.A = [slot(h, { villains: [v] })];
  const p = power(RED);
  g.hands.A = [p];
  const { state } = play(g, 'A', p.id, { ownerId: 'A', heroId: h.id });
  assert.equal(heroState(state.teams.A[0]), HERO_STATE.FREE);
  assert.ok(state.discard.find((c) => c.id === v.id));
  assert.ok(state.discard.find((c) => c.id === p.id));
});

// --- VILLANO ---

test('villano sobre héroe libre rival → bloqueado', () => {
  const g = makeGame(['A', 'B']);
  const h = hero(RED);
  g.teams.B = [slot(h)];
  const v = villain(RED);
  g.hands.A = [v];
  const { state } = play(g, 'A', v.id, { ownerId: 'B', heroId: h.id });
  assert.equal(heroState(state.teams.B[0]), HERO_STATE.BLOCKED);
});

test('villano sobre héroe protegido → villano y poder al descarte, héroe libre', () => {
  const g = makeGame(['A', 'B']);
  const h = hero(RED);
  const p = power(RED);
  g.teams.B = [slot(h, { powers: [p] })];
  const v = villain(RED);
  g.hands.A = [v];
  const { state } = play(g, 'A', v.id, { ownerId: 'B', heroId: h.id });
  assert.equal(heroState(state.teams.B[0]), HERO_STATE.FREE);
  assert.ok(state.discard.find((c) => c.id === p.id));
  assert.ok(state.discard.find((c) => c.id === v.id));
});

test('villano sobre héroe bloqueado → captura (héroe destruido, descartes correctos)', () => {
  const g = makeGame(['A', 'B']);
  const h = hero(RED);
  const v1 = villain(RED);
  g.teams.B = [slot(h, { villains: [v1] })];
  const v2 = villain(RED);
  g.hands.A = [v2];
  const { state } = play(g, 'A', v2.id, { ownerId: 'B', heroId: h.id });
  assert.equal(state.teams.B.length, 0);
  assert.ok(state.discard.find((c) => c.id === h.id));
  assert.ok(state.discard.find((c) => c.id === v1.id));
  assert.ok(state.discard.find((c) => c.id === v2.id));
});

test('villano sobre héroe blindado → error', () => {
  const g = makeGame(['A', 'B']);
  const h = hero(RED);
  g.teams.B = [slot(h, { powers: [power(RED), power(RED)] })];
  const v = villain(RED);
  g.hands.A = [v];
  assert.throws(() => play(g, 'A', v.id, { ownerId: 'B', heroId: h.id }), /blindado/i);
});

// --- ALIADO ---

test('aliado sobre héroe libre → blindado', () => {
  const g = makeGame(['A', 'B']);
  const h = hero('blue');
  g.teams.A = [slot(h)];
  const a = ally(['blue', 'red']);
  g.hands.A = [a];
  const { state } = play(g, 'A', a.id, { ownerId: 'A', heroId: h.id });
  assert.equal(heroState(state.teams.A[0]), HERO_STATE.SHIELDED);
});

test('aliado sobre héroe bloqueado → derrota al villano y blinda', () => {
  const g = makeGame(['A', 'B']);
  const h = hero('blue');
  const v = villain('blue');
  g.teams.A = [slot(h, { villains: [v] })];
  const a = ally(['blue', 'red']);
  g.hands.A = [a];
  const { state } = play(g, 'A', a.id, { ownerId: 'A', heroId: h.id });
  assert.equal(heroState(state.teams.A[0]), HERO_STATE.SHIELDED);
  assert.ok(state.discard.find((c) => c.id === v.id));
});

test('héroe blindado por aliado es permanente: no se puede atacar', () => {
  const g = makeGame(['A', 'B']);
  const h = hero('blue');
  g.teams.B = [slot(h, { ally: ally(['blue', 'red']) })];
  const v = villain('blue');
  g.hands.A = [v];
  assert.throws(() => play(g, 'A', v.id, { ownerId: 'B', heroId: h.id }), /blindado/i);
});

// --- HÉROE / color ---

test('no se pueden tener dos héroes del mismo color', () => {
  const g = makeGame(['A', 'B']);
  g.teams.A = [slot(hero(RED))];
  const h2 = hero(RED);
  g.hands.A = [h2];
  assert.throws(() => play(g, 'A', h2.id, { ownerId: 'A' }), /mismo color|color/i);
});

// --- TURNO / ROBO ---

test('tras jugar, el actor roba hasta 3 y pasa el turno', () => {
  const g = makeGame(['A', 'B']);
  const h = hero(RED);
  g.teams.A = [slot(h)];
  const p = power(RED);
  g.hands.A = [p]; // tras jugar queda con 0 → roba 3
  const { state } = play(g, 'A', p.id, { ownerId: 'A', heroId: h.id });
  assert.equal(state.hands.A.length, 3);
  assert.equal(state.currentPlayer, 'B');
});
