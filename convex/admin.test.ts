import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// [RF21, RF26, RF27] Administração: categorias, locais, modelos de mensagem e
// usuários — só a liderança escreve, executor só lê.

const modules = import.meta.glob("./**/*.ts");
const LIDER = "clerk_lider";
const EXEC = "clerk_exec";

async function cenario() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const lider = await ctx.db.insert("usuarios", {
      clerkId: LIDER, nome: "Ana", email: "a@cn.com", papel: "lideranca", ativo: true,
    });
    const exec = await ctx.db.insert("usuarios", {
      clerkId: EXEC, nome: "Marcos", email: "m@cn.com", papel: "executor", ativo: true,
    });
    const modelo = await ctx.db.insert("modelosMensagem", {
      nome: "Em execução", tipo: "em_execucao", texto: "Olá {{solicitante}}!",
    });
    return { lider, exec, modelo };
  });
  return { t, ...ids };
}

describe("modelos de mensagem (RF21)", () => {
  test("liderança edita o texto do modelo", async () => {
    const c = await cenario();
    await c.t.withIdentity({ subject: LIDER }).mutation(api.cadastros.atualizarModelo, {
      modeloId: c.modelo,
      texto: "Olá {{solicitante}}, sua demanda está em execução!",
    });
    await c.t.run(async (ctx) => {
      const m = await ctx.db.get(c.modelo);
      expect(m!.texto).toBe("Olá {{solicitante}}, sua demanda está em execução!");
    });
  });

  test("executor não edita modelo", async () => {
    const c = await cenario();
    await expect(
      c.t.withIdentity({ subject: EXEC }).mutation(api.cadastros.atualizarModelo, {
        modeloId: c.modelo,
        texto: "x",
      }),
    ).rejects.toThrow(/permissão/i);
  });

  test("texto vazio é recusado", async () => {
    const c = await cenario();
    await expect(
      c.t.withIdentity({ subject: LIDER }).mutation(api.cadastros.atualizarModelo, {
        modeloId: c.modelo,
        texto: "   ",
      }),
    ).rejects.toThrow(/obrigatório/i);
  });
});

describe("usuários — ativar/desativar", () => {
  test("liderança desativa um executor", async () => {
    const c = await cenario();
    await c.t.withIdentity({ subject: LIDER }).mutation(api.usuarios.alternarAtivo, {
      usuarioId: c.exec,
      ativo: false,
    });
    await c.t.run(async (ctx) => {
      expect((await ctx.db.get(c.exec))!.ativo).toBe(false);
    });
  });

  test("desativado some da lista de executores para triagem", async () => {
    const c = await cenario();
    await c.t.withIdentity({ subject: LIDER }).mutation(api.usuarios.alternarAtivo, {
      usuarioId: c.exec,
      ativo: false,
    });
    const lista = await c.t
      .withIdentity({ subject: LIDER })
      .query(api.usuarios.listarExecutores, {});
    expect(lista.find((u) => u._id === c.exec)).toBeUndefined();
  });

  test("liderança não desativa a própria conta", async () => {
    const c = await cenario();
    await expect(
      c.t.withIdentity({ subject: LIDER }).mutation(api.usuarios.alternarAtivo, {
        usuarioId: c.lider,
        ativo: false,
      }),
    ).rejects.toThrow(/própria conta/i);
  });

  test("executor não altera status de ninguém", async () => {
    const c = await cenario();
    await expect(
      c.t.withIdentity({ subject: EXEC }).mutation(api.usuarios.alternarAtivo, {
        usuarioId: c.exec,
        ativo: false,
      }),
    ).rejects.toThrow(/permissão/i);
  });
});

describe("categorias e locais — leitura/escrita", () => {
  test("executor lê categorias mas não cria", async () => {
    const c = await cenario();
    await c.t.withIdentity({ subject: LIDER }).mutation(api.cadastros.criarCategoria, {
      nome: "Pintura",
    });
    const lista = await c.t
      .withIdentity({ subject: EXEC })
      .query(api.cadastros.listarCategorias, {});
    expect(lista.map((x) => x.nome)).toContain("Pintura");

    await expect(
      c.t.withIdentity({ subject: EXEC }).mutation(api.cadastros.criarCategoria, {
        nome: "Jardinagem",
      }),
    ).rejects.toThrow(/permissão/i);
  });

  test("categoria inativa some da listagem padrão mas aparece com incluirInativas", async () => {
    const c = await cenario();
    const catId = await c.t
      .withIdentity({ subject: LIDER })
      .mutation(api.cadastros.criarCategoria, { nome: "Marcenaria" });
    await c.t.withIdentity({ subject: LIDER }).mutation(api.cadastros.alternarCategoria, {
      categoriaId: catId,
      ativa: false,
    });

    const padrao = await c.t
      .withIdentity({ subject: LIDER })
      .query(api.cadastros.listarCategorias, {});
    expect(padrao.find((x) => x._id === catId)).toBeUndefined();

    const todas = await c.t
      .withIdentity({ subject: LIDER })
      .query(api.cadastros.listarCategorias, { incluirInativas: true });
    expect(todas.find((x) => x._id === catId)).toBeDefined();
  });
});
