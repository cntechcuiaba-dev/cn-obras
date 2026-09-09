# Central CN Obras

Gestão de demandas de manutenção predial do ministério CN Obras.
Solicitante abre por link público → liderança tria e atribui → executor atualiza status →
Painel de Prazos mostra vencidas/vencendo/em execução em tempo real.

**Stack:** React + Vite + Tailwind (PWA) · Convex (backend, banco, tempo real, cron) · Clerk (auth).

O código está completo. Ele roda em **dois modos**:

- **Modo demonstração (padrão, sem setup):** enquanto não houver `VITE_CONVEX_URL` no
  `.env.local`, `npm run dev` sobe o app com **dados fake**, sem Convex nem Clerk — para
  navegar a UI. Um banner "Modo demonstração" aparece no topo, com troca de papel
  (Liderança/Executor). Nenhuma conta é necessária.
- **Modo produção (real):** ao definir as chaves (checklist abaixo), o **mesmo front** passa
  a usar o backend Convex e o login Clerk de verdade. A troca é automática pela presença de
  `VITE_CONVEX_URL`.

### Ver a UI agora (modo demo)

```bash
npm run dev
```

Abra http://localhost:5173 — já funciona, sem mais nada. Para o produto real, siga abaixo.

---

## Checklist de setup (só você pode fazer)

### 1. Contas

- Crie uma conta no **Convex** — https://convex.dev
- Crie uma conta no **Clerk** — https://clerk.com e uma aplicação (habilite **Email + senha**).

### 2. Clerk → chaves

No painel do Clerk da sua aplicação:

- **API Keys** → copie a **Publishable key** (`pk_test_...` ou `pk_live_...`).
- **JWT Templates** → **New template** → escolha **Convex** → salve.
  Copie o **Issuer** (algo como `https://SEU-APP.clerk.accounts.dev`).
  > O template precisa se chamar exatamente **`convex`** (é o `applicationID` em `convex/auth.config.ts`).

### 3. Variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Preencha:

- `VITE_CLERK_PUBLISHABLE_KEY` = a Publishable key do passo 2.
- `VITE_CONVEX_URL` = você obtém no próximo passo (o `convex dev` imprime e escreve para você).

### 4. Subir o Convex (gera os tipos e a URL)

```bash
npx convex dev
```

- Faz login no Convex (abre o navegador), cria o projeto e **gera `convex/_generated/`**
  (é isso que faz o `import ... from "convex/_generated/api"` passar a existir).
- Deixe rodando num terminal. Ele coloca `VITE_CONVEX_URL` no `.env.local`.

Depois, conecte o Clerk ao Convex:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://SEU-APP.clerk.accounts.dev
```

### 5. Dados iniciais (seed)

Com o banco ainda vazio:

```bash
npx convex run cadastros:seed
```

Cria categorias (Elétrica, Hidráulica, Estrutura), locais (Templo, Salas de aula,
Estacionamento) e um modelo de mensagem por tipo.

### 6. Rodar o app

```bash
npm run dev
```

Abra http://localhost:5173

---

## Primeiro acesso

1. Faça login (Clerk). Todo usuário nasce como **executor** (RF28).
2. Na tela do executor, clique em **"Sou a liderança"** — o **primeiro** usuário do sistema
   é promovido a liderança (só funciona enquanto não houver nenhuma liderança).
3. Como liderança você vê **Prazos, Triagem, Recorrências, Aprendizado**.
4. Teste o coração do sistema: abra uma demanda pública em `/nova` e veja-a aparecer na
   **Triagem**; após triar (com prazo + executor + resultado esperado), ela entra no
   **Painel de Prazos**.

Para promover outros executores a liderança depois: hoje via Convex dashboard (tabela
`usuarios`, campo `papel`) ou expondo a mutation `usuarios.promover` numa tela de admin.

---

## Scripts

| Comando | O quê |
|---|---|
| `npm run dev` | Vite (frontend) |
| `npx convex dev` | Backend Convex + geração de tipos (deixe rodando junto) |
| `npm run build` | Typecheck + build de produção (passa **após** `convex dev` gerar os tipos) |
| `npx convex run cadastros:seed` | Dados iniciais |

## Estrutura

```
convex/            backend (schema, functions, crons, autorização)
  schema.ts        tabelas (já com impedimento, resultado esperado, risco)
  lib/auth.ts      requireRole — papel lido do banco, nunca do token (RNF03)
  demandas.ts      abertura pública, painel, execução, cron de risco
  triagem.ts       triagem / reatribuição / cancelamento
  recorrencias.ts  CRUD + cron de geração idempotente
  inteligencia.ts  aprendizado (agregação por local/categoria)
  crons.ts         2 rotinas: gerar recorrências + avaliar risco
src/
  rotas/           telas (público, login, painel, triagem, minhas, detalhe, recorrências, aprendizado)
  components/      Shell, LinhaDemanda, ui (chips, badges, estados)
  lib/             format, labels, tipos
docs/              especificação (blueprint, schema, requisitos, kickoff)
prototipo/         protótipo visual de referência
```

O design system (cores, tipografia) está em `tailwind.config.js`, derivado de
`docs/05-prototipo-visual.md`.
