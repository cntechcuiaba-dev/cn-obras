import { ConvexError } from "convex/values";

// Em produção o Convex esconde a mensagem de qualquer `throw new Error`
// comum (o cliente só recebe "Server Error") — só `ConvexError` atravessa.
// O backend inteiro lança ConvexError por isso; esta função é o único lugar
// que sabe extrair o texto certo, pra não repetir esse detalhe em cada tela.
export function mensagemErro(err: unknown, fallback = "Erro."): string {
  if (err instanceof ConvexError) {
    return typeof err.data === "string" ? err.data : fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
