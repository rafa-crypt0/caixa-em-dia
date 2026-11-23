import { S, EXP, CUTS } from '../state.js';
import {
  curYM, addM, ymL, ymLong, fD, wday, round2, money, short,
  acc, pname, isWallet, expVal,
  summary, carry, flow, accPanel, whyNoCarry, splitTypes, endAcc
} from '../calc.js';
import { esc, $ } from './utils.js';

export function vMes() {
  const m = S.month, s = summary(m), c = carry(m), fl = flow(m), ac = accPanel(m), isCur = m === curYM(), closed = S.st.closed[m];
  const next = c === null ? null : c + s.cash;
  const cls = next === null ? 'na' : next < 0 ? 'neg' : 'pos';
  const why = c === null ? `<div class="banner info"><p>${esc(whyNoCarry(m))}</p>${(() => {
    let q = S.st.start;
    while (q < m && (S.st.closed[q] || q === curYM())) q = addM(q, 1);
    return q < m ? `<button class="btn" data-act="goto" data-m="${q}">Ir para ${ymL(q)}</button>` : '';
  })()}</div>` : '';
  const endT = c === null ? null : splitTypes(endAcc(m));
  const tickets = fl.cards.length ? fl.cards.map(t => {
    const b = t.bill;
    let status, cls2 = '';
    if (b) { status = `<span class="pill good">✔ paga</span>`; cls2 = 'paid'; }
    else if (!fl.hasCarry) status = `<span class="pill">sem saldo inicial</span>`;
    else if (t.bal >= 0) { status = `<span class="pill good">✔ dá para pagar</span>`; cls2 = 'good'; }
    else { status = `<span class="pill bad">⚠ falta ${money(-t.bal)}</span>`; cls2 = 'bad'; }
    const d = b ? round2(b.amount - t.inv) : 0;
    const diffTxt = b ? (Math.abs(d) < 0.01 ? '<span class="small pos">bateu com o calculado</span>' : `<span class="small ${d > 0 ? 'neg' : 'pos'}">pagou ${money(Math.abs(d))} ${d > 0 ? 'a mais' : 'a menos'} que o calculado</span>`) : '';
    return `<div class="ticket ${cls2}">
      <div class="tk-top"><div><div class="eyebrow">Fatura de ${ymL(m)}</div><div class="tk-name">${esc(t.card.name)}</div></div><div class="tk-due">${b ? 'Paga em' : 'Vencimento'}<b>${fD(t.due)}</b></div></div>
      <div class="tk-mid"><span class="tk-amt num">${money(b ? b.amount : t.inv)}</span><span class="small muted">${b ? `calculado ${money(t.inv)} · ` : ''}paga pela ${esc(acc(t.card.accountId)?.name || '—')}</span>${diffTxt}</div>
      <div class="tk-bot"><span>No banco no dia: <b class="num">${fl.hasCarry ? money(t.bal) : '—'}</b></span>${status}</div>
      <div class="tk-act"><button class="link" data-act="filter" data-k="pay" data-v="c:${t.card.id}">ver compras</button><button class="btn sm ${b ? '' : 'primary'}" data-act="paybill" data-card="${t.card.id}" data-ym="${m}">${b ? 'Editar pagamento' : 'Marcar como paga'}</button></div></div>`;
  }).join('') : `<div class="empty small">Nenhuma fatura de cartão vence neste mês.${S.st.cards.length ? '' : ' Cadastre seus cartões em <b>Ajustes</b>.'}</div>`;
  const outL = s.L.filter(l => EXP[l.kind]), byCut = {};
  for (const l of outL) { const k = l.cut || 'none'; byCut[k] = (byCut[k] || 0) + expVal(l); }
  const order = ['ess', 'com', 'red', 'cor', 'none'], tot = s.out || 1;
  const bar = order.filter(k => byCut[k] > 0).map(k => `<button style="flex:${byCut[k]};background:var(${k === 'none' ? '--c-none' : CUTS[k].c})" data-act="filter" data-k="cut" data-v="${k}" title="${k === 'none' ? 'Sem classificação' : CUTS[k].l}: ${money(byCut[k])}" aria-label="${k === 'none' ? 'Sem classificação' : CUTS[k].l}"></button>`).join('');
  const leg = order.map(k => `<button data-act="filter" data-k="cut" data-v="${k}"><span class="dot" style="background:var(${k === 'none' ? '--c-none' : CUTS[k].c})"></span><span>${k === 'none' ? 'Sem classificação' : CUTS[k].l} <span class="hint">· ${k === 'none' ? 'você ainda não disse' : CUTS[k].h}</span></span><span class="num muted small">${Math.round((byCut[k] || 0) / tot * 100)}%</span><b class="num">${money(byCut[k] || 0)}</b></button>`).join('');
  const byCat = {};
  for (const l of outL) byCat[l.cat] = (byCat[l.cat] || 0) + expVal(l);
  const cats = Object.entries(byCat).filter(x => x[1] > 0.005).sort((a, b) => b[1] - a[1]), mx = cats[0]?.[1] || 1;
  const catHtml = cats.length ? cats.map(([k, v]) => `<button class="hbar" data-act="filter" data-k="cat" data-v="${esc(k)}"><span class="lab">${esc(k)}</span><span class="track"><span class="fill" style="display:block;width:${Math.max(2, v / mx * 100)}%"></span></span><span class="num small">${money(v)}</span></button>`).join('') : `<div class="empty small">Sem gastos neste mês.</div>`;
  const byP = {};
  for (const l of outL) byP[l.person || ''] = (byP[l.person || ''] || 0) + expVal(l);
  const pHtml = Object.entries(byP).filter(x => x[1] > 0.005).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<dt><button class="link" data-act="filter" data-k="person" data-v="${k || '_'}">${esc(pname(k))}</button></dt><dd class="num">${money(v)}</dd>`).join('');
  const accHtml = ac.rows.filter(r => r.i || r.o || (ac.ok && r.start)).map(r => `<dt>${esc(r.a.name)} <span class="small muted">${isWallet(r.a) ? 'carteira' : 'banco'} · entra ${money(r.i)} · sai ${money(r.o)}</span></dt><dd class="num ${(ac.ok ? r.end : r.net) < 0 ? 'neg' : ''}">${ac.ok ? 'fica ' + money(r.end) : (r.net < 0 ? 'falta ' : 'sobra ') + money(Math.abs(r.net))}</dd>`).join('') || '<dt class="muted">Sem movimento.</dt><dd></dd>';
  const trHtml = ac.tr.map(t => `<div class="transfer">↪ Passar <b class="num">${money(t.v)}</b> da <b>${esc(t.from.name)}</b> para a <b>${esc(t.to.name)}</b><button class="link" data-act="newtr" data-from="${t.from.id}" data-to="${t.to.id}" data-v="${round2(t.v)}">lançar</button></div>`).join('') + (ac.uncovered > 0.005 ? `<div class="transfer" style="background:var(--bad-bg)">⚠ Nem somando as contas dá: faltam <b class="num">${money(ac.uncovered)}</b>.</div>` : '');
  const undated = (fl.undIn || fl.undOut) ? `<p class="small muted" style="margin:8px 0 0">Fora do gráfico por não ter dia: ${fl.undIn ? `entradas ${money(fl.undIn)}` : ''}${fl.undIn && fl.undOut ? ' · ' : ''}${fl.undOut ? `gastos ${money(fl.undOut)}` : ''}. <button class="link" data-act="tab" data-tab="rec">Colocar o dia</button></p>` : '';
  const closeBox = m <= curYM() ? (closed ? `<div class="banner info"><p><b>${ymLong(m)} está fechado.</b> ${closed.legacyReal != null ? `Vocês informaram ${money(closed.legacyReal)} no fim do mês; é isso que passa para ${ymL(addM(m, 1))}.` : `O saldo de cada conta no fim do mês passa para ${ymL(addM(m, 1))}.`}</p><button class="btn" data-act="reopen">Reabrir mês</button></div>`
    : `<div class="panel" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><p style="margin:0;flex:1 1 280px">${isCur ? 'Quando o mês terminar, feche-o' : 'Este mês já passou. Feche-o'} para a sobra seguir para ${ymL(addM(m, 1))}. Ao fechar, dá para conferir cada conta com o banco.</p><button class="btn primary" data-act="close" ${c === null ? 'disabled title="Feche os meses anteriores primeiro"' : ''}>Fechar ${ymL(m)}</button></div>`) : '';
  const eqRow = (lab, v, show = true) => show ? `<dt>${lab}</dt><dd>${money(v)}</dd>` : '';
  return `${why}
  <section class="hero">
    <div class="big">
      <div class="eyebrow">${next === null ? 'Resultado do mês' : `Sobra para ${ymL(addM(m, 1))}`}</div>
      <div class="value num ${cls}">${money(next === null ? s.result : next)}</div>
      ${endT ? `<div class="split num"><span>No banco <b>${money(endT.bank)}</b></span><span>Na carteira <b>${money(endT.wal)}</b></span></div>` : `<p>Sem a sobra do mês anterior não dá para dizer quanto fica no fim. O resultado acima é renda menos gastos de ${ymL(m)}.</p>`}
      <dl class="eq num">
        <dt>${m === S.st.start ? 'Saldo no início do mês' : 'Veio de ' + ymL(addM(m, -1))}</dt><dd>${c === null ? '—' : money(c)}</dd>
        ${eqRow('+ Entradas', s.inT)}${eqRow('+ Devolvido por terceiros', s.dev, s.dev)}
        ${eqRow('− Gastos fixos', s.fix)}${eqRow('− Gastos do dia a dia e parcelas', s.vr)}${eqRow('− Parcelas de empréstimo', s.loanP, s.loanP)}
        ${s.loanIn || s.res || s.apl || s.aj || s.adv || s.antic ? `<dt class="soft" style="grid-column:1/-1;margin-top:4px">Não é renda nem gasto</dt>` : ''}
        ${eqRow('+ Empréstimo recebido', s.loanIn, s.loanIn)}${eqRow('+ Resgatado de investimentos', s.res, s.res)}${eqRow('− Aplicado em investimentos', s.apl, s.apl)}${s.aj ? `<dt>± Ajustes de conferência</dt><dd>${money(s.aj)}</dd>` : ''}${eqRow('+ Recebido agora, conta como renda depois', s.adv, s.adv)}${eqRow('− Renda deste mês que já tinha entrado antes', s.antic, s.antic)}
        <dt class="tot">= ${next === null ? 'Resultado' : 'Sobra'}</dt><dd class="tot">${money(next === null ? s.result : next)}</dd>
      </dl>
    </div>
    <div class="stats">
      <div class="stat"><span class="eyebrow">Entradas</span><span class="v num pos">${money(s.inT + s.dev)}</span><button class="link" data-act="filter" data-k="kind" data-v="in">ver quais são →</button></div>
      <div class="stat"><span class="eyebrow">Gastos fixos</span><span class="v num">${money(s.fix)}</span><button class="link" data-act="filter" data-k="kind" data-v="fix">ver quais são →</button></div>
      <div class="stat"><span class="eyebrow">Gastos do dia a dia</span><span class="v num">${money(s.vr - s.inst)}</span><button class="link" data-act="filter" data-k="kind" data-v="var">ver quais são →</button></div>
      <div class="stat"><span class="eyebrow">Parcelas do mês</span><span class="v num">${money(s.inst + s.loanP)}</span>${s.loanP ? `<span class="small muted">compras ${money(s.inst)} · empréstimos ${money(s.loanP)}</span>` : ''}<button class="link" data-act="tab" data-tab="parc">ver parcelas →</button></div>
      ${s.receber ? `<div class="stat" style="grid-column:1/-1"><span class="eyebrow">A receber de outras pessoas</span><span class="v num" style="color:var(--accent)">${money(s.receber)}</span><button class="link" data-act="filter" data-k="kind" data-v="dev">ver quem deve →</button></div>` : ''}
    </div>
  </section>
  <section class="stack" style="gap:10px"><div class="panel-h" style="margin:0"><h2>Faturas dos cartões</h2><span class="small muted">Saldo nos bancos no dia de cada fatura (a carteira não entra)</span></div><div class="tickets">${tickets}</div></section>
  <section class="panel"><div class="panel-h"><h2>Dinheiro dia a dia</h2><button class="link" data-act="toggletable">${S.showTable ? 'esconder tabela' : 'ver em tabela'}</button></div>
    <div class="chart" id="flowChart"></div>${undated}${S.showTable ? flowTable(fl) : ''}</section>
  <div class="grid2">
    <section class="panel"><div class="panel-h"><h2>Dá para cortar?</h2><span class="small muted">${money(s.out)} em gastos</span></div><div class="stackbar">${bar}</div><div class="legend">${leg}</div></section>
    <section class="panel"><div class="panel-h"><h2>Para onde foi</h2><span class="small muted">toque para ver os lançamentos</span></div><div class="hbars">${catHtml}</div></section>
    <section class="panel"><div class="panel-h"><h2>Contas</h2><span class="small muted">${ac.ok ? 'saldo no fim do mês' : 'movimento do mês'}</span></div><dl class="kv">${accHtml}</dl><div class="stack" style="gap:8px;margin-top:12px">${trHtml}</div></section>
    <section class="panel"><div class="panel-h"><h2>Quem gastou</h2></div><dl class="kv">${pHtml || '<dt class="muted">Sem gastos.</dt><dd></dd>'}</dl></section>
  </div>
  ${closeBox}`;
}

export function flowTable(fl) {
  return `<div class="tablewrap" style="margin-top:12px;max-height:340px"><table><thead><tr><th>Dia</th><th>Entra</th><th>Sai</th><th>Banco</th><th>Carteira</th><th>Total</th></tr></thead><tbody><tr><td>Início</td><td></td><td></td><td class="num">${fl.hasCarry ? money(fl.b0) : '—'}</td><td class="num">${fl.hasCarry ? money(fl.w0) : '—'}</td><td class="num">${fl.hasCarry ? money(fl.base) : '—'}</td></tr>${fl.days.filter((d, i) => d.i || d.o || d.bank !== (i ? fl.days[i - 1].bank : fl.b0)).map(d => `<tr><td>${fD(d.ds)} ${wday(d.ds)}</td><td class="num pos">${d.i ? money(d.i) : ''}</td><td class="num">${d.o ? money(d.o) : ''}</td><td class="num ${d.bank < 0 ? 'neg' : ''}">${money(d.bank)}</td><td class="num ${d.wal < 0 ? 'neg' : ''}">${money(d.wal)}</td><td class="num ${d.bal < 0 ? 'neg' : ''}">${money(d.bal)}</td></tr>`).join('')}</tbody></table></div>`;
}

export function drawFlow() {
  const box = $('#flowChart');
  if (!box) return;
  const fl = flow(S.month), W = Math.max(300, box.clientWidth), H = 250, pl = 58, pr = 14, pt = 22, pb = 28;
  const vals = fl.days.map(d => d.bal).concat([fl.base, 0]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1) { hi += 100; lo -= 100; }
  const span = hi - lo, step = Math.pow(10, Math.floor(Math.log10(span / 4)));
  const st = [1, 2, 2.5, 5, 10].map(k => k * step).find(k => span / k <= 5) || step * 10;
  lo = Math.floor(lo / st) * st;
  hi = Math.ceil(hi / st) * st;
  const n = fl.days.length, X = d => pl + (d - 0.5) / n * (W - pl - pr), Y = v => pt + (hi - v) / (hi - lo) * (H - pt - pb);
  let g = '';
  for (let v = lo; v <= hi + 1e-6; v += st) g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${pl - 8}" y="${Y(v) + 4}" text-anchor="end">${short(v)}</text>`;
  const pts = [[pl, Y(fl.base)]].concat(fl.days.map(d => [X(d.d), Y(d.bal)]));
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = path + ` L ${pts[pts.length - 1][0].toFixed(1)} ${Y(Math.max(lo, 0))} L ${pl} ${Y(Math.max(lo, 0))} Z`;
  const neg = lo < 0 ? `<rect x="${pl}" y="${Y(0)}" width="${W - pl - pr}" height="${Y(lo) - Y(0)}" fill="var(--bad-bg)" opacity=".7"/>` : '';
  const xt = [1, 5, 10, 15, 20, 25, n].filter((v, i, a) => a.indexOf(v) === i).map(d => `<text class="axis" x="${X(d)}" y="${H - 8}" text-anchor="middle">${d}</text>`).join('');
  const marks = fl.cards.map(c => {
    const d = +c.due.slice(8), x = X(d);
    return `<line x1="${x}" x2="${x}" y1="${pt - 6}" y2="${H - pb}" stroke="var(--ink-3)" stroke-dasharray="3 3"/><text class="axis" x="${x}" y="${pt - 10}" text-anchor="middle" style="font-weight:700;fill:var(--ink-2)">${esc(c.card.name)} · ${d}</text>`;
  }).join('');
  const dots = fl.days.filter(d => d.bal < 0 && (d.i || d.o)).map(d => `<circle cx="${X(d.d)}" cy="${Y(d.bal)}" r="4" fill="var(--bad)" stroke="var(--surface)" stroke-width="2"/>`).join('');
  const endD = fl.days[n - 1];
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Dinheiro nos bancos e na carteira ao longo de ${ymLong(S.month)}">
    <g class="grid">${g}</g>${neg}
    <line x1="${pl}" x2="${W - pr}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--ink-3)" stroke-width="1"/>
    ${marks}<path d="${area}" fill="var(--accent)" opacity=".1"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>${dots}
    <circle cx="${X(n)}" cy="${Y(endD.bal)}" r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>
    ${xt}<line id="xh" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="var(--ink-2)" opacity="0"/><circle id="xp" r="5" fill="var(--surface)" stroke="var(--accent)" stroke-width="2" opacity="0"/>
    <rect x="${pl}" y="0" width="${W - pl - pr}" height="${H}" fill="transparent" id="hit"/></svg><div class="tip" id="tip"></div>
    ${fl.hasCarry ? '<p class="small muted" style="margin:6px 0 0">Bancos e carteira somados. Toque no gráfico para ver cada um.</p>' : '<p class="small muted" style="margin:6px 0 0">Sem a sobra do mês anterior, o gráfico começa do zero: mostra só o movimento deste mês.</p>'}`;
  const hit = box.querySelector('#hit'), tip = box.querySelector('#tip'), xh = box.querySelector('#xh'), xp = box.querySelector('#xp');
  const mv = e => {
    const r = box.querySelector('svg').getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width);
    let d = Math.round((x - pl) / ((W - pl - pr) / n) + 0.5);
    d = Math.max(1, Math.min(n, d));
    const o = fl.days[d - 1], px = X(d), py = Y(o.bal);
    xh.setAttribute('x1', px); xh.setAttribute('x2', px); xh.setAttribute('opacity', '.35');
    xp.setAttribute('cx', px); xp.setAttribute('cy', py); xp.setAttribute('opacity', '1');
    tip.innerHTML = `<b>${fD(o.ds)} · ${wday(o.ds)}</b><br>${o.i ? `Entra ${money(o.i)}<br>` : ''}${o.o ? `Sai ${money(o.o)}<br>` : ''}Banco ${money(o.bank)} · Carteira ${money(o.wal)}<br>Total: <b>${money(o.bal)}</b>`;
    tip.style.left = Math.min(Math.max(px * (r.width / W), 90), r.width - 90) + 'px';
    tip.style.top = (py * (r.height / H)) + 'px';
    tip.classList.add('on');
  };
  hit.addEventListener('pointermove', mv);
  hit.addEventListener('pointerdown', mv);
  hit.addEventListener('pointerleave', () => { tip.classList.remove('on'); xh.setAttribute('opacity', '0'); xp.setAttribute('opacity', '0'); });
}
