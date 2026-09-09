// Rótulos e classes semânticas (literais para o Tailwind escanear).

export type StatusDemanda =
  | "aberta"
  | "triada"
  | "em_execucao"
  | "aguardando"
  | "concluida"
  | "cancelada";

export const STATUS: Record<StatusDemanda, { rotulo: string; cls: string }> = {
  aberta: { rotulo: "Aberta", cls: "text-st-aberta bg-st-aberta-bg" },
  triada: { rotulo: "Triada", cls: "text-st-triada bg-st-triada-bg" },
  em_execucao: { rotulo: "Em execução", cls: "text-st-execucao bg-st-execucao-bg" },
  aguardando: { rotulo: "Aguardando", cls: "text-st-aguardando bg-st-aguardando-bg" },
  concluida: { rotulo: "Concluída", cls: "text-st-concluida bg-st-concluida-bg" },
  cancelada: { rotulo: "Cancelada", cls: "text-st-cancelada bg-st-cancelada-bg" },
};

export type Prioridade = "baixa" | "media" | "alta";

export const PRIORIDADE: Record<Prioridade, { rotulo: string; cls: string }> = {
  alta: { rotulo: "Alta", cls: "text-pri-alta bg-pri-alta-bg" },
  media: { rotulo: "Média", cls: "text-pri-media bg-st-execucao-bg" },
  baixa: { rotulo: "Baixa", cls: "text-text-2 bg-bg" },
};

export type MotivoImpedimento =
  | "aguardando_aprovacao"
  | "aguardando_material"
  | "aguardando_terceiro"
  | "aguardando_orcamento"
  | "aguardando_decisao";

export const MOTIVO_IMPEDIMENTO: Record<MotivoImpedimento, string> = {
  aguardando_aprovacao: "Aguardando aprovação",
  aguardando_material: "Aguardando material",
  aguardando_terceiro: "Aguardando terceiro",
  aguardando_orcamento: "Aguardando orçamento",
  aguardando_decisao: "Aguardando decisão",
};

export const TOM_PRAZO_CLS: Record<string, string> = {
  vencida: "text-venc-vencida",
  vencendo: "text-venc-vencendo",
  emdia: "text-text-2",
  neutro: "text-text-2",
};

export const PERIODICIDADE: Record<string, string> = {
  mensal: "Mensal",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};
