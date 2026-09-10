import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Schema — Central CN Obras. Fonte: docs/02-schema-convex.md (Emenda 01).
// E1 avisos · E2 orçamento/custo/consumos · E4 responsável/equipe · E5 antecedência.

export const statusDemanda = v.union(
  v.literal("aberta"),
  v.literal("triada"),
  v.literal("em_execucao"),
  v.literal("aguardando"),
  v.literal("concluida"),
  v.literal("cancelada"),
);

export const prioridadeDemanda = v.union(
  v.literal("baixa"),
  v.literal("media"),
  v.literal("alta"),
);

export const motivoImpedimento = v.union(
  v.literal("aguardando_aprovacao"),
  v.literal("aguardando_material"),
  v.literal("aguardando_terceiro"),
  v.literal("aguardando_orcamento"),
  v.literal("aguardando_decisao"),
);

export const periodicidade = v.union(
  v.literal("mensal"),
  v.literal("bimestral"),
  v.literal("trimestral"),
  v.literal("semestral"),
  v.literal("anual"),
);

// [E2] compromisso embutido na demanda — obrigatório por inteiro na mutation
// que entra em "aguardando" com motivo "aguardando_orcamento".
export const blocoOrcamento = v.object({
  fornecedor: v.string(),
  solicitadoEm: v.number(),
  cobrarEm: v.number(),
  responsavelCobrancaId: v.id("usuarios"),
  cobrancasFeitas: v.number(),
  valorRecebido: v.optional(v.number()),
  recebidoEm: v.optional(v.number()),
  aprovadoEm: v.optional(v.number()),
  aprovadoPorId: v.optional(v.id("usuarios")),
});

// [E2] fato realizado — obrigatório (zero é válido) antes de "concluida"
// quando a demanda passou por material ou orçamento.
export const blocoCusto = v.object({
  valor: v.number(),
  origem: v.union(
    v.literal("estoque"),
    v.literal("compra_direta"),
    v.literal("orcamento"),
  ),
  lancadoEm: v.number(),
});

export const origemConsumo = v.union(
  v.literal("estoque"),
  v.literal("compra"),
);

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

  // Equipamento que pode ter manutenção periódica (ar-condicionado, bebedouro,
  // portão eletrônico...). Vincula tanto recorrências quanto demandas avulsas,
  // para o aprendizado (RF29) revelar padrão por EQUIPAMENTO, não só por local —
  // "este ar-condicionado específico já teve 4 chamados" é sinal de trocar, não
  // só consertar de novo.
  equipamentos: defineTable({
    nome: v.string(), // ex: "Ar-condicionado — Secretaria"
    tipo: v.string(), // ex: "Ar-condicionado", "Bebedouro" — curado pela liderança, não enum fechado
    localId: v.id("locais"),
    patrimonio: v.optional(v.string()),
    instaladoEm: v.optional(v.number()),
    ativo: v.boolean(),
  })
    .index("by_local", ["localId"])
    .index("by_ativo", ["ativo"]),

  modelosMensagem: defineTable({
    nome: v.string(),
    texto: v.string(), // placeholders: {{demanda}}, {{prazo}}, {{local}}, {{solicitante}}
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
    localTextoOriginal: v.string(),
    anexosAbertura: v.optional(v.array(v.id("_storage"))),

    status: statusDemanda,

    // preenchidos na triagem
    categoriaId: v.optional(v.id("categorias")),
    localId: v.optional(v.id("locais")),
    prioridade: v.optional(prioridadeDemanda),
    prazo: v.optional(v.number()),
    resultadoEsperado: v.optional(v.string()),
    // Equipamento ao qual a demanda se refere, quando aplicável (ex: "o
    // ar-condicionado tal está vazando"). Opcional — marcado na triagem, nem
    // toda demanda é sobre um equipamento cadastrado.
    equipamentoId: v.optional(v.id("equipamentos")),

    // [E4] dono único do próximo movimento — renomeado de executorId
    responsavelId: v.optional(v.id("usuarios")),
    // [E4] quem executa junto; tem acesso, não recebe o movimento
    equipeIds: v.optional(v.array(v.id("usuarios"))),

    // preenchidos ao entrar em "aguardando" (durante a parada)
    motivoImpedimento: v.optional(motivoImpedimento),
    impedimentoDesde: v.optional(v.number()),

    orcamento: v.optional(blocoOrcamento),
    custo: v.optional(blocoCusto),

    concluidaEm: v.optional(v.number()),
    resultadoConfirmado: v.optional(v.boolean()),

    riscoSinalizadoEm: v.optional(v.number()),

    origemRecorrenciaId: v.optional(v.id("manutencoesRecorrentes")),
  })
    .index("by_status", ["status"])
    .index("by_responsavel", ["responsavelId"])
    .index("by_prazo", ["prazo"])
    .index("by_origem_recorrencia", ["origemRecorrenciaId"])
    .index("by_equipamento", ["equipamentoId"])
    // [E2] varre orçamentos vencidos sem depender de alguém abrir o painel
    .index("by_cobranca", ["status", "orcamento.cobrarEm"]),

  historicoDemanda: defineTable({
    demandaId: v.id("demandas"),
    tipo: v.string(),
    descricao: v.string(),
    criadoPorClerkId: v.optional(v.string()), // ausente quando gerado pelo sistema (cron)
    anexos: v.optional(v.array(v.id("_storage"))),
  }).index("by_demanda", ["demandaId"]),

  manutencoesRecorrentes: defineTable({
    titulo: v.string(),
    descricao: v.string(),
    categoriaId: v.id("categorias"),
    localId: v.id("locais"),
    // Equipamento específico, quando a recorrência é sobre um (a maioria é).
    // Opcional porque nem toda recorrência é de equipamento — ex.: revisão
    // elétrica geral do templo não é "um" equipamento.
    equipamentoId: v.optional(v.id("equipamentos")),
    executorPadraoId: v.id("usuarios"),
    periodicidade,
    // [E5] gera a demanda com antecedência, para dar tempo de programação
    antecedenciaDias: v.number(),
    ativa: v.boolean(),
    ultimaGeracaoEm: v.optional(v.number()),
  }).index("by_ativa", ["ativa"]),

  // [E2] consumo de material — sem saldo, sem inventário (decisão explícita)
  consumos: defineTable({
    demandaId: v.id("demandas"),
    item: v.string(),
    quantidade: v.number(),
    valorUnitario: v.optional(v.number()),
    origem: origemConsumo,
  })
    .index("by_demanda", ["demandaId"])
    .index("by_item", ["item"]), // histórico de preço pago, usado na aprovação

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

  // Identidade visual do cliente (white-label). Tabela de linha única: a
  // liderança envia a própria logo e ela passa a aparecer no login, no
  // cabeçalho e no formulário público. Sem linha = usa a logo padrão.
  configuracao: defineTable({
    logoStorageId: v.optional(v.id("_storage")),
    atualizadoEm: v.number(),
  }),
});
