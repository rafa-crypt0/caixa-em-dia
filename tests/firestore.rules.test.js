import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  deleteField,
  Timestamp
} from 'firebase/firestore';

const PROJECT_ID = 'caixa-em-dia-test';
const CASA_ID = 'casa-1';

let testEnv;

function dbFor(uid) {
  return uid
    ? testEnv.authenticatedContext(uid).firestore()
    : testEnv.unauthenticatedContext().firestore();
}

async function seedCasa(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async ctx => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, 'casas', CASA_ID), {
      nome: 'Casa Teste',
      dono: 'uid-dono',
      membros: ['uid-dono', 'uid-editor', 'uid-leitor', 'uid-dep'],
      nomes: {
        'uid-dono': 'Rafael',
        'uid-editor': 'Naiana',
        'uid-leitor': 'Vovó',
        'uid-dep': 'Lucas'
      },
      papeis: {
        'uid-editor': 'editor',
        'uid-leitor': 'leitor',
        'uid-dep': 'dep'
      },
      verTudo: {},
      criada: Date.now(),
      ...overrides
    });
  });
}

beforeAll(async () => {
  const rulesPath = resolve(import.meta.dirname, '..', 'firestore.rules');
  const rules = readFileSync(rulesPath, 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8080
    }
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Firestore Security Rules — Caixa em Dia', () => {
  describe('Cadastro de usuários (/usuarios/{uid})', () => {
    it('permite que cada pessoa leia e grave apenas o próprio documento em /usuarios/{uid}', async () => {
      const donoDb = dbFor('uid-dono');
      const outroDb = dbFor('uid-editor');
      const anonDb = dbFor(null);

      await assertSucceeds(setDoc(doc(donoDb, 'usuarios', 'uid-dono'), { casa: CASA_ID, nome: 'Rafael' }));
      await assertSucceeds(getDoc(doc(donoDb, 'usuarios', 'uid-dono')));

      await assertFails(getDoc(doc(outroDb, 'usuarios', 'uid-dono')));
      await assertFails(setDoc(doc(outroDb, 'usuarios', 'uid-dono'), { casa: 'outra' }));
      await assertFails(getDoc(doc(anonDb, 'usuarios', 'uid-dono')));
    });
  });

  describe('Os 4 papéis na casa (Dono, Editor, Só leitura, Dependente)', () => {
    beforeEach(async () => {
      await seedCasa();
    });

    it('Dono: cria casa, gerencia papéis/membros e altera configuração (cfg, pes, cta, car)', async () => {
      const donoDb = dbFor('uid-dono');
      const novoDonoDb = dbFor('uid-novo');

      // Criação válida de nova casa pelo próprio dono
      await assertSucceeds(setDoc(doc(novoDonoDb, 'casas', 'casa-nova'), {
        nome: 'Casa Nova',
        dono: 'uid-novo',
        membros: ['uid-novo'],
        nomes: { 'uid-novo': 'Novo' }
      }));

      // Criação inválida tentando colocar outro dono ou membros extras
      await assertFails(setDoc(doc(novoDonoDb, 'casas', 'casa-falsa'), {
        nome: 'Casa Falsa',
        dono: 'uid-dono',
        membros: ['uid-novo', 'uid-dono']
      }));

      // Dono cria e altera configuração da casa (cta, car, cfg, pes)
      const ctaRef = doc(donoDb, `casas/${CASA_ID}/casa/cta-1`);
      await assertSucceeds(setDoc(ctaRef, { t: 'cta', name: 'Conta Principal', type: 'banco', initial: 500 }));
      await assertSucceeds(updateDoc(ctaRef, { initial: 1000 }));
      await assertSucceeds(deleteDoc(ctaRef));

      // Dono altera papel de membro na casa
      await assertSucceeds(updateDoc(doc(donoDb, 'casas', CASA_ID), {
        'papeis.uid-dep': 'editor'
      }));
    });

    it('Editor: lê e lança tudo, ajusta reduções e seus próprios dados, mas não altera contas/cartões nem papéis', async () => {
      const donoDb = dbFor('uid-dono');
      const editorDb = dbFor('uid-editor');

      // Dono prepara configuração
      await setDoc(doc(donoDb, `casas/${CASA_ID}/casa/cfg`), { t: 'cfg', start: '2026-01', reduce: [] });
      await setDoc(doc(donoDb, `casas/${CASA_ID}/casa/cta-1`), { t: 'cta', name: 'Banco', type: 'banco', initial: 0 });
      await setDoc(doc(donoDb, `casas/${CASA_ID}/ano/2026/reg/g-dono`), {
        t: 'gas', date: '2026-05-10', desc: 'Compra do Dono', amount: 100, by: 'uid-dono'
      });

      // Editor lê lançamentos de outros membros
      await assertSucceeds(getDoc(doc(editorDb, `casas/${CASA_ID}/ano/2026/reg/g-dono`)));

      // Editor cria seu próprio lançamento
      await assertSucceeds(setDoc(doc(editorDb, `casas/${CASA_ID}/ano/2026/reg/g-ed`), {
        t: 'gas', date: '2026-05-11', desc: 'Compra da Editora', amount: 80, by: 'uid-editor'
      }));

      // Editor pode atualizar apenas 'reduce' em cfg
      await assertSucceeds(updateDoc(doc(editorDb, `casas/${CASA_ID}/casa/cfg`), {
        reduce: [{ c: 'Lazer', v: 0.5 }]
      }));
      // Editor NÃO pode alterar o mês de início ('start') em cfg
      await assertFails(updateDoc(doc(editorDb, `casas/${CASA_ID}/casa/cfg`), {
        start: '2025-01'
      }));

      // Editor NÃO pode criar nem apagar conta ou cartão
      await assertFails(setDoc(doc(editorDb, `casas/${CASA_ID}/casa/cta-2`), { t: 'cta', name: 'Conta Extra', type: 'banco' }));
      await assertFails(deleteDoc(doc(editorDb, `casas/${CASA_ID}/casa/cta-1`)));

      // Editor pode criar sua própria pessoa (uid == me()) e editar seu nome/horas
      const pesRef = doc(editorDb, `casas/${CASA_ID}/casa/pes-ed`);
      await assertSucceeds(setDoc(pesRef, { t: 'pes', name: 'Naiana', uid: 'uid-editor', o: 2 }));
      await assertSucceeds(updateDoc(pesRef, { name: 'Naiana Silva', horas: 200 }));

      // Editor NÃO pode mudar papéis na casa
      await assertFails(updateDoc(doc(editorDb, 'casas', CASA_ID), {
        'papeis.uid-leitor': 'editor'
      }));
    });

    it('Só leitura (leitor): lê toda a casa, mas não cria, não edita e não envia pedidos', async () => {
      const donoDb = dbFor('uid-dono');
      const leitorDb = dbFor('uid-leitor');

      await setDoc(doc(donoDb, `casas/${CASA_ID}/casa/cfg`), { t: 'cfg', start: '2026-01', reduce: [] });
      await setDoc(doc(donoDb, `casas/${CASA_ID}/ano/2026/reg/g-dono`), {
        t: 'gas', date: '2026-05-10', desc: 'Mercado', amount: 150, by: 'uid-dono'
      });

      // Leitor consegue ler a casa, configurações e lançamentos
      await assertSucceeds(getDoc(doc(leitorDb, 'casas', CASA_ID)));
      await assertSucceeds(getDoc(doc(leitorDb, `casas/${CASA_ID}/casa/cfg`)));
      await assertSucceeds(getDoc(doc(leitorDb, `casas/${CASA_ID}/ano/2026/reg/g-dono`)));

      // Leitor NÃO consegue criar lançamentos
      await assertFails(setDoc(doc(leitorDb, `casas/${CASA_ID}/ano/2026/reg/g-leitor`), {
        t: 'gas', date: '2026-05-12', desc: 'Tentativa', amount: 30, by: 'uid-leitor'
      }));

      // Leitor NÃO consegue deixar pedido de alteração
      await assertFails(updateDoc(doc(leitorDb, `casas/${CASA_ID}/ano/2026/reg/g-dono`), {
        ped: { tipo: 'del', por: 'uid-leitor', em: Date.now() }
      }));

      // Leitor NÃO consegue alterar reduce em cfg
      await assertFails(updateDoc(doc(leitorDb, `casas/${CASA_ID}/casa/cfg`), {
        reduce: [{ c: 'Lazer', v: 0.3 }]
      }));
    });

    it('Dependente (dep): lança e vê só o que lançou + config, a menos que o dono libere verTudo', async () => {
      const donoDb = dbFor('uid-dono');
      const depDb = dbFor('uid-dep');

      await setDoc(doc(donoDb, `casas/${CASA_ID}/casa/cta-1`), { t: 'cta', name: 'Banco', type: 'banco' });
      await setDoc(doc(donoDb, `casas/${CASA_ID}/ano/2026/reg/g-dono`), {
        t: 'gas', date: '2026-05-10', desc: 'Compra do Pai', amount: 250, by: 'uid-dono'
      });

      // Dependente lê configuração da casa (cta, car, pes, cfg)
      await assertSucceeds(getDoc(doc(depDb, `casas/${CASA_ID}/casa/cta-1`)));

      // Dependente cria e lê seu próprio lançamento
      const meuLancRef = doc(depDb, `casas/${CASA_ID}/ano/2026/reg/g-dep`);
      await assertSucceeds(setDoc(meuLancRef, {
        t: 'gas', date: '2026-05-11', desc: 'Lanche na escola', amount: 25, by: 'uid-dep'
      }));
      await assertSucceeds(getDoc(meuLancRef));

      // Dependente NÃO consegue ler lançamento do dono enquanto verTudo não estiver liberado
      await assertFails(getDoc(doc(depDb, `casas/${CASA_ID}/ano/2026/reg/g-dono`)));

      // Dependente NÃO consegue enviar pedido (ped) no lançamento do dono
      await assertFails(updateDoc(doc(depDb, `casas/${CASA_ID}/ano/2026/reg/g-dono`), {
        ped: { tipo: 'del', por: 'uid-dep', em: Date.now() }
      }));

      // Dono libera verTudo para o dependente
      await assertSucceeds(updateDoc(doc(donoDb, 'casas', CASA_ID), {
        'verTudo.uid-dep': true
      }));

      // Agora o dependente consegue ler o lançamento do dono
      await assertSucceeds(getDoc(doc(depDb, `casas/${CASA_ID}/ano/2026/reg/g-dono`)));
    });
  });

  describe('Convites: validade de 48h e uso único (/convites/{code})', () => {
    beforeEach(async () => {
      await seedCasa();
    });

    it('só o dono pode criar convite, com papel válido (editor, leitor ou dep)', async () => {
      const donoDb = dbFor('uid-dono');
      const editorDb = dbFor('uid-editor');
      const exp48h = Timestamp.fromDate(new Date(Date.now() + 48 * 3600 * 1000));

      // Dono cria convite válido
      await assertSucceeds(setDoc(doc(donoDb, 'convites', 'CONV1234'), {
        casa: CASA_ID,
        expira: exp48h,
        criadoPor: 'uid-dono',
        papel: 'editor'
      }));

      // Editor NÃO pode criar convite
      await assertFails(setDoc(doc(editorDb, 'convites', 'CONV5678'), {
        casa: CASA_ID,
        expira: exp48h,
        criadoPor: 'uid-editor',
        papel: 'editor'
      }));

      // Convite com papel 'dono' não é permitido
      await assertFails(setDoc(doc(donoDb, 'convites', 'CONVDONO'), {
        casa: CASA_ID,
        expira: exp48h,
        criadoPor: 'uid-dono',
        papel: 'dono'
      }));
    });

    it('permite entrar na casa com convite válido de 48h apenas se consumido (uso único) no mesmo batch', async () => {
      const donoDb = dbFor('uid-dono');
      const convidadoDb = dbFor('uid-convidado');
      const code = 'UNICO48H';
      const exp48h = Timestamp.fromDate(new Date(Date.now() + 48 * 3600 * 1000));

      await setDoc(doc(donoDb, 'convites', code), {
        casa: CASA_ID,
        expira: exp48h,
        criadoPor: 'uid-dono',
        papel: 'dep'
      });

      // Tentativa 1: entrar SEM apagar o convite (violando uso único) -> FALHA
      await assertFails(updateDoc(doc(convidadoDb, 'casas', CASA_ID), {
        membros: ['uid-dono', 'uid-editor', 'uid-leitor', 'uid-dep', 'uid-convidado'],
        'nomes.uid-convidado': 'Convidado',
        'papeis.uid-convidado': 'dep',
        convite: code
      }));

      // Tentativa 2: entrar escalando papel de 'dep' para 'editor' -> FALHA
      const badBatch = writeBatch(convidadoDb);
      badBatch.update(doc(convidadoDb, 'casas', CASA_ID), {
        membros: ['uid-dono', 'uid-editor', 'uid-leitor', 'uid-dep', 'uid-convidado'],
        'nomes.uid-convidado': 'Convidado',
        'papeis.uid-convidado': 'editor',
        convite: code
      });
      badBatch.delete(doc(convidadoDb, 'convites', code));
      await assertFails(badBatch.commit());

      // Tentativa 3: batch atômico válido (entra com o papel do convite e apaga o convite) -> SUCESSO
      const okBatch = writeBatch(convidadoDb);
      okBatch.update(doc(convidadoDb, 'casas', CASA_ID), {
        membros: ['uid-dono', 'uid-editor', 'uid-leitor', 'uid-dep', 'uid-convidado'],
        'nomes.uid-convidado': 'Convidado',
        'papeis.uid-convidado': 'dep',
        convite: code
      });
      okBatch.delete(doc(convidadoDb, 'convites', code));
      await assertSucceeds(okBatch.commit());

      // Tentativa 4: segundo usuário tentando reutilizar o mesmo código já consumido -> FALHA
      const intrusoDb = dbFor('uid-intruso');
      await assertFails(updateDoc(doc(intrusoDb, 'casas', CASA_ID), {
        membros: ['uid-dono', 'uid-editor', 'uid-leitor', 'uid-dep', 'uid-convidado', 'uid-intruso'],
        'nomes.uid-intruso': 'Intruso',
        'papeis.uid-intruso': 'dep',
        convite: code
      }));
    });

    it('recusa convite vencido após 48h', async () => {
      const donoDb = dbFor('uid-dono');
      const atrasadoDb = dbFor('uid-atrasado');
      const code = 'VENCIDO1';
      // Criado há 49 horas (expirado há 1 hora)
      const expPassado = Timestamp.fromDate(new Date(Date.now() - 3600 * 1000));

      await setDoc(doc(donoDb, 'convites', code), {
        casa: CASA_ID,
        expira: expPassado,
        criadoPor: 'uid-dono',
        papel: 'editor'
      });

      const batch = writeBatch(atrasadoDb);
      batch.update(doc(atrasadoDb, 'casas', CASA_ID), {
        membros: ['uid-dono', 'uid-editor', 'uid-leitor', 'uid-dep', 'uid-atrasado'],
        'nomes.uid-atrasado': 'Atrasado',
        'papeis.uid-atrasado': 'editor',
        convite: code
      });
      batch.delete(doc(atrasadoDb, 'convites', code));
      await assertFails(batch.commit());
    });
  });

  describe('Autoria de lançamentos (by) e Pedidos de alteração/exclusão (ped)', () => {
    beforeEach(async () => {
      await seedCasa();
    });

    it('exige que novos lançamentos tenham by == me() e sem ped inicial', async () => {
      const editorDb = dbFor('uid-editor');

      // Falsificando autoria (by: 'uid-dono') -> FALHA
      await assertFails(setDoc(doc(editorDb, `casas/${CASA_ID}/ano/2026/reg/g-fake`), {
        t: 'gas', date: '2026-05-10', desc: 'Falso', amount: 50, by: 'uid-dono'
      }));

      // Sem campo by -> FALHA
      await assertFails(setDoc(doc(editorDb, `casas/${CASA_ID}/ano/2026/reg/g-noby`), {
        t: 'gas', date: '2026-05-10', desc: 'Sem autor', amount: 50
      }));

      // Com campo ped já na criação -> FALHA
      await assertFails(setDoc(doc(editorDb, `casas/${CASA_ID}/ano/2026/reg/g-ped`), {
        t: 'gas', date: '2026-05-10', desc: 'Com pedido', amount: 50, by: 'uid-editor',
        ped: { tipo: 'del', por: 'uid-editor', em: Date.now() }
      }));
    });

    it('impede que outro membro (mesmo o Dono) altere ou apague diretamente o lançamento do autor', async () => {
      const donoDb = dbFor('uid-dono');
      const editorDb = dbFor('uid-editor');
      const path = `casas/${CASA_ID}/ano/2026/reg/g-editor-1`;

      // Editora cria lançamento
      await assertSucceeds(setDoc(doc(editorDb, path), {
        t: 'gas', date: '2026-05-15', desc: 'Farmácia', amount: 90, by: 'uid-editor'
      }));

      // Dono tenta alterar o valor diretamente -> FALHA
      await assertFails(updateDoc(doc(donoDb, path), { amount: 45 }));

      // Dono tenta apagar o lançamento diretamente -> FALHA
      await assertFails(deleteDoc(doc(donoDb, path)));

      // A própria autora consegue alterar o valor, mas NÃO pode transferir o campo 'by' para outra pessoa
      await assertSucceeds(updateDoc(doc(editorDb, path), { amount: 95 }));
      await assertFails(updateDoc(doc(editorDb, path), { by: 'uid-dono' }));
    });

    it('permite ciclo completo de pedido (ped): enviar, cancelar pelo solicitante, recusar ou aprovar pelo autor', async () => {
      const donoDb = dbFor('uid-dono');
      const editorDb = dbFor('uid-editor');
      const path = `casas/${CASA_ID}/ano/2026/reg/g-editor-2`;

      await setDoc(doc(editorDb, path), {
        t: 'gas', date: '2026-05-18', desc: 'Restaurante', amount: 120, by: 'uid-editor'
      });

      // Dono tenta enviar pedido falsificando 'por: uid-leitor' -> FALHA
      await assertFails(updateDoc(doc(donoDb, path), {
        ped: { tipo: 'edit', por: 'uid-leitor', em: Date.now(), novo: { amount: 100 } }
      }));

      // Dono tenta enviar pedido E mudar 'amount' ao mesmo tempo -> FALHA
      await assertFails(updateDoc(doc(donoDb, path), {
        amount: 100,
        ped: { tipo: 'edit', por: 'uid-dono', em: Date.now(), novo: { amount: 100 } }
      }));

      // Dono envia pedido válido de edição (alterando apenas o campo 'ped') -> SUCESSO
      await assertSucceeds(updateDoc(doc(donoDb, path), {
        ped: { tipo: 'edit', por: 'uid-dono', em: Date.now(), novo: { amount: 100 } }
      }));

      // Dono (solicitante) cancela o próprio pedido -> SUCESSO
      await assertSucceeds(updateDoc(doc(donoDb, path), {
        ped: deleteField()
      }));

      // Dono envia novo pedido de edição -> SUCESSO
      await assertSucceeds(updateDoc(doc(donoDb, path), {
        ped: { tipo: 'edit', por: 'uid-dono', em: Date.now(), novo: { amount: 100 } }
      }));

      // Editora (autora) aprova o pedido: aplica o novo valor e remove 'ped' -> SUCESSO
      await assertSucceeds(updateDoc(doc(editorDb, path), {
        amount: 100,
        ped: deleteField()
      }));

      // Dono envia pedido de exclusão -> SUCESSO
      await assertSucceeds(updateDoc(doc(donoDb, path), {
        ped: { tipo: 'del', por: 'uid-dono', em: Date.now() }
      }));

      // Editora (autora) aprova exclusão apagando o documento -> SUCESSO
      await assertSucceeds(deleteDoc(doc(editorDb, path)));
    });
  });
});
