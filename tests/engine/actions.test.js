import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, serializeState } from '../../server/game/gameEngine.js';
import { heroState, HERO_STATE } from '../../server/game/selectors.js';
import { makeGame, slot, hero, power, villain, ally, action } from './helpers.js';

const play = (state, playerId, cardId, target) =>
  applyAction(state, { type: 'play', cardId, target }, playerId);

// --- RECLUTAR (Nick Furia) ---

test('reclutar: roba un héroe libre de otra persona', () => {
  const g = makeGame(['A', 'B']);
  const h = hero('red');
  g.teams.B = [slot(h)];
  const r = action('recruit');
  g.hands.A = [r];
  const { state } = play(g, 'A', r.id, { ownerId: 'B', heroId: h.id });
  assert.equal(state.teams.B.length, 0);
  assert.equal(state.teams.A.length, 1);
  assert.equal(state.teams.A[0].hero.id, h.id);
});

test('reclutar: no se puede robar un héroe blindado', () => {
  const g = makeGame(['A', 'B']);
  const h = hero('red');
  g.teams.B = [slot(h, { powers: [power('red'), power('red')] })];
  const r = action('recruit');
  g.hands.A = [r];
  assert.throws(() => play(g, 'A', r.id, { ownerId: 'B', heroId: h.id }), /blindado/i);
});

test('reclutar: no puedes acabar con dos héroes del mismo color', () => {
  const g = makeGame(['A', 'B']);
  g.teams.A = [slot(hero('red'))];
  const h = hero('red');
  g.teams.B = [slot(h)];
  const r = action('recruit');
  g.hands.A = [r];
  assert.throws(() => play(g, 'A', r.id, { ownerId: 'B', heroId: h.id }), /color/i);
});

// --- ALTERAR LA REALIDAD (Wanda) ---

test('alterar la realidad: intercambia equipos completos', () => {
  const g = makeGame(['A', 'B']);
  const ha = hero('red');
  const hb1 = hero('blue');
  const hb2 = hero('green');
  g.teams.A = [slot(ha)];
  g.teams.B = [slot(hb1), slot(hb2)];
  const w = action('swap');
  g.hands.A = [w];
  const { state } = play(g, 'A', w.id, { ownerId: 'B' });
  assert.equal(state.teams.A.length, 2);
  assert.equal(state.teams.B.length, 1);
  assert.equal(state.teams.B[0].hero.id, ha.id);
});

// --- CHASQUIDO (Guantelete de Thanos) ---

test('chasquido: cada equipo elimina la mitad (redondeando abajo)', () => {
  const g = makeGame(['A', 'B']);
  const a1 = hero('red');
  const a2 = hero('blue');
  const a3 = hero('green');
  const a4 = hero('yellow');
  const b1 = hero('red');
  const b2 = hero('blue');
  const b3 = hero('green');
  g.teams.A = [slot(a1), slot(a2), slot(a3), slot(a4)]; // floor(4/2)=2
  g.teams.B = [slot(b1), slot(b2), slot(b3)]; // floor(3/2)=1
  const s = action('snap');
  g.hands.A = [s];
  const { state } = play(g, 'A', s.id, {
    selections: { A: [a1.id, a2.id], B: [b1.id] },
  });
  assert.equal(state.teams.A.length, 2);
  assert.equal(state.teams.B.length, 2);
  assert.ok(state.discard.find((c) => c.id === a1.id));
  assert.ok(state.discard.find((c) => c.id === b1.id));
});

test('chasquido: selección explícita con cantidad incorrecta → error', () => {
  const g = makeGame(['A', 'B']);
  g.teams.A = [slot(hero('red')), slot(hero('blue'))]; // debe eliminar 1
  g.teams.B = [slot(hero('green'))];
  const s = action('snap');
  g.hands.A = [s];
  assert.throws(() => play(g, 'A', s.id, { selections: { A: [] } }), /eliminar/i);
});

test('chasquido sin selecciones → abre ventana y cada jugador elige sus héroes', () => {
  const g = makeGame(['A', 'B']);
  const a1 = hero('red');
  const a2 = hero('blue');
  const b1 = hero('green');
  const b2 = hero('yellow');
  g.teams.A = [slot(a1), slot(a2)]; // debe eliminar 1
  g.teams.B = [slot(b1), slot(b2)]; // debe eliminar 1
  const s = action('snap');
  g.hands.A = [s];

  const r1 = play(g, 'A', s.id, {}); // sin selecciones
  assert.equal(r1.state.pending.kind, 'snap');

  // A elige; aún falta B.
  const r2 = applyAction(r1.state, { type: 'snap-select', heroIds: [a1.id] }, 'A');
  assert.ok(r2.state.pending, 'sigue esperando a B');

  // B elige: se resuelve.
  const r3 = applyAction(r2.state, { type: 'snap-select', heroIds: [b1.id] }, 'B');
  assert.equal(r3.state.pending, null);
  assert.equal(r3.state.teams.A.length, 1);
  assert.equal(r3.state.teams.B.length, 1);
  assert.ok(r3.state.discard.find((c) => c.id === a1.id));
  assert.ok(r3.state.discard.find((c) => c.id === b1.id));
});

// --- ESPIAR (Viuda Negra) ---

test('espiar: abre ventana de revelado; el espía ve la mano de la víctima', () => {
  const g = makeGame(['A', 'B']);
  g.teams.A = [slot(hero('red'))];
  g.hands.B = [power('red'), power('blue')];
  const sp = action('spy');
  g.hands.A = [sp];
  const r1 = play(g, 'A', sp.id, { victimId: 'B' });
  assert.equal(r1.state.pending.kind, 'spy');
  // El espía (A) ve la mano de B; otros (B) no.
  const viewA = serializeState(r1.state, 'A');
  const viewB = serializeState(r1.state, 'B');
  assert.equal(viewA.pending.victimHand.length, 2);
  assert.equal(viewB.pending.victimHand, undefined);
});

test('espiar: el espía juega una carta de la víctima y ésta no roba (una carta menos)', () => {
  const g = makeGame(['A', 'B']);
  const myHero = hero('red');
  g.teams.A = [slot(myHero)];
  const stolenPower = power('red');
  g.hands.B = [stolenPower, power('blue')];
  const sp = action('spy');
  g.hands.A = [sp];

  const r1 = play(g, 'A', sp.id, { victimId: 'B' });
  const { state } = applyAction(
    r1.state,
    { type: 'spy-play', cardId: stolenPower.id, play: { ownerId: 'A', heroId: myHero.id } },
    'A'
  );
  // El poder robado protege a mi héroe.
  assert.equal(heroState(state.teams.A[0]), HERO_STATE.PROTECTED);
  // La víctima pierde la carta y queda penalizada sin robo.
  assert.equal(state.hands.B.length, 1);
  assert.equal(state.noDraw.B, 1);
  assert.ok(state.discard.find((c) => c.id === sp.id));
});
