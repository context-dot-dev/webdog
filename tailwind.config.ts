import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Figtree",
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
        cream: {
          50: "#fefaf3",
          100: "#fdf6ec",
          200: "#f7ecd8",
        },
        peach: "#ffd5b5",
        mint: "#cdebd6",
        lavender: "#e7d6ff",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(10, 10, 18, 0.04)",
        card: "0 1px 2px rgba(10, 10, 18, 0.04), 0 1px 3px rgba(10, 10, 18, 0.06)",
        soft: "0 1px 0 rgba(10, 10, 18, 0.02), 0 8px 24px -16px rgba(180, 110, 50, 0.18)",
        notif: "0 0 0 1px rgba(0,0,0,.04), 0 2px 4px rgba(0,0,0,.05), 0 12px 24px rgba(0,0,0,.06)",
      },
      keyframes: {
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(-28px) scale(0.94)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "slide-in": "slideIn 0.55s cubic-bezier(0.21, 1.02, 0.73, 1) forwards",
      },
    },
  },
  plugins: [],
} satisfies Config;
