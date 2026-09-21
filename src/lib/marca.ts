import marca from "../../marca.config.js";

// O mesmo arquivo que alimenta o Tailwind e o PWA, agora tipado para as telas.
// Um só lugar para trocar ao revender com outro nome.
export const MARCA: {
  nome: string;
  nomeCurto: string;
  descricaoCurta: string;
  rodape: string;
  accent: Record<string, string>;
} = marca;
