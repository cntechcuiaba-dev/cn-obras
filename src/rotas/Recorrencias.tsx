import { FormEvent, useState } from "react";
import { Repeat, Plus, Power, Pencil } from "lucide-react";
import {
  useRecorrencias,
  useAlternarRecorrencia,
  useCriarRecorrencia,
  useEditarRecorrencia,
  useCategorias,
  useLocais,
  useExecutores,
  useEquipamentos,
} from "../lib/dados";
import { CabecalhoSecao, Carregando, EstadoVazio } from "../components/ui";
import { PERIODICIDADE } from "../lib/labels";
import { formatarData } from "../lib/format";
import { mensagemErro } from "../lib/erros";

export default function Recorrencias() {
  const recs = useRecorrencias();
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  return (
    <div>
      <CabecalhoSecao
        supra="Liderança"
        titulo="Recorrências"
        descricao="Manutenções periódicas geradas automaticamente pelo sistema."
        acao={
          !criando && (
            <button
              className="btn-primary"
              onClick={() => {
                setEditandoId(null);
                setCriando(true);
              }}
            >
              <Plus className="h-4 w-4" /> Nova recorrência
            </button>
          )
        }
      />

      {criando && <FormularioRecorrencia onPronto={() => setCriando(false)} />}

      {recs === undefined ? (
        <Carregando />
      ) : recs.length === 0 ? (
        <EstadoVazio icone={<Repeat className="h-6 w-6" />}>
          Nenhuma manutenção recorrente cadastrada
        </EstadoVazio>
      ) : (
        <div className="mt-4 space-y-2">
          {recs.map((r) =>
            editandoId === r._id ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <FormularioRecorrencia
                key={r._id}
                recorrencia={r}
                onPronto={() => setEditandoId(null)}
              />
            ) : (
              <ItemRecorrencia
                key={r._id}
                rec={r}
                onEditar={() => {
                  setCriando(false);
                  setEditandoId(r._id);
                }}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ItemRecorrencia({ rec, onEditar }: { rec: any; onEditar: () => void }) {
  const alternar = useAlternarRecorrencia();
  return (
    <div className="card flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{rec.titulo}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-2">
          <span>{PERIODICIDADE[rec.periodicidade]}</span>
          {rec.equipamentoNome && (
            <span className="font-medium text-text-1">{rec.equipamentoNome}</span>
          )}
          {rec.categoriaNome && <span>{rec.categoriaNome}</span>}
          {rec.localNome && <span>{rec.localNome}</span>}
          {rec.responsavelNome && <span>{rec.responsavelNome}</span>}
          {rec.ativa && rec.proximaManutencao && (
            <span>
              manutenção prevista {formatarData(rec.proximaManutencao)} · entra no
              painel {formatarData(rec.proximaGeracao)}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-none gap-2">
        <button className="btn-ghost" onClick={onEditar}>
          <Pencil className="h-4 w-4" /> Editar
        </button>
        <button
          className={`btn-ghost ${rec.ativa ? "" : "opacity-60"}`}
          onClick={() => alternar({ id: rec._id, ativa: !rec.ativa })}
          title={rec.ativa ? "Desativar" : "Ativar"}
        >
          <Power className="h-4 w-4" />
          {rec.ativa ? "Ativa" : "Inativa"}
        </button>
      </div>
    </div>
  );
}

// [RF20] Sem `recorrencia`: cria. Com `recorrencia`: edita — mudanças aqui não
// afetam demandas já geradas, só a próxima.
function FormularioRecorrencia({
  recorrencia,
  onPronto,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recorrencia?: any;
  onPronto: () => void;
}) {
  const categorias = useCategorias();
  const locais = useLocais();
  const executores = useExecutores();
  const equipamentos = useEquipamentos();
  const criar = useCriarRecorrencia();
  const editar = useEditarRecorrencia();

  const [f, setF] = useState({
    titulo: recorrencia?.titulo ?? "",
    descricao: recorrencia?.descricao ?? "",
    categoriaId: recorrencia?.categoriaId ?? "",
    localId: recorrencia?.localId ?? "",
    equipamentoId: recorrencia?.equipamentoId ?? "",
    executorPadraoId: recorrencia?.executorPadraoId ?? "",
    periodicidade: recorrencia?.periodicidade ?? "mensal",
    antecedenciaDias: String(recorrencia?.antecedenciaDias ?? 7),
  });
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      const campos = {
        titulo: f.titulo,
        descricao: f.descricao,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoriaId: f.categoriaId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        localId: f.localId as any,
        // omitido = não mexe; aqui sempre mandamos o valor atual do formulário —
        // "" vira null (desvincula) só quando já havia um equipamento antes.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        equipamentoId: (f.equipamentoId || (recorrencia?.equipamentoId ? null : undefined)) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        executorPadraoId: f.executorPadraoId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        periodicidade: f.periodicidade as any,
        antecedenciaDias: Number(f.antecedenciaDias),
      };
      if (recorrencia) {
        await editar({ id: recorrencia._id, ...campos });
      } else {
        await criar(campos);
      }
      onPronto();
    } catch (err) {
      setErro(mensagemErro(err, "Erro ao salvar."));
    }
  }

  return (
    <form onSubmit={salvar} className="card mb-4 space-y-4 p-5">
      <label className="block">
        <span className="label">Título</span>
        <input
          className="input"
          value={f.titulo}
          onChange={(e) => setF({ ...f, titulo: e.target.value })}
          required
        />
      </label>
      <label className="block">
        <span className="label">Descrição</span>
        <textarea
          className="input"
          value={f.descricao}
          onChange={(e) => setF({ ...f, descricao: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Categoria" value={f.categoriaId} onChange={(v) => setF({ ...f, categoriaId: v })} opcoes={(categorias ?? []).map((c) => ({ id: c._id, nome: c.nome }))} />
        <Select label="Local" value={f.localId} onChange={(v) => setF({ ...f, localId: v })} opcoes={(locais ?? []).map((l) => ({ id: l._id, nome: l.nome }))} />
        <Select label="Executor padrão" value={f.executorPadraoId} onChange={(v) => setF({ ...f, executorPadraoId: v })} opcoes={(executores ?? []).map((u) => ({ id: u._id, nome: u.nome }))} />
        <label className="block">
          <span className="label">Equipamento (opcional)</span>
          <select
            className="input"
            value={f.equipamentoId}
            onChange={(e) => setF({ ...f, equipamentoId: e.target.value })}
          >
            <option value="">Nenhum</option>
            {(equipamentos ?? []).map((eq) => (
              <option key={eq._id} value={eq._id}>
                {eq.nome} — {eq.localNome}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Periodicidade</span>
          <select
            className="input"
            value={f.periodicidade}
            onChange={(e) => setF({ ...f, periodicidade: e.target.value })}
          >
            {Object.entries(PERIODICIDADE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Antecedência (dias)</span>
          <input
            type="number"
            min={0}
            className="input"
            value={f.antecedenciaDias}
            onChange={(e) => setF({ ...f, antecedenciaDias: e.target.value })}
            required
          />
          <span className="mt-1 block text-xs text-text-2">
            Quantos dias antes do vencimento a demanda é gerada, para dar tempo de
            programação.
          </span>
        </label>
      </div>
      {erro && (
        <p className="rounded bg-pri-alta-bg px-3 py-2 text-sm text-pri-alta">{erro}</p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">
          {recorrencia ? "Salvar alterações" : "Salvar recorrência"}
        </button>
        <button type="button" className="btn-ghost" onClick={onPronto}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Select({
  label,
  value,
  onChange,
  opcoes,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opcoes: { id: string; nome: string }[];
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      >
        <option value="">Selecione</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
