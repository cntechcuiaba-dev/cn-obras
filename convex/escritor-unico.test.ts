// @vitest-environment node
import { expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Emenda 01, "Onde a trava mora":
//   "um único arquivo escreve `status`. Se qualquer outra mutation puder escrever
//    esse campo, a máquina de estados deixa de existir sem ninguém perceber."
//
// Este teste falha no dia em que alguém acrescentar um segundo escritor — que é
// exatamente o modo de falha silenciosa descrito no documento.

const DONO_DO_STATUS = "lib/estado.ts";

function arquivosTs(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === "_generated") return [];
      return arquivosTs(caminho, base);
    }
    if (!nome.endsWith(".ts") || nome.endsWith(".test.ts")) return [];
    return [caminho.slice(base.length + 1).replace(/\\/g, "/")];
  });
}

test("apenas lib/estado.ts cria demandas (o estado inicial tem um dono)", () => {
  const raiz = join(process.cwd(), "convex");
  const criadores: string[] = [];

  for (const arquivo of arquivosTs(raiz)) {
    const fonte = readFileSync(join(raiz, arquivo), "utf8");
    // toda insert em "demandas" necessariamente grava status (campo obrigatório)
    if (/ctx\.db\.insert\(\s*"demandas"/.test(fonte)) criadores.push(arquivo);
  }

  expect(criadores).toEqual([DONO_DO_STATUS]);
});

test("nenhuma function fora de lib/estado.ts faz patch de status", () => {
  const raiz = join(process.cwd(), "convex");
  const infratores: string[] = [];

  for (const arquivo of arquivosTs(raiz)) {
    if (arquivo === DONO_DO_STATUS) continue;
    const fonte = readFileSync(join(raiz, arquivo), "utf8");
    if (/ctx\.db\.patch\([^)]*status/s.test(fonte)) infratores.push(arquivo);
  }

  expect(infratores).toEqual([]);
});
