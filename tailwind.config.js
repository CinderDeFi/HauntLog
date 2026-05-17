/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        haunt: {
          red: "#E24B4A",
          dark: "#111111",
          ghost: "#E5E5E5",
        },
      },
    },
  },
  plugins: [],
}
