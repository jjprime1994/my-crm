import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  session: { strategy: "jwt" as const },
  callbacks: {
    jwt({ token, user }: Parameters<NonNullable<NextAuthConfig["callbacks"]>["jwt"]>) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
      }
      return token
    },
    session({ session, token }: Parameters<NonNullable<NextAuthConfig["callbacks"]>["session"]>) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      return session
    },
    authorized({ auth }: { auth: { user?: unknown } | null }) {
      return !!auth?.user
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig
