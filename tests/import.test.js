import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../src/state.js';
import { buildState, invalidate } from '../src/calc.js';
import {
  decodeBankFile,
  parseBRNumber,
  parseBRDate,
  guessCategory,
  parseInstallment,
  parseOFX,
  parseCSV,
  parseBankFile,
  toLoteOps,
  parseQuickEntry
} from '../src/import.js';
import { loteCheck } from '../src/ui/forms.js';

function setupBaseState() {
  const recs = [
    { id: 'cfg', t: 'cfg', start: '2026-05' },
    { id: 'p1', t: 'pes', name: 'Ana', o: 1 },
    { id: 'a1', t: 'cta', name: 'Conta Itaú', type: 'banco', personId: 'p1', initial: 1000, o: 1 },
    { id: 'a2', t: 'cta', name: 'Conta Santander', type: 'banco', personId: 'p1', initial: 500, o: 2 },
    { id: 'a3', t: 'cta', name: 'Carteira', type: 'carteira', personId: '', initial: 100, o: 3 },
    { id: 'c1', t: 'car', name: 'Cartão Roxo', accountId: 'a1', rule: 'close', day: 17, dueDay: 26, dueNext: 'auto', o: 1 },
    { id: 'c2', t: 'car', name: 'Cartão Laranja', accountId: 'a2', rule: 'last', day: 27, dueDay: 3, dueNext: 'auto', o: 2 },
    // Lançamento já existente para testar detecção de repetidos
    { id: 'g-exist', t: 'gas', date: '2026-05-10', desc: 'Supermercado Assaí', cat: 'Mercado', personId: 'p1', pay: 'a:a1', amount: 245.8, cut: 'ess' }
  ];
  S.recs = {};
  for (const r of recs) S.recs[r.id] = r;
  S.st = buildState(S.recs);
  S.month = '2026-05';
  invalidate();
}

describe('Decodificação de arquivos e formatos brasileiros (UTF-8 / ISO-8859-1)', () => {
  it('decodifica buffers em UTF-8 (com e sem BOM) e ISO-8859-1 / Windows-1252 com acentuação', () => {
    const utf8Text = 'Alimentação;Farmácia São João;Pão de Açúcar';
    const utf8Bytes = new TextEncoder().encode(utf8Text);
    expect(decodeBankFile(utf8Bytes)).toBe(utf8Text);

    // Com BOM UTF-8 (0xEF, 0xBB, 0xBF)
    const withBom = new Uint8Array([0xEF, 0xBB, 0xBF, ...utf8Bytes]);
    expect(decodeBankFile(withBom)).toBe(utf8Text);

    // Bytes em ISO-8859-1 (Latin-1): "Padaria Pão & Café - Refeição"
    // ã = 0xE3, é = 0xE9, ç = 0xE7
    const latin1Bytes = new Uint8Array([
      0x50, 0x61, 0x64, 0x61, 0x72, 0x69, 0x61, 0x20,
      0x50, 0xE3, 0x6F, 0x20, 0x26, 0x20,
      0x43, 0x61, 0x66, 0xE9, 0x20, 0x2D, 0x20,
      0x52, 0x65, 0x66, 0x65, 0x69, 0xE7, 0xE3, 0x6F
    ]);
    expect(decodeBankFile(latin1Bytes)).toBe('Padaria Pão & Café - Refeição');
  });

  it('converte números e datas de extratos brasileiros (parseBRNumber e parseBRDate)', () => {
    expect(parseBRNumber('45,90')).toBe(45.9);
    expect(parseBRNumber('-1.234,56')).toBe(-1234.56);
    expect(parseBRNumber('R$ -89,90')).toBe(-89.9);
    expect(parseBRNumber('(120,50)')).toBe(-120.5);
    expect(parseBRNumber('350,00 D')).toBe(-350);
    expect(parseBRNumber('2.900,00 C')).toBe(2900);
    expect(parseBRNumber('-45.90')).toBe(-45.9);

    expect(parseBRDate('23/11/2026')).toBe('2026-11-23');
    expect(parseBRDate('05/05/26')).toBe('2026-05-05');
    expect(parseBRDate('2026-05-14')).toBe('2026-05-14');
    expect(parseBRDate('20260518120000[-3:BRT]')).toBe('2026-05-18');
    expect(parseBRDate('15/05', '2026')).toBe('2026-05-15');
    expect(parseBRDate('31/02/2026')).toBeNull();
  });
});

