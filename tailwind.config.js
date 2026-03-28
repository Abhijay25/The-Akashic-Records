/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.tsx"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#FF7A00",
          light: "#F6B37A",
          bg: "#FFF6ED",
        }
      }
    }
  },
  plugins: [require("@tailwindcss/typography")]
}
