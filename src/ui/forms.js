import {
  S, CATS_OUT, CATS_IN, INV_TYPES, CAT_CUT, CUTS, EXP, RO_MSG, CFGT,
  papel, isDono, souAutor, autorDe, nomeDe
} from '../state.js';
import {
  today, ymOf, isYM, isDate, addM, lastDay, dateIn,
  ymL, ymS, ymLong, fD, fDY, wday, round2, money, pct, parseMoney, moneyIn,
  uid, sum, val, expVal,
  acc, card, person, myPid, pname, isWallet, firstBank, defPay, pay,
  cardDue, cardRuleText, cardExample, firstYM, instAmt, rateMonthly, trName,
  lines, summary, carry, endAcc, balanceAt, portfolio, tempoBase, tempoInfo
} from '../calc.js';
import { put, drop, putMany, progToast, tempoOn, getFB, excluirContaEDados, authMsg } from '../db.js';
import {
  esc, $, toast, scheduleRender, render,
  catOpts, pplOpts, accOpts, payOptions, cutSeg, segPick, typeTabs, defDate,
  PEDK, pedVal, tempoTxt, lastMonths
} from './utils.js';
import { parseBankFile, toLoteOps } from '../import.js';

let sheetCtx = null;
export const getDlg = () => $('#sheet');
export const getSheetCtx = () => sheetCtx;
export const F = n => getDlg()?.querySelector(`[name="${n}"]`);
export const fv = n => F(n)?.value ?? '';
export const fc = n => !!F(n)?.checked;

export function guard() {
  if (S.ro && S.mode !== 'demo') { toast(RO_MSG); return false; }
  return true;
}

export function openSheet(title, bodyHtml, footHtml, ctx) {
  const dlg = getDlg();
  if (!dlg) return;
  sheetCtx = ctx || {};
  const r = sheetCtx.rec, alheio = r && !souAutor(r);
  const aviso = alheio ? `<div class="banner"><p>Lançado por <b>${esc(nomeDe(autorDe(r)))}</b>. ${papel() === 'dono' || papel() === 'editor' ? 'Suas mudanças vão como <b>pedido</b>: só valem quando ela ou ele aprovar.' : 'Só quem lançou pode mudar.'}</p></div>` : '';
  const pend = r && r.ped ? `<div class="banner"><p>Há um pedido para ${r.ped.tipo === 'del' ? 'apagar' : 'alterar'} este lançamento, feito por ${esc(nomeDe(r.ped.por))}.</p></div>` : '';
  dlg.innerHTML = `<form class="sheet" id="sf" novalidate><div class="sheet-h"><h2>${title}</h2><button type="button" class="x" data-act="closesheet" aria-label="Fechar">×</button></div><div class="sheet-b">${aviso}${pend}${bodyHtml}</div><div class="sheet-f">${footHtml}</div></form>`;
  if (alheio) {
    const sv = dlg.querySelector('.sheet-f .btn.primary'), dl = dlg.querySelector('[data-act="delsheet"]');
    const pode = papel() === 'dono' || papel() === 'editor';
    if (sv) { if (pode) sv.textContent = 'Pedir alteração'; else sv.remove(); }
    if (dl) { if (pode) dl.textContent = 'Pedir exclusão'; else dl.replaceWith(Object.assign(document.createElement('span'), { className: 'spacer' })); }
  }
  if (!dlg.open) dlg.showModal();
  if (sheetCtx.upd) sheetCtx.upd();
  const f = dlg.querySelector('[autofocus]');
  if (f) setTimeout(() => f.focus(), 30);
}

export function closeSheet() {
  const dlg = getDlg();
  if (dlg && dlg.open) dlg.close();
  sheetCtx = null;
}

export const foot = (e, delLabel = 'Excluir') => `${e && !S.ro ? `<button type="button" class="btn danger spacer" data-act="delsheet">${delLabel}</button>` : '<span class="spacer"></span>'}<button type="button" class="btn" data-act="closesheet">Cancelar</button>${S.ro && S.mode !== 'demo' ? '' : '<button class="btn primary">Salvar</button>'}`;

export function delAsk(btn, fn) {
  if (btn.dataset.sure) { fn(); }
  else { btn.dataset.sure = 1; btn.textContent = /Pedir/.test(btn.textContent) ? 'Confirmar pedido' : 'Confirmar exclusão'; }
}

export function newForm(k) {
  ({ var: formVar, in: formIn, fix: formFix, tra: formTra, emp: formEmp, mov: formMov })[k]?.(null);
}

export function openEdit(t) {
  const k = t.dataset.kind, r = S.recs[t.dataset.id];
  if (k === 'fd') return formFat(t.dataset.card, t.dataset.ym);
  if (!r) return;
  ({
    in: formIn, fix: formFix, var: formVar, dev: formVar,
    loan: formEmp, loanin: formEmp, tr: formTra,
    apl: formMov, res: formMov, ren: formMov,
    aj: formCon, inv: formInv, car: formCard
  })[k]?.(r);
}

/* ---------- gasto ---------- */
export function formVar(x) {
  const e = !!x;
  x = x || { date: defDate(), desc: '', cat: 'Mercado', personId: myPid(), pay: defPay(), amount: '', cut: null, inst: null, refund: null, bill: null, total: null };
  const cutSel = e ? x.cut : CAT_CUT[x.cat] || null, isI = !!x.inst, imode = isI && !x.total ? 'parcela' : 'total';
  const v0 = isI && x.total ? x.total : x.amount;
  const billDef = x.bill || (isDate(x.date) && pay(x.pay) ? firstYM({ ...x, bill: null }) : S.month);
  openSheet(e ? 'Editar gasto' : 'Lançar', `${typeTabs('var', e)}
    <label class="fld"><span id="amtLbl">Valor</span><input class="money-in num" id="f-amount" name="amount" inputmode="decimal" placeholder="0,00" value="${moneyIn(v0)}" autofocus required></label>
    <label class="fld"><span>O que foi</span><input id="f-desc" name="desc" value="${esc(x.desc)}" placeholder="Ex.: água, padaria, farmácia" required></label>
    <div class="two"><label class="fld"><span>Data da compra</span><input id="f-date" type="date" name="date" value="${x.date}" required></label><label class="fld"><span>Categoria</span><select id="f-cat" name="cat">${catOpts(CATS_OUT, x.cat)}</select></label></div>
    <div class="two"><label class="fld"><span>Quem gastou</span><select id="f-person" name="personId">${pplOpts(x.personId)}</select></label><label class="fld"><span>Como pagou</span><select id="f-pay" name="pay">${payOptions(x.pay)}</select></label></div>
    <p class="help" id="billHint"></p>
    <div class="calc" id="tempoPrev" hidden></div>
    <div class="fld"><span>Dá para cortar?</span>${cutSeg(cutSel)}<input type="hidden" name="cut" value="${cutSel || ''}"></div>
    <label class="check"><input type="checkbox" id="f-isInst" name="isInst" ${isI ? 'checked' : ''} data-act="toggle" data-t="instBox"> Compra parcelada</label>
    <div class="sub" id="instBox" ${isI ? '' : 'hidden'}>
      ${segPick('imode', [['total', 'Informei o valor total'], ['parcela', 'Informei o valor da parcela']], imode)}
      <div class="three"><label class="fld"><span>Nº de parcelas</span><input id="f-tot" type="number" min="2" max="120" name="tot" value="${x.inst?.tot || 2}"></label><label class="fld"><span>Parcela atual</span><input id="f-cur" type="number" min="1" name="cur" value="${x.inst?.cur || 1}"></label><label class="fld"><span>Mês da fatura</span><input id="f-bill" type="month" name="bill" value="${billDef}"></label></div>
      <p class="help">Numa compra nova, a parcela atual é 1 e o app acha o mês da fatura sozinho. Se você já está pagando, diga em qual parcela está e o mês da fatura dela.</p>
      <div class="calc" id="instPrev"></div>
    </div>
    <label class="check"><input type="checkbox" id="f-isRef" name="isRef" ${x.refund ? 'checked' : ''} data-act="toggle" data-t="refBox"> Outra pessoa vai pagar parte (ou tudo)</label>
    <div class="sub" id="refBox" ${x.refund ? '' : 'hidden'}><div class="two"><label class="fld"><span>Quem</span><input id="f-rwho" name="rwho" value="${esc(x.refund?.who || '')}" placeholder="Nome"></label><label class="fld"><span>Quanto <span class="help">(por parcela, se parcelado)</span></span><input id="f-ramt" name="ramt" inputmode="decimal" value="${moneyIn(x.refund?.amount)}"></label></div><label class="check"><input type="checkbox" id="f-rrec" name="rrec" ${x.refund?.received ? 'checked' : ''}> Já devolveu / já está pagando</label></div>`,
    foot(e), { kind: 'var', id: x.id, rec: e ? x : null, cutTouched: e, upd: updVar, save: saveVar, del: () => { drop(x.id, 'Excluído.'); closeSheet(); } });
}

