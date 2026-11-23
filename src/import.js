import { S, CATS_OUT, CATS_IN, CAT_CUT } from './state.js';
import {
  today, ymOf, isDate, isYM, lastDay, dateIn, round2,
  isWallet, firstBank, defPay, pay, firstYM
} from './calc.js';

/* ---------- normalização e decodificação (UTF-8 / ISO-8859-1) ---------- */
export const normStr = s => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export function decodeBankFile(input) {
  if (typeof input === 'string') {
    return input.replace(/^\uFEFF/, '');
  }
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  if (!bytes.length) return '';
  // Remove BOM UTF-8 se presente
  const slice = (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF)
    ? bytes.subarray(3)
    : bytes;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(slice);
  } catch (_) {
    try {
      return new TextDecoder('windows-1252').decode(slice);
    } catch (_2) {
      return new TextDecoder('iso-8859-1').decode(slice);
    }
  }
}

/* ---------- números e datas brasileiras ---------- */
export function parseBRNumber(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  let s = String(raw ?? '').trim();
  if (!s) return NaN;

  let sign = 1;
  // Parênteses contábeis: (120,50)
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1).trim();
  }
  // Sufixo ou prefixo D / C (Débito / Crédito comum em BB, Bradesco e Caixa)
  const dcMatch = s.match(/^(.*?)(?:\s+|\b)([DCdc+-])$/);
  if (dcMatch && /\d/.test(dcMatch[1])) {
    s = dcMatch[1].trim();
    const dc = dcMatch[2].toUpperCase();
    if (dc === 'D' || dc === '-') sign = -1;
  }

  s = s.replace(/R\$|\s/gi, '');
  if (s.startsWith('-')) { sign *= -1; s = s.slice(1); }
  else if (s.startsWith('+')) { s = s.slice(1); }
  if (s.endsWith('-')) { sign *= -1; s = s.slice(0, -1); }

  if (!s || !/\d/.test(s)) return NaN;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // Formato brasileiro: 1.234,56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato inglês: 1,234.56
      s = s.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    // Apenas vírgula: 45,90
    s = s.replace(/,/g, '.');
  } else if (lastDot > -1) {
    // Apenas ponto: verifica se é separador de milhar (ex.: 1.500) ou decimal (ex.: 45.90)
    if (/^\d{1,3}(\.\d{3})+$/.test(s) && !/\.\d{2}$/.test(s)) {
      s = s.replace(/\./g, '');
    }
  }

  const n = Number(s);
  if (Number.isNaN(n)) return NaN;
  const res = sign * n;
  return Object.is(res, -0) ? 0 : res;
}

export function parseBRDate(raw, defaultYear) {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  // 1. ISO YYYY-MM-DD (ou YYYY/MM/DD, com ou sem horário)
  const iso = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})(?:[T\s].*)?$/);
  if (iso) {
    const [, y, m, d] = iso;
    const ym = `${y}-${m}`;
    if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= lastDay(ym)) return `${ym}-${d}`;
    return null;
  }

  // 2. OFX YYYYMMDD...
  const ofx = s.match(/^(\d{4})(\d{2})(\d{2})(?:\d{4,6})?(?:\s*\[.*?\])?$/);
  if (ofx) {
    const [, y, m, d] = ofx;
    const ym = `${y}-${m}`;
    if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= lastDay(ym)) return `${ym}-${d}`;
    return null;
  }

  // 3. Brasileiro DD/MM/AAAA ou DD/MM/AA (com /, - ou .)
  const br = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})(?:\s+.*)?$/);
  if (br) {
    let [, d, m, y] = br;
    if (y.length === 2) y = (+y >= 70 ? '19' : '20') + y;
    const mm = String(+m).padStart(2, '0');
    const dd = String(+d).padStart(2, '0');
    const ym = `${y}-${mm}`;
    if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= lastDay(ym)) return `${ym}-${dd}`;
    return null;
  }

  // 4. Curto DD/MM com ano padrão
  const dm = s.match(/^(\d{1,2})[\/.-](\d{1,2})$/);
  if (dm && defaultYear) {
    const [, d, m] = dm;
    const y = String(defaultYear).slice(0, 4);
    const mm = String(+m).padStart(2, '0');
    const dd = String(+d).padStart(2, '0');
    const ym = `${y}-${mm}`;
    if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= lastDay(ym)) return `${ym}-${dd}`;
  }

  return null;
}

