/* Envelope Ledger — UI. State lives in localStorage via store.js; all money math is in model.js. */
import * as M from './model.js';
import { t, tf, setLang, getLang, STRINGS } from './i18n.js';
import * as Store from './store.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${M.pad(d.getMonth() + 1)}-${M.pad(d.getDate())}`; };

let state = Store.load();
let curMonth = M.thisMonth();
let setupMode = null; // 'first' | 'settings' | null

const ctx = () => ({ settings: state.settings, entries: state.entries, budgets: state.budgets });
const cats = () => state.settings.categories;
const catById = id => cats().find(c => c.id === id);
function fmt(v, short) {
  const cur = state?.settings?.currency ?? '$';
  const n = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: short ? 0 : 2, maximumFractionDigits: short ? 0 : 2 });
  return (v < -0.004 ? '−' : '') + cur + n;
}
const persist = () => Store.save(state);

/* ---------------- toast ---------------- */
let toastTimer, undoFn = null;
function toast(msg, undo, ms) {
  $('toastMsg').textContent = msg; undoFn = undo || null; $('toastUndo').hidden = !undo; $('toastUndo').textContent = t('undo');
  $('toast').classList.add('on'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').classList.remove('on'); undoFn = null; }, ms || (undo ? 5000 : 2600));
}
$('toastUndo').onclick = () => { const f = undoFn; undoFn = null; $('toast').classList.remove('on'); f && f(); };

/* ---------------- setup / settings ---------------- */
function draftFrom(s) { return JSON.parse(JSON.stringify(s)); }
let draft = null;
function openSetup(mode, base) {
  setupMode = mode;
  draft = draftFrom(base || state?.settings || Store.defaultSettings(getLang(), t('defaultCats')));
  renderSetup(); renderAll();
}
function renderSetup() {
  const el = $('setup');
  if (!setupMode) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const d = draft;
  el.innerHTML = `
    <h2>${setupMode === 'first' ? t('setupTitle') : t('settings')}</h2>
    ${setupMode === 'first' ? `<div class="sub">${t('setupIntro')}</div>` : ''}
    <div class="setup-grid">
      <label class="f">${t('startMonth')}<input id="sStart" type="month" value="${d.startMonth}"></label>
      <label class="f">${t('lowLine')}<input class="num" id="sLow" type="number" min="1" step="1" value="${d.low}"><span class="hint">${t('lowHint')}</span></label>
      <label class="f">${t('highLine')}<input class="num" id="sHigh" type="number" min="1" step="1" value="${d.high}"><span class="hint">${t('highHint')}</span></label>
      <label class="f">${t('currency')}<input id="sCur" type="text" maxlength="4" value="${esc(d.currency)}"></label>
      <label class="f">${t('guideRatio')}<input class="num" id="sGuide" type="number" min="10" max="100" step="5" value="${Math.round((d.guideRatio ?? 0.75) * 100)}"></label>
      <label class="f">${t('bigTicket')}<input class="num" id="sBig" type="number" min="1" step="1" value="${d.bigTicket ?? 150}"></label>
    </div>
    <h2 style="margin-top:18px">${t('envelopes')}</h2>
    <div class="cats" id="sCats">${d.categories.map((c, i) => `
      <div class="cat-row" data-i="${i}">
        <input type="color" value="${c.color}" data-k="color" aria-label="${t('envColor')}">
        <input type="text" value="${esc(c.name)}" data-k="name" aria-label="${t('envName')}" placeholder="${t('envName')}">
        <input class="num" type="number" min="0" step="5" value="${c.budget}" data-k="budget" aria-label="${t('envBudget')}">
        <label class="need"><input type="checkbox" data-k="need" ${c.need ? 'checked' : ''}>${t('envNeed')}</label>
        <button class="ghost" type="button" data-rm="${i}" aria-label="${t('removeEnv')}">✕</button>
      </div>`).join('')}
    </div>
    <div class="row" style="margin-top:8px"><button class="ghost" type="button" id="sAddCat">${t('addEnv')}</button></div>
    <div class="err" id="sErr"></div>
    <div class="row" style="margin-top:10px">
      <button class="primary" type="button" id="sSave">${setupMode === 'first' ? t('startBtn') : t('saveSettings')}</button>
      ${setupMode === 'first' ? `<button class="ghost" type="button" id="sDemo">${t('demoBtn')}</button>` : `<button class="ghost" type="button" id="sCancel">${t('cancel')}</button>`}
    </div>`;
  const readDraft = () => {
    d.startMonth = $('sStart').value || d.startMonth;
    d.low = +$('sLow').value; d.high = +$('sHigh').value; d.currency = $('sCur').value.trim() || '$';
    d.guideRatio = Math.min(1, Math.max(0.1, +$('sGuide').value / 100 || 0.75)); d.bigTicket = +$('sBig').value || 150;
    el.querySelectorAll('.cat-row').forEach(row => {
      const c = d.categories[+row.dataset.i];
      row.querySelectorAll('[data-k]').forEach(inp => {
        const k = inp.dataset.k;
        c[k] = k === 'need' ? inp.checked : k === 'budget' ? Math.max(0, +inp.value || 0) : inp.value;
      });
    });
  };
  $('sAddCat').onclick = () => { readDraft(); d.categories.push({ id: 'c' + Store.uid(), name: '', color: Store.palette[d.categories.length % Store.palette.length], budget: 100, need: false }); renderSetup(); };
  el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { readDraft(); d.categories.splice(+b.dataset.rm, 1); renderSetup(); });
  $('sSave').onclick = () => {
    readDraft();
    d.categories = d.categories.filter(c => c.name.trim());
    if (!(d.low > 0) || !(d.high > 0) || d.low > d.high) { $('sErr').textContent = t('errLines'); return; }
    if (!d.categories.length) { $('sErr').textContent = t('errEnv'); return; }
    d.lang = getLang();
    if (!state) state = { settings: d, entries: [], budgets: {}, demo: false };
    else state.settings = d;
    curMonth = clampMonth(M.thisMonth());
    const wasFirst = setupMode === 'first';
    setupMode = null; persist(); renderSetup(); renderAll();
    if (!wasFirst) toast(t('settingsSaved'));
  };
  if ($('sDemo')) $('sDemo').onclick = () => {
    state = Store.demoState(getLang(), t('defaultCats')); persist();
    setupMode = null; curMonth = M.thisMonth(); renderSetup(); renderAll();
  };
  if ($('sCancel')) $('sCancel').onclick = () => { setupMode = null; renderSetup(); renderAll(); };
}
const clampMonth = mo => (state && mo < state.settings.startMonth ? state.settings.startMonth : mo);

