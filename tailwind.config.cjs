/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        sunset: {
          50: '#fff4ec',
          100: '#ffe0c2',
          200: '#ffc08a',
          300: '#ff9a62',
          400: '#ff7b4b',
          500: '#ff5a3a',
          600: '#e14032',
          700: '#b6292d',
          800: '#7a1824',
          900: '#460d19',
        },
        midnight: {
          900: '#050716',
          800: '#090b1e',
          700: '#13152b',
        },
      },
      fontFamily: {
        display: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        polaroid: '0 24px 60px rgba(0, 0, 0, 0.65)',
        'glow-gold': '0 0 40px rgba(255, 204, 128, 0.55)',
      },
      backgroundImage: {
        'sunset-gradient':
          'radial-gradient(circle at 0% 0%, #ffd966 0, #ffb347 25%, transparent 52%), radial-gradient(circle at 100% 0%, #ff6b35 0, #e85d04 30%, transparent 55%), radial-gradient(circle at 50% 85%, #4c1d95 0, #312e81 25%, #1e1b4b 50%, #0f0a1e 70%)',
      },
      backgroundColor: {
        'sunset-bg': '#030410',
      },
    },
  },
  plugins: [],
}

