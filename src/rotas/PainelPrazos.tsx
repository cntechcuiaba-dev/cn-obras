import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, Wrench, Radio } from "lucide-react";
import { useCategorias, useExecutores, usePainelPrazos } from "../lib/dados";
import { CabecalhoSecao, Carregando, EstadoVazio } from "../components/ui";
import { LinhaDemanda } from "../components/LinhaDemanda";
import { DemandaView } from "../lib/tipos";

export default function PainelPrazos() {
  const navigate = useNavigate();
  const agora = Date.now();
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [responsavelId, setResponsavelId] = useState<string>("");

  const categorias = useCategorias();
  const executores = useExecutores();
  const painel = usePainelPrazos({
    categoriaId: categoriaId || undefined,
    responsavelId: responsavelId || undefined,
  });

  return (
    <div>
      <CabecalhoSecao
        supra="Painel da liderança"
        titulo="Prazos"
        descricao="O que precisa de atenção agora, atualizado em tempo real."
        acao={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-st-concluida-bg px-3 py-1 text-xs font-semibold text-st-concluida">
            <Radio className="h-3.5 w-3.5" /> Ao vivo
          </span>
        }
      />

      {painel === undefined ? (
        <Carregando />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Kpi
              icone={<AlertTriangle className="h-5 w-5" />}
              cor="text-venc-vencida"
              fundo="bg-pri-alta-bg"
              valor={painel.contadores.vencidas}
              rotulo="vencidas"
            />
            <Kpi
              icone={<Clock className="h-5 w-5" />}
              cor="text-venc-vencendo"
              fundo="bg-st-execucao-bg"
              valor={painel.contadores.vencendo}
              rotulo="vencendo (3 dias)"
            />
            <Kpi
              icone={<Wrench className="h-5 w-5" />}
              cor="text-accent"
              fundo="bg-accent-subtle"
              valor={painel.contadores.emExecucao}
              rotulo="em execução"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <select
              className="input max-w-[220px]"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
            >
              <option value="">Todas as categorias</option>
              {(categorias ?? []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <select
              className="input max-w-[220px]"
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
            >
              <option value="">Todos os executores</option>
              {(executores ?? []).map((u) => (
                <option key={u._id} value={u._id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>

          <Grupo
            cor="bg-venc-vencida"
            titulo="Vencidas"
            demandas={painel.vencidas as DemandaView[]}
            vazio="Nenhuma demanda vencida"
            agora={agora}
            onAbrir={(id) => navigate(`/demanda/${id}`)}
          />
          <Grupo
            cor="bg-venc-vencendo"
            titulo="Vencendo (próximos 3 dias)"
            demandas={painel.vencendo as DemandaView[]}
            vazio="Nada vencendo nos próximos dias"
            agora={agora}
            onAbrir={(id) => navigate(`/demanda/${id}`)}
          />
          <Grupo
            cor="bg-accent"
            titulo="Em execução"
            demandas={painel.emExecucao as DemandaView[]}
            vazio="Nada em execução no prazo"
            agora={agora}
            onAbrir={(id) => navigate(`/demanda/${id}`)}
          />
        </>
      )}
    </div>
  );
}

function Kpi({
  icone,
  cor,
  fundo,
  valor,
  rotulo,
}: {
  icone: React.ReactNode;
  cor: string;
  fundo: string;
  valor: number;
  rotulo: string;
}) {
  return (
    <div className="card p-4">
      <div className={`mb-2 inline-flex rounded p-1.5 ${fundo} ${cor}`}>{icone}</div>
      <p className={`font-mono text-3xl font-semibold tnum ${cor}`}>{valor}</p>
      <p className="text-sm text-text-2">{rotulo}</p>
    </div>
  );
}

function Grupo({
  cor,
  titulo,
  demandas,
  vazio,
  agora,
  onAbrir,
}: {
  cor: string;
  titulo: string;
  demandas: DemandaView[];
  vazio: string;
  agora: number;
  onAbrir: (id: string) => void;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${cor}`} />
        <h2 className="font-semibold">{titulo}</h2>
        <span className="rounded-full bg-bg px-2 py-0.5 text-xs text-text-2">
          {demandas.length}
        </span>
      </div>
      {demandas.length === 0 ? (
        <EstadoVazio>{vazio}</EstadoVazio>
      ) : (
        <div className="space-y-2">
          {demandas.map((d) => (
            <LinhaDemanda
              key={d._id}
              demanda={d}
              agora={agora}
              onClick={() => onAbrir(d._id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
