import { S, MES, EXP } from '../state.js';
import {
  curYM, ymOf, isDate, addM, diffM, ymL, ymLong, fD, money, short, pct, sum,
  acc, pay, invOf, pname, firstYM, lastYM, instAmt,
  summary, carry, flow, portfolio, loanInfo
} from '../calc.js';
import { esc, SUBS, cutTag, whoTag } from './utils.js';

export function vMais() {
  const k = SUBS.some(x => x[0] === S.sub) ? S.sub : 'rec',
    f = { rec: vRec, parc: vParc, inv: vInv, geral: vGeral }[k];
  return `<section class="panel" style="padding:12px 16px"><div class="chips" role="tablist" aria-label="O que ver">${SUBS.map(([key, l]) => `<button class="chip" role="tab" aria-selected="${k === key}" aria-pressed="${k === key}" data-act="sub" data-v="${key}">${l}</button>`).join('')}</div></section>${f()}`;
}

export function vRec() {
  const m = S.month, s = summary(m);
  const inc = S.st.incomes.filter(x => x.once ? x.from === m : true).sort((a, b) => (a.day || 99) - (b.day || 99));
  const fx = S.st.fixed.slice().sort((a, b) => (a.day || 99) - (b.day || 99));
  const row = (x, kind) => {
    const l = s.L.find(l => l.src === x);
    const active = !!l;
    const per = x.once ? `só em ${ymL(x.from)}` : `desde ${ymL(x.from)}${x.to ? ' até ' + ymL(x.to) : ''}`;
    const via = kind === 'in' ? acc(x.accountId)?.name : pay(x.pay)?.name;
    const dia = kind === 'fix' && pay(x.pay)?.type === 'card' ? 'na fatura' : x.day ? 'dia ' + x.day : '<span style="color:var(--warn)">sem dia</span>';
    return `<button class="row-i" data-act="edit" data-kind="${kind}" data-id="${x.id}" style="${active ? '' : 'opacity:.55'}"><span class="d">${esc(x.desc)}</span><span class="a num ${kind === 'in' ? 'in' : ''}">${active ? money(l.amount) : '—'}</span><span class="m">${dia} · ${esc(via || '—')} · ${esc(pname(x.personId))} · ${per} ${kind === 'fix' ? cutTag(x.cut) : ''} ${l?.ovr ? '<span class="tag">valor só deste mês</span>' : ''}</span></button>`;
  };
  const totIn = sum(inc, x => s.L.find(l => l.src === x)?.amount || 0), totFx = sum(fx, x => s.L.find(l => l.src === x)?.amount || 0);
  return `<div class="grid2">
  <section class="panel"><div class="panel-h"><h2>Entradas</h2><span class="num pos"><b>${money(totIn)}</b> em ${ymL(m)}</span></div>
    <div class="rows">${inc.map(x => row(x, 'in')).join('') || '<div class="empty">Nenhuma entrada cadastrada.</div>'}</div>
    <div style="margin-top:12px"><button class="btn" data-act="new" data-kind="in">+ Entrada</button></div></section>
  <section class="panel"><div class="panel-h"><h2>Gastos fixos</h2><span class="num"><b>${money(totFx)}</b> em ${ymL(m)}</span></div>
    <div class="rows">${fx.map(x => row(x, 'fix')).join('') || '<div class="empty">Nenhum gasto fixo cadastrado.</div>'}</div>
    <div style="margin-top:12px"><button class="btn" data-act="new" data-kind="fix">+ Gasto fixo</button></div></section></div>
  <p class="small muted" style="margin:0">Valores que se repetem todo mês. Se um mês vier diferente (a conta de luz, por exemplo), abra o item e preencha "valor só neste mês". O dia em que cai ou vence é o que permite saber se há dinheiro no dia de cada cartão. Empréstimos têm lugar próprio em <button class="link" data-act="tab" data-tab="parc">Parcelas e empréstimos</button>.</p>`;
}

