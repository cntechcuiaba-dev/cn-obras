import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle2,
  Camera,
  MessageCircle,
  Copy,
  Target,
} from "lucide-react";
import {
  useDetalhe,
  useModelos,
  useMudarStatus,
  useAnexarFoto,
  useGerarUrl,
} from "../lib/dados";
import { DEMO } from "../lib/env";
import { Carregando, StatusChip, PrazoBadge, PrioridadeChip } from "../components/ui";
import { MOTIVO_IMPEDIMENTO, MotivoImpedimento } from "../lib/labels";
import { formatarData, formatarDataHora, linkWhatsapp, preencherModelo } from "../lib/format";

export default function DetalheDemanda() {
  const { id } = useParams();
  const navigate = useNavigate();
  const agora = Date.now();
  const dados = useDetalhe(id);
  const modelos = useModelos();

  const mudarStatus = useMudarStatus();
  const anexarFoto = useAnexarFoto();
  const gerarUrl = useGerarUrl();

  const [motivo, setMotivo] = useState<MotivoImpedimento>("aguardando_material");
  const [mostrarPausa, setMostrarPausa] = useState(false);
  const [mostrarConclusao, setMostrarConclusao] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (dados === undefined) return <Carregando />;
  if (dados === null)
    return (
      <p className="mx-auto max-w-3xl text-text-2">Demanda não encontrada.</p>
    );

  const d = dados.demanda;
  const podeAgir = dados.podeExecutar || dados.papel === "lideranca";

  async function acao(fn: () => Promise<unknown>) {
    setErro(null);
    try {
      await fn();
      setMostrarPausa(false);
      setMostrarConclusao(false);
      setConfirmado(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro.");
    }
  }

  async function enviarFoto(file: File, etiqueta: string) {
    if (DEMO) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await anexarFoto({ demandaId: d._id, etiqueta } as any);
      return;
    }
    const url = await gerarUrl();
    const res = await fetch(url as string, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const { storageId } = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await anexarFoto({ demandaId: d._id as any, storageId, etiqueta });
  }

  const modeloDoStatus = (modelos ?? []).find((m) => m.tipo === d.status);
  const linkZap = modeloDoStatus
    ? linkWhatsapp(
        d.solicitanteWhatsapp ?? "",
        preencherModelo(modeloDoStatus.texto, {
          demanda: d.titulo,
          prazo: d.prazo ? formatarData(d.prazo) : "a definir",
          local: d.localNome ?? d.localTextoOriginal ?? "",
          solicitante: d.solicitanteNome ?? "",
        }),
      )
    : null;

  return (
    <div className="mx-auto max-w-3xl">
      <button
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{d.titulo}</h1>
            <p className="mt-1 text-text-2">{d.descricao}</p>
          </div>
          <PrazoBadge prazo={d.prazo} agora={agora} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusChip status={d.status} />
          <PrioridadeChip prioridade={d.prioridade} />
          {d.categoriaNome && <Meta>{d.categoriaNome}</Meta>}
          {(d.localNome || d.localTextoOriginal) && (
            <Meta>{d.localNome ?? d.localTextoOriginal}</Meta>
          )}
          {d.executorNome && <Meta>Executor: {d.executorNome}</Meta>}
        </div>

        {d.resultadoEsperado && (
          <div className="mt-4 flex items-start gap-2 rounded bg-surface-raise p-3 text-sm">
            <Target className="mt-0.5 h-4 w-4 flex-none text-accent" />
            <div>
              <span className="font-semibold">Resultado esperado: </span>
              {d.resultadoEsperado}
            </div>
          </div>
        )}

        {d.status === "aguardando" && d.motivoImpedimento && (
          <p className="mt-3 rounded bg-st-aguardando-bg px-3 py-2 text-sm text-st-aguardando">
            Impedimento: {MOTIVO_IMPEDIMENTO[d.motivoImpedimento]}
            {d.impedimentoDesde && ` · desde ${formatarData(d.impedimentoDesde)}`}
          </p>
        )}

        {erro && (
          <p className="mt-3 rounded bg-pri-alta-bg px-3 py-2 text-sm text-pri-alta">
            {erro}
          </p>
        )}

        {/* Ações de execução */}
        {podeAgir && d.status !== "concluida" && d.status !== "cancelada" && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
            {(d.status === "triada" || d.status === "aguardando") && (
              <button
                className="btn-primary"
                onClick={() =>
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  acao(() => mudarStatus({ demandaId: d._id as any, novoStatus: "em_execucao" }))
                }
              >
                <Play className="h-4 w-4" /> Iniciar
              </button>
            )}
            {d.status === "em_execucao" && (
              <button className="btn-ghost" onClick={() => setMostrarPausa((v) => !v)}>
                <Pause className="h-4 w-4" /> Pausar (impedimento)
              </button>
            )}
            {(d.status === "em_execucao" || d.status === "aguardando") && (
              <button
                className="btn-ghost"
                onClick={() => setMostrarConclusao((v) => !v)}
              >
                <CheckCircle2 className="h-4 w-4" /> Concluir
              </button>
            )}
            <label className="btn-ghost cursor-pointer">
              <Camera className="h-4 w-4" /> Foto
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void acao(() => enviarFoto(f, d.status === "concluida" ? "Depois" : "Antes"));
                }}
              />
            </label>
          </div>
        )}

        {/* Painel pausa: motivo obrigatório */}
        {mostrarPausa && (
          <div className="mt-4 rounded border border-border p-4">
            <span className="label">Motivo do impedimento</span>
            <select
              className="input"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as MotivoImpedimento)}
            >
              {Object.entries(MOTIVO_IMPEDIMENTO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button
              className="btn-primary mt-3"
              onClick={() =>
                acao(() =>
                  mudarStatus({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    demandaId: d._id as any,
                    novoStatus: "aguardando",
                    motivoImpedimento: motivo,
                  }),
                )
              }
            >
              Registrar impedimento
            </button>
          </div>
        )}

        {/* Painel conclusão: confirmar resultado */}
        {mostrarConclusao && (
          <div className="mt-4 rounded border border-border p-4">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
              />
              <span>
                Confirmo que o resultado esperado foi atingido
                {d.resultadoEsperado ? `: "${d.resultadoEsperado}"` : "."}
              </span>
            </label>
            <button
              className="btn-primary mt-3"
              disabled={!confirmado}
              onClick={() =>
                acao(() =>
                  mudarStatus({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    demandaId: d._id as any,
                    novoStatus: "concluida",
                    resultadoConfirmado: true,
                  }),
                )
              }
            >
              Concluir demanda
            </button>
          </div>
        )}

        {/* WhatsApp manual (RF22) */}
        {linkZap && d.solicitanteWhatsapp && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
            <a className="btn-primary" href={linkZap} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> Avisar solicitante (WhatsApp)
            </a>
            <button
              className="btn-ghost"
              onClick={() => navigator.clipboard.writeText(linkZap)}
            >
              <Copy className="h-4 w-4" /> Copiar link
            </button>
          </div>
        )}
      </div>

      {/* Fotos */}
      {dados.fotos.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 font-semibold">Fotos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {dados.fotos.map((f) => (
              <a key={f.id} href={f.url ?? "#"} target="_blank" rel="noreferrer">
                <img
                  src={f.url ?? ""}
                  alt="Foto da demanda"
                  className="aspect-square w-full rounded-lg border border-border object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Linha do tempo (RF25) */}
      <div className="mt-6">
        <h2 className="mb-3 font-semibold">Histórico</h2>
        <ol className="relative space-y-4 border-l border-border pl-5">
          {dados.historico.map((h) => (
            <li key={h._id} className="relative">
              <span className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full bg-accent" />
              <p className="text-sm">{h.descricao}</p>
              <p className="text-xs text-text-2">
                {formatarDataHora(h._creationTime)}
                {!h.criadoPorClerkId && " · sistema"}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-bg px-2.5 py-1 text-xs text-text-2">{children}</span>
  );
}