/* ---------- classificação de categoria e parcelas ---------- */
const KW_OUT = [
  ['Pix crédito', ['pix credito', 'pix no credito', 'pix cartao']],
  ['Tarifas e juros', ['tarifa', 'juros', 'iof', 'anuidade', 'multa', 'encargo', 'cesta de servico', 'pacote de servico', 'mora']],
  ['Consórcio/Empréstimo', ['consorcio', 'emprestimo', 'financiamento', 'consignado']],
  ['Dízimo/Doações', ['dizimo', 'doacao', 'oferta', 'igreja', 'caridade', 'ong']],
  ['Presentes', ['presente', 'lembrancinha', 'aniversario', 'brinquedo', 'ri happy']],
  ['Moradia', ['aluguel', 'condominio', 'iptu', 'prestacao casa']],
  ['Contas da casa', ['energia', 'conta de luz', ' luz', 'enel', 'cpfl', 'cemig', 'light', 'copel', 'celesc', 'equatorial', 'neoenergia', 'coelba', 'elektro', 'edp', 'agua', 'sabesp', 'copasa', 'sanepar', 'cedae', 'cagece', 'corsan', 'caesb', 'embasa', 'comgas', 'naturgy', 'ultragaz', 'supergasbras', 'botijao', 'gas de cozinha', 'faxina', 'diarista']],
  ['Telefone/Internet', ['internet', 'telefone', 'celular', 'vivo', 'claro', 'tim', 'algar', 'brisanet', 'sky', 'banda larga', 'fibra', 'recarga']],
  ['Assinaturas', ['netflix', 'spotify', 'amazon prime', 'prime video', 'disney', 'hbo', 'globoplay', 'youtube', 'apple.com/bill', 'icloud', 'google one', 'google play', 'chatgpt', 'openai', 'claude', 'canva', 'microsoft 365', 'xbox', 'playstation', 'steam', 'assinatura', 'kindle']],
  ['Saúde', ['farmacia', 'drogaria', 'droga raia', 'drogasil', 'pacheco', 'pague menos', 'panvel', 'ultrafarma', 'araujo', 'sao joao', 'remedio', 'medicamento', 'medico', 'consulta', 'exame', 'laboratorio', 'hospital', 'clinica', 'dentista', 'odonto', 'psicologo', 'terapia', 'plano de saude', 'unimed', 'amil', 'sulamerica', 'hapvida', 'academia', 'smartfit', 'smart fit', 'gympass', 'wellhub', 'bluefit']],
  ['Transporte', ['uber', '99app', '99 pop', '99*', '99 ', 'taxi', 'posto', 'combustivel', 'gasolina', 'etanol', 'alcool', 'diesel', 'ipiranga', 'shell', 'petrobras', 'br mania', 'estacionamento', 'parking', 'indigo', 'sem parar', 'veloe', 'conectcar', 'pedagio', 'onibus', 'metro', 'trem', 'bilhete unico', 'passagem', 'oficina', 'mecanico', 'pneu', 'ipva', 'detran', 'lavajato']],
  ['Lanche/Delivery', ['ifood', 'ifd*', 'rappi', 'ze delivery', 'aiqfome', 'uber eats', 'lanche', 'lanchonete', 'pizza', 'pizzaria', 'burger', 'hamburguer', 'mcdonalds', 'mc donalds', 'burger king', 'outback', 'restaurante', 'churrascaria', 'padoca', 'cafeteria', 'cafe', 'sorvete', 'sorveteria', 'acai', 'boteco', 'pastel', 'sushi', 'delivery', 'almoco', 'jantar']],
  ['Mercado', ['mercado', 'supermercado', 'atacadao', 'assai', 'carrefour', 'pao de acucar', 'guanabara', 'mundial', 'zaffari', 'angeloni', 'condor', 'koch', 'padaria', 'panificadora', 'acougue', 'hortifruti', 'feira', 'sacolao', 'mercearia', 'minimercado', 'oxxo']],
  ['Compras online', ['mercado livre', 'mercadolivre', 'meli', 'shopee', 'amazon', 'magalu', 'magazine luiza', 'casas bahia', 'ponto frio', 'americanas', 'aliexpress', 'shein', 'kabum', 'pichau', 'terabyte', 'enjoei']],
  ['Vestuário', ['roupa', 'vestuario', 'calcado', 'tenis', 'sapato', 'camisa', 'calca', 'vestido', 'renner', 'riachuelo', 'c&a', 'zara', 'hering', 'marisa', 'pernambucanas', 'centauro', 'netshoes', 'decathlon', 'nike', 'adidas', 'arezzo', 'melissa', 'costureira']],
  ['Beleza', ['salao', 'barbearia', 'cabelo', 'cabeleireiro', 'manicure', 'unha', 'estetica', 'depilacao', 'maquiagem', 'perfume', 'cosmetico', 'boticario', 'natura', 'avon', 'sephora', 'eudora']],
  ['Educação', ['escola', 'colegio', 'faculdade', 'universidade', 'curso', 'livro', 'livraria', 'papelaria', 'material escolar', 'creche', 'idiomas', 'ingles', 'udemy', 'alura', 'coursera']],
  ['Casa', ['ferragens', 'ferramenta', 'leroy merlin', 'telhanorte', 'sodimac', 'obramax', 'tok&stok', 'tokstok', 'camicado', 'moveis', 'eletro', 'geladeira', 'fogao', 'maquina de lavar', 'colchao', 'decoracao', 'utensilio', 'petz', 'cobasi', 'racao', 'veterinario', 'petshop', 'pet shop']],
  ['Lazer', ['cinema', 'ingresso', 'show', 'teatro', 'parque', 'viagem', 'hotel', 'pousada', 'airbnb', 'booking', 'decolar', 'latam', 'festa', 'passeio', 'clube', 'lazer', 'bar']]
];

