import { ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import {
  HardHat,
  LayoutDashboard,
  Inbox,
  Repeat,
  LineChart,
  ListChecks,
  Settings,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { Papel } from "../lib/auth-types";
import { DEMO } from "../lib/env";
import { iniciais } from "../lib/format";

interface Item {
  to: string;
  label: string;
  icone: LucideIcon;
}

// [RF14i] O painel é a inicial dos dois papéis; "Todas as demandas" é consulta,
// aberta por escolha.
const LINKS: Record<Papel, Item[]> = {
  lideranca: [
    { to: "/", label: "Painel", icone: LayoutDashboard },
    { to: "/triagem", label: "Triagem", icone: Inbox },
    { to: "/demandas", label: "Todas", icone: ListChecks },
    { to: "/recorrencias", label: "Recorrências", icone: Repeat },
    { to: "/inteligencia", label: "Aprendizado", icone: LineChart },
  ],
  executor: [
    { to: "/", label: "Painel", icone: LayoutDashboard },
    { to: "/demandas", label: "Todas", icone: ListChecks },
  ],
};

export function Shell({
  papel,
  nome,
  children,
}: {
  papel: Papel;
  nome: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-text-1">
            <span className="grid h-8 w-8 place-items-center rounded bg-accent text-white">
              <HardHat className="h-5 w-5" />
            </span>
            <span className="hidden sm:inline">CN Obras</span>
          </div>

          <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
            {LINKS[papel].map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-accent-subtle text-accent-active"
                      : "text-text-2 hover:bg-surface-raise hover:text-text-1"
                  }`
                }
              >
                <l.icone className="h-4 w-4" />
                <span className="hidden sm:inline">{l.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 border-l border-border pl-2">
            {/* Admin é aberta por escolha, não ação do dia a dia — fica fora da
                nav de movimento, como ícone dedicado (mesmo espírito do RF14i). */}
            {papel === "lideranca" && (
              <Link
                to="/admin"
                title="Administração"
                className="grid h-8 w-8 place-items-center rounded text-text-2 transition hover:bg-surface-raise hover:text-text-1"
              >
                <Settings className="h-4 w-4" />
              </Link>
            )}
            {/* Abrir demanda continua sendo o mesmo formulário público (RF01) —
                aqui é só o atalho, que faltava para quem está logado. */}
            <a
              href="/nova"
              target="_blank"
              rel="noreferrer"
              title="Abrir nova solicitação (formulário público)"
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium text-accent hover:bg-accent-subtle"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova</span>
            </a>
            <span className="hidden text-sm text-text-2 md:inline">{nome}</span>
            {DEMO ? (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-subtle text-xs font-semibold text-accent-active">
                {iniciais(nome)}
              </span>
            ) : (
              <UserButton afterSignOutUrl="/" />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
