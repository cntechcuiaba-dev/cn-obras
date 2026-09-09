import { useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { ListChecks, ShieldCheck } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { DEMO } from "../lib/env";
import { useMinhasDemandas } from "../lib/dados";
import { CabecalhoSecao, Carregando, EstadoVazio } from "../components/ui";
import { LinhaDemanda } from "../components/LinhaDemanda";
import { DemandaView } from "../lib/tipos";
import { STATUS, StatusDemanda } from "../lib/labels";

const ORDEM: StatusDemanda[] = ["em_execucao", "aguardando", "triada", "concluida"];

export default function MinhasDemandas() {
  const navigate = useNavigate();
  const agora = Date.now();
  const dados = useMinhasDemandas();

  const total =
    dados &&
    ORDEM.reduce((n, s) => n + ((dados as unknown as Record<string, DemandaView[]>)[s]?.length ?? 0), 0);

  return (
    <div>
      <CabecalhoSecao
        supra="Executor"
        titulo="Minhas Demandas"
        descricao="As demandas atribuídas a você, agrupadas por situação."
      />

      {dados === undefined ? (
        <Carregando />
      ) : total === 0 ? (
        <>
          <EstadoVazio icone={<ListChecks className="h-6 w-6" />}>
            Nenhuma demanda atribuída a você
          </EstadoVazio>
          {!DEMO && <BootstrapLideranca />}
        </>
      ) : (
        <div className="space-y-8">
          {ORDEM.map((s) => {
            const lista = (dados as unknown as Record<string, DemandaView[]>)[s] ?? [];
            if (lista.length === 0) return null;
            return (
              <section key={s}>
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[s].cls}`}
                  >
                    {STATUS[s].rotulo}
                  </span>
                  <span className="text-xs text-text-2">{lista.length}</span>
                </div>
                <div className="space-y-2">
                  {lista.map((d) => (
                    <LinhaDemanda
                      key={d._id}
                      demanda={d}
                      agora={agora}
                      onClick={() => navigate(`/demanda/${d._id}`)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Bootstrap: o primeiro usuário do sistema se promove a liderança (só funciona se ainda
// não houver nenhuma liderança — validado no servidor).
function BootstrapLideranca() {
  const promover = useMutation(api.usuarios.promoverPrimeiroComoLideranca);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="card mt-6 flex flex-col items-start gap-2 p-4 text-sm">
      <p className="text-text-2">
        Primeiro acesso do sistema? Se ainda não há liderança cadastrada, assuma o papel:
      </p>
      <button
        className="btn-ghost"
        onClick={async () => {
          const r = await promover({});
          setMsg(
            r === "promovido"
              ? "Você agora é liderança. Recarregando…"
              : "Já existe uma liderança — peça a ela para promover seu acesso.",
          );
          if (r === "promovido") setTimeout(() => location.reload(), 800);
        }}
      >
        <ShieldCheck className="h-4 w-4" />
        Sou a liderança
      </button>
      {msg && <p className="text-text-2">{msg}</p>}
    </div>
  );
}
