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
import {
  nivelRisco,
  compararPorRiscoEPrioridade,
  isAtiva,
  DIA_MS,
} from "./risco-cliente";

type Cadastro = { _id: string; nome: string };
type Modelo = { _id: string; nome: string; tipo: string; texto: string };
type LinhaAprend = {
  nome: string;
  total: number;
  concluidas: number;
  tempoMedioDias: number | null;
};

interface PainelRet {
  vencidas: DemandaView[];
  vencendo: DemandaView[];
  emExecucao: DemandaView[];
  contadores: { vencidas: number; vencendo: number; emExecucao: number };
}
interface MinhasRet {
  em_execucao: DemandaView[];
  aguardando: DemandaView[];
  triada: DemandaView[];
  concluida: DemandaView[];
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

export function usePainelPrazos(filtros: {
  categoriaId?: string;
  responsavelId?: string;
}): PainelRet | undefined {
  if (DEMO) {
    const { demandas } = useDemo();
    return useMemo<PainelRet>(() => {
      const agora = Date.now();
      let ativos = demandas.filter((d) => isAtiva(d.status));
      if (filtros.categoriaId) ativos = ativos.filter((d) => d.categoriaId === filtros.categoriaId);
      if (filtros.responsavelId) ativos = ativos.filter((d) => d.responsavelId === filtros.responsavelId);
      const ord = [...ativos]
        .sort((a, b) => compararPorRiscoEPrioridade(a, b, agora))
        .map((d) => ({ ...d, risco: nivelRisco(d.prazo, agora) }));
      const vencidas = ord.filter((d) => d.risco === "vencida");
      const vencendo = ord.filter((d) => d.risco === "vencendo");
      const emExecucao = ord.filter((d) => d.status === "em_execucao" && d.risco === "em_dia");
      return {
        vencidas,
        vencendo,
        emExecucao,
        contadores: {
          vencidas: vencidas.length,
          vencendo: vencendo.length,
          emExecucao: emExecucao.length,
        },
      };
    }, [demandas, filtros.categoriaId, filtros.responsavelId]);
  }
  return asType<PainelRet | undefined>(useQuery(api.demandas.painelPrazos, asType(filtros)));
}

export function useMinhasDemandas(): MinhasRet | undefined {
  if (DEMO) {
    const { demandas } = useDemo();
    return useMemo<MinhasRet>(() => {
      const agora = Date.now();
      const minhas = demandas
        .filter((d) => d.responsavelId === EXECUTOR_DEMO)
        .sort((a, b) => compararPorRiscoEPrioridade(a, b, agora))
        .map((d) => ({ ...d, risco: nivelRisco(d.prazo, agora) }));
      const g = (s: string) => minhas.filter((d) => d.status === s);
      return {
        em_execucao: g("em_execucao"),
        aguardando: g("aguardando"),
        triada: g("triada"),
        concluida: g("concluida"),
      };
    }, [demandas]);
  }
  return asType<MinhasRet | undefined>(useQuery(api.demandas.minhasDemandas, {}));
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
      type Acc = { total: number; concluidas: number; somaDias: number };
      const porCat = new Map<string, Acc>();
      const porLoc = new Map<string, Acc>();
      const acc = (m: Map<string, Acc>, k: string, d: (typeof demandas)[number]) => {
        const a = m.get(k) ?? { total: 0, concluidas: 0, somaDias: 0 };
        a.total++;
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
            concluidas: a.concluidas,
            tempoMedioDias:
              a.concluidas > 0 ? Math.round((a.somaDias / a.concluidas) * 10) / 10 : null,
          }))
          .sort((x, y) => y.total - x.total);
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
