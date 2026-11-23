import { S, CAT_CUT, RO_MSG, isDono } from '../state.js';
import {
  curYM, isYM, addM, ymL, parseMoney,
  freshRecs, demoRecs, v1ToRecs
} from '../calc.js';
import {
  DB, lsGet, lsSet, put, drop, putMany, subscribeAll,
  pedOk, pedNo, setPapel, setVerTudo, remMembro, sairDaCasa,
  recomendar, sairDaConta, mkInvite, inviteText, gateSubmit,
  startWith, replaceAll, backup, csv, wipe, fbInit, setRecs,
  isSaving, getFB, enterLocal, loadLocal
} from '../db.js';
import {
  esc, $, toast, SUBS, registerViews, render, scheduleRender,
  tqUpd, qoHint
} from './utils.js';
import { vResumo, quickIn, quickOut, quickMore, quickPhrase } from './vResumo.js';
import { decodeBankFile, parseBankFile, toLoteOps } from '../import.js';
import { vMes, flowTable, drawFlow } from './vMes.js';
import { vLanc, vlanc } from './vLanc.js';
import { vRel, drawEvo, catSegs } from './vRel.js';
import { vMais, vRec, vParc, vInv, vGeral } from './vMais.js';
import { vContas } from './vContas.js';
import { vRed } from './vRed.js';
import { vAjustes } from './vAjustes.js';
import {
  getDlg, getSheetCtx, F, fc, guard,
  openSheet, closeSheet, delAsk, newForm, openEdit,
  formVar, formTra, formCon, formMov, formInv, formCard, formFat,
  closeMonthSheet, loteSheet,
  aiSheet, aiRun, aiImport, iaFrase, iaPerg
} from './forms.js';

export {
  esc, $, toast, render, scheduleRender,
  vResumo, vMes, vLanc, vlanc, vRel, vMais, vRec, vParc, vInv, vGeral,
  vContas, vRed, vAjustes,
  flowTable, drawFlow, drawEvo, catSegs
};

registerViews(
  {
    resumo: vResumo, rel: vRel, mais: vMais, mes: vMes,
    lanc: vLanc, rec: vRec, parc: vParc, contas: vContas,
    inv: vInv, geral: vGeral, red: vRed, ajustes: vAjustes
  },
  {
    mes: drawFlow,
    rel: drawEvo
  }
);

export function setFilter(k, v) {
  S.f = { kind: 'all', cut: null, person: null, pay: null, cat: null, q: '' };
  if (k === 'kind') S.f.kind = v; else S.f[k] = v;
  S.tab = 'lanc';
  render();
  window.scrollTo({ top: 0 });
}

