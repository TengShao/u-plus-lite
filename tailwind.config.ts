import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#79B714',
          dark: '#669618',
          light: '#8eca2e27',
          hover: 'rgba(142,202,46,0.15)',
          tint: '#8ECA2E2F',
        },
        // Semantic color tokens
        'bg-page': 'var(--u-bg-page)',
        'bg-panel': 'var(--u-bg-panel)',
        'bg-subtle': 'var(--u-bg-subtle)',
        'text-primary': 'var(--u-text-primary)',
        'text-secondary': 'var(--u-text-secondary)',
        'text-muted': 'var(--u-text-muted)',
        'border-default': 'var(--u-border)',
        'border-strong': 'var(--u-border-strong)',
        'success': 'var(--u-success)',
        'warning': 'var(--u-warning)',
        'danger': 'var(--u-danger)',
      },
    },
  },
  plugins: [],
}
export default config
