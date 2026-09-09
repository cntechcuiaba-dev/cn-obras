import { FormEvent, useState } from "react";
import {
  Settings,
  Plus,
  Power,
  Pencil,
  ShieldCheck,
  Check,
  X as XIcon,
} from "lucide-react";
import {
  useCategoriasAdmin,
  useLocaisAdmin,
  useUsuariosAdmin,
  useModelos,
  useCriarCategoria,
  useAlternarCategoria,
  useCriarLocalAdmin,
  useAlternarLocalAdmin,
  useAtualizarModelo,
  usePromoverUsuario,
  useAlternarAtivoUsuario,
  type CadastroAdmin,
  type UsuarioAdmin,
} from "../lib/dados";
import { CabecalhoSecao, Carregando, EstadoVazio } from "../components/ui";

// RF26/RF27/RF21: cadastro/ativação de categorias e locais, edição dos modelos de
// mensagem e promoção/desativação de usuários. Tudo que antes só existia via seed.

type Aba = "categorias" | "locais" | "modelos" | "usuarios";

export default function Administracao() {
  const [aba, setAba] = useState<Aba>("categorias");

  return (
    <div>
      <CabecalhoSecao
        supra="Liderança"
        titulo="Administração"
        descricao="Categorias, locais, modelos de mensagem e usuários."
      />

      <div className="mb-6 flex gap-1 border-b border-border">
        {(
          [
            ["categorias", "Categorias"],
            ["locais", "Locais"],
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
