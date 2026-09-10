import { SignIn, SignUp } from "@clerk/clerk-react";
import { useState } from "react";
import { Link } from "react-router-dom";

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
    card: "shadow-card-hover border border-border",
    socialButtonsBlockButton: "transition-all duration-150 hover:shadow-sm",
    formButtonPrimary: "transition-all duration-150 active:scale-[0.97]",
  },
};

export default function Login() {
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-6 flex items-center justify-center gap-2 text-text-1">
          <img src="/pwa-192.png" alt="CN Obras" className="h-9 w-9 rounded" />
          <span className="text-lg font-semibold">Central CN Obras</span>
        </div>

        <div className="flex justify-center">
          {modo === "entrar" ? (
            <SignIn routing="virtual" appearance={aparencia} forceRedirectUrl="/" />
          ) : (
            <SignUp routing="virtual" appearance={aparencia} forceRedirectUrl="/" />
          )}
        </div>

        <p className="mt-4 text-center text-sm text-text-2">
          {modo === "entrar" ? (
            <>
              Não tem conta?{" "}
              <button
                type="button"
                className="font-medium text-accent hover:underline"
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
                className="font-medium text-accent hover:underline"
                onClick={() => setModo("entrar")}
              >
                Entrar
              </button>
            </>
          )}
        </p>

        <p className="mt-4 text-center text-sm text-text-2">
          Quer abrir uma solicitação?{" "}
          <Link className="font-medium text-accent hover:underline" to="/nova">
            Formulário público
          </Link>
        </p>
      </div>
    </div>
  );
}
