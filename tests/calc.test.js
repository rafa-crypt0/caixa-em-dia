import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../src/state.js';
import {
  pad, today, curYM, ymOf, isYM, isDate, addM, diffM, lastDay, dateIn,
  ymL, ymS, ymLong, fD, fDY, wday, round2, money, short, pct, parseMoney, moneyIn,
  uid, sum, val, expVal, fH, fDias,
  freshRecs, v1ToRecs, demoRecs, buildState,
  acc, card, person, invOf, myPid, pname, isWallet, firstBank, defPay, pay,
  closeDayOf, cardDue, cardRuleText, cardExample, firstYM, lastYM,
  instAmt, rateMonthly, trName, invalidate,
  lines, summary, gateOK, delta, runStart, endAcc, splitTypes,
  carry, allowed, whyNoCarry, balanceAt, flow, accPanel,
  portfolio, loanInfo, horasDe, isComp, tempoBase, tempoDe, tempoInfo
} from '../src/calc.js';

function setupState(recs) {
  S.recs = {};
  for (const r of recs) S.recs[r.id] = r;
  S.st = buildState(S.recs);
  invalidate();
  return S.st;
}

describe('Utilitários de data, número e moeda', () => {
  it('manipula datas, meses e anos bissextos corretamente', () => {
    expect(pad(5)).toBe('05');
    expect(pad(12)).toBe('12');
    expect(isYM('2026-11')).toBe(true);
    expect(isYM('2026-1')).toBe(false);
    expect(isDate('2026-11-23')).toBe(true);
    expect(isDate('2026-11')).toBe(false);
    expect(ymOf('2026-11-23')).toBe('2026-11');

    // Virada de ano para frente e para trás
    expect(addM('2026-11', 1)).toBe('2026-12');
    expect(addM('2026-11', 2)).toBe('2027-01');
    expect(addM('2026-01', -1)).toBe('2025-12');
    expect(addM('2026-03', -15)).toBe('2024-12');
    expect(diffM('2025-11', '2026-02')).toBe(3);
    expect(diffM('2026-02', '2025-11')).toBe(-3);

    // Dias do mês e ano bissexto
    expect(lastDay('2024-02')).toBe(29);
    expect(lastDay('2025-02')).toBe(28);
    expect(lastDay('2026-04')).toBe(30);
    expect(lastDay('2026-05')).toBe(31);

    // Clamp de dia dentro do mês
    expect(dateIn('2025-02', 31)).toBe('2025-02-28');
    expect(dateIn('2024-02', 31)).toBe('2024-02-29');
    expect(dateIn('2026-05', 0)).toBe('2026-05-01');
    expect(dateIn('2026-05', 15)).toBe('2026-05-15');

    // Formatação de datas
    expect(ymL('2026-03')).toBe('mar/2026');
    expect(ymS('2026-03')).toBe('mar/26');
    expect(ymLong('2026-03')).toBe('março de 2026');
    expect(fD('2026-03-09')).toBe('09/03');
    expect(fD(null)).toBe('sem dia');
    expect(fDY('2026-03-09')).toBe('09/03/2026');
    expect(fDY('')).toBe('—');
    expect(wday('2026-11-23')).toBe('seg');
    expect(uid().length).toBeGreaterThanOrEqual(8);
  });

  it('converte e formata valores monetários e horas', () => {
    expect(round2(10.556)).toBe(10.56);
    expect(round2(10.554)).toBe(10.55);
    expect(money(1234.5)).toBe('R$ 1.234,50');
    expect(short(950)).toBe('950');
    expect(short(2500)).toContain('2,5 mil');
    expect(short(-1500)).toContain('-1,5 mil');
    expect(pct(0.1234)).toBe('12,34%');

    expect(parseMoney('R$ 1.234,56')).toBe(1234.56);
    expect(parseMoney('45,90')).toBe(45.9);
    expect(parseMoney('1.500')).toBe(1500);
    expect(parseMoney(89.9)).toBe(89.9);
    expect(Number.isNaN(parseMoney(''))).toBe(true);
    expect(moneyIn(45.5)).toBe('45,5');
    expect(moneyIn(null)).toBe('');

    expect(sum([{ v: 10 }, { v: 25.5 }], x => x.v)).toBe(35.5);
    expect(val({ dir: -1, amount: 50 })).toBe(-50);
    expect(expVal({ kind: 'fd', dir: -1, amount: 20 })).toBe(20);
    expect(expVal({ kind: 'fd', dir: 1, amount: 15 })).toBe(-15);
    expect(expVal({ kind: 'var', dir: -1, amount: 80 })).toBe(80);

    expect(fH(0)).toBe('—');
    expect(fH(0.5)).toBe('30 min');
    expect(fH(4.5)).toBe('4h30');
    expect(fDias(4)).toBe('');
    expect(fDias(8)).toContain('1 dia de 8h');
    expect(fDias(20)).toContain('2,5 dias de 8h');
  });

  it('constrói estado a partir de registros v2, seletores básicos e migra registros v1', () => {
    const v1 = {
      start: '2026-01',
      reduce: { 'Lazer': 0.8 },
      people: [{ id: 'p1', name: 'Ana', uid: 'u1' }],
      accounts: [
        { id: 'a1', name: 'Banco Itaú', initial: 500 },
        { id: 'a2', name: 'Dinheiro na Carteira', initial: 50 }
      ],
      cards: [{ id: 'c1', name: 'Nubank', accountId: 'a1', closeDay: 15, dueDay: 22 }],
      incomes: [{ id: 'e1', desc: 'Salário', amount: 3000, from: '2026-01' }],
      fixed: [{ id: 'f1', desc: 'Aluguel', amount: 1200, from: '2026-01' }],
      items: [{ id: 'g1', date: '2026-01-10', desc: 'Mercado', amount: 200 }],
      closed: { '2026-01': { real: 1650 } }
    };
    const recs = v1ToRecs(v1);
    const st = setupState(recs);
    expect(st.start).toBe('2026-01');
    expect(st.reduce['Lazer']).toBe(0.8);
    expect(st.accounts[0].type).toBe('banco');
    expect(st.accounts[1].type).toBe('carteira');
    expect(st.cards[0].day).toBe(15);
    expect(st.closed['2026-01'].legacyReal).toBe(1650);

    expect(acc('a1').name).toBe('Banco Itaú');
    expect(card('c1').name).toBe('Nubank');
    expect(person('p1').name).toBe('Ana');
    expect(pname('p1')).toBe('Ana');
    expect(pname('')).toBe('Os dois / casa');
    expect(myPid(st, 'u1')).toBe('p1');
    expect(firstBank(st)).toBe('a1');
    expect(defPay(st)).toBe('a:a1');
    expect(pay('c:c1', st).type).toBe('card');
    expect(pay('a:a1', st).type).toBe('acc');
    expect(trName(acc('a1'), acc('a2'))).toBe('Saque');
    expect(trName(acc('a2'), acc('a1'))).toBe('Depósito');
    expect(trName(acc('a1'), acc('a1'))).toBe('Transferência');

    const fresh = freshRecs();
    expect(fresh.some(r => r.t === 'cfg')).toBe(true);
    expect(fresh.filter(r => r.t === 'cta').length).toBe(2);

    const demo = demoRecs();
    expect(demo.length).toBeGreaterThan(20);
  });
});

