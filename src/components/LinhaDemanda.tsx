import { MapPin, User, ChevronRight, ShieldAlert } from "lucide-react";
import { DemandaView } from "../lib/tipos";
import { StatusChip, PrazoBadge } from "./ui";

// Ponto antes do título: o risco aparece sem faixa colorida na lateral.
const PONTO_RISCO: Record<string, string> = {
  vencida: "bg-venc-vencida",
  vencendo: "bg-venc-vencendo",
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
      className="card card-hover group flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-surface-raise sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {PONTO_RISCO[demanda.risco ?? ""] && (
            <span
              title={demanda.risco === "vencida" ? "Prazo vencido" : "Prazo próximo"}
              className={`mt-[7px] h-2 w-2 flex-none rounded-full ${PONTO_RISCO[demanda.risco ?? ""]}`}
            >
              <span className="sr-only">
                {demanda.risco === "vencida" ? "Prazo vencido." : "Prazo próximo."}
              </span>
            </span>
          )}
          <p className="line-clamp-2 font-semibold leading-snug text-text-1 sm:line-clamp-1">
            {demanda.titulo}
          </p>
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
          {demanda.responsavelNome && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {demanda.responsavelNome}
            </span>
          )}
          <StatusChip status={demanda.status} />
        </div>
      </div>
      <div className="flex flex-none items-center justify-between gap-3">
        <PrazoBadge
          prazo={demanda.prazo}
          agora={agora}
          status={demanda.status}
          concluidaEm={demanda.concluidaEm}
        />
        <ChevronRight className="h-4 w-4 text-text-2 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}