export function updVar(ev) {
  const amt = parseMoney(fv('amount')), isI = fc('isInst'), imode = fv('imode'), tot = Math.max(2, parseInt(fv('tot')) || 2), cur = Math.max(1, parseInt(fv('cur')) || 1), date = fv('date'), p = pay(fv('pay'));
  if (ev && (ev.target.name === 'date' || ev.target.name === 'pay') && cur === 1 && isDate(date) && p) {
    const b = F('bill');
    if (b) b.value = firstYM({ date, pay: fv('pay'), bill: null });
  }
  const bill = fv('bill');
  $('#amtLbl').textContent = isI ? (imode === 'total' ? 'Valor total da compra' : 'Valor de cada parcela') : 'Valor';
  const hint = $('#billHint');
  if (p && isDate(date)) {
    if (p.type === 'card') {
      const f = isI && isYM(bill) ? addM(bill, -(cur - 1)) : cardDue(p.card, date);
      hint.textContent = `Mês da fatura: ${ymL(f)} (${p.card.name}, vence ${fD(dateIn(f, p.card.dueDay))}). Regra: ${cardRuleText(p.card)}.`;
    } else hint.textContent = isWallet(p.acc) ? 'Sai da carteira no dia da compra.' : `Sai da ${p.acc.name} no dia da compra.`;
  } else hint.textContent = '';
  const tp = $('#tempoPrev');
  if (tp) {
    const tot0 = isI && imode === 'parcela' ? amt * tot : amt, ok = tempoOn() && tot0 > 0 && tempoInfo(tot0, fv('personId'), S.month);
    tp.hidden = !ok;
    if (ok) tp.innerHTML = tempoTxt(tot0, fv('personId'), S.month);
  }
  const box = $('#instPrev');
  if (!isI || !(amt > 0) || !isYM(bill)) { box.innerHTML = ''; return; }
  const total = imode === 'total' ? amt : amt * tot, x = { total: imode === 'total' ? amt : null, amount: imode === 'total' ? round2(amt / tot) : amt, inst: { tot, cur } };
  const p1 = addM(bill, -(cur - 1)), last = addM(bill, tot - cur), a1 = instAmt(x, 1), an = instAmt(x, tot);
  const chips = Array.from({ length: Math.min(tot, 36) }, (_, j) => `<span class="mchip ${j + 1 === cur ? 'now' : ''}">${j + 1}/${tot} · ${ymS(addM(p1, j))}</span>`).join('') + (tot > 36 ? '<span class="mchip">…</span>' : '');
  box.innerHTML = `<div><b class="num">${tot}× de ${money(an)}</b> = <b class="num">${money(total)}</b>${Math.abs(a1 - an) > 0.001 ? ` <span class="muted">(a 1ª fica ${money(a1)} por causa dos centavos)</span>` : ''}</div>
    <div>1ª parcela em <b>${ymL(p1)}</b> · última em <b>${ymL(last)}</b>${cur > 1 ? ` · faltam ${tot - cur} depois desta` : ''}</div><div class="mchips">${chips}</div>`;
}

export function saveVar() {
  const amt = parseMoney(fv('amount')), date = fv('date');
  if (!(amt > 0)) return toast('Informe um valor maior que zero.');
  if (!fv('desc').trim()) return toast('Diga o que foi.');
  if (!isDate(date)) return toast('Informe a data.');
  if (!fv('pay')) return toast('Cadastre uma conta em Ajustes primeiro.');
  const it = {
    ...(sheetCtx.rec || {}), id: sheetCtx.id || uid(), t: 'gas', date,
    desc: fv('desc').trim(), cat: fv('cat'), personId: fv('personId'), pay: fv('pay'),
    amount: round2(amt), cut: fv('cut') || null, inst: null, refund: null, bill: null, total: null
  };
  if (fc('isInst')) {
    const cur = Math.max(1, parseInt(fv('cur')) || 1), tot = Math.max(2, parseInt(fv('tot')) || 2);
    if (cur > tot) return toast('A parcela atual não pode passar do total.');
    it.inst = { cur, tot };
    if (fv('imode') === 'total') { it.total = round2(amt); it.amount = round2(amt / tot); }
    const b = fv('bill'), auto = firstYM({ ...it, bill: null });
    it.bill = isYM(b) && b !== auto ? b : null;
    if (!it.cut) it.cut = 'com';
  }
  if (fc('isRef')) {
    const ra = parseMoney(fv('ramt'));
    if (ra > 0) it.refund = { who: fv('rwho').trim(), amount: ra, received: fc('rrec') };
  }
  const isNew = !sheetCtx.rec, fm = firstYM(it);
  closeSheet();
  put(it, isNew && fm !== S.month ? `Lançado. Entra em ${ymL(fm)}${pay(it.pay)?.type === 'card' ? ' (mês da fatura)' : ''}.` : isNew ? 'Lançado.' : 'Alterado.');
}

/* ---------- entrada e fixo ---------- */
export function formIn(x) {
  const e = !!x;
  x = x || { desc: '', cat: 'Salário', personId: myPid(), accountId: firstBank(), day: '', amount: '', from: S.month, to: null, once: false, ov: {} };
  const ov = x.ov && x.ov[S.month] != null ? x.ov[S.month] : '';
  openSheet(e ? 'Editar entrada' : 'Lançar', `${typeTabs('in', e)}
    <label class="fld"><span>Valor</span><input class="money-in num" id="f-amount" name="amount" inputmode="decimal" placeholder="0,00" value="${moneyIn(x.amount)}" autofocus required></label>
    <label class="fld"><span>De onde vem</span><input id="f-desc" name="desc" value="${esc(x.desc)}" placeholder="Ex.: salário, aluguel recebido" required></label>
    <div class="two"><label class="fld"><span>Categoria</span><select id="f-cat" name="cat">${catOpts(CATS_IN, x.cat)}</select></label><label class="fld"><span>De quem</span><select id="f-person" name="personId">${pplOpts(x.personId)}</select></label></div>
    <div class="two"><label class="fld"><span>Cai em</span><select id="f-acc" name="accountId">${accOpts(x.accountId)}</select></label><label class="fld"><span>Dia que cai</span><input id="f-day" type="number" min="1" max="31" name="day" value="${x.day || ''}" placeholder="Ex.: 5"></label></div>
    <label class="check"><input type="checkbox" id="f-rec" name="rec" ${x.once ? '' : 'checked'} data-act="toggle" data-t="recBox"> Repete todo mês</label>
    <div class="sub" id="recBox" ${x.once ? 'hidden' : ''}><div class="two"><label class="fld"><span>A partir de</span><input id="f-from" type="month" name="from" value="${x.from}"></label><label class="fld"><span>Até <span class="help">(vazio = sem fim)</span></span><input id="f-to" type="month" name="to" value="${x.to || ''}"></label></div>
      ${e ? `<label class="fld"><span>Valor só em ${ymL(S.month)}</span><input id="f-ov" name="ov" inputmode="decimal" value="${moneyIn(ov)}" placeholder="igual ao de todo mês"><span class="help">Use quando neste mês vier um valor diferente.</span></label>` : ''}</div>
    <div class="sub" id="onceBox" ${x.once ? '' : 'hidden'}><div class="two"><label class="fld"><span>Mês em que caiu</span><input id="f-onceM" type="month" name="onceM" value="${x.from}"></label><label class="fld"><span>Contar como renda de</span><input id="f-comp" type="month" name="comp" value="${x.comp || ''}"></label></div><span class="help">Ex.: salário que cai no fim do mês mas é do mês seguinte. Deixe vazio para contar no mesmo mês em que caiu.</span></div>
    <p class="help">Dinheiro de empréstimo não é entrada: use a aba Empréstimo.</p>
    ${e && !x.once && S.month > x.from && !S.ro ? `<button type="button" class="btn sm" data-act="stoprec">Parar a partir de ${ymL(S.month)}</button>` : ''}`,
    foot(e), { kind: 'in', id: x.id, rec: e ? x : null, save: () => saveRec('ent'), del: () => { drop(x.id, 'Excluído de todos os meses.'); closeSheet(); } });
}

export function formFix(x) {
  const e = !!x;
  x = x || { desc: '', cat: 'Contas da casa', personId: '', pay: defPay(), day: '', amount: '', cut: 'ess', from: S.month, to: null, ov: {} };
  const ov = x.ov && x.ov[S.month] != null ? x.ov[S.month] : '';
  openSheet(e ? 'Editar gasto fixo' : 'Lançar', `${typeTabs('fix', e)}
    <label class="fld"><span>Valor todo mês</span><input class="money-in num" id="f-amount" name="amount" inputmode="decimal" placeholder="0,00" value="${moneyIn(x.amount)}" autofocus required></label>
    <label class="fld"><span>O que é</span><input id="f-desc" name="desc" value="${esc(x.desc)}" placeholder="Ex.: aluguel, energia, internet" required></label>
    <div class="two"><label class="fld"><span>Categoria</span><select id="f-cat" name="cat">${catOpts(CATS_OUT, x.cat)}</select></label><label class="fld"><span>De quem</span><select id="f-person" name="personId">${pplOpts(x.personId)}</select></label></div>
    <div class="two"><label class="fld"><span>Como paga</span><select id="f-pay" name="pay">${payOptions(x.pay)}</select></label><label class="fld"><span>Dia que vence</span><input id="f-day" type="number" min="1" max="31" name="day" value="${x.day || ''}" placeholder="Ex.: 10"><span class="help">No cartão, entra na fatura.</span></label></div>
    <div class="fld"><span>Dá para cortar?</span>${cutSeg(x.cut)}<input type="hidden" name="cut" value="${x.cut || ''}"></div>
    <div class="two"><label class="fld"><span>A partir de</span><input id="f-from" type="month" name="from" value="${x.from}"></label><label class="fld"><span>Até <span class="help">(vazio = sem fim)</span></span><input id="f-to" type="month" name="to" value="${x.to || ''}"></label></div>
    ${e ? `<label class="fld"><span>Valor só em ${ymL(S.month)}</span><input id="f-ov" name="ov" inputmode="decimal" value="${moneyIn(ov)}" placeholder="igual ao de todo mês"><span class="help">Ex.: a conta de luz deste mês veio diferente. Coloque 0 se neste mês não tem.</span></label>` : ''}
    ${e && S.month > x.from && !S.ro ? `<button type="button" class="btn sm" data-act="stoprec">Parar a partir de ${ymL(S.month)}</button>` : ''}`,
    foot(e), { kind: 'fix', id: x.id, rec: e ? x : null, cutTouched: true, save: () => saveRec('fix'), del: () => { drop(x.id, 'Excluído de todos os meses.'); closeSheet(); } });
}

