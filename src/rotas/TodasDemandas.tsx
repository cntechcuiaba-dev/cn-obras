import { useNavigate } from "react-router-dom";
import { List } from "lucide-react";
import { useTodasDemandas } from "../lib/dados";
import { CabecalhoSecao, Carregando, EstadoVazio } from "../components/ui";
import { LinhaDemanda } from "../components/LinhaDemanda";

// [RF14i] Consulta, não painel. Aberta por escolha — nunca é a tela inicial.
export default function TodasDemandas() {
  const navigate = useNavigate();
  const agora = Date.now();
  const demandas = useTodasDemandas();

  return (
    <div>
      <CabecalhoSecao
        supra="Consulta"
        titulo="Todas as demandas"
        descricao="Lista completa, ordenada pela mesma fórmula do painel."
      />

      {demandas === undefined ? (
        <Carregando />
      ) : demandas.length === 0 ? (
        <EstadoVazio icone={<List className="h-6 w-6" />}>
          Nenhuma demanda ativa
        </EstadoVazio>
      ) : (
        <div className="space-y-2.5">
          {demandas.map((d, i) => (
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
      )}
    </div>
  );
}
