/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        glass: {
          surface: "rgba(15, 23, 42, 0.30)",
          border: "rgba(255, 255, 255, 0.25)",
          content: "rgba(255, 255, 255, 0.85)",
          strong: "#FFFFFF",
          hover: "rgba(255, 255, 255, 0.10)",
          selected: "rgba(255, 255, 255, 0.85)",
          "selected-content": "#334155",
          muted: "#94A3B8",
          focus: "rgba(255, 255, 255, 0.80)",
        },
        action: "#2563EB",
      },
      borderRadius: {
        glass: "20px",
      },
      boxShadow: {
        glass: "0 16px 50px rgba(15, 23, 42, 0.28)",
      },
      fontSize: {
        control: ["0.75rem", { lineHeight: "1rem", fontWeight: "600" }],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "fade-in-from-left": {
          from: { opacity: "0", transform: "translateX(-4px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "dialog-content-in": {
          from: {
            opacity: "0",
            transform: "translate(-50%, -48%) scale(0.96)",
          },
          to: {
            opacity: "1",
            transform: "translate(-50%, -50%) scale(1)",
          },
        },
        "dialog-content-out": {
          from: {
            opacity: "1",
            transform: "translate(-50%, -50%) scale(1)",
          },
          to: {
            opacity: "0",
            transform: "translate(-50%, -48%) scale(0.96)",
          },
        },
      },
      animation: {
        "fade-in": "fade-in 520ms ease-out forwards",
        "fade-in-from-left": "fade-in-from-left 150ms ease-out",
        "dialog-overlay-in": "fade-in 160ms ease-out",
        "dialog-overlay-out": "fade-out 160ms ease-in",
        "dialog-content-in": "dialog-content-in 160ms ease-out",
        "dialog-content-out": "dialog-content-out 160ms ease-in",
      },
    },
  },
  plugins: [],
};
