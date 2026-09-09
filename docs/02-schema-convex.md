# Schema — Central CN Obras

> Atualizado com a Emenda 01 (E2 orçamento/custo, E4 responsável/equipe,
> E5 antecedência de recorrência). Substitui a versão original deste
> arquivo por inteiro.

```ts
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
```

**Notas de modelagem**
- Sem `id` nem `criado_em` — Convex já entrega `_id` e `_creationTime`.
- Vencida/vencendo é **calculado na leitura** (`prazo` vs `Date.now()`), usado
  para colorir o prazo no painel — não define mais agrupamento de tela
  (RF14 revogado pela Emenda 01, E3).
- `prioridade` entra na fórmula de ordenação do painel (E3/RF14c) junto com
  o risco de vencimento — não serve só para colorir badge.
- `motivoImpedimento` é lista fechada preenchida **durante** a parada, não
  no fechamento. `aguardando_orcamento` agora exige o bloco `orcamento`
  completo como condição de entrada nesse motivo (E2).
- `resultadoEsperado` + `resultadoConfirmado` separam **execução de
  resultado**: concluir exige confirmar que o resultado esperado foi
  atingido, não só mudar status.
- `responsavelId` é sempre um — dono do próximo movimento e de quem é o
  painel. `equipeIds` tem acesso e pode registrar execução, mas não recebe
  o movimento (E4).
- `orcamento` é compromisso embutido, não tabela própria: os quatro campos
  (fornecedor, solicitadoEm, cobrarEm, responsavelCobrancaId) são
  obrigatórios juntos na mutation que move para `aguardando_orcamento`.
  A cobrança na data (`cobrarEm`) é lida pela mesma rotina diária do RF30.
- `custo` é obrigatório (zero é resposta válida, ausente não é) antes de
  `concluida` sempre que a demanda passou por `aguardando_material` ou
  `aguardando_orcamento`. Validado na mutation.
- `consumos` não tem saldo nem inventário — decisão explícita (E2). Registra
  só o consumo, para alimentar recorrência de troca e histórico de preço.
- `avisos` não é enviado pelo sistema — o link `wa.me` é gerado e a pessoa
  envia manualmente. O registro só sai do painel quando marcado como
  enviado (E1).
- `antecedenciaDias` (E5): a demanda recorrente nasce com essa antecedência
  em relação ao vencimento, não no dia — para dar tempo da liderança se
  programar. Gera o movimento "programar [manutenção]" no painel.
- `origemRecorrenciaId` tem índice próprio porque é **lido** pela visão de
  aprendizado (recorrência de problema por local/categoria — RF29).
- Sem tabelas `operadores`/`sessoesOperador`: executor entra pelo Clerk.
- Nenhuma chamada de rede externa — WhatsApp é link `wa.me`, sem `action`.
  As automações reais são `cron`s internos: geração de recorrência,
  avaliação diária de risco, e agora cobrança de orçamento vencido (E2).

**Autorização (implementada nas functions, não no banco):**
```
- demandas:
    · leitura: lideranca lê tudo; executor lê só onde responsavelId ===
      o próprio OU o próprio está em equipeIds [E4]
    · escrita (abertura): pública, sem auth — só cria com status "aberta"
    · escrita (triagem/reatribuição/cancelamento + resultadoEsperado): só lideranca
    · escrita (mudança de status em_execucao/aguardando/concluida): só
      responsavelId ou integrante de equipeIds — ao entrar em "aguardando"
      grava motivoImpedimento + impedimentoDesde (+ bloco orcamento
      completo se o motivo for aguardando_orcamento); ao concluir grava
      resultadoConfirmado (obrigatório) + custo (obrigatório se passou por
      material/orçamento)
    · escrita do bloco orcamento (solicitar, registrar valor recebido):
      lideranca, ou responsavelId da demanda [E2]
    · orcamento.aprovadoEm / aprovadoPorId: só lideranca [E2]
    · escrita de riscoSinalizadoEm: só mutation interna (rotina de
      avaliação de risco), nunca pelo cliente
- consumos: lideranca ou responsavelId da demanda [E2]
- avisos: criados só por mutation interna (na mudança de status); marcados
  como enviados só por responsavelId [E1]
- historicoDemanda: leitura por quem pode ler a demanda; escrita só via
  mutation interna (nunca inserida direto pelo cliente)
- manutencoesRecorrentes: só lideranca lê e escreve
- categorias / locais / modelosMensagem: leitura por lideranca e executor;
  escrita só lideranca
- usuarios: ninguém escreve pelo cliente; só via mutation interna
  `garantirUsuario`
```

**Regra de escrita do campo `status`:** um único conjunto de mutations
(em `convex/demandas.ts`) escreve esse campo. Nenhuma outra function do
projeto grava `status` diretamente. Se essa regra for violada, a máquina
de estados deixa de existir sem ninguém perceber.