/* ---------------- static labels ---------------- */
function renderLabels() {
  document.title = `${t('appName')} · ${getLang() === 'zh' ? 'Envelope Ledger' : '信封账本'}`;
  $('appName').textContent = t('appName'); $('tagline').textContent = t('tagline');
  $('langBtn').textContent = t('language'); $('settingsBtn').textContent = t('settings');
  $('settingsBtn').hidden = !state || setupMode === 'first';
  $('prevBtn').setAttribute('aria-label', t('prevMonth')); $('nextBtn').setAttribute('aria-label', t('nextMonth'));
  $('todayBtn').textContent = t('today');
  $('addTitle').textContent = t('addTitle'); $('lAmount').textContent = t('amount'); $('lCat').textContent = t('category');
  $('lDate').textContent = t('dateL'); $('lNote').textContent = t('note'); $('fSubmit').textContent = t('add');
  $('budgetSave').textContent = t('saveBudgets'); $('sugApply').textContent = t('applySug'); $('howTitle').textContent = t('howTitle');
  $('trendTitle').textContent = t('trendTitle'); $('dataTitle').textContent = t('dataTitle'); $('dataNote').textContent = t('dataNote');
  $('exportJson').textContent = t('exportJson'); $('importLbl').textContent = t('importJson'); $('exportCsv').textContent = t('exportCsv');
  $('resetAll').textContent = t('resetAll'); $('footer').textContent = t('footer');
  $('demoText').textContent = t('demoBanner'); $('demoClear').textContent = t('demoClear');
  $('editTitle').textContent = t('editEntry'); $('eAmountL').textContent = t('amount'); $('eCatL').textContent = t('category');
  $('eDateL').textContent = t('dateL'); $('eNoteL').textContent = t('note'); $('eDel').textContent = t('del');
  $('eCancel').textContent = t('cancel'); $('eSave').textContent = t('save');
}

