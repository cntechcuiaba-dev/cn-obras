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
        descricao="Problemas que se repetem por local e categoria. Manutenção programada é contada à parte — senão ela infla o local e esconde o padrão."
      />

      {dados === undefined ? (
        <Carregando />
      ) : dados.totalConsiderado === 0 ? (
        <EstadoVazio icone={<LineChart className="h-6 w-6" />}>
          Ainda não há demandas suficientes para gerar aprendizado
        </EstadoVazio>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <Tabela titulo="Por local" linhas={dados.porLocal} />
          <Tabela titulo="Por categoria" linhas={dados.porCategoria} />
          {/* A maioria das demandas não é sobre um equipamento cadastrado —
              card só aparece quando há algo a mostrar, senão é ruído vazio. */}
          {dados.porEquipamento.length > 0 && (
            <Tabela titulo="Por equipamento" linhas={dados.porEquipamento} />
          )}
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
    espontaneas: number;
    recorrentes: number;
    concluidas: number;
    tempoMedioDias: number | null;
  }[];
}) {
  const max = Math.max(1, ...linhas.map((l) => l.espontaneas));
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-semibold">{titulo}</h2>
      <div className="space-y-3">
        {linhas.map((l) => (
          <div key={l.nome}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">{l.nome}</span>
              <span className="text-text-2">
                <span className="font-mono tnum">{l.espontaneas}</span> problema
                {l.espontaneas === 1 ? "" : "s"}
                {l.recorrentes > 0 && (
                  <>
                    {" · "}
                    <span className="font-mono tnum">{l.recorrentes}</span> manutenção
                    {l.recorrentes === 1 ? "" : "s"} programada
                    {l.recorrentes === 1 ? "" : "s"}
                  </>
                )}
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
                style={{ width: `${(l.espontaneas / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