export function vParc() {
  const m = S.month, its = S.st.items.filter(x => (x.inst?.tot || 1) > 1 && isDate(x.date));
  const rows = its.map(x => {
    const f0 = firstYM(x), k = diffM(f0, m), cur = x.inst.cur, tot = x.inst.tot, n = cur + k, end = lastYM(x), p = pay(x.pay);
    let sit, cls = '';
    if (k < 0) { sit = 'ainda não começou'; }
    else if (n > tot) { sit = 'quitada'; cls = 'good'; }
    else if (n === tot) { sit = 'última parcela'; cls = 'good'; }
    else { const f = tot - n; sit = f === 1 ? 'falta 1' : 'faltam ' + f; cls = 'warn'; }
    let rest = 0;
    for (let j = Math.max(n, cur); j <= tot; j++) rest += instAmt(x, j);
    const ab = x.refund && +x.refund.amount > 0 ? +x.refund.amount : 0;
    return { x, n, tot, end, p, sit, cls, rest, ab, active: k >= 0 && n <= tot, amt: k >= 0 && n <= tot ? instAmt(x, n) : instAmt(x, Math.min(Math.max(n, 1), tot)), fat: k >= 0 && n <= tot ? m : null };
  }).sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1) || (a.end < b.end ? 1 : -1));
  const act = rows.filter(r => r.active), totM = sum(act, r => r.amt), totAb = sum(act, r => r.ab), totRest = sum(rows, r => r.rest);
  const loans = S.st.loans.map(x => ({ x, ...loanInfo(x, m), p: pay(x.pay) }));
  const actL = loans.filter(r => r.active), totL = sum(actL, r => +r.x.parcela), restL = sum(loans, r => r.left);
  const months = Array.from({ length: 12 }, (_, i) => addM(m, i));
  const vC = months.map(mm => sum(its, x => {
    const k = diffM(firstYM(x), mm), n = x.inst.cur + k;
    return k >= 0 && n <= x.inst.tot ? instAmt(x, n) - (x.refund ? +x.refund.amount || 0 : 0) : 0;
  }));
  const vL = months.map(mm => sum(S.st.loans, x => { const li = loanInfo(x, mm); return li.active ? +x.parcela : 0; }));
  const mx = Math.max(...months.map((_, i) => vC[i] + vL[i]), 1);
  const cols = months.map((mm, i) => {
    const t = vC[i] + vL[i];
    return `<div class="col" title="${ymL(mm)}: compras ${money(vC[i])} · empréstimos ${money(vL[i])}"><span class="val num">${t ? short(t) : ''}</span><span class="bars" style="height:${t / mx * 100}%"><i style="flex:${vL[i]};background:var(--c-loan)"></i><i style="flex:${vC[i]};background:var(--c-com)"></i></span><span class="t">${MES[+mm.slice(5) - 1]}</span></div>`;
  }).join('');
  const loanRows = loans.map(r => `<tr class="clk" data-act="edit" data-kind="loan" data-id="${r.x.id}"><td>${esc(r.x.desc)}</td><td class="l">${esc(r.p?.name || '—')}</td><td class="num">${money(r.x.amount)}</td><td class="num">${money(r.x.parcela)}</td><td class="num">${r.active ? `${r.n}/${r.tot}` : r.done ? 'quitado' : '—'}</td><td>${r.end ? ymL(r.end) : '—'}</td><td class="num">${r.left ? money(r.left) : '—'}</td><td class="num">${r.juros != null ? money(r.juros) : '—'}</td><td class="num">${r.i ? pct(r.i) + ' a.m.' : r.i === 0 ? 'sem juros' : '—'}</td><td class="num">${r.i ? pct(Math.pow(1 + r.i, 12) - 1) + ' a.a.' : '—'}</td></tr>`).join('') || `<tr><td colspan="10" class="empty">Nenhum empréstimo. ${S.ro ? '' : '<button class="link" data-act="new" data-kind="emp">Lançar empréstimo</button>'}</td></tr>`;
  return `<section class="panel"><div class="panel-h"><h2>Já comprometido nos próximos meses</h2><span class="small muted">sem contar compras novas, descontando o que outras pessoas pagam</span></div>
    <div class="cols">${cols}</div><div class="keys"><span><i class="dot" style="background:var(--c-com)"></i>Compras parceladas</span><span><i class="dot" style="background:var(--c-loan)"></i>Empréstimos</span></div></section>
  <section class="stats" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))">
    <div class="stat"><span class="eyebrow">Parcelas de compras em ${ymL(m)}</span><span class="v num">${money(totM)}</span><span class="small muted">${act.length} compras${totAb ? ` · outras pessoas pagam ${money(totAb)}` : ''}</span></div>
    <div class="stat"><span class="eyebrow">Empréstimos em ${ymL(m)}</span><span class="v num">${money(totL)}</span><span class="small muted">${actL.length} ${actL.length === 1 ? 'empréstimo' : 'empréstimos'}</span></div>
    <div class="stat"><span class="eyebrow">Ainda falta pagar</span><span class="v num">${money(totRest + restL)}</span><span class="small muted">a partir de ${ymL(m)}, contando este mês</span></div></section>
  <section class="stack" style="gap:10px"><div class="panel-h" style="margin:0"><h2>Compras parceladas</h2>${S.ro ? '' : '<button class="btn sm" data-act="add">+ Compra</button>'}</div>
  <div class="tablewrap"><table><thead><tr><th>Compra</th><th class="l">Onde</th><th>Total</th><th>Parcela</th><th class="l">Situação em ${ymL(m)}</th><th>Valor</th><th>Mês da fatura</th><th>Termina em</th><th>Ainda falta</th><th>Outra pessoa paga</th></tr></thead>
  <tbody>${rows.map(r => `<tr class="clk" data-act="edit" data-kind="var" data-id="${r.x.id}"><td>${esc(r.x.desc)}</td><td class="l">${esc(r.p?.name || '—')}</td><td class="num">${r.x.total ? money(r.x.total) : money(sum(Array.from({ length: r.tot }, (_, j) => j + 1), j => instAmt(r.x, j)))}</td><td class="num">${r.active ? `${r.n}/${r.tot}` : '—'}</td><td class="l"><span class="pill ${r.cls}">${r.sit}</span></td><td class="num">${money(r.amt)}</td><td>${r.fat ? ymL(r.fat) : '—'}</td><td>${ymL(r.end)}</td><td class="num">${r.rest > 0 ? money(r.rest) : '—'}</td><td class="num">${r.ab ? `${esc(r.x.refund.who || '')} · ${money(r.ab)}` : '—'}</td></tr>`).join('') || '<tr><td colspan="10" class="empty">Nenhuma compra parcelada. Ao lançar um gasto, marque "Compra parcelada".</td></tr>'}</tbody></table></div></section>
  <section class="stack" style="gap:10px"><div class="panel-h" style="margin:0"><h2>Empréstimos</h2>${S.ro ? '' : '<button class="btn sm" data-act="new" data-kind="emp">+ Empréstimo</button>'}</div>
  <div class="tablewrap"><table><thead><tr><th>Empréstimo</th><th class="l">Como paga</th><th>Recebido</th><th>Parcela</th><th>Em ${ymL(m)}</th><th>Termina em</th><th>Ainda falta</th><th>Juros total</th><th>Taxa</th><th>Por ano</th></tr></thead><tbody>${loanRows}</tbody></table></div>
  <p class="small muted" style="margin:0">O dinheiro recebido entra na conta mas não conta como renda. A taxa é calculada pela tabela Price, a partir do valor recebido, da parcela e do número de parcelas.</p></section>`;
}

