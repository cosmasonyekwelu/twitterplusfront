/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        x: {
          blue: "#1d9bf0",
          gray: "#71767b",
          light: "#e7e9ea",
          dark: "#171717",
        }
      }
    },
  },
  plugins: []
}