const KW_IN = [
  ['Aluguel recebido', ['aluguel']],
  ['Reembolso', ['reembolso', 'estorno', 'devolucao', 'cashback']],
  ['Vendas', ['venda', 'cliente', 'comissao', 'encomenda', 'freela', 'servico']],
  ['Renda extra', ['bico', 'renda extra', 'hora extra', 'bonus', 'dividendo']],
  ['Ajuda/Presente', ['presente', 'ajuda', 'mesada', 'doacao recebida']],
  ['Salário', ['salario', 'pagamento', 'holerite', 'pro-labore', 'prolabore', '13o', 'decimo terceiro', 'ferias', 'adiantamento', 'remuneracao']]
];

export function guessCategory(text, kind = 'out', csvCategory = '') {
  const combined = ' ' + normStr((csvCategory ? csvCategory + ' ' : '') + (text || '')) + ' ';
  if (csvCategory) {
    const exactList = kind === 'in' ? CATS_IN : CATS_OUT;
    const foundExact = exactList.find(c => normStr(c) === normStr(csvCategory));
    if (foundExact) return foundExact;
  }
  const table = kind === 'in' ? KW_IN : KW_OUT;
  for (const [cat, words] of table) {
    for (const w of words) {
      if (combined.includes(w)) return cat;
    }
  }
  return 'Outros';
}

