import { Doc } from "../_generated/dataModel";

// [E3 / RF14c] Fórmula ÚNICA do próximo movimento, calculada na leitura a partir de
// prazo, prioridade e impedimentoDesde (e do relógio, para o que ainda não foi triado).
// Nada aqui é gravado no banco — foi cache manual que fez o painel antigo ordenar por
// ordem de inserção parecendo ordenar por urgência.

export const DIA_MS = 86_400_000;

export type ChaveFator =
  | "aguardando_triagem"
  | "vencida"
  | "vence_hoje"
  | "vence_em"
  | "prioridade_alta"
  | "prioridade_media"
  | "parada";

export interface Fator {
  chave: ChaveFator;
  pontos: number;
  texto: string; // fragmento usado para montar a frase do RF14d
}

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

export function pontuar(
  d: Doc<"demandas">,
  agora: number,
): { pontos: number; fatores: Fator[] } {
  const fatores: Fator[] = [];

  // Nada anda enquanto não for triada — e só a liderança destrava isso.
  if (d.status === "aberta") {
    const dias = Math.floor((agora - d._creationTime) / DIA_MS);
    fatores.push({
      chave: "aguardando_triagem",
      pontos: 40 + dias * 5,
      texto:
        dias <= 0
          ? "foi aberta hoje e ainda não tem prazo nem responsável"
          : `está há ${plural(dias, "dia", "dias")} aberta sem triagem`,
    });
  }

  // Vencimento é propriedade derivada da data, nunca estado (RF14g).
  if (d.prazo !== undefined) {
    const dias = Math.floor((d.prazo - agora) / DIA_MS);
    if (dias < 0) {
      const atraso = Math.abs(dias);
      fatores.push({
        chave: "vencida",
        pontos: 100 + atraso * 10,
        texto: `venceu há ${plural(atraso, "dia", "dias")}`,
      });
    } else if (dias === 0) {
      fatores.push({ chave: "vence_hoje", pontos: 60, texto: "vence hoje" });
    } else if (dias <= 5) {
      fatores.push({
        chave: "vence_em",
        pontos: Math.max(5, 60 - dias * 10),
        texto: `vence em ${plural(dias, "dia", "dias")}`,
      });
    }
  }

  if (d.prioridade === "alta") {
    fatores.push({ chave: "prioridade_alta", pontos: 30, texto: "é prioridade alta" });
  } else if (d.prioridade === "media") {
    fatores.push({ chave: "prioridade_media", pontos: 15, texto: "é prioridade média" });
  }

  // Tempo parado empurra para cima quando a demanda volta a ser acionável.
  if (d.impedimentoDesde !== undefined) {
    const dias = Math.floor((agora - d.impedimentoDesde) / DIA_MS);
    if (dias > 0) {
      fatores.push({
        chave: "parada",
        pontos: Math.min(30, dias * 3),
        texto: `ficou parada ${plural(dias, "dia", "dias")}`,
      });
    }
  }

  return { pontos: fatores.reduce((s, f) => s + f.pontos, 0), fatores };
}

// [RF14d] A frase é GERADA da fórmula — não escrita à mão. Usa os dois fatores que
// mais pesaram, que são exatamente os que colocaram o item em primeiro.
export function frase(fatores: Fator[]): string {
  if (fatores.length === 0) {
    return "É o item mais antigo da sua fila, sem outro sinal de urgência.";
  }
  const texto = [...fatores]
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 2)
    .map((f) => f.texto)
    .join(" e ");
  return texto.charAt(0).toUpperCase() + texto.slice(1) + ".";
}

// [RF14b] Bloqueado por terceiro sai do painel: vai para seção separada, com quem
// destrava e a condição de retorno.
export interface Bloqueio {
  quemDestrava: string;
  condicaoRetorno: string;
}

export function bloqueio(d: Doc<"demandas">, agora = Date.now()): Bloqueio | null {
  if (d.status !== "aguardando" || !d.motivoImpedimento) return null;

  // [E2] "O sistema cobra, não avisa." Chegada a data de cobrança, a demanda
  // deixa de estar travada com o fornecedor e volta a ser movimento de quem
  // cobra. Enquanto a data não chega, ela fica fora do painel — de propósito.
  if (d.motivoImpedimento === "aguardando_orcamento" && d.orcamento) {
    if (agora >= d.orcamento.cobrarEm) return null;
  }

  switch (d.motivoImpedimento) {
    case "aguardando_aprovacao":
      return { quemDestrava: "Liderança", condicaoRetorno: "quando a aprovação sair" };
    case "aguardando_material":
      return {
        quemDestrava: "Compra de material",
        condicaoRetorno: "quando o material chegar",
      };
    case "aguardando_terceiro":
      return {
        quemDestrava: "Terceiro / prestador",
        condicaoRetorno: "quando o terceiro responder",
      };
    case "aguardando_orcamento":
      return {
        quemDestrava: d.orcamento?.fornecedor ?? "Fornecedor",
        condicaoRetorno: "quando o orçamento chegar",
      };
    case "aguardando_decisao":
      return { quemDestrava: "Liderança", condicaoRetorno: "quando a decisão for tomada" };
  }
}

// [RF14f] Nenhum item entra no painel sem ação executável — o rótulo sai do estado.
// [RF18b] Manutenção recorrente recém-gerada é movimento de PROGRAMAR, não de
// executar: ela nasce triada e com antecedência justamente para dar tempo disso.
export function acaoDe(
  d: Doc<"demandas">,
  agora = Date.now(),
): { rotulo: string; destino: string } | null {
  // [E2] orçamento cuja data de cobrança chegou é movimento de cobrar
  if (
    d.status === "aguardando" &&
    d.motivoImpedimento === "aguardando_orcamento" &&
    d.orcamento &&
    agora >= d.orcamento.cobrarEm
  ) {
    return {
      rotulo: `Cobrar o orçamento de ${d.orcamento.fornecedor}`,
      destino: "detalhe",
    };
  }

  switch (d.status) {
    case "aberta":
      return { rotulo: "Triar agora", destino: "triagem" };
    case "triada":
      return d.origemRecorrenciaId
        ? { rotulo: "Programar manutenção", destino: "detalhe" }
        : { rotulo: "Iniciar", destino: "detalhe" };
    case "em_execucao":
      return { rotulo: "Concluir", destino: "detalhe" };
    default:
      return null;
  }
}

// [E2] Orçamento recebido e ainda não aprovado é movimento da LIDERANÇA.
export function aguardaAprovacao(d: Doc<"demandas">): boolean {
  return (
    d.orcamento !== undefined &&
    d.orcamento.valorRecebido !== undefined &&
    d.orcamento.aprovadoEm === undefined
  );
}