export function saveRec(t) {
  const amt = parseMoney(fv('amount'));
  if (!(amt > 0)) return toast('Informe um valor maior que zero.');
  if (!fv('desc').trim()) return toast('Diga o que é.');
  const old = sheetCtx.rec, day = parseInt(fv('day'));
  const r = { ...(old || {}), id: old?.id || uid(), t, desc: fv('desc').trim(), cat: fv('cat'), personId: fv('personId'), day: day >= 1 && day <= 31 ? day : null, amount: round2(amt), ov: { ...(old?.ov || {}) } };
  if (t === 'ent') {
    r.accountId = fv('accountId');
    r.once = !fc('rec');
    r.from = r.once ? (fv('onceM') || S.month) : (fv('from') || S.month);
    r.to = r.once ? null : (fv('to') || null);
    r.comp = r.once && isYM(fv('comp')) && fv('comp') !== r.from ? fv('comp') : null;
  } else {
    r.pay = fv('pay');
    r.cut = fv('cut') || null;
    r.from = fv('from') || S.month;
    r.to = fv('to') || null;
  }
  if (r.to && r.to < r.from) return toast('"Até" não pode ser antes de "A partir de".');
  if (old && F('ov')) {
    const o = fv('ov').trim();
    if (o === '') delete r.ov[S.month];
    else { const v = parseMoney(o); if (!isNaN(v)) r.ov[S.month] = v; }
  }
  closeSheet();
  put(r, old ? 'Alterado.' : 'Salvo.');
}

/* ---------- transferência ---------- */
export function formTra(x, pre) {
  const e = !!x, A = S.st.accounts;
  if (A.length < 2 && !e) { toast('Cadastre pelo menos duas contas (por exemplo, banco e carteira) em Ajustes.'); return; }
  x = x || { date: defDate(), from: pre?.from || firstBank(), to: pre?.to || (A.find(a => isWallet(a)) || A[1]).id, amount: pre?.v || '', desc: '' };
  openSheet(e ? 'Editar transferência' : 'Lançar', `${typeTabs('tra', e)}
    <label class="fld"><span>Valor</span><input class="money-in num" id="f-amount" name="amount" inputmode="decimal" placeholder="0,00" value="${moneyIn(x.amount)}" autofocus required></label>
    <div class="two"><label class="fld"><span>Saiu de</span><select id="f-from" name="from">${accOpts(x.from)}</select></label><label class="fld"><span>Foi para</span><select id="f-to" name="to">${accOpts(x.to)}</select></label></div>
    <div class="two"><label class="fld"><span>Data</span><input id="f-date" type="date" name="date" value="${x.date}"></label><label class="fld"><span>Descrição <span class="help">(opcional)</span></span><input id="f-desc" name="desc" value="${esc(x.desc)}" placeholder="Saque, depósito, Pix…"></label></div>
    <p class="help">Transferência não é gasto nem entrada: o dinheiro só muda de lugar. Saque é do banco para a carteira; depósito, da carteira para o banco.</p>`,
    foot(e), {
      kind: 'tra', rec: e ? x : null,
      save: () => {
        const amt = parseMoney(fv('amount'));
        if (!(amt > 0)) return toast('Informe um valor maior que zero.');
        if (fv('from') === fv('to')) return toast('Escolha contas diferentes.');
        if (!isDate(fv('date'))) return toast('Informe a data.');
        const r = { ...(x.id ? x : {}), t: 'tra', date: fv('date'), from: fv('from'), to: fv('to'), amount: round2(amt), desc: fv('desc').trim() || trName(acc(fv('from')), acc(fv('to'))) };
        closeSheet();
        put(r, e ? 'Alterado.' : 'Transferência lançada.');
      },
      del: () => { drop(x.id, 'Excluída.'); closeSheet(); }
    });
}

/* ---------- empréstimo ---------- */
export function formEmp(x) {
  const e = !!x, d0 = defDate();
  x = x || { desc: '', personId: '', date: d0, accId: firstBank(), amount: '', n: 12, parcela: '', pay: defPay(), day: '', first: addM(ymOf(d0), 1), cur: 1 };
  openSheet(e ? 'Editar empréstimo' : 'Lançar', `${typeTabs('emp', e)}
    <label class="fld"><span>Valor que caiu na conta</span><input class="money-in num" id="f-amount" name="amount" inputmode="decimal" placeholder="0,00" value="${moneyIn(x.amount)}" autofocus></label>
    <div class="two"><label class="fld"><span>O que é</span><input id="f-desc" name="desc" value="${esc(x.desc)}" placeholder="Ex.: empréstimo consignado" required></label><label class="fld"><span>De quem</span><select id="f-person" name="personId">${pplOpts(x.personId)}</select></label></div>
    <div class="two"><label class="fld"><span>Data que caiu</span><input id="f-date" type="date" name="date" value="${x.date}"></label><label class="fld"><span>Caiu em</span><select id="f-acc" name="accId">${accOpts(x.accId)}</select></label></div>
    <div class="two"><label class="fld"><span>Nº de parcelas</span><input id="f-n" type="number" min="1" max="420" name="n" value="${x.n}"></label><label class="fld"><span>Valor de cada parcela</span><input id="f-parcela" name="parcela" inputmode="decimal" value="${moneyIn(x.parcela)}" placeholder="0,00"></label></div>
    <div class="two"><label class="fld"><span>Como paga as parcelas</span><select id="f-pay" name="pay">${payOptions(x.pay)}</select></label><label class="fld"><span>Dia do débito</span><input id="f-day" type="number" min="1" max="31" name="day" value="${x.day || ''}" placeholder="Ex.: 10"><span class="help">No cartão, entra na fatura.</span></label></div>
    <div class="two"><label class="fld"><span>Próxima parcela a pagar (nº)</span><input id="f-cur" type="number" min="1" name="cur" value="${x.cur || 1}"></label><label class="fld"><span id="firstLbl">Mês dela</span><input id="f-first" type="month" name="first" value="${x.first}"></label></div>
    <div class="calc" id="empPrev"></div>
    <p class="help">O valor recebido entra na conta mas não conta como renda. As parcelas entram todo mês como compromisso.</p>`,
    foot(e), {
      kind: 'emp', rec: e ? x : null,
      upd: () => {
        const pv = parseMoney(fv('amount')), pm = parseMoney(fv('parcela')), n = parseInt(fv('n')) || 0, cur = Math.max(1, parseInt(fv('cur')) || 1), first = fv('first'), p = pay(fv('pay'));
        $('#firstLbl').textContent = p?.type === 'card' ? 'Mês da fatura dela' : 'Mês dela';
        if (!(pm > 0 && n > 0)) { $('#empPrev').innerHTML = ''; return; }
        const tp = pm * n, i = pv > 0 ? rateMonthly(pv, pm, n) : null;
        $('#empPrev').innerHTML = `<div>Total a pagar: <b class="num">${money(tp)}</b>${pv > 0 ? ` · juros: <b class="num ${tp - pv > 0 ? 'neg' : ''}">${money(tp - pv)}</b>` : ''}</div>${pv > 0 ? `<div>Taxa: <b class="num">${i ? pct(i) + ' ao mês' : 'sem juros'}</b>${i ? ` (${pct(Math.pow(1 + i, 12) - 1)} ao ano)` : ''}</div>` : '<div class="muted">Informe o valor recebido para ver os juros e a taxa.</div>'}${isYM(first) ? `<div>${cur > 1 ? `Faltam ${n - cur + 1} parcelas, ` : ''}termina em <b>${ymL(addM(first, n - cur))}</b></div>` : ''}`;
      },
      save: () => {
        const pv = parseMoney(fv('amount')), pm = parseMoney(fv('parcela')), n = parseInt(fv('n')), cur = Math.max(1, parseInt(fv('cur')) || 1), day = parseInt(fv('day'));
        if (!fv('desc').trim()) return toast('Diga o que é o empréstimo.');
        if (!(pm > 0) || !(n > 0)) return toast('Informe o número de parcelas e o valor de cada uma.');
        if (cur > n) return toast('A próxima parcela não pode passar do total.');
        if (!isYM(fv('first'))) return toast('Informe o mês da próxima parcela.');
        const r = { ...(x.id ? x : {}), t: 'emp', desc: fv('desc').trim(), personId: fv('personId'), date: fv('date'), accId: fv('accId'), amount: pv > 0 ? round2(pv) : 0, n, parcela: round2(pm), pay: fv('pay'), day: day >= 1 && day <= 31 ? day : null, first: fv('first'), cur };
        closeSheet();
        put(r, e ? 'Alterado.' : 'Empréstimo lançado.');
      },
      del: () => { drop(x.id, 'Empréstimo excluído.'); closeSheet(); }
    });
}

