import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "sans-serif"],
      },
      colors: {
        // Azuis da marca
        brand: {
          400: "#4d82ff",
          500: "#1B63F2", // High Blue (ação principal)
          600: "#0540F2", // Blue Microsonic (hover/realce)
          700: "#0F41A6", // Royal Blue
        },
        // Escala escura (petróleo / preto)
        ink: {
          950: "#0A0C10",
          900: "#0E1117",
          850: "#161A24",
          800: "#1B1F2B", // Petroleum blue
          700: "#252A38",
        },
        offwhite: "#FFFCE6",
      },
    },
  },
  plugins: [],
};

export default config;
