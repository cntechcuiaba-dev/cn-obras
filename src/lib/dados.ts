/* eslint-disable react-hooks/rules-of-hooks */
// Camada de acesso a dados. Em modo DEMO usa o store fake; caso contrário chama o
// Convex real. Como DEMO é constante durante toda a vida do app, o ramo de hooks é
// estável por componente (seguro apesar do lint de rules-of-hooks).
import { useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEMO } from "./env";
import { useDemo } from "../demo/DemoProvider";
import { DemoRecorrencia, EXECUTOR_DEMO, CATEGORIAS, LOCAIS, EXECUTORES, MODELOS } from "../demo/dados-demo";
import { DemandaView, EventoHistorico } from "./tipos";
import { StatusDemanda } from "./labels";
import {
  nivelRisco,
  compararPorRiscoEPrioridade,
  isAtiva,
  DIA_MS,
} from "./risco-cliente";
// Mesma fórmula usada pelo backend (RF14c: uma única fórmula).
import { pontuar, frase, bloqueio, acaoDe } from "../../convex/lib/movimento";

type Cadastro = { _id: string; nome: string };
type Modelo = { _id: string; nome: string; tipo: string; texto: string };
type LinhaAprend = {
  nome: string;
  total: number;
  // [RF29] manutenção programada contada à parte do problema que se repete
  espontaneas: number;
  recorrentes: number;
  concluidas: number;
  tempoMedioDias: number | null;
};

