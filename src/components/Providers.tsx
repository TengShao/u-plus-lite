'use client'
import { SessionProvider } from 'next-auth/react'
import { TipsProvider } from './Tips'
import ThemesProvider from './ThemesProvider'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TipsProvider>
        <ThemesProvider>{children}</ThemesProvider>
      </TipsProvider>
    </SessionProvider>
  )
}
