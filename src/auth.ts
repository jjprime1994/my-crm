import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

// In-memory rate limiter: max 10 failed attempts per email per 15 minutes.
// Resets on Vercel cold starts, which is acceptable for this team size.
const failedAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000

function checkRateLimit(email: string): boolean {
  const now = Date.now()
  const entry = failedAttempts.get(email)
  if (!entry || entry.resetAt < now) return true // window expired, allow
  return entry.count < MAX_ATTEMPTS
}

function recordFailure(email: string) {
  const now = Date.now()
  const entry = failedAttempts.get(email)
  if (!entry || entry.resetAt < now) {
    failedAttempts.set(email, { count: 1, resetAt: now + WINDOW_MS })
  } else {
    entry.count++
  }
}

function clearFailures(email: string) {
  failedAttempts.delete(email)
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null
        const email = String(credentials.email).toLowerCase().trim()
        if (!checkRateLimit(email)) return null
        const user = await db.user.findUnique({
          where: { email: String(credentials.email) },
        })
        if (!user) { recordFailure(email); return null }
        const valid = await bcrypt.compare(String(credentials.password), user.password)
        if (!valid) { recordFailure(email); return null }
        clearFailures(email)
        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  session: { strategy: "jwt" },
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
  },
  pages: {
    signIn: "/login",
  },
})
