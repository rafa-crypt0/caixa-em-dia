# Caixa em Dia — como colocar no ar

O app tem duas partes:

- **O site** (os arquivos desta pasta). Fica de graça no GitHub Pages, num endereço como `https://rafa-crypt0.github.io/caixa-em-dia/`.
- **O banco de dados e o login.** Ficam de graça no Firebase, do Google. O plano gratuito (Spark) não pede cartão e sobra para uma casa.

Leva uns 20 minutos, no computador. Depois disso, tudo se faz pelo celular.

---

## 1. Criar o projeto no Firebase

1. Entre em https://console.firebase.google.com com sua conta Google.
2. **Criar um projeto**: nome `caixa-em-dia`. Pode desligar o Google Analytics, o app não usa.

## 2. Ligar o login por e-mail

1. No menu da esquerda: **Criação → Authentication → Vamos começar**.
2. Aba **Método de login → E-mail/senha → Ativar** (só a primeira chave) **→ Salvar**.

## 3. Criar o banco e colar as regras de segurança

1. Menu: **Criação → Firestore Database → Criar banco de dados**.
2. Local: **southamerica-east1 (São Paulo)**. Não dá para mudar depois.
3. Escolha **Iniciar no modo de produção** e crie.
4. Abra a aba **Regras**, apague tudo o que estiver lá, cole o conteúdo do arquivo `firestore.rules` desta pasta e clique em **Publicar**.

As regras garantem que só quem está na casa vê e mexe nos lançamentos. Sem elas o app não consegue salvar nada.

## 4. Pegar os dados do projeto e colar no `config.js`

1. Clique na engrenagem ao lado de "Visão geral do projeto" → **Configurações do projeto**.
2. Em **Seus apps**, clique no ícone **</>** (Web). Apelido: `Caixa em Dia`. **Não** marque Firebase Hosting. Clique em **Registrar app**.
3. Aparece um bloco `const firebaseConfig = { apiKey: "...", authDomain: "...", ... }`.
4. Abra o arquivo `config.js` desta pasta (no Bloco de Notas mesmo) e troque cada `COLE_AQUI` pelo valor correspondente. Mantenha as aspas. Salve.

> Esses valores não são senha: todo app Firebase na web mostra eles. Quem protege os dados são as regras do passo 3. Se o GitHub mandar um alerta de "chave do Google exposta", é por causa disso e pode ignorar.

## 5. Colocar o site no GitHub Pages

1. Em https://github.com/new crie um repositório **público** chamado `caixa-em-dia` (o código fica público; os dados não, eles estão no Firebase).
2. No repositório: **Add file → Upload files**. Arraste **todos os arquivos desta pasta** (inclusive o `config.js` já preenchido) e clique em **Commit changes**.
3. **Settings → Pages**. Em "Branch", escolha `main` e a pasta `/ (root)` → **Save**.
4. Em 1 ou 2 minutos o site fica em `https://rafa-crypt0.github.io/caixa-em-dia/`.

## 6. Autorizar o endereço no Firebase

Firebase → **Authentication → Configurações → Domínios autorizados → Adicionar domínio** → `rafa-crypt0.github.io`.

---

## 7. Começar a usar

**No seu celular (Rafael):**

1. Abra o endereço do site, toque em **Criar conta** e cadastre e-mail e senha.
2. Toque em **Criar a casa**.
3. Toque em **Começar com meus dados** e, em **Ajustes**, cadastre: vocês dois, as contas de banco, a carteira (tipo Dinheiro vivo) com o saldo de hoje, e os cartões.
4. Em **Ajustes → Convidar alguém da casa**, toque em **Enviar pelo WhatsApp** e mande para a Naiana.

**No celular da Naiana:**

1. Ela abre o link que recebeu, toca em **Criar conta** e cria o e-mail e a senha dela.
2. O código já vem preenchido: é só tocar em **Entrar na casa**. Os dados que você cadastrou aparecem.

**Instalar como app** (nos dois celulares):

- **Android (Chrome):** menu **⋮ → Instalar app** (ou "Adicionar à tela inicial").
- **iPhone (Safari):** botão **Compartilhar → Adicionar à Tela de Início**.

O app abre em tela cheia, com ícone próprio, e funciona sem internet. O que for lançado offline é enviado quando a conexão volta.

**Teste rápido:** cada um lança um gasto pequeno. No outro celular, ele deve aparecer em segundos, com "por Rafael" ou "por Naiana".

---

## Quem pode o quê na casa

Quem cria a casa é o **dono**. Ao gerar um convite (em **Ajustes**), o dono escolhe o papel da pessoa e pode trocar depois:

| Papel | Vê | Lança | Observação |
|---|---|---|---|
| **Dono** | tudo | sim | convida e remove pessoas, muda contas, cartões e pessoas, apaga tudo ou restaura backup |
| **Editor** | tudo | sim | ex.: o casal |
| **Só leitura** | tudo | não | |
| **Dependente** | só o que ele lançou | sim | ex.: filhos. O dono pode marcar "pode ver tudo" |

**Ninguém altera ou apaga o lançamento de outra pessoa sozinho, nem o dono.** Quem tenta fazer isso manda um **pedido**. O pedido aparece no Resumo de quem lançou, que toca em **Aprovar** ou **Recusar**.

Essas regras ficam no banco (`firestore.rules`), não só no app. Mesmo que alguém altere o app, o banco recusa.

Cada convite serve uma vez só e vence em 48 horas. **Sair da conta** apaga a cópia dos dados guardada naquele celular.

**Recomendar o app** (em Ajustes) manda só o link. Quem recebe cria a própria casa e não vê os seus dados.

## Horas de trabalho

Na aba **Resumo**, o quadro **Quanto custa em horas de trabalho** mostra, para cada pessoa, o salário, os fixos e parcelas, quanto sobra e quanto vale cada hora trabalhada. Também tem uma calculadora: você digita o valor de algo que quer comprar e vê quantas horas de trabalho ele custa, e quantas horas da **sobra** do mês (depois dos fixos).

Para funcionar:

1. Lance o salário de cada pessoa como entrada com a categoria **Salário**.
2. Em **Ajustes → Pessoas**, preencha as horas de trabalho por mês (44h por semana = 220; 40h = 200).

## IA (Assistente)

Veja o passo a passo em `ia/LEIAME.md`.

## Atualizar o app depois

**Quando o `firestore.rules` mudar** (as notas da versão avisam), faça as duas coisas no mesmo momento:

1. Publique o site novo (merge no GitHub ou upload do `index.html`).
2. Logo em seguida, no Firebase, abra **Firestore Database → Regras**, apague tudo, cole o `firestore.rules` novo e clique em **Publicar**.

Enquanto só uma das duas estiver atualizada, entrar na casa com convite e criar uma casa nova podem dar erro. O resto continua funcionando.

### Só o index.html


Quando houver uma versão nova do `index.html`, suba o arquivo de novo no GitHub (**Add file → Upload files**, ele substitui o antigo). Os celulares pegam a versão nova na próxima vez que abrirem o app com internet. Os dados não são afetados.

## Se já usou a versão do Claude

Lá, em **Ajustes → Baixar backup**. Aqui, em **Ajustes → Restaurar backup**.

## Limites do plano gratuito

Por dia, o Firestore permite 50 mil leituras e 20 mil gravações, e guarda até 1 GB. Duas pessoas usando todo dia ficam bem abaixo disso. Se um dia passar, o app avisa e volta ao normal no dia seguinte.
