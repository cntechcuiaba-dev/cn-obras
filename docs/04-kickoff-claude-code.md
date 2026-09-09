Você é um desenvolvedor sênior. Implemente o sistema Central CN Obras do zero.
Stack: React + Vite + Tailwind (PWA), Convex (backend e banco), Clerk (autenticação).
Deploy: Vercel ou Netlify + `npx convex deploy`.
Não me explique o que vai fazer — implemente.

## Sistema
Gestão de demandas de manutenção predial do ministério CN Obras. Qualquer pessoa abre uma
solicitação por link público sem login; a liderança triagem e atribui a um executor; o
executor atualiza o status até concluir. Um painel de prazos mostra em tempo real o que
está vencido, vencendo ou em execução.

## Schema do Convex
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  usuarios: defineTable({
    clerkId: v.string(),
    nome: v.string(),
    email: v.string(),
    papel: v.union(v.literal("lideranca"), v.literal("executor")),
    ativo: v.boolean(),
  }).index("by_clerk_id", ["clerkId"]),

  categorias: defineTable({
    nome: v.string(),
    ativa: v.boolean(),
  }),

  locais: defineTable({
    nome: v.string(),
    ativo: v.boolean(),
  }),

  modelosMensagem: defineTable({
    nome: v.string(),
    texto: v.string(), // com placeholders tipo {{demanda}}, {{prazo}}
    tipo: v.union(
      v.literal("em_execucao"),
      v.literal("aguardando"),
      v.literal("concluida"),
    ),
  }),

  demandas: defineTable({
    titulo: v.string(),
    descricao: v.string(),
    solicitanteNome: v.string(),
    solicitanteWhatsapp: v.string(),
    localTextoOriginal: v.string(), // texto livre da abertura pública
    anexosAbertura: v.optional(v.array(v.id("_storage"))),

    status: v.union(
      v.literal("aberta"),
      v.literal("triada"),
      v.literal("em_execucao"),
      v.literal("aguardando"),
      v.literal("concluida"),
      v.literal("cancelada"),
    ),

    // preenchidos na triagem
    categoriaId: v.optional(v.id("categorias")),
    localId: v.optional(v.id("locais")),
    prioridade: v.optional(
      v.union(v.literal("baixa"), v.literal("media"), v.literal("alta")),
    ),
    prazo: v.optional(v.number()), // timestamp
    resultadoEsperado: v.optional(v.string()), // o que caracteriza "resolvido" — definido na triagem, lido na validação da conclusão

    // [E4] dono único do próximo movimento — renomeado de executorId
    responsavelId: v.optional(v.id("usuarios")),
    // [E4] quem executa junto; tem acesso, não recebe o movimento
    equipeIds: v.optional(v.array(v.id("usuarios"))),

    // preenchidos quando entra em "aguardando" (durante a parada, não no fechamento)
    motivoImpedimento: v.optional(
      v.union(
        v.literal("aguardando_aprovacao"),
        v.literal("aguardando_material"),
        v.literal("aguardando_terceiro"),
        v.literal("aguardando_orcamento"),
        v.literal("aguardando_decisao"),
      ),
    ),
    impedimentoDesde: v.optional(v.number()), // timestamp de entrada em "aguardando"

    // [E2] compromisso embutido — obrigatório por inteiro ao entrar em
    // "aguardando" com motivo "aguardando_orcamento" (validado na mutation)
    orcamento: v.optional(
      v.object({
        fornecedor: v.string(),
        solicitadoEm: v.number(),
        cobrarEm: v.number(),
        responsavelCobrancaId: v.id("usuarios"),
        cobrancasFeitas: v.number(),
        valorRecebido: v.optional(v.number()),
        recebidoEm: v.optional(v.number()),
        aprovadoEm: v.optional(v.number()),
        aprovadoPorId: v.optional(v.id("usuarios")),
      }),
    ),

    // [E2] fato realizado — obrigatório (zero é válido) antes de "concluida"
    // quando a demanda passou por material ou orçamento
    custo: v.optional(
      v.object({
        valor: v.number(),
        origem: v.union(
          v.literal("estoque"),
          v.literal("compra_direta"),
          v.literal("orcamento"),
        ),
        lancadoEm: v.number(),
      }),
    ),

    concluidaEm: v.optional(v.number()),
    resultadoConfirmado: v.optional(v.boolean()), // executor confirma que o resultado esperado foi atingido — exigido para concluir

    riscoSinalizadoEm: v.optional(v.number()), // gravado pela rotina diária de avaliação de risco; ausente enquanto não sinalizada

    origemRecorrenciaId: v.optional(v.id("manutencoesRecorrentes")),
  })
    .index("by_status", ["status"])
    .index("by_responsavel", ["responsavelId"])
    .index("by_prazo", ["prazo"])
    .index("by_origem_recorrencia", ["origemRecorrenciaId"])
    // [E2] varre orçamentos vencidos sem depender de alguém abrir o painel
    .index("by_cobranca", ["status", "orcamento.cobrarEm"]),

  historicoDemanda: defineTable({
    demandaId: v.id("demandas"),
    tipo: v.string(), // ex: "criada", "triada", "status_alterado", "foto_anexada"
    descricao: v.string(),
    criadoPorClerkId: v.optional(v.string()), // ausente quando gerado pelo sistema (cron)
    anexos: v.optional(v.array(v.id("_storage"))),
  }).index("by_demanda", ["demandaId"]),

  manutencoesRecorrentes: defineTable({
    titulo: v.string(),
    descricao: v.string(),
    categoriaId: v.id("categorias"),
    localId: v.id("locais"),
    executorPadraoId: v.id("usuarios"),
    periodicidade: v.union(
      v.literal("mensal"),
      v.literal("bimestral"),
      v.literal("trimestral"),
      v.literal("semestral"),
      v.literal("anual"),
    ),
    prazoDias: v.number(), // dias entre geração e prazo da demanda gerada
    antecedenciaDias: v.number(), // [E5] quanto antes do vencimento a demanda é gerada, para dar tempo de programação
    ativa: v.boolean(),
    ultimaGeracaoEm: v.optional(v.number()),
  }).index("by_ativa", ["ativa"]),

  // [E2] consumo de material — sem saldo, sem inventário (decisão explícita)
  consumos: defineTable({
    demandaId: v.id("demandas"),
    item: v.string(),
    quantidade: v.number(),
    valorUnitario: v.optional(v.number()),
    origem: v.union(v.literal("estoque"), v.literal("compra")),
  })
    .index("by_demanda", ["demandaId"])
    .index("by_item", ["item"]), // histórico de preço pago, usado na aprovação de orçamento

  // [E1] compromisso de avisar o solicitante — envio manual, lembrete não
  avisos: defineTable({
    demandaId: v.id("demandas"),
    responsavelId: v.id("usuarios"),
    gatilho: v.string(), // status que disparou o aviso
    mensagem: v.string(), // já montada a partir do modelo
    enviadoEm: v.optional(v.number()), // ausente = ainda pendente no painel
  })
    .index("by_responsavel_pendente", ["responsavelId", "enviadoEm"])
    .index("by_demanda", ["demandaId"]),
});