/* ---------- investimentos ---------- */
export function formMov(x, preKind) {
  const e = !!x;
  x = x || { invId: S.st.invs[0]?.id || '__new', kind: preKind || 'apl', date: defDate(), amount: '', accId: firstBank() };
  const hasInv = S.st.invs.length > 0;
  openSheet(e ? 'Editar movimento' : 'Lançar', `${typeTabs('mov', e)}
    ${segPick('kind', [['apl', 'Aplicar'], ['res', 'Resgatar'], ['ren', 'Rendimento']], x.kind)}
    <label class="fld"><span>Investimento</span><select id="f-inv" name="invId">${S.st.invs.map(i => `<option value="${i.id}" ${x.invId === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}<option value="__new" ${!hasInv || x.invId === '__new' ? 'selected' : ''}>Novo investimento…</option></select></label>
    <div class="sub" id="newInvBox"><div class="two"><label class="fld"><span>Nome</span><input id="f-iname" name="iname" placeholder="Ex.: Tesouro Selic, CDB Nubank"></label><label class="fld"><span>Tipo</span><select id="f-itype" name="itype">${catOpts(INV_TYPES, 'Poupança')}</select></label></div></div>
    <label class="check" id="bySaldoRow"><input type="checkbox" id="f-bySaldo" name="bySaldo"> Informar o saldo que aparece no app (o app calcula o rendimento)</label>
    <label class="fld"><span id="mvLbl">Valor</span><input class="money-in num" id="f-amount" name="amount" inputmode="decimal" placeholder="0,00" value="${moneyIn(x.amount)}" autofocus></label>
    <div class="two"><label class="fld"><span>Data</span><input id="f-date" type="date" name="date" value="${x.date}"></label><label class="fld" id="accFld"><span id="accLbl">Saiu de</span><select id="f-acc" name="accId">${accOpts(x.accId)}</select></label></div>
    <div class="calc" id="mvPrev"></div>`,
    foot(e), {
      kind: 'mov', rec: e ? x : null,
      upd: () => {
        const k = fv('kind'), nw = fv('invId') === '__new', bs = k === 'ren' && fc('bySaldo');
        $('#newInvBox').hidden = !nw; $('#bySaldoRow').hidden = k !== 'ren'; $('#accFld').hidden = k === 'ren';
        $('#accLbl').textContent = k === 'apl' ? 'Saiu de' : 'Voltou para';
        $('#mvLbl').textContent = k === 'apl' ? 'Valor aplicado' : k === 'res' ? 'Valor resgatado' : bs ? 'Saldo atual no app' : 'Quanto rendeu (use − se perdeu)';
        const pr = $('#mvPrev');
        if (nw || !isDate(fv('date'))) { pr.innerHTML = ''; return; }
        const cur = portfolio(fv('date'), x.id)[fv('invId')];
        if (!cur) { pr.innerHTML = ''; return; }
        const v = parseMoney(fv('amount'));
        let after = cur.saldo;
        if (!isNaN(v)) { after = k === 'apl' ? cur.saldo + v : k === 'res' ? cur.saldo - v : bs ? v : cur.saldo + v; }
        pr.innerHTML = `<div>Saldo antes: <b class="num">${money(cur.saldo)}</b> · depois: <b class="num">${money(after)}</b>${bs && !isNaN(v) ? ` · rendeu <b class="num ${v - cur.saldo < 0 ? 'neg' : 'pos'}">${money(v - cur.saldo)}</b>` : ''}</div>${k === 'res' && !isNaN(v) && v > cur.saldo + 0.005 ? '<div class="neg">O resgate passa do saldo calculado. Confira se falta lançar algum rendimento.</div>' : ''}`;
      },
      save: () => {
        const k = fv('kind'), date = fv('date');
        let v = parseMoney(fv('amount'));
        if (!isDate(date)) return toast('Informe a data.');
        let invId = fv('invId');
        const extra = [];
        if (invId === '__new') {
          const nm = fv('iname').trim();
          if (!nm) return toast('Dê um nome ao investimento.');
          invId = uid();
          extra.push({ id: invId, t: 'inv', name: nm, kind: fv('itype'), personId: '', o: S.st.invs.length + 1 });
        }
        if (k === 'ren') {
          if (isNaN(v)) return toast('Informe o valor.');
          if (fc('bySaldo')) { const cur = portfolio(date, x.id)[invId]; v = v - (cur ? cur.saldo : 0); }
          if (Math.abs(v) < 0.005) return toast('O saldo já é esse; não há rendimento para lançar.');
        } else if (!(v > 0)) return toast('Informe um valor maior que zero.');
        const r = { ...(x.id ? x : {}), t: 'mov', invId, kind: k, date, amount: round2(v), accId: k === 'ren' ? '' : fv('accId') };
        closeSheet();
        if (extra.length) putMany(extra.concat([r])); else put(r);
        toast(e ? 'Alterado.' : k === 'ren' ? `Rendimento de ${money(v)} lançado.` : 'Lançado.');
      },
      del: () => { drop(x.id, 'Excluído.'); closeSheet(); }
    });
}

export function formInv(x) {
  const e = !!x;
  x = x || { name: '', kind: 'Poupança', personId: '' };
  const nMov = e ? S.st.moves.filter(m => m.invId === x.id).length : 0;
  openSheet(e ? 'Editar investimento' : 'Novo investimento', `
    <label class="fld"><span>Nome</span><input id="f-iname" name="iname" value="${esc(x.name)}" placeholder="Ex.: Tesouro Selic 2029" autofocus></label>
    <div class="two"><label class="fld"><span>Tipo</span><select id="f-itype" name="itype">${catOpts(INV_TYPES, x.kind)}</select></label><label class="fld"><span>De quem</span><select id="f-person" name="personId">${pplOpts(x.personId)}</select></label></div>
    ${e && nMov ? `<p class="help">Excluir apaga também os ${nMov} movimentos dele.</p>` : ''}`,
    foot(e), {
      kind: 'inv', rec: e ? x : null,
      save: () => {
        if (!fv('iname').trim()) return toast('Dê um nome.');
        const r = { ...(x.id ? x : { o: S.st.invs.length + 1 }), t: 'inv', name: fv('iname').trim(), kind: fv('itype'), personId: fv('personId') };
        closeSheet();
        put(r, e ? 'Alterado.' : 'Investimento criado.');
      },
      del: () => {
        const ids = S.st.moves.filter(m => m.invId === x.id).map(m => m.id);
        ids.forEach(id => drop(id));
        drop(x.id, 'Investimento excluído.');
        closeSheet();
      }
    });
}

/* ---------- conferência ---------- */
export function formCon(x, preAcc) {
  const e = !!x;
  x = x || { accId: preAcc || firstBank(), date: today(), bank: '' };
  openSheet(e ? 'Editar conferência' : 'Conferir saldo', `
    <div class="two"><label class="fld"><span>Conta</span><select id="f-acc" name="accId">${accOpts(x.accId)}</select></label><label class="fld"><span>Data</span><input id="f-date" type="date" name="date" value="${x.date}"></label></div>
    <label class="fld"><span id="conLbl">Saldo no app do banco</span><input class="money-in num" id="f-bank" name="bank" inputmode="decimal" placeholder="0,00" value="${moneyIn(x.bank)}" autofocus></label>
    <div class="calc" id="conPrev"></div>
    <label class="check"><input type="checkbox" id="f-adj" name="adj" ${!e || x.adj ? 'checked' : ''}> Lançar a diferença como ajuste</label>
    <p class="help">Com o ajuste, o saldo do app passa a bater com o banco a partir dessa data. Se depois achar o lançamento que faltava, lance-o e desmarque o ajuste.</p>`,
    foot(e), {
      kind: 'con', rec: e ? x : null,
      upd: () => {
        const a = acc(fv('accId')), date = fv('date'), b = parseMoney(fv('bank'));
        $('#conLbl').textContent = isWallet(a) ? 'Dinheiro contado na carteira' : 'Saldo que aparece no app do banco';
        if (!isDate(date)) { $('#conPrev').innerHTML = ''; return; }
        const calc = balanceAt(fv('accId'), date, x.id), d = isNaN(b) ? null : round2(b - calc);
        $('#conPrev').innerHTML = `<div>Pelo que foi lançado, em ${fD(date)}: <b class="num">${money(calc)}</b></div>${d == null ? '' : Math.abs(d) < 0.01 ? '<div class="pos"><b>Bateu.</b></div>' : `<div>Diferença: <b class="num ${d < 0 ? 'neg' : ''}">${d > 0 ? '+ ' : '− '}${money(Math.abs(d))}</b> ${d < 0 ? '(saiu dinheiro que não foi lançado)' : '(entrou dinheiro que não foi lançado)'}</div>`}`;
      },
      save: () => {
        const date = fv('date'), b = parseMoney(fv('bank'));
        if (!isDate(date)) return toast('Informe a data.');
        if (isNaN(b)) return toast('Informe o saldo.');
        const calc = round2(balanceAt(fv('accId'), date, x.id)), d = round2(b - calc);
        const r = { ...(x.id ? x : {}), t: 'con', accId: fv('accId'), date, bank: round2(b), calc, adj: fc('adj') && Math.abs(d) >= 0.01 ? d : 0 };
        closeSheet();
        put(r, Math.abs(d) < 0.01 ? 'Conferido: bateu.' : r.adj ? `Diferença de ${money(d)} ajustada.` : 'Conferência salva.');
      },
      del: () => { drop(x.id, 'Conferência excluída.'); closeSheet(); }
    });
}

/* ---------- fatura paga ---------- */
export function formFat(cardId, ym) {
  const cd = card(cardId);
  if (!cd) return;
  const b = S.st.bills[cardId + ':' + ym], calc = round2(lines(ym).inv[cardId] || 0);
  openSheet(`Fatura de ${ymL(ym)} · ${esc(cd.name)}`, `
    <div class="calc"><div>Calculado pelo app: <b class="num">${money(calc)}</b> (vence ${fD(dateIn(ym, cd.dueDay))})</div></div>
    <div class="two"><label class="fld"><span>Data do pagamento</span><input id="f-date" type="date" name="date" value="${b?.date || dateIn(ym, cd.dueDay)}"></label><label class="fld"><span>Valor pago</span><input class="num" id="f-paid" name="paid" inputmode="decimal" value="${moneyIn(b?.amount ?? calc)}"></label></div>
    <div class="calc" id="fatPrev"></div>
    <p class="help">A diferença entre o pago e o calculado entra no mês como "Diferença na fatura", para o saldo bater com o banco.</p>`,
    `${b && !S.ro ? '<button type="button" class="btn danger spacer" data-act="delsheet">Desmarcar como paga</button>' : '<span class="spacer"></span>'}<button type="button" class="btn" data-act="closesheet">Cancelar</button>${S.ro && S.mode !== 'demo' ? '' : '<button class="btn primary">Salvar</button>'}`,
    {
      kind: 'fat',
      upd: () => {
        const v = parseMoney(fv('paid'));
        if (isNaN(v)) { $('#fatPrev').innerHTML = ''; return; }
        const d = round2(v - calc);
        $('#fatPrev').innerHTML = Math.abs(d) < 0.01 ? '<div class="pos"><b>Bate com o calculado.</b></div>' : `<div>Diferença: <b class="num">${d > 0 ? '+ ' : '− '}${money(Math.abs(d))}</b></div><div class="small">${d > 0 ? 'Pagou a mais: talvez falte lançar alguma compra, juros ou IOF.' : 'Pagou a menos: se ficou saldo devedor, ele vem na próxima fatura com juros. Lance os juros como gasto em "Tarifas e juros" quando aparecerem.'}</div>`;
      },
      save: () => {
        const v = parseMoney(fv('paid')), date = fv('date');
        if (!(v >= 0)) return toast('Informe o valor pago.');
        if (!isDate(date)) return toast('Informe a data.');
        closeSheet();
        put({ ...(b || {}), id: `fat-${cardId}-${ym}`, t: 'fat', card: cardId, ym, date, amount: round2(v) }, 'Fatura marcada como paga.');
      },
      del: () => { drop(`fat-${cardId}-${ym}`, 'Fatura desmarcada.'); closeSheet(); }
    });
}

/* ---------- cartão ---------- */
export function formCard(x) {
  const e = !!x;
  x = x || { name: '', accountId: firstBank(), rule: 'close', day: 17, dueDay: 26, dueNext: 'auto' };
  openSheet(e ? 'Editar cartão' : 'Novo cartão', `
    <div class="two"><label class="fld"><span>Nome</span><input id="f-cname" name="cname" value="${esc(x.name)}" placeholder="Ex.: Nubank, Itaú" autofocus></label><label class="fld"><span>Fatura paga pela conta</span><select id="f-acc" name="accountId">${accOpts(x.accountId)}</select></label></div>
    <div class="fld"><span>Como o banco informa a regra</span>${segPick('rule', [['close', 'Fecha no dia'], ['last', 'Compras até o dia']], x.rule)}</div>
    <div class="three"><label class="fld"><span id="dayLbl">Dia</span><input id="f-cday" type="number" min="1" max="31" name="cday" value="${x.day}"></label><label class="fld"><span>Vence dia</span><input id="f-due" type="number" min="1" max="31" name="due" value="${x.dueDay}"></label><label class="fld"><span>Vencimento</span><select id="f-dn" name="dueNext"><option value="auto" ${x.dueNext === 'auto' ? 'selected' : ''}>Automático</option><option value="same" ${x.dueNext === 'same' ? 'selected' : ''}>No mesmo mês do fechamento</option><option value="next" ${x.dueNext === 'next' ? 'selected' : ''}>No mês seguinte</option></select></label></div>
    <div class="btnrow"><span class="small muted">Modelos:</span><button type="button" class="btn sm" data-act="cardpreset" data-r="close" data-d="17" data-v="26">Fecha 17, vence 26</button><button type="button" class="btn sm" data-act="cardpreset" data-r="last" data-d="27" data-v="3">Compras até 27, vence 3</button></div>
    <div class="calc" id="cardPrev"></div>`,
    foot(e), {
      kind: 'car', rec: e ? x : null,
      upd: () => {
        const r = fv('rule');
        $('#dayLbl').textContent = r === 'last' ? 'Compras até o dia' : 'Fecha no dia';
        const c = { rule: r, day: Math.max(1, Math.min(31, parseInt(fv('cday')) || 1)), dueDay: Math.max(1, Math.min(31, parseInt(fv('due')) || 1)), dueNext: fv('dueNext') };
        $('#cardPrev').innerHTML = `<div><b>${cardRuleText(c)}</b></div><div>${cardExample(c)}</div>`;
      },
      save: () => {
        if (!fv('cname').trim()) return toast('Dê um nome ao cartão.');
        if (!fv('accountId')) return toast('Cadastre uma conta antes.');
        const r = { ...(x.id ? x : { o: S.st.cards.length + 1 }), t: 'car', name: fv('cname').trim(), accountId: fv('accountId'), rule: fv('rule'), day: Math.max(1, Math.min(31, parseInt(fv('cday')) || 1)), dueDay: Math.max(1, Math.min(31, parseInt(fv('due')) || 1)), dueNext: fv('dueNext') };
        closeSheet();
        put(r, e ? 'Cartão alterado.' : 'Cartão criado.');
      },
      del: () => {
        const used = [...S.st.fixed, ...S.st.items, ...S.st.loans].filter(y => y.pay === 'c:' + x.id).length;
        if (used) { toast(`Este cartão está em ${used} lançamentos. Troque a forma de pagamento deles antes de excluir.`); return; }
        drop(x.id, 'Cartão excluído.');
        closeSheet();
      }
    });
}

/* ---------- fechar mês ---------- */
export function closeMonthSheet() {
  const m = S.month, c = carry(m), s = summary(m), end = endAcc(m), ld = dateIn(m, lastDay(m));
  openSheet(`Fechar ${ymL(m)}`, `<p style="margin:0">A sobra calculada é <b class="num">${money(c + s.cash)}</b>. Se quiser, confira cada conta com o app do banco no dia ${fD(ld)}. Onde você preencher, a diferença vira um ajuste e o saldo real passa para ${ymL(addM(m, 1))}.</p>
    ${S.st.accounts.map(a => `<div class="two" style="align-items:end"><div><b>${esc(a.name)}</b><br><span class="small muted num">no app: ${money(end[a.id] || 0)}</span></div><label class="fld"><span>${isWallet(a) ? 'Dinheiro contado' : 'Saldo no banco'} <span class="help">(opcional)</span></span><input class="num" id="real-${a.id}" name="real-${a.id}" inputmode="decimal" placeholder="${moneyIn(end[a.id] || 0)}"></label></div>`).join('')}`,
    `<span class="spacer"></span><button type="button" class="btn" data-act="closesheet">Cancelar</button><button class="btn primary">Fechar mês</button>`,
    {
      kind: 'close',
      save: () => {
        const list = [];
        for (const a of S.st.accounts) {
          const t = fv('real-' + a.id).trim();
          if (!t) continue;
          const v = parseMoney(t);
          if (isNaN(v)) continue;
          const calc = round2(balanceAt(a.id, ld));
          const d = round2(v - calc);
          list.push({ t: 'con', accId: a.id, date: ld, bank: round2(v), calc, adj: Math.abs(d) >= 0.01 ? d : 0 });
        }
        list.push({ id: 'mes-' + m, t: 'mes', ym: m });
        closeSheet();
        putMany(list);
        toast(`${ymL(m)} fechado. A sobra foi para ${ymL(addM(m, 1))}.`);
      }
    });
}

/* ---------- importar lançamentos de um arquivo (lote) ---------- */
export const LOTE_CAMPOS = {
  gas: ['date', 'desc', 'cat', 'personId', 'pay', 'amount', 'cut', 'inst', 'refund', 'bill', 'total'],
  ent: ['desc', 'cat', 'personId', 'accountId', 'day', 'amount', 'from', 'to', 'once', 'ov', 'comp'],
  fix: ['desc', 'cat', 'personId', 'pay', 'day', 'amount', 'from', 'to', 'ov', 'cut'],
  car: ['name', 'accountId', 'rule', 'day', 'dueDay', 'dueNext']
};
export const pick = (o, ks) => { const r = {}; for (const k of ks) if (o && o[k] !== undefined) r[k] = o[k]; return r; };
export const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export const valDe = r => +(r.total || r.amount) || 0;
export const diaDe = r => r.t === 'gas' ? r.date : (r.from && r.day ? dateIn(r.from, r.day) : null);
export const dDias = (a, b) => Math.abs((new Date(a) - new Date(b)) / 864e5);

export function loteParecidos(r) {
  const d = diaDe(r), v = valDe(r);
  if (!d || !v) return [];
  return Object.values(S.recs).filter(x => x.t === r.t && Math.abs(valDe(x) - v) < 0.011 && (r.t !== 'gas' || x.pay === r.pay) && (r.t !== 'ent' || x.accountId === r.accountId) && diaDe(x) && dDias(diaDe(x), d) <= 2);
}

export function loteRefOk(r) {
  if (r.pay && !pay(r.pay)) return 'forma de pagamento não existe';
  if (r.accountId && !acc(r.accountId)) return 'conta não existe';
  if (r.personId && !person(r.personId)) return 'pessoa não existe';
  return '';
}

export function loteCheck(o) {
  if (o.op === 'add') {
    const t = o.rec?.t;
    if (!LOTE_CAMPOS[t] || t === 'car') return { err: 'tipo não aceito' };
    const r = { t, ...pick(o.rec, LOTE_CAMPOS[t]) };
    if (!(valDe(r) > 0)) return { err: 'sem valor' };
    if (t === 'gas' && !isDate(r.date)) return { err: 'sem data' };
    const e = loteRefOk(r);
    if (e) return { err: e };
    const dup = loteParecidos(r);
    return { r, warn: dup.length ? `Parece repetido: já existe "${dup[0].desc || ''}" de ${money(valDe(dup[0]))} em ${fDY(diaDe(dup[0]))}.` : '' };
  }
  const cur = S.recs[o.id];
  if (!cur) return { err: o.op === 'del' ? 'já foi apagado' : 'não encontrado no app' };
  if (o.op === 'del') {
    const mud = o.antes && Object.keys(o.antes).some(k => !igual(o.antes[k], cur[k]));
    return { cur, warn: mud ? 'Este lançamento mudou desde que o arquivo foi feito.' : '' };
  }
  if (o.op === 'edit') {
    const dep = pick(o.depois, LOTE_CAMPOS[cur.t] || []);
    if (!Object.keys(dep).length) return { err: 'nada para mudar' };
    if (CFGT[cur.t] && !isDono()) return { err: 'só o dono da casa muda isso' };
    if (Object.keys(dep).every(k => igual(dep[k], cur[k]))) return { cur, dep, ja: true, warn: 'Já está assim.' };
    const mud = o.antes && Object.keys(o.antes).some(k => !igual(o.antes[k], cur[k]));
    const e = loteRefOk(dep);
    if (e) return { err: e };
    return { cur, dep, warn: mud ? 'Este lançamento mudou desde que o arquivo foi feito. Confira antes de aplicar.' : '' };
  }
  return { err: 'operação desconhecida' };
}

export function loteResumo(r) {
  const p = r.t === 'car' ? '' : r.t === 'ent' ? (acc(r.accountId)?.name || '') : (pay(r.pay)?.name || '');
  return [diaDe(r) ? fDY(diaDe(r)) : '', r.cat, p, r.personId !== undefined ? pname(r.personId) : '', r.inst ? `${r.inst.tot}x de ${money(r.amount)}` : ''].filter(Boolean).map(esc).join(' · ');
}

export function loteDif(cur, dep) {
  return Object.keys(dep).filter(k => !igual(dep[k], cur[k])).map(k => `${esc(PEDK[k] || ({ dueDay: 'vencimento', day: 'dia' })[k] || k)}: ${esc(k === 'dueDay' || k === 'day' ? String(cur[k] ?? '—') : pedVal(k, cur[k]))} → <b>${esc(k === 'dueDay' || k === 'day' ? String(dep[k]) : pedVal(k, dep[k]))}</b>`).join('<br>');
}

export function loteRenderRows(ops) {
  const nome = { add: 'Novo', edit: 'Corrigir', del: 'Apagar' };
  const linhas = ops.map((x, i) => {
    const o = x.o, r = x.r || x.cur || {}, ok = !x.err && !x.warn && !x.ja;
    const tit = o.op === 'add' ? `${esc(r.desc || '')} <span class="num">${money(valDe(r))}</span>` : `${esc(r.desc || r.name || '')} ${r.t === 'car' ? '' : `<span class="num">${money(valDe(r))}</span>`}`;
    const det = o.op === 'edit' && x.dep ? loteDif(x.cur, x.dep) : esc(loteResumo(r));
    return `<label class="row-i lote" style="grid-template-columns:auto minmax(0,1fr)"><input type="checkbox" data-lote="${i}" ${ok ? 'checked' : ''} ${x.err ? 'disabled' : ''} style="grid-row:1/span 2;width:18px;height:18px;accent-color:var(--accent)">
      <span class="d"><span class="tag ${o.op === 'del' ? 'ped' : ''}">${nome[o.op] || o.op}</span> ${tit}</span>
      <span class="m" style="grid-column:2">${det}${o.nota ? `<br><span class="muted">${esc(o.nota)}</span>` : ''}${x.err ? `<br><b style="color:var(--bad)">Não dá: ${esc(x.err)}</b>` : x.warn ? `<br><b style="color:var(--bad)">⚠ ${esc(x.warn)}</b>` : ''}</span></label>`;
  }).join('');
  const nOk = ops.filter(x => !x.err && !x.warn && !x.ja).length, nW = ops.filter(x => !x.err && (x.warn || x.ja)).length;
  return `<p class="small" style="margin:0">${ops.length} itens. <b>${nOk}</b> marcados para aplicar.${nW ? ` <b style="color:var(--bad)">${nW}</b> com aviso ficaram desmarcados: leia e marque se estiver certo.` : ''} Nada muda até você tocar em Aplicar.</p><div class="rows">${linhas}</div>`;
}

export function loteSheet(L) {
  let ops = (Array.isArray(L.ops) ? L.ops : []).slice(0, 500).map(o => ({ o, ...loteCheck(o) }));
  if (!ops.length) return toast('Esse arquivo não tem lançamentos para importar.');
  const hasTargetPicker = !!L.rawParsed;
  const targetHtml = hasTargetPicker
    ? `<div class="two"><label class="fld"><span>Conta ou cartão do extrato/fatura</span><select id="f-lotepay" name="lotePay">${payOptions(L.payKey)}</select></label><label class="fld" id="loteFatFld" ${pay(L.payKey)?.type === 'card' ? '' : 'hidden'}><span>Mês da fatura</span><input id="f-lotebill" type="month" name="loteBill" value="${L.bill || S.month}"></label></div>`
    : '';
  openSheet('Importar lançamentos', `${L.titulo ? `<p style="margin:0"><b>${esc(L.titulo)}</b></p>` : ''}${targetHtml}<div id="loteBody" class="stack" style="gap:10px">${loteRenderRows(ops)}</div>`,
    `<span class="spacer"></span><button type="button" class="btn" data-act="closesheet">Cancelar</button><button class="btn primary">Aplicar marcados</button>`,
    {
      kind: 'lote',
      upd: ev => {
        if (!hasTargetPicker || !ev || (ev.target.name !== 'lotePay' && ev.target.name !== 'loteBill')) return;
        const pk = fv('lotePay'), bill = fv('loteBill'), isCard = pay(pk)?.type === 'card';
        const fatFld = $('#loteFatFld');
        if (fatFld) fatFld.hidden = !isCard;
        const reparsed = L.rawParsed.rawText
          ? parseBankFile(L.rawParsed.rawText, L.titulo || '', { isCard })
          : L.rawParsed;
        const nextL = toLoteOps(reparsed, { payKey: pk, bill, titulo: L.titulo });
        ops = (nextL.ops || []).slice(0, 500).map(o => ({ o, ...loteCheck(o) }));
        const bodyEl = $('#loteBody');
        if (bodyEl) bodyEl.innerHTML = loteRenderRows(ops);
      },
      save: () => loteAplicar(ops)
    });
}

export async function loteAplicar(ops) {
  if (!guard()) return;
  const dlg = getDlg();
  const sel = [...dlg.querySelectorAll('[data-lote]')].filter(b => b.checked && !b.disabled).map(b => ops[+b.dataset.lote]);
  if (!sel.length) return toast('Nenhum item marcado.');
  const adds = [];
  let ed = 0, ap = 0, ped = 0;
  for (const x of sel) {
    const o = x.o;
    if (o.op === 'add') adds.push({ ...x.r, id: uid() });
    else if (o.op === 'edit') {
      const c = S.recs[o.id];
      if (!c) continue;
      const alheio = !souAutor(c);
      put({ ...c, ...x.dep });
      alheio ? ped++ : ed++;
    } else if (o.op === 'del') {
      const c = S.recs[o.id];
      if (!c) continue;
      const alheio = !souAutor(c);
      drop(o.id);
      alheio ? ped++ : ap++;
    }
  }
  closeSheet();
  if (adds.length) await putMany(adds, adds.length > 10 ? progToast : null);
  toast([adds.length && `${adds.length} novos`, ed && `${ed} corrigidos`, ap && `${ap} apagados`, ped && `${ped} viraram pedido (lançados por outra pessoa)`].filter(Boolean).join(', ') + '.');
}

/* ---------- Assistente com IA (desativado na v1.0 via S.iaEnabled = false) ---------- */
export const iaOn = () => Boolean(S.iaEnabled && typeof window !== 'undefined' && window.IA_URL && S.mode === 'db' && S.cid && getFB()?.auth?.currentUser);

export async function iaCall(tarefa, dados) {
  if (!iaOn()) throw { code: 'not_granted' };
  const tok = await getFB().auth.currentUser.getIdToken();
  let r;
  try {
    r = await fetch(window.IA_URL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ casa: S.cid, tarefa, dados }) });
  } catch (e) { throw { code: 'offline' }; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw { code: j.error || 'api' };
  return j.json !== undefined ? j.json : j.texto;
}

export function iaErr(e) {
  const c = e && e.code;
  return c === 'not_granted' ? 'A IA só funciona com a conta conectada à casa.'
    : c === 'offline' ? 'Sem internet agora. Tente de novo quando a conexão voltar.'
    : c === 'rate_limited' ? 'Muitos pedidos seguidos. Espere um pouco e tente de novo.'
    : c === 'prompt_too_large' ? 'O texto é grande demais. Mande uma parte de cada vez.'
    : c === 'recusado' ? 'A IA não quis responder isso. Tente escrever de outro jeito.'
    : c === 'config' ? 'A ponte da IA não está configurada. Veja o arquivo ia/LEIAME.md.'
    : 'Não consegui falar com a IA agora. Tente de novo.';
}

export function iaPanel() {
  if (!iaOn()) return '';
  const ro = S.ro;
  return `<section class="panel iachat"><div class="panel-h" style="margin:0"><h2>Assistente</h2>${ro ? '' : '<button class="btn sm" data-act="ai">Importar extrato</button>'}</div>
    ${ro ? '' : `<div class="fld"><span>Lançar escrevendo</span><div class="iarow"><input id="ia-frase" placeholder="Ex.: gastei 45 no mercado no pix" enterkeyhint="go"><button class="btn" data-act="iafrase" id="iaFraseBtn">Preencher</button></div><span class="help">O app preenche o lançamento e você confere antes de salvar.</span></div>`}
    <div class="fld"><span>Pergunte sobre as contas</span><div class="iarow"><input id="ia-perg" placeholder="Ex.: onde dá para cortar este mês?" enterkeyhint="send"><button class="btn" data-act="iaperg" id="iaPergBtn">Perguntar</button></div></div>
    <div class="chips">${['Onde dá para cortar este mês?', 'Quanto gastamos com delivery nos últimos meses?', 'Em quantas horas de trabalho sai o mercado do mês?'].map(q => `<button class="chip" data-act="iaq" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <div id="iaAns" aria-live="polite">${iaAnsHtml()}</div></section>`;
}

export function iaAnsHtml() {
  const a = S.iaAns;
  if (!a) return '';
  if (a.busy) return '<p class="small muted">Lendo os seus lançamentos…</p>';
  if (a.err) return `<p class="small" style="color:var(--bad)">${esc(a.err)}</p>`;
  return `<div class="calc"><p class="small muted" style="margin:0">${esc(a.q)}</p><p class="iaans">${esc(a.t)}</p><button class="link" data-act="iaclear" style="justify-self:start">limpar</button></div>`;
}

export function payLabels() {
  return [...S.st.cards.map(c => ({ k: 'c:' + c.id, l: `${c.name} (cartão de crédito)` })), ...S.st.accounts.map(a => ({ k: 'a:' + a.id, l: `${a.name} (${isWallet(a) ? 'dinheiro vivo / carteira' : 'conta: pix ou débito'})` }))];
}

export async function iaFrase() {
  if (!iaOn()) return;
  const el = $('#ia-frase'), frase = (el?.value || '').trim();
  if (frase.length < 3) return toast('Escreva o que gastou ou recebeu.');
  if (!S.st.accounts.length) { S.tab = 'ajustes'; render(); return toast('Cadastre uma conta primeiro.'); }
  const btn = $('#iaFraseBtn');
  btn.disabled = true; btn.textContent = 'Lendo…';
  const P = payLabels(), me = person(myPid());
  try {
    const r = await iaCall('frase', { frase, hoje: today(), diaSemana: wday(today()), eu: me?.name || '', pessoas: S.st.people.map(p => p.name), pagamentos: P.map(x => x.l), categorias: CATS_OUT, categoriasEntrada: CATS_IN });
    btn.disabled = false; btn.textContent = 'Preencher';
    if (!r || !(+r.valor > 0)) return toast('Não entendi o valor. Tente de novo, ex.: "gastei 45 no mercado".');
    const norm = x => String(x || '').trim().toLowerCase();
    const pid = (S.st.people.find(p => norm(p.name) === norm(r.pessoa)) || {}).id ?? '';
    const pk = (P.find(x => norm(x.l) === norm(r.pagamento)) || P.find(x => norm(r.pagamento) && norm(x.l).startsWith(norm(r.pagamento))) || {}).k || '';
    const d = isDate(r.data) ? r.data : today();
    if (el) el.value = '';
    if (r.tipo === 'entrada') {
      const set = (id, v) => { const f = $('#' + id); if (f && v != null && v !== '') f.value = v; };
      set('qi-v', moneyIn(r.valor)); set('qi-desc', r.descricao); set('qi-cat', CATS_IN.includes(r.categoria) ? r.categoria : 'Outros'); set('qi-p', pid); set('qi-d', d);
      if (pk.startsWith('a:')) set('qi-acc', pk.slice(2));
      $('#qi-v')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#qi-v')?.focus();
      return toast('Confira a entrada e toque em "Adicionar entrada".');
    }
    const tot = Math.max(1, parseInt(r.parcelas) || 1), cat = CATS_OUT.includes(r.categoria) ? r.categoria : 'Outros';
    formVar(null); F('amount').value = moneyIn(r.valor); F('desc').value = String(r.descricao || '').slice(0, 80); F('date').value = d; F('cat').value = cat; F('personId').value = pid; if (pk) F('pay').value = pk;
    const cut = tot > 1 ? 'com' : (CAT_CUT[cat] || ''); F('cut').value = cut; getDlg().querySelectorAll('#cutSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === cut));
    if (tot > 1) { const c = F('isInst'); c.checked = true; $('#instBox').hidden = false; F('tot').value = tot; }
    sheetCtx?.upd?.({ target: F('date') });
    if (!pk) toast('Escolha como foi pago e confira antes de salvar.');
  } catch (e) { btn.disabled = false; btn.textContent = 'Preencher'; toast(iaErr(e)); }
}

export function iaContexto() {
  const m = S.month, n = x => round2(x).toFixed(2), out = [];
  out.push(`Mês aberto no app: ${ymLong(m)}. Hoje: ${today()}.`);
  out.push('Pessoas: ' + S.st.people.map(p => p.name).join(', ') + '.');
  const T = tempoBase(m);
  for (const p of S.st.people) {
    const x = T[p.id];
    if (x && x.ok) out.push(`Tempo de ${p.name}: salário ${n(x.renda)}, ${x.horas} h/mês, fixos e parcelas ${n(x.fixo)}, sobra ${n(x.sobra)}, hora de trabalho vale ${n(x.vh)}, cada hora deixa livre ${n(x.vs)}.`);
  }
  out.push('\nResumo por mês (entradas | saídas | resultado | gastos por categoria):');
  for (const mm of lastMonths(m, 6)) {
    const s = summary(mm), by = {};
    for (const l of s.L) if (EXP[l.kind]) by[l.cat] = (by[l.cat] || 0) + expVal(l);
    out.push(`${mm}: ${n(s.inT + s.dev)} | ${n(s.out)} | ${n(s.result)} | ` + Object.entries(by).sort((a, b) => b[1] - a[1]).map(([c, v]) => `${c} ${n(v)}`).join('; '));
  }
  out.push(`\nLançamentos de ${m} (data; tipo; descrição; categoria; pessoa; pagamento; valor; dá para cortar):`);
  const KN = { in: 'entrada', dev: 'devolução', fix: 'fixo', var: 'gasto', loan: 'parcela de empréstimo', loanin: 'empréstimo recebido', tr: 'transferência', apl: 'aplicação', res: 'resgate', aj: 'ajuste', fd: 'diferença de fatura' };
  for (const l of summary(m).L.filter(l => !(l.kind === 'tr' && l.leg === 'to')).slice(0, 600))
    out.push([l.date || 'sem dia', KN[l.kind] || l.kind, l.desc, l.cat, pname(l.person), l.via, n(l.kind === 'tr' ? l.amount : val(l)), l.cut && EXP[l.kind] ? CUTS[l.cut].l : ''].join('; ') + (l.inst ? ` (parcela ${l.inst.n}/${l.inst.tot})` : ''));
  return out.join('\n').slice(0, 90000);
}

export async function iaPerg(q) {
  if (!iaOn()) return;
  const el = $('#ia-perg');
  q = (q || el?.value || '').trim();
  if (q.length < 3) return toast('Escreva a pergunta.');
  if (S.iaAns?.busy) return;
  const show = () => {
    const b = $('#iaAns'); if (b) b.innerHTML = iaAnsHtml();
    const bt = $('#iaPergBtn'); if (bt) { bt.disabled = !!S.iaAns?.busy; bt.textContent = S.iaAns?.busy ? 'Pensando…' : 'Perguntar'; }
  };
  S.iaAns = { busy: true }; show();
  try {
    const t = await iaCall('pergunta', { pergunta: q, contexto: iaContexto() });
    S.iaAns = { q, t: String(t || '').trim() };
    const e2 = $('#ia-perg'); if (e2) e2.value = '';
  } catch (e) { S.iaAns = { err: iaErr(e) }; }
  show();
}

export function aiSheet() {
  if (!iaOn()) return;
  const dc = S.st.cards[0] ? 'c:' + S.st.cards[0].id : defPay();
  openSheet('Importar extrato com IA', `<p style="margin:0">Copie o texto da fatura ou do extrato (abra o PDF, selecione tudo e copie) e cole abaixo. O Claude separa as compras; você confere antes de importar.</p>
    <div class="two"><label class="fld"><span>Onde foram pagas</span><select id="f-pay" name="pay">${payOptions(dc)}</select></label><label class="fld" id="aiFatFld"><span>Mês da fatura</span><input id="f-fat" type="month" name="fat" value="${S.month}"></label></div>
    <label class="fld"><span>Ano das compras <span class="help">(quando o texto não diz)</span></span><input id="f-year" type="number" name="year" value="${S.month.slice(0, 4)}"></label>
    <label class="fld"><span>Texto do extrato</span><textarea id="f-txt" name="txt" placeholder="Cole aqui…"></textarea></label><div id="aiOut"></div>`,
    `<span class="spacer"></span><button type="button" class="btn" data-act="closesheet">Cancelar</button><button type="button" class="btn primary" data-act="airun" id="aiBtn">Ler com IA</button>`,
    { kind: 'ai', upd: () => { $('#aiFatFld').hidden = pay(fv('pay'))?.type !== 'card'; }, save: () => {} });
}

export async function aiRun() {
  if (!iaOn()) return;
  const txt = fv('txt').trim();
  if (txt.length < 20) return toast('Cole o texto do extrato.');
  const btn = $('#aiBtn'), out = $('#aiOut');
  btn.disabled = true; btn.textContent = 'Lendo…'; out.innerHTML = '<p class="small muted">Lendo o extrato…</p>';
  try {
    const res = await iaCall('extrato', { texto: txt, ano: fv('year'), categorias: CATS_OUT });
    const arr = res && Array.isArray(res.compras) ? res.compras : [];
    const rows = arr.filter(r => r && +r.valor > 0 && isDate(r.data || ''));
    if (!rows.length) {
      out.innerHTML = '<p class="small">Não encontrei compras nesse texto. Confira se colou o extrato inteiro.</p>';
      btn.disabled = false; btn.textContent = 'Ler com IA';
      return;
    }
    sheetCtx.rows = rows.map(r => ({ date: r.data, desc: String(r.descricao || 'Compra').slice(0, 80), amount: round2(+r.valor), cur: Math.max(1, parseInt(r.parcela) || 1), tot: Math.max(1, parseInt(r.total_parcelas) || 1), cat: CATS_OUT.includes(r.categoria) ? r.categoria : 'Outros' }));
    out.innerHTML = `<p class="small"><b>${rows.length}</b> compras encontradas, ${money(sum(sheetCtx.rows, r => r.amount))}. Desmarque o que não quer importar.</p><div class="rows">${sheetCtx.rows.map((r, i) => `<label class="row-i" style="grid-template-columns:auto minmax(0,1fr) auto"><input type="checkbox" checked data-ai="${i}" style="grid-row:1/span 2;width:18px;height:18px;accent-color:var(--accent)"><span class="d">${esc(r.desc)}</span><span class="a num">${money(r.amount)}</span><span class="m" style="grid-column:2">${fD(r.date)} · ${esc(r.cat)}${r.tot > 1 ? ` · parcela ${r.cur}/${r.tot}` : ''}</span></label>`).join('')}</div>`;
    btn.disabled = false; btn.textContent = 'Importar selecionadas'; btn.dataset.act = 'aiimport';
  } catch (e) {
    out.innerHTML = `<p class="small" style="color:var(--bad)">${iaErr(e)}</p>`;
    btn.disabled = false; btn.textContent = 'Ler com IA';
  }
}

export function aiImport() {
  const dlg = getDlg();
  const p = fv('pay'), pi = pay(p), fat = fv('fat'), list = [];
  for (const box of dlg.querySelectorAll('[data-ai]')) {
    if (!box.checked) continue;
    const r = sheetCtx.rows[+box.dataset.ai];
    const it = { t: 'gas', date: r.date, desc: r.desc, cat: r.cat, personId: '', pay: p, amount: r.amount, cut: r.tot > 1 ? 'com' : (CAT_CUT[r.cat] || null), inst: r.tot > 1 ? { cur: Math.min(r.cur, r.tot), tot: r.tot } : null, refund: null, bill: null, total: null };
    if (pi?.type === 'card' && isYM(fat)) { const auto = firstYM(it); if (auto !== fat) it.bill = fat; }
    list.push(it);
  }
  closeSheet();
  putMany(list);
  toast(`${list.length} lançamentos importados.`);
}

/* ---------- Excluir minha conta e dados (LGPD / Play Store) ---------- */
export function deleteAccountSheet() {
  const hasAuth = !!(S.fb || getFB()?.auth?.currentUser);
  const membros = S.casa?.membros || [];
  const unicoDono = hasAuth && isDono() && membros.length <= 1;
  const donoComOutros = hasAuth && isDono() && membros.length > 1;
  const explicacao = !hasAuth
    ? 'Todos os lançamentos, contas e configurações salvos neste aparelho serão apagados permanentemente.'
    : unicoDono
      ? 'Sua conta de acesso, seu perfil, a sua casa e todos os lançamentos salvos no banco e neste aparelho serão excluídos permanentemente (conforme a LGPD).'
      : donoComOutros
        ? 'Sua conta de acesso, seu perfil, os seus lançamentos e os dados deste aparelho serão excluídos permanentemente. A titularidade da casa passará para outro membro remanescente.'
        : 'Sua conta de acesso, seu perfil, o seu vínculo com a casa, os seus lançamentos e os dados deste aparelho serão excluídos permanentemente (conforme a LGPD).';

  openSheet('Excluir minha conta e dados', `
    <div class="banner bad"><p><b>Atenção: esta ação é definitiva.</b> ${esc(explicacao)}</p></div>
    ${hasAuth ? `<label class="fld"><span>Confirme sua senha atual</span><input id="f-delpass" name="delPass" type="password" autocomplete="current-password" placeholder="Digite sua senha para confirmar" required><span class="help">Necessário por segurança para excluir a conta no Firebase Auth.</span></label>` : ''}
    <label class="check"><input type="checkbox" id="f-delconfirm" name="delConfirm" required> Entendo que minha conta e meus dados serão excluídos permanentemente</label>
    <p class="err" id="delAccErr" role="alert"></p>`,
    `<span class="spacer"></span><button type="button" class="btn" data-act="closesheet">Cancelar</button><button class="btn danger" id="delAccBtn">Excluir permanentemente</button>`,
    {
      kind: 'delaccount',
      save: async () => {
        const errEl = $('#delAccErr'), btn = $('#delAccBtn');
        if (errEl) errEl.textContent = '';
        if (!fc('delConfirm')) {
          if (errEl) errEl.textContent = 'Marque a confirmação acima para prosseguir.';
          return;
        }
        const pass = fv('delPass');
        if (hasAuth && !pass) {
          if (errEl) errEl.textContent = 'Digite sua senha atual para confirmar a exclusão.';
          return;
        }
        if (btn) { btn.disabled = true; btn.textContent = 'Excluindo…'; }
        try {
          await excluirContaEDados(pass);
          closeSheet();
        } catch (e) {
          if (btn) { btn.disabled = false; btn.textContent = 'Excluir permanentemente'; }
          const code = (e && e.code) || '';
          const msg = /requires-recent-login/.test(code)
            ? 'Por segurança, informe sua senha atual para confirmar a exclusão da conta.'
            : authMsg(e);
          if (errEl) errEl.textContent = msg;
          else toast(msg);
        }
      }
    });
}
