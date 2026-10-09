/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: '#080D14',
        graphite: {
          DEFAULT: '#18232F',
          surface: '#223142',
        },
        mint: {
          DEFAULT: '#35E0B1',
          hover: '#2ccb9f',
          dim: 'rgba(53, 224, 177, 0.15)',
        },
        ice: {
          DEFAULT: '#F2F7F9',
          muted: '#A9B8C2',
        },
        warn: '#F5B544',
        danger: '#FF6B6B',
        info: '#6CB6FF',
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif'
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace'
        ]
      }
    },
  },
  plugins: [],
}