## Autorização
O Convex NÃO tem RLS. Toda query/mutation exposta (exceto a de abertura pública) começa com
`const identity = await ctx.auth.getUserIdentity()` e lança erro se não houver.
Crie `convex/lib/auth.ts` com um helper `requireRole(ctx, papeis[])` que lê o papel da
tabela `usuarios` indexada por `by_clerk_id`. Use esse helper em toda função protegida.
Nunca leia papel de claim do token.

A mutation `garantirUsuario` (chamada no primeiro login) sempre cria o usuário como
"executor". A promoção para "lideranca" é manual, feita por quem já é liderança.

## Requisitos Funcionais e Não-Funcionais
# Requisitos — Central CN Obras

## Requisitos Funcionais

Módulo: Abertura de Demanda (público)
RF01. O sistema deve permitir que qualquer pessoa abra uma demanda por um link público, sem login, informando título, descrição, nome, WhatsApp e local (texto livre).
RF02. O sistema deve permitir anexar ao menos uma foto na abertura, de forma opcional.
RF03. O sistema deve criar toda demanda nova com status "aberta" e registrar o evento no histórico.
RF04. O sistema deve exibir ao solicitante uma confirmação com um identificador da demanda ao concluir a abertura.

Módulo: Triagem (liderança)
RF05. O sistema deve listar as demandas com status "aberta" para triagem.
RF06. O sistema deve permitir à liderança definir categoria, local, prioridade, prazo, executor responsável e o resultado esperado (o que caracteriza a demanda como resolvida), movendo a demanda para "triada".
RF07. O sistema deve impedir mover uma demanda para "triada" sem prazo e executor definidos.
RF08. O sistema deve permitir à liderança reatribuir executor, alterar prazo/prioridade e cancelar uma demanda a qualquer momento.

