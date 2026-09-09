import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { convex } from "./lib/convex";
import { DEMO } from "./lib/env";
import { DemoProvider } from "./demo/DemoProvider";
import App from "./App";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (DEMO) {
  // Sem backend: roda com dados fake.
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <DemoProvider>
          <App />
        </DemoProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
} else {
  const chaveClerk = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
  if (!chaveClerk) throw new Error("Falta VITE_CLERK_PUBLISHABLE_KEY no .env.local.");
  if (!convex) throw new Error("Falta VITE_CONVEX_URL no .env.local.");

  root.render(
    <React.StrictMode>
      <ClerkProvider publishableKey={chaveClerk}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </React.StrictMode>,
  );
}