/* ---------------- main render ---------------- */
function renderAll() {
  renderLabels();
  $('main').hidden = !state || setupMode === 'first';
  if (!state || setupMode === 'first') return;
  const c = ctx(), m = curMonth, monthName = tf('month')(m);
  const inMonth = state.entries.filter(e => M.monthOf(e.date) === m && catById(e.cat));
  const spent = M.spentIn(c, m), pool = M.poolInfo(c, m, spent), zone = M.zoneOf(pool);
  const budgets = M.budgetsFor(c, m), budgetTotal = Object.values(budgets).reduce((a, b) => a + b, 0);
  const H = state.settings.high;

  $('demoBanner').hidden = !state.demo;
  $('monthTitle').textContent = monthName;
  $('prevBtn').disabled = m <= state.settings.startMonth;
  $('todayBtn').hidden = m === M.thisMonth();

  /* stats */
  $('kSpent').textContent = t('spent'); $('vSpent').textContent = fmt(spent); $('vSpent').className = 'v' + (spent > pool.cap ? ' over' : '');
  $('nSpent').textContent = t('entriesCount', { n: inMonth.length });
  $('kLow').textContent = t('toLow', { v: fmt(pool.low, 1) }); $('vLow').textContent = fmt(pool.low - spent); $('vLow').className = 'v' + (spent > pool.low ? ' over' : '');
  $('nLow').textContent = spent > pool.low ? t('overLowBy', { v: fmt(spent - pool.low) }) : t('withinLow');
  $('kCarry').textContent = t('carryLeft');
  if (pool.hasCarry) {
    $('vCarry').textContent = fmt(pool.poolLeft);
    $('nCarry').textContent = spent <= pool.baseEnd ? t('carryNotYet', { v: fmt(pool.poolStart) }) : t('carryUsed', { a: fmt(pool.drawn), b: fmt(pool.poolStart) });
  } else {
    $('vCarry').textContent = '—';
    $('nCarry').textContent = pool.first ? t('noCarryFirst') : pool.overspent > 0 ? t('overspentPrev', { v: fmt(pool.overspent) }) : t('noCarry');
  }
  $('kCap').textContent = t('capThis'); $('vCap').textContent = fmt(pool.cap);
  $('nCap').textContent = pool.first ? '' : t('capFormula', { h: fmt(H, 1), c: fmt(pool.carryIn) });

  renderMeter(c, m, monthName, spent, pool, zone, budgetTotal);
  renderEnvelopes(c, m, monthName, inMonth, budgets, spent, budgetTotal);
  renderSuggestion(c, m, monthName, budgets, budgetTotal);
  renderTrend(m, inMonth, pool);
  renderList(m, monthName, inMonth);
  renderForm(m);
}

function zoneName(p, z) {
  if (z === 'nocarry') return t(p.first ? 'zone.nocarryFirst' : p.overspent > 0 ? 'zone.nocarryOver' : 'zone.nocarry');
  return t('zone.' + z);
}
const zoneColor = z => ({ low: 'var(--good)', base: 'var(--warn)', nocarry: 'var(--warn)', pool: 'var(--carry)', cap: 'var(--bad)' }[z]);
function zoneMsg(p, z) {
  if (z === 'low') return t('msgLow', { v: fmt(p.low - p.spent) });
  if (z === 'nocarry') {
    const why = p.first ? t('whyFirst') : p.overspent > 0 ? t('whyOver', { v: fmt(p.overspent), cap: fmt(p.cap) }) : t('whyNone');
    return t('msgNoCarry', { why, v: fmt(p.cap - p.spent) });
  }
  if (z === 'base') return t('msgBase', { v: fmt(p.baseLeft), c: fmt(p.poolStart) });
  if (z === 'pool') return t('msgPool', { v: fmt(p.poolLeft) });
  return t('msgCap', { v: fmt(p.spent - p.cap) });
}

