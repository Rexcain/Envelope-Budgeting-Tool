/* Local persistence: everything lives in one localStorage key. */
import { thisMonth, prevM, pad } from './model.js';

const KEY = 'envelope-ledger/v1';
const PALETTE = ['#2a9d8f', '#e07a5f', '#4c7fb5', '#8d99ae', '#d4a72c', '#7b5fa8', '#c2577a', '#5a8f3c'];
export const palette = PALETTE;

export function defaultSettings(lang, names) {
  const budgets = [350, 180, 80, 80, 120, 100], needs = [true, false, true, true, false, false];
  return {
    lang, currency: '$', startMonth: thisMonth(), low: 900, high: 1400, guideRatio: 0.75, bigTicket: 150,
    categories: names.map((name, i) => ({ id: 'c' + (i + 1), name, color: PALETTE[i % PALETTE.length], budget: budgets[i] ?? 100, need: needs[i] ?? false })),
  };
}

export function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return validate(JSON.parse(raw)); } catch (e) { /* storage blocked or corrupt */ }
  return null;
}
export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
}
export function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

export function validate(s) {
  if (!s || typeof s !== 'object' || !s.settings || !Array.isArray(s.entries)) throw new Error('bad');
  const st = s.settings;
  if (!/^\d{4}-\d{2}$/.test(st.startMonth) || !(st.high > 0) || !(st.low > 0) || !Array.isArray(st.categories)) throw new Error('bad');
  s.entries = s.entries.filter(e => e && typeof e.amount === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.cat);
  s.budgets = s.budgets && typeof s.budgets === 'object' ? s.budgets : {};
  s.demo = !!s.demo;
  return s;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Two-and-a-half months of made-up spending so the meter, suggestion and trend have something to show. */
export function demoState(lang, names) {
  const settings = defaultSettings(lang, names);
  const now = thisMonth(), m2 = prevM(now), m1 = prevM(m2);
  settings.startMonth = m1;
  const notesZh = [['超市', '菜市场', '水果'], ['午饭', '咖啡', '晚饭', '外卖'], ['地铁', '公交', '打车'], ['洗衣液', '纸巾'], ['电影', '聚会', '游戏'], ['T恤', '鞋']];
  const notesEn = [['Supermarket', 'Farmers market', 'Fruit'], ['Lunch', 'Coffee', 'Dinner', 'Takeout'], ['Subway', 'Bus', 'Taxi'], ['Detergent', 'Paper towels'], ['Movie', 'Drinks with friends', 'Game'], ['T-shirt', 'Shoes']];
  const notes = lang === 'zh' ? notesZh : notesEn;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const entries = [];
  const plan = [[9, 45], [14, 20], [8, 10], [3, 28], [5, 40], [2, 60]]; // per month: count, average amount
  const today = new Date().getDate();
  [[m1, 1.0, 10], [m2, 0.92, 1], [now, 1.3, 1]].forEach(([mo, scale, from]) => {
    const last = mo === now ? Math.max(1, today) : new Date(+mo.slice(0, 4), +mo.slice(5, 7), 0).getDate();
    const frac = (last - from + 1) / new Date(+mo.slice(0, 4), +mo.slice(5, 7), 0).getDate();
    settings.categories.forEach((c, i) => {
      const [n, avg] = plan[i] || [2, 30];
      const count = Math.max(0, Math.round(n * frac));
      for (let k = 0; k < count; k++) {
        const d = from + Math.floor(rnd() * (last - from + 1));
        const amt = Math.round(avg * scale * (0.5 + rnd()) * 100) / 100;
        entries.push({ id: uid(), amount: amt, cat: c.id, date: `${mo}-${pad(d)}`, note: notes[i]?.[k % notes[i].length] || '' });
      }
    });
  });
  entries.push({ id: uid(), amount: 189, cat: 'c6', date: `${m2}-14`, note: lang === 'zh' ? '冬季外套' : 'Winter coat' });
  return { settings, entries, budgets: {}, demo: true };
}
