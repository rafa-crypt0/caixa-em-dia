import {
  S, DATED, CFGT, RO_MSG, PAPEIS, EXP, CUTS,
  papel, isDono, veTudo, autorDe, souAutor, nomeDe
} from './state.js';
import {
  pad, today, curYM, isDate, uid, round2, fDY, ymL, pname, val,
  buildState, invalidate, demoRecs, v1ToRecs
} from './calc.js';
import { $, toast, render, scheduleRender, filteredLines } from './ui/utils.js';

/* ---------- persistência ---------- */
export const LS1 = 'caixa-em-dia:v1';
export const LS2 = 'caixa-em-dia:v2';
export const LSC = uid => 'caixa-em-dia:casa:' + uid;

export function lsGet(k) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const s = localStorage.getItem(k);
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}
export function lsSet(k, v) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch (e) { return false; }
}
export function lsDel(k) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
  } catch (e) {}
}

export const tempoOn = () => lsGet('caixa-em-dia:horas') !== false;

export const DB = { db: null, subs: {}, unsubs: {}, chain: {}, pw: {}, pd: {}, casaUnsub: null };

export function recPath(r) {
  return DATED[r.t] && isDate(r.date) ? `ano/${r.date.slice(0, 4)}/reg/${r.id}` : `casa/${r.id}`;
}
export const subKey = path => path.startsWith('casa/') ? 'casa' : path.split('/').slice(0, 3).join('/');

export function body(r) {
  const o = {};
  for (const [k, v] of Object.entries(r)) {
    if (k === 'id' || v === undefined) continue;
    o[k] = v;
  }
  return toFS(o);
}
/* o Firestore não aceita "/" em nomes de campo: as reduções por categoria vão como lista */
export const toFS = b => b.reduce && !Array.isArray(b.reduce) ? { ...b, reduce: Object.entries(b.reduce).map(([c, v]) => ({ c, v })) } : b;
export const fromFS = b => b && Array.isArray(b.reduce) ? { ...b, reduce: Object.fromEntries(b.reduce.map(x => [x.c, x.v])) } : b;

export function setRecs(list) {
  S.recs = {};
  for (const r of list) if (r && r.id && r.t) S.recs[r.id] = r;
  rebuild();
}

export function rebuild() {
  S.st = buildState(S.recs);
  invalidate();
  scheduleRender();
  resolveNames();
}

export function stamp(r) {
  r = { ...r };
  if (!r.id) r.id = uid();
  if (!r.c) r.c = Date.now();
  if (S.me && !r.by && S.mode !== 'demo') r.by = S.me;
  return r;
}

export function put(r, msg) {
  if (S.ro && S.mode !== 'demo') { toast(RO_MSG); return false; }
  const o = r.id && S.recs[r.id];
  if (o && !souAutor(o)) return pedir(o, 'edit', r);
  return putRaw(r, msg);
}

export function putRaw(r, msg) {
  r = stamp(r);
  const old = S.recs[r.id];
  S.recs[r.id] = r;
  rebuild();
  if (msg) toast(msg);
  if (S.mode === 'local') saveLocal();
  else if (S.mode === 'db' && DB.db) {
    const p = recPath(r), op = old ? recPath(old) : null;
    if (op && op !== p) dbDel(op);
    ensureSub(subKey(p));
    delete DB.pd[r.id];
    DB.pw[r.id] = r;
    dbSet(p, body(r)).finally(() => { if (DB.pw[r.id] === r) delete DB.pw[r.id]; });
  }
  return true;
}

export function drop(id, msg) {
  if (S.ro && S.mode !== 'demo') { toast(RO_MSG); return; }
  const o = S.recs[id];
  if (o && !souAutor(o)) return pedir(o, 'del');
  dropRaw(id, msg);
}

export function dropRaw(id, msg) {
  const old = S.recs[id];
  if (!old) return;
  delete S.recs[id];
  rebuild();
  if (msg) toast(msg);
  if (S.mode === 'local') saveLocal();
  else if (S.mode === 'db' && DB.db) {
    delete DB.pw[id];
    DB.pd[id] = 1;
    dbDel(recPath(old)).finally(() => { delete DB.pd[id]; });
  }
}

