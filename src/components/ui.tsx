import { ReactNode } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import {
  STATUS,
  StatusDemanda,
  PRIORIDADE,
  Prioridade,
  TOM_PRAZO_CLS,
} from "../lib/labels";
import { rotuloPrazo } from "../lib/format";

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
}: {
  prazo?: number | null;
  agora?: number;
}) {
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
  return <div className={`animate-pulse rounded bg-border/70 ${className}`} />;
}

export function EstadoVazio({
  icone,
  children,
}: {
  icone?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-10 text-center text-sm text-text-2">
      {icone}
      <p>{children}</p>
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
    <div className="mb-6 flex items-end justify-between gap-4">
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
