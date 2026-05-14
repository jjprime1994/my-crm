import { auth } from "@/auth"
import FAQItem from "@/components/FAQItem"

type PatchEntry = {
  date: string
  label?: string
  changes: string[]
}

const patchNotes: PatchEntry[] = [
  {
    date: "14 May 2026",
    label: "Latest",
    changes: [
      "Status history timeline — see how a lead progressed through each stage on the lead detail page",
      "Feedback page — submit bug reports or feature suggestions; managers can track and update their status",
      "Claim animation — leads fade out with a green flash after being claimed on the Available Leads page",
      "Age badges on Available Leads — colour-coded indicators showing how old each unclaimed lead is",
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
        a: "Open the lead detail page and look for the Follow-up Date field in the Pipeline section. Pick a date and time, then save. The lead will appear in your Follow-ups page when the reminder is due.",
      },
      {
        q: "What is the Follow-ups page?",
        a: "The Follow-ups page shows leads that need your attention — either because a follow-up date you set has passed, or because a lead hasn't been updated in more than 2 days. Check this page daily to make sure no leads go cold.",
      },
      {
        q: "What does the DUP badge on a lead mean?",
        a: "DUP means the system detected a potential duplicate — another lead in the system shares the same phone number or email address. Review the lead carefully and coordinate with your team to avoid contacting the same person twice.",
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
        a: "Only you and your manager (and Super Admins) can see the leads assigned to you. Leads that are unassigned are visible to all salespersons in the Available Leads section.",
      },
    ],
  },
  {
    category: "For Managers",
    roles: ["ADMIN", "SUPER_ADMIN"],
    items: [
      {
        q: "How do I assign a lead to a salesperson?",
        a: "Go to Assign Leads in the sidebar. You'll see all unassigned leads. Use the dropdown next to each lead to select a salesperson and assign it.",
      },
      {
        q: "How do I set a claim limit for a salesperson?",
        a: "Go to Manage Team and find the salesperson's row. You can set two controls:\n\nClaim Limit / 15min — the maximum number of leads they can claim within any 15-minute window. Once hit, they must wait for the timer to reset.\n\nMax New Leads — if set, they cannot claim more leads until they've contacted their existing NEW leads and updated the status. Set to 0 to disable this restriction.",
      },
      {
        q: "How do I view my team's performance?",
        a: "Your dashboard shows a summary for your team. You can also go to the Leads page to see your leads and your team's leads in separate sections — My Leads shows leads assigned directly to you, and Team Leads shows leads assigned to your salespersons.",
      },
    ],
  },
  {
    category: "For Super Admins",
    roles: ["SUPER_ADMIN"],
    items: [
      {
        q: "What is the Business Overview page?",
        a: "The Business Overview page (under the Super Admin menu) gives a full picture of the business across all teams. It shows total leads, active pipeline, won deals, conversion rate, a pipeline funnel, lead sources, campaign performance, leaderboards, and recent leads.\n\nYou can filter everything by period — Last 7 days, 30 days, 90 days, or All time.",
      },
      {
        q: "What does the Campaign Performance table show?",
        a: "The Campaign Performance table shows each Meta ad campaign's results side by side:\n\nStatus — whether the campaign is currently Active or Paused on Meta.\n\nDaily Budget — the daily spend limit set on Meta.\n\nToday Spend — how much has been spent today, with a progress bar showing how much of the daily budget is used.\n\nPeriod Spend — total spend for the selected period.\n\nCPL (Cost Per Lead) — period spend divided by the number of leads from that campaign in the CRM.\n\nLeads / Unclaimed / Won / Conversion — CRM data for that campaign.",
      },
      {
        q: "How do I add a new team member as a Super Admin?",
        a: "Go to Manage Team and click Add Member. You can create Salesperson or Manager accounts. Salespersons can then be assigned to a manager using the Manager dropdown in their row.",
      },
    ],
  },
]

export default async function FAQPage() {
  const session = await auth()
  const role = session?.user.role ?? "SALESPERSON"

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