export function parseInstallment(text) {
  const s = String(text || '');
  // 1. Explícito: "Parcela 2/10", "PARC 02/10", "2 de 10"
  const exp = s.match(/\b(?:parc(?:ela)?\.?\s*)(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i);
  if (exp) {
    const cur = +exp[1], tot = +exp[2];
    if (cur >= 1 && tot >= 2 && cur <= tot && tot <= 120) return { cur, tot };
  }
  // 2. Sufixo de fatura: "LOJA XYZ 02/10" ou "LOJA - 2/6" (sem palavras de data antes)
  const sl = s.match(/(?:^|[\s\-*])(\d{1,2})\/(\d{1,2})(?=\s*$|\s*[-–)])/);
  if (sl) {
    const cur = +sl[1], tot = +sl[2];
    const before = normStr(s.slice(0, sl.index));
    if (!/\b(dia|data|em|venc|ref)$/.test(before) && cur >= 1 && tot >= 2 && cur <= tot && tot <= 48) {
      return { cur, tot };
    }
  }
  // 3. Formato curto: "3x", "em 10x"
  const nx = s.match(/\b(?:em\s+)?(\d{1,2})\s*x\b/i);
  if (nx) {
    const tot = +nx[1];
    if (tot >= 2 && tot <= 120) return { cur: 1, tot };
  }
  return null;
}

const IGNORE_DESC_RE = /^(saldo\s+(anterior|do\s+dia|final|parcial|total|atual|bloqueado)|s\s*a\s*l\s*d\s*o)$/i;
const CARD_PAYMENT_RE = /\b(pagamento\s+recebido|pagamento\s+efetuado|pagto\s+fatura|pagamento\s+de\s+fatura|pagamento\s+fatura|debito\s+automatico\s+(de\s+)?fatura)\b/i;

/* ---------- leitor OFX (SGML v1 e XML v2) ---------- */
export function parseOFX(input, options = {}) {
  const text = decodeBankFile(input);
  const isCard = options.isCard ?? /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(text);
  const blocks = [];
  const reBlock = /<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi;
  let m;
  while ((m = reBlock.exec(text)) !== null) {
    blocks.push(m[1]);
  }

  const getTag = (blk, tag) => {
    const r = new RegExp(`<${tag}>\\s*([^<\\r\\n]+)`, 'i').exec(blk);
    return r ? r[1].trim() : '';
  };

  const rawRows = [];
  for (const blk of blocks) {
    const trnType = getTag(blk, 'TRNTYPE').toUpperCase();
    const dtPosted = getTag(blk, 'DTPOSTED');
    const trnAmt = getTag(blk, 'TRNAMT');
    const name = getTag(blk, 'NAME');
    const memo = getTag(blk, 'MEMO');
    const fitid = getTag(blk, 'FITID');

    const date = parseBRDate(dtPosted);
    let amt = parseBRNumber(trnAmt);
    if (!date || Number.isNaN(amt) || Math.abs(amt) < 0.005) continue;

    if (trnType === 'DEBIT' && amt > 0) amt = -amt;

    let desc = name && memo
      ? (normStr(memo).includes(normStr(name)) ? memo : normStr(name).includes(normStr(memo)) ? name : `${name} - ${memo}`)
      : (memo || name || 'Lançamento');
    desc = desc.replace(/\s+/g, ' ').trim();

    if (IGNORE_DESC_RE.test(normStr(desc))) continue;
    rawRows.push({ date, desc, amt, trnType, fitid });
  }

  return { ...normalizeBankRows(rawRows, { ...options, format: 'ofx', isCard }), rawText: text };
}

