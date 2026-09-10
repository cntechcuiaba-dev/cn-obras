import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// O painel só oferece "assumir liderança" quando ainda não existe nenhuma —
// caso contrário o botão aparecia pra todo executor com o painel vazio
// (inofensivo, a mutation já recusa, mas confuso: parecia que qualquer um
// podia virar liderança sozinho, quando só o admin promove).

const modules = import.meta.glob("./**/*.ts");
const EXEC = "clerk_exec";
const LIDER = "clerk_lider";

describe("existeLideranca / bootstrap", () => {
  test("sistema recém-criado: nenhuma liderança ainda", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("usuarios", {
        clerkId: EXEC, nome: "Marcos", email: "m@cn.com", papel: "executor", ativo: true,
      });
    });
    const existe = await t.withIdentity({ subject: EXEC }).query(api.usuarios.existeLideranca, {});
    expect(existe).toBe(false);
  });

  test("com liderança cadastrada, a query diz que já existe", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("usuarios", {
        clerkId: LIDER, nome: "Ana", email: "a@cn.com", papel: "lideranca", ativo: true,
      });
      await ctx.db.insert("usuarios", {
        clerkId: EXEC, nome: "Marcos", email: "m@cn.com", papel: "executor", ativo: true,
      });
    });
    const existe = await t.withIdentity({ subject: EXEC }).query(api.usuarios.existeLideranca, {});
    expect(existe).toBe(true);
  });

  test("executor convidado depois da liderança já existir não vira liderança sozinho", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("usuarios", {
        clerkId: LIDER, nome: "Ana", email: "a@cn.com", papel: "lideranca", ativo: true,
      });
      await ctx.db.insert("usuarios", {
        clerkId: EXEC, nome: "Trino", email: "t@cn.com", papel: "executor", ativo: true,
      });
    });
    const exec = t.withIdentity({ subject: EXEC });

    // A tela nem deveria oferecer o botão (existeLideranca=true), mas ainda
    // que alguém force a chamada direto, a mutation continua recusando.
    expect(await exec.query(api.usuarios.existeLideranca, {})).toBe(true);
    const r = await exec.mutation(api.usuarios.promoverPrimeiroComoLideranca, {});
    expect(r).toBe("ja_existe_lideranca");
    await t.run(async (ctx) => {
      const usuarios = await ctx.db.query("usuarios").collect();
      expect(usuarios.find((u) => u.clerkId === EXEC)?.papel).toBe("executor");
    });
  });
});
