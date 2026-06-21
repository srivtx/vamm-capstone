import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Newsreader"', "Georgia", "serif"],
        sans: ['"Geist"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"Lilex"', '"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        bg: "#f7f7f5",
        surface: "#ffffff",
        "bg-2": "#f0f0ec",
        "bg-3": "#e8e8e2",
        line: "#e5e5e0",
        "line-2": "#d4d4cc",
        text: "#0c0c0e",
        "text-2": "#52525b",
        "text-3": "#9ca3af",
        violet: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        positive: "#10b981",
        negative: "#f43f5e",
        warn: "#f59e0b",
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "1.4" }],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
    },
  },
  plugins: [],
};

export default config;