/* ---------- pedidos: só quem lançou altera ou apaga; os outros pedem ---------- */
export const SKIPK = { id: 1, c: 1, by: 1, ped: 1 };
export function pedir(o, tipo, novo) {
  if (papel() !== 'dono' && papel() !== 'editor') { toast('Só quem lançou pode mudar isso.'); return false; }
  let mud = null;
  if (tipo === 'edit') {
    mud = {};
    for (const k of new Set([...Object.keys(o), ...Object.keys(novo)])) {
      if (SKIPK[k]) continue;
      const a = o[k] === undefined ? null : o[k], b = novo[k] === undefined ? null : novo[k];
      if (JSON.stringify(a) !== JSON.stringify(b)) mud[k] = b;
    }
    if (!Object.keys(mud).length) { toast('Nada mudou.'); return false; }
  }
  putRaw({ ...o, ped: { tipo, por: S.me, em: Date.now(), ...(mud ? { novo: mud } : {}) } });
  toast(`Pedido enviado. ${nomeDe(autorDe(o))} precisa aprovar.`);
  return true;
}

export function pedOk(id) {
  const r = S.recs[id];
  if (!r || !r.ped) return;
  const p = r.ped;
  if (p.tipo === 'del') { dropRaw(id, 'Pedido aprovado: lançamento apagado.'); return; }
  const n = { ...r, ...(p.novo || {}) };
  delete n.ped;
  putRaw(n, 'Pedido aprovado: lançamento alterado.');
}

export function pedNo(id, msg) {
  const r = S.recs[id];
  if (!r || !r.ped) return;
  const n = { ...r };
  delete n.ped;
  putRaw(n, msg || 'Pedido recusado.');
}

let SAVING = 0;
export const isSaving = () => SAVING > 0;
export const progToast = (d, t) => { if (d === 1 || d % 10 === 0 || d === t) toast(`Salvando no banco… ${d} de ${t}. Não feche o app.`); };

