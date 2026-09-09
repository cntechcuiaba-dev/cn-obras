import { DemandaView } from "./tipos";

// Espelho client-side de convex/lib/risco.ts, para o modo demo agrupar/ordenar como o backend.
export const DIA_MS = 86_400_000;
export const DIAS_VENCENDO = 3;

export type NivelRisco = "vencida" | "vencendo" | "em_dia" | "sem_prazo";

export function nivelRisco(prazo: number | undefined, agora: number): NivelRisco {
  if (prazo === undefined) return "sem_prazo";
  if (prazo < agora) return "vencida";
  if (prazo - agora <= DIAS_VENCENDO * DIA_MS) return "vencendo";
  return "em_dia";
}

function pesoRisco(n: NivelRisco): number {
  return { vencida: 0, vencendo: 1, em_dia: 2, sem_prazo: 3 }[n];
}

const PESO_PRIORIDADE: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

export function compararPorRiscoEPrioridade(
  a: DemandaView,
  b: DemandaView,
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

export const STATUS_ATIVOS = ["triada", "em_execucao", "aguardando"];
export function isAtiva(status: string): boolean {
  return STATUS_ATIVOS.includes(status);
}
