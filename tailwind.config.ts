import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          500: "#2f6df6",
          600: "#1f5be0",
          700: "#1a4cba",
        },
      },
    },
  },
  plugins: [],
};

export default config;
