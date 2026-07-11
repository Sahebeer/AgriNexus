import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Sophisticated Apple/Linear inspired neutral palette
        neutral: {
          950: "#090A0B",
          900: "#121417",
          850: "#1A1D21",
          800: "#22272E",
          700: "#2D343F",
          600: "#485264",
          400: "#808E9D",
          200: "#D3D9E2",
          100: "#E9ECF0",
          50: "#F5F7FA",
        },
        // Forest / Jade agricultural theme colors
        primary: {
          DEFAULT: "#00C875", // Crisp vibrant jade
          50: "#E6FAF1",
          100: "#C0F4DA",
          200: "#96ECC0",
          300: "#69E4A5",
          400: "#3CDA8B",
          500: "#00C875",
          600: "#00A65F",
          700: "#00834B",
          800: "#006137",
          900: "#004024",
        },
        accent: {
          blue: "#3b82f6",
          amber: "#f59e0b",
          rose: "#ef4444",
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["Outfit", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "pulse-slow": "pulseSlow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
