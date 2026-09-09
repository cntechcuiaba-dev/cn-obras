// Integração Clerk ↔ Convex. O applicationID deve bater com o nome do JWT template
// criado no Clerk ("convex"). O domínio vem da env do Convex CLERK_JWT_ISSUER_DOMAIN.
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
