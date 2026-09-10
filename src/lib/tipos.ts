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
  // Sugestão vinda do formulário público; a triagem confirma (RF06).
  localId?: string;
  localNome?: string | null;
  responsavelNome?: string | null;
  equipeNomes?: string[];
  equipamentoId?: string;
  equipamentoNome?: string | null;
  origemRecorrenciaId?: string;
  responsavelId?: string;
  equipeIds?: string[];
  solicitanteNome?: string;
  solicitanteWhatsapp?: string;
  localTextoOriginal?: string;
  resultadoEsperado?: string;
  motivoImpedimento?: MotivoImpedimento;
  impedimentoDesde?: number;
  concluidaEm?: number;
  resultadoConfirmado?: boolean;
  // [E2] compromisso embutido e fato realizado
  orcamento?: {
    fornecedor: string;
    solicitadoEm: number;
    cobrarEm: number;
    responsavelCobrancaId: string;
    cobrancasFeitas: number;
    valorRecebido?: number;
    recebidoEm?: number;
    aprovadoEm?: number;
    aprovadoPorId?: string;
  };
  custo?: { valor: number; origem: string; lancadoEm: number };
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