function renderMeter(c, m, monthName, spent, pool, zone, budgetTotal) {
  const H = state.settings.high, planT = M.guideFor(c, m), pct = Math.round((state.settings.guideRatio ?? 0.75) * 100);
  const scaleMax = Math.max(pool.cap, H, spent, 1);
  const pc = v => Math.max(0, Math.min(100, v / scaleMax * 100));
  const seg = (cls, a, b, bg) => b > a ? `<i class="${cls}" style="left:${pc(a)}%;width:${pc(b) - pc(a)}%;${bg ? 'background:' + bg : ''}"></i>` : '';
  const tick = (v, cls = 'tick') => `<i class="${cls}" style="left:calc(${pc(v)}% - 1px)"></i>`;
  $('meterTitle').textContent = t('meterTitle', { m: monthName });
  $('meterTag').textContent = zoneName(pool, zone); $('meterTag').style.color = zoneColor(zone);
  $('meter').innerHTML =
    seg('base', pool.low, pool.baseEnd) + seg('pool', pool.baseEnd, pool.cap) +
    seg('', 0, Math.min(spent, pool.low), 'var(--good)') +
    seg('', pool.low, Math.min(spent, pool.baseEnd), 'var(--warn)') +
    seg('', pool.baseEnd, Math.min(spent, pool.cap), 'var(--carry)') +
    seg('', pool.cap, spent, 'var(--bad)') +
    tick(pool.low) + (pool.hasCarry ? tick(pool.baseEnd) : '') + ((spent > pool.cap || pool.hasCarry) ? tick(pool.cap) : '') +
    (planT > 0 && planT < scaleMax ? tick(planT, 'guide') : '');
  $('meter').setAttribute('aria-label', `${zoneName(pool, zone)} — ${fmt(spent)} / ${fmt(pool.cap)}`);
  const capName = (pool.hasCarry || pool.overspent > 0) ? 'flagCap' : 'flagHigh';
  $('flags').innerHTML = `<span class="l" style="left:${pc(pool.low)}%">${t('flagLow', { v: fmt(pool.low, 1) })}</span>` +
    `<span class="r" style="right:${100 - pc(pool.cap)}%">${t(capName, { v: fmt(pool.cap, 1) })}</span>`;
  const zl = (a, b, col) => b > a ? `<div class="zl" style="left:${pc(a)}%;width:${pc(b) - pc(a)}%;background:${col}"></div>` : '';
  const zt = (a, b, html) => b > a ? `<div class="zt" style="left:${pc(a)}%;width:${pc(b) - pc(a)}%">${html}</div>` : '';
  $('zones').innerHTML =
    zl(0, pool.low, 'var(--good)') + zl(pool.low, pool.baseEnd, 'var(--warn)') + zl(pool.baseEnd, pool.cap, 'var(--carry)') + zl(pool.cap, spent, 'var(--bad)') +
    zt(0, pool.low, `<b>${t('zLow')}</b>`) + zt(pool.low, pool.baseEnd, `<b>${t('zBase')}</b> ${fmt(pool.baseSize, 1)}`) +
    (pool.hasCarry ? zt(pool.baseEnd, pool.cap, `<b>${t('zPool')}</b>`) : '');
  $('meterMsg').textContent = zoneMsg(pool, zone); $('meterMsg').style.color = zoneColor(zone);
  const D = (sw, html) => `<div>${sw}<span>${html}</span></div>`;
  const sw = { g: '<i class="sw" style="background:var(--good)"></i>', c: '<i class="sw pool"></i>', b: '<i class="sw base"></i>', r: '<i class="sw" style="background:var(--bad)"></i>', d: '<i class="sw guide"></i>', k: '<i class="sw" style="background:var(--ink);opacity:.8"></i>' };
  const defs = [D(sw.k, t('defSpent', { v: fmt(spent) })), D(sw.g, t('defLow', { v: fmt(pool.low) }))];
  if (pool.hasCarry) {
    defs.push(D(sw.b, t('defBase', { v: fmt(pool.baseSize), left: fmt(pool.baseLeft) })));
    defs.push(D(sw.c, t('defPool', { v: fmt(pool.carryIn), left: fmt(pool.poolLeft) })));
    defs.push(D(sw.r, t('defCapCarry', { v: fmt(pool.cap), h: fmt(H), c: fmt(pool.carryIn) })));
  } else {
    const key = pool.first ? 'defNoCarryFirst' : pool.overspent > 0 ? 'defOverspent' : 'defNoCarry';
    defs.push(D(sw.b, t(key, { v: fmt(pool.overspent), left: fmt(pool.baseLeft) })));
    defs.push(D(sw.r, t('defCap', { name: t('capThis'), v: fmt(pool.cap) })));
  }
  if (planT > 0) defs.push(D(sw.d, t('defGuide', { pct, v: fmt(planT) })));
  $('defs').innerHTML = defs.join('');
}

