/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9fe',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#3730a3',
          900: '#1e1b4b'
        }
      }
    },
  },
  plugins: [],
}
