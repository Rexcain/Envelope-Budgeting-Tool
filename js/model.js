/* Envelope Ledger — pure budgeting model (no DOM, no storage).
 *
 * Concepts
 *   low line   : spending up to here is "comfortable" and never touches carry-over.
 *   high line  : the base monthly ceiling (a promised credit line, not cash).
 *   carry-over : last month's cap − last month's spending. It is added ON TOP of
 *                the high line, so this month's cap = high line + carry-over.
 *                A negative carry-over (overspending) lowers this month's cap.
 *                Carry-over keeps rolling forward month after month.
 *   layers     : low line → quota (low→high) → carry-over (above high) → over cap.
 *                Spending fills the layers in that order.
 *
 * All functions take a `ctx` = { settings, entries, budgets } so they are easy to test.
 *   settings : { startMonth:'YYYY-MM', low, high, guideRatio, bigTicket, categories:[{id,name,color,budget,need}] }
 *   entries  : [{ id, amount, cat, date:'YYYY-MM-DD', note }]
 *   budgets  : { 'YYYY-MM': { catId: amount } }   // explicit budgets saved for a month
 */

export const pad = n => String(n).padStart(2, '0');
export const monthOf = date => date.slice(0, 7);
export const nextM = mo => { let y = +mo.slice(0, 4), k = +mo.slice(5, 7) + 1; if (k > 12) { k = 1; y++; } return `${y}-${pad(k)}`; };
export const prevM = mo => { let y = +mo.slice(0, 4), k = +mo.slice(5, 7) - 1; if (k < 1) { k = 12; y--; } return `${y}-${pad(k)}`; };
export const daysIn = mo => new Date(+mo.slice(0, 4), +mo.slice(5, 7), 0).getDate();
export const thisMonth = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = v => Math.round(v * 100) / 100;

export function spentIn(ctx, mo) {
  const ids = new Set(ctx.settings.categories.map(c => c.id));
  return r2(ctx.entries.reduce((t, e) => t + (monthOf(e.date) === mo && ids.has(e.cat) ? e.amount : 0), 0));
}

/** This month's cap: high line + rolling carry-over (never below 0). */
export function capOf(ctx, mo) {
  const { startMonth, high } = ctx.settings;
  let cap = high;
  for (let k = startMonth; k < mo; k = nextM(k)) cap = Math.max(0, high + (cap - spentIn(ctx, k)));
  return r2(cap);
}

/** Everything the water meter needs for month `mo` with `spent` spent so far. */
export function poolInfo(ctx, mo, spent) {
  const { startMonth, low: L, high: H } = ctx.settings;
  const first = mo <= startMonth;
  const prevSpent = first ? 0 : spentIn(ctx, prevM(mo));
  const prevCap = first ? H : capOf(ctx, prevM(mo));
  const carryIn = first ? null : r2(prevCap - prevSpent);
  const hasCarry = !first && carryIn > 0;
  const overspent = !first && carryIn < 0 ? -carryIn : 0;
  const cap = Math.max(0, r2(H + (first ? 0 : carryIn)));
  const low = Math.min(L, cap);
  const baseEnd = Math.min(H, cap);
  const baseSize = Math.max(0, baseEnd - low);
  const poolStart = hasCarry ? carryIn : 0;
  const drawnBase = clamp(spent - low, 0, baseSize);
  const drawn = clamp(spent - baseEnd, 0, poolStart);
  return {
    first, hasCarry, overspent, cap, low, baseEnd, baseSize, poolStart, prevSpent, prevCap, carryIn,
    drawn: r2(drawn), drawnBase: r2(drawnBase), poolLeft: r2(poolStart - drawn), baseLeft: r2(baseSize - drawnBase),
    over: r2(Math.max(0, spent - cap)), spent: r2(spent),
  };
}

/** Which layer the water level is in: low | nocarry | base | pool | cap */
export function zoneOf(p) {
  if (p.spent <= p.low) return 'low';
  if (p.spent > p.cap) return 'cap';
  if (!p.hasCarry) return 'nocarry';
  if (p.spent <= p.baseEnd) return 'base';
  return 'pool';
}

/** Guide line: guideRatio × this month's cap, rounded to 5. A reference, not a limit. */
export const guideFor = (ctx, mo) => Math.round(poolInfo(ctx, mo, 0).cap * (ctx.settings.guideRatio ?? 0.75) / 5) * 5;

