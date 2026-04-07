import type { Config } from 'tailwindcss'

const config: Config = {
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
      },
    },
  },
  plugins: [],
}
export default config