export function vInv() {
  const pf = portfolio(null), rows = S.st.invs.map(i => pf[i.id]), m = S.month;
  const tot = sum(rows, r => r.saldo), ren = sum(rows, r => r.ren);
  const mv = S.st.moves.filter(x => isDate(x.date) && ymOf(x.date) === m).sort((a, b) => a.date < b.date ? -1 : 1);
  const K = k => sum(mv.filter(x => x.kind === k), x => +x.amount);
  const KL = { apl: 'Aplicação', res: 'Resgate', ren: 'Rendimento' };
  const mvRows = mv.map(x => {
    const iv = invOf(x.invId);
    return `<button class="row-i" data-act="edit" data-kind="${x.kind}" data-id="${x.id}"><span class="d">${KL[x.kind]} · ${esc(iv?.name || '—')}</span><span class="a num ${x.kind === 'ren' ? (x.amount < 0 ? '' : 'in') : 'mv'}">${x.kind === 'ren' ? (x.amount < 0 ? '− ' : '+ ') + money(Math.abs(x.amount)) : money(x.amount)}</span><span class="m">${fD(x.date)} · ${x.kind === 'ren' ? 'fica no investimento' : esc((x.kind === 'apl' ? 'saiu da ' : 'voltou para a ') + (acc(x.accId)?.name || '—'))} ${whoTag(x)}</span></button>`;
  }).join('');
  const act = S.ro ? '' : `<div class="btnrow"><button class="btn sm primary" data-act="newmov" data-k="apl">Aplicar</button><button class="btn sm" data-act="newmov" data-k="res">Resgatar</button><button class="btn sm" data-act="newmov" data-k="ren">Rendimento</button><button class="btn sm" data-act="newinv">+ Investimento</button></div>`;
  return `<section class="stats" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))">
    <div class="stat"><span class="eyebrow">Total investido hoje</span><span class="v num">${money(tot)}</span><span class="small muted">${rows.length} ${rows.length === 1 ? 'investimento' : 'investimentos'}</span></div>
    <div class="stat"><span class="eyebrow">Rendimento acumulado</span><span class="v num ${ren < 0 ? 'neg' : 'pos'}">${money(ren)}</span></div>
    <div class="stat"><span class="eyebrow">Aplicado em ${ymL(m)}</span><span class="v num">${money(K('apl'))}</span></div>
    <div class="stat"><span class="eyebrow">Resgatado em ${ymL(m)}</span><span class="v num">${money(K('res'))}</span></div></section>
  <section class="stack" style="gap:10px"><div class="panel-h" style="margin:0"><h2>Carteira</h2>${act}</div>
  <div class="tablewrap"><table><thead><tr><th>Investimento</th><th class="l">Tipo</th><th class="l">De quem</th><th>Aplicado</th><th>Resgatado</th><th>Rendimento</th><th>Saldo</th><th>Rendeu</th></tr></thead>
  <tbody>${rows.map(r => {
    const base = r.apl - r.res;
    return `<tr class="clk" data-act="edit" data-kind="inv" data-id="${r.inv.id}"><td>${esc(r.inv.name)}</td><td class="l">${esc(r.inv.kind || '—')}</td><td class="l">${esc(pname(r.inv.personId))}</td><td class="num">${money(r.apl)}</td><td class="num">${money(r.res)}</td><td class="num ${r.ren < 0 ? 'neg' : 'pos'}">${money(r.ren)}</td><td class="num"><b>${money(r.saldo)}</b></td><td class="num">${base > 0 ? pct(r.ren / base) : '—'}</td></tr>`;
  }).join('') || '<tr><td colspan="8" class="empty">Nenhum investimento. Use "Aplicar" para registrar o primeiro.</td></tr>'}</tbody>
  ${rows.length > 1 ? `<tfoot><tr><td>Total</td><td></td><td></td><td class="num">${money(sum(rows, r => r.apl))}</td><td class="num">${money(sum(rows, r => r.res))}</td><td class="num">${money(ren)}</td><td class="num">${money(tot)}</td><td></td></tr></tfoot>` : ''}</table></div></section>
  <section class="panel"><div class="panel-h"><h2>Movimentos de ${ymLong(m)}</h2></div><div class="rows">${mvRows || '<div class="empty small">Nada neste mês.</div>'}</div>
  <p class="help" style="margin-top:10px">Aplicar tira dinheiro da conta e resgatar devolve, mas nenhum dos dois é gasto ou renda. O rendimento fica dentro do investimento até você resgatar. Para não fazer conta, use "Rendimento" e informe o saldo que aparece no app da corretora.</p></section>`;
}

