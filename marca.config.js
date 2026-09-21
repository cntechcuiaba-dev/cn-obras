// Identidade do cliente — o único arquivo que muda para revender o produto
// com outro nome. É lido em três lugares: tailwind.config.js (paleta),
// vite.config.ts (título da aba, ícone e nome do app instalado) e src/lib/marca.ts
// (o que aparece nas telas). Trocar aqui e rebuildar basta.
//
// A logo NÃO fica aqui: ela é enviada pela própria liderança em
// Administração > Identidade visual e vive no banco, então cada cliente
// resolve a dele sem novo deploy. Este arquivo é a parte que o build precisa.

/** @typedef {{ nome: string, nomeCurto: string, descricaoCurta: string, rodape: string, accent: Record<string, string> }} Marca */

/** @type {Marca} */
export default {
  // Nome completo: aba do navegador, tela de login e formulário público.
  nome: "Central CN Obras",
  // Nome curto: cabeçalho e ícone do app instalado (espaço apertado).
  nomeCurto: "CN Obras",
  // Uma linha sobre o produto, lida no formulário público pelo solicitante.
  descricaoCurta: "Descreva o problema de manutenção. A liderança vai avaliar e dar retorno.",
  // Assinatura no rodapé do login. Vazio remove a linha.
  rodape: "Ministério de Obras · CN Tech Cuiabá",

  // Paleta da marca. Os tons são explícitos, e não derivados de uma cor só,
  // porque contraste não sobrevive a cálculo automático: `DEFAULT`, `active` e
  // `deep` carregam texto e precisam de 4.5:1 sobre fundo claro (WCAG AA).
  // Ao trocar por outra marca, confira o contraste antes de publicar.
  accent: {
    DEFAULT: "#35707F", // botões e links
    hover: "#2E6270",
    active: "#245260", // texto sobre fundo claro
    subtle: "#E3EEF0", // fundo de item ativo
    deep: "#1E4653", // texto sobre fundo tingido
    deeper: "#132E37", // faixas escuras (coluna do login)
    tint: "#F1F7F8", // fundo tingido bem claro
  },
};