/** Budget for each envelope in month `mo`: latest saved month ≤ mo, else category defaults. */
export function budgetsFor(ctx, mo) {
  const keys = Object.keys(ctx.budgets || {}).filter(k => k <= mo).sort();
  const saved = keys.length ? ctx.budgets[keys[keys.length - 1]] : {};
  return Object.fromEntries(ctx.settings.categories.map(c => [c.id, saved[c.id] ?? c.budget ?? 0]));
}
export const budgetSourceOf = (ctx, mo) => {
  const keys = Object.keys(ctx.budgets || {}).filter(k => k <= mo).sort();
  return keys.length ? keys[keys.length - 1] : null;
};

/** Days of a month that count as "observed" (the first month starts at the first entry). */
export function observedDays(ctx, mo) {
  const dim = daysIn(mo);
  if (mo !== ctx.settings.startMonth) return dim;
  const ds = ctx.entries.filter(e => monthOf(e.date) === mo).map(e => +e.date.slice(8, 10));
  return ds.length ? dim - Math.min(...ds) + 1 : dim;
}

/**
 * Suggest envelope budgets for month `m` from the months before it.
 *  1. per-envelope daily rate × 30.4, recent months weigh more (0.6 decay, up to 4 months);
 *     single purchases ≥ bigTicket are left out of the everyday baseline;
 *  2. shrink toward the previous budget while data is thin (weight n/(n+1));
 *  3. "need" envelopes get +8% headroom; changes < 6% are ignored; each step is at most ±25%;
 *  4. the total is set to the guide line; the gap is spread over flexible envelopes.
 */
export function suggestFor(ctx, m, now = thisMonth()) {
  const S = ctx.settings, cats = S.categories, BIG = S.bigTicket ?? 150;
  if (m <= S.startMonth) return { kind: 'first' };
  if (m > now) return { kind: 'future' };
  const basis = []; for (let mo = S.startMonth; mo < m; mo = nextM(mo)) basis.push(mo);
  const nEff = basis.reduce((t, mo) => t + Math.min(1, observedDays(ctx, mo) / daysIn(mo)), 0), w = nEff / (nEff + 1);
  const rec = basis.slice().reverse().slice(0, 4), ws = rec.map((_, i) => Math.pow(0.6, i)), wsum = ws.reduce((a, b) => a + b, 0);
  const prior = budgetsFor(ctx, prevM(m)), bigs = [];
  const rows = cats.map(c => {
    const x = rec.reduce((t, mo, i) => {
      const es = ctx.entries.filter(e => e.cat === c.id && monthOf(e.date) === mo);
      es.forEach(e => { if (e.amount >= BIG) bigs.push(e); });
      const s = es.filter(e => e.amount < BIG).reduce((a, e) => a + e.amount, 0);
      return t + ws[i] * (s / observedDays(ctx, mo) * 30.4);
    }, 0) / wsum;
    const p = prior[c.id] || 0;
    let raw = (1 - w) * p + w * x * (c.need ? 1.08 : 1), why = 'data';
    if (p > 0 && Math.abs(raw - p) / p < 0.06) { raw = p; why = 'small'; }
    else if (p > 0) { if (raw < p * 0.75) { raw = p * 0.75; why = 'capDown'; } else if (raw > p * 1.25) { raw = p * 1.25; why = 'capUp'; } }
    return { c, prior: p, x, raw, why };
  });
  const needs = rows.filter(r => r.c.need), flex = rows.filter(r => !r.c.need);
  const needSum = needs.reduce((t, r) => t + r.raw, 0), flexSum = flex.reduce((t, r) => t + r.raw, 0);
  const target = guideFor(ctx, m);
  if (needSum + flexSum > target) {
    if (needSum < target && flexSum > 0) { const k = (target - needSum) / flexSum; flex.forEach(r => { r.raw *= k; r.why = 'fit'; }); }
    else rows.forEach(r => { r.raw *= target / (needSum + flexSum); r.why = 'fit'; });
  } else if (needSum + flexSum < target && flexSum > 0) {
    const k = (target - needSum) / flexSum; flex.forEach(r => { r.raw *= k; r.why = 'fill'; });
  }
  rows.forEach(r => { r.final = Math.max(0, Math.round(r.raw / 5) * 5); });
  for (let i = 0; i < 40; i++) {
    const tot = rows.reduce((t, r) => t + r.final, 0);
    const big = (flex.length ? flex : rows).slice().sort((a, b) => b.final - a.final)[0];
    if (!big || Math.abs(tot - target) < 5) break;
    if (tot > target) { if (big.final < 5) break; big.final -= 5; } else big.final += 5;
  }
  return { kind: 'ok', target, basis, nEff, w, rows, total: rows.reduce((t, r) => t + r.final, 0), bigs };
}