// [E3] Painel de um movimento. A fórmula é importada do backend para não existirem
// duas versões dela (RF14c fala em fórmula única).
export interface ItemMovimento {
  _id: string;
  titulo: string;
  descricao: string;
  status: StatusDemanda;
  prazo?: number;
  localTextoOriginal?: string;
  solicitanteNome?: string;
  porque: string;
  acao: { rotulo: string; destino: string };
  categoriaNome: string | null;
  localNome: string | null;
  responsavelNome: string | null;
}
export interface LinhaBloqueada {
  _id: string;
  titulo: string;
  prazo?: number;
  motivo?: string;
  impedimentoDesde?: number;
  quemDestrava: string;
  condicaoRetorno: string;
  localNome: string | null;
  responsavelNome: string | null;
}
export interface AvisoPendente {
  _id: string;
  demandaId: string;
  mensagem: string;
  gatilho: string;
  demandaTitulo: string;
  whatsapp: string;
}
export interface AprovacaoPendente {
  _id: string;
  titulo: string;
  fornecedor: string;
  valorRecebido: number;
  localNome: string | null;
}
interface MovimentoRet {
  item: ItemMovimento | null;
  proximos: { _id: string; titulo: string; prazo?: number }[];
  bloqueados: LinhaBloqueada[];
  avisos: AvisoPendente[];
  aprovacoes: AprovacaoPendente[];
  papel: string;
}
interface DetalheRet {
  demanda: DemandaView;
  historico: EventoHistorico[];
  fotos: { id: string; url: string | null }[];
  podeExecutar: boolean;
  papel: string;
}
interface AprendizadoRet {
  porCategoria: LinhaAprend[];
  porLocal: LinhaAprend[];
  totalConsiderado: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asType = <T,>(v: any): T => v as T;

// ---------------- Queries ----------------

export function useCategorias(): Cadastro[] | undefined {
  if (DEMO) return CATEGORIAS;
  return asType<Cadastro[] | undefined>(useQuery(api.cadastros.listarCategorias, {}));
}

export function useLocais(): Cadastro[] | undefined {
  if (DEMO) return LOCAIS;
  return asType<Cadastro[] | undefined>(useQuery(api.cadastros.listarLocais, {}));
}

export function useExecutores(): Cadastro[] | undefined {
  if (DEMO) return EXECUTORES;
  return asType<Cadastro[] | undefined>(useQuery(api.usuarios.listarExecutores, {}));
}

export function useModelos(): Modelo[] | undefined {
  if (DEMO) return MODELOS;
  return asType<Modelo[] | undefined>(useQuery(api.cadastros.listarModelos, {}));
}

// ---------------- Administração ----------------
// Tela de admin precisa ver os inativos também, ao contrário das listas usadas
// na triagem/formulários — por isso hooks dedicados em vez de reaproveitar acima.

export interface CadastroAdmin extends Cadastro {
  ativa?: boolean;
  ativo?: boolean;
}

export function useCategoriasAdmin(): CadastroAdmin[] | undefined {
  // CATEGORIAS já traz `ativa` real — sobrescrever com true escondia inativas.
  if (DEMO) return CATEGORIAS.map((c) => ({ ...c }));
  return asType<CadastroAdmin[] | undefined>(
    useQuery(api.cadastros.listarCategorias, { incluirInativas: true }),
  );
}

export function useLocaisAdmin(): CadastroAdmin[] | undefined {
  // LOCAIS já traz `ativo` real (ex.: Secretaria é inativa no seed de demo).
  if (DEMO) return LOCAIS.map((l) => ({ ...l }));
  return asType<CadastroAdmin[] | undefined>(
    useQuery(api.cadastros.listarLocais, { incluirInativos: true }),
  );
}

export interface UsuarioAdmin {
  _id: string;
  nome: string;
  email: string;
  papel: "lideranca" | "executor";
  ativo: boolean;
}

export function useUsuariosAdmin(): UsuarioAdmin[] | undefined {
  if (DEMO) return EXECUTORES.map((u) => ({ ...u, email: "", papel: "executor" as const, ativo: true }));
  return asType<UsuarioAdmin[] | undefined>(useQuery(api.usuarios.listarUsuarios, {}));
}

export function useCriarCategoria(): Fn {
  if (DEMO) return async () => undefined;
  return useMutation(api.cadastros.criarCategoria);
}
export function useAlternarCategoria(): Fn {
  if (DEMO) return async () => undefined;
  return useMutation(api.cadastros.alternarCategoria);
}
export function useCriarLocalAdmin(): Fn {
  if (DEMO) return async () => undefined;
  return useMutation(api.cadastros.criarLocal);
}
export function useAlternarLocalAdmin(): Fn {
  if (DEMO) return async () => undefined;
  return useMutation(api.cadastros.alternarLocal);
}
export function useAtualizarModelo(): Fn {
  if (DEMO) return async () => undefined;
  return useMutation(api.cadastros.atualizarModelo);
}
export function usePromoverUsuario(): Fn {
  if (DEMO) return async () => undefined;
  return useMutation(api.usuarios.promover);
}
export function useAlternarAtivoUsuario(): Fn {
  if (DEMO) return async () => undefined;
  return useMutation(api.usuarios.alternarAtivo);
}

// [E3 / RF14a-i] Painel de um movimento.
export function useProximoMovimento(): MovimentoRet | undefined {
  if (DEMO) {
    const { demandas, papel } = useDemo();
    return useMemo<MovimentoRet>(() => {
      const agora = Date.now();
      const minhas = demandas.filter((d) => {
        if (d.status === "concluida" || d.status === "cancelada") return false;
        const souResponsavel = d.responsavelId === EXECUTOR_DEMO;
        if (papel === "lideranca") return d.status === "aberta" || souResponsavel;
        return souResponsavel;
      });

      const acionaveis: typeof minhas = [];
      const bloqueados: MovimentoRet["bloqueados"] = [];
      for (const d of minhas) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const b = bloqueio(d as any);
        if (b) {
          bloqueados.push({
            _id: d._id,
            titulo: d.titulo,
            prazo: d.prazo,
            motivo: d.motivoImpedimento,
            impedimentoDesde: d.impedimentoDesde,
            quemDestrava: b.quemDestrava,
            condicaoRetorno: b.condicaoRetorno,
            localNome: d.localNome ?? null,
            responsavelNome: d.responsavelNome ?? null,
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } else if (acaoDe(d as any)) {
          acionaveis.push(d);
        }
      }

      const ordenadas = acionaveis
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((d) => ({ d, ...pontuar(d as any, agora) }))
        .sort((a, b) => b.pontos - a.pontos);

      const p = ordenadas[0];
      return {
        item: p
          ? {
              _id: p.d._id,
              titulo: p.d.titulo,
              descricao: p.d.descricao,
              status: p.d.status,
              prazo: p.d.prazo,
              localTextoOriginal: p.d.localTextoOriginal,
              solicitanteNome: p.d.solicitanteNome,
              porque: frase(p.fatores),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              acao: acaoDe(p.d as any)!,
              categoriaNome: p.d.categoriaNome ?? null,
              localNome: p.d.localNome ?? null,
              responsavelNome: p.d.responsavelNome ?? null,
            }
          : null,
        proximos: ordenadas
          .slice(1, 4)
          .map((x) => ({ _id: x.d._id, titulo: x.d.titulo, prazo: x.d.prazo })),
        bloqueados,
        avisos: [],
        aprovacoes: [],
        papel,
      };
    }, [demandas, papel]);
  }
  return asType<MovimentoRet | undefined>(useQuery(api.painel.proximoMovimento, {}));
}

// [RF14i] Tela de consulta separada — nunca a inicial.
export function useTodasDemandas(): DemandaView[] | undefined {
  if (DEMO) {
    const { demandas } = useDemo();
    return useMemo(() => {
      const agora = Date.now();
      return [...demandas]
        .filter((d) => isAtiva(d.status) || d.status === "aberta")
        .sort((a, b) => compararPorRiscoEPrioridade(a, b, agora))
        .map((d) => ({ ...d, risco: nivelRisco(d.prazo, agora) }));
    }, [demandas]);
  }
  return asType<DemandaView[] | undefined>(useQuery(api.painel.todasDemandas, {}));
}

export function useAbertas(): DemandaView[] | undefined {
  if (DEMO) {
    const { demandas } = useDemo();
    return useMemo(
      () =>
        demandas
          .filter((d) => d.status === "aberta")
          .sort((a, b) => a._creationTime - b._creationTime),
      [demandas],
    );
  }
  return asType<DemandaView[] | undefined>(useQuery(api.triagem.listarAbertas, {}));
}

export function useDetalhe(id: string | undefined): DetalheRet | null | undefined {
  if (DEMO) {
    const { demandas, papel } = useDemo();
    return useMemo<DetalheRet | null>(() => {
      const d = demandas.find((x) => x._id === id);
      if (!d) return null;
      const agora = Date.now();
      return {
        demanda: { ...d, risco: nivelRisco(d.prazo, agora) },
        historico: [...d.historico].sort((a, b) => a._creationTime - b._creationTime),
        fotos: d.fotos.filter((f) => f.url),
        podeExecutar: papel === "lideranca" || d.responsavelId === EXECUTOR_DEMO,
        papel,
      };
    }, [demandas, id, papel]);
  }
  return asType<DetalheRet | null | undefined>(
    useQuery(api.demandas.detalheDemanda, asType({ demandaId: id })),
  );
}

export function useRecorrencias(): DemoRecorrencia[] | undefined {
  if (DEMO) {
    const { recorrencias } = useDemo();
    return recorrencias;
  }
  return asType<DemoRecorrencia[] | undefined>(useQuery(api.recorrencias.listar, {}));
}

export function useAprendizado(): AprendizadoRet | undefined {
  if (DEMO) {
    const { demandas } = useDemo();
    return useMemo<AprendizadoRet>(() => {
      type Acc = {
        total: number;
        espontaneas: number;
        recorrentes: number;
        concluidas: number;
        somaDias: number;
      };
      const porCat = new Map<string, Acc>();
      const porLoc = new Map<string, Acc>();
      const acc = (m: Map<string, Acc>, k: string, d: (typeof demandas)[number]) => {
        const a =
          m.get(k) ??
          { total: 0, espontaneas: 0, recorrentes: 0, concluidas: 0, somaDias: 0 };
        a.total++;
        if (d.origemRecorrenciaId) a.recorrentes++;
        else a.espontaneas++;
        if (d.status === "concluida" && d.concluidaEm) {
          a.concluidas++;
          a.somaDias += (d.concluidaEm - d._creationTime) / DIA_MS;
        }
        m.set(k, a);
      };
      for (const d of demandas) {
        if (d.status === "cancelada") continue;
        acc(porCat, d.categoriaNome ?? "Sem categoria", d);
        acc(porLoc, d.localNome ?? "Sem local", d);
      }
      const mat = (m: Map<string, Acc>): LinhaAprend[] =>
        [...m.entries()]
          .map(([nome, a]) => ({
            nome,
            total: a.total,
            espontaneas: a.espontaneas,
            recorrentes: a.recorrentes,
            concluidas: a.concluidas,
            tempoMedioDias:
              a.concluidas > 0 ? Math.round((a.somaDias / a.concluidas) * 10) / 10 : null,
          }))
          .sort((x, y) => y.espontaneas - x.espontaneas || y.total - x.total);
      return {
        porCategoria: mat(porCat),
        porLocal: mat(porLoc),
        totalConsiderado: demandas.filter((d) => d.status !== "cancelada").length,
      };
    }, [demandas]);
  }
  return asType<AprendizadoRet | undefined>(useQuery(api.inteligencia.aprendizado, {}));
}

// ---------------- Mutations ----------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fn = (args?: any) => Promise<any>;

export function useAbrir(): Fn {
  if (DEMO) {
    const { acoes } = useDemo();
    return async (a) => acoes.abrir(a);
  }
  return useMutation(api.demandas.abrirDemanda);
}

export function useTriar(): Fn {
  if (DEMO) {
    const { acoes } = useDemo();
    return async (a) => acoes.triar(a);
  }
  return useMutation(api.triagem.triar);
}

// RF08: liderança ajusta prazo, prioridade e responsável a qualquer momento.
export function useAtualizar(): Fn {
  if (DEMO) return async () => undefined;
  return useMutation(api.triagem.atualizar);
}

export function useMarcarAvisoEnviado(): Fn {
  if (DEMO) return async () => undefined;
  return useMutation(api.avisos.marcarEnviado);
}

export function useAprovarOrcamento(): Fn {
  if (DEMO) return async () => undefined;
  return useMutation(api.orcamento.aprovar);
}

export function useRegistrarValorRecebido(): Fn {
  if (DEMO) return async () => undefined;
  return useMutation(api.orcamento.registrarValorRecebido);
}

export function useRegistrarCobranca(): Fn {
  if (DEMO) return async () => undefined;
  return useMutation(api.orcamento.registrarCobranca);
}

export function useRegistrarConsumo(): Fn {
  if (DEMO) return async () => undefined;
  return useMutation(api.orcamento.registrarConsumo);
}

export function useCancelar(): Fn {
  if (DEMO) {
    const { acoes } = useDemo();
    return async (a) => acoes.cancelar(a.demandaId);
  }
  return useMutation(api.triagem.cancelar);
}

export function useMudarStatus(): Fn {
  if (DEMO) {
    const { acoes } = useDemo();
    return async (a) => acoes.mudarStatus(a);
  }
  return useMutation(api.demandas.mudarStatus);
}

export function useAnexarFoto(): Fn {
  if (DEMO) {
    const { acoes } = useDemo();
    return async (a) => acoes.anexarFoto(a.demandaId, a.etiqueta ?? "Foto");
  }
  return useMutation(api.demandas.anexarFoto);
}

export function useGerarUrlPublico(): Fn {
  if (DEMO) return async () => "";
  return useMutation(api.demandas.gerarUrlUploadPublico);
}

export function useGerarUrl(): Fn {
  if (DEMO) return async () => "";
  return useMutation(api.demandas.gerarUrlUpload);
}

export function useCriarRecorrencia(): Fn {
  if (DEMO) {
    const { acoes } = useDemo();
    return async (a) => acoes.criarRecorrencia(a);
  }
  return useMutation(api.recorrencias.criar);
}

export function useAlternarRecorrencia(): Fn {
  if (DEMO) {
    const { acoes } = useDemo();
    return async (a) => acoes.alternarRecorrencia(a.id, a.ativa);
  }
  return useMutation(api.recorrencias.alternarAtiva);
}
