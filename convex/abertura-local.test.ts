import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// [RF01/RF06] O solicitante pode escolher um local cadastrado OU descrever com
// as próprias palavras. A escolha vira sugestão para a triagem — que continua
// sendo quem confirma o local de verdade.

const modules = import.meta.glob("./**/*.ts");

const BASE = {
  titulo: "Vazamento no forro",
  descricao: "Pingando quando chove",
  solicitanteNome: "Fulano",
  solicitanteWhatsapp: "62999999999",
};

async function cenario() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const salao = await ctx.db.insert("locais", { nome: "Salão social", ativo: true });
    const desativado = await ctx.db.insert("locais", { nome: "Anexo velho", ativo: false });
    return { salao, desativado };
  });
  return { t, ...ids };
}

describe("local na abertura pública", () => {
  test("lista pública devolve só os locais ativos, com id e nome", async () => {
    const c = await cenario();
    // Sem identidade: é o formulário público, que não tem sessão.
    const locais = await c.t.query(api.cadastros.listarLocaisPublico, {});
    expect(locais).toEqual([{ _id: c.salao, nome: "Salão social" }]);
  });

  test("escolher da lista guarda o local e o detalhe do solicitante", async () => {
    const c = await cenario();
    const r = await c.t.mutation(api.demandas.abrirDemanda, {
      ...BASE,
      localId: c.salao,
      localTextoOriginal: "perto do palco",
    });
    await c.t.run(async (ctx) => {
      const d = await ctx.db.get(r.demandaId);
      expect(d!.localId).toBe(c.salao);
      // A precisão da fala do solicitante não se perde no dropdown.
      expect(d!.localTextoOriginal).toBe("perto do palco");
    });
  });

  test("escolher da lista sem detalhe usa o nome do local como texto", async () => {
    const c = await cenario();
    const r = await c.t.mutation(api.demandas.abrirDemanda, {
      ...BASE,
      localId: c.salao,
      localTextoOriginal: "",
    });
    await c.t.run(async (ctx) => {
      const d = await ctx.db.get(r.demandaId);
      expect(d!.localTextoOriginal).toBe("Salão social");
    });
  });

  test("sem escolher, o texto livre continua valendo e não sugere local", async () => {
    const c = await cenario();
    const r = await c.t.mutation(api.demandas.abrirDemanda, {
      ...BASE,
      localTextoOriginal: "Depósito atrás da cozinha",
    });
    await c.t.run(async (ctx) => {
      const d = await ctx.db.get(r.demandaId);
      expect(d!.localId).toBeUndefined();
      expect(d!.localTextoOriginal).toBe("Depósito atrás da cozinha");
    });
  });

  test("sem local nenhum é recusado", async () => {
    const c = await cenario();
    await expect(
      c.t.mutation(api.demandas.abrirDemanda, { ...BASE, localTextoOriginal: "   " }),
    ).rejects.toThrow(/local/i);
  });

  test("local desativado não é aceito como escolha", async () => {
    const c = await cenario();
    await expect(
      c.t.mutation(api.demandas.abrirDemanda, {
        ...BASE,
        localId: c.desativado,
        localTextoOriginal: "",
      }),
    ).rejects.toThrow(/inválido/i);
  });
});
