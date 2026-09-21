import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { List, Search } from "lucide-react";
import { useTodasDemandas } from "../lib/dados";
import { CabecalhoSecao, Carregando, EstadoVazio } from "../components/ui";
import { LinhaDemanda } from "../components/LinhaDemanda";
import { STATUS, StatusDemanda } from "../lib/labels";

// [RF14i] Consulta, não painel. Aberta por escolha — nunca é a tela inicial.
// Sem busca, quem sabia que a própria demanda existia não tinha como chegar
// nela: a lista é ordenada pela fórmula, não por quem procura.
const FILTROS: { valor: "todos" | StatusDemanda; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todas" },
  { valor: "aberta", rotulo: STATUS.aberta.rotulo },
  { valor: "triada", rotulo: STATUS.triada.rotulo },
  { valor: "em_execucao", rotulo: STATUS.em_execucao.rotulo },
  { valor: "aguardando", rotulo: STATUS.aguardando.rotulo },
];

export default function TodasDemandas() {
  const navigate = useNavigate();
  const agora = Date.now();
  const demandas = useTodasDemandas();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | StatusDemanda>("todos");

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (demandas ?? []).filter((d) => {
      if (filtro !== "todos" && d.status !== filtro) return false;
      if (!termo) return true;
      return [d.titulo, d.descricao, d.localNome, d.responsavelNome]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(termo));
    });
  }, [demandas, busca, filtro]);

  return (
    <div>
      <CabecalhoSecao
        supra="Consulta"
        titulo="Todas as demandas"
        descricao="Lista completa, ordenada pela mesma fórmula do painel."
      />

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-2"
            aria-hidden
          />
          <input
            className="input pl-9"
            type="search"
            placeholder="Buscar por título, local ou responsável"
            aria-label="Buscar demandas"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="rolagem-limpa flex gap-2 overflow-x-auto">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              aria-pressed={filtro === f.valor}
              className={`alvo-toque flex-none whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                filtro === f.valor
                  ? "border-accent bg-accent-subtle text-accent-active"
                  : "border-border text-text-2 hover:border-border-strong hover:text-text-1"
              }`}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
      </div>

      {demandas === undefined ? (
        <Carregando />
      ) : visiveis.length === 0 ? (
        <EstadoVazio icone={<List className="h-6 w-6" />}>
          {demandas.length === 0
            ? "Nenhuma demanda ativa"
            : "Nada encontrado com esse filtro ou busca"}
        </EstadoVazio>
      ) : (
        <>
          <p className="mb-2 text-xs text-text-2" role="status">
            {visiveis.length} de {demandas.length}
          </p>
          <div className="space-y-2.5">
            {visiveis.map((d, i) => (
              <div
                key={d._id}
                className="animate-rise-in"
                // Entrada escalonada: a lista "assenta" em vez de aparecer seca.
                // Teto baixo no atraso pra não travar a leitura em listas longas.
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <LinhaDemanda
                  demanda={d}
                  agora={agora}
                  onClick={() => navigate(`/demanda/${d._id}`)}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
