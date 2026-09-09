import { StatusDemanda, Prioridade, MotivoImpedimento } from "./labels";

// View leve de demanda no cliente (o backend enriquece com nomes e nível de risco).
export interface DemandaView {
  _id: string;
  _creationTime: number;
  titulo: string;
  descricao?: string;
  status: StatusDemanda;
  prioridade?: Prioridade;
  prazo?: number;
  categoriaNome?: string | null;
  localNome?: string | null;
  responsavelNome?: string | null;
  equipeNomes?: string[];
  solicitanteNome?: string;
  solicitanteWhatsapp?: string;
  localTextoOriginal?: string;
  resultadoEsperado?: string;
  motivoImpedimento?: MotivoImpedimento;
  impedimentoDesde?: number;
  concluidaEm?: number;
  resultadoConfirmado?: boolean;
  riscoSinalizadoEm?: number;
  risco?: "vencida" | "vencendo" | "em_dia" | "sem_prazo";
}

export interface EventoHistorico {
  _id: string;
  _creationTime: number;
  tipo: string;
  descricao: string;
  criadoPorClerkId?: string;
  anexos?: string[];
}