describe('Leitor Client-Side de OFX e CSV', () => {
  beforeEach(() => {
    setupBaseState();
  });

  it('lê extrato bancário OFX (SGML sem tags de fechamento e com vírgula/ponto decimal)', () => {
    const ofxConta = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
ENCODING:USASCII
CHARSET:1252
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20260505120000[-3:BRT]
            <TRNAMT>4500,00
            <FITID>1001
            <MEMO>SALARIO EMPRESA LTDA
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20260510120000[-3:BRT]
            <TRNAMT>-245.80
            <FITID>1002
            <NAME>COMPRA DEBITO
            <MEMO>SUPERMERCADO ASSAI
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20260512120000[-3:BRT]
            <TRNAMT>-38,90
            <FITID>1003
            <MEMO>UBER *TRIP
          <STMTTRN>
            <TRNTYPE>OTHER
            <DTPOSTED>20260501000000
            <TRNAMT>1000.00
            <MEMO>SALDO ANTERIOR
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

    const parsed = parseOFX(ofxConta);
    expect(parsed.format).toBe('ofx');
    expect(parsed.isCard).toBe(false);
    // "SALDO ANTERIOR" deve ser ignorado, restando 3 transações
    expect(parsed.items.length).toBe(3);

    expect(parsed.items[0]).toMatchObject({
      date: '2026-05-05',
      amount: 4500,
      type: 'in',
      cat: 'Salário'
    });
    expect(parsed.items[1]).toMatchObject({
      date: '2026-05-10',
      amount: 245.8,
      type: 'out',
      cat: 'Mercado'
    });
    expect(parsed.items[2]).toMatchObject({
      date: '2026-05-12',
      amount: 38.9,
      type: 'out',
      cat: 'Transporte'
    });

    // Verifica conversão para lote e aviso de lançamento repetido (245.80 em 2026-05-10 na conta a1)
    const lote = toLoteOps(parsed, { payKey: 'a:a1', titulo: 'extrato.ofx' });
    expect(lote.ops.length).toBe(3);
    const check0 = loteCheck(lote.ops[0]);
    const check1 = loteCheck(lote.ops[1]); // Supermercado Assaí 245.80 já existe em 2026-05-10
    expect(check0.warn).toBe('');
    expect(check1.warn).toContain('Parece repetido');
  });

  it('lê fatura de cartão em OFX (<CREDITCARDMSGSRSV1>), detecta parcelas e ignora pagamento da fatura', () => {
    const ofxCartao = `
<OFX>
  <CREDITCARDMSGSRSV1>
    <CCSTMTTRNRS>
      <CCSTMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>PAYMENT
            <DTPOSTED>20260503
            <TRNAMT>1200.00
            <MEMO>PAGAMENTO EFETUADO FATURA
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20260508
            <TRNAMT>-150.00
            <MEMO>DROGASIL FARMACIA
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20260509
            <TRNAMT>-89.90
            <MEMO>LOJAS RENNER 02/05
          </STMTTRN>
        </BANKTRANLIST>
      </CCSTMTRS>
    </CCSTMTTRNRS>
  </CREDITCARDMSGSRSV1>
</OFX>`;

    const parsed = parseOFX(ofxCartao);
    expect(parsed.isCard).toBe(true);
    expect(parsed.items.length).toBe(2);
    expect(parsed.items[0]).toMatchObject({
      date: '2026-05-08',
      amount: 150,
      cat: 'Saúde',
      inst: null
    });
    expect(parsed.items[1]).toMatchObject({
      date: '2026-05-09',
      amount: 89.9,
      cat: 'Vestuário',
      inst: { cur: 2, tot: 5 }
    });
  });

  it('lê CSV de fatura (padrão Nubank com vírgula) e CSV de extrato bancário (com cabeçalho institucional e ponto-e-vírgula)', () => {
    // 1. Fatura estilo Nubank
    const csvNubank = [
      'date,category,title,amount',
      '2026-05-02,pagamento,Pagamento recebido,-980.50',
      '2026-05-04,restaurante,Ifd*Pizzaria Napoli,78.90',
      '2026-05-06,eletronicos,Amazon Br - Parcela 3/10,129.90'
    ].join('\n');

    const pNu = parseCSV(csvNubank);
    expect(pNu.isCard).toBe(true);
    expect(pNu.items.length).toBe(2);
    expect(pNu.items[0]).toMatchObject({
      date: '2026-05-04',
      desc: 'Ifd*Pizzaria Napoli',
      amount: 78.9,
      cat: 'Lanche/Delivery'
    });
    expect(pNu.items[1]).toMatchObject({
      date: '2026-05-06',
      amount: 129.9,
      cat: 'Compras online',
      inst: { cur: 3, tot: 10 }
    });

    // 2. Extrato bancário brasileiro com linhas de metadados no topo e separador ';'
    const csvBanco = [
      'Extrato Conta Corrente',
      'Agência: 0001; Conta: 12345-6',
      'Período: 01/05/2026 a 31/05/2026',
      '',
      'Data;Histórico;Valor (R$)',
      '01/05/2026;SALDO ANTERIOR;1.000,00',
      '05/05/2026;PIX RECEBIDO - SALARIO;3.200,00',
      '11/05/2026;CONTA DE LUZ ENEL;-210,45',
      '14/05/2026;NETFLIX.COM;-39,90'
    ].join('\r\n');

    const pBanco = parseBankFile(csvBanco, 'extrato-maio.csv');
    expect(pBanco.isCard).toBe(false);
    expect(pBanco.items.length).toBe(3);
    expect(pBanco.items[0]).toMatchObject({ date: '2026-05-05', amount: 3200, type: 'in', cat: 'Salário' });
    expect(pBanco.items[1]).toMatchObject({ date: '2026-05-11', amount: 210.45, type: 'out', cat: 'Contas da casa' });
    expect(pBanco.items[2]).toMatchObject({ date: '2026-05-14', amount: 39.9, type: 'out', cat: 'Assinaturas' });
  });
});

