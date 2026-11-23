import { S, CATS_IN, CATS_OUT, CAT_CUT } from '../state.js';
import {
  ymOf, isDate, round2, money, parseMoney,
  firstBank, defPay, myPid, firstYM, pay, ymL
} from '../calc.js';
import { put } from '../db.js';
import {
  $, toast, catOpts, accOpts, pplOpts, payOptions, defDate,
  MN, alertas, pedidosPanel, panorama, kpis, tempoPanel, ultimas
} from './utils.js';
import { iaPanel, formVar, F, getDlg, getSheetCtx } from './forms.js';

export function vResumo() {
  const m = S.month, c = MN(m), dd = defDate(), ro = S.ro && S.mode !== 'demo';
  const inC = `<div class="flowcard in"><div class="fc-h"><span class="fc-ic" aria-hidden="true">↓</span><span>Entradas</span><b class="num">${money(c.inn)}</b></div><div class="fc-b">
    <label class="fld"><span>Valor</span><input class="money-in num" id="qi-v" inputmode="decimal" placeholder="0,00" ${ro ? 'disabled' : ''}></label>
    <label class="fld"><span>De onde vem</span><input id="qi-desc" placeholder="Ex.: salário, venda, Pix recebido" ${ro ? 'disabled' : ''}></label>
    <div class="two"><label class="fld"><span>Categoria</span><select id="qi-cat">${catOpts(CATS_IN, 'Salário')}</select></label><label class="fld"><span>Caiu em</span><select id="qi-acc">${accOpts(firstBank())}</select></label></div>
    <div class="two"><label class="fld"><span>Quem recebeu</span><select id="qi-p">${pplOpts(myPid())}</select></label><label class="fld"><span>Data</span><input id="qi-d" type="date" value="${dd}"></label></div>
    <button class="btn in-btn" data-act="qin" ${ro ? 'disabled' : ''}>✓ Adicionar entrada</button></div></div>`;
  const outC = `<div class="flowcard out"><div class="fc-h"><span class="fc-ic" aria-hidden="true">↑</span><span>Saídas</span><b class="num">${money(c.out)}</b></div><div class="fc-b">
    <label class="fld"><span>Valor</span><input class="money-in num" id="qo-v" inputmode="decimal" placeholder="0,00" ${ro ? 'disabled' : ''}></label>
    <label class="fld"><span>O que foi</span><input id="qo-desc" placeholder="Ex.: mercado, farmácia, Uber" ${ro ? 'disabled' : ''}></label>
    <div class="two"><label class="fld"><span>Categoria</span><select id="qo-cat">${catOpts(CATS_OUT, 'Mercado')}</select></label><label class="fld"><span>Como pagou</span><select id="qo-pay">${payOptions(defPay())}</select></label></div>
    <div class="two"><label class="fld"><span>Quem gastou</span><select id="qo-p">${pplOpts(myPid())}</select></label><label class="fld"><span>Data</span><input id="qo-d" type="date" value="${dd}"></label></div>
    <span class="small" id="qo-tempo" style="color:var(--accent)" aria-live="polite"></span>
    <button class="btn out-btn" data-act="qout" ${ro ? 'disabled' : ''}>✓ Adicionar saída</button>
    <button class="link" data-act="qmore" style="justify-self:start">Parcelado ou outra pessoa vai pagar? Abrir formulário completo</button></div></div>`;
  return `${alertas(m)}${pedidosPanel()}
  <section class="resumo-top">${inC}<div class="panel donutbox" style="justify-content:flex-start"><h2 style="align-self:flex-start">Saldo de ${ymL(m)}</h2>${panorama(m)}</div>${outC}</section>
  ${kpis(m)}
  ${iaPanel()}
  ${tempoPanel(m)}
  <section class="panel"><div class="panel-h"><h2>Últimas movimentações</h2><button class="link" data-act="tab" data-tab="lanc">Ver todas →</button></div>${ultimas(m, 6)}</section>`;
}

export function quickIn() {
  const v = parseMoney($('#qi-v').value), desc = $('#qi-desc').value.trim(), d = $('#qi-d').value;
  if (!(v > 0)) return toast('Informe o valor da entrada.');
  if (!desc) return toast('Diga de onde vem o dinheiro.');
  if (!isDate(d)) return toast('Informe a data.');
  if (!$('#qi-acc').value) return toast('Cadastre uma conta em Ajustes.');
  put({
    t: 'ent', desc, cat: $('#qi-cat').value, personId: $('#qi-p').value, accountId: $('#qi-acc').value,
    day: +d.slice(8, 10), amount: round2(v), from: ymOf(d), to: null, once: true, ov: {}
  }, ymOf(d) === S.month ? 'Entrada lançada.' : `Entrada lançada em ${ymL(ymOf(d))}.`);
}

export function quickOut() {
  const v = parseMoney($('#qo-v').value), desc = $('#qo-desc').value.trim(), d = $('#qo-d').value, pk = $('#qo-pay').value, cat = $('#qo-cat').value;
  if (!(v > 0)) return toast('Informe o valor da saída.');
  if (!desc) return toast('Diga o que foi.');
  if (!isDate(d)) return toast('Informe a data.');
  if (!pk) return toast('Cadastre uma conta em Ajustes.');
  const it = { t: 'gas', date: d, desc, cat, personId: $('#qo-p').value, pay: pk, amount: round2(v), cut: CAT_CUT[cat] || null, inst: null, refund: null, bill: null, total: null }, fm = firstYM(it);
  put(it, fm === S.month ? 'Saída lançada.' : `Saída lançada. Entra em ${ymL(fm)}${pay(pk)?.type === 'card' ? ' (mês da fatura)' : ''}.`);
}

export function quickMore() {
  const v = $('#qo-v').value, desc = $('#qo-desc').value, d = $('#qo-d').value, pk = $('#qo-pay').value, cat = $('#qo-cat').value, p = $('#qo-p').value;
  formVar(null);
  if (v) F('amount').value = v;
  if (desc) F('desc').value = desc;
  if (isDate(d)) F('date').value = d;
  if (pk) F('pay').value = pk;
  F('cat').value = cat;
  F('personId').value = p;
  const cut = CAT_CUT[cat] || '';
  F('cut').value = cut;
  getDlg().querySelectorAll('#cutSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === cut));
  getSheetCtx()?.upd?.();
}
