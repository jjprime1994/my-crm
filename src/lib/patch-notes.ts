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
    version: "1.31.0",
    date: "2026-08-19",
    title: "Auto-Lost Cron Fixed",
    items: [
      "Fixed: the 30-day auto-close-unclaimed-leads cron never closed anything, because a one-time state correction on 4 Aug had reset the \"last touched\" clock on ~100 unclaimed leads without anyone actually engaging with them. It now goes by how long a lead has been unclaimed since it arrived, not that clock — about 99 leads that have genuinely been sitting untouched will close as Lost on tonight's run",
    ],
  },
  {
    version: "1.30.0",
    date: "2026-08-19",
    title: "Team Breakdown Sorting Fixed for Real This Time",
    items: [
      "Fixed: clicking a column to sort one team's table was re-sorting every team on the page at once, including ones scrolled out of view — that's what still felt like a jump after the first fix. Sorting is now scoped to the team you clicked in and no longer touches the others",
    ],
  },
  {
    version: "1.29.0",
    date: "2026-08-18",
    title: "Sortable & Filterable Team Breakdown",
    items: [
      "Team Breakdown and Funnel tables (Business Overview and Team Overview) now have clickable column headers — click any column (Total, stage counts, Conv., Avg Response, Not Contacted, Stale, etc.) to sort by it, click again to reverse",
      "New search box filters the table down to a name as you type",
      "New \"Needs attention\" toggle shows only people with stale or not-contacted leads",
      "Fixed: sorting or filtering while scrolled down used to feel like the page randomly jumped — the row you were looking at now stays in view",
    ],
  },
  {
    version: "1.28.0",
    date: "2026-08-18",
    title: "Your Own Avg Response on the Dashboard",
    items: [
      "Everyone's Dashboard now has a \"My Avg Response\" card showing your own average response time as a star rating — previously this was only visible to Super Admins and Managers looking at team reports, so salespeople had no way to see or improve their own number",
    ],
  },
  {
    version: "1.27.0",
    date: "2026-08-18",
    title: "Preview As a Real Person",
    items: [
      "\"Preview as\" now impersonates a specific real team member instead of just simulating a role — search by name in the sidebar (grouped by Manager/Team Leader/Salesperson) and every page shows that person's actual leads, team, and claim limits",
      "Fixes the old version showing an empty dashboard while previewing, since it was scoped to the super admin's own (usually empty) leads regardless of which role was selected",
      "The preview banner now names who you're previewing, e.g. \"Previewing as Ken Lee (Manager)\"",
    ],
  },
  {
    version: "1.26.0",
    date: "2026-08-18",
    title: "Response Time Now Business-Hours Aware",
    items: [
      "Average Response Time (stars and the raw time) no longer counts overnight hours — a lead claimed at 1am and contacted at 9am now reads as instant, not 8 hours late",
      "Business hours are 9am–11pm every day; only the portion of the claim-to-contact gap that falls inside that window counts toward the average",
    ],
  },
  {
    version: "1.25.0",
    date: "2026-08-18",
    title: "Avg Response as Star Ratings",
    items: [
      "Average Response Time now shows as a 5-star rating (with the exact time still underneath) everywhere it appears — Team Breakdown, the Funnel tab, and the Leaderboard's Fastest Response tab",
      "★★★★★ under 15 min · ★★★★ 15 min–1 hr · ★★★ 1–4 hr · ★★ 4–24 hr · ★ over 24 hr — weighted toward the first few minutes, since that's where response speed matters most for conversion",
    ],
  },
  {
    version: "1.24.0",
    date: "2026-08-18",
    title: "Simplified Pipeline: Qualified Removed",
    items: [
      "The pipeline is now New → Contacted → Appointment Made → Won/Lost — the Qualified stage was removed everywhere it was selectable (lead status dropdown, Leads filters, Export filters)",
      "Every lead that was sitting at Qualified was reclassified to Contacted, with a note logged on each lead explaining why",
      "Older leads that passed through Qualified before this change keep that step in their Status History timeline — nothing historical was rewritten, only hidden from the active pipeline going forward",
    ],
  },
  {
    version: "1.23.0",
    date: "2026-08-18",
    title: "Auto-Advance New Leads on WhatsApp/Call",
    items: [
      "Clicking WhatsApp or Call on a brand-new lead now automatically moves its status from New to Contacted — reaching out is a real contact attempt, so it no longer sits miscounted as 'not contacted' after you've actually contacted them",
      "Applies everywhere those buttons appear: the lead detail page, the Leads table, and Follow-ups",
      "Email is left alone since it's easy to send without any real engagement",
    ],
  },
  {
    version: "1.22.0",
    date: "2026-08-18",
    title: "Funnel Visual, Manager Parity & Auto-Close Stale Leads",
    items: [
      "The Funnel tab now shows an actual funnel chart — narrowing bars for New → Contacted → Qualified → Appointment Made with a stage-to-stage retention % on each connector, plus Won/Lost as separate outcome badges",
      "Managers and Team Leaders now have their own Funnel tab on Team Overview, scoped to their team, matching what Super Admins see on Business Overview",
      "Leads that sit unclaimed (nobody has claimed them) and untouched for 30+ days are now automatically marked Lost overnight, with a note logged on the lead explaining why — keeps the available pool from filling up with dead leads",
    ],
  },
  {
    version: "1.21.0",
    date: "2026-08-18",
    title: "Funnel Tab",
    items: [
      "New 'Funnel' tab on Business Overview, next to Teams — counts a lead under every stage it ever reached (e.g. Appointment Made), even if it was later marked Lost",
      "The existing Teams tab only shows a lead's current stage, so a won or lost lead disappears from earlier stages there — Funnel answers 'how many appointments did we actually get' regardless of outcome",
    ],
  },
  {
    version: "1.20.0",
    date: "2026-08-17",
    title: "Appointment Made Rename & Stage Breakdowns",
    items: [
      "Renamed the 'Proposal' pipeline stage to 'Appointment Made' everywhere it appears — status filters, dashboards, exports, and the FAQ",
      "Business Overview's Teams tab and the Team Report CSV export now show each person's lead count per stage (New, Contacted, Qualified, Appointment Made, Won, Lost), not just claimed/won",
      "Fixed the Lead Sources widget on Business Overview silently capping at the top 10 campaigns — all campaigns now show",
      "Added a tooltip on the Stale column explaining it means a lead hasn't been updated in more than 48 hours",
      "Widened the Leads, Follow-ups, Assign Leads, Manage Team, Available Leads, and Team Breakdown pages so their tables no longer scroll unnecessarily on larger screens",
    ],
  },
  {
    version: "1.19.0",
    date: "2026-08-10",
    title: "Team Reports & Leaderboard Upgrades",
    items: [
      "Business Overview's Teams tab now shows each person's average response time and how many of their claimed leads haven't been contacted yet, alongside claimed/won/conversion",
      "New 'Filter by team' control on the Teams tab — check any combination of teams to narrow the breakdown, then export just those teams to CSV",
      "Team filtering is now instant — checking a team no longer reloads the page",
      "Managers and Team Leaders now see the same average response time and not-contacted numbers on their own Team Overview page, plus the instant team filter (CSV export remains Super Admin-only)",
    ],
  },
  {
    version: "1.18.0",
    date: "2026-08-05",
    title: "Team Leaders & Managers in Lead Filters",
    items: [
      "The 'All salespeople' filter on the Leads page now includes Team Leaders and Managers, not just Salespeople, so you can filter down to leads assigned to them too",
    ],
  },
  {
    version: "1.17.0",
    date: "2026-08-04",
    title: "Smarter Release-to-Pool & Custom Date Ranges",
    items: [
      "Releasing a corrected-state lead now checks whether anyone on the ad's originally assigned team can actually claim it — if that team has nobody covering the corrected state, the lead automatically falls back to the general pool for that state instead of getting stuck",
      "One-time cleanup: fixed 194 leads that were stuck unclaimed by the same 'team covers the state on paper but has nobody staffed' gap — they're now visible in the right people's Available Leads",
      "Business Overview now has a custom date-to-date range picker alongside the 7d/30d/90d/All time presets — applies across every tab and both CSV exports",
      "Campaign Performance now shows the full pipeline breakdown per campaign (New, Contacted, Qualified, Proposal, Won, Lost) instead of just Won/Lost",
    ],
  },
  {
    version: "1.16.0",
    date: "2026-08-03",
    title: "Fix & Release Blank-State Leads",
    items: [
      "Leads that came in with no state (the ad's form didn't ask for it) can now be corrected right from the lead page — pick the state the customer confirmed, then hit 'Verify state & release to that team' to send it back to the pool for the right state team to claim",
      "Available both to the salesperson working the lead and to managers/team leaders reviewing it — no need to go through an admin to reroute a blank-state lead",
      "Only shows up for leads that came in genuinely blank — leads that already had a state aren't affected",
    ],
  },
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
