/// <reference types="node" />
import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api } from "./_generated/api";

// RF: cadastro fechado (o Clerk deve estar em modo "Invite-only") — só quem é
// convidado por um email específico consegue criar conta. Este é o convite.
export const convidar = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const eu = await ctx.runQuery(api.usuarios.eu, {});
    if (!eu || eu.papel !== "lideranca" || !eu.ativo) {
      throw new ConvexError("Sem permissão para convidar.");
    }

    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ConvexError("Email inválido.");
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new ConvexError("Convites não configurados no servidor (falta CLERK_SECRET_KEY).");
    }

    const res = await fetch("https://api.clerk.com/v1/invitations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email_address: email, notify: true }),
    });

    if (!res.ok) {
      const corpo = await res.json().catch(() => null);
      const codigo: string | undefined = corpo?.errors?.[0]?.code;
      const msg: string | undefined = corpo?.errors?.[0]?.long_message ?? corpo?.errors?.[0]?.message;

      // Erros lançados numa action chegam ao cliente como mensagem genérica
      // ("Server Error"), a menos que sejam ConvexError — por isso o throw
      // muda aqui (o resto do arquivo pode continuar usando Error comum).
      //
      // O Clerk responde em inglês e para desenvolvedor ("That email address
      // is taken"), mas quem lê isto é a liderança do ministério, no meio de
      // uma tarefa. Os casos que acontecem de verdade viram instrução.
      const TRADUZIDOS: Record<string, string> = {
        form_identifier_exists:
          "Esse e-mail já tem conta no sistema. Não precisa de convite: " +
          "peça para a pessoa entrar pelo endereço do app usando este mesmo " +
          "e-mail. Se ela aparecer aqui na lista depois de entrar, você " +
          "promove o acesso.",
        duplicate_record:
          "Já existe um convite pendente para esse e-mail. Peça para a " +
          "pessoa procurar a mensagem na caixa de entrada e no spam.",
        form_param_format_invalid: "E-mail inválido.",
      };
      if (codigo && TRADUZIDOS[codigo]) {
        throw new ConvexError(TRADUZIDOS[codigo]);
      }
      throw new ConvexError(msg ?? "Falha ao enviar convite.");
    }

    return { ok: true as const };
  },
});