let eventsBound = false;
export function initEvents() {
  if (eventsBound || typeof document === 'undefined') return;
  eventsBound = true;

  document.addEventListener('focusout', e => {
    const main = $('#main');
    if (S.pend && main && main.contains(e.target)) {
      S.pend = false;
      setTimeout(scheduleRender, 0);
    }
  });

  document.addEventListener('pointerover', e => {
    const sg = e.target.closest && e.target.closest('.donut .seg');
    if (!sg) return;
    const dn = sg.closest('.donut');
    dn.querySelector('.dc b').textContent = sg.dataset.v;
    dn.querySelector('.dc span').textContent = sg.dataset.l + ' · ' + sg.dataset.p;
  });

  document.addEventListener('pointerout', e => {
    const sg = e.target.closest && e.target.closest('.donut .seg');
    if (!sg) return;
    const dn = sg.closest('.donut');
    dn.querySelector('.dc b').textContent = dn.dataset.c;
    dn.querySelector('.dc span').textContent = dn.dataset.s;
  });

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const a = t.dataset.act;
    const dlg = getDlg();
    const sheetCtx = getSheetCtx();
    switch (a) {
      case 'tab': {
        const tb = t.dataset.tab;
        if (SUBS.some(x => x[0] === tb)) { S.tab = 'mais'; S.sub = tb; lsSet('caixa-em-dia:sub', tb); }
        else S.tab = tb;
        render();
        window.scrollTo({ top: 0 });
        break;
      }
      case 'sub': S.sub = t.dataset.v; lsSet('caixa-em-dia:sub', S.sub); render(); break;
      case 'mprev': S.month = addM(S.month, -1); render(); break;
      case 'mnext': S.month = addM(S.month, 1); render(); break;
      case 'mtoday': S.month = curYM(); render(); break;
      case 'goto': S.month = t.dataset.m; S.tab = 'mes'; render(); window.scrollTo({ top: 0 }); break;
      case 'filter': setFilter(t.dataset.k, t.dataset.v); break;
      case 'fk': S.f.kind = t.dataset.v; render(); break;
      case 'fc': S.f.cut = S.f.cut === t.dataset.v ? null : t.dataset.v; render(); break;
      case 'clearf': S.f = { kind: 'all', cut: null, person: null, pay: null, cat: null, q: '' }; render(); break;
      case 'toggletable': S.showTable = !S.showTable; render(); break;
      case 'fresh': if (!S.dbChecked || !isDono()) break; startWith(freshRecs()); S.tab = 'ajustes'; toast('Pronto. Cadastre pessoas, contas e cartões.'); break;
      case 'keepdemo': if (!S.dbChecked || !isDono()) break; startWith(Object.values(S.recs).map(r => ({ ...r, c: null, by: null }))); toast('O exemplo agora é seu. Troque os nomes e valores.'); break;
      case 'add': if (!guard()) break; if (!S.st.accounts.length) { S.tab = 'ajustes'; render(); toast('Cadastre uma conta primeiro.'); break; } formVar(null); break;
      case 'swkind': newForm(t.dataset.v); break;
      case 'new': if (!guard()) break; newForm(t.dataset.kind); break;
      case 'newtr': if (!guard()) break; formTra(null, { from: t.dataset.from, to: t.dataset.to, v: +t.dataset.v }); break;
      case 'newcon': if (!guard()) break; formCon(null, t.dataset.acc); break;
      case 'newmov': if (!guard()) break; formMov(null, t.dataset.k); break;
      case 'newinv': if (!guard()) break; formInv(null); break;
      case 'newcard': if (!guard()) break; formCard(null); break;
      case 'paybill': formFat(t.dataset.card, t.dataset.ym); break;
      case 'edit': openEdit(t); break;
      case 'closesheet': closeSheet(); break;
      case 'delsheet': delAsk(t, () => getSheetCtx()?.del?.()); break;
      case 'cutpick': {
        const box = t.closest('#cutSeg');
        box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === t));
        F('cut').value = t.dataset.v;
        if (sheetCtx) sheetCtx.cutTouched = true;
        break;
      }
      case 'segpick': {
        const box = t.closest('[data-seg]');
        box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === t));
        F(box.dataset.seg).value = t.dataset.v;
        sheetCtx?.upd?.();
        break;
      }
      case 'cardpreset': {
        F('rule').value = t.dataset.r;
        dlg.querySelectorAll('[data-seg="rule"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === t.dataset.r));
        F('cday').value = t.dataset.d;
        F('due').value = t.dataset.v;
        F('dueNext').value = 'auto';
        sheetCtx?.upd?.();
        break;
      }
      case 'toggle': {
        const box = document.getElementById(t.dataset.t);
        if (box) box.hidden = !t.checked;
        if (t.dataset.t === 'recBox') { const o = document.getElementById('onceBox'); if (o) o.hidden = t.checked; }
        if (t.dataset.t === 'instBox' && t.checked && sheetCtx && !sheetCtx.cutTouched) {
          dlg.querySelectorAll('#cutSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === 'com'));
          F('cut').value = 'com';
        }
        sheetCtx?.upd?.();
        break;
      }
      case 'stoprec': {
        const x = sheetCtx?.rec;
        if (x) { closeSheet(); put({ ...x, to: addM(S.month, -1) }, `Termina em ${ymL(addM(S.month, -1))}.`); }
        break;
      }
      case 'close': closeMonthSheet(); break;
      case 'reopen': if (guard()) drop('mes-' + S.month, `${ymL(S.month)} reaberto.`); break;
      case 'redall': S.redAll = !S.redAll; render(); break;
      case 'addset': {
        if (!guard()) break;
        const w = t.dataset.what, st = S.st;
        if (w === 'pes') put({ t: 'pes', name: 'Nova pessoa', o: st.people.length + 1 });
        else put({ t: 'cta', name: 'Nova conta', type: 'banco', personId: '', initial: 0, o: st.accounts.length + 1 });
        break;
      }
      case 'delset': {
        if (!guard()) break;
        const id = t.dataset.id, r = S.recs[id], st = S.st;
        if (!r) break;
        if (r.t === 'cta') {
          const used = st.incomes.filter(x => x.accountId === id).length +
            [...st.fixed, ...st.items, ...st.loans].filter(x => x.pay === 'a:' + id).length +
            st.cards.filter(c => c.accountId === id).length +
            st.transfers.filter(x => x.from === id || x.to === id).length +
            st.loans.filter(x => x.accId === id).length +
            st.moves.filter(x => x.accId === id).length +
            st.confs.filter(x => x.accId === id).length;
          if (used) { toast(`Esta conta está em ${used} ${used === 1 ? 'lugar' : 'lugares'}. Troque esses lançamentos antes de remover.`); break; }
          drop(id, 'Removida.');
        } else if (r.t === 'pes') {
          const refs = [...st.incomes, ...st.fixed, ...st.items, ...st.accounts, ...st.loans, ...st.invs].filter(x => x.personId === id).map(x => ({ ...x, personId: '' }));
          if (refs.length) putMany(refs);
          drop(id, 'Removida.');
        }
        break;
      }
      case 'backup': backup(); break;
      case 'restore': $('#fileIn').click(); break;
      case 'lote': if (guard()) $('#loteIn').click(); break;
      case 'restore0': S.pendingRestore = null; render(); break;
      case 'restore2': replaceAll(S.pendingRestore); S.pendingRestore = null; break;
      case 'wipe': $('#wipeBox').innerHTML = `<div class="banner bad" style="margin-top:12px"><p>Isso apaga todos os lançamentos${S.mode === 'db' ? ' do banco da casa, para todos' : ' deste navegador'}. Não dá para desfazer.</p><button class="btn danger" data-act="wipe2">Apagar tudo agora</button></div>`; break;
      case 'wipe2': wipe(); break;
      case 'ai': aiSheet(); break;
      case 'airun': aiRun(); break;
      case 'aiimport': aiImport(); break;
      case 'iafrase': if (guard()) iaFrase(); break;
      case 'iaperg': iaPerg(); break;
      case 'iaq': iaPerg(t.dataset.q); break;
      case 'iaclear': S.iaAns = null; scheduleRender(); break;
      case 'pedok': pedOk(t.dataset.id); break;
      case 'pedno': pedNo(t.dataset.id); break;
      case 'pedcancel': pedNo(t.dataset.id, 'Pedido cancelado.'); break;
      case 'recomendar': recomendar(); break;
      case 'setpapel': setPapel(t.dataset.uid, t.dataset.v); break;
      case 'remmembro': delAsk(t, () => remMembro(t.dataset.uid)); break;
      case 'sairdacasa': delAsk(t, () => sairDaCasa()); break;
      case 'csv': csv(); break;
      case 'qin': if (guard()) quickIn(); break;
      case 'qout': if (guard()) quickOut(); break;
      case 'qmore': if (guard()) quickMore(); break;
      case 'qfrase': if (guard()) quickPhrase(); break;
      case 'catmode': S.catMode = t.dataset.v; render(); break;
      case 'evotable': S.evoTable = !S.evoTable; render(); break;
      case 'reload': location.reload(); break;
      case 'authmode': S.authMode = t.dataset.v; render(); break;
      case 'logout': if (getFB()) sairDaConta(); break;
      case 'uselocal': enterLocal(); break;
      case 'gologin': S.phase = getFB() ? 'login' : (typeof firebase === 'undefined' ? 'offline' : 'config'); render(); break;
      case 'mkinvite': mkInvite(t); break;
      case 'copyinv': {
        const tx = inviteText();
        if (navigator.clipboard) navigator.clipboard.writeText(tx).then(() => toast('Convite copiado. Cole no WhatsApp da pessoa.'), () => toast('Não deu para copiar. Mande o código: ' + (S.invite?.code || '')));
        else toast('Mande o código: ' + (S.invite?.code || ''));
        break;
      }
      case 'install':
        if (S.installEvt) {
          S.installEvt.prompt();
          S.installEvt.userChoice?.finally(() => { S.installEvt = null; scheduleRender(); });
        }
        break;
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing) return;
    const id = e.target && e.target.id;
    if (id === 'q-frase') { e.preventDefault(); if (guard()) quickPhrase(); }
    else if (id === 'ia-frase') { e.preventDefault(); if (guard()) iaFrase(); }
    else if (id === 'ia-perg') { e.preventDefault(); iaPerg(); }
  });

  document.addEventListener('submit', e => {
    const f = e.target;
    if (f.classList && f.classList.contains('gateform')) {
      e.preventDefault();
      gateSubmit(f);
    }
  });

  const dlg = getDlg();
  if (dlg) {
    dlg.addEventListener('submit', e => {
      e.preventDefault();
      if (S.ro && S.mode !== 'demo') { toast(RO_MSG); return; }
      getSheetCtx()?.save?.();
    });
    dlg.addEventListener('input', e => { getSheetCtx()?.upd?.(e); });
    dlg.addEventListener('change', e => {
      const t = e.target, sheetCtx = getSheetCtx();
      if (!sheetCtx) return;
      if (t.name === 'cat' && sheetCtx.kind === 'var' && !sheetCtx.cutTouched) {
        const v = fc('isInst') ? 'com' : (CAT_CUT[t.value] || '');
        F('cut').value = v;
        dlg.querySelectorAll('#cutSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
      }
      sheetCtx.upd?.(e);
    });
  }

  let qT, rT;
  document.addEventListener('input', e => {
    const t = e.target, dlgEl = getDlg();
    if (dlgEl && dlgEl.contains(t)) return;
    if (t.id === 'fQ') { clearTimeout(qT); qT = setTimeout(() => { S.f.q = t.value; scheduleRender(); }, 250); return; }
    if (t.id === 'tq-v') { tqUpd(); return; }
    if (t.id === 'qo-v') { qoHint(); return; }
    if (t.dataset.red != null) {
      t.nextElementSibling.textContent = t.value + '%';
      const cat = t.dataset.red, v = (+t.value) / 100;
      clearTimeout(rT);
      rT = setTimeout(() => {
        const c = S.recs.cfg || { id: 'cfg', t: 'cfg', start: S.st.start };
        put({ ...c, reduce: { ...S.st.reduce, [cat]: v } });
      }, 350);
      return;
    }
  });

  document.addEventListener('change', e => {
    const t = e.target, dlgEl = getDlg();
    if (dlgEl && dlgEl.contains(t)) return;
    if (t.id === 'tq-p') { tqUpd(); return; }
    if (t.id === 'qo-p') { qoHint(); return; }
    if (t.id === 'cfg-horas') { lsSet('caixa-em-dia:horas', t.checked); render(); return; }
    if (t.dataset.papel) { setPapel(t.dataset.papel, t.value); return; }
    if (t.dataset.vertudo) { setVerTudo(t.dataset.vertudo, t.checked); return; }
    if (t.id === 'fPerson') { S.f.person = t.value || null; render(); return; }
    if (t.id === 'fPay') { S.f.pay = t.value || null; render(); return; }
    if (t.id === 'fCat') { S.f.cat = t.value || null; render(); return; }
    if (t.dataset.set === 'start') {
      if (isYM(t.value)) {
        const c = S.recs.cfg || { id: 'cfg', t: 'cfg', reduce: S.st.reduce };
        put({ ...c, start: t.value }, 'Início do controle alterado.');
        if (DB.db && S.mode === 'db') subscribeAll();
      }
      return;
    }
    if (t.dataset.set) {
      const r = S.recs[t.dataset.id];
      if (!r) return;
      let v = t.value;
      if (t.dataset.money != null) { v = parseMoney(v); if (isNaN(v)) v = 0; }
      if (t.dataset.num != null) { v = parseFloat(String(v).replace(',', '.')); if (!(v > 0)) v = null; }
      put({ ...r, [t.dataset.f]: v });
      return;
    }
  });

  const fileIn = $('#fileIn');
  if (fileIn) {
    fileIn.addEventListener('change', async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const j = JSON.parse(await f.text());
        let recs = null;
        if (j && Array.isArray(j.recs)) recs = j.recs.filter(r => r && r.id && r.t);
        else if (j && Array.isArray(j.accounts)) recs = v1ToRecs(j);
        if (!recs || !recs.length) throw 0;
        if (S.mode === 'demo') {
          await startWith(recs, true);
          toast(DB.db ? 'Backup restaurado. Tudo salvo no banco da casa.' : 'Backup restaurado.');
        } else {
          S.pendingRestore = recs;
          S.tab = 'ajustes';
          render();
        }
      } catch (_) { toast('Esse arquivo não é um backup do Caixa em Dia.'); }
    });
  }

  const loteIn = $('#loteIn');
  if (loteIn) {
    loteIn.addEventListener('change', async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const buf = await f.arrayBuffer();
        const txt = decodeBankFile(buf).trim();
        if (f.name.toLowerCase().endsWith('.json') || txt.startsWith('{')) {
          const j = JSON.parse(txt);
          if (!j || !j.lote || !Array.isArray(j.ops)) throw new Error('invalid_json');
          loteSheet(j);
          return;
        }
        const parsed = parseBankFile(buf, f.name, { defaultYear: S.month.slice(0, 4) });
        if (!parsed.items.length) {
          toast('Não encontrei lançamentos válidos nesse arquivo OFX/CSV.');
          return;
        }
        const lote = toLoteOps(parsed, { titulo: f.name, bill: S.month });
        loteSheet(lote);
      } catch (_) {
        toast('Não consegui ler esse arquivo. Use um extrato OFX, CSV ou arquivo JSON de lote.');
      }
    });
  }

  window.addEventListener('beforeunload', e => {
    if (isSaving()) {
      e.preventDefault();
      e.returnValue = 'Ainda estou salvando seus dados. Se sair agora, parte deles pode se perder.';
    }
  });

  window.addEventListener('resize', () => {
    clearTimeout(window._rz);
    window._rz = setTimeout(() => {
      if (S.tab === 'mes') drawFlow();
      if (S.tab === 'rel') drawEvo();
    }, 150);
  });
}

export function boot() {
  initEvents();
  S.downloads = {
    save: async ({ filename, data }) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([data], { type: /\.csv$/.test(filename) ? 'text/csv;charset=utf-8' : 'application/json' }));
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    }
  };
  if (new URLSearchParams(location.search).get('c')) S.authMode = 'signup';
  S.sub = lsGet('caixa-em-dia:sub') || 'rec';
  const localRecs = loadLocal();
  if (localRecs) {
    S.mode = 'local';
    setRecs(localRecs);
  } else {
    setRecs(demoRecs());
  }
  render();
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; scheduleRender(); });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  fbInit();
}
