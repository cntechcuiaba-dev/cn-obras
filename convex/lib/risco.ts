import { Doc } from "../_generated/dataModel";

export const DIA_MS = 86_400_000;
export const DIAS_VENCENDO = 3; // "vencendo" = vence dentro de N dias

export type NivelRisco = "vencida" | "vencendo" | "em_dia" | "sem_prazo";

// Vencida/vencendo é calculado na LEITURA (prazo vs agora) — não é campo. RF15.
export function nivelRisco(prazo: number | undefined, agora: number): NivelRisco {
  if (prazo === undefined) return "sem_prazo";
  if (prazo < agora) return "vencida";
  if (prazo - agora <= DIAS_VENCENDO * DIA_MS) return "vencendo";
  return "em_dia";
}

// Peso de risco para ordenar a fila: vencida antes de vencendo antes de em dia.
export function pesoRisco(nivel: NivelRisco): number {
  switch (nivel) {
    case "vencida":
      return 0;
    case "vencendo":
      return 1;
    case "em_dia":
      return 2;
    case "sem_prazo":
      return 3;
  }
}

const PESO_PRIORIDADE: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

// Ordenação da fila: risco de vencimento e, dentro do mesmo risco, prioridade. RF14.
export function compararPorRiscoEPrioridade(
  a: Doc<"demandas">,
  b: Doc<"demandas">,
  agora: number,
): number {
  const pa = pesoRisco(nivelRisco(a.prazo, agora));
  const pb = pesoRisco(nivelRisco(b.prazo, agora));
  if (pa !== pb) return pa - pb;
  const pra = PESO_PRIORIDADE[a.prioridade ?? "baixa"] ?? 2;
  const prb = PESO_PRIORIDADE[b.prioridade ?? "baixa"] ?? 2;
  if (pra !== prb) return pra - prb;
  return (a.prazo ?? Infinity) - (b.prazo ?? Infinity);
}

export const STATUS_ATIVOS = ["triada", "em_execucao", "aguardando"] as const;

export function isAtiva(status: Doc<"demandas">["status"]): boolean {
  return (STATUS_ATIVOS as readonly string[]).includes(status);
}