describe('Fechamento e vencimento de cartão (cardDue)', () => {
  it('regra "close" (Fecha no dia): compras no dia do fechamento já vão para a próxima fatura', () => {
    const cardRoxo = { id: 'c1', name: 'Roxo', rule: 'close', day: 17, dueDay: 26, dueNext: 'auto' };
    expect(closeDayOf(cardRoxo)).toBe(17);

    expect(cardDue(cardRoxo, '2026-05-16')).toBe('2026-05');
    expect(cardDue(cardRoxo, '2026-05-17')).toBe('2026-06');
    expect(cardDue(cardRoxo, '2026-05-31')).toBe('2026-06');
    expect(cardDue(cardRoxo, '2026-12-17')).toBe('2027-01');
  });

  it('regra "last" (Compras até o dia): compras no dia limite ainda entram na fatura atual', () => {
    const cardLaranja = { id: 'c2', name: 'Laranja', rule: 'last', day: 27, dueDay: 3, dueNext: 'auto' };
    expect(closeDayOf(cardLaranja)).toBe(28);

    expect(cardDue(cardLaranja, '2026-05-27')).toBe('2026-06');
    expect(cardDue(cardLaranja, '2026-05-28')).toBe('2026-07');
    expect(cardDue(cardLaranja, '2026-11-28')).toBe('2027-01');
    expect(cardDue(cardLaranja, '2026-12-28')).toBe('2027-02');
  });

  it('respeita overrides explícitos de dueNext ("same" e "next") e textos explicativos', () => {
    const cSame = { id: 'c3', name: 'Teste', rule: 'close', day: 10, dueDay: 5, dueNext: 'same' };
    const cNext = { id: 'c4', name: 'Teste', rule: 'close', day: 10, dueDay: 20, dueNext: 'next' };

    expect(cardDue(cSame, '2026-05-05')).toBe('2026-05');
    expect(cardDue(cNext, '2026-05-05')).toBe('2026-06');
    expect(cardRuleText(cSame)).toBe('Fecha no dia 10 · vence dia 5');
    expect(cardExample(cSame)).toContain('Compra em');
  });

  it('calcula firstYM e lastYM para compras no cartão, conta e com fatura manual (bill)', () => {
    setupState([
      { id: 'cfg', t: 'cfg', start: '2026-05' },
      { id: 'a1', t: 'cta', name: 'Banco', type: 'banco', initial: 0 },
      { id: 'c1', t: 'car', name: 'Roxo', accountId: 'a1', rule: 'close', day: 17, dueDay: 26, dueNext: 'auto' }
    ]);

    const itemCard = { date: '2026-05-18', pay: 'c:c1', inst: { cur: 1, tot: 4 } };
    expect(firstYM(itemCard)).toBe('2026-06');
    expect(lastYM(itemCard)).toBe('2026-09');

    const itemOngoing = { date: '2026-03-10', pay: 'c:c1', bill: '2026-05', inst: { cur: 3, tot: 6 } };
    expect(firstYM(itemOngoing)).toBe('2026-05');
    expect(lastYM(itemOngoing)).toBe('2026-08');

    const itemAcc = { date: '2026-05-25', pay: 'a:a1', inst: null };
    expect(firstYM(itemAcc)).toBe('2026-05');
    expect(lastYM(itemAcc)).toBe('2026-05');
  });
});

