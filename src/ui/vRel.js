import { S, MES, EXP } from '../state.js';
import { ymL, ymLong, money, short, sum, expVal, summary } from '../calc.js';
import { $, MN, lastMonths, kpis, panorama, donut, dleg, ultimas } from './utils.js';

export function catSegs(m) {
  const s = summary(m), mode = S.catMode || 'out', by = {};
  for (const l of s.L) {
    if (mode === 'out' ? EXP[l.kind] : ((l.kind === 'in' && !l.compOut) || l.kind === 'dev')) {
      const v = mode === 'out' ? expVal(l) : l.amount;
      by[l.cat] = (by[l.cat] || 0) + v;
    }
  }
  const E = Object.entries(by).filter(e => e[1] > 0.005).sort((a, b) => b[1] - a[1]),
    segs = E.slice(0, 5).map((e, i) => ({ l: e[0], v: e[1], c: '--s' + (i + 1) })),
    rest = sum(E.slice(5), e => e[1]);
  if (rest > 0.005) segs.push({ l: `Outras (${E.length - 5})`, v: rest, c: '--s-other' });
  return segs;
}

export function vRel() {
  const m = S.month, mode = S.catMode || 'out', segs = catSegs(m), tot = sum(segs, x => x.v), D = lastMonths(m, 6).map(MN);
  return `${kpis(m)}
  <div class="rgrid">
    <section class="panel"><div class="panel-h"><h2>Panorama financeiro</h2></div><div class="donutbox" style="padding:0">${panorama(m)}</div></section>
    <section class="panel"><div class="panel-h"><h2>Evolução no período</h2><div class="keys2"><span><i class="dot" style="background:var(--good)"></i>Entradas</span><span><i class="dot" style="background:var(--bad)"></i>Saídas</span></div></div>
      <div class="chart" id="evoChart" style="min-height:240px"></div>
      <button class="link" data-act="evotable">${S.evoTable ? 'esconder tabela' : 'ver em tabela'}</button>
      ${S.evoTable ? `<div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr></thead><tbody>${D.map(d => `<tr><td>${ymL(d.m)}</td><td class="num">${money(d.inn)}</td><td class="num">${money(d.out)}</td><td class="num ${d.res < 0 ? 'neg' : ''}">${money(d.res)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    </section>
  </div>
  <div class="rgrid">
    <section class="panel"><div class="panel-h"><h2>Por categorias</h2><div class="tog" role="group" aria-label="Tipo"><button aria-pressed="${mode === 'in'}" data-act="catmode" data-v="in">Entradas</button><button aria-pressed="${mode === 'out'}" data-act="catmode" data-v="out">Saídas</button></div></div>
      <div class="donutbox" style="padding:0">${segs.length ? donut(segs, money(tot), mode === 'out' ? 'Saídas do mês' : 'Entradas do mês') + dleg(segs) : `<div class="empty small">Sem ${mode === 'out' ? 'saídas' : 'entradas'} em ${ymL(m)}.</div>`}</div></section>
    <section class="panel"><div class="panel-h"><h2>Últimas movimentações</h2><button class="link" data-act="tab" data-tab="lanc">Ver todas →</button></div>${ultimas(m, 6)}</section>
  </div>`;
}

export function drawEvo() {
  const box = $('#evoChart');
  if (!box) return;
  const D = lastMonths(S.month, 6).map(MN), W = Math.max(280, box.clientWidth), H = 240, pl = 58, pr = 18, pt = 14, pb = 28, n = D.length;
  let hi = Math.max(...D.map(d => Math.max(d.inn, d.out)), 100);
  const span = hi, step0 = Math.pow(10, Math.floor(Math.log10(span / 4)));
  const st = [1, 2, 2.5, 5, 10].map(k => k * step0).find(k => span / k <= 5) || step0 * 10;
  hi = Math.ceil(hi / st) * st;
  const X = i => n === 1 ? pl + (W - pl - pr) / 2 : pl + i / (n - 1) * (W - pl - pr), Y = v => pt + (hi - v) / hi * (H - pt - pb);
  let g = '';
  for (let v = 0; v <= hi + 1e-6; v += st) g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${pl - 8}" y="${Y(v) + 4}" text-anchor="end">R$ ${short(v)}</text>`;
  const ser = (k, tok) => {
    const pts = D.map((d, i) => [X(i), Y(d[k])]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = n > 1 ? `<path d="${line} L${pts[n - 1][0].toFixed(1)} ${Y(0)} L${pts[0][0].toFixed(1)} ${Y(0)} Z" fill="var(${tok})" opacity=".05"/>` : '';
    return area + `<path d="${line}" fill="none" stroke="var(${tok})" stroke-width="2" stroke-linejoin="round"/>` + pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="var(${tok})" stroke="var(--surface)" stroke-width="2"/>`).join('');
  };
  const xt = D.map((d, i) => `<text class="axis" x="${X(i)}" y="${H - 8}" text-anchor="middle" ${d.m === S.month ? 'style="font-weight:700;fill:var(--ink)"' : ''}>${MES[+d.m.slice(5) - 1]}</text>`).join('');
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Entradas e saídas nos últimos ${n} meses"><g class="grid">${g}</g>${ser('inn', '--good')}${ser('out', '--bad')}${xt}
    <line id="exh" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="var(--ink-2)" opacity="0"/><rect id="ehit" x="${pl - 14}" y="0" width="${W - pl - pr + 28}" height="${H}" fill="transparent"/></svg><div class="tip" id="etip"></div>`;
  const hit = box.querySelector('#ehit'), tip = box.querySelector('#etip'), xh = box.querySelector('#exh');
  const mv = e => {
    const r = box.querySelector('svg').getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width);
    let i = n === 1 ? 0 : Math.round((x - pl) / ((W - pl - pr) / (n - 1)));
    i = Math.max(0, Math.min(n - 1, i));
    const d = D[i], px = X(i);
    xh.setAttribute('x1', px); xh.setAttribute('x2', px); xh.setAttribute('opacity', '.3');
    tip.innerHTML = `<b>${ymLong(d.m)}</b><br>Entradas ${money(d.inn)}<br>Saídas ${money(d.out)}<br>Saldo <b>${money(d.res)}</b>`;
    tip.style.left = Math.min(Math.max(px * (r.width / W), 80), r.width - 80) + 'px';
    tip.style.top = (Y(Math.max(d.inn, d.out)) * (r.height / H)) + 'px';
    tip.classList.add('on');
  };
  hit.addEventListener('pointermove', mv);
  hit.addEventListener('pointerdown', mv);
  hit.addEventListener('pointerleave', () => { tip.classList.remove('on'); xh.setAttribute('opacity', '0'); });
}
