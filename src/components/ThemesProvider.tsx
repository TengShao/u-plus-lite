'use client'
import { ThemeProvider } from 'next-themes'

export default function ThemesProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  )
}