describe('Parcelas e Empréstimos (instAmt, rateMonthly, loanInfo)', () => {
  it('ajusta centavos residuais na 1ª parcela em instAmt quando o valor total é informado', () => {
    const compra100em3 = { total: 100, amount: 33.33, inst: { cur: 1, tot: 3 } };
    expect(instAmt(compra100em3, 1)).toBe(33.34);
    expect(instAmt(compra100em3, 2)).toBe(33.33);
    expect(instAmt(compra100em3, 3)).toBe(33.33);
    expect(round2(instAmt(compra100em3, 1) + instAmt(compra100em3, 2) + instAmt(compra100em3, 3))).toBe(100);

    const porParcela = { total: null, amount: 49.9, inst: { cur: 1, tot: 5 } };
    expect(instAmt(porParcela, 1)).toBe(49.9);
    expect(instAmt(porParcela, 5)).toBe(49.9);
  });

  it('projeta parcelas corretamente ao longo dos meses e trata reembolso de terceiros', () => {
    setupState([
      { id: 'cfg', t: 'cfg', start: '2026-05' },
      { id: 'a1', t: 'cta', name: 'Banco', type: 'banco', initial: 1000 },
      { id: 'c1', t: 'car', name: 'Roxo', accountId: 'a1', rule: 'close', day: 17, dueDay: 26, dueNext: 'auto' },
      {
        id: 'g1', t: 'gas', date: '2026-05-10', desc: 'Notebook', cat: 'Educação',
        personId: '', pay: 'c:c1', total: 100, amount: 33.33, cut: 'com',
        inst: { cur: 1, tot: 3 }, refund: { who: 'Primo', amount: 10, received: false }
      },
      {
        id: 'g2', t: 'gas', date: '2026-05-12', desc: 'Jantar dividido', cat: 'Lazer',
        personId: '', pay: 'a:a1', amount: 120, cut: 'cor',
        inst: null, refund: { who: 'Amigo', amount: 60, received: true }
      }
    ]);

    expect(summary('2026-04').inst).toBe(0);

    const s1 = summary('2026-05');
    expect(s1.inst).toBe(33.34);
    expect(s1.vr).toBe(153.34);
    expect(s1.dev).toBe(60);
    expect(s1.receber).toBe(10);

    const s2 = summary('2026-06');
    expect(s2.inst).toBe(33.33);
    expect(s2.dev).toBe(0);
    expect(s2.receber).toBe(10);

    const s3 = summary('2026-07');
    expect(s3.inst).toBe(33.33);
    const l3 = s3.L.find(l => l.src.id === 'g1');
    expect(l3.inst).toEqual({ n: 3, tot: 3 });

    expect(summary('2026-08').inst).toBe(0);
  });

  it('calcula taxa Price (rateMonthly) e evolução de empréstimo (loanInfo e fluxo no caixa)', () => {
    expect(rateMonthly(1200, 100, 12)).toBe(0);
    expect(rateMonthly(0, 100, 12)).toBe(0);

    const rate = rateMonthly(3000, 329.5, 12);
    expect(rate).toBeGreaterThan(0.04);
    expect(rate).toBeLessThan(0.05);

    const loan = {
      id: 'emp1', t: 'emp', desc: 'Empréstimo Pessoal', personId: '',
      date: '2026-05-10', accId: 'a1', amount: 3000,
      n: 12, parcela: 329.5, pay: 'a:a1', day: 15, first: '2026-06', cur: 1
    };

    const infoBefore = loanInfo(loan, '2026-05');
    expect(infoBefore.active).toBe(false);
    expect(infoBefore.done).toBe(false);
    expect(infoBefore.left).toBe(12 * 329.5);
    expect(infoBefore.end).toBe('2027-05');
    expect(infoBefore.juros).toBe(954);

    const infoFirst = loanInfo(loan, '2026-06');
    expect(infoFirst.active).toBe(true);
    expect(infoFirst.n).toBe(1);
    expect(infoFirst.left).toBe(12 * 329.5);

    const infoLast = loanInfo(loan, '2027-05');
    expect(infoLast.active).toBe(true);
    expect(infoLast.n).toBe(12);
    expect(infoLast.left).toBe(329.5);

    const infoDone = loanInfo(loan, '2027-06');
    expect(infoDone.active).toBe(false);
    expect(infoDone.done).toBe(true);
    expect(infoDone.left).toBe(0);

    setupState([
      { id: 'cfg', t: 'cfg', start: '2026-05' },
      { id: 'a1', t: 'cta', name: 'Banco', type: 'banco', initial: 500 },
      loan
    ]);
    const sMay = summary('2026-05');
    expect(sMay.loanIn).toBe(3000);
    expect(sMay.inT).toBe(0);
    expect(sMay.result).toBe(0);
    expect(sMay.cash).toBe(3000);

    const sJun = summary('2026-06');
    expect(sJun.loanP).toBe(329.5);
    expect(sJun.out).toBe(329.5);
    expect(sJun.result).toBe(-329.5);
  });
});

