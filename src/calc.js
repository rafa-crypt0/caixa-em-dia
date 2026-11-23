import { S, MES, MESL, WD, RED_DEFAULT, EXP, HORAS_PADRAO } from './state.js';

/* ---------- utilidades ---------- */
export const pad = n => String(n).padStart(2, '0');
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const curYM = () => today().slice(0, 7);
export const ymOf = s => String(s || '').slice(0, 7);
export const isYM = s => /^\d{4}-\d{2}$/.test(s || '');
export const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
export const addM = (ym, k) => {
  let [y, m] = ym.split('-').map(Number);
  m += k;
  y += Math.floor((m - 1) / 12);
  m = ((m - 1) % 12 + 12) % 12 + 1;
  return `${y}-${pad(m)}`;
};
export const diffM = (a, b) => {
  const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
};
export const lastDay = ym => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
export const dateIn = (ym, d) => `${ym}-${pad(Math.max(1, Math.min(+d || 1, lastDay(ym))))}`;
export const ymL = ym => { const [y, m] = ym.split('-'); return `${MES[m - 1]}/${y}`; };
export const ymS = ym => { const [y, m] = ym.split('-'); return `${MES[m - 1]}/${y.slice(2)}`; };
export const ymLong = ym => { const [y, m] = ym.split('-'); return `${MESL[m - 1]} de ${y}`; };
export const fD = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : 'sem dia';
export const fDY = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—';
export const wday = s => { const [y, m, d] = s.split('-').map(Number); return WD[new Date(y, m - 1, d).getDay()]; };
export const BRLF = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const round2 = n => Math.round((+n || 0) * 100) / 100;
export const money = n => BRLF.format(round2(n)).replace(/\u00a0/g, ' ');
export const short = n => {
  const a = Math.abs(n);
  return (n < 0 ? '-' : '') + (a >= 1000 ? (a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : Math.round(a).toLocaleString('pt-BR'));
};
export const pct = x => (x * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
export const parseMoney = v => {
  if (typeof v === 'number') return v;
  let s = String(v || '').trim().replace(/R\$|\s/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return Number(s);
};
export const moneyIn = n => n == null || n === '' || isNaN(n) ? '' : String(round2(n)).replace('.', ',');
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const sum = (a, f = x => x) => a.reduce((s, x) => s + (+f(x) || 0), 0);
export const val = l => l.dir * l.amount;
export const expVal = l => l.kind === 'fd' ? -val(l) : l.amount;

/* ---------- geradores de registros e estado ---------- */
export function freshRecs() {
  const m = curYM(), p = uid();
  return [
    { id: 'cfg', t: 'cfg', start: m, reduce: { ...RED_DEFAULT } },
    { id: p, t: 'pes', name: S.uname || 'Eu', uid: S.me || undefined, o: 1 },
    { id: uid(), t: 'cta', name: 'Conta do banco', type: 'banco', personId: p, initial: 0, o: 1 },
    { id: uid(), t: 'cta', name: 'Carteira', type: 'carteira', personId: '', initial: 0, o: 2 }
  ];
}

export function v1ToRecs(st) {
  const R = [{ id: 'cfg', t: 'cfg', start: isYM(st.start) ? st.start : curYM(), reduce: { ...RED_DEFAULT, ...(st.reduce || {}) } }];
  (st.people || []).forEach((p, i) => R.push({ ...p, t: 'pes', o: i + 1 }));
  (st.accounts || []).forEach((a, i) => R.push({ ...a, t: 'cta', type: a.type || (/carteira|dinheiro|esp[eé]cie/i.test(a.name || '') ? 'carteira' : 'banco'), o: i + 1 }));
  (st.cards || []).forEach((c, i) => R.push({ id: c.id, t: 'car', name: c.name, accountId: c.accountId, rule: c.rule || 'close', day: c.day ?? c.closeDay ?? 20, dueDay: c.dueDay ?? 27, dueNext: c.dueNext || 'auto', o: i + 1 }));
  (st.incomes || []).forEach(x => R.push({ ...x, t: 'ent' }));
  (st.fixed || []).forEach(x => R.push({ ...x, t: 'fix' }));
  (st.items || []).forEach(x => R.push({ ...x, t: 'gas' }));
  for (const [ym, c] of Object.entries(st.closed || {})) R.push({ id: 'mes-' + ym, t: 'mes', ym, ...(c && c.real != null && c.real !== '' ? { legacyReal: +c.real } : {}) });
  return R;
}

export function demoRecs() {
  const cm = curYM(), pm = addM(cm, -1), td = +today().slice(8, 10);
  const D = (ym, d) => dateIn(ym, ym === cm ? Math.min(d, td) : d);
  const I = o => ({ id: uid(), t: 'gas', personId: '', cut: null, inst: null, refund: null, bill: null, ...o });
  const E = o => ({ id: uid(), t: 'ent', from: cm, to: null, once: false, ov: {}, ...o });
  const F = o => ({ id: uid(), t: 'fix', from: cm, to: null, ov: {}, ...o });
  return [
    { id: 'cfg', t: 'cfg', start: cm, reduce: { ...RED_DEFAULT } },
    { id: 'p1', t: 'pes', name: 'Ana', o: 1 }, { id: 'p2', t: 'pes', name: 'Beto', o: 2 },
    { id: 'a1', t: 'cta', name: 'Conta da Ana', type: 'banco', personId: 'p1', initial: 180, o: 1 },
    { id: 'a2', t: 'cta', name: 'Conta do Beto', type: 'banco', personId: 'p2', initial: 420, o: 2 },
    { id: 'a3', t: 'cta', name: 'Carteira', type: 'carteira', personId: '', initial: 60, o: 3 },
    { id: 'c1', t: 'car', name: 'Cartão roxo', accountId: 'a1', rule: 'close', day: 17, dueDay: 26, dueNext: 'auto', o: 1 },
    { id: 'c2', t: 'car', name: 'Cartão laranja', accountId: 'a2', rule: 'last', day: 27, dueDay: 3, dueNext: 'auto', o: 2 },
    E({ desc: 'Salário da Ana', cat: 'Salário', personId: 'p1', accountId: 'a1', day: 28, amount: 2900 }),
    E({ desc: 'Salário do Beto', cat: 'Salário', personId: 'p2', accountId: 'a2', day: 30, amount: 2400 }),
    E({ desc: 'Aluguel da sala comercial', cat: 'Aluguel recebido', personId: 'p2', accountId: 'a2', day: 10, amount: 650 }),
    E({ desc: 'Bico de fim de semana', cat: 'Renda extra', personId: 'p2', accountId: 'a3', day: 14, amount: 300, once: true }),
    F({ desc: 'Aluguel da casa', cat: 'Moradia', personId: '', pay: 'a:a2', day: 10, amount: 950, cut: 'ess' }),
    F({ desc: 'Energia elétrica', cat: 'Contas da casa', personId: '', pay: 'a:a1', day: 15, amount: 210, cut: 'ess' }),
    F({ desc: 'Água', cat: 'Contas da casa', personId: '', pay: 'a:a1', day: 20, amount: 85, cut: 'ess' }),
    F({ desc: 'Internet', cat: 'Telefone/Internet', personId: '', pay: 'c:c2', day: null, amount: 99.9, cut: 'red' }),
    F({ desc: 'Plano de celular', cat: 'Telefone/Internet', personId: 'p1', pay: 'c:c1', day: null, amount: 49.99, cut: 'red' }),
    F({ desc: 'Streaming de filmes', cat: 'Assinaturas', personId: 'p1', pay: 'c:c1', day: null, amount: 39.9, cut: 'cor' }),
    F({ desc: 'Academia', cat: 'Saúde', personId: 'p2', pay: 'a:a2', day: 8, amount: 89.9, cut: 'red' }),
    I({ date: D(pm, 18), desc: 'Supermercado do bairro', cat: 'Mercado', personId: 'p1', pay: 'c:c1', amount: 312.4, cut: 'ess' }),
    I({ date: D(pm, 22), desc: 'Delivery de pizza', cat: 'Lanche/Delivery', personId: 'p1', pay: 'c:c1', amount: 78, cut: 'cor' }),
    I({ date: D(pm, 25), desc: 'Farmácia', cat: 'Saúde', personId: 'p1', pay: 'c:c1', amount: 64.9, cut: 'ess' }),
    I({ date: D(pm, 28), desc: 'Pix no crédito para a costureira', cat: 'Tarifas e juros', personId: 'p1', pay: 'c:c1', amount: 215.6, cut: 'cor' }),
    I({ date: D(pm, 12), desc: 'Posto de combustível', cat: 'Transporte', personId: 'p2', pay: 'c:c2', amount: 150, cut: 'red' }),
    I({ date: D(pm, 20), desc: 'Churrascaria', cat: 'Lanche/Delivery', personId: 'p2', pay: 'c:c2', amount: 96, cut: 'cor' }),
    I({ date: D(pm, 3), desc: 'Geladeira', cat: 'Casa', personId: '', pay: 'c:c1', amount: 245.75, total: 2949, cut: 'com', inst: { cur: 7, tot: 12 }, bill: cm }),
    I({ date: D(pm, 3), desc: 'Celular novo', cat: 'Compras online', personId: 'p2', pay: 'c:c1', amount: 129.9, cut: 'com', inst: { cur: 4, tot: 10 }, bill: cm }),
    I({ date: D(pm, 3), desc: 'Curso online', cat: 'Educação', personId: 'p1', pay: 'c:c1', amount: 47, cut: 'com', inst: { cur: 11, tot: 12 }, bill: cm }),
    I({ date: D(pm, 3), desc: 'Tênis', cat: 'Vestuário', personId: 'p2', pay: 'c:c1', amount: 59.98, cut: 'com', inst: { cur: 5, tot: 5 }, bill: cm }),
    I({ date: D(cm, 2), desc: 'Padaria', cat: 'Mercado', personId: 'p2', pay: 'a:a3', amount: 18.5, cut: 'ess' }),
    I({ date: D(cm, 3), desc: 'Lanchonete', cat: 'Lanche/Delivery', personId: 'p2', pay: 'c:c1', amount: 32, cut: 'cor' }),
    I({ date: D(cm, 4), desc: 'Posto de combustível', cat: 'Transporte', personId: 'p2', pay: 'c:c2', amount: 120, cut: 'red' }),
    I({ date: D(cm, 7), desc: 'Feira', cat: 'Mercado', personId: 'p1', pay: 'a:a3', amount: 63, cut: 'ess' }),
    I({ date: D(cm, 9), desc: 'Roupa das crianças', cat: 'Vestuário', personId: 'p1', pay: 'c:c1', amount: 89.9, total: 269.7, cut: 'com', inst: { cur: 1, tot: 3 } }),
    I({ date: D(cm, 11), desc: 'Remédio de uso contínuo', cat: 'Saúde', personId: 'p1', pay: 'a:a1', amount: 42.8, cut: 'ess' }),
    I({ date: D(cm, 12), desc: 'Água mineral', cat: 'Mercado', personId: 'p2', pay: 'a:a3', amount: 7, cut: 'red' }),
    I({ date: D(cm, 12), desc: 'Dízimo', cat: 'Dízimo/Doações', personId: 'p2', pay: 'a:a3', amount: 6, cut: null }),
    I({ date: D(cm, 13), desc: 'Corrida de aplicativo', cat: 'Transporte', personId: 'p2', pay: 'a:a2', amount: 18.7, cut: 'red' }),
    I({ date: D(cm, 14), desc: 'Ingressos do show', cat: 'Lazer', personId: 'p1', pay: 'c:c1', amount: 240, cut: 'cor', refund: { who: 'Carla', amount: 120, received: false } }),
    I({ date: D(cm, 15), desc: 'Compra grande do mês', cat: 'Mercado', personId: '', pay: 'a:a2', amount: 480, cut: 'ess' }),
    I({ date: D(cm, 16), desc: 'Loja de ferragens', cat: 'Casa', personId: 'p2', pay: 'c:c2', amount: 54.3, cut: 'red' }),
    { id: uid(), t: 'tra', date: D(cm, 5), from: 'a1', to: 'a3', amount: 100, desc: 'Saque' },
    { id: uid(), t: 'emp', desc: 'Empréstimo pessoal', personId: 'p2', date: dateIn(addM(cm, -3), 10), accId: 'a2', amount: 3000, n: 12, parcela: 329.5, pay: 'a:a2', day: 12, first: addM(cm, -2), cur: 1 },
    { id: 'i1', t: 'inv', name: 'Poupança da casa', kind: 'Poupança', personId: '', o: 1 },
    { id: uid(), t: 'mov', invId: 'i1', kind: 'apl', date: dateIn(pm, 25), amount: 800, accId: 'a2' },
    { id: uid(), t: 'mov', invId: 'i1', kind: 'ren', date: D(cm, 1), amount: 4.9, accId: '' },
    { id: uid(), t: 'mov', invId: 'i1', kind: 'apl', date: D(cm, 20), amount: 150, accId: 'a1' }
  ];
}

export function buildState(recs) {
  const st = { start: curYM(), reduce: { ...RED_DEFAULT }, people: [], accounts: [], cards: [], incomes: [], fixed: [], items: [], transfers: [], loans: [], invs: [], moves: [], confs: [], bills: {}, closed: {} };
  const by = { pes: 'people', cta: 'accounts', car: 'cards', ent: 'incomes', fix: 'fixed', gas: 'items', tra: 'transfers', emp: 'loans', inv: 'invs', mov: 'moves', con: 'confs' };
  const list = Array.isArray(recs) ? recs : Object.values(recs || {});
  for (const r of list) {
    if (!r || !r.t) continue;
    if (r.t === 'cfg') {
      if (isYM(r.start)) st.start = r.start;
      if (r.reduce && typeof r.reduce === 'object') st.reduce = { ...RED_DEFAULT, ...r.reduce };
      continue;
    }
    if (r.t === 'fat') { st.bills[r.card + ':' + r.ym] = r; continue; }
    if (r.t === 'mes') { st.closed[r.ym] = r; continue; }
    const k = by[r.t];
    if (k) st[k].push(r);
  }
  const ord = (a, b) => (a.o ?? 1e9) - (b.o ?? 1e9) || (a.c || 0) - (b.c || 0);
  st.people.sort(ord); st.accounts.sort(ord); st.cards.sort(ord); st.invs.sort(ord);
  return st;
}

/* ---------- motor de cálculo ---------- */
export const acc = (id, st = S.st) => st?.accounts?.find(a => a.id === id);
export const card = (id, st = S.st) => st?.cards?.find(c => c.id === id);
export const person = (id, st = S.st) => st?.people?.find(p => p.id === id);
export const invOf = (id, st = S.st) => st?.invs?.find(x => x.id === id);
export const myPid = (st = S.st, me = S.me) => (st?.people?.find(p => p.uid && p.uid === me) || st?.people?.[0])?.id || '';
export const pname = (id, st = S.st) => id ? (person(id, st)?.name || '—') : 'Os dois / casa';
export const isWallet = a => !!a && a.type === 'carteira';
export const firstBank = (st = S.st) => (st?.accounts?.find(a => !isWallet(a)) || st?.accounts?.[0])?.id || '';
export const defPay = (st = S.st) => firstBank(st) ? 'a:' + firstBank(st) : '';

export function pay(p, st = S.st) {
  if (!p) return null;
  const [t, id] = p.split(':');
  if (t === 'c') {
    const c = card(id, st);
    return c ? { type: 'card', card: c, acc: acc(c.accountId, st), name: c.name } : null;
  }
  const a = acc(id, st);
  return a ? { type: 'acc', acc: a, name: a.name } : null;
}

export const closeDayOf = c => c.rule === 'last' ? (+c.day || 1) + 1 : (+c.day || 1);

export function cardDue(c, date) {
  const d = +date.slice(8, 10), cd = closeDayOf(c);
  const close = d < cd ? ymOf(date) : addM(ymOf(date), 1);
  const nx = c.dueNext === 'same' ? 0 : c.dueNext === 'next' ? 1 : (+c.dueDay >= cd ? 0 : 1);
  return addM(close, nx);
}

export function cardRuleText(c) {
  return (c.rule === 'last' ? `Compras até o dia ${c.day}` : `Fecha no dia ${c.day}`) + ` · vence dia ${c.dueDay}`;
}

export function cardExample(c) {
  const ym = curYM(), cd = closeDayOf(c);
  const due = d => { const f = cardDue(c, d); return `fatura de ${ymL(f)}, vence ${fD(dateIn(f, c.dueDay))}`; };
  if (cd > lastDay(ym)) return `Toda compra de ${ymL(ym)} entra na ${due(dateIn(ym, 1))}.`;
  const parts = [];
  if (cd > 1) { const a = dateIn(ym, cd - 1); parts.push(`Compra em ${fD(a)} → ${due(a)}.`); }
  const b = dateIn(ym, cd); parts.push(`Compra em ${fD(b)} → ${due(b)}.`);
  return parts.join(' ');
}

export function firstYM(it, st = S.st) {
  if (it.bill) return it.bill;
  const p = pay(it.pay, st);
  return p && p.type === 'card' ? cardDue(p.card, it.date) : ymOf(it.date);
}

export function lastYM(it, st = S.st) {
  const t = it.inst?.tot || 1, c = it.inst?.cur || 1;
  return addM(firstYM(it, st), t - c);
}

export function instAmt(x, n) {
  const tot = x.inst?.tot || 1;
  if (x.total && tot > 1) {
    const cents = Math.round(x.total * 100), base = Math.floor(cents / tot), rem = cents - base * tot;
    return (base + (n === 1 ? rem : 0)) / 100;
  }
  return +x.amount;
}

export function rateMonthly(pv, pmt, n) {
  if (!(pv > 0 && pmt > 0 && n > 0) || pmt * n <= pv + 0.005) return 0;
  let lo = 0, hi = 1;
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2, v = pmt * (1 - Math.pow(1 + mid, -n)) / mid;
    if (v > pv) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export const trName = (a, b) => !isWallet(a) && isWallet(b) ? 'Saque' : isWallet(a) && !isWallet(b) ? 'Depósito' : 'Transferência';

const _memo = new Map();
let _memoSt = null;
export function invalidate() {
  _memo.clear();
  _memoSt = null;
}
function memo(st, k, f) {
  if (st !== S.st) return f();
  if (_memoSt !== S.st) { _memo.clear(); _memoSt = S.st; }
  if (_memo.has(k)) return _memo.get(k);
  const v = f();
  _memo.set(k, v);
  return v;
}

export function lines(m, red, st = S.st) {
  return memo(st, 'L' + m + (red ? 'r' : ''), () => {
    const L = [], P = o => { L.push(o); return o; };
    for (const x of st.incomes) {
      let amt;
      const co = x.once && isYM(x.comp) && x.comp !== x.from ? x.comp : null;
      if (co && co === m && +x.amount) {
        P({ kind: 'in', dir: 1, src: x, desc: x.desc, cat: x.cat, person: x.personId, acc: null, compIn: true, via: acc(x.accountId, st)?.name || '—', date: x.day ? dateIn(x.from, x.day) : null, amount: +x.amount });
        continue;
      }
      if (x.once) { if (x.from !== m) continue; amt = x.amount; }
      else { if (x.from > m || (x.to && x.to < m)) continue; amt = (x.ov && x.ov[m] != null) ? x.ov[m] : x.amount; }
      if (!+amt) continue;
      P({ kind: 'in', dir: 1, src: x, desc: x.desc, cat: x.cat, person: x.personId, acc: x.accountId, via: acc(x.accountId, st)?.name || '—', date: x.day ? dateIn(m, x.day) : null, amount: +amt, ovr: !x.once && x.ov && x.ov[m] != null, compOut: co || undefined });
    }
    for (const x of st.fixed) {
      if (x.from > m || (x.to && x.to < m)) continue;
      const amt = (x.ov && x.ov[m] != null) ? x.ov[m] : x.amount;
      if (!+amt) continue;
      const p = pay(x.pay, st);
      let date = null;
      if (p?.type === 'card') date = dateIn(m, p.card.dueDay);
      else if (x.day) date = dateIn(m, x.day);
      P({ kind: 'fix', dir: -1, src: x, desc: x.desc, cat: x.cat, person: x.personId, acc: p?.acc?.id || null, card: p?.type === 'card' ? p.card.id : null, payKey: x.pay, via: p?.name || '—', date, amount: +amt, cut: x.cut || null, ovr: x.ov && x.ov[m] != null });
    }
    for (const x of st.items) {
      if (!isDate(x.date)) continue;
      const p = pay(x.pay, st), f0 = firstYM(x, st), k = diffM(f0, m), cur = x.inst?.cur || 1, tot = x.inst?.tot || 1;
      if (k < 0 || cur + k > tot) continue;
      const n = cur + k;
      let date;
      if (p?.type === 'card') date = dateIn(m, p.card.dueDay);
      else date = k === 0 && ymOf(x.date) === m ? x.date : dateIn(m, +x.date.slice(8, 10));
      const ln = P({ kind: 'var', dir: -1, src: x, desc: x.desc, cat: x.cat, person: x.personId, acc: p?.acc?.id || null, card: p?.type === 'card' ? p.card.id : null, payKey: x.pay, via: p?.name || '—', date, buy: x.date, amount: instAmt(x, n), cut: x.cut || (tot > 1 ? 'com' : null), inst: tot > 1 ? { n, tot } : null });
      if (x.refund && +x.refund.amount > 0 && (tot > 1 || k === 0)) {
        ln.refund = { who: x.refund.who || 'alguém', amount: +x.refund.amount, received: !!x.refund.received };
        if (x.refund.received) P({ kind: 'dev', dir: 1, src: x, desc: `Devolução de ${x.refund.who || 'alguém'} · ${x.desc}`, cat: 'Devolução', person: x.personId, acc: ln.acc, via: ln.via, date: ln.date, amount: +x.refund.amount });
      }
    }
    for (const x of st.loans) {
      if (isDate(x.date) && ymOf(x.date) === m && +x.amount > 0) P({ kind: 'loanin', dir: 1, src: x, desc: x.desc, cat: 'Empréstimo recebido', person: x.personId, acc: x.accId, via: acc(x.accId, st)?.name || '—', date: x.date, amount: +x.amount });
      if (!isYM(x.first)) continue;
      const p = pay(x.pay, st), k = diffM(x.first, m), n = (+x.cur || 1) + k;
      if (k < 0 || n > +x.n || !(+x.parcela > 0)) continue;
      const date = p?.type === 'card' ? dateIn(m, p.card.dueDay) : x.day ? dateIn(m, x.day) : null;
      P({ kind: 'loan', dir: -1, src: x, desc: x.desc, cat: 'Consórcio/Empréstimo', person: x.personId, acc: p?.acc?.id || null, card: p?.type === 'card' ? p.card.id : null, payKey: x.pay, via: p?.name || '—', date, amount: +x.parcela, cut: 'com', inst: { n, tot: +x.n } });
    }
    for (const x of st.transfers) {
      if (!isDate(x.date) || ymOf(x.date) !== m || !(+x.amount > 0)) continue;
      const a = acc(x.from, st), b = acc(x.to, st), base = { kind: 'tr', src: x, desc: x.desc || trName(a, b), cat: 'Transferência', person: '', via: `${a?.name || '—'} → ${b?.name || '—'}`, date: x.date, amount: +x.amount };
      P({ ...base, leg: 'from', dir: -1, acc: x.from });
      P({ ...base, leg: 'to', dir: 1, acc: x.to });
    }
    for (const x of st.moves) {
      if (!isDate(x.date) || ymOf(x.date) !== m || (x.kind !== 'apl' && x.kind !== 'res')) continue;
      const iv = invOf(x.invId, st);
      P({ kind: x.kind, dir: x.kind === 'apl' ? -1 : 1, src: x, desc: (x.kind === 'apl' ? 'Aplicação · ' : 'Resgate · ') + (iv?.name || 'investimento'), cat: 'Investimento', person: iv?.personId || '', acc: x.accId, via: acc(x.accId, st)?.name || '—', date: x.date, amount: +x.amount });
    }
    for (const x of st.confs) {
      if (!isDate(x.date) || ymOf(x.date) !== m || !+x.adj) continue;
      P({ kind: 'aj', dir: x.adj > 0 ? 1 : -1, src: x, desc: 'Ajuste da conferência · ' + (acc(x.accId, st)?.name || 'conta'), cat: 'Ajuste de saldo', person: '', acc: x.accId, via: acc(x.accId, st)?.name || '—', date: x.date, amount: Math.abs(+x.adj) });
    }
    if (red) {
      for (const l of L) {
        if ((l.kind === 'fix' || l.kind === 'var') && (l.cut === 'red' || l.cut === 'cor')) {
          const p = +(red[l.cat] || 0);
          if (p) { l.orig = l.amount; l.amount = l.amount * (1 - p); }
        }
      }
    }
    const inv = {};
    for (const l of L) if (l.card) inv[l.card] = (inv[l.card] || 0) + l.amount;
    for (const cd of st.cards) {
      const b = st.bills[cd.id + ':' + m];
      if (!b) continue;
      const inM = isDate(b.date) && ymOf(b.date) === m;
      if (inM) for (const l of L) if (l.card === cd.id) l.date = b.date;
      if (red) continue;
      const diff = round2(+b.amount - (inv[cd.id] || 0));
      if (Math.abs(diff) >= 0.01) P({ kind: 'fd', dir: diff > 0 ? -1 : 1, src: b, desc: `Diferença na fatura do ${cd.name}`, cat: 'Ajuste de fatura', person: '', acc: cd.accountId, via: cd.name, date: inM ? b.date : dateIn(m, cd.dueDay), amount: Math.abs(diff) });
    }
    L.inv = inv;
    return L;
  });
}

export function summary(m, red, st = S.st) {
  return memo(st, 'S' + m + (red ? 'r' : ''), () => {
    const L = lines(m, red, st), K = k => sum(L.filter(l => l.kind === k), l => l.amount);
    const inT = sum(L.filter(l => l.kind === 'in' && !l.compOut), l => l.amount),
      adv = sum(L.filter(l => l.compOut), l => l.amount),
      antic = sum(L.filter(l => l.compIn), l => l.amount),
      dev = K('dev'), fix = K('fix'),
      fd = sum(L.filter(l => l.kind === 'fd'), expVal),
      vr = K('var') + fd, loanP = K('loan'), loanIn = K('loanin'),
      apl = K('apl'), res = K('res'),
      aj = sum(L.filter(l => l.kind === 'aj'), val);
    const out = fix + vr + loanP, result = inT + dev - out, cash = result + loanIn + res - apl + aj + adv - antic;
    const receber = sum(L.filter(l => l.refund && !l.refund.received), l => l.refund.amount);
    const inst = sum(L.filter(l => l.kind === 'var' && l.inst), l => l.amount);
    return { m, L, inT, adv, antic, dev, fix, fd, vr, loanP, loanIn, apl, res, aj, out, result, cash, receber, inst };
  });
}

export function gateOK(m, st = S.st) {
  if (m < st.start) return false;
  const cm = curYM();
  for (let q = st.start; q < m; q = addM(q, 1)) if (!st.closed[q] && q !== cm) return false;
  return true;
}

export function delta(m, st = S.st) {
  return memo(st, 'D' + m, () => {
    const o = {};
    for (const l of lines(m, null, st)) if (l.acc) o[l.acc] = (o[l.acc] || 0) + val(l);
    return o;
  });
}

export function runStart(m, st = S.st) {
  return memo(st, 'R' + m, () => {
    const o = {};
    if (m <= st.start) {
      for (const a of st.accounts) o[a.id] = +a.initial || 0;
      return o;
    }
    const p = addM(m, -1), prev = runStart(p, st), d = delta(p, st);
    for (const a of st.accounts) o[a.id] = (prev[a.id] || 0) + (d[a.id] || 0);
    const cl = st.closed[p];
    if (cl && cl.legacyReal != null && st.accounts[0]) {
      const tot = sum(Object.values(o));
      o[st.accounts[0].id] += cl.legacyReal - tot;
    }
    return o;
  });
}

export function endAcc(m, st = S.st) {
  const s = runStart(m, st), d = delta(m, st), o = {};
  for (const a of st.accounts) o[a.id] = (s[a.id] || 0) + (d[a.id] || 0);
  return o;
}

export function splitTypes(map, st = S.st) {
  let bank = 0, wal = 0;
  for (const a of st.accounts) {
    const v = map[a.id] || 0;
    if (isWallet(a)) wal += v; else bank += v;
  }
  return { bank, wal };
}

export function carry(m, st = S.st) {
  return gateOK(m, st) ? sum(Object.values(runStart(m, st))) : null;
}

export function allowed(m, st = S.st) {
  return carry(m, st) !== null;
}

export function whyNoCarry(m, st = S.st) {
  if (m < st.start) return `Este mês é anterior ao início do controle (${ymL(st.start)}).`;
  const cm = curYM();
  for (let q = st.start; q < m; q = addM(q, 1)) if (!st.closed[q] && q !== cm) return `A sobra só passa de um mês para o seguinte. Feche ${ymL(q)} para ver o que sobra para cá.`;
  return `A sobra de ${ymL(addM(m, -1))} só aparece quando ${ymL(addM(m, -1))} for fechado.`;
}

export function balanceAt(accId, date, exclConf, st = S.st) {
  const ym = ymOf(date), eom = date === dateIn(ym, lastDay(ym));
  let v = runStart(ym, st)[accId] || 0;
  for (const l of lines(ym, null, st)) {
    if (l.acc !== accId) continue;
    if (l.kind === 'aj' && l.src.id === exclConf) continue;
    if (l.date ? l.date <= date : eom) v += val(l);
  }
  return v;
}

export function flow(m, red, st = S.st) {
  const s = summary(m, red, st), ok = gateOK(m, st), n = lastDay(m), st0 = ok ? runStart(m, st) : {}, days = [];
  let { bank, wal } = ok ? splitTypes(st0, st) : { bank: 0, wal: 0 };
  const base = bank + wal, b0 = bank, w0 = wal;
  const byDay = {};
  for (const l of s.L) {
    if (l.date && ymOf(l.date) === m) (byDay[l.date] = byDay[l.date] || []).push(l);
  }
  for (let d = 1; d <= n; d++) {
    const ds = dateIn(m, d);
    let i = 0, o = 0;
    for (const l of byDay[ds] || []) {
      const v = val(l);
      if (l.kind !== 'tr') { if (v > 0) i += v; else o -= v; }
      if (isWallet(acc(l.acc, st))) wal += v; else bank += v;
    }
    days.push({ d, ds, i, o, bal: bank + wal, bank, wal });
  }
  const und = s.L.filter(l => !l.date && l.kind !== 'tr');
  const undIn = sum(und.filter(l => l.dir > 0), l => l.amount), undOut = sum(und.filter(l => l.dir < 0), l => l.amount);
  const cards = st.cards.map(cd => {
    const inv = s.L.inv[cd.id] || 0, bill = st.bills[cd.id + ':' + m];
    if (!inv && !bill) return null;
    const due = bill && isDate(bill.date) && ymOf(bill.date) === m ? bill.date : dateIn(m, cd.dueDay);
    return { card: cd, inv, due, bill, bal: days[+due.slice(8) - 1].bank };
  }).filter(Boolean);
  return { days, base, b0, w0, hasCarry: ok, undIn, undOut, cards };
}

export function accPanel(m, st = S.st) {
  const s = summary(m, null, st), ok = gateOK(m, st), st0 = runStart(m, st);
  const rows = st.accounts.map(a => {
    const L = s.L.filter(l => l.acc === a.id);
    const i = sum(L.filter(l => l.dir > 0), l => l.amount), o = sum(L.filter(l => l.dir < 0), l => l.amount);
    const start = st0[a.id] || 0;
    return { a, i, o, net: i - o, start, end: start + i - o };
  });
  const key = ok ? 'end' : 'net';
  const neg = rows.filter(x => x[key] < -0.005).map(x => ({ ...x, need: -x[key] })).sort((a, b) => b.need - a.need),
    pos = rows.filter(x => x[key] > 0.005).map(x => ({ ...x, have: x[key] })).sort((a, b) => b.have - a.have);
  const tr = [];
  for (const n of neg) {
    for (const p of pos) {
      if (n.need <= 0.005) break;
      if (p.have <= 0.005) continue;
      const v = Math.min(n.need, p.have);
      tr.push({ from: p.a, to: n.a, v });
      n.need -= v; p.have -= v;
    }
  }
  return { rows, tr, ok, uncovered: sum(neg, n => n.need) };
}

export function portfolio(upTo, excl, st = S.st) {
  const o = {};
  for (const i of st.invs) o[i.id] = { inv: i, apl: 0, res: 0, ren: 0, saldo: 0 };
  for (const x of st.moves) {
    if (x.id === excl) continue;
    if (upTo && x.date > upTo) continue;
    const r = o[x.invId];
    if (!r || !Object.prototype.hasOwnProperty.call(r, x.kind)) continue;
    r[x.kind] += +x.amount || 0;
  }
  for (const r of Object.values(o)) r.saldo = r.apl - r.res + r.ren;
  return o;
}

export function loanInfo(x, m) {
  const tot = +x.n, cur = +x.cur || 1, k = isYM(x.first) ? diffM(x.first, m) : -1, n = cur + k, end = isYM(x.first) ? addM(x.first, tot - cur) : null;
  const totalPay = (+x.parcela || 0) * tot, juros = +x.amount > 0 ? totalPay - x.amount : null, i = +x.amount > 0 ? rateMonthly(+x.amount, +x.parcela, tot) : null;
  const fromN = Math.max(n, cur), left = fromN <= tot ? (tot - fromN + 1) * (+x.parcela || 0) : 0;
  return { tot, cur, n, end, totalPay, juros, i, active: k >= 0 && n <= tot, left, done: n > tot };
}

/* ---------- tempo de trabalho ---------- */
export const horasDe = p => +p?.horas > 0 ? +p.horas : HORAS_PADRAO;
export const isComp = l => l.kind === 'fix' || l.kind === 'loan' || (l.kind === 'var' && !!l.inst);

export function tempoBase(m, st = S.st) {
  return memo(st, 'T' + m, () => {
    const ppl = st.people, P = {};
    const salDe = (id, mm) => sum(lines(mm, null, st).filter(l => l.kind === 'in' && !l.compOut && l.person === id && l.cat === 'Salário'), l => l.amount);
    for (const p of ppl) {
      let r = 0, mm = m;
      for (let i = 0; i < 3 && !r; i++, mm = addM(m, -i)) r = salDe(p.id, mm);
      P[p.id] = { p, renda: r, horas: horasDe(p), estimado: !(+p.horas > 0), fixo: 0 };
    }
    const L = lines(m, null, st), rT = sum(Object.values(P), x => x.renda);
    let shared = 0;
    for (const l of L) {
      if (!isComp(l)) continue;
      if (P[l.person]) P[l.person].fixo += l.amount; else shared += l.amount;
    }
    const out = {};
    const fin = x => {
      x.sobra = x.renda - x.fixo;
      x.ok = x.renda > 0 && x.horas > 0;
      x.vh = x.ok ? x.renda / x.horas : 0;
      x.vs = x.ok && x.sobra > 0 ? x.sobra / x.horas : 0;
      return x;
    };
    for (const x of Object.values(P)) {
      if (rT > 0) x.fixo += shared * x.renda / rT;
      out[x.p.id] = fin(x);
    }
    const ganham = Object.values(P).filter(x => x.renda > 0);
    out[''] = fin({ p: null, renda: rT, horas: sum(ganham, x => x.horas), estimado: ganham.some(x => x.estimado), fixo: sum(Object.values(P), x => x.fixo) + (rT > 0 ? 0 : shared) });
    return out;
  });
}

export function tempoDe(pid, m, st = S.st) {
  const T = tempoBase(m, st);
  return T[pid] && T[pid].ok ? T[pid] : T[''];
}

export function fH(h) {
  if (!isFinite(h) || h <= 0) return '—';
  const mi = Math.round(h * 60);
  if (mi < 60) return mi + ' min';
  const H = Math.floor(mi / 60), M = mi % 60;
  return H.toLocaleString('pt-BR') + 'h' + (M ? pad(M) : '');
}

export function fDias(h) {
  const d = h / 8;
  return d >= 1 ? `≈ ${d.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${d < 1.95 ? 'dia' : 'dias'} de 8h` : '';
}

export function tempoInfo(v, pid, m, st = S.st) {
  const t = tempoDe(pid, m, st);
  if (!t.ok || !(v > 0)) return null;
  const h = v / t.vh, hs = t.vs > 0 ? v / t.vs : null, ps = t.sobra > 0 ? v / t.sobra : null;
  return { t, h, hs, ps, quem: t.p ? t.p.name : 'a casa' };
}
