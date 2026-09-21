// Tipos de marca.config.js. O arquivo fica em .js porque é carregado também
// pelo tailwind.config.js e pelo vite.config.ts, fora do build do TypeScript.
export interface Marca {
  nome: string;
  nomeCurto: string;
  descricaoCurta: string;
  rodape: string;
  accent: Record<string, string>;
}
declare const marca: Marca;
export default marca;