function renderEnvelopes(c, m, monthName, inMonth, budgets, spent, budgetTotal) {
  $('envTitle').textContent = t('envTitle', { m: monthName });
  $('envSum').textContent = t('envSum', { a: fmt(spent), b: fmt(budgetTotal) });
  const by = Object.fromEntries(cats().map(k => [k.id, 0]));
  inMonth.forEach(e => { by[e.cat] += e.amount; });
  $('env').innerHTML = cats().map(k => {
    const s = by[k.id], b = budgets[k.id] || 0, left = b - s, pct = b > 0 ? Math.min(100, s / b * 100) : (s > 0 ? 100 : 0);
    const col = left < 0 ? 'var(--bad)' : pct > 85 ? 'var(--warn)' : k.color;
    return `<div class="card"><div class="t"><span class="name"><i class="dot" style="background:${k.color}"></i>${esc(k.name)}</span><span class="sub num">${b > 0 ? Math.round(s / b * 100) : 0}%</span></div>
      <div class="bar"><i style="width:${pct}%;background:${col}"></i></div>
      <div class="meta"><span>${fmt(s)} / ${fmt(b)}</span><span class="${left < 0 ? 'over' : ''}">${left < 0 ? t('overBy', { v: fmt(-left) }) : t('left', { v: fmt(left) })}</span></div></div>`;
  }).join('');
  $('budgetSummary').textContent = t('editBudgets', { m: monthName });
  const src = M.budgetSourceOf(c, m);
  $('budgetFrom').textContent = t('budgetFrom', { src: src ? tf('month')(src) : null });
  const be = $('budgetEdit');
  if (be.dataset.month !== m || be.dataset.lang !== getLang() || be.children.length !== cats().length) {
    be.innerHTML = cats().map(k => `<label class="f">${esc(k.name)}<input class="num" type="number" min="0" step="5" data-b="${k.id}" value="${budgets[k.id] || 0}"></label>`).join('');
    be.dataset.month = m; be.dataset.lang = getLang();
  } else be.querySelectorAll('[data-b]').forEach(i => { if (document.activeElement !== i) i.value = budgets[i.dataset.b] || 0; });
  const sumEdit = () => { let s = 0; be.querySelectorAll('[data-b]').forEach(i => s += +i.value || 0); $('budgetTotal').textContent = t('budgetTotal', { v: fmt(s) }); };
  be.oninput = sumEdit; sumEdit();
}
$('budgetSave').onclick = () => {
  const b = {}; $('budgetEdit').querySelectorAll('[data-b]').forEach(i => b[i.dataset.b] = Math.max(0, +i.value || 0));
  const before = state.budgets[curMonth];
  state.budgets[curMonth] = b; persist(); renderAll();
  toast(t('budgetsSaved'), () => { if (before) state.budgets[curMonth] = before; else delete state.budgets[curMonth]; persist(); renderAll(); });
};

