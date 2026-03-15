/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        surface: '#111111',
        'surface-raised': '#1a1a1a',
        'accent-blue': '#3b82f6',
        'accent-green': '#22c55e',
        'accent-amber': '#f59e0b',
        'accent-red': '#ef4444',
        'text-secondary': '#888888',
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
