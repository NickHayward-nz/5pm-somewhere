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
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'Poppins', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        lg: '16px',
      },
      boxShadow: {
        polaroid: '0 0 20px rgba(0, 0, 0, 0.1)',
        'glass': '0 0 20px rgba(0, 0, 0, 0.1)',
        'glow-orange': '0 0 24px rgba(249, 115, 22, 0.5)',
      },
      backgroundImage: {
        'app-gradient':
          'linear-gradient(to bottom, #3b82f6, #a855f7, #ec4899, #f97316)',
        'sunset-gradient':
          'linear-gradient(to bottom, #3b82f6, #a855f7, #ec4899, #f97316)',
      },
      backgroundSize: {
        cover: 'cover',
      },
      transitionDuration: {
        150: '150ms',
      },
    },
  },
  plugins: [],
}

