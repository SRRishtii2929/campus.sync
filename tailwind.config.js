/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          50: '#f3f1ff',
          100: '#e9e5ff',
          200: '#d7d0ff',
          300: '#b9adff',
          400: '#9586f5',
          500: '#7564e8',
          600: '#6250cf',
          700: '#503fae',
          800: '#40358c',
          900: '#302968',
          950: '#211c48',
        },
        cyan: {
          50: '#f5f4ff',
          100: '#ebe9ff',
          200: '#dad6ff',
          300: '#c0b9ff',
          400: '#a398ff',
          500: '#8879f0',
          600: '#7161dc',
          700: '#5d4fc0',
          800: '#4a4098',
          900: '#393375',
          950: '#272351',
        },
      },
    },
  },
  plugins: [],
};
