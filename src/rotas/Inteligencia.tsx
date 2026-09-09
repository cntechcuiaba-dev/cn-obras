import { LineChart } from "lucide-react";
import { useAprendizado } from "../lib/dados";
import { CabecalhoSecao, Carregando, EstadoVazio } from "../components/ui";

export default function Inteligencia() {
  const dados = useAprendizado();

  return (
    <div>
      <CabecalhoSecao
        supra="Liderança"
        titulo="Aprendizado"
        descricao="O que o histórico revela — recorrência por local/categoria e tempo até concluir."
      />

      {dados === undefined ? (
        <Carregando />
      ) : dados.totalConsiderado === 0 ? (
        <EstadoVazio icone={<LineChart className="h-6 w-6" />}>
          Ainda não há demandas suficientes para gerar aprendizado
        </EstadoVazio>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Tabela titulo="Por local" linhas={dados.porLocal} />
          <Tabela titulo="Por categoria" linhas={dados.porCategoria} />
        </div>
      )}
    </div>
  );
}

function Tabela({
  titulo,
  linhas,
}: {
  titulo: string;
  linhas: {
    nome: string;
    total: number;
    concluidas: number;
    tempoMedioDias: number | null;
  }[];
}) {
  const max = Math.max(1, ...linhas.map((l) => l.total));
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-semibold">{titulo}</h2>
      <div className="space-y-3">
        {linhas.map((l) => (
          <div key={l.nome}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">{l.nome}</span>
              <span className="text-text-2">
                <span className="font-mono tnum">{l.total}</span> demandas
                {l.tempoMedioDias != null && (
                  <>
                    {" · "}
                    <span className="font-mono tnum">{l.tempoMedioDias}</span>d médio
                  </>
                )}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${(l.total / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
