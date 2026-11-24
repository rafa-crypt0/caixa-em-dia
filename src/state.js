/* ---------- vocabulário e estado global ---------- */
const pad = n => String(n).padStart(2, '0');
const initYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MESL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const CATS_OUT = ['Moradia', 'Contas da casa', 'Mercado', 'Saúde', 'Transporte', 'Telefone/Internet', 'Educação', 'Assinaturas', 'Lanche/Delivery', 'Compras online', 'Vestuário', 'Beleza', 'Casa', 'Lazer', 'Pix crédito', 'Presentes', 'Dízimo/Doações', 'Tarifas e juros', 'Consórcio/Empréstimo', 'Outros'];
export const CATS_IN = ['Salário', 'Aluguel recebido', 'Vendas', 'Renda extra', 'Ajuda/Presente', 'Reembolso', 'Outros'];
export const INV_TYPES = ['Poupança', 'CDB / RDB', 'Tesouro Direto', 'Ações', 'Fundos', 'Previdência', 'Cripto', 'Outros'];
export const CUTS = {
  ess: { l: 'Essencial', h: 'não dá para cortar', c: '--c-ess' },
  com: { l: 'Compromisso', h: 'parcela já assumida', c: '--c-com' },
  red: { l: 'Reduzir', h: 'precisa, mas dá para gastar menos', c: '--c-red' },
  cor: { l: 'Cortar', h: 'dá para tirar', c: '--c-cor' }
};
export const CAT_CUT = {
  'Moradia': 'ess', 'Contas da casa': 'ess', 'Mercado': 'ess', 'Saúde': 'ess',
  'Transporte': 'red', 'Telefone/Internet': 'red', 'Educação': 'red',
  'Assinaturas': 'cor', 'Lanche/Delivery': 'cor', 'Compras online': 'cor',
  'Vestuário': 'cor', 'Beleza': 'red', 'Casa': 'red', 'Lazer': 'cor',
  'Pix crédito': 'cor', 'Presentes': 'red', 'Tarifas e juros': 'cor',
  'Consórcio/Empréstimo': 'com'
};
export const RED_DEFAULT = {
  'Lanche/Delivery': .6, 'Assinaturas': .5, 'Compras online': .7,
  'Vestuário': .6, 'Lazer': .5, 'Tarifas e juros': 1,
  'Transporte': .15, 'Telefone/Internet': .2, 'Beleza': .3,
  'Casa': .3, 'Educação': .1
};
export const EXP = { fix: 1, var: 1, loan: 1, fd: 1 };
export const RO_MSG = 'Você pode ver, mas não lançar. Peça ao dono da casa para mudar o seu papel.';
/* papéis na casa: dono (quem criou), editor, leitor (só vê) e dep (dependente: vê só o que lançou, a não ser que o dono libere) */
export const PAPEIS = { dono: 'Dono', editor: 'Editor', leitor: 'Só leitura', dep: 'Dependente' };
export const CFGT = { cfg: 1, pes: 1, cta: 1, car: 1 };
/* registros: cfg, pes (pessoa), cta (conta), car (cartão), ent (entrada), fix (gasto fixo), gas (gasto), tra (transferência),
   emp (empréstimo), inv (investimento), mov (movimento de investimento), con (conferência de saldo), fat (fatura paga), mes (mês fechado) */
export const DATED = { gas: 1, tra: 1, mov: 1, con: 1 };
export const HORAS_PADRAO = 220;

export const S = {
  recs: {},
  st: null,
  mode: 'demo',
  month: initYM(),
  tab: 'resumo',
  f: { kind: 'all', cut: null, person: null, pay: null, cat: null, q: '' },
  downloads: null,
  user: null,
  me: null,
  ro: false,
  names: {},
  namesKey: '',
  showTable: false,
  redAll: false,
  pendingRestore: null,
  pend: false,
  wiping: false,
  dbChecked: false,
  phase: 'loading',
  fb: null,
  cid: null,
  casa: null,
  uname: '',
  invite: null,
  authMode: 'login',
  installEvt: null,
  iaEnabled: false,
  updateReady: false,
  swReg: null
};

if (typeof window !== 'undefined') {
  window.S = S;
}

export const donoUid = () => S.casa ? (S.casa.dono || (S.casa.membros || [])[0]) : null;
export const papelDe = uid => !S.casa ? 'dono' : uid === donoUid() ? 'dono' : (S.casa.papeis?.[uid] || 'editor');
export const papel = () => S.casa && S.cid ? papelDe(S.me) : 'dono';
export const isDono = () => papel() === 'dono';
export const veTudo = () => papel() !== 'dep' || !!S.casa?.verTudo?.[S.me];
export const autorDe = r => r.by || donoUid() || S.me;
export const souAutor = r => S.mode !== 'db' || !r || !!CFGT[r.t] || autorDe(r) === S.me;
export const nomeDe = uid => uid === S.me ? 'você' : (S.names[uid] || 'alguém da casa');
