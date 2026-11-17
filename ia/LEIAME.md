# Ligar a IA do Caixa em Dia

A IA faz três coisas no app (aba **Resumo → Assistente**):

1. **Importar extrato**: você cola o texto da fatura e ela separa as compras.
2. **Lançar escrevendo**: você escreve "gastei 45 no mercado no pix" e ela preenche o lançamento. Você confere e salva.
3. **Perguntar**: "onde dá para cortar este mês?" A resposta vem dos lançamentos da casa.

Para isso funcionar, é preciso uma "ponte" entre o app e o Claude. Ela guarda a chave da Anthropic num lugar seguro, fora do celular e fora do GitHub. A ponte fica de graça no Cloudflare. Leva uns 15 minutos, no computador.

---

## 1. Criar a chave do Claude

1. Entre em https://console.anthropic.com e crie uma conta.
2. **Billing**: coloque créditos. US$ 5 duram bastante para uma casa.
3. **Ainda em Billing → Limits**: defina um **limite de gasto mensal** (ex.: US$ 5). Assim a conta nunca passa disso.
4. **API Keys → Create Key**. Nome: `caixa-em-dia`. Copie a chave (começa com `sk-ant-`). Ela só aparece uma vez.

## 2. Criar a ponte no Cloudflare

1. Entre em https://dash.cloudflare.com e crie uma conta grátis.
2. Menu **Compute (Workers) → Workers & Pages → Create → Create Worker** (pode ser o modelo "Hello World").
3. Nome: `caixa-em-dia-ia` → **Deploy**.
4. Clique em **Edit code**. Apague tudo, cole o conteúdo do arquivo `worker.js` desta pasta e clique em **Deploy**.

## 3. Configurar a ponte

No Worker, aba **Settings → Variables and Secrets → Add**:

| Tipo | Nome | Valor |
|---|---|---|
| **Secret** | `ANTHROPIC_API_KEY` | a chave do passo 1 |
| Text | `FIREBASE_PROJECT` | `caixaemdia-casa` |
| Text | `ORIGEM` | `https://rafa-crypt0.github.io` |

Clique em **Deploy** para salvar.

Copie o endereço do Worker, que aparece no topo e se parece com `https://caixa-em-dia-ia.SEU-NOME.workers.dev`.

## 4. Ligar no app

1. Abra o `config.js` e cole o endereço na última linha:
   ```js
   window.IA_URL = "https://caixa-em-dia-ia.SEU-NOME.workers.dev";
   ```
2. Suba o `config.js` de novo no GitHub (**Add file → Upload files**).
3. Abra o app com internet. O quadro **Assistente** aparece na aba Resumo.

---

## Quanto custa

O padrão é o modelo **Claude Opus 5.5**, o mais capaz. Valores aproximados:

- Importar uma fatura: uns R$ 0,30 a R$ 0,50.
- Lançar escrevendo: menos de R$ 0,05.
- Uma pergunta: uns R$ 0,10 a R$ 0,30.

Para gastar bem menos (cerca de 40 vezes menos), use o modelo **Claude Haiku 5.5**. Ele acerta bem as tarefas simples, como lançar e importar. No Worker, adicione a variável de texto `MODELO` com o valor `claude-haiku-5-5` e clique em **Deploy**. Para voltar, apague a variável.

## Segurança

- Só quem está logado e é **membro da casa** consegue usar a ponte. Ela pergunta ao Firebase antes de chamar o Claude.
- A chave da Anthropic fica só no Cloudflare.
- Se a chave vazar, apague-a no console da Anthropic, crie outra e troque no Cloudflare.

## Se der problema

- **"A ponte da IA não está configurada"**: falta a variável `ANTHROPIC_API_KEY` ou `FIREBASE_PROJECT` no Worker.
- **"A IA só funciona com a conta conectada à casa"**: entre na sua conta. No modo exemplo, a IA não aparece.
- **"Não consegui falar com a IA"**: confira se há créditos na Anthropic e se o endereço no `config.js` está certo.