function renderSuggestion(c, m, monthName, budgets, budgetTotal) {
  const s = M.suggestFor(c, m), pct = Math.round((state.settings.guideRatio ?? 0.75) * 100);
  $('sugTitle').textContent = t('sugTitle', { m: monthName });
  const showTable = s.kind === 'ok';
  $('sugTable').hidden = !showTable; $('sugApply').hidden = !showTable;
  $('how').innerHTML = t('how', { big: fmt(state.settings.bigTicket ?? 150, 1), pct }).map(x => `<div>• ${x}</div>`).join('');
  if (s.kind === 'first') { $('sugTag').textContent = ''; $('sugTag').hidden = true; $('sugIntro').textContent = t('sugFirst', { m: monthName }); $('sugNote').textContent = ''; return; }
  if (s.kind === 'future') { $('sugTag').textContent = ''; $('sugTag').hidden = true; $('sugIntro').textContent = t('sugFuture', { m: monthName }); $('sugNote').textContent = ''; return; }
  $('sugTag').hidden = false;
  $('sugTag').textContent = t('sugBasis', { list: s.basis.slice(-4).map(x => tf('monthShort')(x)).join(getLang() === 'zh' ? '、' : ', ') });
  $('sugIntro').innerHTML = t('sugIntro', { total: fmt(s.total), cur: fmt(budgetTotal), pct });
  const short = n => n.length > 5 && getLang() === 'zh' ? n.split(/[与和]/)[0] : n;
  $('sugTable').innerHTML = `<table><thead><tr><th>${t('thEnv')}</th><th class="r">${t('thNow')}</th><th class="r">${t('thSug')}</th><th class="r">${t('thDelta')}</th></tr></thead><tbody>` +
    s.rows.map(r => { const d = r.final - (budgets[r.c.id] || 0);
      return `<tr><td class="nm"><i class="dot" style="background:${r.c.color}"></i> ${esc(short(r.c.name))}</td><td class="r m">${fmt(budgets[r.c.id] || 0)}</td><td class="r m"><b>${fmt(r.final)}</b></td><td class="r m">${Math.abs(d) < 0.5 ? '—' : (d > 0 ? '+' : '') + fmt(d)}</td></tr>`; }).join('') +
    `<tr><td class="nm"><b>${t('total')}</b></td><td class="r m">${fmt(budgetTotal)}</td><td class="r m"><b>${fmt(s.total)}</b></td><td></td></tr></tbody></table>`;
  const same = s.rows.every(r => Math.abs((budgets[r.c.id] || 0) - r.final) < 0.5);
  $('sugApply').disabled = same;
  $('sugNote').textContent = same ? t('sugSame') : s.bigs.length ? t('bigsNote', { list: s.bigs.slice(0, 4).map(e => `${tf('date')(e.date)} ${e.note || catById(e.cat)?.name || ''} ${fmt(e.amount)}`).join(getLang() === 'zh' ? '；' : '; ') }) : '';
  $('sugApply').onclick = () => {
    const before = state.budgets[m];
    state.budgets[m] = Object.fromEntries(s.rows.map(r => [r.c.id, r.final])); persist(); renderAll();
    toast(t('sugApplied'), () => { if (before) state.budgets[m] = before; else delete state.budgets[m]; persist(); renderAll(); });
  };
}

