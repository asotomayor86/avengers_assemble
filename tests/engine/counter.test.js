import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../../server/game/gameEngine.js';
import { heroState, HERO_STATE } from '../../server/game/selectors.js';
import { makeGame, slot, hero, villain, action } from './helpers.js';

const play = (state, playerId, cardId, target) =>
  applyAction(state, { type: 'play', cardId, target }, playerId);
const respond = (state, playerId, decision) =>
  applyAction(state, { type: 'respond', decision }, playerId);
const retarget = (state, playerId, target) =>
  applyAction(state, { type: 'retarget', target }, playerId);

test('si el objetivo tiene Contrarrestar, se abre ventana de respuesta', () => {
  const g = makeGame(['A', 'B']);
  const h = hero('red');
  g.teams.B = [slot(h)];
  const v = villain('red');
  g.hands.A = [v];
  g.hands.B = [action('counter')];
  const { state } = play(g, 'A', v.id, { ownerId: 'B', heroId: h.id });
  assert.ok(state.pending);
  assert.equal(state.pending.kind, 'counter');
  assert.equal(state.pending.responderId, 'B');
  assert.equal(state.currentPlayer, 'A'); // el turno sigue abierto
  assert.equal(heroState(state.teams.B[0]), HERO_STATE.FREE); // aún sin efecto
});

test('pasar (no contrarrestar) → el efecto se aplica', () => {
  const g = makeGame(['A', 'B']);
  const h = hero('red');
  g.teams.B = [slot(h)];
  const v = villain('red');
  g.hands.A = [v];
  g.hands.B = [action('counter')];
  const r1 = play(g, 'A', v.id, { ownerId: 'B', heroId: h.id });
  const { state } = respond(r1.state, 'B', 'pass');
  assert.equal(heroState(state.teams.B[0]), HERO_STATE.BLOCKED);
  assert.equal(state.currentPlayer, 'B');
});

test('contrarrestar sin otro objetivo → la carta no tiene efecto y se descarta', () => {
  const g = makeGame(['A', 'B']);
  const h = hero('red');
  g.teams.B = [slot(h)];
  const v = villain('red');
  g.hands.A = [v];
  const counter = action('counter');
  g.hands.B = [counter];
  const r1 = play(g, 'A', v.id, { ownerId: 'B', heroId: h.id });
  const { state } = respond(r1.state, 'B', 'counter');
  assert.equal(heroState(state.teams.B[0]), HERO_STATE.FREE); // sin efecto
  assert.ok(state.discard.find((c) => c.id === v.id)); // villano descartado
  assert.ok(state.discard.find((c) => c.id === counter.id)); // contrarrestar descartado
  assert.equal(state.noDraw.B, 1); // tras contrarrestar, B no roba
  assert.equal(state.currentPlayer, 'B'); // turno avanza
});

test('contrarrestar con otro objetivo válido → el rival re-dirige la carta', () => {
  const g = makeGame(['A', 'B', 'C']);
  const hb = hero('red');
  const hc = hero('red');
  g.teams.B = [slot(hb)];
  g.teams.C = [slot(hc)];
  const v = villain('red');
  g.hands.A = [v];
  g.hands.B = [action('counter')];
  const r1 = play(g, 'A', v.id, { ownerId: 'B', heroId: hb.id });
  const r2 = respond(r1.state, 'B', 'counter');
  assert.equal(r2.state.pending.kind, 'retarget');
  // A re-dirige el villano hacia C.
  const { state } = retarget(r2.state, 'A', { ownerId: 'C', heroId: hc.id });
  assert.equal(heroState(state.teams.C[0]), HERO_STATE.BLOCKED);
  assert.equal(heroState(state.teams.B[0]), HERO_STATE.FREE);
  assert.equal(state.currentPlayer, 'B');
});
