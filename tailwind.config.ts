import type { Config } from "tailwindcss";

/**
 * Tokens de design — LEX Licitações
 * Direção: institucional e calmo (azul profundo + dourado discreto).
 * Regra: dourado (#C9A227) é ACENTO de marca (realce, ícone em fundo escuro),
 * nunca texto sobre fundo claro (não passa contraste AA).
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Marca principal — azul institucional
        ink: {
          50: "#eef2f8",
          100: "#d5dce8",
          200: "#b8c5d6",
          300: "#8fa3bd",
          600: "#0f4a8a",
          700: "#0a3a6e",
          800: "#06305c",
          900: "#032650",
          950: "#021b39",
          DEFAULT: "#032650",
        },
        // Acento — dourado do logo (usar só sobre fundo escuro ou como forma)
        gold: {
          50: "#fbf6e6",
          400: "#d9b64a",
          500: "#C9A227",
          600: "#a8851a",
          700: "#8a6d12",
          DEFAULT: "#C9A227",
        },
      },
      fontFamily: {
        sans: ["Sora", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(3 38 80 / 0.04), 0 2px 6px -2px rgb(3 38 80 / 0.06)",
        pop: "0 12px 32px -12px rgb(3 38 80 / 0.28)",
      },
      maxWidth: {
        content: "80rem",
      },
    },
  },
  plugins: [],
};

export default config;
