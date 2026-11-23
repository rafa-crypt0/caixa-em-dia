import { S } from '../state.js';
import {
  today, ymLong, fD, fDY, round2, money,
  acc, isWallet, summary, balanceAt, splitTypes
} from '../calc.js';
import { esc, lineRow } from './utils.js';

export function vContas() {
  const td = today(), m = S.month;
  const cards = S.st.accounts.map(a => {
    const now = balanceAt(a.id, td);
    const cs = S.st.confs.filter(c => c.accId === a.id).sort((x, y) => x.date < y.date ? 1 : -1), last = cs[0];
    let lastHtml = '<dt class="muted">Ainda não conferida</dt><dd></dd>';
    if (last) {
      const d = round2(last.bank - last.calc);
      lastHtml = `<dt>Última conferência</dt><dd class="num">${fDY(last.date)}</dd><dt>${isWallet(a) ? 'Contado' : 'No banco'} / no app</dt><dd class="num">${money(last.bank)} / ${money(last.calc)}</dd><dt>Diferença</dt><dd>${Math.abs(d) < 0.01 ? '<span class="pill good">bateu</span>' : `<span class="pill warn num">${d > 0 ? '+' : '−'} ${money(Math.abs(d))}</span>${last.adj ? ' <span class="small muted">ajustada</span>' : ''}`}</dd>`;
    }
    return `<section class="panel acard"><div class="panel-h"><h3>${esc(a.name)}</h3><span class="pill ${isWallet(a) ? 'warn' : 'info'}">${isWallet(a) ? 'Carteira' : 'Banco'}</span></div>
      <span class="eyebrow">Saldo no app hoje (${fD(td)})</span><span class="bigv num ${now < 0 ? 'neg' : ''}">${money(now)}</span>
      <dl class="kv" style="margin-top:10px">${lastHtml}</dl>
      ${S.ro ? '' : `<div style="margin-top:12px"><button class="btn sm primary" data-act="newcon" data-acc="${a.id}">${isWallet(a) ? 'Contar a carteira' : 'Conferir com o banco'}</button></div>`}</section>`;
  }).join('') || '<div class="empty">Cadastre suas contas em Ajustes.</div>';
  const trs = summary(m).L.filter(l => l.kind === 'tr' && l.leg === 'from');
  const confs = S.st.confs.slice().sort((x, y) => x.date < y.date ? 1 : -1).slice(0, 15);
  const tot = splitTypes(Object.fromEntries(S.st.accounts.map(a => [a.id, balanceAt(a.id, td)])));
  return `<section class="panel"><div class="panel-h"><h2>Onde está o dinheiro hoje</h2><span class="small muted">pelo que foi lançado até ${fD(td)}</span></div>
    <div class="split num" style="font-size:1rem"><span>Bancos <b>${money(tot.bank)}</b></span><span>Carteira <b>${money(tot.wal)}</b></span><span>Total <b>${money(tot.bank + tot.wal)}</b></span></div>
    <p class="help" style="margin-top:8px">Confira com o app do banco de vez em quando. Se não bater, faltou lançar algo ou algo foi lançado errado. Dá para corrigir o lançamento ou registrar a diferença como ajuste.</p></section>
  <div class="acctgrid">${cards}</div>
  <section class="panel"><div class="panel-h"><h2>Transferências de ${ymLong(m)}</h2>${S.ro ? '' : '<button class="btn sm" data-act="new" data-kind="tra">+ Transferência</button>'}</div>
    <div class="rows">${trs.map(lineRow).join('') || '<div class="empty small">Nenhuma transferência neste mês. Saque, depósito e Pix entre contas da casa entram aqui: não são gasto nem entrada.</div>'}</div></section>
  <section class="stack" style="gap:10px"><h2>Conferências</h2>
  <div class="tablewrap"><table><thead><tr><th>Data</th><th class="l">Conta</th><th>No banco</th><th>No app</th><th>Diferença</th><th class="l">Ajuste</th></tr></thead><tbody>${confs.map(c => {
    const d = round2(c.bank - c.calc);
    return `<tr class="clk" data-act="edit" data-kind="aj" data-id="${c.id}"><td>${fDY(c.date)}</td><td class="l">${esc(acc(c.accId)?.name || '—')}</td><td class="num">${money(c.bank)}</td><td class="num">${money(c.calc)}</td><td class="num ${Math.abs(d) < 0.01 ? 'pos' : 'neg'}">${Math.abs(d) < 0.01 ? 'bateu' : money(d)}</td><td class="l">${c.adj ? 'lançado' : '—'}</td></tr>`;
  }).join('') || '<tr><td colspan="6" class="empty">Nenhuma conferência ainda.</td></tr>'}</tbody></table></div></section>`;
}
