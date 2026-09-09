export const DIA_MS = 86_400_000;

export function formatarData(ts: number): string {
  return new Date(ts).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function formatarDataHora(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type TomPrazo = "vencida" | "vencendo" | "emdia" | "neutro";

// Espelha a lógica do protótipo: Venceu há Xd / Vence hoje / Vence em Xd / data.
export function rotuloPrazo(
  prazo: number | undefined | null,
  agora: number = Date.now(),
): { texto: string; tom: TomPrazo } {
  if (prazo == null) return { texto: "Sem prazo", tom: "neutro" };
  const dif = Math.floor((prazo - agora) / DIA_MS);
  if (dif < 0) return { texto: `Venceu há ${Math.abs(dif)}d`, tom: "vencida" };
  if (dif === 0) return { texto: "Vence hoje", tom: "vencendo" };
  if (dif <= 3) return { texto: `Vence em ${dif}d`, tom: "vencendo" };
  return { texto: formatarData(prazo), tom: "emdia" };
}

// Link wa.me gerado no cliente (sem action nem API — RF22/RF23).
export function linkWhatsapp(whatsapp: string, texto: string): string {
  const num = whatsapp.replace(/\D/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}

export function preencherModelo(
  texto: string,
  dados: Record<string, string>,
): string {
  return texto.replace(/{{(\w+)}}/g, (_, chave) => dados[chave] ?? "");
}

export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
