import { EventoHistorico, DemandaView } from "../lib/tipos";
import { StatusDemanda, Prioridade, MotivoImpedimento } from "../lib/labels";

export interface DemoDemanda extends DemandaView {
  descricao: string;
  solicitanteNome: string;
  solicitanteWhatsapp: string;
  localTextoOriginal: string;
  categoriaId?: string;
  localId?: string;
  responsavelId?: string;
  status: StatusDemanda;
  prioridade?: Prioridade;
  motivoImpedimento?: MotivoImpedimento;
  historico: EventoHistorico[];
  fotos: { id: string; url: string | null }[];
}

export interface DemoRecorrencia {
  _id: string;
  titulo: string;
  descricao: string;
  categoriaId: string;
  localId: string;
  executorPadraoId: string;
  categoriaNome: string;
  localNome: string;
  responsavelNome: string;
  periodicidade: string;
  antecedenciaDias: number;
  ativa: boolean;
  proximaGeracao: number | null;
  proximaManutencao: number | null;
}

const DIA = 86_400_000;
const base = Date.now();
const off = (n: number) => base + n * DIA;

let seq = 1000;
const uid = () => `x${seq++}`;

function foto(cor: string, tag: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='100%' height='100%' fill='${cor}'/><text x='50%' y='50%' fill='white' font-size='30' text-anchor='middle' dominant-baseline='middle' font-family='sans-serif'>${tag}</text></svg>`;
  return { id: uid(), url: `data:image/svg+xml,${encodeURIComponent(svg)}` };
}

function ev(off_: number, tipo: string, descricao: string, sistema = false): EventoHistorico {
  return {
    _id: uid(),
    _creationTime: off(off_),
    tipo,
    descricao,
    criadoPorClerkId: sistema ? undefined : "demo",
  };
}

export const EXECUTORES = [
  { _id: "u_marcos", nome: "Marcos Silva", papel: "executor" as const },
  { _id: "u_joao", nome: "João Pereira", papel: "executor" as const },
  { _id: "u_rafael", nome: "Rafael Costa", papel: "executor" as const },
];
// Executor "logado" no modo demo (para Minhas Demandas).
export const EXECUTOR_DEMO = "u_marcos";

export const CATEGORIAS = [
  { _id: "c_eletrica", nome: "Elétrica", ativa: true },
  { _id: "c_hidraulica", nome: "Hidráulica", ativa: true },
  { _id: "c_estrutura", nome: "Estrutura", ativa: true },
  { _id: "c_marcenaria", nome: "Marcenaria", ativa: true },
  { _id: "c_ar", nome: "Ar-condicionado", ativa: true },
  { _id: "c_pintura", nome: "Pintura", ativa: true },
];

export const LOCAIS = [
  { _id: "l_templo", nome: "Templo principal", ativo: true },
  { _id: "l_salao", nome: "Salão social", ativo: true },
  { _id: "l_cozinha", nome: "Cozinha", ativo: true },
  { _id: "l_banheiros", nome: "Banheiros — Térreo", ativo: true },
  { _id: "l_infantil", nome: "Sala infantil", ativo: true },
  { _id: "l_estac", nome: "Estacionamento", ativo: true },
  { _id: "l_secretaria", nome: "Secretaria", ativo: false },
];

export const MODELOS = [
  {
    _id: "m1",
    nome: "Em execução",
    tipo: "em_execucao",
    texto:
      'Olá {{solicitante}}! Sua solicitação "{{demanda}}" ({{local}}) já está em execução. Prazo: {{prazo}}.',
  },
  {
    _id: "m2",
    nome: "Aguardando",
    tipo: "aguardando",
    texto:
      'Olá {{solicitante}}! Sua solicitação "{{demanda}}" está aguardando para prosseguir.',
  },
  {
    _id: "m3",
    nome: "Concluída",
    tipo: "concluida",
    texto:
      'Olá {{solicitante}}! Sua solicitação "{{demanda}}" ({{local}}) foi concluída. Obrigado!',
  },
];

const nomeCat = (id?: string) => CATEGORIAS.find((c) => c._id === id)?.nome ?? null;
const nomeLoc = (id?: string) => LOCAIS.find((l) => l._id === id)?.nome ?? null;
const nomeExe = (id?: string) => EXECUTORES.find((e) => e._id === id)?.nome ?? null;

function demanda(d: Partial<DemoDemanda> & { titulo: string; status: StatusDemanda }): DemoDemanda {
  return {
    _id: uid(),
    _creationTime: off(-6),
    descricao: "",
    solicitanteNome: "",
    solicitanteWhatsapp: "",
    localTextoOriginal: "",
    historico: [],
    fotos: [],
    categoriaNome: nomeCat(d.categoriaId),
    localNome: nomeLoc(d.localId),
    responsavelNome: nomeExe(d.responsavelId),
    ...d,
  };
}

export function seedDemandas(): DemoDemanda[] {
  return [
    demanda({
      titulo: "Vazamento no forro do salão social",
      descricao:
        "Está pingando água do forro perto do palco quando chove. O gesso já está manchado.",
      solicitanteNome: "Cleusa Ramos",
      solicitanteWhatsapp: "5562988440132",
      localTextoOriginal: "Salão social, canto do palco",
      status: "em_execucao",
      categoriaId: "c_hidraulica",
      localId: "l_salao",
      prioridade: "alta",
      prazo: off(-2),
      responsavelId: "u_marcos",
      resultadoEsperado: "Vazamento estancado e forro sem pingar em dia de chuva.",
      riscoSinalizadoEm: off(-1),
      fotos: [foto("#5B6470", "Antes")],
      historico: [
        ev(-6, "criada", "Demanda aberta pelo formulário público"),
        ev(-5, "triada", "Triada · prioridade alta · atribuída a Marcos Silva"),
        ev(-4, "status_alterado", "Status: Em execução"),
        ev(-1, "risco_sinalizado", "Risco sinalizado: demanda vencida sem conclusão", true),
      ],
    }),
    demanda({
      titulo: "Tomada queimada na sala infantil",
      descricao: "A tomada ao lado da janela soltou faísca e parou. Cheiro de queimado.",
      solicitanteNome: "Marta Lopes",
      solicitanteWhatsapp: "5562991230045",
      localTextoOriginal: "Sala das crianças",
      status: "triada",
      categoriaId: "c_eletrica",
      localId: "l_infantil",
      prioridade: "alta",
      prazo: off(-1),
      responsavelId: "u_joao",
      resultadoEsperado: "Tomada substituída e testada com carga.",
      historico: [
        ev(-3, "criada", "Demanda aberta pelo formulário público"),
        ev(-2, "triada", "Triada · prioridade alta · atribuída a João Pereira"),
      ],
    }),
    demanda({
      titulo: "Porta do banheiro térreo não tranca",
      descricao: "A fechadura gira em falso e a porta não fecha direito.",
      solicitanteNome: "Diác. Paulo",
      solicitanteWhatsapp: "5562987651234",
      localTextoOriginal: "Banheiro masculino do térreo",
      status: "em_execucao",
      categoriaId: "c_marcenaria",
      localId: "l_banheiros",
      prioridade: "media",
      prazo: off(0),
      responsavelId: "u_marcos",
      resultadoEsperado: "Fechadura funcionando e porta trancando.",
      historico: [
        ev(-4, "criada", "Demanda aberta pelo formulário público"),
        ev(-3, "triada", "Triada · atribuída a Marcos Silva"),
        ev(-1, "status_alterado", "Status: Em execução"),
      ],
    }),
    demanda({
      titulo: "Ar-condicionado do templo pingando",
      descricao: "O aparelho da lateral direita está pingando sobre os bancos.",
      solicitanteNome: "Sônia Alves",
      solicitanteWhatsapp: "5562994561278",
      localTextoOriginal: "Templo, lado direito",
      status: "triada",
      categoriaId: "c_ar",
      localId: "l_templo",
      prioridade: "media",
      prazo: off(1),
      responsavelId: "u_rafael",
      resultadoEsperado: "Dreno desobstruído e sem gotejamento.",
      historico: [
        ev(-2, "criada", "Demanda aberta pelo formulário público"),
        ev(-1, "triada", "Triada · atribuída a Rafael Costa"),
      ],
    }),
    demanda({
      titulo: "Torneira da cozinha vazando",
      descricao: "A torneira principal da cozinha não fecha totalmente.",
      solicitanteNome: "Irmã Lúcia",
      solicitanteWhatsapp: "5562988887766",
      localTextoOriginal: "Cozinha, pia grande",
      status: "aguardando",
      categoriaId: "c_hidraulica",
      localId: "l_cozinha",
      prioridade: "media",
      prazo: off(3),
      responsavelId: "u_marcos",
      motivoImpedimento: "aguardando_material",
      impedimentoDesde: off(-2),
      resultadoEsperado: "Torneira vedando sem vazamento.",
      historico: [
        ev(-5, "criada", "Demanda aberta pelo formulário público"),
        ev(-4, "triada", "Triada · atribuída a Marcos Silva"),
        ev(-2, "status_alterado", "Status: Aguardando — aguardando material"),
      ],
    }),
    demanda({
      titulo: "Pintura descascando na secretaria",
      descricao: "A parede atrás da mesa está descascando por umidade.",
      solicitanteNome: "Secretaria",
      solicitanteWhatsapp: "5562991112233",
      localTextoOriginal: "Sala da secretaria",
      status: "em_execucao",
      categoriaId: "c_pintura",
      localId: "l_secretaria",
      prioridade: "baixa",
      prazo: off(5),
      responsavelId: "u_rafael",
      resultadoEsperado: "Parede tratada e repintada sem descascar.",
      historico: [
        ev(-3, "criada", "Demanda aberta pelo formulário público"),
        ev(-2, "triada", "Triada · atribuída a Rafael Costa"),
        ev(-1, "status_alterado", "Status: Em execução"),
      ],
    }),
    demanda({
      titulo: "Rachadura na parede externa",
      descricao: "Rachadura vertical na parede lateral do templo.",
      solicitanteNome: "Pr. Antônio",
      solicitanteWhatsapp: "5562990009999",
      localTextoOriginal: "Lateral externa do templo",
      _creationTime: off(-16),
      status: "concluida",
      categoriaId: "c_estrutura",
      localId: "l_templo",
      prioridade: "alta",
      prazo: off(-10),
      concluidaEm: off(-8),
      resultadoConfirmado: true,
      responsavelId: "u_marcos",
      resultadoEsperado: "Rachadura tratada e selada.",
      fotos: [foto("#6E5B48", "Antes"), foto("#4C6A55", "Depois")],
      historico: [
        ev(-16, "criada", "Demanda aberta pelo formulário público"),
        ev(-15, "triada", "Triada · prioridade alta · atribuída a Marcos Silva"),
        ev(-12, "status_alterado", "Status: Em execução"),
        ev(-9, "foto", "Foto anexada (Antes)"),
        ev(-8, "status_alterado", "Status: Concluída — resultado confirmado"),
      ],
    }),
    demanda({
      titulo: "Cadeiras quebradas no salão",
      descricao: "Cinco cadeiras com encosto solto ou perna torta. Alguém pode se machucar.",
      solicitanteNome: "Roberto Dias",
      solicitanteWhatsapp: "5562988112200",
      localTextoOriginal: "Salão social, fundo perto da porta",
      status: "aberta",
      fotos: [foto("#6B5D4A", "Foto")],
      historico: [ev(0, "criada", "Demanda aberta pelo formulário público")],
    }),
    demanda({
      titulo: "Vaso sanitário entupido no banheiro feminino",
      descricao: "O vaso do banheiro feminino do térreo está entupido desde ontem.",
      solicitanteNome: "Irmã Marta",
      solicitanteWhatsapp: "5562991234500",
      localTextoOriginal: "Banheiro feminino do térreo",
      status: "aberta",
      historico: [ev(0, "criada", "Demanda aberta pelo formulário público")],
    }),
  ];
}

export function seedRecorrencias(): DemoRecorrencia[] {
  return [
    {
      _id: "r1",
      titulo: "Limpeza da caixa d'água",
      descricao: "Higienização semestral do reservatório.",
      categoriaId: "c_hidraulica",
      localId: "l_templo",
      executorPadraoId: "u_marcos",
      categoriaNome: "Hidráulica",
      localNome: "Templo principal",
      responsavelNome: "Marcos Silva",
      periodicidade: "semestral",
      antecedenciaDias: 10,
      ativa: true,
      proximaGeracao: off(12),
      proximaManutencao: off(22),
    },
    {
      _id: "r2",
      titulo: "Revisão elétrica geral",
      descricao: "Inspeção anual dos quadros e circuitos.",
      categoriaId: "c_eletrica",
      localId: "l_templo",
      executorPadraoId: "u_joao",
      categoriaNome: "Elétrica",
      localNome: "Templo principal",
      responsavelNome: "João Pereira",
      periodicidade: "anual",
      antecedenciaDias: 21,
      ativa: true,
      proximaGeracao: off(88),
      proximaManutencao: off(118),
    },
  ];
}

export const protocolo = (id: string) => `CN-${id.slice(-6).toUpperCase()}`;
export { nomeCat, nomeLoc, nomeExe };
