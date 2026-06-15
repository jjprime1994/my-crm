import { auth } from "@/auth"
import FAQItem from "@/components/FAQItem"
import Link from "next/link"
import { getViewAsRole } from "@/lib/viewas"

type FAQSection = {
  category: string
  roles?: string[]
  items: { q: string; a: string }[]
}

const faqs: FAQSection[] = [
  {
    category: "Getting Started",
    items: [
      {
        q: "What is the dashboard and what does it show?",
        a: "The dashboard gives you a quick overview of your performance. It shows the total leads assigned to you, how many are in each status (New, Contacted, Qualified, Proposal, Won, Lost), and any upcoming follow-ups due today.",
      },
      {
        q: "What do the different lead statuses mean?",
        a: "NEW — the lead has just been assigned and you haven't contacted them yet.\n\nCONTACTED — you've reached out to the lead at least once.\n\nQUALIFIED — the lead has shown genuine interest and is a good fit.\n\nPROPOSAL — you've sent or presented a proposal to the lead.\n\nWON — the deal has been closed successfully.\n\nLOST — the lead is no longer interested or the deal fell through.",
      },
    ],
  },
  {
    category: "Claiming & Assigning Leads",
    items: [
      {
        q: "How do I claim a lead?",
        a: "Go to Available Leads in the sidebar. You'll see a list of unassigned leads. Click the Claim button on any lead to assign it to yourself. Once claimed, the lead will appear in your Leads list.",
      },
      {
        q: "Why is the Claim button disabled?",
        a: "There are two reasons the Claim button may be disabled:\n\n1. Claim rate limit — you've reached the maximum number of leads you can claim within a 15-minute window (set by your manager). A countdown timer will show when your limit resets.\n\n2. Uncontacted leads threshold — your manager has set a maximum number of NEW (uncontacted) leads you can hold. Once you hit that limit, you must contact those leads and update their status before claiming more. You'll see an amber warning at the top of the page.",
      },
      {
        q: "How does a lead get assigned to me by a manager?",
        a: "Managers can assign leads directly to you from the Assign Leads page. When this happens, you'll receive a browser push notification (if you've enabled notifications) letting you know a new lead has been assigned to you.",
      },
    ],
  },
  {
    category: "Working with Leads",
    items: [
      {
        q: "How do I update a lead's status?",
        a: "Open the lead detail page and find the Pipeline section on the right side. Select the new status from the dropdown. You must write a note explaining the status change before you can save — this keeps a clear record of what's happening with each lead.",
      },
      {
        q: "Do I have to add a note every time I change the status?",
        a: "Yes. A note is required whenever you change a lead's status. This helps your manager and team understand the history of each lead at a glance.",
      },
      {
        q: "How do I log a contact attempt?",
        a: "On the lead detail page, use the WhatsApp, Call, or Email buttons in the contact section. Clicking any of these will automatically log a note recording the contact method and timestamp — you don't need to type anything manually.",
      },
      {
        q: "How do I set a follow-up reminder?",
        a: "Open the lead detail page and look for the Follow-up Date field in the Pipeline section. You can type a date directly, or use the quick buttons — Tomorrow, +3 days, +1 week, or +2 weeks — to set it in one tap. Save changes and the lead will appear in your Follow-ups page when the reminder is due.",
      },
      {
        q: "What does the response time badge mean on a lead?",
        a: "The response time badge shows how long it took from when you claimed the lead to when you first contacted them. It appears on the lead detail page next to the status.\n\nGreen — contacted within 1 hour (excellent)\nAmber — contacted within 1–4 hours (acceptable)\nRed — took more than 4 hours (too slow)\nGray — lead has been claimed but not contacted yet\n\nThe time is recorded automatically the moment you tap WhatsApp, Call, or Email, or when you change the status to Contacted. You don't need to do anything extra.",
      },
      {
        q: "What is the Follow-ups page?",
        a: "The Follow-ups page shows leads that need your attention — either because a follow-up date you set has passed, or because a lead hasn't been updated in more than 2 days. Check this page daily to make sure no leads go cold.\n\nFor managers, team leaders, and super admins the page is split into two sections:\n\nMy Leads — leads personally claimed or assigned to you, so you can track your own pipeline without getting lost in your team's list.\n\nMy Team's Leads (or All Team Leads for super admins) — stale or overdue leads belonging to your team members, so you can spot who needs a nudge.",
      },
      {
        q: "What does the DUP badge on a lead mean?",
        a: "DUP means another lead in the system has the same phone number. Check whether someone is already working this person before contacting them. On the Assign Leads page the badge shows who the other lead is assigned to, which campaign it came from, and its current status — use this to decide whether to assign both to the same person.",
      },
    ],
  },
  {
    category: "Notes",
    items: [
      {
        q: "How do I add a note to a lead?",
        a: "Open the lead detail page and scroll to the Notes section. Type your note in the text box and click Add Note. Notes are visible to your manager and team.",
      },
      {
        q: "Can I delete a note?",
        a: "No. Notes are permanent to maintain an accurate history of all interactions with a lead.",
      },
    ],
  },
  {
    category: "Notifications",
    items: [
      {
        q: "How do I enable browser notifications?",
        a: "Go to Settings in the sidebar. In the Notifications section, click Enable notifications. Your browser will ask for permission — click Allow. Once enabled, you'll receive a notification whenever a lead is assigned to you.",
      },
      {
        q: "Why aren't I receiving notifications?",
        a: "Make sure you clicked Enable notifications in Settings and allowed the browser permission prompt. If it shows 'Notifications blocked in browser settings', you'll need to go into your browser's site settings and manually allow notifications for this site, then try again.",
      },
      {
        q: "How do I turn off notifications?",
        a: "Go to Settings and click the Notifications on · Turn off button. This will unsubscribe your device from push notifications.",
      },
    ],
  },
  {
    category: "Account & Settings",
    items: [
      {
        q: "How do I change my password?",
        a: "Go to Settings in the sidebar and scroll to the Change Password section. Enter your current password, then your new password twice, and click Save.",
      },
      {
        q: "Who can see my leads?",
        a: "Only you and your manager (and Super Admins) can see the leads assigned to you. Leads that are unassigned are visible in the Available Leads section — but only to salespersons whose team is assigned to that ad and covers the lead's state.",
      },
    ],
  },
  {
    category: "For Managers",
    roles: ["ADMIN", "SUPER_ADMIN"],
    items: [
      {
        q: "How do I assign a lead to someone?",
        a: "Go to Assign Leads in the sidebar. Tap or click any lead to select it — you can select multiple at once. Choose a person from the dropdown and click Assign. You can assign to salespeople, team leaders, or managers (role shown in brackets next to their name). The dropdown shows each person's uncontacted and total lead count so you can distribute workload evenly.",
      },
      {
        q: "How do I reassign a lead to a different team member?",
        a: "Open the lead detail page and find the Assigned To dropdown in the Pipeline section on the right. Select a different team member and click Save changes. You can only reassign leads to people within your own team — managers see their direct reports and team leaders' salespeople; team leaders see only their direct reports.",
      },
      {
        q: "How do I set a claim limit for a salesperson?",
        a: "Go to Manage Team and find the salesperson's row. You can set two controls:\n\nClaim Limit / 15min — the maximum number of leads they can claim within any 15-minute window. Once hit, they must wait for the timer to reset.\n\nMax New Leads — if set, they cannot claim more leads until they've contacted their existing NEW leads and updated the status. Set to 0 to disable this restriction.",
      },
      {
        q: "How do I see my team's response times?",
        a: "There are two places to check:\n\nTeam Leads table — on the Leads page, each lead in the Team Leads section shows a small response time badge under the status. Green means fast, amber is acceptable, red means slow, and 'Not contacted' means the salesperson hasn't logged any contact yet.\n\nBusiness Overview leaderboard — the Individual tab now has an Avg Response column showing each salesperson's average first-contact time across all their leads. Lower is better.",
      },
      {
        q: "How do I tell roles apart in Manage Team?",
        a: "Each role has a distinct avatar shape and colour: Super Admin = amber square, Manager = blue square, Team Leader = teal circle with a ring, Salesperson = plain gray circle. The role badge next to the name also spells it out in text.",
      },
      {
        q: "How do I view my team's performance?",
        a: "Your dashboard shows a summary for your team. You can also go to the Leads page to see your leads and your team's leads in separate sections — My Leads shows leads assigned directly to you, and Team Leads shows leads assigned to your salespersons.",
      },
      {
        q: "Why does the Team Performance section only show some salespersons?",
        a: "Team Performance is scoped to your own team only. Managers see their direct reports and team leaders' salespeople. Team Leaders see only their own direct reports. Salespeople from other teams are not shown.",
      },
      {
        q: "Where can I see who claimed vs was assigned a lead?",
        a: "The Team Breakdown on the Manager Overview page shows each person's Claimed (self-picked) and Assigned (manager-pushed) counts side by side. For an individual lead, check the status history timeline on the lead detail page — a 'Claimed' event means the person took it themselves.",
      },
    ],
  },
  {
    category: "For Super Admins",
    roles: ["SUPER_ADMIN"],
    items: [
      {
        q: "How do I export leads and what filters are available?",
        a: "Go to Export Leads under the Super Admin menu. Filter by status, date range, platform, ad, state, assignment status, team, and whether to exclude duplicates. The Matching leads count updates live as you adjust filters. Click Download to get a CSV with all key lead and assignment data.",
      },
      {
        q: "What is the Business Overview page?",
        a: "The Business Overview page (under the Super Admin menu) gives a full picture of the business across all teams. It shows total leads, active pipeline, won deals, conversion rate, a pipeline funnel, lead sources, campaign performance, leaderboards, a Team Breakdown, and recent leads.\n\nYou can filter everything by period — Last 7 days, 30 days, 90 days, or All time.",
      },
      {
        q: "What does the Team Breakdown section show?",
        a: "Team Breakdown lists every team member with leads in the selected period, showing their Claimed, Assigned, Total, Won, Conversion rate, and Stale counts, grouped by team. Managers and team leaders who handle leads directly appear as a highlighted header row at the top of their section with a role badge. All numbers are scoped to the period selected at the top of the page.",
      },
      {
        q: "What does the Campaign Performance table show?",
        a: "Campaign Performance shows each Meta ad campaign side by side with its status (Active/Paused), daily budget, today's spend, period spend, cost per lead, and CRM stats (leads, unclaimed, won, conversion rate).",
      },
      {
        q: "How do I add a new team member as a Super Admin?",
        a: "Go to Manage Team and click Add Member. You can create Salesperson or Manager accounts. Salespersons can then be assigned to a manager using the Manager dropdown in their row.",
      },
      {
        q: "What is State Routing and how does it work?",
        a: "State Routing automatically assigns incoming leads to specific salespeople by state, in round-robin order, without manager intervention. Set it up in Ad Routing → State Routing: expand a state and toggle on the salespeople who should receive leads from it. If a salesperson is at capacity they are skipped; if all are at capacity the lead falls into the unassigned pool.",
      },
      {
        q: "What is Ad Routing and how do I set it up?",
        a: "Go to Ad Routing under the Super Admin menu.\n\n1. Set a Default Team — catches any lead that can't be routed by state or ad.\n2. State Routing — assign salespeople to each state for automatic round-robin assignment by location.\n3. Ad → Team Assignment — assign each ad to a manager's team. Leads from that ad go to the salesperson on that team with the fewest active leads.\n\nRouting runs in this order for every incoming lead:\nState routing → Ad routing → Default team → Unassigned pool\n\nFor bilingual campaigns (e.g. Chinese and English versions of the same ad), give each ad a distinct name in Meta Ads Manager and route them to different teams here.",
      },
      {
        q: "Can I set up ad routing before any leads have arrived?",
        a: "Yes. In the Ad → Team Assignment section, type the exact ad name from your Meta Ads Manager into the input field and click Add. The route is saved immediately — when the first lead arrives from that ad it will be routed correctly. The ad name must match exactly what appears in Meta, including capitalisation.",
      },
      {
        q: "How do I archive a stopped campaign's ad route?",
        a: "In the Ad → Team Assignment list, click the archive icon (box) next to the ad. It moves to an Archived section at the bottom and is dimmed out. The webhook will skip archived routes, so any stray leads from a stopped ad fall through to the default team instead. Click the same icon to unarchive if the campaign restarts.",
      },
      {
        q: "How are leads automatically tagged with a state?",
        a: "The system reads the state or location field from the lead form. City names (e.g. Petaling Jaya) are automatically mapped to their state (e.g. Selangor). If no state can be determined from the form, the system tries to detect a state from the campaign or ad name. If still nothing is found, state routing is skipped and ad routing takes over.",
      },
      {
        q: "What is the routing priority order?",
        a: "Every incoming lead goes through this chain until it finds a match:\n\n1. State routing — if the lead's form has a location field and that state has salespeople assigned, the lead is auto-assigned via round-robin to the first person with capacity.\n\n2. Ad routing — if state routing didn't assign anyone, the system checks if the lead's ad name matches a configured ad route. The salesperson on that team with the fewest active leads gets the lead.\n\n3. Default team — if neither matched, the lead goes to the manager marked as Default Team.\n\n4. Unassigned pool — if no default is set, the lead sits in Available Leads for anyone to claim.",
      },
    ],
  },
]

export default async function FAQPage() {
  const session = await auth()
  const role = await getViewAsRole(session?.user.role)

  const visible = faqs.filter((s) => !s.roles || s.roles.includes(role))

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Help & FAQ</h1>
        <p className="text-sm text-gray-500 mt-0.5">Answers to common questions about using the CRM</p>
      </div>

      <Link href="/patch-notes" className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 hover:bg-gray-50 transition group">
        <div>
          <p className="text-sm font-semibold text-gray-900">What&apos;s New</p>
          <p className="text-xs text-gray-400 mt-0.5">See the latest updates and improvements</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 group-hover:text-gray-500 transition">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>

      {visible.map((section) => (
        <div key={section.category} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{section.category}</p>
          </div>
          {section.items.map((item) => (
            <FAQItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      ))}
    </div>
  )
}
