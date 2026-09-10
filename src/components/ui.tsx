import { ReactNode } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import {
  STATUS,
  StatusDemanda,
  PRIORIDADE,
  Prioridade,
  TOM_PRAZO_CLS,
} from "../lib/labels";
import { rotuloPrazo, formatarData } from "../lib/format";

export function StatusChip({ status }: { status: StatusDemanda }) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.rotulo}
    </span>
  );
}

export function PrioridadeChip({ prioridade }: { prioridade?: Prioridade }) {
  if (!prioridade) return null;
  const p = PRIORIDADE[prioridade];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${p.cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {p.rotulo}
    </span>
  );
}

export function PrazoBadge({
  prazo,
  agora,
  status,
  concluidaEm,
}: {
  prazo?: number | null;
  agora?: number;
  status?: StatusDemanda;
  concluidaEm?: number;
}) {
  // Demanda encerrada não tem prazo pendente — mostrar "vence em X" ali é ruído.
  if (status === "concluida") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-sm tnum text-st-concluida">
        <Clock className="h-4 w-4" />
        {concluidaEm ? `Concluída ${formatarData(concluidaEm)}` : "Concluída"}
      </span>
    );
  }
  if (status === "cancelada") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-sm tnum text-st-cancelada">
        Cancelada
      </span>
    );
  }

  const { texto, tom } = rotuloPrazo(prazo, agora);
  const Icone = tom === "vencida" ? AlertTriangle : Clock;
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-sm font-medium tnum ${TOM_PRAZO_CLS[tom]}`}
    >
      <Icone className="h-4 w-4" />
      {texto}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded bg-border/60 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
}

export function EstadoVazio({
  icone,
  children,
}: {
  icone?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/50 py-14 text-center text-sm text-text-2">
      {icone && (
        <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-raise text-text-2 ring-1 ring-inset ring-border">
          {icone}
        </span>
      )}
      <p className="max-w-xs leading-relaxed">{children}</p>
    </div>
  );
}

export function Carregando({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-text-2">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
      {label}
    </div>
  );
}

export function CabecalhoSecao({
  supra,
  titulo,
  descricao,
  acao,
}: {
  supra?: string;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="mb-6 flex animate-fade-in items-end justify-between gap-4">
      <div>
        {supra && (
          <p className="text-label uppercase text-accent mb-1">{supra}</p>
        )}
        <h1 className="text-3xl font-bold leading-tight text-text-1">{titulo}</h1>
        {descricao && <p className="mt-1 text-text-2">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}
