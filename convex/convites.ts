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
      if (codigo === "feature_requires_custom_domain") {
        throw new ConvexError(
          "Convites exigem domínio próprio no Clerk — o app roda hoje em " +
            "*.vercel.app, que não é aceito para essa API. Configure um " +
            "domínio personalizado no Clerk (Configure → Domínios) para " +
            "habilitar. Enquanto isso, crie a conta manualmente no Clerk " +
            "Dashboard → Users → Create user.",
        );
      }
      throw new ConvexError(msg ?? "Falha ao enviar convite.");
    }

    return { ok: true as const };
  },
});
