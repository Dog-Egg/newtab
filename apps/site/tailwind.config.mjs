/** @type {import("tailwindcss").Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        brand: "#ff4f24",
        ink: "#151515",
        paper: "#fbfaf7",
        muted: "#77736e",
        line: "#dedbd4",
        caption: "#6e6963",
      },
    },
  },
  plugins: [],
};
