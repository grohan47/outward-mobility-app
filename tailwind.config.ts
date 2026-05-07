import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#11d432",
        "primary-dark": "#14b84b",
        "background-light": "#f6f8f6",
        "background-dark": "#102213",
      },
      fontFamily: {
        display: ["Public Sans", "sans-serif"],
        body: ["Public Sans", "sans-serif"],
        student: ["Lexend", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