export function vGeral() {
  const st = S.st, cm = curYM();
  let end = addM(st.start, 11);
  if (end < addM(cm, 2)) end = addM(cm, 2);
  const ms = [];
  for (let m = st.start; m <= end; m = addM(m, 1)) ms.push(m);
  const rows = ms.map(m => {
    const s = summary(m), c = carry(m), fl = c !== null ? flow(m) : null;
    const unpaid = fl ? fl.cards.filter(x => !x.bill) : [], bad = unpaid.filter(x => x.bal < 0).length, paid = fl ? fl.cards.filter(x => x.bill).length : 0;
    const sit = st.closed[m] ? '<span class="pill">fechado</span>' : m === cm ? '<span class="pill info">mês atual</span>' : m < cm ? '<span class="pill warn">não fechado</span>' : c !== null ? '<span class="pill">próximo</span>' : '<span class="pill">futuro</span>';
    const cut = sum(s.L.filter(l => l.cut === 'cor' && EXP[l.kind]), l => l.amount);
    const cardsCell = !fl ? '—' : !fl.cards.length ? '<span class="muted">—</span>' : bad ? `<span class="pill bad">⚠ ${bad} sem dinheiro</span>` : paid === fl.cards.length ? '<span class="pill">pagas</span>' : '<span class="pill good">✔ ok</span>';
    return `<tr class="clk ${m === S.month ? 'sel' : ''}" data-act="goto" data-m="${m}"><td><b>${ymL(m)}</b></td><td class="l">${sit}</td><td class="num ${c === null ? 'na' : ''}">${c === null ? '—' : money(c)}</td><td class="num">${money(s.inT + s.dev)}</td><td class="num">${money(s.out)}</td><td class="num ${s.result < 0 ? 'neg' : 'pos'}">${money(s.result)}</td><td class="num ${c === null ? 'na' : (c + s.cash < 0 ? 'neg' : '')}"><b>${c === null ? '—' : money(c + s.cash)}</b></td><td class="l">${cardsCell}</td><td class="num">${money(s.inst + s.loanP)}</td><td class="num">${money(cut)}</td></tr>`;
  }).join('');
  return `<section class="panel"><div class="panel-h"><h2>Visão geral</h2><span class="small muted">toque num mês para abrir</span></div>
    <p style="margin:0 0 4px;max-width:70ch">A sobra só passa de um mês para o seguinte: o mês atual mostra o que sobra para o próximo, e os meses depois disso só ganham saldo quando você fecha o anterior. Nos meses futuros aparece apenas o que já é certo: entradas e fixos cadastrados, parcelas e empréstimos.</p></section>
  <div class="tablewrap"><table><thead><tr><th>Mês</th><th class="l">Situação</th><th>Veio do anterior</th><th>Entradas</th><th>Gastos</th><th>Resultado</th><th>Sobra p/ o próximo</th><th class="l">Cartões no dia</th><th>Parcelas</th><th>Dava p/ cortar</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="small muted" style="margin:0">Resultado é renda menos gastos. A sobra também conta empréstimos recebidos, aplicações, resgates e ajustes.</p>`;
}
