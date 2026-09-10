import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Duas automações reais do sistema, ambas internas (sem rede externa):
const crons = cronJobs();

// RF18/RF19: gera demandas das manutenções recorrentes vencidas (idempotente).
crons.daily(
  "gerar recorrencias",
  { hourUTC: 6, minuteUTC: 0 }, // ~03:00 BRT
  internal.recorrencias.gerarRecorrenciasDoDia,
);

// RF30 / princípio 11: avalia risco de negócio (vencidas / a vencer) e sinaliza de forma
// persistente, para o risco existir mesmo sem ninguém abrir o painel.
crons.daily(
  "avaliar riscos",
  { hourUTC: 6, minuteUTC: 30 },
  internal.demandas.avaliarRiscosDoDia,
);

// Limpeza do rate-limit dos endpoints públicos (ver lib/limite.ts).
crons.daily(
  "limpar rate-limit",
  { hourUTC: 7, minuteUTC: 0 },
  internal.limite.limparEventosAntigos,
);

export default crons;
