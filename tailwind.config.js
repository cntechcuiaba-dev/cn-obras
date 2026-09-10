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
      },
      fontSize: {
        label: ["13px", { lineHeight: "16px", letterSpacing: "0.05em" }],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
        "card-hover": "0 8px 20px -4px rgb(0 0 0 / 0.10), 0 3px 8px -2px rgb(0 0 0 / 0.05)",
        header: "0 1px 2px 0 rgb(0 0 0 / 0.03), 0 2px 10px 0 rgb(0 0 0 / 0.04)",
        popover: "0 14px 34px -6px rgb(0 0 0 / 0.16), 0 4px 10px -4px rgb(0 0 0 / 0.06)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out",
        shimmer: "shimmer 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
