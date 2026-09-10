import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import {
  CheckCircle2, MapPin, User, Lock, ArrowRight, ShieldCheck,
  MessageCircle, BadgeCheck, Check,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import {
  useProximoMovimento,
  useMarcarAvisoEnviado,
  useAprovarOrcamento,
  type AvisoPendente,
  type AprovacaoPendente,
} from "../lib/dados";
import { DEMO } from "../lib/env";
import { Carregando } from "../components/ui";
import { formatarData, rotuloPrazo, linkWhatsapp } from "../lib/format";

// [E3 / RF14a-i] Um movimento. Sem grupos, sem contadores, sem badges numéricos.

export default function Painel() {
  const navigate = useNavigate();
  const dados = useProximoMovimento();

  if (dados === undefined) return <Carregando />;

  const { item, proximos, bloqueados, avisos, aprovacoes } = dados;

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

      {/* [E1] O envio é manual, o lembrete não. Só sai quando marcado enviado. */}
      {avisos.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-1.5 text-label uppercase text-text-2">
            <MessageCircle className="h-3.5 w-3.5" />
            Avisar o solicitante
          </h2>
          <div className="mt-2 space-y-2">
            {avisos.map((a) => (
              <AvisoPendenteCard key={a._id} aviso={a} />
            ))}
          </div>
        </section>
      )}

      {/* [E2] Orçamento recebido espera decisão da liderança. */}
      {aprovacoes.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-1.5 text-label uppercase text-text-2">
            <BadgeCheck className="h-3.5 w-3.5" />
            Orçamentos para aprovar
          </h2>
          <div className="mt-2 space-y-2">
            {aprovacoes.map((a) => (
              <AprovacaoCard key={a._id} aprovacao={a} />
            ))}
          </div>
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
                className="card card-hover w-full px-4 py-3 text-left hover:bg-surface-raise"
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

// [E1] A mensagem já vem montada; o botão abre o WhatsApp. O aviso só sai do
// painel quando alguém confirma que enviou — senão o retorno ao solicitante
// volta a depender de memória, que foi a ressalva da auditoria.
function AvisoPendenteCard({ aviso }: { aviso: AvisoPendente }) {
  const marcar = useMarcarAvisoEnviado();
  const [erro, setErro] = useState<string | null>(null);
  const link = linkWhatsapp(aviso.whatsapp, aviso.mensagem);

  return (
    <div className="card px-4 py-3">
      <p className="text-sm font-medium">{aviso.demandaTitulo}</p>
      <p className="mt-1 rounded bg-surface-raise px-3 py-2 text-xs text-text-2">
        {aviso.mensagem}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a className="btn-primary" href={link} target="_blank" rel="noreferrer">
          <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
        </a>
        <button
          className="btn-ghost"
          onClick={async () => {
            try {
              await marcar({ avisoId: aviso._id });
            } catch (e) {
              setErro(e instanceof Error ? e.message : "Erro.");
            }
          }}
        >
          <Check className="h-4 w-4" /> Já enviei
        </button>
      </div>
      {erro && <p className="mt-2 text-xs text-pri-alta">{erro}</p>}
    </div>
  );
}

// [E2] Sem alçada por valor: todo orçamento recebido passa pela liderança.
function AprovacaoCard({ aprovacao }: { aprovacao: AprovacaoPendente }) {
  const aprovar = useAprovarOrcamento();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <button
          className="truncate text-sm font-medium hover:text-accent"
          onClick={() => navigate(`/demanda/${aprovacao._id}`)}
        >
          {aprovacao.titulo}
        </button>
        <p className="mt-0.5 text-xs text-text-2">
          {aprovacao.fornecedor} ·{" "}
          <span className="font-mono tnum font-semibold text-text-1">
            {aprovacao.valorRecebido.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </span>
        </p>
        {erro && <p className="mt-1 text-xs text-pri-alta">{erro}</p>}
      </div>
      <button
        className="btn-primary"
        onClick={async () => {
          try {
            await aprovar({ demandaId: aprovacao._id });
          } catch (e) {
            setErro(e instanceof Error ? e.message : "Erro.");
          }
        }}
      >
        Aprovar
      </button>
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
