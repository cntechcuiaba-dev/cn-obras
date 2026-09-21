import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Inbox, MapPin, User } from "lucide-react";
import {
  useAbertas,
  useCategorias,
  useLocais,
  useExecutores,
  useEquipamentos,
  useTriar,
  useCancelar,
} from "../lib/dados";
import { CabecalhoSecao, Carregando, EstadoVazio } from "../components/ui";
import { formatarData } from "../lib/format";
import { Prioridade } from "../lib/labels";
import { mensagemErro } from "../lib/erros";

const DIAS_POR_PRIORIDADE: Record<Prioridade, number> = { alta: 2, media: 7, baixa: 21 };

function prazoSugerido(prioridade: Prioridade): string {
  const d = new Date();
  d.setDate(d.getDate() + DIAS_POR_PRIORIDADE[prioridade]);
  return d.toISOString().slice(0, 10);
}

export default function Triagem() {
  const abertas = useAbertas();
  // Vindo do painel ("Triar agora"), a demanda já chega escolhida.
  const [params] = useSearchParams();
  const [selecionada, setSelecionada] = useState<string | null>(
    params.get("demanda"),
  );

  return (
    <div>
      <CabecalhoSecao
        supra="Liderança"
        titulo="Triagem"
        descricao="Demandas aguardando categoria, prazo e executor."
      />
      {abertas === undefined ? (
        <Carregando />
      ) : abertas.length === 0 ? (
        <EstadoVazio icone={<Inbox className="h-6 w-6" />}>
          Nenhuma demanda aguardando triagem
        </EstadoVazio>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            {abertas.map((d) => (
              <button
                key={d._id}
                onClick={() => setSelecionada(d._id)}
                className={`card card-hover w-full px-4 py-3 text-left hover:bg-surface-raise ${
                  selecionada === d._id ? "ring-2 ring-accent" : ""
                }`}
              >
                <p className="font-semibold">{d.titulo}</p>
                <p className="mt-1 line-clamp-2 text-sm text-text-2">{d.descricao}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-2">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {d.localTextoOriginal}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {d.solicitanteNome}
                  </span>
                  <span>
                    aberta em {formatarData(d._creationTime)}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div>
            {selecionada ? (
              <FormularioTriagem
                key={selecionada}
                demandaId={selecionada}
                // O solicitante já pode ter escolhido o local no formulário
                // público — a triagem começa com ele preenchido, mas continua
                // sendo quem confirma (RF06).
                localSugeridoId={abertas.find((d) => d._id === selecionada)?.localId}
                resumo={abertas.find((d) => d._id === selecionada)}
                onPronto={() => setSelecionada(null)}
              />
            ) : (
              <EstadoVazio>Selecione uma demanda para triar</EstadoVazio>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FormularioTriagem({
  demandaId,
  localSugeridoId,
  resumo,
  onPronto,
}: {
  demandaId: string;
  localSugeridoId?: string;
  resumo?: { titulo: string; solicitanteNome?: string; localTextoOriginal?: string };
  onPronto: () => void;
}) {
  const categorias = useCategorias();
  const locais = useLocais();
  const executores = useExecutores();
  const equipamentos = useEquipamentos();
  const triar = useTriar();
  const cancelar = useCancelar();

  const [categoriaId, setCategoriaId] = useState("");
  const [localId, setLocalId] = useState(localSugeridoId ?? "");
  const [equipamentoId, setEquipamentoId] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  // Prazo em branco fazia a liderança inventar data a cada triagem; a
  // prioridade já diz a urgência, então ela propõe o prazo (e continua editável).
  const [prazo, setPrazo] = useState(() => prazoSugerido("media"));
  const [prazoTocado, setPrazoTocado] = useState(false);
  const [responsavelId, setResponsavelId] = useState("");
  const [equipeIds, setEquipeIds] = useState<string[]>([]);
  const [resultadoEsperado, setResultadoEsperado] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [motivoCancelar, setMotivoCancelar] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Em tela estreita o formulário fica abaixo da lista inteira: ao escolher
  // uma demanda, leva o olhar até ele em vez de deixar quem toca sem resposta.
  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await triar({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        demandaId: demandaId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoriaId: categoriaId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        localId: localId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        equipamentoId: (equipamentoId || undefined) as any,
        prioridade,
        prazo: new Date(`${prazo}T23:59:59`).getTime(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responsavelId: responsavelId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        equipeIds: (equipeIds.length ? equipeIds : undefined) as any,
        resultadoEsperado,
      });
      onPronto();
    } catch (err) {
      setErro(mensagemErro(err, "Erro ao triar."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={salvar} className="card scroll-mt-20 space-y-4 p-5">
      {/* A triagem descreve uma demanda que, no celular, ficou lá em cima na
          lista: sem isto a liderança classifica de memória. */}
      {resumo && (
        <div className="-mx-5 -mt-5 rounded-t-xl border-b border-border bg-surface-raise px-5 py-3">
          <p className="font-semibold leading-snug">{resumo.titulo}</p>
          <p className="mt-0.5 text-xs text-text-2">
            {[resumo.solicitanteNome, resumo.localTextoOriginal].filter(Boolean).join(" · ")}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Categoria</span>
          <select
            className="input"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            required
          >
            <option value="">Selecione</option>
            {(categorias ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Local</span>
          <select
            className="input"
            value={localId}
            onChange={(e) => setLocalId(e.target.value)}
            required
          >
            <option value="">Selecione</option>
            {(locais ?? []).map((l) => (
              <option key={l._id} value={l._id}>
                {l.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Equipamento (opcional)</span>
          <select
            className="input"
            value={equipamentoId}
            onChange={(e) => setEquipamentoId(e.target.value)}
          >
            <option value="">Nenhum</option>
            {(equipamentos ?? []).map((eq) => (
              <option key={eq._id} value={eq._id}>
                {eq.nome} — {eq.localNome}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-text-2">
            Se a demanda é sobre um equipamento cadastrado, marcar aqui alimenta o
            Aprendizado com o histórico dele.
          </span>
        </label>
        <label className="block">
          <span className="label">Prioridade</span>
          <select
            className="input"
            value={prioridade}
            onChange={(e) => {
              const nova = e.target.value as Prioridade;
              setPrioridade(nova);
              if (!prazoTocado) setPrazo(prazoSugerido(nova));
            }}
          >
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Prazo</span>
          <input
            type="date"
            className="input"
            value={prazo}
            onChange={(e) => {
              setPrazo(e.target.value);
              setPrazoTocado(true);
            }}
            required
          />
          <span className="mt-1 block text-xs text-text-2">
            Sugerido pela prioridade — ajuste se precisar.
          </span>
        </label>
      </div>

      <label className="block">
        <span className="label">Responsável</span>
        <select
          className="input"
          value={responsavelId}
          onChange={(e) => setResponsavelId(e.target.value)}
          required
        >
          <option value="">Selecione</option>
          {(executores ?? []).map((u) => (
            <option key={u._id} value={u._id}>
              {u.nome}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-text-2">
          Dono único do próximo movimento — é no painel dele que a demanda aparece.
        </span>
      </label>

      {/* [E4] equipe executa junto, mas não recebe o movimento */}
      <div>
        <span className="label">Equipe (opcional)</span>
        <div className="flex flex-wrap gap-2">
          {(executores ?? [])
            .filter((u) => u._id !== responsavelId)
            .map((u) => {
              const marcado = equipeIds.includes(u._id);
              return (
                <button
                  key={u._id}
                  type="button"
                  onClick={() =>
                    setEquipeIds((atual) =>
                      marcado
                        ? atual.filter((id) => id !== u._id)
                        : [...atual, u._id],
                    )
                  }
                  className={`alvo-toque rounded-full border px-3 py-1 text-xs font-medium transition ${
                    marcado
                      ? "border-accent bg-accent-subtle text-accent-active"
                      : "border-border text-text-2 hover:border-border-strong"
                  }`}
                >
                  {u.nome}
                </button>
              );
            })}
        </div>
        <span className="mt-1 block text-xs text-text-2">
          Executam junto e têm acesso, mas o movimento continua com o responsável.
        </span>
      </div>

      <label className="block">
        <span className="label">Resultado esperado</span>
        <input
          className="input"
          placeholder="O que caracteriza a demanda como resolvida?"
          value={resultadoEsperado}
          onChange={(e) => setResultadoEsperado(e.target.value)}
          required
        />
        <span className="mt-1 block text-xs text-text-2">
          Lido na conclusão — o executor precisa confirmar que este resultado foi atingido.
        </span>
      </label>

      {erro && (
        <p className="rounded bg-pri-alta-bg px-3 py-2 text-sm text-pri-alta">{erro}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={salvando}>
          {salvando ? "Salvando…" : "Concluir triagem"}
        </button>
        <button
          type="button"
          className="btn-danger"
          aria-expanded={confirmandoCancelar}
          onClick={() => setConfirmandoCancelar((v) => !v)}
        >
          Cancelar demanda
        </button>
      </div>

      {/* Cancelar some com a demanda da fila: pede o motivo, que fica no histórico. */}
      {confirmandoCancelar && (
        <div className="space-y-3 rounded-lg border border-pri-alta/30 bg-pri-alta-bg/40 p-4">
          <label className="block">
            <span className="label">Motivo do cancelamento</span>
            <input
              className="input"
              value={motivoCancelar}
              onChange={(e) => setMotivoCancelar(e.target.value)}
              placeholder="Ex: pedido duplicado, já resolvido"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn bg-pri-alta text-white hover:opacity-90"
              disabled={!motivoCancelar.trim() || salvando}
              onClick={async () => {
                setErro(null);
                setSalvando(true);
                try {
                  await cancelar({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    demandaId: demandaId as any,
                    motivo: motivoCancelar.trim(),
                  });
                  onPronto();
                } catch (err) {
                  setErro(mensagemErro(err, "Não foi possível cancelar. Tente de novo."));
                } finally {
                  setSalvando(false);
                }
              }}
            >
              Confirmar cancelamento
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirmandoCancelar(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
