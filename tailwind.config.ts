import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "sans-serif"],
      },
      colors: {
        // Tokens theme-aware (claro + escuro) via CSS variables
        bgc: "var(--bg)",
        surface: "var(--surface)",
        card: "var(--card)",
        card2: "var(--card-2)",
        hair: "var(--border)",
        hairs: "var(--border-strong)",
        fg: "var(--text)",
        muted: "var(--text-muted)",
        faint: "var(--text-faint)",
        accent: {
          DEFAULT: "var(--accent)",
          strong: "var(--accent-600)",
          deep: "var(--accent-700)",
        },
        pos: "var(--pos)",
        neg: "var(--neg)",
        warn: "var(--warn)",
        // Azuis da marca (compatibilidade)
        brand: {
          400: "#4d82ff",
          500: "#1B63F2",
          600: "#0540F2",
          700: "#0F41A6",
        },
        ink: {
          950: "#0A0C10",
          900: "#0E1117",
          850: "#161A24",
          800: "#1B1F2B",
          700: "#252A38",
        },
        offwhite: "#FFFCE6",
      },
    },
  },
  plugins: [],
};

export default config;
