import { FormEvent, useState } from "react";
import { HardHat, Camera, CheckCircle2, Send, X } from "lucide-react";
import { useAbrir, useGerarUrlPublico } from "../lib/dados";
import { DEMO } from "../lib/env";

const VAZIO = {
  titulo: "",
  descricao: "",
  solicitanteNome: "",
  solicitanteWhatsapp: "",
  localTextoOriginal: "",
};

export default function FormularioPublico() {
  const abrir = useAbrir();
  const gerarUrl = useGerarUrlPublico();

  const [form, setForm] = useState(VAZIO);
  const [foto, setFoto] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [protocolo, setProtocolo] = useState<string | null>(null);

  function set<K extends keyof typeof VAZIO>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      let anexos: string[] | undefined;
      if (foto && !DEMO) {
        const url = await gerarUrl();
        const res = await fetch(url as string, {
          method: "POST",
          headers: { "Content-Type": foto.type },
          body: foto,
        });
        if (!res.ok) throw new Error("Falha ao enviar a foto.");
        const { storageId } = await res.json();
        anexos = [storageId];
      }
      const r = await abrir({
        ...form,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        anexosAbertura: anexos as any,
      });
      setProtocolo(r.protocolo);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar.");
    } finally {
      setEnviando(false);
    }
  }

  if (protocolo) {
    return (
      <Casca>
        <div className="card mx-auto max-w-md p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-st-concluida" />
          <h1 className="mt-4 text-xl font-bold">Solicitação recebida!</h1>
          <p className="mt-2 text-text-2">
            Guarde o número do protocolo para acompanhar com a liderança:
          </p>
          <p className="mt-3 font-mono text-2xl font-semibold tnum text-accent">
            {protocolo}
          </p>
          <button
            className="btn-ghost mt-6"
            onClick={() => {
              setForm(VAZIO);
              setFoto(null);
              setProtocolo(null);
            }}
          >
            Abrir outra solicitação
          </button>
        </div>
      </Casca>
    );
  }

  return (
    <Casca>
      <form onSubmit={enviar} className="card mx-auto max-w-md p-6">
        <h1 className="text-xl font-bold">Abrir solicitação</h1>
        <p className="mt-1 text-sm text-text-2">
          Descreva o problema de manutenção. A liderança do CN Obras vai avaliar e dar
          retorno.
        </p>

        <div className="mt-5 space-y-4">
          <Campo label="O que está acontecendo?">
            <input
              className="input"
              placeholder="Ex: Vazamento no forro do salão"
              value={form.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              required
            />
          </Campo>
          <Campo label="Detalhes">
            <textarea
              className="input min-h-[90px]"
              placeholder="Conte o que você observou"
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              required
            />
          </Campo>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Seu nome">
              <input
                className="input"
                value={form.solicitanteNome}
                onChange={(e) => set("solicitanteNome", e.target.value)}
                required
              />
            </Campo>
            <Campo label="WhatsApp (com DDD)">
              <input
                className="input"
                inputMode="numeric"
                placeholder="62 99999-9999"
                value={form.solicitanteWhatsapp}
                onChange={(e) => set("solicitanteWhatsapp", e.target.value)}
                required
              />
            </Campo>
          </div>
          <Campo label="Local">
            <input
              className="input"
              placeholder="Ex: Salão social, perto do palco"
              value={form.localTextoOriginal}
              onChange={(e) => set("localTextoOriginal", e.target.value)}
              required
            />
          </Campo>

          <div>
            <span className="label">Foto (opcional)</span>
            {foto ? (
              <div className="flex items-center justify-between rounded border border-border bg-surface-raise px-3 py-2 text-sm">
                <span className="truncate">{foto.name}</span>
                <button type="button" onClick={() => setFoto(null)}>
                  <X className="h-4 w-4 text-text-2" />
                </button>
              </div>
            ) : (
              <label className="btn-ghost w-full cursor-pointer">
                <Camera className="h-4 w-4" />
                Anexar foto
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>
        </div>

        {erro && (
          <p className="mt-4 rounded bg-pri-alta-bg px-3 py-2 text-sm text-pri-alta">
            {erro}
          </p>
        )}

        <button type="submit" className="btn-primary mt-6 w-full" disabled={enviando}>
          <Send className="h-4 w-4" />
          {enviando ? "Enviando…" : "Enviar solicitação"}
        </button>
      </form>
    </Casca>
  );
}

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg px-4 py-8">
      <div className="mx-auto mb-6 flex max-w-md items-center gap-2 text-text-1">
        <span className="grid h-8 w-8 place-items-center rounded bg-accent text-white">
          <HardHat className="h-5 w-5" />
        </span>
        <span className="font-semibold">Central CN Obras</span>
      </div>
      {children}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
