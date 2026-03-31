'use client'
import { SessionProvider } from 'next-auth/react'
import { TipsProvider } from './Tips'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TipsProvider>{children}</TipsProvider>
    </SessionProvider>
  )
}
