import { FormEvent, useState } from "react";
import {
  Settings,
  Plus,
  Power,
  Pencil,
  ShieldCheck,
  Check,
  X as XIcon,
  Wrench,
} from "lucide-react";
import {
  useCategoriasAdmin,
  useLocaisAdmin,
  useUsuariosAdmin,
  useModelos,
  useLocais,
  useEquipamentosAdmin,
  useCriarCategoria,
  useAlternarCategoria,
  useCriarLocalAdmin,
  useAlternarLocalAdmin,
  useAtualizarModelo,
  usePromoverUsuario,
  useAlternarAtivoUsuario,
  useCriarEquipamento,
  useAtualizarEquipamento,
  useAlternarAtivoEquipamento,
  type CadastroAdmin,
  type UsuarioAdmin,
  type EquipamentoAdmin,
} from "../lib/dados";
import { CabecalhoSecao, Carregando, EstadoVazio } from "../components/ui";
import { formatarData } from "../lib/format";

// RF26/RF27/RF21: cadastro/ativação de categorias, locais e equipamentos, edição
// dos modelos de mensagem e promoção/desativação de usuários. Tudo que antes só
// existia via seed.

type Aba = "categorias" | "locais" | "equipamentos" | "modelos" | "usuarios";

export default function Administracao() {
  const [aba, setAba] = useState<Aba>("categorias");

  return (
    <div>
      <CabecalhoSecao
        supra="Liderança"
        titulo="Administração"
        descricao="Categorias, locais, equipamentos, modelos de mensagem e usuários."
      />

      <div className="mb-6 flex gap-1 border-b border-border">
        {(
          [
            ["categorias", "Categorias"],
            ["locais", "Locais"],
            ["equipamentos", "Equipamentos"],
            ["modelos", "Modelos de mensagem"],
            ["usuarios", "Usuários"],
          ] as [Aba, string][]
        ).map(([k, rotulo]) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              aba === k
                ? "border-accent text-accent-active"
                : "border-transparent text-text-2 hover:text-text-1"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === "categorias" && <AbaCategorias />}
      {aba === "locais" && <AbaLocais />}
      {aba === "equipamentos" && <AbaEquipamentos />}
      {aba === "modelos" && <AbaModelos />}
      {aba === "usuarios" && <AbaUsuarios />}
    </div>
  );
}

// ---------------- Categorias ----------------

function AbaCategorias() {
  const categorias = useCategoriasAdmin();
  const criar = useCriarCategoria();
  const alternar = useAlternarCategoria();
  return (
    <ListaComCadastro
      itens={categorias}
      campoAtivo="ativa"
      rotulos={{ ativo: "Ativa", inativo: "Inativa" }}
      icone={<Settings className="h-6 w-6" />}
      vazio="Nenhuma categoria cadastrada"
      placeholder="Nome da categoria (ex: Elétrica)"
      onCriar={(nome) => criar({ nome })}
      onAlternar={(id, ativa) => alternar({ categoriaId: id, ativa })}
    />
  );
}

// ---------------- Locais ----------------

function AbaLocais() {
  const locais = useLocaisAdmin();
  const criar = useCriarLocalAdmin();
  const alternar = useAlternarLocalAdmin();
  return (
    <ListaComCadastro
      itens={locais}
      campoAtivo="ativo"
      rotulos={{ ativo: "Ativo", inativo: "Inativo" }}
      icone={<Settings className="h-6 w-6" />}
      vazio="Nenhum local cadastrado"
      placeholder="Nome do local (ex: Templo principal)"
      onCriar={(nome) => criar({ nome })}
      onAlternar={(id, ativo) => alternar({ localId: id, ativo })}
    />
  );
}

// Categorias e locais têm exatamente a mesma forma (nome + flag de ativo/ativa) —
// uma lista genérica evita duas cópias quase idênticas do mesmo componente.
function ListaComCadastro({
  itens,
  campoAtivo,
  rotulos,
  icone,
  vazio,
  placeholder,
  onCriar,
  onAlternar,
}: {
  itens: CadastroAdmin[] | undefined;
  campoAtivo: "ativa" | "ativo";
  rotulos: { ativo: string; inativo: string };
  icone: React.ReactNode;
  vazio: string;
  placeholder: string;
  onCriar: (nome: string) => Promise<unknown>;
  onAlternar: (id: string, novoValor: boolean) => Promise<unknown>;
}) {
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await onCriar(nome);
      setNome("");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <form onSubmit={salvar} className="mb-4 flex gap-2">
        <input
          className="input"
          placeholder={placeholder}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary flex-none" disabled={salvando}>
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </form>
      {erro && (
        <p className="mb-4 rounded bg-pri-alta-bg px-3 py-2 text-sm text-pri-alta">{erro}</p>
      )}

      {itens === undefined ? (
        <Carregando />
      ) : itens.length === 0 ? (
        <EstadoVazio icone={icone}>{vazio}</EstadoVazio>
      ) : (
        <div className="space-y-2">
          {itens.map((item) => {
            const ativo = Boolean(item[campoAtivo]);
            return (
              <div
                key={item._id}
                className="card flex items-center justify-between px-4 py-3"
              >
                <span className={`text-sm ${ativo ? "" : "text-text-2 line-through"}`}>
                  {item.nome}
                </span>
                <button
                  className={`btn-ghost ${ativo ? "" : "opacity-60"}`}
                  onClick={() => onAlternar(item._id, !ativo)}
                >
                  <Power className="h-4 w-4" />
                  {ativo ? rotulos.ativo : rotulos.inativo}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------- Equipamentos ----------------
// Diferente de categoria/local (nome + flag), equipamento tem campos próprios
// (tipo, local, patrimônio, data de instalação) — não cabe no ListaComCadastro
// genérico, tem componente dedicado.

function AbaEquipamentos() {
  const equipamentos = useEquipamentosAdmin();
  const alternar = useAlternarAtivoEquipamento();
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-text-2">
          Ar-condicionados, bebedouros e outros equipamentos com manutenção periódica.
        </p>
        {!criando && (
          <button className="btn-primary flex-none" onClick={() => setCriando(true)}>
            <Plus className="h-4 w-4" /> Novo equipamento
          </button>
        )}
      </div>

      {criando && (
        <FormularioEquipamento onPronto={() => setCriando(false)} onErro={setErro} />
      )}
      {erro && !criando && (
        <p className="mb-4 rounded bg-pri-alta-bg px-3 py-2 text-sm text-pri-alta">{erro}</p>
      )}

      {equipamentos === undefined ? (
        <Carregando />
      ) : equipamentos.length === 0 ? (
        <EstadoVazio icone={<Wrench className="h-6 w-6" />}>
          Nenhum equipamento cadastrado
        </EstadoVazio>
      ) : (
        <div className="space-y-2">
          {equipamentos.map((eq) =>
            editandoId === eq._id ? (
              <FormularioEquipamento
                key={eq._id}
                equipamento={eq}
                onPronto={() => setEditandoId(null)}
                onErro={setErro}
              />
            ) : (
              <div
                key={eq._id}
                className={`card flex flex-wrap items-center gap-3 px-4 py-3 ${
                  eq.ativo ? "" : "opacity-60"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{eq.nome}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-2">
                    <span>{eq.tipo}</span>
                    {eq.localNome && <span>{eq.localNome}</span>}
                    {eq.patrimonio && <span>patrimônio {eq.patrimonio}</span>}
                    {eq.instaladoEm && (
                      <span>instalado em {formatarData(eq.instaladoEm)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-none gap-2">
                  <button className="btn-ghost" onClick={() => setEditandoId(eq._id)}>
                    <Pencil className="h-4 w-4" /> Editar
                  </button>
                  <button
                    className={`btn-ghost ${eq.ativo ? "" : "opacity-60"}`}
                    onClick={() => alternar({ equipamentoId: eq._id, ativo: !eq.ativo })}
                  >
                    <Power className="h-4 w-4" />
                    {eq.ativo ? "Ativo" : "Inativo"}
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function FormularioEquipamento({
  equipamento,
  onPronto,
  onErro,
}: {
  equipamento?: EquipamentoAdmin;
  onPronto: () => void;
  onErro: (m: string | null) => void;
}) {
  const locais = useLocais();
  const criar = useCriarEquipamento();
  const atualizar = useAtualizarEquipamento();

  const [nome, setNome] = useState(equipamento?.nome ?? "");
  const [tipo, setTipo] = useState(equipamento?.tipo ?? "");
  const [localId, setLocalId] = useState(equipamento?.localId ?? "");
  const [patrimonio, setPatrimonio] = useState(equipamento?.patrimonio ?? "");
  const [instaladoEm, setInstaladoEm] = useState(
    equipamento?.instaladoEm
      ? new Date(equipamento.instaladoEm).toISOString().slice(0, 10)
      : "",
  );
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    onErro(null);
    setSalvando(true);
    try {
      const campos = {
        nome,
        tipo,
        localId,
        patrimonio: patrimonio || undefined,
        instaladoEm: instaladoEm ? new Date(`${instaladoEm}T12:00:00`).getTime() : undefined,
      };
      if (equipamento) {
        await atualizar({ equipamentoId: equipamento._id, ...campos });
      } else {
        await criar(campos);
      }
      onPronto();
    } catch (err) {
      onErro(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="card mb-4 space-y-4 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Nome</span>
          <input
            className="input"
            placeholder="Ex: Ar-condicionado — Secretaria"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="label">Tipo</span>
          <input
            className="input"
            placeholder="Ex: Ar-condicionado, Bebedouro"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            required
          />
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
        <label className="block">
          <span className="label">Patrimônio / série (opcional)</span>
          <input
            className="input"
            value={patrimonio}
            onChange={(e) => setPatrimonio(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Instalado em (opcional)</span>
          <input
            type="date"
            className="input"
            value={instaladoEm}
            onChange={(e) => setInstaladoEm(e.target.value)}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={salvando}>
          {salvando ? "Salvando…" : equipamento ? "Salvar alterações" : "Cadastrar"}
        </button>
        <button type="button" className="btn-ghost" onClick={onPronto}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ---------------- Modelos de mensagem ----------------

const TIPO_ROTULO: Record<string, string> = {
  em_execucao: "Em execução",
  aguardando: "Aguardando",
  concluida: "Concluída",
};

function AbaModelos() {
  const modelos = useModelos();
  const atualizar = useAtualizarModelo();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  if (modelos === undefined) return <Carregando />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-2">
        Placeholders disponíveis: <code>{"{{demanda}}"}</code> <code>{"{{local}}"}</code>{" "}
        <code>{"{{prazo}}"}</code> <code>{"{{solicitante}}"}</code>
      </p>
      {modelos.map((m) => (
        <div key={m._id} className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-label uppercase text-accent">
              {TIPO_ROTULO[m.tipo] ?? m.tipo}
            </span>
            {editandoId !== m._id && (
              <button
                className="btn-ghost"
                onClick={() => {
                  setEditandoId(m._id);
                  setTexto(m.texto);
                  setErro(null);
                }}
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
            )}
          </div>
          {editandoId === m._id ? (
            <div className="mt-2">
              <textarea
                className="input min-h-[80px]"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              {erro && <p className="mt-1 text-xs text-pri-alta">{erro}</p>}
              <div className="mt-2 flex gap-2">
                <button
                  className="btn-primary"
                  onClick={async () => {
                    try {
                      await atualizar({ modeloId: m._id, texto });
                      setEditandoId(null);
                    } catch (err) {
                      setErro(err instanceof Error ? err.message : "Erro.");
                    }
                  }}
                >
                  <Check className="h-4 w-4" /> Salvar
                </button>
                <button className="btn-ghost" onClick={() => setEditandoId(null)}>
                  <XIcon className="h-4 w-4" /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-text-2">{m.texto}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------- Usuários ----------------

function AbaUsuarios() {
  const usuarios = useUsuariosAdmin();
  const promover = usePromoverUsuario();
  const alternarAtivo = useAlternarAtivoUsuario();
  const [erro, setErro] = useState<string | null>(null);

  if (usuarios === undefined) return <Carregando />;
  if (usuarios.length === 0) {
    return (
      <EstadoVazio icone={<ShieldCheck className="h-6 w-6" />}>
        Nenhum usuário cadastrado ainda
      </EstadoVazio>
    );
  }

  return (
    <div>
      {erro && (
        <p className="mb-4 rounded bg-pri-alta-bg px-3 py-2 text-sm text-pri-alta">{erro}</p>
      )}
      <div className="space-y-2">
        {usuarios.map((u: UsuarioAdmin) => (
          <div
            key={u._id}
            className={`card flex flex-wrap items-center gap-3 px-4 py-3 ${
              u.ativo ? "" : "opacity-60"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{u.nome}</p>
              <p className="text-xs text-text-2">{u.email}</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                u.papel === "lideranca"
                  ? "bg-accent-subtle text-accent-active"
                  : "bg-bg text-text-2"
              }`}
            >
              {u.papel === "lideranca" ? "Liderança" : "Executor"}
            </span>
            <div className="flex flex-none gap-2">
              {u.papel === "executor" && (
                <button
                  className="btn-ghost"
                  onClick={async () => {
                    setErro(null);
                    try {
                      await promover({ usuarioId: u._id });
                    } catch (err) {
                      setErro(err instanceof Error ? err.message : "Erro.");
                    }
                  }}
                >
                  <ShieldCheck className="h-4 w-4" /> Promover
                </button>
              )}
              <button
                className="btn-ghost"
                onClick={async () => {
                  setErro(null);
                  try {
                    await alternarAtivo({ usuarioId: u._id, ativo: !u.ativo });
                  } catch (err) {
                    setErro(err instanceof Error ? err.message : "Erro.");
                  }
                }}
              >
                <Power className="h-4 w-4" />
                {u.ativo ? "Desativar" : "Ativar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
