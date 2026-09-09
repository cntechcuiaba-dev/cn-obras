/// <reference types="node" />
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// RF: cadastro fechado (o Clerk deve estar em modo "Invite-only") — só quem é
// convidado por um email específico consegue criar conta. Este é o convite.
export const convidar = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const eu = await ctx.runQuery(api.usuarios.eu, {});
    if (!eu || eu.papel !== "lideranca" || !eu.ativo) {
      throw new Error("Sem permissão para convidar.");
    }

    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Email inválido.");
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new Error("Convites não configurados no servidor (falta CLERK_SECRET_KEY).");
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
      const msg: string | undefined = corpo?.errors?.[0]?.long_message ?? corpo?.errors?.[0]?.message;
      throw new Error(msg ?? "Falha ao enviar convite.");
    }

    return { ok: true as const };
  },
});
