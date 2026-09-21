import { ReactNode, useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import {
  LayoutDashboard,
  Inbox,
  Repeat,
  LineChart,
  ListChecks,
  Settings,
  Plus,
  Ellipsis,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "./Logo";
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

// No celular a navegação vira barra de abas embaixo (polegar alcança, rótulo
// visível). Cabem 4: o que sobra vai para "Mais". Liderança tem 5 links +
// Administração, então três ficam no "Mais".
const ABAS_PRINCIPAIS = 3;

function classeAba(ativa: boolean) {
  return `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
    ativa ? "text-accent-active" : "text-text-2"
  }`;
}

function BarraInferior({ papel }: { papel: Papel }) {
  const [aberto, setAberto] = useState(false);
  const { pathname } = useLocation();
  const links = LINKS[papel];
  const principais = papel === "lideranca" ? links.slice(0, ABAS_PRINCIPAIS) : links;
  const extras: Item[] =
    papel === "lideranca"
      ? [...links.slice(ABAS_PRINCIPAIS), { to: "/admin", label: "Administração", icone: Settings }]
      : [];
  const extraAtivo = extras.some((e) => pathname.startsWith(e.to));

  useEffect(() => setAberto(false), [pathname]);
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);

  return (
    <>
      {aberto && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-20 cursor-default bg-text-1/20 md:hidden"
          onClick={() => setAberto(false)}
        />
      )}
      {aberto && (
        <div
          id="menu-mais"
          className="fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 rounded-xl border border-border bg-surface p-1.5 shadow-popover md:hidden"
        >
          {extras.map((e) => (
            <Link
              key={e.to}
              to={e.to}
              className="flex min-h-[48px] items-center gap-3 rounded-lg px-3 text-sm font-medium text-text-1 hover:bg-surface-raise"
            >
              <e.icone className="h-5 w-5 text-text-2" aria-hidden />
              {e.label}
            </Link>
          ))}
        </div>
      )}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border/70 bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-header backdrop-blur md:hidden"
      >
        {principais.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            className={({ isActive }) => classeAba(isActive)}
          >
            <l.icone className="h-5 w-5" aria-hidden />
            {l.label}
          </NavLink>
        ))}
        {extras.length > 0 && (
          <button
            type="button"
            aria-expanded={aberto}
            aria-controls="menu-mais"
            onClick={() => setAberto((v) => !v)}
            className={classeAba(aberto || extraAtivo)}
          >
            <Ellipsis className="h-5 w-5" aria-hidden />
            Mais
          </button>
        )}
      </nav>
    </>
  );
}

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
    <div className="relative min-h-full">
      {/* Brilho suave no topo: faz o espaço vazio da tela inicial (que é
          proposital — um movimento por vez) ler como respiro, não como
          página inacabada. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-accent-subtle/50 to-transparent"
      />
      <header className="sticky top-0 z-10 border-b border-border/70 bg-surface/90 shadow-header backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex flex-none items-center gap-2 font-semibold text-text-1">
            <Logo className="h-8 w-8" alt="CN Obras" />
            <span className="hidden whitespace-nowrap sm:inline">CN Obras</span>
          </div>

          <nav aria-label="Principal" className="rolagem-limpa ml-auto hidden items-center gap-1 overflow-x-auto md:flex">
            {LINKS[papel].map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  `inline-flex min-h-[36px] items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-accent-subtle text-accent-active shadow-sm"
                      : "text-text-2 hover:bg-surface-raise hover:text-text-1"
                  }`
                }
              >
                <l.icone className="h-4 w-4 flex-none" aria-hidden />
                <span className="whitespace-nowrap">{l.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex flex-none items-center gap-2 md:ml-0 md:border-l md:border-border md:pl-2">
            {/* Admin é aberta por escolha, não ação do dia a dia — fica fora da
                nav de movimento, como ícone dedicado (mesmo espírito do RF14i). */}
            {papel === "lideranca" && (
              <Link
                to="/admin"
                title="Administração"
                aria-label="Administração"
                className="hidden h-9 w-9 place-items-center rounded md:grid text-text-2 transition-all duration-150 hover:bg-surface-raise hover:text-text-1"
              >
                <Settings className="h-4 w-4" aria-hidden />
              </Link>
            )}
            {/* Abrir demanda continua sendo o mesmo formulário público (RF01) —
                aqui é só o atalho, que faltava para quem está logado. */}
            <a
              href="/nova"
              target="_blank"
              rel="noreferrer"
              title="Abrir nova solicitação (formulário público)"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded px-3 text-sm font-medium text-accent-active transition-all duration-150 hover:bg-accent-subtle md:min-h-0 md:py-1.5"
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span className="whitespace-nowrap">Nova</span>
            </a>
            <span className="hidden whitespace-nowrap text-sm text-text-2 xl:inline">
              {nome}
            </span>
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

      <main className="relative mx-auto max-w-5xl animate-fade-in px-4 pb-28 pt-8 md:pb-8">{children}</main>
      <BarraInferior papel={papel} />
    </div>
  );
}
