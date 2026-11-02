/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.{html,ejs}",
    "./public/**/*.js"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { 
        darkbg: '#0B1120', 
        cardbg: '#1E293B', 
        accent: '#06B6D4' 
      }
    },
  },
  plugins: [],
}