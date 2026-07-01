import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  session: { strategy: "jwt" as const },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      return session
    },
    authorized({ auth }) {
      return !!auth?.user
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig
