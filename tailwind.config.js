/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [// 🌟 添加这行插件，它是让 Markdown 自动排版变好看的核武器
    require('@tailwindcss/typography'), 
  ],
}