/* ---------- leitor CSV (bancos brasileiros) ---------- */
function splitCSVLine(line, delim) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === delim && !inQ) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function detectDelimiter(lines) {
  const candidates = [';', ',', '\t'];
  let best = ';', bestScore = -1;
  const sample = lines.slice(0, 25);
  for (const d of candidates) {
    const counts = sample.map(l => splitCSVLine(l, d).length).filter(c => c > 1);
    if (!counts.length) continue;
    const freq = {};
    for (const c of counts) freq[c] = (freq[c] || 0) + 1;
    const topCount = Math.max(...Object.values(freq));
    const score = topCount * 10 + Math.max(...counts);
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

export function parseCSV(input, options = {}) {
  const text = decodeBankFile(input);
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { format: 'csv', isCard: !!options.isCard, items: [] };

  const delim = detectDelimiter(lines);
  const rows = lines.map(l => splitCSVLine(l, delim));
  const defaultYear = options.defaultYear || today().slice(0, 4);

  // Localiza linha de cabeçalho (pode estar após linhas de metadados do banco)
  let headerIdx = -1;
  let colMap = null;

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cols = rows[i].map(normStr);
    const iDate = cols.findIndex(c => /^(data|date|dt\.?\s*lanc|data\s+lanc|data\s+mov|dia)/.test(c));
    const iDesc = cols.findIndex((c, idx) => idx !== iDate && /^(descri|hist|title|titulo|lancamento|estabelecimento|memo|detalhe|nome|transacao)/.test(c));
    const iAmt = cols.findIndex(c => /^(valor|amount|vlr|total|valor\s*\(?r\$\)?)/.test(c));
    const iCred = cols.findIndex(c => /^(credito|entrada|valor\s+credito)/.test(c));
    const iDeb = cols.findIndex(c => /^(debito|saida|valor\s+debito)/.test(c));
    const iCat = cols.findIndex(c => /^(categoria|category)/.test(c));
    const iType = cols.findIndex(c => /^(tipo|natureza|d\/c|sinal|operacao)/.test(c));
    const iComp = cols.findIndex((c, idx) => idx !== iDesc && /^(complemento|observacao|obs)/.test(c));

    if (iDate !== -1 && (iAmt !== -1 || (iCred !== -1 && iDeb !== -1))) {
      headerIdx = i;
      colMap = { iDate, iDesc, iAmt, iCred, iDeb, iCat, iType, iComp };
      break;
    }
  }

  let isCard = options.isCard;
  const rawRows = [];
  const startRow = headerIdx !== -1 ? headerIdx + 1 : 0;

  for (let i = startRow; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 2) continue;

    let date = null, desc = '', amt = NaN, csvCat = '';

    if (colMap) {
      date = parseBRDate(r[colMap.iDate], defaultYear);
      if (!date) continue;
      desc = colMap.iDesc !== -1 ? (r[colMap.iDesc] || '') : '';
      if (colMap.iComp !== -1 && r[colMap.iComp] && !normStr(desc).includes(normStr(r[colMap.iComp]))) {
        desc = desc ? `${desc} - ${r[colMap.iComp]}` : r[colMap.iComp];
      }
      if (!desc) {
        // Pega a primeira coluna textual que não seja data nem valor
        const idx = r.findIndex((v, k) => k !== colMap.iDate && k !== colMap.iAmt && k !== colMap.iCat && v && Number.isNaN(parseBRNumber(v)));
        if (idx !== -1) desc = r[idx];
      }
      if (colMap.iCat !== -1) csvCat = r[colMap.iCat] || '';

      if (colMap.iAmt !== -1) {
        amt = parseBRNumber(r[colMap.iAmt]);
      } else {
        const cr = parseBRNumber(r[colMap.iCred]);
        const db = parseBRNumber(r[colMap.iDeb]);
        if (!Number.isNaN(db) && Math.abs(db) > 0) amt = -Math.abs(db);
        else if (!Number.isNaN(cr) && Math.abs(cr) > 0) amt = Math.abs(cr);
      }

      if (colMap.iType !== -1 && !Number.isNaN(amt)) {
        const tp = normStr(r[colMap.iType]);
        if (/^(d|deb|debito|saida|despesa|-)/.test(tp) && amt > 0) amt = -amt;
        else if (/^(c|cred|credito|entrada|receita|\+)/.test(tp) && amt < 0) amt = Math.abs(amt);
      }
    } else {
      // CSV sem cabeçalho: detecta coluna de data, valor e descrição na linha
      let iDate = -1, iAmt = -1;
      for (let k = 0; k < r.length; k++) {
        if (iDate === -1 && parseBRDate(r[k], defaultYear)) {
          date = parseBRDate(r[k], defaultYear);
          iDate = k;
        }
      }
      if (iDate === -1) continue;
      for (let k = r.length - 1; k >= 0; k--) {
        if (k === iDate) continue;
        const n = parseBRNumber(r[k]);
        if (!Number.isNaN(n) && /\d/.test(r[k])) {
          amt = n;
          iAmt = k;
          break;
        }
      }
      if (iAmt === -1) continue;
      desc = r.filter((_, k) => k !== iDate && k !== iAmt).join(' - ');
    }

    desc = String(desc || 'Lançamento').replace(/\s+/g, ' ').trim();
    if (!date || Number.isNaN(amt) || Math.abs(amt) < 0.005) continue;
    if (IGNORE_DESC_RE.test(normStr(desc))) continue;

    rawRows.push({ date, desc, amt, csvCat });
  }

  // Se isCard não foi passado explicitamente, detecta formato de fatura Nubank (colunas date,category,title,amount ou presença de "Pagamento recebido")
  if (isCard === undefined) {
    const headerStr = headerIdx !== -1 ? rows[headerIdx].map(normStr).join(',') : '';
    if (headerStr === 'date,category,title,amount' || rawRows.some(x => CARD_PAYMENT_RE.test(normStr(x.desc)))) {
      isCard = true;
    } else {
      isCard = false;
    }
  }

  return { ...normalizeBankRows(rawRows, { ...options, format: 'csv', isCard }), rawText: text };
}