describe('Saldo projetado (balanceAt), Sobra (carry) e Fluxo de Caixa (flow)', () => {
  const cm = curYM();
  const pm = addM(cm, -1);
  const nm = addM(cm, 1);
  const nm2 = addM(cm, 2);

  beforeEach(() => {
    setupState([
      { id: 'cfg', t: 'cfg', start: pm, reduce: { 'Lazer': 0.5 } },
      { id: 'p1', t: 'pes', name: 'Ana', horas: 200, o: 1 },
      { id: 'a1', t: 'cta', name: 'Banco Principal', type: 'banco', personId: 'p1', initial: 1000, o: 1 },
      { id: 'a2', t: 'cta', name: 'Carteira', type: 'carteira', personId: '', initial: 100, o: 2 },
      { id: 'c1', t: 'car', name: 'Cartão Roxo', accountId: 'a1', rule: 'close', day: 17, dueDay: 20, dueNext: 'auto', o: 1 },
      { id: 'e1', t: 'ent', desc: 'Salário Ana', cat: 'Salário', personId: 'p1', accountId: 'a1', day: 5, amount: 4000, from: pm, to: null, once: false, ov: {} },
      { id: 'f1', t: 'fix', desc: 'Aluguel', cat: 'Moradia', personId: '', pay: 'a:a1', day: 10, amount: 1500, cut: 'ess', from: pm, to: null, ov: {} }
    ]);
  });

  it('controla carry e gateOK exigindo fechamento de meses passados e respeitando legacyReal', () => {
    expect(carry(addM(pm, -1))).toBeNull();
    expect(whyNoCarry(addM(pm, -1))).toContain('anterior ao início');
    expect(carry(pm)).toBe(1100);
    expect(carry(cm)).toBeNull();
    expect(allowed(cm)).toBe(false);
    expect(whyNoCarry(cm)).toContain(ymL(pm));

    S.recs['mes-' + pm] = { id: 'mes-' + pm, t: 'mes', ym: pm };
    S.st = buildState(S.recs);
    invalidate();

    expect(carry(cm)).toBe(3600);
    expect(carry(nm)).toBe(3600 + 4000 - 1500);
    expect(carry(nm2)).toBeNull();

    // Se o fechamento de pm tiver legacyReal informado (ex.: 3500 em vez de 3600)
    S.recs['mes-' + pm] = { id: 'mes-' + pm, t: 'mes', ym: pm, legacyReal: 3500 };
    S.st = buildState(S.recs);
    invalidate();
    expect(carry(cm)).toBe(3500);
  });

  it('trata adiantamento de renda (comp: recebido num mês para contar como renda do seguinte) e overrides mensais (ov)', () => {
    // Salário extra que caiu em pm mas tem competência (comp) em cm
    S.recs['eComp'] = {
      id: 'eComp', t: 'ent', desc: 'Adiantamento', cat: 'Salário',
      personId: 'p1', accountId: 'a1', day: 28, amount: 1000,
      from: pm, to: null, once: true, comp: cm, ov: {}
    };
    // Conta de luz com override específico em cm
    S.recs['fLuz'] = {
      id: 'fLuz', t: 'fix', desc: 'Energia', cat: 'Contas da casa',
      personId: '', pay: 'a:a1', day: 15, amount: 200, cut: 'ess',
      from: pm, to: cm, ov: { [cm]: 250 }
    };
    S.st = buildState(S.recs);
    invalidate();

    // Em pm: os 1000 entram no caixa (adv = 1000, cash inclui +1000), mas não entram como renda (inT = 4000)
    const sPm = summary(pm);
    expect(sPm.inT).toBe(4000);
    expect(sPm.adv).toBe(1000);
    expect(sPm.fix).toBe(1700); // 1500 aluguel + 200 luz normal
    expect(sPm.result).toBe(4000 - 1700);
    expect(sPm.cash).toBe(4000 - 1700 + 1000);

    // Em cm: os 1000 contam como renda (inT = 5000), mas como já caíram antes, antic = 1000 tira do cash de cm
    const sCm = summary(cm);
    expect(sCm.inT).toBe(5000);
    expect(sCm.antic).toBe(1000);
    expect(sCm.fix).toBe(1750); // 1500 aluguel + 250 override de luz
    expect(sCm.result).toBe(5000 - 1750);
    expect(sCm.cash).toBe(5000 - 1750 - 1000);

    // Em nm (após o fim 'to: cm' de fLuz): fLuz não entra mais
    expect(summary(nm).fix).toBe(1500);
  });

  it('calcula balanceAt dia a dia com transferências, investimentos, itens sem dia e conferência', () => {
    S.recs['mes-' + pm] = { id: 'mes-' + pm, t: 'mes', ym: pm };
    S.recs['tr1'] = { id: 'tr1', t: 'tra', date: dateIn(cm, 6), from: 'a1', to: 'a2', amount: 200, desc: 'Saque' };
    S.recs['i1'] = { id: 'i1', t: 'inv', name: 'Reserva', kind: 'CDB / RDB', personId: 'p1', o: 1 };
    S.recs['m1'] = { id: 'm1', t: 'mov', invId: 'i1', kind: 'apl', date: dateIn(cm, 12), amount: 500, accId: 'a1' };
    S.recs['f2'] = { id: 'f2', t: 'fix', desc: 'Taxa sem dia', cat: 'Tarifas e juros', personId: '', pay: 'a:a1', day: null, amount: 50, cut: 'cor', from: cm, to: null, ov: {} };
    S.recs['con1'] = { id: 'con1', t: 'con', accId: 'a1', date: dateIn(cm, 15), bank: 5770, calc: 5800, adj: -30 };

    S.st = buildState(S.recs);
    invalidate();

    expect(balanceAt('a1', dateIn(cm, 4))).toBe(3500);
    expect(balanceAt('a1', dateIn(cm, 5))).toBe(7500);
    expect(balanceAt('a1', dateIn(cm, 6))).toBe(7300);
    expect(balanceAt('a2', dateIn(cm, 6))).toBe(300);
    expect(balanceAt('a1', dateIn(cm, 10))).toBe(5800);
    expect(balanceAt('a1', dateIn(cm, 12))).toBe(5300);
    expect(balanceAt('a1', dateIn(cm, 15))).toBe(5270);
    expect(balanceAt('a1', dateIn(cm, 15), 'con1')).toBe(5300);
    expect(balanceAt('a1', dateIn(cm, lastDay(cm)))).toBe(5220);
  });

  it('calcula flow diário, cobertura de fatura apenas com saldo bancário e diferença de fatura paga', () => {
    S.recs['mes-' + pm] = { id: 'mes-' + pm, t: 'mes', ym: pm };
    S.recs['g1'] = { id: 'g1', t: 'gas', date: dateIn(cm, 5), desc: 'Show', cat: 'Lazer', personId: 'p1', pay: 'c:c1', amount: 600, cut: 'cor' };
    S.st = buildState(S.recs);
    invalidate();

    const fl = flow(cm);
    expect(fl.hasCarry).toBe(true);
    expect(fl.b0).toBe(3500);
    expect(fl.w0).toBe(100);
    expect(fl.cards.length).toBe(1);
    expect(fl.cards[0].inv).toBe(600);
    expect(fl.cards[0].bal).toBe(5400);

    const flRed = flow(cm, { 'Lazer': 0.5 });
    expect(flRed.cards[0].inv).toBe(300);
    expect(flRed.cards[0].bal).toBe(5700);

    S.recs[`fat-c1-${cm}`] = { id: `fat-c1-${cm}`, t: 'fat', card: 'c1', ym: cm, date: dateIn(cm, 19), amount: 620 };
    S.st = buildState(S.recs);
    invalidate();

    const sPaid = summary(cm);
    expect(sPaid.fd).toBe(20);
    expect(sPaid.vr).toBe(620);
  });

  it('sugere transferências entre contas em accPanel quando uma conta fica negativa', () => {
    S.recs['mes-' + pm] = { id: 'mes-' + pm, t: 'mes', ym: pm };
    S.recs['gWal'] = { id: 'gWal', t: 'gas', date: dateIn(cm, 8), desc: 'Feira', cat: 'Mercado', personId: '', pay: 'a:a2', amount: 250, cut: 'ess' };
    S.st = buildState(S.recs);
    invalidate();

    const ap = accPanel(cm);
    expect(ap.ok).toBe(true);
    expect(ap.tr.length).toBe(1);
    expect(ap.tr[0].from.id).toBe('a1');
    expect(ap.tr[0].to.id).toBe('a2');
    expect(ap.tr[0].v).toBe(150);
    expect(ap.uncovered).toBe(0);
  });

  it('calcula carteira de investimentos (portfolio) e custo em tempo de trabalho (tempoInfo)', () => {
    S.recs['i1'] = { id: 'i1', t: 'inv', name: 'Tesouro Selic', kind: 'Tesouro Direto', personId: 'p1', o: 1 };
    S.recs['m1'] = { id: 'm1', t: 'mov', invId: 'i1', kind: 'apl', date: '2026-05-01', amount: 1000, accId: 'a1' };
    S.recs['m2'] = { id: 'm2', t: 'mov', invId: 'i1', kind: 'ren', date: '2026-05-15', amount: 15, accId: '' };
    S.recs['m3'] = { id: 'm3', t: 'mov', invId: 'i1', kind: 'res', date: '2026-05-20', amount: 200, accId: 'a1' };
    S.st = buildState(S.recs);
    invalidate();

    const pfAll = portfolio(null);
    expect(pfAll.i1.apl).toBe(1000);
    expect(pfAll.i1.ren).toBe(15);
    expect(pfAll.i1.res).toBe(200);
    expect(pfAll.i1.saldo).toBe(815);

    const pfMid = portfolio('2026-05-16');
    expect(pfMid.i1.saldo).toBe(1015);

    const ti = tempoInfo(200, 'p1', cm);
    expect(ti).not.toBeNull();
    expect(ti.t.vh).toBe(20);
    expect(ti.t.vs).toBe(12.5);
    expect(ti.h).toBe(10);
    expect(ti.hs).toBe(16);
  });
});
