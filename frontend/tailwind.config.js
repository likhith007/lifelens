/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Instrument Serif", "Georgia", "serif"],
      },
      colors: {
        surface: {
          DEFAULT: "#F7F6F3",
          elevated: "#FFFFFF",
          muted: "#EFEDE8",
        },
        ink: {
          DEFAULT: "#1C1C1C",
          secondary: "#5C5C5C",
          muted: "#8A8A8A",
          faint: "#B5B5B5",
        },
        line: {
          DEFAULT: "#E5E2DC",
          strong: "#D4D0C8",
        },
        accent: {
          DEFAULT: "#2D4A3E",
          hover: "#243D33",
          light: "#E8F0ED",
          muted: "#C5D9D0",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(28, 28, 28, 0.04), 0 4px 16px rgba(28, 28, 28, 0.06)",
        card: "0 1px 3px rgba(28, 28, 28, 0.05), 0 8px 24px rgba(28, 28, 28, 0.04)",
        float: "0 4px 24px rgba(28, 28, 28, 0.08)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