function normalizeBankRows(rawRows, { format, isCard }) {
  const items = [];
  if (isCard) {
    // Em faturas de cartão: filtra pagamento da própria fatura
    const valid = rawRows.filter(r => !CARD_PAYMENT_RE.test(normStr(r.desc)));
    // Verifica convenção de sinal: alguns bancos (Itaú/Bradesco OFX) trazem compras negativas; outros (Nubank CSV) trazem compras positivas
    const negCount = valid.filter(r => r.amt < 0).length;
    const posCount = valid.filter(r => r.amt > 0).length;
    const purchasesAreNegative = negCount > posCount;

    for (const r of valid) {
      const isPurchase = purchasesAreNegative ? r.amt < 0 : r.amt > 0;
      if (!isPurchase) continue;
      const amount = round2(Math.abs(r.amt));
      const inst = parseInstallment(r.desc);
      const cat = guessCategory(r.desc, 'out', r.csvCat);
      items.push({ date: r.date, desc: r.desc.slice(0, 80), amount, type: 'out', cat, inst, fitid: r.fitid || null });
    }
  } else {
    // Conta corrente / carteira: negativos são saídas ('out'), positivos são entradas ('in')
    for (const r of rawRows) {
      const type = r.amt < 0 ? 'out' : 'in';
      const amount = round2(Math.abs(r.amt));
      const inst = type === 'out' ? parseInstallment(r.desc) : null;
      const cat = guessCategory(r.desc, type, r.csvCat);
      items.push({ date: r.date, desc: r.desc.slice(0, 80), amount, type, cat, inst, fitid: r.fitid || null });
    }
  }
  return { format, isCard: !!isCard, items };
}

export function parseBankFile(input, filename = '', options = {}) {
  const text = decodeBankFile(input);
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.ofx') || /<OFX>|<STMTTRN>/i.test(text)) {
    return parseOFX(text, options);
  }
  return parseCSV(text, options);
}