Módulo: Execução (executor)
RF09. O sistema deve exibir a cada executor apenas as demandas atribuídas a ele.
RF10. O sistema deve permitir ao executor mudar o status entre "em_execucao", "aguardando" e "concluida". Ao mover para "aguardando", deve exigir um motivo de impedimento de uma lista fechada (aguardando aprovação, material, terceiro, orçamento ou decisão), registrado no momento da parada — não no encerramento.
RF11. O sistema deve permitir ao executor anexar fotos à demanda (antes/depois).
RF12. Ao concluir uma demanda, o sistema deve exigir que o executor confirme se o resultado esperado (definido na triagem) foi atingido, e então registrar a data de conclusão e o evento no histórico. Não deve permitir mover para "concluida" sem essa confirmação.
RF13. O sistema deve impedir que um executor leia ou altere demanda que não está atribuída a ele.

## Módulo: Painel (ver E3 da emenda — revoga RF14 original)
RF14. O sistema deve exibir um painel com as demandas agrupadas em vencidas, vencendo (dentro de N dias) e em execução, ordenadas por risco de vencimento e, dentro do mesmo nível de risco, por prioridade, atualizando em tempo real.
RF15. O sistema deve calcular o estado de vencimento na leitura, comparando o prazo com a data atual, sem depender de rotina agendada.
RF16. O sistema deve destacar visualmente o prazo quando vencido, tanto
no item principal do painel quanto na lista de próximos.

Módulo: Manutenções Recorrentes
RF17. O sistema deve permitir à liderança cadastrar manutenções recorrentes com título, descrição, categoria, local, executor padrão, periodicidade (mensal a anual) e prazo em dias.
RF18. O sistema deve gerar automaticamente, uma vez por dia via cron, uma nova demanda para cada manutenção recorrente ativa cujo período tenha vencido, com status "triada" (já com categoria, local, executor e prazo herdados).
RF19. O sistema deve impedir gerar mais de uma demanda para a mesma manutenção recorrente no mesmo período (job idempotente).
RF20. O sistema deve permitir à liderança editar ou desativar uma manutenção recorrente a qualquer momento, sem afetar demandas já geradas.

Módulo: Comunicação (WhatsApp manual)
RF21. O sistema deve permitir cadastrar modelos de mensagem pré-configurados por tipo de atualização (em execução, aguardando, concluída).
RF22. O sistema deve gerar um link `wa.me` com o modelo de mensagem preenchido com os dados da demanda, para o responsável abrir e enviar manualmente.
RF23. O sistema não deve enviar mensagens automaticamente nem integrar com API de WhatsApp.

