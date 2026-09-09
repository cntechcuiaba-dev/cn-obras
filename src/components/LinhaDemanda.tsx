import { MapPin, User, ChevronRight, ShieldAlert } from "lucide-react";
import { DemandaView } from "../lib/tipos";
import { StatusChip, PrioridadeChip, PrazoBadge } from "./ui";

const BORDA_RISCO: Record<string, string> = {
  vencida: "border-l-venc-vencida",
  vencendo: "border-l-venc-vencendo",
  em_dia: "border-l-border",
  sem_prazo: "border-l-border",
};

export function LinhaDemanda({
  demanda,
  agora,
  onClick,
}: {
  demanda: DemandaView;
  agora: number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`card flex w-full items-center gap-4 border-l-4 px-4 py-3 text-left transition hover:bg-surface-raise ${
        BORDA_RISCO[demanda.risco ?? "em_dia"] ?? "border-l-border"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-text-1">{demanda.titulo}</p>
          {demanda.riscoSinalizadoEm && (
            <span
              title="Risco sinalizado pela rotina diária"
              className="inline-flex items-center gap-1 rounded-full bg-pri-alta-bg px-1.5 py-0.5 text-[11px] font-semibold text-pri-alta"
            >
              <ShieldAlert className="h-3 w-3" /> Risco
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-2">
          {demanda.localNome && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {demanda.localNome}
            </span>
          )}
          {demanda.executorNome && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {demanda.executorNome}
            </span>
          )}
          <StatusChip status={demanda.status} />
          <PrioridadeChip prioridade={demanda.prioridade} />
        </div>
      </div>
      <div className="flex flex-none items-center gap-3">
        <PrazoBadge prazo={demanda.prazo} agora={agora} />
        <ChevronRight className="h-4 w-4 text-text-2" />
      </div>
    </button>
  );
}
