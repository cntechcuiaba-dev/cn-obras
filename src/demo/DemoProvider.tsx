import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { EventoHistorico } from "../lib/tipos";
import { StatusDemanda, Prioridade, MotivoImpedimento } from "../lib/labels";
import {
  DemoDemanda,
  DemoRecorrencia,
  seedDemandas,
  seedRecorrencias,
  protocolo,
  nomeCat,
  nomeLoc,
  nomeExe,
} from "./dados-demo";

let contador = 5000;
const nid = () => `n${contador++}`;

interface AbrirArgs {
  titulo: string;
  descricao: string;
  solicitanteNome: string;
  solicitanteWhatsapp: string;
  localTextoOriginal: string;
}
interface TriarArgs {
  demandaId: string;
  categoriaId: string;
  localId: string;
  prioridade: Prioridade;
  prazo: number;
  responsavelId: string;
  resultadoEsperado: string;
}
interface StatusArgs {
  demandaId: string;
  novoStatus: "em_execucao" | "aguardando" | "concluida";
  motivoImpedimento?: MotivoImpedimento;
  resultadoConfirmado?: boolean;
}

interface DemoCtx {
  demandas: DemoDemanda[];
  recorrencias: DemoRecorrencia[];
  papel: "lideranca" | "executor";
  setPapel: (p: "lideranca" | "executor") => void;
  acoes: {
    abrir: (a: AbrirArgs) => { protocolo: string };
    triar: (a: TriarArgs) => void;
    cancelar: (demandaId: string) => void;
    mudarStatus: (a: StatusArgs) => void;
    anexarFoto: (demandaId: string, etiqueta: string) => void;
    criarRecorrencia: (
      r: Omit<
        DemoRecorrencia,
        "_id" | "categoriaNome" | "localNome" | "responsavelNome" | "proximaGeracao" | "ativa"
      >,
    ) => void;
    alternarRecorrencia: (id: string, ativa: boolean) => void;
  };
}

const Ctx = createContext<DemoCtx | null>(null);

const evento = (tipo: string, descricao: string): EventoHistorico => ({
  _id: nid(),
  _creationTime: Date.now(),
  tipo,
  descricao,
  criadoPorClerkId: "demo",
});

const DESC_MOTIVO: Record<string, string> = {
  aguardando_aprovacao: "aguardando aprovação",
  aguardando_material: "aguardando material",
  aguardando_terceiro: "aguardando terceiro",
  aguardando_orcamento: "aguardando orçamento",
  aguardando_decisao: "aguardando decisão",
};

export function DemoProvider({ children }: { children: ReactNode }) {
  const [demandas, setDemandas] = useState<DemoDemanda[]>(() => seedDemandas());
  const [recorrencias, setRecorrencias] = useState<DemoRecorrencia[]>(() => seedRecorrencias());
  const [papel, setPapel] = useState<"lideranca" | "executor">("lideranca");

  const patch = (id: string, fn: (d: DemoDemanda) => DemoDemanda) =>
    setDemandas((prev) => prev.map((d) => (d._id === id ? fn(d) : d)));

  const acoes = useMemo<DemoCtx["acoes"]>(
    () => ({
      abrir: (a) => {
        const id = nid();
        const nova: DemoDemanda = {
          _id: id,
          _creationTime: Date.now(),
          titulo: a.titulo,
          descricao: a.descricao,
          solicitanteNome: a.solicitanteNome,
          solicitanteWhatsapp: a.solicitanteWhatsapp.replace(/\D/g, ""),
          localTextoOriginal: a.localTextoOriginal,
          status: "aberta",
          historico: [evento("criada", "Demanda aberta pelo formulário público")],
          fotos: [],
          categoriaNome: null,
          localNome: null,
          responsavelNome: null,
        };
        setDemandas((prev) => [nova, ...prev]);
        return { protocolo: protocolo(id) };
      },
      triar: (a) => {
        patch(a.demandaId, (d) => ({
          ...d,
          status: "triada" as StatusDemanda,
          categoriaId: a.categoriaId,
          localId: a.localId,
          categoriaNome: nomeCat(a.categoriaId),
          localNome: nomeLoc(a.localId),
          prioridade: a.prioridade,
          prazo: a.prazo,
          responsavelId: a.responsavelId,
          responsavelNome: nomeExe(a.responsavelId),
          resultadoEsperado: a.resultadoEsperado,
          historico: [
            ...d.historico,
            evento("triada", `Triada · prioridade ${a.prioridade} · atribuída a ${nomeExe(a.responsavelId)}`),
          ],
        }));
      },
      cancelar: (id) =>
        patch(id, (d) => ({
          ...d,
          status: "cancelada",
          riscoSinalizadoEm: undefined,
          historico: [...d.historico, evento("cancelada", "Cancelada")],
        })),
      mudarStatus: (a) =>
        patch(a.demandaId, (d) => {
          const nd: DemoDemanda = { ...d, status: a.novoStatus, riscoSinalizadoEm: undefined };
          if (a.novoStatus === "aguardando") {
            nd.motivoImpedimento = a.motivoImpedimento;
            nd.impedimentoDesde = Date.now();
            nd.historico = [
              ...d.historico,
              evento("status_alterado", `Status: Aguardando — ${DESC_MOTIVO[a.motivoImpedimento ?? ""] ?? ""}`),
            ];
          } else if (a.novoStatus === "em_execucao") {
            nd.motivoImpedimento = undefined;
            nd.impedimentoDesde = undefined;
            nd.historico = [...d.historico, evento("status_alterado", "Status: Em execução")];
          } else {
            nd.concluidaEm = Date.now();
            nd.resultadoConfirmado = true;
            nd.motivoImpedimento = undefined;
            nd.historico = [
              ...d.historico,
              evento("status_alterado", "Status: Concluída — resultado confirmado"),
            ];
          }
          return nd;
        }),
      anexarFoto: (id, etiqueta) =>
        patch(id, (d) => ({
          ...d,
          fotos: [
            ...d.fotos,
            {
              id: nid(),
              url: `data:image/svg+xml,${encodeURIComponent(
                `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='100%' height='100%' fill='#8A7A66'/><text x='50%' y='50%' fill='white' font-size='30' text-anchor='middle' dominant-baseline='middle' font-family='sans-serif'>${etiqueta}</text></svg>`,
              )}`,
            },
          ],
          historico: [...d.historico, evento("foto", `Foto anexada (${etiqueta})`)],
        })),
      criarRecorrencia: (r) =>
        setRecorrencias((prev) => [
          ...prev,
          {
            ...r,
            _id: nid(),
            ativa: true,
            categoriaNome: nomeCat(r.categoriaId) ?? "",
            localNome: nomeLoc(r.localId) ?? "",
            responsavelNome: nomeExe(r.executorPadraoId) ?? "",
            proximaGeracao: Date.now(),
          },
        ]),
      alternarRecorrencia: (id, ativa) =>
        setRecorrencias((prev) => prev.map((r) => (r._id === id ? { ...r, ativa } : r))),
    }),
    [],
  );

  const valor = useMemo<DemoCtx>(
    () => ({ demandas, recorrencias, papel, setPapel, acoes }),
    [demandas, recorrencias, papel, acoes],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useDemo(): DemoCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDemo fora do DemoProvider");
  return c;
}
