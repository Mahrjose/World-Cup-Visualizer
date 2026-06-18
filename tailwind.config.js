/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          DEFAULT: '#0B3D2E',
          dark: '#072821',
          light: '#155740',
        },
        whistle: '#C8FF4D',
        ink: '#13201C',
        cream: '#F7F5EF',
        slate: {
          muted: '#5C6B63',
          line: '#D9D5C7',
        },
      },
      fontFamily: {
        display: ['"Archivo Narrow"', '"Arial Narrow"', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
    },
  },
  plugins: [],
}
