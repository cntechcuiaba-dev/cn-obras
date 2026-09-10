import { useLogo } from "../lib/dados";

// Logo do cliente (white-label). Enquanto ninguém enviar uma, usa a padrão do
// app — nunca fica buraco na tela. Um só componente para que trocar a marca
// não vire caça a <img> espalhado por rota.
export const LOGO_PADRAO = "/pwa-192.png";

export function Logo({
  className = "h-8 w-8",
  alt = "",
}: {
  className?: string;
  alt?: string;
}) {
  const logoUrl = useLogo();
  return (
    <img
      src={logoUrl ?? LOGO_PADRAO}
      alt={alt}
      className={`rounded-lg object-contain ${className}`}
    />
  );
}