> Nota (auditoria Trino v2): o retorno automático ao solicitante — persona AUSENTE, cujo valor prometido no blueprint é "saber em que pé está sem perguntar" — permanece fora de escopo por decisão de produto (RF23; blueprint). Hoje ele só é alcançado por WhatsApp manual. Reabrir essa decisão (adicionar um canal externo automático) exige o cliente — ver bloco PRECISA DO CLIENTE da auditoria. As correções deste ciclo cobrem a avaliação de risco *dentro do app* (RF30), não o disparo externo.

Módulo: Histórico e Auditoria
RF24. O sistema deve registrar todo evento relevante da demanda (criação, triagem, mudança de status, foto anexada) com quem realizou e quando.
RF25. O sistema deve exibir a linha do tempo completa de eventos na tela de detalhe da demanda.

Módulo: Administração
RF26. O sistema deve permitir à liderança cadastrar, ativar e desativar categorias e locais.
RF27. O sistema deve permitir à liderança promover um usuário de executor para liderança.
RF28. O sistema deve criar todo novo usuário como "executor" no primeiro login, exigindo promoção manual da liderança para acesso total.

Módulo: Inteligência Operacional
RF29. O sistema deve oferecer à liderança uma visão que agrupe as demandas concluídas por categoria e por local ao longo do tempo, evidenciando recorrência (mesmo local ou categoria se repetindo) e o tempo médio entre abertura e conclusão — transformando o histórico em aprendizado, não apenas em consulta cronológica. Demandas geradas por recorrência devem ser identificáveis por `origemRecorrenciaId`.
RF30. Uma rotina automática diária deve avaliar as demandas ativas quanto a risco — vencidas, ou a vencer em N dias sem progresso desde a última mudança de status — e sinalizá-las de forma persistente (marcação `riscoSinalizadoEm` na demanda e evento no histórico), de modo que o risco exista mesmo que ninguém abra o Painel de Prazos. Complementa, não substitui, o cálculo em tempo real do RF15. A rotina deve ser idempotente (não repetir a sinalização de uma demanda já sinalizada).
RF31. A geração de uma demanda recorrente (RF18) e a sinalização de risco (RF30) devem produzir um evento visível para o executor responsável dentro do app — nunca uma alteração silenciosa.

## Requisitos Não-Funcionais

RNF01. Autenticação de liderança e executor via Clerk, com sessão persistente.
RNF02. Toda query e mutation deve verificar identidade antes de ler ou escrever; o Convex não possui RLS.
RNF03. O papel do usuário deve ser lido da tabela `usuarios`, nunca de claim do token.
RNF04. A abertura pública de demanda é a única mutation sem exigência de autenticação; toda outra função exposta exige identidade válida.
RNF05. Interface responsiva, com prioridade mobile para as telas do executor.
RNF06. Instalável como PWA.
RNF07. Painel de Prazos deve refletir mudanças em tempo real, sem necessidade de recarregar a página.
RNF08. Carregamento da tela inicial em menos de 2 segundos em 4G.


## Estrutura de pastas
```
/src
  /components
  /rotas
/convex
  schema.ts
  auth.config.ts
  lib/auth.ts
  demandas.ts
  triagem.ts
  recorrencias.ts
  usuarios.ts
  crons.ts
```

## Configuração
- `convex/auth.config.ts` com providers: `[{ domain: process.env.CLERK_JWT_ISSUER_DOMAIN, applicationID: "convex" }]`
- Envs do Convex: `CLERK_JWT_ISSUER_DOMAIN`
- Envs do frontend: `VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY`
- Providers aninhados: `<ClerkProvider>` por fora, `<ConvexProviderWithClerk>` por dentro
- Use `useConvexAuth()` para checar login, nunca o `useAuth()` do Clerk
- Use `<Authenticated>` / `<Unauthenticated>` / `<AuthLoading>` de `convex/react`
- Não há chamada de rede externa neste sistema — o link do WhatsApp é gerado no cliente
  (`wa.me/...`), sem `action` nem API

## Design
Implemente as telas fielmente ao protótipo. Design system:
- **Neutros (com temperatura, tema claro):**
  fundo `#F7F5F2` · superfície `#FFFFFF` · superfície elevada `#FCFAF7` · borda `#E4DFD8` ·
  texto secundário `#6B6459` · texto principal `#2B2621`
