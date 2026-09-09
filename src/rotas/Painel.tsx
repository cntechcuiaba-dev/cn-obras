import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { CheckCircle2, MapPin, User, Lock, ArrowRight, ShieldCheck } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useProximoMovimento } from "../lib/dados";
import { DEMO } from "../lib/env";
import { Carregando } from "../components/ui";
import { formatarData, rotuloPrazo } from "../lib/format";

// [E3 / RF14a-i] Um movimento. Sem grupos, sem contadores, sem badges numéricos.

export default function Painel() {
  const navigate = useNavigate();
  const dados = useProximoMovimento();

  if (dados === undefined) return <Carregando />;

  const { item, proximos, bloqueados } = dados;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-label uppercase text-accent">Seu próximo movimento</p>

      {item === null ? (
        <>
          <div className="card mt-3 flex flex-col items-center gap-3 p-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-st-concluida" />
            <p className="text-lg font-semibold">Nada esperando por você agora.</p>
            <p className="text-sm text-text-2">
              Quando algo precisar da sua ação, aparece aqui.
            </p>
          </div>
          {!DEMO && dados.papel === "executor" && <BootstrapLideranca />}
        </>
      ) : (
        <ItemPrincipal
          item={item}
          onAgir={() =>
            navigate(
              // [RF14f] a ação leva ao lugar onde ela é executável
              item.acao.destino === "triagem"
                ? `/triagem?demanda=${item._id}`
                : `/demanda/${item._id}`,
            )
          }
        />
      )}

      {/* [RF14e] no máximo três, linha simples: título e data. Sem cor, sem selo. */}
      {proximos.length > 0 && (
        <section className="mt-8">
          <h2 className="text-label uppercase text-text-2">Depois deste</h2>
          <ul className="mt-2 divide-y divide-border border-t border-border">
            {proximos.map((p) => (
              <li key={p._id}>
                <button
                  onClick={() => navigate(`/demanda/${p._id}`)}
                  className="flex w-full items-center justify-between gap-4 py-2.5 text-left text-sm hover:text-accent"
                >
                  <span className="truncate">{p.titulo}</span>
                  <span className="flex-none font-mono text-xs tnum text-text-2">
                    {p.prazo ? formatarData(p.prazo) : "sem prazo"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* [RF14b] Bloqueado sai do painel: seção separada, com quem destrava. */}
      {bloqueados.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-1.5 text-label uppercase text-text-2">
            <Lock className="h-3.5 w-3.5" />
            Travadas com outra pessoa
          </h2>
          <div className="mt-2 space-y-2">
            {bloqueados.map((b) => (
              <button
                key={b._id}
                onClick={() => navigate(`/demanda/${b._id}`)}
                className="card w-full px-4 py-3 text-left transition hover:bg-surface-raise"
              >
                <p className="truncate text-sm font-medium">{b.titulo}</p>
                <p className="mt-1 text-xs text-text-2">
                  Com <span className="font-medium text-text-1">{b.quemDestrava}</span> ·
                  volta {b.condicaoRetorno}
                  {b.impedimentoDesde &&
                    ` · parada desde ${formatarData(b.impedimentoDesde)}`}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Bootstrap: o primeiro usuário do sistema assume liderança (o servidor só permite
// enquanto não existir nenhuma).
function BootstrapLideranca() {
  const promover = useMutation(api.usuarios.promoverPrimeiroComoLideranca);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="card mt-4 flex flex-col items-start gap-2 p-4 text-sm">
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

function ItemPrincipal({
  item,
  onAgir,
}: {
  item: NonNullable<ReturnType<typeof useProximoMovimento>>["item"];
  onAgir: () => void;
}) {
  if (!item) return null;
  const prazo = rotuloPrazo(item.prazo);

  return (
    <article className="card mt-3 p-6">
      <h1 className="text-2xl font-bold leading-tight">{item.titulo}</h1>

      {/* [RF14d] por que é este — frase gerada da fórmula */}
      <p className="mt-3 border-l-2 border-accent bg-accent-subtle/50 py-2 pl-3 text-sm text-text-1">
        {item.porque}
      </p>

      <p className="mt-4 text-sm text-text-2">{item.descricao}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-2">
        {(item.localNome ?? item.localTextoOriginal) && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {item.localNome ?? item.localTextoOriginal}
          </span>
        )}
        {item.responsavelNome && (
          <span className="inline-flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {item.responsavelNome}
          </span>
        )}
        {item.categoriaNome && <span>{item.categoriaNome}</span>}
        <span
          className={`font-mono tnum ${
            prazo.tom === "vencida" ? "font-semibold text-venc-vencida" : ""
          }`}
        >
          {prazo.texto}
        </span>
      </div>

      {/* [RF14f] todo item tem ação executável */}
      <button className="btn-primary mt-6 w-full sm:w-auto" onClick={onAgir}>
        {item.acao.rotulo}
        <ArrowRight className="h-4 w-4" />
      </button>
    </article>
  );
}