export async function putMany(list, onProg) {
  list = list.map(stamp);
  for (const r of list) S.recs[r.id] = r;
  rebuild();
  if (S.mode === 'local') { saveLocal(); return; }
  if (S.mode !== 'db' || !DB.db) return;
  const q = list.slice();
  let done = 0;
  SAVING += list.length;
  const worker = async () => {
    while (q.length) {
      const r = q.shift(), p = recPath(r);
      ensureSub(subKey(p));
      DB.pw[r.id] = r;
      try { await dbSet(p, body(r)); } finally { SAVING--; }
      if (DB.pw[r.id] === r) delete DB.pw[r.id];
      done++;
      onProg && onProg(done, list.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}

export function saveLocal() {
  if (!lsSet(LS2, { v: 2, recs: Object.values(S.recs) })) toast('Este navegador não deixou salvar. Baixe um backup em Ajustes.');
}

export function loadLocal() {
  const v2 = lsGet(LS2);
  if (v2 && Array.isArray(v2.recs) && v2.recs.length) {
    const recs = v2.recs.filter(r => r && r.id && r.t);
    if (recs.length) return recs;
  }
  const v1 = lsGet(LS1);
  if (v1 && Array.isArray(v1.accounts)) {
    const recs = v1ToRecs(v1);
    if (recs.length) return recs;
  }
  return null;
}

export function dbOp(path, fn) {
  const run = () => fn().catch(e => {
    if (e && e.code === 'unavailable') return new Promise(r => setTimeout(r, 700 + Math.random() * 1300)).then(fn);
    throw e;
  });
  const p = (DB.chain[path] || Promise.resolve()).then(run).catch(dbFail);
  DB.chain[path] = p;
  return p;
}
export const dbop = dbOp;

export const dbSet = (path, data) => dbOp(path, () => DB.db.doc(path).set(data));
export const dbDel = path => dbOp(path, () => DB.db.doc(path).delete());

let failT = 0;
export function dbFail(e) {
  const c = e && e.code;
  setTimeout(() => { if (DB.db) mergeSubs(); }, 50);
  if (c === 'resource-exhausted') toast('O limite gratuito do dia acabou. Amanhã volta ao normal.');
  else if (c === 'permission-denied') toast('Sem permissão para salvar. Confira se você ainda está na casa.');
  else if (Date.now() - failT > 5000) { failT = Date.now(); toast('Não consegui salvar agora. Confira a internet e lance de novo se o item sumir.'); }
}

export function syncPapel() {
  S.ro = papel() === 'leitor';
  const v = veTudo();
  if (S.veTudo0 !== undefined && S.veTudo0 !== v && DB.db) resubscribe();
  S.veTudo0 = v;
}

/* quem vê tudo lê a coleção inteira; o dependente lê só a configuração da casa e o que ele lançou */
export function qParts(key) {
  const c = DB.db.collection(key);
  if (veTudo()) return [c];
  const mine = c.where('by', '==', S.me);
  return key === 'casa' ? [c.where('t', 'in', Object.keys(CFGT)), mine] : [mine];
}

export function ensureSub(key) {
  if (!DB.db || DB.unsubs[key]) return;
  const qs = qParts(key), parts = new Array(qs.length).fill(null);
  const offs = qs.map((q, i) => q.onSnapshot(s => {
    const map = {};
    for (const d of s.docs) {
      const b = fromFS(d.data());
      if (b && b.t) map[d.id] = { ...b, id: d.id };
    }
    parts[i] = map;
    if (parts.some(x => x === null)) return;
    onSnap(key, Object.assign({}, ...parts), s.metadata.fromCache);
  }, e => {
    if (DB.unsubs[key] === off) {
      off();
      delete DB.unsubs[key];
      if (e && e.code === 'unavailable') setTimeout(() => ensureSub(key), 3000);
    }
  }));
  const off = () => offs.forEach(f => { try { f(); } catch (e) {} });
  DB.unsubs[key] = off;
}

export function resubscribe() {
  for (const f of Object.values(DB.unsubs)) try { f(); } catch (e) {}
  DB.unsubs = {};
  DB.subs = {};
  subscribeAll();
}

export function subscribeAll() {
  if (!DB.db) return;
  ensureSub('casa');
  const sy = +S.st.start.slice(0, 4), cy = +curYM().slice(0, 4);
  for (let y = Math.min(sy, cy) - 2; y <= cy + 1; y++) ensureSub(`ano/${y}/reg`);
}

export function onSnap(key, map, fromCache) {
  DB.subs[key] = map;
  if (key === 'casa' && (!fromCache || Object.keys(map).length > 0) && !S.dbChecked) {
    S.dbChecked = true;
    scheduleRender();
  }
  mergeSubs();
}

export function mergeSubs() {
  if (S.wiping) return;
  const u = {};
  for (const m of Object.values(DB.subs)) Object.assign(u, m);
  if (S.mode !== 'db') {
    if (!Object.keys(u).length) return;
    S.mode = 'db';
    S.recs = {};
  }
  for (const r of Object.values(S.recs)) {
    const k = subKey(recPath(r));
    if (!(k in DB.subs)) u[r.id] = r;
  }
  for (const id of Object.keys(DB.pd)) delete u[id];
  for (const r of Object.values(DB.pw)) u[r.id] = r;
  S.recs = u;
  const prevStart = S.st?.start;
  rebuild();
  if (S.st.start !== prevStart) subscribeAll();
  linkMe();
}

export function linkMe() {
  if (S.linked || S.mode !== 'db' || !S.dbChecked || !S.me || !S.recs.cfg) return;
  S.linked = true;
  const ps = S.st.people, norm = x => (x || '').trim().toLowerCase(), nm = (S.uname || '').trim();
  if (ps.some(p => p.uid === S.me)) return;
  const same = nm && ps.find(p => !p.uid && norm(p.name) === norm(nm));
  if (same) put({ ...same, uid: S.me });
  else put({ t: 'pes', name: nm || 'Nova pessoa', uid: S.me, o: ps.length + 1 });
}

export function resolveNames() {}

export function stateFromDocsV1(docs) {
  let cfg = null, items = [];
  for (const d of docs) {
    const b = d.data();
    if (!b) continue;
    if (d.id === 'config') cfg = b.d;
    else if (d.id.startsWith('items-') && Array.isArray(b.items)) items = items.concat(b.items);
  }
  return cfg ? { ...cfg, items } : null;
}

/* ---------- Firebase: login, casa e modos ---------- */
export let FB = null;
export const getFB = () => FB;

export function enterLocal(mode) {
  const localRecs = loadLocal();
  if (localRecs && mode !== 'demo') {
    S.mode = 'local';
    setRecs(localRecs);
  } else {
    S.mode = 'demo';
    setRecs(demoRecs());
  }
  S.dbChecked = true;
  S.phase = 'app';
  render();
}

export function fbInit() {
  const localRecs = loadLocal();
  if (typeof firebase === 'undefined') {
    if (localRecs) { enterLocal(); return; }
    S.phase = 'offline';
    render();
    return;
  }
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || /COLE/.test(cfg.apiKey)) {
    if (localRecs) { enterLocal(); return; }
    S.phase = 'config';
    render();
    return;
  }
  try {
    if (!firebase.apps?.length) firebase.initializeApp(cfg);
  } catch (e) {}
  const fs = firebase.firestore(), auth = firebase.auth();
  if (cfg.emulator) {
    auth.useEmulator('http://127.0.0.1:9099');
    fs.useEmulator('127.0.0.1', 8080);
  }
  try { fs.settings({ ignoreUndefinedProperties: true, merge: true }); } catch (e) {}
  fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  auth.languageCode = 'pt-BR';
  FB = { auth, fs };
  auth.onAuthStateChanged(u => { onUser(u); });
}

export function stopAll() {
  for (const f of Object.values(DB.unsubs)) try { f(); } catch (e) {}
  if (DB.casaUnsub) { try { DB.casaUnsub(); } catch (e) {} DB.casaUnsub = null; }
  DB.unsubs = {}; DB.subs = {}; DB.chain = {}; DB.pw = {}; DB.pd = {}; DB.db = null;
  S.cid = null; S.casa = null; S.invite = null; S.names = {}; S.dbChecked = false; S.linked = false; S.mode = 'demo';
  setRecs(demoRecs());
}

let userSeq = 0;
export async function onUser(u) {
  const seq = ++userSeq;
  const wasMe = S.me;
  stopAll();
  S.fb = u;
  if (!u) {
    if (wasMe) S.authMode = 'login';
    S.me = null;
    const hasInvite = new URLSearchParams(location.search).get('c');
    const localRecs = !hasInvite ? loadLocal() : null;
    if (localRecs && !wasMe) {
      enterLocal();
      return;
    }
    S.phase = 'login';
    render();
    return;
  }
  S.me = u.uid;
  S.uname = u.displayName || S.uname || '';
  S.phase = 'loading';
  render();
  let cid = null, err = null;
  try {
    const d = await FB.fs.doc('usuarios/' + u.uid).get();
    if (d.exists) {
      const b = d.data();
      cid = b.casa || null;
      if (b.nome) S.uname = b.nome;
    }
  } catch (e) {
    err = e;
    cid = lsGet(LSC(u.uid));
  }
  if (seq !== userSeq) return;
  if (cid && await enterCasa(cid, seq)) return;
  /* cadastro faltando ou ilegível: procura a casa em que a pessoa é membro e conserta o cadastro */
  try {
    const q = await FB.fs.collection('casas').where('membros', 'array-contains', u.uid).limit(1).get();
    if (seq !== userSeq) return;
    if (!q.empty) {
      const id = q.docs[0].id;
      FB.fs.doc('usuarios/' + u.uid).set({ casa: id, nome: S.uname || u.displayName || '' }).catch(() => {});
      if (await enterCasa(id, seq)) return;
    } else err = null;
  } catch (e) { err = err || e; }
  if (seq !== userSeq) return;
  if (err && !/permission/.test(err.code || '')) {
    S.gateErr = authMsg(err);
    S.phase = 'retry';
    render();
    return;
  }
  S.phase = 'casa';
  render();
}

export async function enterCasa(cid, seq) {
  let casa = null;
  try {
    const d = await FB.fs.doc('casas/' + cid).get();
    if (!d.exists || !(d.data().membros || []).includes(S.me)) return false;
    casa = d.data();
  } catch (e) {
    if (e && e.code === 'permission-denied') return false;
    /* sem internet: segue com o que está guardado no aparelho */
  }
  if (seq != null && seq !== userSeq) return true;
  S.cid = cid;
  S.casa = casa;
  S.names = casa?.nomes || {};
  lsSet(LSC(S.me), cid);
  S.veTudo0 = undefined;
  syncPapel();
  if (casa && !casa.dono && (casa.membros || [])[0] === S.me) FB.fs.doc('casas/' + cid).update({ dono: S.me }).catch(() => {});
  DB.casaUnsub = FB.fs.doc('casas/' + cid).onSnapshot(
    d => {
      const b = d.data();
      if (!b) return;
      S.casa = b;
      S.names = b.nomes || {};
      syncPapel();
      scheduleRender();
    },
    e => {
      if (e && e.code === 'permission-denied' && S.cid === cid) {
        lsDel(LSC(S.me));
        toast('Você não está mais nesta casa.');
        stopAll();
        S.phase = 'casa';
        render();
      }
    }
  );
  S.phase = 'app';
  S.month = curYM();
  S.tab = 'resumo';
  render();
  openCasa(cid);
  return true;
}

export async function openCasa(cid) {
  const root = `casas/${cid}/`;
  DB.db = { collection: p => FB.fs.collection(root + p), doc: p => FB.fs.doc(root + p) };
  try {
    const snaps = await Promise.all(qParts('casa').map(q => q.get({ source: 'server' })));
    if (S.cid !== cid) return;
    const map = {};
    for (const sn of snaps) for (const d of sn.docs) {
      const b = fromFS(d.data());
      if (b && b.t) map[d.id] = { ...b, id: d.id };
    }
    if (Object.keys(map).length) {
      DB.subs.casa = map;
      S.mode = 'db';
      S.recs = { ...map };
      rebuild();
    }
    S.dbChecked = true;
    linkMe();
  } catch (e) {
    /* sem internet: os dados chegam pelo que está guardado no aparelho */
  }
  if (S.cid !== cid) return;
  subscribeAll();
  scheduleRender();
}

export async function createCasa(nome) {
  const nm = gateName();
  const ref = FB.fs.collection('casas').doc();
  await ref.set({ nome, membros: [S.me], dono: S.me, nomes: { [S.me]: nm }, criada: Date.now() });
  await FB.fs.doc('usuarios/' + S.me).set({ casa: ref.id, nome: nm });
  await enterCasa(ref.id);
}

export async function joinCasa(code) {
  if (code.length < 6) throw { code: 'codigo' };
  const nm = gateName();
  const inv = await FB.fs.doc('convites/' + code).get();
  if (!inv.exists) throw { code: 'codigo' };
  const v = inv.data();
  if (v.expira && v.expira.toMillis() < Date.now()) throw { code: 'vencido' };
  /* entra e gasta o código no mesmo passo: o banco não deixa usar o convite duas vezes */
  const b = FB.fs.batch();
  b.update(FB.fs.doc('casas/' + v.casa), {
    membros: firebase.firestore.FieldValue.arrayUnion(S.me),
    ['nomes.' + S.me]: nm,
    ['papeis.' + S.me]: v.papel || 'editor',
    convite: code
  });
  b.delete(FB.fs.doc('convites/' + code));
  await b.commit();
  await FB.fs.doc('usuarios/' + S.me).set({ casa: v.casa, nome: nm });
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  await enterCasa(v.casa);
}

export function gateName() {
  const v = ($('#g-meunome')?.value || '').trim() || S.uname;
  if (!v) throw { code: 'nome' };
  S.uname = v;
  return v;
}

const CODE_AB = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export async function mkInvite(btn) {
  if (!FB || !S.cid) return;
  if (!isDono()) return toast('Só o dono da casa convida pessoas.');
  btn && (btn.disabled = true);
  const pp = $('#inv-papel')?.value || 'editor', papelInv = PAPEIS[pp] && pp !== 'dono' ? pp : 'editor';
  const r = crypto.getRandomValues(new Uint32Array(8)), code = [...r].map(x => CODE_AB[x % CODE_AB.length]).join('');
  const exp = new Date(Date.now() + 48 * 3600e3);
  try {
    await FB.fs.doc('convites/' + code).set({ casa: S.cid, expira: firebase.firestore.Timestamp.fromDate(exp), criadoPor: S.me, papel: papelInv });
    S.invite = { code, papel: papelInv, ate: `${pad(exp.getDate())}/${pad(exp.getMonth() + 1)} às ${pad(exp.getHours())}:${pad(exp.getMinutes())}` };
    render();
  } catch (e) {
    toast('Não consegui gerar o código. Confira a internet.');
    btn && (btn.disabled = false);
  }
}

export const appLink = () => location.origin + location.pathname;

/* ---------- membros (só o dono) ---------- */
export const casaRef = () => FB.fs.doc('casas/' + S.cid);
export const casaErr = () => toast('Não consegui salvar agora. Confira a internet.');

export function setPapel(uid, v) {
  if (!isDono() || !PAPEIS[v] || v === 'dono') return;
  casaRef().update({ ['papeis.' + uid]: v }).then(() => toast(`${S.names[uid] || 'Pessoa'} agora é ${PAPEIS[v]}.`), casaErr);
}

export function setVerTudo(uid, on) {
  if (!isDono()) return;
  casaRef().update({ ['verTudo.' + uid]: on }).then(() => toast(on ? 'Agora vê os lançamentos de todos.' : 'Agora vê só o que lançou.'), casaErr);
}

export function remMembro(uid) {
  if (!isDono() || uid === S.me) return;
  const F = firebase.firestore.FieldValue;
  casaRef().update({
    membros: F.arrayRemove(uid),
    ['nomes.' + uid]: F.delete(),
    ['papeis.' + uid]: F.delete(),
    ['verTudo.' + uid]: F.delete()
  }).then(() => toast('Removida da casa. Os lançamentos dela continuam aqui.'), casaErr);
}

export async function sairDaCasa() {
  if (isDono() || !S.cid) return;
  const F = firebase.firestore.FieldValue;
  try {
    await casaRef().update({
      membros: F.arrayRemove(S.me),
      ['nomes.' + S.me]: F.delete(),
      ['papeis.' + S.me]: F.delete(),
      ['verTudo.' + S.me]: F.delete()
    });
    await FB.fs.doc('usuarios/' + S.me).set({ casa: null, nome: S.uname || '' });
    lsDel(LSC(S.me));
    stopAll();
    S.phase = 'casa';
    render();
    toast('Você saiu da casa.');
  } catch (e) { casaErr(); }
}

export async function recomendar() {
  const url = appLink(), text = 'Estou usando o Caixa em Dia para controlar os gastos de casa e vendo quanto cada compra custa em horas de trabalho. É grátis:';
  if (navigator.share) {
    try { await navigator.share({ title: 'Caixa em Dia', text, url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + url), '_blank', 'noopener');
}

/* sair da conta apaga a cópia dos dados guardada neste aparelho */
export function clearLocalData() {
  try {
    if (typeof localStorage === 'undefined') return;
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('caixa-em-dia:') || k.startsWith('firestore_') || k === LS1 || k === LS2) {
        localStorage.removeItem(k);
      }
    }
  } catch (e) {}
}

export async function sairDaConta() {
  clearLocalData();
  try { await FB?.auth?.signOut(); } catch (e) {}
  const ate = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
  try { if (FB?.fs) await ate(FB.fs.terminate().then(() => FB.fs.clearPersistence()), 4000); } catch (e) {}
  clearLocalData();
  location.reload();
}

/* Excluir conta e dados (LGPD / exigência da Google Play Store) */
export async function excluirContaEDados(senha = '') {
  const user = FB?.auth?.currentUser;
  if (!user) {
    // Modo local sem conta no Firebase: limpa todos os dados locais e volta ao exemplo
    clearLocalData();
    stopAll();
    S.dbChecked = true;
    S.phase = 'app';
    render();
    toast('Todos os dados deste aparelho foram excluídos.');
    return { ok: true };
  }

  // 1. Se a senha foi informada e o usuário usa login por e-mail/senha, reautentica antes de começar
  if (senha && user.email && typeof firebase !== 'undefined' && firebase.auth?.EmailAuthProvider) {
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, senha);
    await user.reauthenticateWithCredential(cred);
  }

  const uid = S.me || user.uid;
  const cid = S.cid;

  // 2. Desliga listeners em tempo real para evitar erros intermediários durante a limpeza
  for (const f of Object.values(DB.unsubs)) try { f(); } catch (e) {}
  if (DB.casaUnsub) { try { DB.casaUnsub(); } catch (e) {} DB.casaUnsub = null; }
  DB.unsubs = {};
  S.wiping = true;

  try {
    if (cid && FB?.fs) {
      const membros = S.casa?.membros || [uid];
      const outros = membros.filter(id => id !== uid);
      const souDono = isDono();

      if (souDono && outros.length === 0) {
        // Único membro da casa: apaga todos os registros da casa e o próprio documento da casa
        try { await FB.fs.doc('casas/' + cid).update({ apagando: true }); } catch (e) {}
        if (DB.db) {
          await deleteAllDb();
        }
        await FB.fs.doc('casas/' + cid).delete();
      } else {
        // Há outros membros na casa: apaga os lançamentos de autoria do usuário e remove seu vínculo da casa
        if (DB.db) {
          const meusRecs = Object.values(S.recs).filter(r => !CFGT[r.t] && r.by === uid);
          await Promise.all(meusRecs.map(r => dbDel(recPath(r)).catch(() => {})));
        }
        const F = firebase.firestore.FieldValue;
        const patch = {
          membros: F.arrayRemove(uid),
          ['nomes.' + uid]: F.delete(),
          ['papeis.' + uid]: F.delete(),
          ['verTudo.' + uid]: F.delete()
        };
        if (souDono && outros.length > 0) {
          const novoDono = outros[0];
          patch.dono = novoDono;
          patch['papeis.' + novoDono] = F.delete();
          patch['verTudo.' + novoDono] = F.delete();
        }
        await FB.fs.doc('casas/' + cid).update(patch);
      }
    }

    // 3. Remove o documento do usuário em usuarios/{uid}
    if (FB?.fs && uid) {
      await FB.fs.doc('usuarios/' + uid).delete().catch(() => {});
    }

    // 4. Exclui a conta no Firebase Auth
    await user.delete();
  } finally {
    S.wiping = false;
  }

  // 5. Limpa o armazenamento local e a persistência offline do Firestore
  clearLocalData();
  const ate = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
  try { if (FB?.fs) await ate(FB.fs.terminate().then(() => FB.fs.clearPersistence()), 4000); } catch (e) {}
  clearLocalData();
  stopAll();
  S.me = null;
  S.fb = null;
  S.phase = 'login';
  render();
  toast('Sua conta e seus dados foram excluídos permanentemente.');
  return { ok: true };
}

export const inviteText = () => S.invite ? `Entra no nosso Caixa em Dia: ${appLink()}?c=${S.invite.code}\nSe pedir, o código é ${S.invite.code} (vale até ${S.invite.ate}).` : '';

export function authMsg(e) {
  const c = (e && e.code) || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return 'E-mail ou senha errados.';
  if (/invalid-email/.test(c)) return 'Esse e-mail não parece certo.';
  if (/missing-password/.test(c)) return 'Digite a senha.';
  if (/email-already-in-use/.test(c)) return 'Já existe uma conta com esse e-mail. Toque em "Já tenho conta" e entre.';
  if (/weak-password|password-does-not-meet-requirements/.test(c)) return 'Senha fraca. Use pelo menos 8 caracteres, com letras e números.';
  if (/too-many-requests/.test(c)) return 'Muitas tentativas seguidas. Espere alguns minutos.';
  if (/network-request-failed|unavailable/.test(c)) return 'Sem internet. Confira a conexão e tente de novo.';
  if (c === 'nome') return 'Diga seu nome.';
  if (c === 'codigo') return 'Código não encontrado. Confira as letras ou peça um novo.';
  if (c === 'vencido') return 'Esse código venceu. Peça um novo.';
  if (/permission-denied/.test(c)) return 'Sem permissão. Confira se as regras do banco foram publicadas (passo 3 do LEIAME).';
  return 'Não deu certo' + (e && e.message ? ': ' + e.message : '.');
}

export async function gateSubmit(form) {
  const k = form.dataset.f, el = n => form.elements[n], g = n => (el(n)?.value || '').trim(), btn = form.querySelector('[type=submit]'), err = form.querySelector('.err');
  err.textContent = '';
  btn.disabled = true;
  try {
    if (k === 'login') await FB.auth.signInWithEmailAndPassword(g('email'), el('senha').value);
    else if (k === 'signup') {
      const nm = g('nome');
      if (!nm) throw { code: 'nome' };
      S.uname = nm;
      const c = await FB.auth.createUserWithEmailAndPassword(g('email'), el('senha').value);
      await c.user.updateProfile({ displayName: nm });
    } else if (k === 'forgot') {
      await FB.auth.sendPasswordResetEmail(g('email'));
      S.authMode = 'login';
      render();
      toast('Enviamos um e-mail para você criar uma senha nova.');
      return;
    } else if (k === 'create') await createCasa(g('casa') || 'Nossa casa');
    else if (k === 'join') await joinCasa(g('codigo').toUpperCase().replace(/[^A-Z0-9]/g, ''));
  } catch (e) {
    if (form.isConnected) { err.textContent = authMsg(e); btn.disabled = false; }
    else toast(authMsg(e));
  }
}

export function startWith(list, prog) {
  S.recs = {};
  S.mode = DB.db ? 'db' : 'local';
  S.month = curYM();
  return putMany(list, prog ? progToast : null).then(() => { if (DB.db) subscribeAll(); });
}

export async function deleteAllDb() {
  const paths = Object.values(S.recs).map(recPath);
  await Promise.all(paths.map(p => dbDel(p)));
}

export async function modoApagar(on) {
  if (S.mode === 'db' && S.cid) await casaRef().update({ apagando: on });
}

export async function replaceAll(recs) {
  if (S.ro && S.mode !== 'demo') { toast(RO_MSG); return; }
  if (!isDono()) return toast('Só o dono da casa restaura backup.');
  if (S.mode === 'db' && S.cid) {
    try { await modoApagar(true); } catch (e) { return casaErr(); }
  }
  try {
    if (S.mode === 'db' && DB.db) {
      S.wiping = true;
      try { await deleteAllDb(); } finally { S.wiping = false; }
    }
    S.recs = {};
    if (S.mode === 'demo') S.mode = DB.db ? 'db' : 'local';
    await putMany(recs.map(r => ({ ...r, by: r.by || S.me })), DB.db ? progToast : null);
  } finally {
    if (S.mode === 'db' && S.cid) modoApagar(false).catch(() => {});
  }
  if (DB.db) {
    for (const f of Object.values(DB.unsubs)) try { f(); } catch (e) {}
    DB.unsubs = {}; DB.subs = {};
    subscribeAll();
  }
  toast(DB.db ? 'Backup restaurado. Tudo salvo no banco da casa.' : 'Backup restaurado neste aparelho.');
}

export async function backup() {
  if (!S.downloads) return;
  try {
    await S.downloads.save({ filename: `caixa-em-dia-backup-${today()}.json`, data: JSON.stringify({ v: 2, recs: Object.values(S.recs) }, null, 1) });
    toast('Backup baixado.');
  } catch (e) { if (e && e.code !== 'declined') toast('Não foi possível baixar agora.'); }
}

export async function csv() {
  if (!S.downloads) return;
  const L = filteredLines();
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const KN = { in: 'Entrada', dev: 'Devolução', fix: 'Gasto fixo', var: 'Gasto', loan: 'Parcela de empréstimo', loanin: 'Empréstimo recebido', tr: 'Transferência', apl: 'Aplicação', res: 'Resgate', aj: 'Ajuste de saldo', fd: 'Diferença de fatura' };
  const rows = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Pessoa', 'Pagamento', 'Mês da fatura', 'Parcela', 'Dá para cortar', 'Valor']].concat(
    L.map(l => [l.date ? fDY(l.date) : 'sem dia', KN[l.kind] || l.kind, l.desc, l.cat, pname(l.person), l.via, l.card ? ymL(S.month) : '', l.inst ? `${l.inst.n}/${l.inst.tot}` : '', l.cut && EXP[l.kind] ? CUTS[l.cut].l : '', l.kind === 'tr' ? l.amount : val(l)])
  );
  const txt = '\uFEFF' + rows.map((r, ri) => r.map((v, i) => i === 9 && ri > 0 ? String(round2(v)).replace('.', ',') : q(v)).join(';')).join('\n');
  try {
    await S.downloads.save({ filename: `lancamentos-${S.month}.csv`, data: txt });
  } catch (e) { if (e && e.code !== 'declined') toast('Não foi possível baixar agora.'); }
}

export async function wipe() {
  if (S.ro && S.mode !== 'demo') { toast(RO_MSG); return; }
  if (!isDono()) return toast('Só o dono da casa apaga tudo.');
  if (S.mode === 'db' && DB.db) {
    S.wiping = true;
    try { await modoApagar(true); await deleteAllDb(); }
    catch (e) { S.wiping = false; toast('Não consegui apagar tudo. Tente de novo.'); return; }
    finally { modoApagar(false).catch(() => {}); }
  }
  lsDel(LS1); lsDel(LS2);
  S.mode = 'demo'; S.tab = 'mes';
  setRecs(demoRecs());
  S.wiping = false;
  toast('Tudo apagado.');
}
