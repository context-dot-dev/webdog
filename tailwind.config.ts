import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "InterVariable",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
      colors: {
        brand: {
          50: "#fff4ee",
          100: "#ffe6d5",
          200: "#ffc8aa",
          300: "#ffa173",
          400: "#ff7a3b",
          500: "#ff5a1f",
          600: "#f0420a",
          700: "#c7310a",
          800: "#9e2910",
          900: "#7f2511",
          950: "#451005",
        },
      },
      boxShadow: {
        xs: "0 1px 2px rgba(10, 10, 18, 0.04)",
        card: "0 1px 2px rgba(10, 10, 18, 0.04), 0 1px 3px rgba(10, 10, 18, 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
