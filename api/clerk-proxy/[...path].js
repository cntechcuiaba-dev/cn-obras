// Proxy reverso para o Clerk (produção sem domínio próprio, ex.: *.vercel.app).
//
// O Clerk documenta que rewrites estáticos (como os do vercel.json) NÃO bastam:
// a requisição precisa chegar em https://frontend-api.clerk.dev com três headers
// que só um proxy de verdade consegue adicionar: Clerk-Proxy-Url, Clerk-Secret-Key
// e X-Forwarded-For. Por isso essa function existe — o vercel.json só reescreve
// /__clerk/* (a Proxy URL cadastrada no painel do Clerk) para /api/clerk-proxy/*,
// e é aqui que os headers extras são adicionados antes do fetch real.
export default async function handler(req, res) {
  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  const search = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const targetUrl = `https://frontend-api.clerk.dev/${pathParts.join("/")}${search}`;

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    res.status(500).send("Falta CLERK_SECRET_KEY no ambiente do servidor.");
    return;
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    if (["host", "connection", "content-length"].includes(key.toLowerCase())) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  headers.set("Clerk-Proxy-Url", `https://${req.headers.host}/__clerk`);
  headers.set("Clerk-Secret-Key", secretKey);
  headers.set("X-Forwarded-For", req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "");

  const method = req.method || "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  let body;
  if (hasBody) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }

  const upstream = await fetch(targetUrl, { method, headers, body, redirect: "manual" });

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (["content-encoding", "transfer-encoding", "content-length", "set-cookie"].includes(lower)) return;
    res.setHeader(key, value);
  });
  const setCookies =
    typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  if (setCookies.length) res.setHeader("set-cookie", setCookies);

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}
