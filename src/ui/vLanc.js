import { S, CUTS, CATS_OUT, CATS_IN } from '../state.js';
import { ymLong, fD, wday, money, sum, val } from '../calc.js';
import { esc, filteredLines, lineRow, payOptions } from './utils.js';
import { iaOn } from './forms.js';

export function vLanc() {
  const f = S.f, L = filteredLines(), tot = sum(L.filter(l => l.kind !== 'tr'), val);
  const kinds = [
    ['all', 'Tudo'], ['in', 'Entradas'], ['fix', 'Fixos'], ['var', 'Do dia a dia'],
    ['inst', 'Parcelas'], ['loan', 'Empréstimos'], ['tr', 'Transferências'],
    ['inv', 'Investimentos'], ['aj', 'Ajustes'], ['dev', 'A receber']
  ];
  const cuts = [...Object.entries(CUTS).map(([k, v]) => [k, v.l]), ['none', 'Sem classificação']];
  const groups = {};
  for (const l of L) { const k = l.date || 'sem dia'; (groups[k] = groups[k] || []).push(l); }
  const keys = Object.keys(groups).sort((a, b) => a === 'sem dia' ? 1 : b === 'sem dia' ? -1 : a < b ? -1 : 1);
  const list = keys.length
    ? keys.map(k => `<div class="dayhead"><span>${k === 'sem dia' ? 'Sem dia definido' : fD(k) + ' · ' + wday(k)}</span><span class="num">${money(sum(groups[k].filter(l => l.kind !== 'tr'), val))}</span></div>${groups[k].map(lineRow).join('')}`).join('')
    : `<div class="empty">Nada por aqui com esses filtros.<br><button class="link" data-act="clearf">Limpar filtros</button></div>`;
  const people = [...S.st.people.map(p => [p.id, p.name]), ['_', 'Os dois / casa']];
  const anyF = f.kind !== 'all' || f.cut || f.person || f.pay || f.cat || f.q;
  return `<section class="panel">
    <div class="panel-h"><h2>Lançamentos de ${ymLong(S.month)}</h2><div class="chips">${!S.ro || S.mode === 'demo' ? '<button class="btn sm" data-act="lote">Importar OFX / CSV</button>' : ''}${iaOn() && !S.ro ? '<button class="btn sm" data-act="ai">Importar extrato com IA</button>' : ''}${S.downloads ? '<button class="btn sm" data-act="csv">Baixar CSV</button>' : ''}</div></div>
    <div class="filters">
      <div class="row chips">${kinds.map(([k, l]) => `<button class="chip" aria-pressed="${f.kind === k}" data-act="fk" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="row chips">${cuts.map(([k, l]) => `<button class="chip" aria-pressed="${f.cut === k}" data-act="fc" data-v="${k}"><span class="dot" style="background:var(${k === 'none' ? '--c-none' : CUTS[k].c})"></span>${l}</button>`).join('')}</div>
      <div class="row">
        <select id="fPerson" aria-label="Pessoa"><option value="">Todas as pessoas</option>${people.map(([k, l]) => `<option value="${k}" ${f.person === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <select id="fPay" aria-label="Forma de pagamento"><option value="">Todas as formas</option>${payOptions(f.pay).replace(/ — .*?</g, '<')}</select>
        <select id="fCat" aria-label="Categoria"><option value="">Todas as categorias</option>${[...CATS_OUT, ...CATS_IN, 'Transferência', 'Investimento', 'Empréstimo recebido', 'Ajuste de saldo', 'Ajuste de fatura'].filter((v, i, a) => a.indexOf(v) === i).map(c => `<option ${f.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <input id="fQ" type="search" placeholder="Buscar" value="${esc(f.q)}" aria-label="Buscar">
        ${anyF ? '<button class="link" data-act="clearf">limpar</button>' : ''}
      </div>
    </div>
    <p class="small" style="margin:14px 0 0"><b>${L.length}</b> ${L.length === 1 ? 'lançamento' : 'lançamentos'} · saldo <b class="num ${tot < 0 ? 'neg' : 'pos'}">${money(tot)}</b> <span class="muted">(transferências não entram)</span></p>
    <div class="rows">${list}</div></section>`;
}

export const vlanc = vLanc;
