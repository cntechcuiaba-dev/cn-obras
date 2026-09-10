import { FormEvent, useState } from "react";
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
                  <span className="text-text-2/70">
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
  onPronto,
}: {
  demandaId: string;
  localSugeridoId?: string;
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
  const [prazo, setPrazo] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [equipeIds, setEquipeIds] = useState<string[]>([]);
  const [resultadoEsperado, setResultadoEsperado] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

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
    <form onSubmit={salvar} className="card space-y-4 p-5">
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
            onChange={(e) => setPrioridade(e.target.value as Prioridade)}
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
            onChange={(e) => setPrazo(e.target.value)}
            required
          />
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
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
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
          onClick={async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await cancelar({ demandaId: demandaId as any });
            onPronto();
          }}
        >
          Cancelar demanda
        </button>
      </div>
    </form>
  );
}
