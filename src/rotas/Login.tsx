import { SignIn, SignUp } from "@clerk/clerk-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Target, Bell, LineChart } from "lucide-react";

// Sem domínio próprio, o Account Portal hospedado do Clerk (accounts.<dominio>)
// não resolve — por isso login e cadastro ficam os dois embutidos aqui, trocando
// por estado local em vez de depender do link "Sign up" nativo do Clerk.
const aparencia = {
  variables: {
    colorPrimary: "#3D7A8C",
    colorBackground: "#FFFFFF",
    colorText: "#2B2621",
    borderRadius: "8px",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  elements: {
    footerAction: { display: "none" },
    card: "shadow-none border-0 p-0",
    rootBox: "w-full",
    cardBox: "shadow-none border-0 w-full",
    header: "hidden",
    socialButtonsBlockButton: "transition-all duration-150 hover:shadow-sm",
    formButtonPrimary: "transition-all duration-150 active:scale-[0.97]",
    // O rodapé "Secured by Clerk" fica: no plano gratuito a marca é exigida.
  },
};

const DESTAQUES = [
  {
    icone: Target,
    titulo: "Um movimento por vez",
    texto: "A tela inicial mostra a única coisa que espera por você agora.",
  },
  {
    icone: Bell,
    titulo: "O sistema cobra, você não",
    texto: "Orçamento, prazo e retorno ao solicitante deixam de depender de memória.",
  },
  {
    icone: LineChart,
    titulo: "O que quebra, quanto custa",
    texto: "Cada conclusão vira histórico de custo por local e equipamento.",
  },
];

export default function Login() {
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de marca — só aparece em telas grandes. */}
      <aside className="relative hidden overflow-hidden bg-accent-deeper px-12 py-14 text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-accent-deep/40 blur-3xl"
        />

        <div className="relative flex items-center gap-2.5">
          <img src="/pwa-192.png" alt="" className="h-9 w-9 rounded-lg" />
          <span className="font-semibold tracking-tight">Central CN Obras</span>
        </div>

        <div className="relative mt-auto max-w-md">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tightest">
            A manutenção do templo, sem depender de memória.
          </h1>
          <p className="mt-4 leading-relaxed text-white/70">
            Solicitação, triagem, execução e custo no mesmo lugar — com o sistema
            lembrando o que ninguém deveria precisar lembrar.
          </p>

          <ul className="mt-10 space-y-5">
            {DESTAQUES.map((d) => (
              <li key={d.titulo} className="flex gap-3.5">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/15">
                  <d.icone className="h-4 w-4 text-white/90" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{d.titulo}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-white/60">{d.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-auto pt-10 text-xs text-white/40">
          Ministério de Obras · CN Tech Cuiabá
        </p>
      </aside>

      {/* Coluna de autenticação. */}
      <main className="flex items-center justify-center bg-bg px-4 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <img src="/pwa-192.png" alt="" className="h-9 w-9 rounded-lg" />
            <span className="text-lg font-semibold">Central CN Obras</span>
          </div>

          <h2 className="text-2xl font-bold">
            {modo === "entrar" ? "Entrar" : "Criar sua conta"}
          </h2>
          <p className="mt-1.5 text-sm text-text-2">
            {modo === "entrar"
              ? "Acesse o painel do ministério de obras."
              : "Use o convite que a liderança enviou para o seu e-mail."}
          </p>

          <div className="card mt-6 p-6">
            {modo === "entrar" ? (
              <SignIn routing="virtual" appearance={aparencia} forceRedirectUrl="/" />
            ) : (
              <SignUp routing="virtual" appearance={aparencia} forceRedirectUrl="/" />
            )}
          </div>

          <p className="mt-5 text-center text-sm text-text-2">
            {modo === "entrar" ? (
              <>
                Não tem conta?{" "}
                <button
                  type="button"
                  className="font-medium text-accent transition-colors hover:text-accent-active hover:underline"
                  onClick={() => setModo("cadastrar")}
                >
                  Cadastre-se
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button
                  type="button"
                  className="font-medium text-accent transition-colors hover:text-accent-active hover:underline"
                  onClick={() => setModo("entrar")}
                >
                  Entrar
                </button>
              </>
            )}
          </p>

          <p className="mt-8 border-t border-border pt-5 text-center text-sm text-text-2">
            Quer abrir uma solicitação?{" "}
            <Link
              className="font-medium text-accent transition-colors hover:text-accent-active hover:underline"
              to="/nova"
            >
              Formulário público
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
