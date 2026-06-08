import { auth } from "@/auth"
import FAQItem from "@/components/FAQItem"
import { getViewAsRole } from "@/lib/viewas"

type PatchEntry = {
  date: string
  label?: string
  changes: string[]
}

const patchNotes: PatchEntry[] = [
  {
    date: "8 Jun 2026",
    label: "Latest",
    changes: [
      "State routing — super admins can now assign one or more salespeople to each Malaysian state; incoming leads are automatically distributed to them in round-robin order",
      "Round-robin with capacity check — if all salespeople for a state have hit their lead capacity, the lead falls into the unassigned pool instead of being force-assigned",
      "Assign to managers and team leaders — the Assign Leads page now allows leads to be assigned to managers and team leaders, not just salespeople",
      "Lead reassignment — managers and team leaders can reassign any lead in their team to a different team member directly from the lead detail page",
      "Role labels in assignment dropdowns — manager and team leader roles are now shown in brackets next to the person's name in all assignment dropdowns so you know who you're assigning to",
      "Toast notifications — success messages appear in the bottom-right corner after saving a lead, adding a note, or assigning leads, so you always know an action completed",
      "Clickable lead rows — on desktop, clicking anywhere on a lead row in the Leads table now opens the lead detail page (not just the name link)",
      "WhatsApp and Call buttons on leads list — WA and Call icon buttons now appear inline on the Leads page, both on desktop (next to the phone number) and on mobile (bottom-right of each card), so you can contact a lead without opening it first",
      "Tappable follow-up cards — the entire mobile card on the Follow-ups page is now tappable to open the lead; the WA and Call buttons still work independently",
      "Back button on lead detail — a Back button above the lead header lets you return to the previous page without using the browser back button",
      "Quick follow-up date buttons — on the lead detail page, buttons for Tomorrow, +3 days, +1 week, and +2 weeks let you set a follow-up reminder in one tap instead of opening the date picker",
      "Sidebar live badges — the Follow-ups and Available Leads sidebar links now show a live count badge so you can see at a glance how many need attention without navigating to the page",
    ],
  },
  {
    date: "19 May 2026",
    changes: [
      "TikTok lead integration — leads from TikTok Instant Form ads are automatically captured and routed the same way as Meta leads",
      "Platform badge — every lead now shows a Meta or TikTok badge so your team always knows which platform it came from",
      "Export improvements — new filters for platform, state, assignment status, team, and duplicate exclusion; live accurate lead count updates as you adjust filters",
      "Richer export CSV — now includes State, Platform, Duplicate flag, Follow-up Date, and Last Updated columns",
      "Role avatars — management roles (Super Admin, Manager) now use a square avatar and individual roles (Team Leader, Salesperson) use a circle, so roles are distinguishable by shape as well as colour",
      "Response time tracking — the CRM now records how long a salesperson takes to first contact a lead after claiming it; shown on the lead detail page, the team leads table, and the business overview leaderboard",
      "Response time backfill — leads that were already in Contacted (or later) status before tracking was introduced now correctly show their response time badge instead of 'Not yet contacted'",
      "Team Performance fix — the Team Performance section on the home dashboard now correctly shows only the salespersons in the current manager's or team leader's own team, not all users across the system",
      "Assign Leads improvements — the assign page now shows State, Platform, Ad/Campaign, age badge (colour-coded by days old), and duplicate flag for each lead; the salesperson dropdown shows new lead count alongside total so you can see workload before assigning",
      "Smarter DUP badge — duplicate leads in Assign Leads now show exactly which campaign the other lead came from, who is handling it (or 'Unassigned'), and what status it is in, so managers can make an informed decision instead of guessing",
      "Mobile layout fixes — Assign Leads mobile cards now show the age badge pinned to the top-right corner and duplicate sibling info on its own line so nothing overlaps or wraps awkwardly on small screens",
      "Team Breakdown — the Manager overview and Business Overview pages now include a Team Breakdown section showing each salesperson's claimed leads, assigned leads, total leads, won count, conversion rate, and stale count, grouped by team",
      "Leaderboard team totals fix — the Teams tab on the Business Overview leaderboard now correctly includes a manager's own leads in their team's total, not just their team members' leads",
      "Management leads in Team Breakdown — managers and team leaders who handle leads directly now appear as highlighted header rows (with a role badge) at the top of their section in the Team Breakdown; only shown when they have leads in the selected period",
      "Full org hierarchy in Business Overview — the Team Breakdown on the Business Overview page now groups salespeople by their top-level manager, with sub-sections per team leader, so the entire org structure is visible at a glance",
      "Tabbed overview pages — the Business Overview (Super Admin) and Team Overview (Manager) pages now use a tab layout to reduce clutter; Super Admin has Overview, Campaigns, Teams, and Leaderboard tabs; Manager has Overview and Teams tabs; the period selector and active tab are preserved when switching between them",
    ],
  },
  {
    date: "15 May 2026",
    changes: [
      "Ad routing — super admins can assign each ad to specific teams; salespersons only see leads from their team's assigned ads",
      "State-based lead filtering — leads are automatically tagged by state from the form answer; teams can be restricted to specific states",
      "City-to-state lookup — common Malaysian city names are automatically resolved to their state (e.g. Petaling Jaya → Selangor)",
      "Default team — unrouted or unrecognised leads are automatically directed to a designated fallback team",
    ],
  },
  {
    date: "14 May 2026",
    changes: [
      "Status history timeline — see how a lead progressed through each stage on the lead detail page",
      "Feedback page — submit bug reports or feature suggestions; managers can track and update their status",
      "Claim animation — leads fade out with a green flash after being claimed on the Available Leads page",
      "Age badges on Available Leads — colour-coded indicators showing how old each unclaimed lead is",
      "Display name fix — name changes on the Settings page now update immediately without requiring a re-login",
    ],
  },
  {
    date: "12 May 2026",
    changes: [
      "Team Leader role — a new role between Manager and Salesperson with managerial capabilities scoped to their team",
      "Inline name editing — admins can rename team members directly in Manage Team without a separate form",
      "Self name editing — all users can update their own display name from the Settings page",
      "Super Admin overview — now shows full nested team counts including team leaders and their sub-teams",
      "Push notifications — salespersons are notified when a lead is assigned to them",
      "Claim rate limit — managers can set how many leads a salesperson can claim per 15-minute window",
    ],
  },
  {
    date: "1 May 2026",
    changes: [
      "Follow-ups page — view all leads with upcoming or overdue follow-up reminders in one place",
      "Export leads — super admins can export leads to CSV with filters by status, campaign, and date range",
      "Business overview — super admin dashboard with pipeline funnel, campaign performance, and leaderboards",
      "Duplicate detection — leads with the same phone number are automatically flagged as duplicates",
    ],
  },
]

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
        a: "The Follow-ups page shows leads that need your attention — either because a follow-up date you set has passed, or because a lead hasn't been updated in more than 2 days. Check this page daily to make sure no leads go cold.",
      },
      {
        q: "What does the DUP badge on a lead mean?",
        a: "DUP means the system detected a potential duplicate — another lead in the system shares the same phone number. Review the lead carefully and coordinate with your team to avoid contacting the same person twice.\n\nOn the Assign Leads page, the DUP badge shows extra context beneath it:\n\nIf the other lead is claimed — you'll see the salesperson's name (in red), which campaign it came from, and its current status. This means someone is already working this person.\n\nIf the other lead is unassigned — you'll see 'Unassigned', the campaign, and the status. You may want to assign both to the same salesperson.\n\nUse this to decide whether to skip the duplicate, assign it to the same person already handling it, or flag it for review.",
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
        a: "Go to Assign Leads in the sidebar. You'll see all unassigned leads. Tap or click any lead to select it — you can select multiple at once. Then choose a person from the dropdown and click Assign.\n\nYou can assign to salespeople, team leaders, or managers (role shown in brackets next to their name).\n\nEach lead shows:\n\nState — which Malaysian state the lead is from, so you can match it to the right person.\n\nPlatform — Meta or TikTok badge showing where the lead came from.\n\nAd / Campaign — the specific ad that generated the lead.\n\nAge — how many days the lead has been waiting (green = fresh, amber = 2–3 days, red = 4+ days old).\n\nDUP — the lead shares a phone or email with another lead in the system.\n\nThe dropdown shows each person's new lead count (uncontacted) and total leads so you can distribute workload evenly.",
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
        a: "Each role has a distinct avatar shape and colour so you can identify them at a glance without relying on colour alone:\n\nSuper Admin — amber square avatar\n\nManager — blue square avatar\n\nTeam Leader — teal circle with a teal ring\n\nSalesperson — plain gray circle\n\nThe role badge next to the name also spells out the role in text.",
      },
      {
        q: "How do I view my team's performance?",
        a: "Your dashboard shows a summary for your team. You can also go to the Leads page to see your leads and your team's leads in separate sections — My Leads shows leads assigned directly to you, and Team Leads shows leads assigned to your salespersons.",
      },
      {
        q: "Why does the Team Performance section only show some salespersons?",
        a: "Team Performance on the home dashboard is scoped to your own team only:\n\nManager (Admin) — you see all salespersons who report directly to you, plus salespersons who report to team leaders under you.\n\nTeam Leader — you see only the salespersons who report directly to you.\n\nThis means managers from other teams will not appear in your Team Performance section, and you will not appear in theirs.",
      },
      {
        q: "Where can I see who claimed vs was assigned a lead?",
        a: "The Team Breakdown section on the Manager Overview page shows each person's Claimed count (leads they picked up from Available Leads) and Assigned count (leads pushed to them by a manager) side by side. This includes salespersons, team leaders, and the manager themselves if they have leads in the period.\n\nThis lets you quickly see who is proactively claiming leads vs who is waiting to be assigned.\n\nFor an individual lead, you can also check the status history timeline on the lead detail page — a 'Claimed' event means the person took it themselves.",
      },
    ],
  },
  {
    category: "For Super Admins",
    roles: ["SUPER_ADMIN"],
    items: [
      {
        q: "How do I export leads and what filters are available?",
        a: "Go to Export Leads under the Super Admin menu. You can narrow the export using any combination of filters:\n\nStatus — tick one or more pipeline stages (New, Contacted, Qualified, Proposal, Won, Lost).\n\nDate Range — leads created between two dates.\n\nPlatform — Meta only, TikTok only, or all platforms.\n\nAd / Source — a specific ad that generated the leads.\n\nState — a specific Malaysian state (only appears if your leads have state data).\n\nAssignment — all leads, assigned-only, or unassigned-only.\n\nTeam — export only leads handled by a specific manager's team.\n\nExclude duplicates — removes leads flagged as duplicate from the file.\n\nThe Matching leads counter updates live as you change filters so you know exactly how many rows will be in the file before downloading.\n\nThe CSV includes 14 columns: First Name, Last Name, Email, Phone, Status, Ad / Form, Campaign, State, Platform, Assigned To, Duplicate, Follow-up Date, Created Date, and Last Updated.",
      },
      {
        q: "What is the Business Overview page?",
        a: "The Business Overview page (under the Super Admin menu) gives a full picture of the business across all teams. It shows total leads, active pipeline, won deals, conversion rate, a pipeline funnel, lead sources, campaign performance, leaderboards, a Team Breakdown, and recent leads.\n\nYou can filter everything by period — Last 7 days, 30 days, 90 days, or All time.",
      },
      {
        q: "What does the Team Breakdown section show?",
        a: "The Team Breakdown section appears on both the Manager Overview and Business Overview pages. It lists every member with leads in the selected period, grouped by team, with these columns:\n\nClaimed — leads the person picked up themselves from Available Leads.\n\nAssigned — leads pushed to them by a manager.\n\nTotal — Claimed + Assigned.\n\nWon — leads closed as won.\n\nConv. — conversion rate (Won ÷ Total).\n\nStale — open leads with no activity in more than 2 days.\n\nManagers and team leaders who handle leads directly appear as a highlighted header row at the top of their section, with a role badge (Manager / Team Leader / Super Admin). They only appear if they have at least one lead in the period.\n\nOn the Business Overview page, the breakdown is organised by top-level manager, with each team leader's sub-team shown as a separate group beneath — so the full org structure is visible in one view.\n\nAll numbers are scoped to the period you have selected at the top of the page.",
      },
      {
        q: "What does the Campaign Performance table show?",
        a: "The Campaign Performance table shows each Meta ad campaign's results side by side:\n\nStatus — whether the campaign is currently Active or Paused on Meta.\n\nDaily Budget — the daily spend limit set on Meta.\n\nToday Spend — how much has been spent today, with a progress bar showing how much of the daily budget is used.\n\nPeriod Spend — total spend for the selected period.\n\nCPL (Cost Per Lead) — period spend divided by the number of leads from that campaign in the CRM.\n\nLeads / Unclaimed / Won / Conversion — CRM data for that campaign.",
      },
      {
        q: "How do I add a new team member as a Super Admin?",
        a: "Go to Manage Team and click Add Member. You can create Salesperson or Manager accounts. Salespersons can then be assigned to a manager using the Manager dropdown in their row.",
      },
      {
        q: "What is State Routing and how does it work?",
        a: "State Routing automatically assigns incoming leads to specific salespeople based on the lead's Malaysian state, without needing a manager to intervene.\n\nTo set it up, go to Ad Routing under the Super Admin menu and scroll to the State Routing section. Expand any state row and toggle on the salespeople who should receive leads from that state.\n\nWhen a lead arrives from that state, the CRM distributes it in round-robin order across all enabled salespeople — each person gets a turn before the cycle repeats.\n\nCapacity check — if a salesperson has reached their lead capacity (their claim limit), they are skipped for that round. If every assigned salesperson is at capacity, the lead falls into the unassigned pool instead.\n\nState Routing is designed for standalone salespeople who don't belong to a manager's team. Leads going to a managed team follow the existing ad routing and team coverage rules instead.",
      },
      {
        q: "What is Ad Routing and how do I set it up?",
        a: "Ad Routing controls which team handles leads from each ad. Go to Ad Routing under the Super Admin menu.\n\nDefault Team — choose which team receives leads that can't be routed (unrecognised state, no ad rule set). Set this first.\n\nTeam Coverage (States) — for each manager, expand their row and select which Malaysian states their team covers. Leads from those states will only be visible to that team.\n\nAd → Team Assignment — for each ad that has generated leads, tick which teams can claim from it. Ads with no team assigned go to the Default Team.\n\nFor nationwide ads, assign all relevant teams and set their covered states — each team will only see leads from their own states.",
      },
      {
        q: "How are leads automatically tagged with a state?",
        a: "When a lead comes in from Meta or TikTok, the system reads the state or location field from the form the customer filled in. If the answer is a city name (e.g. Petaling Jaya), it is automatically mapped to its state (e.g. Selangor).\n\nIf no state can be determined from the form, the system also tries to detect the state from the ad or campaign name as a fallback.\n\nLeads with no recognisable state go to the Default Team.",
      },
      {
        q: "How do I connect TikTok lead ads?",
        a: "The CRM has a TikTok webhook endpoint ready at /api/webhooks/tiktok. To connect it:\n\n1. Go to TikTok Business Center → your ad account → Lead Generation settings or Webhooks.\n2. Register your CRM webhook URL as the callback.\n3. Copy the webhook secret TikTok provides and add it as TIKTOK_WEBHOOK_SECRET in your Vercel environment variables.\n\nOnce connected, leads from TikTok Instant Form ads are captured automatically — with the same duplicate detection, state tagging, and ad routing as Meta leads. Each lead will show a TikTok badge so your team can see where it came from.",
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

      {/* Patch notes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">What&apos;s New</p>
        </div>
        <div className="px-5 py-4 space-y-6">
          {patchNotes.map((entry, i) => (
            <div key={entry.date} className="relative pl-5">
              {/* Timeline line */}
              {i < patchNotes.length - 1 && (
                <span className="absolute left-[5px] top-5 bottom-0 w-px bg-gray-100" />
              )}
              {/* Dot */}
              <span className={`absolute left-0 top-1 w-2.5 h-2.5 rounded-full border-2 ${i === 0 ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300"}`} />

              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-gray-700">{entry.date}</span>
                {entry.label && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-200">
                    {entry.label}
                  </span>
                )}
              </div>
              <ul className="space-y-1.5">
                {entry.changes.map((change) => (
                  <li key={change} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

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
