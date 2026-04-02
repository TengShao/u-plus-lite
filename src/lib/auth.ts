import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        name: { label: '姓名', type: 'text' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.name || !credentials?.password) return null
        const user = await prisma.user.findUnique({ where: { name: credentials.name } })
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null
        return { id: String(user.id), name: user.name, role: user.role, level: user.level, pipelines: user.pipelines }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.level = user.level
        token.name = user.name
        token.pipelines = user.pipelines
      }
      if (trigger === 'update' && session?.name) {
        token.name = session.name
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.name = (token.name as string) || session.user.name
      session.user.role = token.role as string
      session.user.level = token.level as string | null
      session.user.pipelines = token.pipelines as string
      return session
    },
  },
  pages: { signIn: '/login' },
}