describe('Interpretador por regras/Regex da Entrada Rápida (parseQuickEntry)', () => {
  beforeEach(() => {
    setupBaseState();
  });

  it('interpreta frases curtas de saída identificando valor, forma de pagamento e categoria', () => {
    const r1 = parseQuickEntry('45,90 mercado pix', S.st, '2026-05-15');
    expect(r1).toMatchObject({
      kind: 'out',
      amount: 45.9,
      cat: 'Mercado',
      payType: 'pix',
      pay: 'a:a1',
      date: '2026-05-15',
      cut: 'ess',
      inst: null
    });

    const r2 = parseQuickEntry('120 farmacia credito', S.st, '2026-05-15');
    expect(r2).toMatchObject({
      kind: 'out',
      amount: 120,
      cat: 'Saúde',
      payType: 'credito',
      pay: 'c:c1',
      cut: 'ess'
    });

    const r3 = parseQuickEntry('18,50 padaria dinheiro', S.st, '2026-05-15');
    expect(r3).toMatchObject({
      kind: 'out',
      amount: 18.5,
      cat: 'Mercado',
      payType: 'dinheiro',
      pay: 'a:a3' // Carteira
    });
  });

  it('identifica cartão específico pelo nome, compras parceladas (Nx), entradas e protege "99app"', () => {
    // Parcelado no cartão Laranja (c2)
    const rParc = parseQuickEntry('300 tenis 3x cartao laranja', S.st, '2026-05-15');
    expect(rParc).toMatchObject({
      kind: 'out',
      amount: 300,
      cat: 'Vestuário',
      payType: 'credito',
      pay: 'c:c2',
      inst: { cur: 1, tot: 3 },
      cut: 'com'
    });

    // Não confunde "99app" com o valor da corrida
    const r99 = parseQuickEntry('99app 24,80 pix', S.st, '2026-05-15');
    expect(r99).toMatchObject({
      kind: 'out',
      amount: 24.8,
      cat: 'Transporte',
      payType: 'pix',
      pay: 'a:a1'
    });

    // Entrada rápida ("recebi 350 freela pix") + data "ontem"
    const rIn = parseQuickEntry('recebi 350 freela pix ontem', S.st, '2026-05-15');
    expect(rIn).toMatchObject({
      kind: 'in',
      amount: 350,
      cat: 'Vendas',
      accountId: 'a1',
      date: '2026-05-14'
    });
  });
});
