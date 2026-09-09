import { ReactNode, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import {
  Authenticated,
  Unauthenticated,
  AuthLoading,
  useQuery,
  useMutation,
} from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { api } from "../convex/_generated/api";
import { DEMO } from "./lib/env";
import { useDemo } from "./demo/DemoProvider";
import { Shell } from "./components/Shell";
import { Carregando } from "./components/ui";
import { Papel, UsuarioAtual } from "./lib/auth-types";
import FormularioPublico from "./rotas/FormularioPublico";
import Login from "./rotas/Login";
import PainelPrazos from "./rotas/PainelPrazos";
import Triagem from "./rotas/Triagem";
import MinhasDemandas from "./rotas/MinhasDemandas";
import DetalheDemanda from "./rotas/DetalheDemanda";
import Recorrencias from "./rotas/Recorrencias";
import Inteligencia from "./rotas/Inteligencia";

function TelaCheia({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4">{children}</div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/nova" element={<FormularioPublico />} />
      <Route path="/*" element={DEMO ? <AreaDemo /> : <AreaInterna />} />
    </Routes>
  );
}

// Rotas por papel — compartilhadas entre modo real e demo.
function RotasApp({ papel }: { papel: Papel }) {
  return (
    <Routes>
      {papel === "lideranca" ? (
        <>
          <Route path="/" element={<PainelPrazos />} />
          <Route path="/triagem" element={<Triagem />} />
          <Route path="/recorrencias" element={<Recorrencias />} />
          <Route path="/inteligencia" element={<Inteligencia />} />
        </>
      ) : (
        <Route path="/" element={<MinhasDemandas />} />
      )}
      <Route path="/demanda/:id" element={<DetalheDemanda />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ---------------- Modo demo ----------------

function AreaDemo() {
  const { papel } = useDemo();
  return (
    <Shell papel={papel} nome={papel === "lideranca" ? "Ana (liderança)" : "Marcos Silva"}>
      <BannerDemo />
      <RotasApp papel={papel} />
    </Shell>
  );
}

function BannerDemo() {
  const { papel, setPapel } = useDemo();
  const navigate = useNavigate();
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-accent/40 bg-accent-subtle px-4 py-2.5 text-sm">
      <span className="font-semibold text-accent-active">Modo demonstração</span>
      <span className="text-text-2">dados fake, sem backend</span>
      <div className="ml-auto flex items-center gap-1 rounded-full bg-surface p-1">
        {(["lideranca", "executor"] as Papel[]).map((p) => (
          <button
            key={p}
            onClick={() => {
              setPapel(p);
              navigate("/");
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              papel === p ? "bg-accent text-white" : "text-text-2 hover:text-text-1"
            }`}
          >
            {p === "lideranca" ? "Liderança" : "Executor"}
          </button>
        ))}
      </div>
      <a href="/nova" className="text-xs font-medium text-accent hover:underline">
        Formulário público →
      </a>
    </div>
  );
}

// ---------------- Modo real (Convex + Clerk) ----------------

function AreaInterna() {
  return (
    <>
      <AuthLoading>
        <TelaCheia>
          <Carregando label="Entrando…" />
        </TelaCheia>
      </AuthLoading>
      <Unauthenticated>
        <Login />
      </Unauthenticated>
      <Authenticated>
        <AppAutenticado />
      </Authenticated>
    </>
  );
}

function AppAutenticado() {
  const { user } = useUser();
  const garantirUsuario = useMutation(api.usuarios.garantirUsuario);
  const eu = useQuery(api.usuarios.eu) as UsuarioAtual | null | undefined;

  useEffect(() => {
    if (user && eu === null) {
      void garantirUsuario({
        nome: user.fullName ?? "",
        email: user.primaryEmailAddress?.emailAddress ?? "",
      });
    }
  }, [user, eu, garantirUsuario]);

  if (eu === undefined)
    return (
      <TelaCheia>
        <Carregando />
      </TelaCheia>
    );
  if (eu === null)
    return (
      <TelaCheia>
        <Carregando label="Preparando sua conta…" />
      </TelaCheia>
    );

  return (
    <Shell papel={eu.papel} nome={eu.nome}>
      <RotasApp papel={eu.papel} />
    </Shell>
  );
}
