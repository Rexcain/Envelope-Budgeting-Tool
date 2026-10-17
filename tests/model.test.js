import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poolInfo, capOf, zoneOf, guideFor, budgetsFor, suggestFor, spentIn } from '../js/model.js';

const settings = {
  startMonth: '2026-01', low: 900, high: 1400, guideRatio: 0.75, bigTicket: 150,
  categories: [
    { id: 'food', name: 'Food', budget: 400, need: true },
    { id: 'fun', name: 'Fun', budget: 200, need: false },
  ],
};
const e = (date, amount, cat = 'food', note = '') => ({ id: date + amount, date, amount, cat, note });
const mk = entries => ({ settings, entries, budgets: {} });

test('first month has no carry-over and the cap is the high line', () => {
  const p = poolInfo(mk([]), '2026-01', 0);
  assert.equal(p.first, true); assert.equal(p.hasCarry, false); assert.equal(p.cap, 1400);
  assert.equal(p.baseSize, 500);
});

test('unspent money is stacked on top of the high line next month', () => {
  const c = mk([e('2026-01-10', 1000)]);
  const p = poolInfo(c, '2026-02', 0);
  assert.equal(p.carryIn, 400); assert.equal(p.cap, 1800); assert.equal(p.baseEnd, 1400); assert.equal(p.poolStart, 400);
});

test('carry-over keeps rolling: cap_n = high + (cap_{n-1} - spent_{n-1})', () => {
  const c = mk([e('2026-01-10', 1000), e('2026-02-10', 1500)]);
  assert.equal(capOf(c, '2026-02'), 1800);
  assert.equal(capOf(c, '2026-03'), 1700); // 1400 + (1800 - 1500)
});

test('overspending lowers next month\'s cap', () => {
  const c = mk([e('2026-01-10', 1600)]);
  const p = poolInfo(c, '2026-02', 0);
  assert.equal(p.overspent, 200); assert.equal(p.cap, 1200); assert.equal(p.hasCarry, false);
});

test('layers fill in order: low → quota → carry-over → over', () => {
  const c = mk([e('2026-01-10', 1000)]); // Feb cap 1800
  assert.equal(zoneOf(poolInfo(c, '2026-02', 500)), 'low');
  const q = poolInfo(c, '2026-02', 1100);
  assert.equal(zoneOf(q), 'base'); assert.equal(q.drawnBase, 200); assert.equal(q.drawn, 0);
  const r = poolInfo(c, '2026-02', 1500);
  assert.equal(zoneOf(r), 'pool'); assert.equal(r.drawn, 100); assert.equal(r.poolLeft, 300);
  assert.equal(zoneOf(poolInfo(c, '2026-02', 1900)), 'cap');
});

test('guide line is guideRatio × cap rounded to 5', () => {
  const c = mk([e('2026-01-10', 1000)]);
  assert.equal(guideFor(c, '2026-02'), 1350);
});

test('budgets inherit the latest saved month', () => {
  const c = { ...mk([]), budgets: { '2026-02': { food: 500, fun: 100 } } };
  assert.deepEqual(budgetsFor(c, '2026-01'), { food: 400, fun: 200 });
  assert.deepEqual(budgetsFor(c, '2026-05'), { food: 500, fun: 100 });
});

test('suggestion: first / future months, and totals match the guide', () => {
  const c = mk([e('2026-01-01', 300), e('2026-01-15', 200), e('2026-01-20', 100, 'fun'), e('2026-01-21', 400, 'fun')]);
  assert.equal(suggestFor(c, '2026-01', '2026-02').kind, 'first');
  assert.equal(suggestFor(c, '2026-04', '2026-02').kind, 'future');
  const s = suggestFor(c, '2026-02', '2026-02');
  assert.equal(s.kind, 'ok');
  assert.equal(s.total, guideFor(c, '2026-02'));
  assert.equal(s.bigs.length, 3); // 300, 200 and 400 are ≥ bigTicket
});

test('entries in unknown envelopes are ignored', () => {
  assert.equal(spentIn(mk([e('2026-01-02', 50, 'gone')]), '2026-01'), 0);
});
