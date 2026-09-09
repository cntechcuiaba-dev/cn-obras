import { FormEvent, useState } from "react";
import { Repeat, Plus, Power } from "lucide-react";
import {
  useRecorrencias,
  useAlternarRecorrencia,
  useCriarRecorrencia,
  useCategorias,
  useLocais,
  useExecutores,
  useEquipamentos,
} from "../lib/dados";
import { CabecalhoSecao, Carregando, EstadoVazio } from "../components/ui";
import { PERIODICIDADE } from "../lib/labels";
import { formatarData } from "../lib/format";

export default function Recorrencias() {
  const recs = useRecorrencias();
  const [criando, setCriando] = useState(false);

  return (
    <div>
      <CabecalhoSecao
        supra="Liderança"
        titulo="Recorrências"
        descricao="Manutenções periódicas geradas automaticamente pelo sistema."
        acao={
          <button className="btn-primary" onClick={() => setCriando((v) => !v)}>
            <Plus className="h-4 w-4" /> Nova recorrência
          </button>
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
          {recs.map((r) => (
            <ItemRecorrencia key={r._id} rec={r} />
          ))}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ItemRecorrencia({ rec }: { rec: any }) {
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
      <button
        className={`btn-ghost ${rec.ativa ? "" : "opacity-60"}`}
        onClick={() => alternar({ id: rec._id, ativa: !rec.ativa })}
        title={rec.ativa ? "Desativar" : "Ativar"}
      >
        <Power className="h-4 w-4" />
        {rec.ativa ? "Ativa" : "Inativa"}
      </button>
    </div>
  );
}

function FormularioRecorrencia({ onPronto }: { onPronto: () => void }) {
  const categorias = useCategorias();
  const locais = useLocais();
  const executores = useExecutores();
  const equipamentos = useEquipamentos();
  const criar = useCriarRecorrencia();

  const [f, setF] = useState({
    titulo: "",
    descricao: "",
    categoriaId: "",
    localId: "",
    equipamentoId: "",
    executorPadraoId: "",
    periodicidade: "mensal",
    antecedenciaDias: "7",
  });
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      await criar({
        titulo: f.titulo,
        descricao: f.descricao,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoriaId: f.categoriaId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        localId: f.localId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        equipamentoId: (f.equipamentoId || undefined) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        executorPadraoId: f.executorPadraoId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        periodicidade: f.periodicidade as any,
        antecedenciaDias: Number(f.antecedenciaDias),
      });
      onPronto();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar.");
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
          Salvar recorrência
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
