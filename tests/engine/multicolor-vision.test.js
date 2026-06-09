import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../../server/game/gameEngine.js';
import { heroState, HERO_STATE } from '../../server/game/selectors.js';
import { makeGame, slot, hero, power, villain, vision } from './helpers.js';

const MULTI = 'multicolor';
const play = (state, playerId, cardId, target) =>
  applyAction(state, { type: 'play', cardId, target }, playerId);

test('héroe multicolor → otorga turno extra (no pasa el turno)', () => {
  const g = makeGame(['A', 'B']);
  const h = hero(MULTI, { name: 'Capitana Marvel' });
  g.hands.A = [h];
  const { state } = play(g, 'A', h.id, { ownerId: 'A' });
  assert.equal(state.currentPlayer, 'A'); // sigue siendo su turno
  assert.equal(state.teams.A.length, 1);
});

test('héroe multicolor se blinda con dos poderes de colores distintos', () => {
  const g = makeGame(['A', 'B']);
  const h = hero(MULTI);
  g.teams.A = [slot(h, { powers: [power('red')] })];
  const p = power('blue');
  g.hands.A = [p];
  const { state } = play(g, 'A', p.id, { ownerId: 'A', heroId: h.id });
  assert.equal(heroState(state.teams.A[0]), HERO_STATE.SHIELDED);
});

test('héroe multicolor: segundo poder del mismo color → error', () => {
  const g = makeGame(['A', 'B']);
  const h = hero(MULTI);
  g.teams.A = [slot(h, { powers: [power('red')] })];
  const p = power('red');
  g.hands.A = [p];
  assert.throws(() => play(g, 'A', p.id, { ownerId: 'A', heroId: h.id }), /distintos/i);
});

test('villano multicolor (Thanos) bloquea a cualquier color y da turno extra', () => {
  const g = makeGame(['A', 'B']);
  const h = hero('green');
  g.teams.B = [slot(h)];
  const v = villain(MULTI, { name: 'Thanos' });
  g.hands.A = [v];
  const { state } = play(g, 'A', v.id, { ownerId: 'B', heroId: h.id });
  assert.equal(heroState(state.teams.B[0]), HERO_STATE.BLOCKED);
  assert.equal(state.currentPlayer, 'A'); // turno extra
});

test('Visión es intangible: no admite poderes', () => {
  const g = makeGame(['A', 'B']);
  const v = vision();
  g.teams.A = [slot(v)];
  const p = power('red');
  g.hands.A = [p];
  assert.throws(() => play(g, 'A', p.id, { ownerId: 'A', heroId: v.id }), /intangible|color/i);
});

test('Visión es intangible: no puede ser bloqueada por villanos', () => {
  const g = makeGame(['A', 'B']);
  const v = vision();
  g.teams.B = [slot(v)];
  const vil = villain('red');
  g.hands.A = [vil];
  assert.throws(() => play(g, 'A', vil.id, { ownerId: 'B', heroId: v.id }), /intangible|atacar/i);
});

test('Visión cuenta como héroe preparado (color gris extra)', () => {
  const g = makeGame(['A', 'B']);
  g.teams.A = [slot(hero('red')), slot(hero('blue')), slot(hero('green')), slot(vision())];
  // Provocar comprobación de victoria jugando una carta inocua.
  const p = power('red');
  g.teams.A[0] = slot(g.teams.A[0].hero); // libre
  g.hands.A = [p];
  const { state } = play(g, 'A', p.id, { ownerId: 'A', heroId: g.teams.A[0].hero.id });
  assert.equal(state.status, 'finished');
  assert.equal(state.winner, 'A');
});
