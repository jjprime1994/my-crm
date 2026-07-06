export type PatchNote = {
  version: string
  date: string
  title: string
  items: string[]
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export const PATCH_NOTES: PatchNote[] = [
  {
    version: "1.15.0",
    date: "2026-07-06",
    title: "Website Enquiries & Platform Breakdown",
    items: [
      "Website contact form submissions now flow straight into the CRM as leads, alongside Meta and TikTok — look for the green 'Website' badge",
      "Website leads are routed by state just like Meta leads, so they land with the right team automatically",
      "Business Overview now shows a Meta / Website / TikTok breakdown so you can see at a glance where leads are coming from",
    ],
  },
  {
    version: "1.14.0",
    date: "2026-06-28",
    title: "Meta Token Alert & Blank Lead Recovery",
    items: [
      "Super admins now receive a push notification the moment incoming leads start arriving blank — no more discovering the issue days later",
      "When you get the alert 'Meta Token Broken', it means the Facebook access token has expired. To fix: log into the Nu Vending Meta Developer account → your app → Tools → Graph API Explorer → Generate Access Token (tick leads_retrieval) → copy the token → give it to your developer to update META_PAGE_ACCESS_TOKEN in Vercel",
      "After updating the token, run /api/admin/backfill-contact-fields (while logged in as Super Admin) to recover contact info for any leads that came in blank during the outage",
      "Alert is rate-limited to once per hour so you won't get spammed if many leads arrive during an outage",
    ],
  },
  {
    version: "1.13.0",
    date: "2026-06-25",
    title: "Quality of Life",
    items: [
      "Middle-click a lead to open it in a new tab — handy for working multiple leads side by side",
      "On mobile, long-press a lead card to get the browser's Open in New Tab option",
    ],
  },
  {
    version: "1.12.0",
    date: "2026-06-22",
    title: "Claim Tracking & Bug Fixes",
    items: [
      "Leads now show the date and time they were claimed — visible on the lead detail page and in the leads table",
      "Fixed: rapid or simultaneous claim attempts could push a salesperson past their daily limit (e.g. 6/5) — the limit is now enforced atomically",
    ],
  },
  {
    version: "1.11.0",
    date: "2026-06-19",
    title: "Duplicate Lead Improvements",
    items: [
      "Duplicate leads now show a DUP badge on your leads list with a tooltip explaining which original campaign triggered the flag",
      "Available leads pool also shows the DUP badge with the previous campaign — so you know before you claim",
      "Opening a duplicate lead shows a callout explaining which campaign the contact originally submitted via and who is handling it",
      "Fixed: duplicate leads were incorrectly auto-assigned via state routing — they now go straight to the available pool as intended",
      "Smarter duplicate detection: only flags as duplicate if the original lead is still active (not closed/lost) and was submitted within 30 days",
    ],
  },
  {
    version: "1.10.0",
    date: "2026-06-18",
    title: "Bug Fixes",
    items: [
      "Fixed: claim limit could be bypassed by reassigning a claimed lead to a team member — claims are now tracked permanently regardless of reassignment",
      "Fixed: CSV export was downloading as a blank file — now downloads correctly with all data",
    ],
  },
  {
    version: "1.9.0",
    date: "2026-06-18",
    title: "State Routing & Lead Pool Fix",
    items: [
      "Leads assigned via state routing (e.g. Kelantan, Melaka) now go directly to the designated person — no more leads slipping to the wrong team",
      "State-routed members now only see available leads from their own state, keeping the pool clean for everyone else",
      "Team search: you can now search by team name in Manage Team",
    ],
  },
  {
    version: "1.8.0",
    date: "2026-06-11",
    title: "Dashboard Claim Insights & What's New Page",
    items: [
      "Dashboard now shows how many salespeople have hit their daily claim limit (e.g. 2 / 5) and the percentage of the team at limit",
      "Team Performance rows now show each salesperson's daily claim progress bar and an 'At limit' badge when they've maxed out",
      "New 'What's New' page in the sidebar — shows all release notes with a badge for unread updates",
      "Help & FAQ page cleaned up — patch notes moved to the dedicated What's New page",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-06-11",
    title: "Lead Visibility & Contact Fixes",
    items: [
      "Fixed: available leads were invisible when ad routing had no default team configured",
      "WhatsApp and Call buttons now appear correctly — phone numbers from 'Whatsapp Number' form fields are captured",
      "Recovered phone numbers for 149 existing leads that were missing contact info",
      "Admin available lead count badge now shows the correct number instead of always showing 0",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-05-15",
    title: "Ad Routing & Branch Separation",
    items: [
      "Leads are now automatically routed to the correct branch based on ad/campaign",
      "Super admins can manage ad routing rules from the Routing page",
      "Branch is shown on lead cards and available leads",
    ],
  },
  {
    version: "1.5.1",
    date: "2026-05-15",
    title: "UI Polish & Animations",
    items: [
      "Pipeline bars now animate in on page load",
      "Notification bell slides in smoothly and badge pulses",
      "Overdue follow-up indicators pulse red",
      "Claim counter animates when you claim a lead",
      "Form response cards have improved styling",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-05-14",
    title: "Notifications",
    items: [
      "New notification bell for follow-up reminders and app updates",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-05-14",
    title: "Form Responses",
    items: [
      "Lead pages now show the customer's answers from the Facebook ad form",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-05-14",
    title: "Team Overview Fixes",
    items: [
      "All top-level managers (including Super Admins) now appear in Business Overview",
      "Team member count now includes the manager themselves",
      "Team Leaders no longer show as separate rows",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-05-13",
    title: "Claim Limits & Team Filters",
    items: [
      "Claim limit is now per day, resetting at midnight MYT",
      "Added 'Apply to All' to set claim limits for all members at once",
      "Manage Team now has search, role filter, manager filter, and sort",
      "Salespeople can now be assigned to Team Leaders",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-05-13",
    title: "UI Improvements",
    items: [
      "Fixed mobile layout in Manage Team — names and roles no longer overlap",
      "Preview As Role section is now collapsible",
    ],
  },
]