export function toLoteOps(parsed, { payKey, bill, personId = '', titulo = '' } = {}, st = S.st) {
  const pk = payKey || (parsed.isCard && st?.cards?.[0] ? 'c:' + st.cards[0].id : defPay(st));
  const pInfo = pay(pk, st);
  const isCard = pInfo?.type === 'card';
  const accId = isCard ? (pInfo.acc?.id || firstBank(st)) : (pk.startsWith('a:') ? pk.slice(2) : firstBank(st));

  const ops = [];
  for (const it of parsed.items || []) {
    if (isCard || it.type === 'out') {
      const rec = {
        t: 'gas',
        date: it.date,
        desc: it.desc,
        cat: CATS_OUT.includes(it.cat) ? it.cat : 'Outros',
        personId,
        pay: pk,
        amount: round2(it.amount),
        cut: it.inst ? 'com' : (CAT_CUT[it.cat] || null),
        inst: it.inst ? { cur: it.inst.cur, tot: it.inst.tot } : null,
        refund: null,
        bill: null,
        total: null
      };
      if (isCard && isYM(bill)) {
        const auto = firstYM(rec, st);
        if (auto !== bill) rec.bill = bill;
      }
      ops.push({ op: 'add', rec });
    } else {
      const rec = {
        t: 'ent',
        desc: it.desc,
        cat: CATS_IN.includes(it.cat) ? it.cat : 'Outros',
        personId,
        accountId: accId,
        day: +it.date.slice(8, 10),
        amount: round2(it.amount),
        from: ymOf(it.date),
        to: null,
        once: true,
        ov: {},
        comp: null
      };
      ops.push({ op: 'add', rec });
    }
  }
  return { lote: 1, titulo: titulo || 'Extrato importado', ops, rawParsed: parsed, payKey: pk, bill: bill || S.month };
}

