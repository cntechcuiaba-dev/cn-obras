/** @type {import('tailwindcss').Config} */
// Design system — fonte única de verdade (docs/05-prototipo-visual.md).
// Tema claro fixo: neutros quentes + azul-petróleo dessaturado.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F7F5F2",
        surface: "#FFFFFF",
        "surface-raise": "#FCFAF7",
        border: "#E4DFD8",
        "border-strong": "#D8D2C8",
        "text-2": "#6B6459",
        "text-1": "#2B2621",

        accent: {
          DEFAULT: "#3D7A8C",
          hover: "#336A7A",
          active: "#2A5866",
          subtle: "#E3EEF0",
          // Tons extras para composições (painel hero, faixas de marca).
          deep: "#1E4653",
          deeper: "#132E37",
          tint: "#F1F7F8",
        },

        // status da demanda (cor / fundo)
        "st-aberta": "#8A94A6",
        "st-aberta-bg": "#EEF1F5",
        "st-triada": "#3D7A8C",
        "st-triada-bg": "#E3EEF0",
        "st-execucao": "#C9821A",
        "st-execucao-bg": "#FBEFDC",
        "st-aguardando": "#B5643E",
        "st-aguardando-bg": "#F6E9E2",
        "st-concluida": "#4C8B5B",
        "st-concluida-bg": "#E7F2E9",
        "st-cancelada": "#9A968D",
        "st-cancelada-bg": "#F1EFEB",

        // prioridade
        "pri-alta": "#C4453A",
        "pri-alta-bg": "#FBE6E4",
        "pri-media": "#C9821A",

        // vencimento (Painel de Prazos)
        "venc-vencida": "#C4453A",
        "venc-vencendo": "#C9821A",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
      fontSize: {
        label: ["13px", { lineHeight: "16px", letterSpacing: "0.05em" }],
      },
      letterSpacing: {
        tightest: "-0.03em",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(28 24 20 / 0.04), 0 1px 3px 0 rgb(28 24 20 / 0.05)",
        "card-hover":
          "0 10px 24px -6px rgb(28 24 20 / 0.12), 0 4px 10px -3px rgb(28 24 20 / 0.06)",
        header: "0 1px 2px 0 rgb(28 24 20 / 0.03), 0 2px 10px 0 rgb(28 24 20 / 0.04)",
        popover:
          "0 14px 34px -6px rgb(28 24 20 / 0.16), 0 4px 10px -4px rgb(28 24 20 / 0.06)",
        // Elevação forte do card-assinatura (o "próximo movimento").
        hero: "0 18px 40px -12px rgb(30 70 83 / 0.22), 0 6px 14px -6px rgb(28 24 20 / 0.08)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out",
        "rise-in": "rise-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
