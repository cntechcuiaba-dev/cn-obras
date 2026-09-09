import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Schema — Central CN Obras. Fonte: docs/02-schema-convex.md (já com as correções da
// auditoria Trino v2: impedimento estruturado, resultado esperado/confirmado, risco).

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
    executorId: v.optional(v.id("usuarios")),
    resultadoEsperado: v.optional(v.string()),

    // preenchidos ao entrar em "aguardando" (durante a parada)
    motivoImpedimento: v.optional(motivoImpedimento),
    impedimentoDesde: v.optional(v.number()),

    concluidaEm: v.optional(v.number()),
    resultadoConfirmado: v.optional(v.boolean()),

    riscoSinalizadoEm: v.optional(v.number()),

    origemRecorrenciaId: v.optional(v.id("manutencoesRecorrentes")),
  })
    .index("by_status", ["status"])
    .index("by_executor", ["executorId"])
    .index("by_prazo", ["prazo"])
    .index("by_origem_recorrencia", ["origemRecorrenciaId"]),

  historicoDemanda: defineTable({
    demandaId: v.id("demandas"),
    tipo: v.string(), // "criada" | "triada" | "status_alterado" | "foto" | "risco_sinalizado" | ...
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
    periodicidade,
    prazoDias: v.number(),
    ativa: v.boolean(),
    ultimaGeracaoEm: v.optional(v.number()),
  }).index("by_ativa", ["ativa"]),
});