/* ---------- interpretador por regras/Regex da Entrada Rápida ---------- */
export function parseQuickEntry(phrase, st = S.st, refDate = today()) {
  const raw = String(phrase || '').trim();
  if (!raw) return null;

  // 1. Detecta parcelas (ex.: "3x", "em 10x") antes de extrair o valor para não confundir "3x" com valor
  const inst = parseInstallment(raw);
  let working = raw
    .replace(/\b(?:parc(?:ela)?\.?\s*)\d{1,2}\s*(?:\/|de)\s*\d{1,2}\b/gi, ' ')
    .replace(/\b(?:em\s+)?\d{1,2}\s*x\b/gi, ' ');

  // 2. Detecta data explícita ("ontem", "hoje", "DD/MM" ou "DD/MM/AAAA")
  let date = refDate;
  if (/\bontem\b/i.test(working)) {
    const [y, m, d] = refDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d - 1);
    date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    working = working.replace(/\bontem\b/gi, ' ');
  } else if (/\bhoje\b/i.test(working)) {
    working = working.replace(/\bhoje\b/gi, ' ');
  } else {
    const dmMatch = working.match(/\b(\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)\b/);
    if (dmMatch) {
      const parsedD = parseBRDate(dmMatch[1], refDate.slice(0, 4));
      if (parsedD) {
        date = parsedD;
        working = working.replace(dmMatch[0], ' ');
      }
    }
  }

  // 3. Extrai o valor monetário (ignorando "99" de "99app" / "99 pop")
  let amount = NaN;
  const protectedWorking = working.replace(/\b99\s*(?:app|pop|\*)/gi, m => m.replace('99', '__NINETYNINE__'));
  const valRegex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{1,2}|\d+,\d{1,2}|\d+\.\d{1,2}|\d+)/g;
  let vm;
  while ((vm = valRegex.exec(protectedWorking)) !== null) {
    const num = parseBRNumber(vm[1]);
    if (!Number.isNaN(num) && num > 0) {
      amount = round2(num);
      working = protectedWorking.slice(0, vm.index) + ' ' + protectedWorking.slice(vm.index + vm[0].length);
      working = working.replace(/__NINETYNINE__/g, '99');
      break;
    }
  }
  if (Number.isNaN(amount) || !(amount > 0)) return null;

  // 4. Detecta se é entrada ('in') ou saída ('out')
  const nFull = normStr(raw);
  const isIncome = /\b(recebi|ganhei|entrada|salario|reembolso|aluguel\s+recebido|renda\s+extra|bico)\b/.test(nFull);
  const kind = isIncome ? 'in' : 'out';

  // 5. Detecta forma de pagamento (pix, débito, crédito/cartão, dinheiro/carteira) e nome específico de conta/cartão
  let payType = null;
  if (/\b(credito|cart[aã]o|cr[eé]d)\b/i.test(nFull) || inst) payType = 'credito';
  else if (/\b(dinheiro|carteira|esp[eé]cie)\b/i.test(nFull)) payType = 'dinheiro';
  else if (/\b(d[eé]bito|deb)\b/i.test(nFull)) payType = 'debito';
  else if (/\b(pix)\b/i.test(nFull)) payType = 'pix';

  let payKey = '';
  let accountId = '';

  const cards = st?.cards || [];
  const accounts = st?.accounts || [];

  // Verifica se o nome de algum cartão específico foi citado (ex.: "roxo", "laranja", "nubank")
  let matchedCard = null;
  for (const c of cards) {
    const cWords = normStr(c.name).split(/\s+/).filter(w => w.length > 2 && w !== 'cartao');
    if (normStr(c.name) && (nFull.includes(normStr(c.name)) || cWords.some(w => new RegExp(`\\b${w}\\b`).test(nFull)))) {
      matchedCard = c;
      break;
    }
  }

  // Verifica se o nome de alguma conta específica foi citado
  let matchedAcc = null;
  for (const a of accounts) {
    const aWords = normStr(a.name).split(/\s+/).filter(w => w.length > 2 && w !== 'conta' && w !== 'banco');
    if (normStr(a.name) && (nFull.includes(normStr(a.name)) || aWords.some(w => new RegExp(`\\b${w}\\b`).test(nFull)))) {
      matchedAcc = a;
      break;
    }
  }

  if (matchedCard && kind === 'out') {
    payType = 'credito';
    payKey = 'c:' + matchedCard.id;
  } else if (payType === 'credito' && cards.length) {
    payKey = 'c:' + cards[0].id;
  } else if (payType === 'dinheiro') {
    const wal = accounts.find(a => isWallet(a)) || accounts[0];
    if (wal) { payKey = 'a:' + wal.id; accountId = wal.id; }
  } else if (matchedAcc) {
    payKey = 'a:' + matchedAcc.id;
    accountId = matchedAcc.id;
    if (!payType) payType = isWallet(matchedAcc) ? 'dinheiro' : 'pix';
  } else {
    const fb = firstBank(st);
    if (fb) { payKey = 'a:' + fb; accountId = fb; }
    else if (cards.length && kind === 'out') { payKey = 'c:' + cards[0].id; payType = payType || 'credito'; }
  }

  // 6. Limpa a descrição removendo tokens de pagamento e verbos auxiliares
  let desc = working
    .replace(/\b(gastei|paguei|comprei|lancei|recebi|ganhei|entrada|saida|saída)\b/gi, ' ')
    .replace(/\b(no\s+pix\s+cr[eé]dito|pix\s+cr[eé]dito|no\s+pix|via\s+pix|por\s+pix|pix)\b/gi, ' ')
    .replace(/\b(no\s+cr[eé]dito|cr[eé]dito|no\s+d[eé]bito|d[eé]bito|no\s+cart[aã]o|cart[aã]o|em\s+dinheiro|no\s+dinheiro|dinheiro|na\s+carteira|carteira)\b/gi, ' ');

  if (matchedCard) {
    for (const w of matchedCard.name.split(/\s+/)) {
      if (w.length > 2) desc = desc.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ');
    }
  }

  desc = desc
    .replace(/^\s*(no|na|em|de|do|da|com|para|por)\s+/i, '')
    .replace(/\s+(no|na|em|de|do|da|com|para|por)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 7. Identifica categoria por palavras-chave
  const isPixCredito = /\bpix\s+(?:no\s+)?cr[eé]dito\b/i.test(nFull);
  const cat = isPixCredito ? 'Pix crédito' : guessCategory(desc || raw, kind);

  if (!desc) {
    desc = cat !== 'Outros' ? cat : (kind === 'in' ? 'Entrada' : 'Gasto');
  } else {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  const cut = kind === 'out' ? (inst ? 'com' : (CAT_CUT[cat] || null)) : null;

  return {
    kind,
    amount,
    desc,
    cat,
    payType,
    pay: payKey || defPay(st),
    accountId: accountId || firstBank(st),
    date,
    inst,
    cut
  };
}
