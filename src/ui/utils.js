import {
  S, CUTS, EXP, RO_MSG, CATS_OUT, CATS_IN,
  isDono, autorDe, nomeDe
} from '../state.js';
import {
  today, curYM, ymOf, isDate, addM, dateIn,
  ymL, ymS, ymLong, fD, fDY, wday, round2, money, pct, parseMoney,
  sum, val, expVal, acc, pay, pname, isWallet, myPid,
  summary, carry, flow, tempoBase, tempoDe, tempoInfo, fH, fDias
} from '../calc.js';
import { DB, tempoOn, loadLocal } from '../db.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = s => typeof document !== 'undefined' ? document.querySelector(s) : null;

let toastT;
export function toast(t) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = t;
  el.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.hidden = true; }, 3600);
}

export const TABS = [
  ['resumo', 'Resumo'], ['mes', 'Mês'], ['lanc', 'Lançamentos'], ['rel', 'Relatórios'],
  ['mais', 'Controles'], ['contas', 'Contas'], ['red', 'Reduções'], ['ajustes', 'Ajustes']
];
export const SUBS = [
  ['rec', 'Fixos e entradas'], ['parc', 'Parcelas e empréstimos'],
  ['inv', 'Investimentos'], ['geral', 'Visão geral dos meses']
];

export function renderTabs() {
  const el = $('#tabs');
  if (!el) return;
  el.innerHTML = TABS.map(([k, l]) => `<button role="tab" aria-selected="${S.tab === k}" data-act="tab" data-tab="${k}">${l}</button>`).join('');
}

export function cutTag(c) { return c ? `<span class="tag cut-${c}">${CUTS[c].l}</span>` : ''; }
export function instTag(l) {
  if (!l.inst) return '';
  const f = l.inst.tot - l.inst.n;
  return `<span class="tag ${f === 0 ? 'last' : ''}">${l.inst.n}/${l.inst.tot} · ${f === 0 ? 'última' : f === 1 ? 'falta 1' : 'faltam ' + f}</span>`;
}
export function whoTag(r) {
  const b = r && r.by;
  if (!b || b === S.me) return '';
  const n = S.names[b];
  return n ? `<span class="tag who">por ${esc(n)}</span>` : '';
}
export function horaTag(l) {
  if (!tempoOn() || (l.kind !== 'var' && l.kind !== 'fix')) return '';
  const t = tempoDe(l.person, S.month);
  if (!t.ok) return '';
  return `<span class="tag hora" title="Horas de trabalho de ${esc(t.p ? t.p.name : 'a casa')} para pagar isso">⏱ ${fH(l.amount / t.vh)}</span>`;
}

export function setSave() {
  const el = $('#saveState');
  if (!el) return;
  if (S.mode === 'demo') { el.className = 'save demo'; el.textContent = 'Exemplo · não salvo'; }
  else if (S.mode === 'db') { el.className = 'save db'; el.textContent = S.ro ? 'Banco da casa · só leitura' : 'Banco da casa'; }
  else { el.className = 'save'; el.textContent = 'Só neste aparelho'; }
  const fab = $('#fab');
  if (fab) fab.hidden = (S.ro && S.mode !== 'demo') || S.phase !== 'app';
}

export function topBanner() {
  if (S.mode === 'demo') {
    return `<div class="banner"><p><b>Isto é um exemplo</b> com uma família fictícia (Ana e Beto). Mexa à vontade: nada é salvo enquanto for exemplo.${!S.dbChecked ? ' <b>Procurando os dados da casa…</b>' : DB.db ? ' Se alguém da casa já usa o app, os dados dela aparecem aqui sozinhos.' : ''}</p>${S.ro || !S.dbChecked || !isDono() ? '' : '<button class="btn primary" data-act="fresh">Começar com meus dados</button><button class="btn" data-act="keepdemo">Usar o exemplo como base</button>'}</div>`;
  }
  if (S.ro) return `<div class="banner info"><p>${RO_MSG}</p></div>`;
  return '';
}

