import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#E53935",
          dark: "#C62828",
          light: "#FFEBEE"
        },
        accent: {
          DEFAULT: "#1E88E5",
          dark: "#1565C0",
          light: "#E3F2FD"
        }
      },
    },
  },
  plugins: [],
};
export default config;
