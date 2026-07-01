import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { isSuperAdmin } from "@/lib/roles"

const META_APP_ID = "1885550582151425"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role))
    return new NextResponse("Forbidden", { status: 403 })

  const appSecret = process.env.META_APP_SECRET
  if (!appSecret)
    return NextResponse.json({ error: "META_APP_SECRET not set in Vercel" }, { status: 500 })

  const { shortLivedToken } = await req.json()
  if (!shortLivedToken)
    return NextResponse.json({ error: "shortLivedToken is required" }, { status: 400 })

  // Step 1: exchange short-lived user token → long-lived user token (60 days)
  const exchangeRes = await fetch(
    `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token` +
    `&client_id=${META_APP_ID}&client_secret=${appSecret}` +
    `&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`
  )
  const exchangeData = await exchangeRes.json()
  if (exchangeData.error)
    return NextResponse.json({ error: `Exchange failed: ${exchangeData.error.message}` }, { status: 400 })

  const longLivedToken = exchangeData.access_token

  // Step 2: get all pages for this user — page tokens from long-lived user tokens are permanent
  const accountsRes = await fetch(
    `https://graph.facebook.com/me/accounts?access_token=${longLivedToken}`
  )
  const accountsData = await accountsRes.json()
  if (accountsData.error)
    return NextResponse.json({ error: `Accounts fetch failed: ${accountsData.error.message}` }, { status: 400 })

  const pages: { id: string; name: string; access_token: string }[] = accountsData.data ?? []
  if (pages.length === 0)
    return NextResponse.json({
      error: "No Facebook pages found. Re-generate your token in Graph API Explorer with the 'pages_show_list' and 'pages_read_engagement' permissions checked, then try again.",
    }, { status: 400 })

  const nuvendingPage =
    pages.find((p) => p.name.toLowerCase().includes("nu vending") || p.name.toLowerCase().includes("nuvending")) ??
    pages[0]

  return NextResponse.json({
    permanentToken: nuvendingPage.access_token,
    pageId: nuvendingPage.id,
    pageName: nuvendingPage.name,
    allPages: pages.map((p) => ({ id: p.id, name: p.name })),
  })
}