/* ---------- opções de formulário e filtros ---------- */
export function payOptions(sel) {
  const a = S.st.accounts.map(x => `<option value="a:${x.id}" ${sel === 'a:' + x.id ? 'selected' : ''}>${esc(x.name)} — ${isWallet(x) ? 'dinheiro vivo' : 'Pix ou débito'}</option>`).join('');
  const c = S.st.cards.map(x => `<option value="c:${x.id}" ${sel === 'c:' + x.id ? 'selected' : ''}>${esc(x.name)} — crédito</option>`).join('');
  return (c ? `<optgroup label="Cartões">${c}</optgroup>` : '') + `<optgroup label="Contas e carteira">${a}</optgroup>`;
}
export const accOpts = sel => S.st.accounts.map(a => `<option value="${a.id}" ${sel === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
export const catOpts = (list, sel) => (sel && !list.includes(sel) ? [sel, ...list] : list).map(c => `<option ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('');
export const pplOpts = sel => `<option value="">Os dois / casa</option>` + S.st.people.map(p => `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
export const cutSeg = sel => `<div class="seg" id="cutSeg">${Object.entries(CUTS).map(([k, v]) => `<button type="button" aria-pressed="${sel === k}" data-act="cutpick" data-v="${k}"><span class="dot" style="background:var(${v.c})"></span>${v.l}</button>`).join('')}<button type="button" aria-pressed="${!sel}" data-act="cutpick" data-v="">Não sei</button></div>`;
export const segPick = (name, opts, sel) => `<div class="seg" data-seg="${name}">${opts.map(([k, l]) => `<button type="button" aria-pressed="${sel === k}" data-act="segpick" data-v="${k}">${l}</button>`).join('')}</div><input type="hidden" name="${name}" value="${sel}">`;
export function typeTabs(kind, editing) {
  if (editing) return '';
  return `<div class="typetabs">${[['var', 'Gasto'], ['in', 'Entrada'], ['fix', 'Gasto fixo'], ['tra', 'Transferência'], ['emp', 'Empréstimo'], ['mov', 'Investimento']].map(([k, l]) => `<button type="button" aria-pressed="${kind === k}" data-act="swkind" data-v="${k}">${l}</button>`).join('')}</div>`;
}
export function defDate() {
  const t = today();
  return ymOf(t) === S.month ? t : dateIn(S.month, 1);
}

/* ---------- linhas de lançamentos ---------- */
export const KINDF = {
  in: l => l.kind === 'in' || l.kind === 'dev',
  fix: l => l.kind === 'fix',
  var: l => (l.kind === 'var' && !l.inst) || l.kind === 'fd',
  inst: l => l.kind === 'var' && !!l.inst,
  loan: l => l.kind === 'loan' || l.kind === 'loanin',
  tr: l => l.kind === 'tr',
  inv: l => l.kind === 'apl' || l.kind === 'res',
  aj: l => l.kind === 'aj',
  dev: l => !!l.refund || l.kind === 'dev'
};

export function filteredLines() {
  const f = S.f;
  let L = summary(S.month).L.filter(l => !(l.kind === 'tr' && l.leg === 'to'));
  if (KINDF[f.kind]) L = L.filter(KINDF[f.kind]);
  if (f.cut) L = L.filter(l => EXP[l.kind] && (f.cut === 'none' ? !l.cut : l.cut === f.cut));
  if (f.person) L = L.filter(l => (l.person || '_') === f.person);
  if (f.pay) {
    const [t, id] = f.pay.split(':');
    L = L.filter(l => t === 'c' ? l.card === id : (!l.card && (l.acc === id || (l.kind === 'tr' && (l.src.from === id || l.src.to === id)))));
  }
  if (f.cat) L = L.filter(l => l.cat === f.cat);
  if (f.q) {
    const q = f.q.toLowerCase();
    L = L.filter(l => (l.desc || '').toLowerCase().includes(q));
  }
  return L;
}

export const KIND_LABEL = {
  fix: 'fixo',
  loanin: 'empréstimo · não é renda',
  loan: 'parcela de empréstimo',
  apl: 'sai da conta, vai para o investimento',
  res: 'volta do investimento',
  aj: 'ajuste',
  fd: 'pago diferente do calculado'
};

export function lineRow(l) {
  const meta = [esc(l.cat)];
  if (l.kind !== 'tr' && l.kind !== 'aj' && l.kind !== 'fd') meta.push(esc(pname(l.person)));
  meta.push(esc(l.via));
  if (l.card && l.buy) meta.push('compra ' + fD(l.buy));
  if (l.card) meta.push('fatura ' + ymS(S.month));
  if (KIND_LABEL[l.kind]) meta.push(KIND_LABEL[l.kind]);
  if (l.kind === 'in') meta.push(l.src.once ? 'entrada avulsa' : 'entrada todo mês');
  if (l.compOut) meta.push('conta como renda de ' + ymL(l.compOut));
  if (l.compIn) meta.push('dinheiro caiu em ' + fDY(l.date));
  if (l.ovr) meta.push('valor só deste mês');
  const ref = l.refund ? `<span class="tag" style="color:var(--accent)">${esc(l.refund.who)} ${l.refund.received ? 'devolveu' : 'deve'} ${money(l.refund.amount)}</span>` : '';
  const amt = l.kind === 'tr' ? `<span class="a num mv">⇄ ${money(l.amount)}</span>` : `<span class="a num ${l.dir > 0 ? 'in' : ''}">${l.dir > 0 ? '+ ' : ''}${money(l.amount)}</span>`;
  const extra = l.kind === 'fd' ? ` data-card="${l.src.card}" data-ym="${l.src.ym}"` : '';
  return `<button class="row-i" data-act="edit" data-kind="${l.kind}" data-id="${l.src.id}"${extra}><span class="d">${esc(l.desc)}</span>${amt}<span class="m">${meta.join(' · ')} ${cutTag(EXP[l.kind] ? l.cut : null)} ${instTag(l)} ${ref} ${whoTag(l.src)} ${horaTag(l)}${l.src && l.src.ped ? ` <span class="tag ped">pedido: ${l.src.ped.tipo === 'del' ? 'apagar' : 'alterar'}</span>` : ''}</span></button>`;
}

/* ---------- pedidos ---------- */
export const PEDK = {
  amount: 'valor', total: 'valor total', desc: 'descrição', cat: 'categoria',
  date: 'data', pay: 'pagamento', personId: 'pessoa', day: 'dia',
  cut: 'dá para cortar', inst: 'parcelas', refund: 'devolução',
  from: 'a partir de', to: 'até', accountId: 'conta', bill: 'mês da fatura'
};

export function pedVal(k, v) {
  if (v == null || v === '') return '—';
  if (k === 'amount' || k === 'total') return money(v);
  if (k === 'date') return fDY(v);
  if (k === 'personId') return pname(v);
  if (k === 'pay') return pay(v)?.name || '—';
  if (k === 'accountId') return acc(v)?.name || '—';
  if (k === 'cut') return CUTS[v]?.l || '—';
  if (k === 'inst') return `${v.cur}/${v.tot}`;
  if (k === 'refund') return `${v.who || ''} ${money(v.amount)}`;
  if (typeof v === 'object') return '…';
  return String(v);
}

export function recTitulo(r) {
  const v = r.amount ?? r.total ?? r.parcela;
  return `${esc(r.desc || r.name || ({ mes: 'Fechamento do mês ' + (r.ym ? ymL(r.ym) : ''), con: 'Conferência de saldo', fat: 'Fatura paga', tra: 'Transferência', mov: 'Movimento de investimento' })[r.t] || 'Lançamento')}${v != null && +v ? ` · <span class="num">${money(v)}</span>` : ''}${r.date ? ` · ${fDY(r.date)}` : ''}`;
}

export function pedidosPanel() {
  if (S.mode !== 'db') return '';
  const L = Object.values(S.recs).filter(r => r.ped && (autorDe(r) === S.me || r.ped.por === S.me));
  if (!L.length) return '';
  return `<section class="panel pedidos"><div class="panel-h"><h2>Pedidos</h2><span class="small muted">só quem lançou pode alterar ou apagar</span></div><div class="stack" style="gap:10px">${L.map(r => {
    const p = r.ped, meu = autorDe(r) === S.me, acao = p.tipo === 'del' ? 'apagar' : 'alterar';
    const ch = p.tipo === 'edit' && p.novo ? `<ul class="small" style="margin:4px 0 0;padding-left:18px">${Object.entries(p.novo).map(([k, v]) => `<li>${esc(PEDK[k] || k)}: ${esc(pedVal(k, r[k]))} → <b>${esc(pedVal(k, v))}</b></li>`).join('')}</ul>` : '';
    return `<div class="pedido"><div><b>${esc(meu ? nomeDe(p.por) : 'Você')}</b> pediu para <b>${acao}</b>: ${recTitulo(r)}${meu ? '' : ` <span class="muted">· aguardando ${esc(nomeDe(autorDe(r)))}</span>`}${ch}</div>
      <div class="btnrow">${meu ? `<button class="btn sm primary" data-act="pedok" data-id="${r.id}">Aprovar</button><button class="btn sm" data-act="pedno" data-id="${r.id}">Recusar</button>` : `<button class="btn sm" data-act="pedcancel" data-id="${r.id}">Cancelar pedido</button>`}</div></div>`;
  }).join('')}</div></section>`;
}

/* ---------- componentes de Resumo e Relatórios ---------- */
export const MN = m => { const s = summary(m); return { m, inn: s.inT + s.dev, out: s.out, res: s.inT + s.dev - s.out }; };
export function lastMonths(m, n) {
  const a = [];
  for (let i = n - 1; i >= 0; i--) {
    const x = addM(m, -i);
    if (x >= S.st.start || x === m) a.push(x);
  }
  return a;
}
export function spark(vals, tok) {
  if (vals.length < 2) return '<div class="spark"></div>';
  const mx = Math.max(...vals, 0), mn = Math.min(...vals, 0), W = 100, H = 34;
  const X = i => i / (vals.length - 1) * W, Y = v => H - 2 - (v - mn) / ((mx - mn) || 1) * (H - 6);
  const pts = vals.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1));
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="M0,${H} L${pts.join(' L')} L${W},${H} Z" fill="var(${tok})" opacity=".13"/><path d="M${pts.join(' L')}" fill="none" stroke="var(${tok})" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
export function kpis(m) {
  const D = lastMonths(m, 6).map(MN), cur = MN(m), prev = MN(addM(m, -1)), pm = ymS(addM(m, -1));
  const tr = (c, p, goodUp) => {
    if (!(Math.abs(p) > 0.005)) return `<span class="small muted">sem mês anterior para comparar</span>`;
    const d = (c - p) / Math.abs(p) * 100, up = d >= 0, good = up === goodUp;
    return `<span class="trend ${good ? 'pos' : 'neg'}">${up ? '↑' : '↓'} ${Math.abs(Math.round(d))}% <span class="muted" style="font-weight:500">vs ${pm}</span></span>`;
  };
  const c = carry(m), nx = c === null ? null : c + summary(m).cash;
  const card = (cls, ic, lab, v, t, sp) => `<div class="kpi ${cls}"><div class="kpi-h"><span class="kpi-ic" aria-hidden="true">${ic}</span><span>${lab}</span></div><span class="v num ${v < 0 ? 'neg' : ''}">${money(v)}</span>${t}${sp}</div>`;
  return `<section class="kpis" aria-label="Indicadores de ${ymLong(m)}">
    ${card('in', '↓', 'Total de entradas', cur.inn, tr(cur.inn, prev.inn, true), spark(D.map(d => d.inn), '--good'))}
    ${card('out', '↑', 'Total de saídas', cur.out, tr(cur.out, prev.out, false), spark(D.map(d => d.out), '--bad'))}
    ${card('bal', '=', 'Saldo do período', cur.res, tr(cur.res, prev.res, true), spark(D.map(d => d.res), '--accent'))}
    <div class="kpi nx"><div class="kpi-h"><span class="kpi-ic" aria-hidden="true">→</span><span>Sobra para ${ymL(addM(m, 1))}</span></div><span class="v num ${nx !== null && nx < 0 ? 'neg' : ''}">${nx === null ? '—' : money(nx)}</span><span class="small muted">${nx === null ? 'feche os meses anteriores para ver' : 'somando o que veio de ' + ymL(addM(m, -1))}</span></div>
  </section>`;
}
export function donut(segs, center, sub) {
  const S2 = segs.filter(x => x.v > 0.005), tot = sum(S2, x => x.v), r = 40, C = 2 * Math.PI * r, g = S2.length > 1 ? 1.3 : 0;
  let off = 0;
  const arcs = tot > 0 ? S2.map(x => {
    const len = x.v / tot * C, d = Math.max(0.01, len - g);
    const a = `<circle class="seg" cx="50" cy="50" r="${r}" fill="none" stroke="var(${x.c})" stroke-width="13" stroke-dasharray="${d.toFixed(2)} ${(C - d).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" data-l="${esc(x.l)}" data-v="${esc(money(x.v))}" data-p="${Math.round(x.v / tot * 100)}%"><title>${esc(x.l)}: ${money(x.v)} (${Math.round(x.v / tot * 100)}%)</title></circle>`;
    off += len;
    return a;
  }).join('') : `<circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="13"/>`;
  return `<div class="donut" data-c="${esc(center)}" data-s="${esc(sub)}"><svg viewBox="0 0 100 100" role="img" aria-label="${esc(sub)}: ${esc(center)}"><g transform="rotate(-90 50 50)">${arcs}</g></svg><div class="dc"><b class="num">${esc(center)}</b><span>${esc(sub)}</span></div></div>`;
}
export function dleg(segs) {
  const tot = sum(segs, x => x.v) || 1;
  return `<div class="dleg">${segs.map(x => `<i class="dot" style="background:var(${x.c})"></i><span>${esc(x.l)}</span><b class="num">${money(x.v)}</b><span class="p num">${(x.v / tot * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>`).join('')}</div>`;
}
export function panorama(m) {
  const c = MN(m), segs = [{ l: 'Entradas', v: c.inn, c: '--good' }, { l: 'Saídas', v: c.out, c: '--bad' }];
  return donut(segs, money(c.res), 'Saldo do período') + dleg(segs);
}
export const TIPO = l => l.kind === 'tr' ? ['tr', '⇄', 'Transferência'] : (l.kind === 'apl' || l.kind === 'res') ? ['mv', '◆', 'Investimento'] : l.kind === 'aj' ? ['mv', '±', 'Ajuste'] : l.dir > 0 ? ['in', '↓', 'Entrada'] : ['out', '↑', 'Saída'];

export function ultimas(m, n) {
  const td = today(),
    A = summary(m).L.filter(l => !(l.kind === 'tr' && l.leg === 'to')).map(l => ({ l, d: l.buy || l.date || '' })).sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : 0),
    P = A.filter(x => x.d && x.d <= td),
    L = (P.length ? P : A).slice(0, n);
  if (!L.length) return `<div class="empty small">Nada lançado em ${ymL(m)} ainda.</div>`;
  return `<div class="tablewrap"><table><thead><tr><th>Data</th><th class="l">Tipo</th><th class="l">Descrição</th><th class="l">Categoria</th><th class="l">Forma de pagamento</th><th>Valor</th></tr></thead><tbody>${L.map(({ l, d }) => {
    const [t, ic, lab] = TIPO(l);
    const ex = l.kind === 'fd' ? ` data-card="${l.src.card}" data-ym="${l.src.ym}"` : '';
    return `<tr class="clk" data-act="edit" data-kind="${l.kind}" data-id="${l.src.id}"${ex}><td class="num">${d ? fD(d) : '—'}</td><td class="l"><span class="tipo ${t}"><i aria-hidden="true">${ic}</i>${lab}</span></td><td class="l" style="white-space:normal;min-width:9rem">${esc(l.desc)}${l.inst ? ` <span class="muted small">${l.inst.n}/${l.inst.tot}</span>` : ''}</td><td class="l">${esc(l.cat)}</td><td class="l">${esc(l.via)}</td><td class="num ${t === 'in' ? 'pos' : t === 'out' ? 'neg' : ''}"><b>${t === 'in' ? '+ ' : t === 'out' ? '− ' : ''}${money(l.amount)}</b></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

export function alertas(m) {
  const fl = flow(m);
  return fl.hasCarry ? fl.cards.filter(c => !c.bill && c.bal < 0).map(c => `<div class="banner bad"><p>⚠ <b>Fatura do ${esc(c.card.name)}</b> vence ${fD(c.due)}: faltam <b class="num">${money(-c.bal)}</b> nos bancos nesse dia.</p><button class="btn sm" data-act="tab" data-tab="mes">Ver o mês</button></div>`).join('') : '';
}

/* ---------- tempo de trabalho (UI) ---------- */
export function tempoPanel(m) {
  const T = tempoBase(m), ppl = S.st.people.map(p => T[p.id]).filter(x => x.renda > 0);
  if (!ppl.length) return `<section class="panel"><div class="panel-h"><h2>Quanto custa em horas de trabalho</h2></div><p class="help" style="margin:0">Cadastre o salário de cada pessoa como entrada com a categoria <b>Salário</b> (em <button class="link" data-act="tab" data-tab="rec">Fixos e entradas</button>) para ver quanto cada gasto custa em tempo de trabalho.</p></section>`;
  const card = x => `<div class="tcard"><div class="panel-h" style="margin:0"><h3>${esc(x.p.name)}</h3>${x.estimado ? `<button class="link small" data-act="tab" data-tab="ajustes">${x.horas} h/mês (ajustar)</button>` : `<span class="small muted">${x.horas} h/mês</span>`}</div>
    <dl class="kv"><dt>Salário</dt><dd class="num">${money(x.renda)}</dd><dt>Fixos e parcelas</dt><dd class="num">− ${money(x.fixo)}</dd><dt><b>Sobra no mês</b></dt><dd class="num ${x.sobra < 0 ? 'neg' : 'pos'}"><b>${money(x.sobra)}</b></dd>
    <dt>Cada hora de trabalho vale</dt><dd class="num">${money(x.vh)}</dd><dt>Cada hora deixa livre</dt><dd class="num">${x.vs > 0 ? money(x.vs) : 'nada'}</dd></dl></div>`;
  const s = summary(m), vr = sum(s.L.filter(l => l.kind === 'var' && !l.inst), l => l.amount), corta = sum(s.L.filter(l => (l.kind === 'var' || l.kind === 'fix') && l.cut === 'cor'), l => l.amount), tc = T[''];
  const casaTxt = tc.ok ? `<p class="small" style="margin:0">No dia a dia de ${ymL(m)} saíram <b class="num">${money(vr)}</b> = <b>${fH(vr / tc.vh)}</b> de trabalho da casa.${corta > 0 ? ` Só o que está marcado como <b>Cortar</b> (${money(corta)}) equivale a <b>${fH(corta / tc.vh)}</b>.` : ''}</p>` : '';
  return `<section class="panel"><div class="panel-h"><h2>Quanto custa em horas de trabalho</h2><span class="small muted">pelo salário cadastrado</span></div>
    <div class="tcards">${ppl.map(card).join('')}</div>
    <div class="calc tq" style="margin-top:12px"><b>Antes de comprar, veja quanto custa em tempo</b>
      <div class="two"><label class="fld"><span>Valor</span><input class="money-in num" id="tq-v" inputmode="decimal" placeholder="0,00"></label><label class="fld"><span>Quem vai pagar</span><select id="tq-p">${pplOpts(myPid())}</select></label></div>
      <div id="tqOut" class="small muted">Digite um valor.</div></div>
    ${casaTxt}</section>`;
}

export function tqUpd() {
  const o = $('#tqOut');
  if (!o) return;
  const v = parseMoney($('#tq-v').value);
  o.innerHTML = v > 0 ? tempoTxt(v, $('#tq-p').value, S.month) : 'Digite um valor.';
}

export function qoHint() {
  const o = $('#qo-tempo');
  if (!o) return;
  const v = parseMoney($('#qo-v').value), i = v > 0 && tempoOn() ? tempoInfo(v, $('#qo-p').value, S.month) : null;
  o.textContent = i ? `⏱ ${fH(i.h)} de trabalho${i.hs ? ` · ${fH(i.hs)} da sobra` : ''}` : '';
}

export function tempoTxt(v, pid, m) {
  const i = tempoInfo(v, pid, m);
  if (!i) return '<span class="muted">Sem salário cadastrado para essa pessoa.</span>';
  const { t, h, hs, ps, quem } = i;
  const a = `<div><b class="num">${money(v)}</b> = <b>${fH(h)}</b> de trabalho de ${esc(quem)} ${fDias(h) ? `<span class="muted">(${fDias(h)})</span>` : ''}</div>`;
  if (!(t.sobra > 0)) return a + `<div style="color:var(--bad)">Os fixos e parcelas já levam todo o salário: esse dinheiro não sobra, ele sai do vermelho.</div>`;
  const b = `<div>Mas depois dos fixos sobram ${money(t.sobra)} por mês. Isso é <b>${pct(ps).replace(',00', '')}</b> da sobra: na prática são <b>${fH(hs)}</b> de trabalho só para juntar esse valor ${fDias(hs) ? `<span class="muted">(${fDias(hs)})</span>` : ''}.</div>`;
  const c = ps >= 1 ? `<div style="color:var(--bad)">É mais do que sobra no mês inteiro.</div>` : '';
  return a + b + c;
}

/* ---------- tela de entrada (Gate) ---------- */
export function vGate() {
  const brand = `<div class="brandbig"><div class="brand-mark" aria-hidden="true">R$</div><h1>Caixa em Dia</h1></div>`;
  const box = inner => `<div class="gate">${brand}${inner}</div>`;
  const hasLocal = !!loadLocal();
  const localBtn = `<button type="button" class="btn" data-act="uselocal">${hasLocal ? 'Continuar com dados deste aparelho' : 'Usar sem conta (neste aparelho)'}</button>`;
  if (S.phase === 'offline') return box(`<div class="panel"><h2>Sem internet</h2><p style="margin:0">Para entrar na conta da casa o app precisa de internet. Você também pode usar o app salvando os dados só neste aparelho.</p><div class="btnrow"><button class="btn primary" data-act="reload">Tentar de novo</button>${localBtn}</div></div>`);
  if (S.phase === 'config') return box(`<div class="panel"><h2>Falta ligar ao Firebase</h2><p style="margin:0">Preencha o arquivo <b>config.js</b> com os dados do seu projeto no Firebase (passo 4 do LEIAME) ou use o app direto neste aparelho.</p><div class="btnrow">${localBtn}</div></div>`);
  if (S.phase === 'retry') return box(`<div class="panel"><h2>Não consegui abrir a sua casa</h2><p style="margin:0">${esc(S.gateErr || '')} Seus dados continuam guardados. Confira a internet e tente de novo.</p><div class="btnrow"><button class="btn primary" data-act="reload">Tentar de novo</button><button class="btn" data-act="logout">Sair</button></div></div>`);
  if (S.phase === 'loading') return box(`<div class="panel"><p style="margin:0" class="muted">Carregando…</p></div>`);
  if (S.phase === 'login') {
    const m = S.authMode, inv = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('c') : null;
    const title = m === 'signup' ? 'Criar conta' : m === 'forgot' ? 'Trocar a senha' : 'Entrar';
    return box(`${inv && m !== 'forgot' ? `<div class="banner info"><p>Você recebeu um convite para entrar numa casa. ${m === 'signup' ? 'Crie sua conta' : 'Entre ou crie sua conta'} para continuar.</p></div>` : ''}
    <form class="panel gateform" data-f="${m}" novalidate>
      <h2>${title}</h2>
      ${m === 'signup' ? `<label class="fld"><span>Seu nome</span><input id="g-nome" name="nome" autocomplete="given-name" placeholder="Como a casa te chama" value="${esc(S.uname)}"></label>` : ''}
      <label class="fld"><span>E-mail</span><input id="g-email" name="email" type="email" autocomplete="email" inputmode="email" required></label>
      ${m !== 'forgot' ? `<label class="fld"><span>Senha</span><input id="g-senha" name="senha" type="password" autocomplete="${m === 'signup' ? 'new-password' : 'current-password'}" minlength="${m === 'signup' ? 8 : 6}" required>${m === 'signup' ? '<span class="help">Pelo menos 8 caracteres, com letras e números.</span>' : ''}</label>` : '<p class="help">Enviamos um link para você criar uma senha nova.</p>'}
      <p class="err" role="alert"></p>
      <button type="submit" class="btn primary" style="justify-content:center">${m === 'signup' ? 'Criar conta' : m === 'forgot' ? 'Enviar link' : 'Entrar'}</button>
      <div class="btnrow" style="justify-content:space-between">${m === 'login' ? '<button type="button" class="link" data-act="authmode" data-v="signup">Criar conta</button><button type="button" class="link" data-act="authmode" data-v="forgot">Esqueci a senha</button>' : '<button type="button" class="link" data-act="authmode" data-v="login">Já tenho conta</button>'}</div>
    </form>
    <div style="text-align:center"><button type="button" class="link" data-act="uselocal">${hasLocal ? 'Continuar só neste aparelho' : 'Usar sem conta (exemplo ou só neste aparelho)'}</button></div>`);
  }
  if (S.phase === 'casa') {
    const code = (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('c') || '' : '').toUpperCase();
    const join = `<form class="panel gateform" data-f="join" novalidate><h2>Entrar numa casa</h2><p class="help" style="margin-top:-6px">Use o código que a outra pessoa gerou em Ajustes.</p>
      <label class="fld"><span>Código de convite</span><input id="g-codigo" name="codigo" class="codein" maxlength="8" autocomplete="off" autocapitalize="characters" value="${esc(code)}" placeholder="ABC234"></label>
      <p class="err" role="alert"></p><button type="submit" class="btn ${code ? 'primary' : ''}" style="justify-content:center">Entrar na casa</button></form>`;
    const create = `<form class="panel gateform" data-f="create" novalidate><h2>Criar a casa</h2><p class="help" style="margin-top:-6px">Para quem está começando. Depois você convida o resto da casa.</p>
      <label class="fld"><span>Nome da casa</span><input id="g-casa" name="casa" placeholder="Ex.: Casa Rafael e Naiana" value=""></label>
      <p class="err" role="alert"></p><button type="submit" class="btn ${code ? '' : 'primary'}" style="justify-content:center">Criar a casa</button></form>`;
    return box(`<div class="panel"><h2>Olá${S.uname ? ', ' + esc(S.uname) : ''}!</h2><label class="fld"><span>Seu nome no app</span><input id="g-meunome" value="${esc(S.uname)}" autocomplete="given-name"></label><p class="help">Aparece nos lançamentos que você fizer ("por ${esc(S.uname || 'você')}").<p></div>
      ${code ? join + create : create + join}
      <div><button class="link" data-act="logout">Sair (${esc(S.fb?.email || '')})</button></div>`);
  }
  return '';
}

/* ---------- ciclo de renderização ---------- */
let VIEWS = {};
let postRenderHooks = {};
export function registerViews(views, hooks = {}) {
  VIEWS = views;
  postRenderHooks = hooks;
}

let rq = 0;
export function scheduleRender() {
  if (typeof requestAnimationFrame === 'undefined') return;
  if (rq) return;
  rq = requestAnimationFrame(() => {
    rq = 0;
    const ae = document.activeElement, main = $('#main');
    if (ae && main && main.contains(ae) && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName) && ae.id !== 'fQ') {
      S.pend = true;
      return;
    }
    const q = ae && ae.id === 'fQ' ? ae.selectionStart : null;
    render();
    if (q != null) {
      const n = $('#fQ');
      if (n) { n.focus(); n.setSelectionRange(q, q); }
    }
  });
}

export function render() {
  if (typeof document === 'undefined') return;
  const main = $('#main');
  if (!main) return;
  const inApp = S.phase === 'app';
  const tw = $('#tabsWrap'), mn = $('#monthNav'), ss = $('#saveState'), fab = $('#fab');
  if (tw) tw.hidden = !inApp;
  if (mn) mn.hidden = !inApp;
  if (ss) ss.hidden = !inApp;
  if (!inApp) {
    if (fab) fab.hidden = true;
    main.innerHTML = vGate();
    return;
  }
  setSave();
  renderTabs();
  const cm = $('#curMonth');
  if (cm) cm.textContent = ymL(S.month).replace('/', ' ');
  const v = VIEWS[S.tab] || VIEWS.mes;
  if (v) main.innerHTML = `<div class="stack">${topBanner()}${v()}</div>`;
  if (postRenderHooks[S.tab]) postRenderHooks[S.tab]();
}
