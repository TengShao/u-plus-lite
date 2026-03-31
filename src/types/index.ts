import 'next-auth'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    name: string
    role: string
    level: string | null
    pipelines: string
    lastUsedPipeline?: string | null
  }
  interface Session {
    user: DefaultSession['user'] & {
      id: string
      name: string
      role: string
      level: string | null
      pipelines: string
      lastUsedPipeline: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    level: string | null
    pipelines: string
    lastUsedPipeline?: string | null
  }
}
