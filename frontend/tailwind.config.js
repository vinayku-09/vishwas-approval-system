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
        brand: {
          50: '#EFF6FF',
          600: '#1D4ED8',
          700: '#1E40AF',
        },
        ink: {
          900: '#0B1220',
          600: '#475569',
          400: '#94A3B8',
        },
        surface: '#FFFFFF',
        canvas: '#F8FAFC',
        line: '#E2E8F0',
        success: '#0B8A52',
        info: '#1E35B5',
        teal: '#0A6EA8',
        warning: '#D97706',
        danger: '#DC2626',
        accent: '#E86A17',
        // Keep existing gov colors for backward compatibility during transition
        gov: {
          blue: {
            50: '#f0f5fa',
            100: '#e1ecf5',
            200: '#c3d9eb',
            500: '#1b6ca8',
            700: '#0b4a7d',
            800: '#07365c',
            900: '#00284d',
            950: '#001933',
          },
          saffron: '#e86a17',
          gold: '#d97706',
        },
      },
      borderRadius: {
        card: '24px',
        panel: '16px',
        control: '12px',
        pill: '9999px',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(15,23,42,.06)',
        float: '0 12px 40px rgba(15,23,42,.10)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'fade-up': 'fade-up 200ms ease-out',
        'drift': 'drift 8s ease-in-out infinite',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'drift': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
