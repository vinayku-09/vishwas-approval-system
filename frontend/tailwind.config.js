/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gov: {
          blue: {
            50: '#f0f5fa',
            100: '#e1ecf5',
            200: '#c3d9eb',
            500: '#1b6ca8',
            700: '#0b4a7d',
            800: '#07365c',
            900: '#00284d', // Deep Official Blue
            950: '#001933',
          },
          saffron: '#e86a17',
          gold: '#d97706',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
