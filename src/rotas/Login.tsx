import { SignIn } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { HardHat } from "lucide-react";

export default function Login() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-text-1">
          <span className="grid h-9 w-9 place-items-center rounded bg-accent text-white">
            <HardHat className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold">Central CN Obras</span>
        </div>

        <div className="flex justify-center">
          <SignIn
            routing="virtual"
            appearance={{
              variables: {
                colorPrimary: "#3D7A8C",
                colorBackground: "#FFFFFF",
                colorText: "#2B2621",
                borderRadius: "8px",
                fontFamily: "Inter, system-ui, sans-serif",
              },
            }}
          />
        </div>

        <p className="mt-6 text-center text-sm text-text-2">
          Quer abrir uma solicitação?{" "}
          <Link className="font-medium text-accent hover:underline" to="/nova">
            Formulário público
          </Link>
        </p>
      </div>
    </div>
  );
}