function renderTrend(m, inMonth, pool) {
  const dim = M.daysIn(m), daily = Array(dim).fill(0);
  inMonth.forEach(e => { const d = +e.date.slice(8, 10); if (d >= 1 && d <= dim) daily[d - 1] += e.amount; });
  const perDay = pool.low / dim, capPerDay = pool.cap / dim, midPerDay = pool.baseEnd / dim;
  const W = 640, Hh = 230, L = 52, R = 10, T = 12, B = 26, iw = W - L - R, ih = Hh - T - B, n = dim;
  const raw = Math.max(capPerDay, perDay, ...daily, 1);
  const step = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(s => raw / s <= 5) || Math.ceil(raw / 5 / 1000) * 1000;
  const max = Math.ceil(raw / step) * step, y = v => T + ih - v / max * ih, bw = iw / n;
  let g = '';
  for (let v = 0; v <= max + 1e-9; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(v, 1)}</text>`;
  const bars = daily.map((v, i) => v > 0 ? `<rect x="${L + i * bw + bw * 0.15}" y="${y(v)}" width="${bw * 0.7}" height="${Math.max(1, ih - (y(v) - T))}" rx="2" fill="${v > perDay ? 'var(--warn)' : 'var(--accent)'}"><title>${tf('day')(i + 1)} ${fmt(v)}</title></rect>` : '').join('');
  const xl = daily.map((_, i) => (i === 0 || (i + 1) % 5 === 0) ? `<text x="${L + i * bw + bw / 2}" y="${Hh - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${tf('day')(i + 1)}</text>` : '').join('');
  const line = (v, col, text, anchorEnd, dy) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${col}" stroke-dasharray="5 4"/><text x="${anchorEnd ? W - R : L + 4}" y="${y(v) + dy}" ${anchorEnd ? 'text-anchor="end"' : ''} font-size="11" fill="${col}">${text}</text>`;
  const close = Math.abs(y(perDay) - y(capPerDay)) < 14;
  const lowLn = line(perDay, 'var(--good)', t('lowPerDay', { v: fmt(perDay) }), true, close ? 14 : -5);
  const capLn = capPerDay > perDay + 0.005 ? line(capPerDay, 'var(--bad)', t('capPerDay', { v: fmt(capPerDay) }), true, -5) : '';
  const midLn = midPerDay > perDay + 0.005 && midPerDay < capPerDay - 0.005 ? line(midPerDay, 'var(--warn)', t('highPerDay', { v: fmt(midPerDay) }), false, -5) : '';
  $('trend').innerHTML = `<svg class="trend" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${t('trendTitle')}">${g}${bars}${lowLn}${midLn}${capLn}${xl}</svg>`;
}

function renderList(m, monthName, inMonth) {
  $('listTitle').textContent = t('listTitle', { m: monthName, n: inMonth.length });
  const rows = inMonth.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
  const short = n => n.length > 4 && getLang() === 'zh' ? n.split(/[与和]/)[0] : n;
  $('list').innerHTML = rows.length
    ? `<thead><tr><th>${t('thDate')}</th><th>${t('thCat')}</th><th>${t('thNote')}</th><th class="r">${t('thAmt')}</th><th></th></tr></thead><tbody>` +
      rows.map(e => { const k = catById(e.cat);
        return `<tr><td class="m">${tf('date')(e.date)}</td><td class="nm"><i class="dot" style="background:${k.color}"></i> ${esc(short(k.name))}</td><td class="note">${esc(e.note)}</td><td class="r m">${fmt(e.amount)}</td><td class="r rowbtns"><button class="link" type="button" data-edit="${esc(e.id)}">${t('edit')}</button></td></tr>`; }).join('') + '</tbody>'
    : `<tbody><tr><td class="empty">${t('emptyList')}</td></tr></tbody>`;
}

function catOptions(sel) { sel.innerHTML = cats().map(k => `<option value="${k.id}">${esc(k.name)}</option>`).join(''); }
function renderForm(m) {
  const sel = $('fCat'), keep = sel.value; catOptions(sel); if (keep && catById(keep)) sel.value = keep;
  const d = $('fDate');
  if (!d.value || M.monthOf(d.value) !== m) d.value = m === M.thisMonth() ? todayStr() : `${m}-01`;
}

