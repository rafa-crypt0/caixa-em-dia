import { S, CATS_IN, CATS_OUT, CAT_CUT } from '../state.js';
import {
  ymOf, isDate, round2, money, moneyIn, parseMoney,
  firstBank, defPay, myPid, firstYM, pay, ymL
} from '../calc.js';
import { put } from '../db.js';
import { parseQuickEntry } from '../import.js';
import {
  $, toast, catOpts, accOpts, pplOpts, payOptions, defDate,
  MN, alertas, pedidosPanel, panorama, kpis, tempoPanel, ultimas, qoHint
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
    <div class="fld"><span>Entrada rápida por frase</span><div class="iarow"><input id="q-frase" placeholder="Ex.: 45,90 mercado pix, 120 farmacia credito" enterkeyhint="go" ${ro ? 'disabled' : ''}><button type="button" class="btn sm" data-act="qfrase" ${ro ? 'disabled' : ''}>Preencher</button></div></div>
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

export function quickPhrase() {
  const el = $('#q-frase');
  const txt = (el?.value || '').trim();
  if (!txt) return toast('Digite uma frase curta, ex.: "45,90 mercado pix".');
  if (!S.st.accounts.length) {
    S.tab = 'ajustes';
    return toast('Cadastre uma conta em Ajustes primeiro.');
  }
  const refD = $('#qo-d')?.value || defDate();
  const parsed = parseQuickEntry(txt, S.st, refD);
  if (!parsed) return toast('Informe o valor e o que foi, ex.: "45,90 mercado pix".');
  if (el) el.value = '';

  if (parsed.kind === 'in') {
    const set = (id, v) => { const f = $('#' + id); if (f && v != null && v !== '') f.value = v; };
    set('qi-v', moneyIn(parsed.amount));
    set('qi-desc', parsed.desc);
    set('qi-cat', parsed.cat);
    set('qi-acc', parsed.accountId);
    set('qi-d', parsed.date);
    $('#qi-v')?.focus();
    return toast('Entrada preenchida. Confira e toque em "Adicionar entrada".');
  }

  if (parsed.inst && parsed.inst.tot > 1) {
    formVar(null);
    F('amount').value = moneyIn(parsed.amount);
    F('desc').value = parsed.desc;
    F('date').value = parsed.date;
    F('cat').value = parsed.cat;
    if (parsed.pay) F('pay').value = parsed.pay;
    F('cut').value = 'com';
    getDlg().querySelectorAll('#cutSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === 'com'));
    const c = F('isInst');
    c.checked = true;
    $('#instBox').hidden = false;
    F('tot').value = parsed.inst.tot;
    getSheetCtx()?.upd?.({ target: F('date') });
    return;
  }

  const set = (id, v) => { const f = $('#' + id); if (f && v != null && v !== '') f.value = v; };
  set('qo-v', moneyIn(parsed.amount));
  set('qo-desc', parsed.desc);
  set('qo-cat', parsed.cat);
  if (parsed.pay) set('qo-pay', parsed.pay);
  set('qo-d', parsed.date);
  qoHint();
  $('#qo-v')?.focus();
  toast('Saída preenchida. Confira e toque em "Adicionar saída".');
}

export function quickIn() {
  let v = parseMoney($('#qi-v').value), desc = $('#qi-desc').value.trim(), d = $('#qi-d').value;
  if (!(v > 0) && desc) {
    const p = parseQuickEntry('recebi ' + desc, S.st, d || defDate());
    if (p && p.amount > 0) {
      v = p.amount;
      desc = p.desc;
      $('#qi-cat').value = p.cat;
      if (p.accountId) $('#qi-acc').value = p.accountId;
      d = p.date;
    }
  }
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
  let v = parseMoney($('#qo-v').value), desc = $('#qo-desc').value.trim(), d = $('#qo-d').value, pk = $('#qo-pay').value, cat = $('#qo-cat').value;
  const fraseEl = $('#q-frase');
  const rawFrase = (fraseEl?.value || '').trim();
  if (!(v > 0) && (rawFrase || desc)) {
    const p = parseQuickEntry(rawFrase || desc, S.st, d || defDate());
    if (p && p.amount > 0) {
      v = p.amount;
      desc = p.desc;
      cat = p.cat;
      if (p.pay) pk = p.pay;
      d = p.date;
      if (fraseEl) fraseEl.value = '';
    }
  }
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
