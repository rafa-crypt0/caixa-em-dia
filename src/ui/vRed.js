import { S, CATS_OUT } from '../state.js';
import {
  curYM, addM, ymL, money,
  summary, carry, flow, allowed, tempoDe, fH
} from '../calc.js';
import { esc } from './utils.js';

export function vRed() {
  const st = S.st, cm = curYM();
  let m = S.month;
  if (!allowed(m)) m = allowed(cm) ? cm : st.start;
  const m2 = addM(m, 1);
  const red = st.reduce;
  const reducible = mm => {
    const o = {};
    for (const l of summary(mm).L) if ((l.kind === 'fix' || l.kind === 'var') && (l.cut === 'red' || l.cut === 'cor')) o[l.cat] = (o[l.cat] || 0) + l.amount;
    return o;
  };
  const r1 = reducible(m), r2 = reducible(m2);
  const cats = CATS_OUT.filter(c => S.redAll || r1[c] || r2[c]);
  const sliders = cats.map(c => {
    const p = Math.round((+red[c] || 0) * 100), sv = (r1[c] || 0) * (p / 100);
    return `<div class="redrow"><span><b>${esc(c)}</b><br><span class="small muted num">${money(r1[c] || 0)} em ${ymL(m)}</span></span><input type="range" min="0" max="100" step="5" value="${p}" id="red-${esc(c)}" data-red="${esc(c)}" aria-label="Quanto reduzir em ${esc(c)}" ${S.ro ? 'disabled' : ''}><b class="num" style="text-align:right">${p}%</b><span class="sv num small pos" style="text-align:right">${sv ? '− ' + money(sv) : ''}</span></div>`;
  }).join('') || '<div class="empty">Nenhum gasto marcado como "Reduzir" ou "Cortar" neste mês.</div>';
  const col = mm => {
    const a = summary(mm), b = summary(mm, red), c = carry(mm), fa = flow(mm), fb = flow(mm, red);
    let cb = c;
    if (mm === m2 && c !== null && carry(m) !== null) cb = carry(m) + summary(m, red).cash;
    return { a, b, c, cb, fa, fb };
  };
  const A = col(m), B = col(m2);
  const shift = (fl, dl) => fl.cards.map(x => ({ ...x, bal: x.bal + dl }));
  const cardsB2 = B.c !== null ? shift(B.fb, (B.cb ?? 0) - (B.c ?? 0)) : [];
  const cardRows = S.st.cards.map(cd => {
    const g = arr => arr.find(x => x.card.id === cd.id);
    const a1 = g(A.fa.cards), b1 = g(A.fb.cards), a2 = g(B.fa.cards), b2 = g(cardsB2);
    const cell = (x, ok) => x && ok ? `<td class="num ${x.bal < 0 ? 'neg' : ''}">${money(x.bal)}</td>` : '<td class="na">—</td>';
    return `<tr><td>${esc(cd.name)} no dia ${cd.dueDay}</td>${cell(a1, A.c !== null)}${cell(b1, A.c !== null)}${cell(a2, B.c !== null)}${cell(b2, B.c !== null)}</tr>`;
  }).join('');
  const nx = (c, s) => c === null ? '—' : money(c + s.cash);
  return `<section class="panel"><div class="panel-h"><h2>Quanto sobra se cortar</h2><span class="small muted">${ymL(m)} e ${ymL(m2)}</span></div>
    <p style="margin:0 0 6px;max-width:70ch">Diga quanto dá para diminuir em cada categoria. Só entram gastos marcados como <b>Reduzir</b> ou <b>Cortar</b>; parcelas, empréstimos e gastos essenciais ficam como estão.</p>
    ${sliders}<div style="margin-top:10px"><button class="link" data-act="redall">${S.redAll ? 'mostrar só as que têm gasto' : 'mostrar todas as categorias'}</button></div></section>
  <div class="tablewrap"><table class="cmp"><thead><tr><th></th><th>${ymL(m)} hoje</th><th>${ymL(m)} cortando</th><th>${ymL(m2)} hoje</th><th>${ymL(m2)} cortando</th></tr></thead><tbody>
    <tr><td>Gastos</td><td class="num">${money(A.a.out)}</td><td class="num after">${money(A.b.out)}</td><td class="num">${money(B.a.out)}</td><td class="num after">${money(B.b.out)}</td></tr>
    <tr><td>Economia</td><td></td><td class="num pos after">${money(A.a.out - A.b.out)}</td><td></td><td class="num pos after">${money(B.a.out - B.b.out)}</td></tr>
    ${(() => {
      const t1 = tempoDe('', m), t2 = tempoDe('', m2);
      return t1.ok || t2.ok ? `<tr><td>Horas de trabalho poupadas</td><td></td><td class="num pos after">${t1.ok ? fH((A.a.out - A.b.out) / t1.vh) : '—'}</td><td></td><td class="num pos after">${t2.ok ? fH((B.a.out - B.b.out) / t2.vh) : '—'}</td></tr>` : '';
    })()}
    <tr><td>Resultado do mês</td><td class="num">${money(A.a.result)}</td><td class="num after">${money(A.b.result)}</td><td class="num">${money(B.a.result)}</td><td class="num after">${money(B.b.result)}</td></tr>
    <tr><td><b>Sobra para o mês seguinte</b></td><td class="num">${nx(A.c, A.a)}</td><td class="num after pos">${nx(A.c, A.b)}</td><td class="num">${nx(B.c, B.a)}</td><td class="num after pos">${B.cb === null ? '—' : money(B.cb + B.b.cash)}</td></tr>
    ${cardRows}</tbody></table></div>
  <p class="small muted" style="margin:0">Só aparecem o mês atual e o próximo: mais adiante a conta dependeria de gastos que ainda não aconteceram.</p>`;
}
