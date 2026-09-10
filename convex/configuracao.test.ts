import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// Identidade visual (white-label): leitura pública (login e formulário público
// não têm sessão), escrita só da liderança, validação no servidor.

const modules = import.meta.glob("./**/*.ts");
const LIDER = "clerk_lider";
const EXEC = "clerk_exec";

async function cenario() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("usuarios", {
      clerkId: LIDER, nome: "Ana", email: "a@cn.com", papel: "lideranca", ativo: true,
    });
    await ctx.db.insert("usuarios", {
      clerkId: EXEC, nome: "Marcos", email: "m@cn.com", papel: "executor", ativo: true,
    });
  });
  return t;
}

async function guardarImagem(t: Awaited<ReturnType<typeof cenario>>, tipo = "image/png") {
  return await t.run(async (ctx) =>
    ctx.storage.store(new Blob([new Uint8Array([1, 2, 3])], { type: tipo })),
  );
}

describe("logo do cliente", () => {
  test("sem logo enviada, a consulta pública devolve null", async () => {
    const t = await cenario();
    // Sem withIdentity: é exatamente o caso do login e do formulário público.
    const config = await t.query(api.configuracao.obter, {});
    expect(config.logoUrl).toBeNull();
  });

  test("liderança envia a logo e ela passa a ser servida publicamente", async () => {
    const t = await cenario();
    const storageId = await guardarImagem(t);

    await t.withIdentity({ subject: LIDER }).mutation(api.configuracao.definirLogo, {
      storageId,
    });

    const config = await t.query(api.configuracao.obter, {});
    expect(config.logoUrl).toBeTruthy();
  });

  test("executor não envia logo", async () => {
    const t = await cenario();
    const storageId = await guardarImagem(t);
    await expect(
      t.withIdentity({ subject: EXEC }).mutation(api.configuracao.definirLogo, { storageId }),
    ).rejects.toThrow(/permissão/i);
  });

  test("visitante sem sessão não gera URL de upload", async () => {
    const t = await cenario();
    await expect(t.mutation(api.configuracao.gerarUrlUploadLogo, {})).rejects.toThrow();
  });

  // A recusa por formato existe no servidor, mas não dá pra cobrir aqui: o
  // storage do convex-test não guarda contentType (só size/sha256). O teste de
  // tamanho cobre o mesmo comportamento que importa — recusar sem deixar órfão.
  test("imagem acima do limite é recusada e o arquivo não fica órfão", async () => {
    const t = await cenario();
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array(3 * 1024 * 1024)], { type: "image/png" })),
    );

    // Recusa vem como resultado, não exceção: mutation que lança faz rollback
    // e o arquivo recusado sobreviveria no storage.
    const r = await t
      .withIdentity({ subject: LIDER })
      .mutation(api.configuracao.definirLogo, { storageId });
    expect(r).toEqual({ ok: false, erro: expect.stringMatching(/2 MB/i) });

    await t.run(async (ctx) => {
      expect(await ctx.db.system.get(storageId)).toBeNull();
    });
    // E a configuração continua sem logo: recusa não pode virar logo quebrada.
    expect((await t.query(api.configuracao.obter, {})).logoUrl).toBeNull();
  });

  test("trocar a logo apaga a anterior do storage", async () => {
    const t = await cenario();
    const primeira = await guardarImagem(t);
    const segunda = await guardarImagem(t);
    const lider = t.withIdentity({ subject: LIDER });

    await lider.mutation(api.configuracao.definirLogo, { storageId: primeira });
    await lider.mutation(api.configuracao.definirLogo, { storageId: segunda });

    await t.run(async (ctx) => {
      expect(await ctx.db.system.get(primeira)).toBeNull();
      expect(await ctx.db.system.get(segunda)).not.toBeNull();
    });
  });

  test("remover volta para a logo padrão", async () => {
    const t = await cenario();
    const storageId = await guardarImagem(t);
    const lider = t.withIdentity({ subject: LIDER });

    await lider.mutation(api.configuracao.definirLogo, { storageId });
    await lider.mutation(api.configuracao.removerLogo, {});

    const config = await t.query(api.configuracao.obter, {});
    expect(config.logoUrl).toBeNull();
    await t.run(async (ctx) => {
      expect(await ctx.db.system.get(storageId)).toBeNull();
    });
  });
});
