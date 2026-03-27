import 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    name: string
    role: string
    level: string | null
  }
  interface Session {
    user: {
      id: string
      name: string
      role: string
      level: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    level: string | null
  }
}
