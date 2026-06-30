import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  // Protect all page routes. Exclude API routes (have own auth), static files, login, and PWA assets.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon\\.ico|login|sw\\.js|manifest\\.json|icons|apple-touch-icon).*)",
  ],
}