- **Acento (azul-petróleo dessaturado × 4 estados):**
  normal `#3D7A8C` · hover `#336A7A` · ativo `#2A5866` · sutil/fundo de badge `#E3EEF0`
- **Cores semânticas de status da demanda:**
  aberta `#8A94A6` / fundo `#EEF1F5` · triada `#3D7A8C` / fundo `#E3EEF0` ·
  em_execucao `#C9821A` / fundo `#FBEFDC` · aguardando `#B5643E` / fundo `#F6E9E2` ·
  concluida `#4C8B5B` / fundo `#E7F2E9` · cancelada `#9A968D` / fundo `#F1EFEB`
- **Cores de prioridade:** baixa = neutro · média `#C9821A` · alta `#C4453A` / fundo `#FBE6E4`
- **Cores de vencimento (Painel de Prazos):** vencida `#C4453A` · vencendo `#C9821A` · em dia = neutro
- **Tipografia:** Inter para títulos e corpo, IBM Plex Mono com `tabular-nums` para prazos
  e datas
- **Escala:** H1 32/40, H2 24/32, corpo 16/24, label 13/16 uppercase tracking 0.05em
- **Raio de borda:** 8px, aplicado consistentemente
- **Ícones:** Lucide
- **Densidade:** média — Painel de Prazos com linhas compactas para escaneio rápido; o
  resto (triagem, detalhe, recorrências) respira mais. Mobile do executor: toques grandes,
  alvo mínimo 56px.

## Ordem de execução
1. Setup: Vite + React + Tailwind, `npx convex dev`, instalar Clerk.
2. `auth.config.ts`, providers, rota protegida vazia funcionando.
3. `schema.ts` completo + `convex/lib/auth.ts` com `requireRole`.
4. Tabela `usuarios` + mutation `garantirUsuario` (cria como executor no primeiro login).
5. Formulário público de abertura + painel de próximo movimento (RF14a-i da emenda).
6. Módulo de triagem (liderança) e módulo de execução (executor), com histórico registrando
   cada mudança de status.
7. Manutenções recorrentes com antecedenciaDias (E5 da emenda) + crons.ts
   (geração diária idempotente, gerando com antecedência, não no dia do
   vencimento) + movimento "programar [manutenção]" no painel da
   liderança + geração de link `wa.me` a partir dos modelos de mensagem.
8. Impedimento estruturado ("aguardando" exige motivo de lista fechada), resultado esperado +
   confirmação na conclusão (RF06/RF12), rotina diária de avaliação de risco em `crons.ts`
   (grava `riscoSinalizadoEm`, idempotente, RF30) e visão de aprendizado por categoria/local
   (RF29).
9. Bloco de orçamento e custo na demanda (E2 da emenda): transição para
   "aguardando" com motivo aguardando_orcamento exigindo os quatro campos
   juntos; cobrança entrando na rotina diária existente (RF30); lançamento
   de custo obrigatório antes de concluir quando houve orçamento ou
   material; tabela consumos sem saldo (E2). Avisos pendentes ao
   solicitante (E1): registro criado na mudança de status, só sai do
   painel quando marcado como enviado.

Comece pelo passo 1. Ao terminar cada passo, rode o projeto, confirme que sobe sem erro e
diga o que testar na tela antes de seguir para o próximo. Faça um commit git a cada passo
que subir sem erro.

**Checkpoints obrigatórios:**
- Depois do passo 2: login pelo Clerk numa tela vazia tem que funcionar. Se não logar, pare aqui.
- Depois do passo 5: abrir uma demanda pelo formulário público e vê-la
  aparecer no painel como próximo movimento, com a frase explicando por que
  é ela. Esse é o "funcionou" de verdade.

Peça seed de categorias, locais e um modelo de mensagem logo no passo 3 — sem isso não dá
para testar a triagem.