/* ---------------- events ---------------- */
$('addForm').onsubmit = ev => {
  ev.preventDefault();
  const amount = Math.round(parseFloat($('fAmount').value) * 100) / 100;
  if (!(amount > 0)) { toast(t('needAmount')); return; }
  const e = { id: Store.uid(), amount, cat: $('fCat').value, date: $('fDate').value, note: $('fNote').value.trim() };
  state.entries.push(e); persist();
  $('fAmount').value = ''; $('fNote').value = '';
  const mo = M.monthOf(e.date); curMonth = clampMonth(mo); renderAll();
  const c = ctx(), p = M.poolInfo(c, mo, M.spentIn(c, mo));
  toast(t('added', { v: fmt(amount), c: catById(e.cat).name, msg: zoneMsg(p, M.zoneOf(p)) }),
    () => { state.entries = state.entries.filter(x => x.id !== e.id); persist(); renderAll(); }, 5500);
};
$('prevBtn').onclick = () => { curMonth = clampMonth(M.prevM(curMonth)); renderAll(); };
$('nextBtn').onclick = () => { curMonth = M.nextM(curMonth); renderAll(); };
$('todayBtn').onclick = () => { curMonth = clampMonth(M.thisMonth()); renderAll(); };
$('langBtn').onclick = () => {
  setLang(getLang() === 'zh' ? 'en' : 'zh');
  if (state) { state.settings.lang = getLang(); persist(); }
  if (setupMode === 'first' && draft) {
    // swap untouched default envelope names to the new language
    const from = STRINGS[getLang() === 'zh' ? 'en' : 'zh'].defaultCats, to = t('defaultCats');
    draft.categories.forEach(k => { const i = from.indexOf(k.name); if (i >= 0) k.name = to[i]; });
  }
  renderSetup(); renderAll();
};
$('settingsBtn').onclick = () => { if (setupMode === 'settings') { setupMode = null; renderSetup(); renderAll(); } else openSetup('settings'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
$('demoClear').onclick = () => { const base = state.settings; base.startMonth = M.thisMonth(); state = null; Store.clear(); openSetup('first', base); };

/* edit dialog */
let editing = null;
$('list').onclick = ev => { const id = ev.target.dataset?.edit; if (!id) return; openEditor(id); };
function openEditor(id) {
  editing = state.entries.find(e => e.id === id); if (!editing) return;
  catOptions($('eCat'));
  $('eAmount').value = editing.amount; $('eCat').value = editing.cat; $('eDate').value = editing.date; $('eNote').value = editing.note || '';
  $('editor').hidden = false; $('eAmount').focus();
}
const closeEditor = () => { $('editor').hidden = true; editing = null; };
$('eCancel').onclick = closeEditor;
$('editor').onclick = ev => { if (ev.target === $('editor')) closeEditor(); };
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('editor').hidden) closeEditor(); });
$('editForm').onsubmit = ev => {
  ev.preventDefault(); if (!editing) return;
  const amount = Math.round(parseFloat($('eAmount').value) * 100) / 100;
  if (!(amount > 0)) { toast(t('needAmount')); return; }
  Object.assign(editing, { amount, cat: $('eCat').value, date: $('eDate').value, note: $('eNote').value.trim() });
  persist(); closeEditor(); renderAll();
};
$('eDel').onclick = () => {
  if (!editing) return;
  const gone = editing, idx = state.entries.indexOf(gone);
  state.entries.splice(idx, 1); persist(); closeEditor(); renderAll();
  toast(t('deleted'), () => { state.entries.splice(idx, 0, gone); persist(); renderAll(); });
};

/* data */
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
$('exportJson').onclick = () => download(`envelope-ledger-${todayStr()}.json`, JSON.stringify(state, null, 2), 'application/json');
$('exportCsv').onclick = () => {
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = ['date,envelope,amount,note', ...state.entries.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => [e.date, q(catById(e.cat)?.name || e.cat), e.amount.toFixed(2), q(e.note)].join(','))];
  download(`envelope-ledger-${todayStr()}.csv`, '﻿' + lines.join('\n'), 'text/csv');
};
$('importFile').onchange = async ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  try { state = Store.validate(JSON.parse(await f.text())); setLang(state.settings.lang || getLang()); persist(); curMonth = clampMonth(M.thisMonth()); renderAll(); toast(t('importOk')); }
  catch (e) { toast(t('importBad')); }
};
$('resetAll').onclick = () => { if (!confirm(t('confirmReset'))) return; Store.clear(); state = null; openSetup('first'); };

/* ---------------- boot ---------------- */
setLang(state?.settings?.lang || ((navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en'));
if (state) { curMonth = clampMonth(M.thisMonth()); renderAll(); } else openSetup('first');
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
