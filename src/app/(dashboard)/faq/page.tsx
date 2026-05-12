"use client"

import { useState } from "react"

const faqs = [
  {
    category: "Getting Started",
    items: [
      {
        q: "What is the dashboard and what does it show?",
        a: "The dashboard gives you a quick overview of your performance. It shows the total leads assigned to you, how many are in each status (New, Contacted, Won, Lost), and any upcoming follow-ups due today.",
      },
      {
        q: "What do the different lead statuses mean?",
        a: "NEW — the lead has just been assigned and you haven't contacted them yet.\n\nCONTACTED — you've reached out to the lead at least once.\n\nFOLLOW_UP — you're in ongoing discussions with the lead.\n\nWON — the deal has been closed successfully.\n\nLOST — the lead is no longer interested or the deal fell through.",
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
        a: "If you have a minimum contact requirement set by your manager, you won't be able to claim new leads until you've contacted your existing NEW leads. You'll see an amber warning message at the top of the Available Leads page explaining how many leads you need to contact first.",
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
    items: [
      {
        q: "How do I assign a lead to a salesperson?",
        a: "Go to Assign Leads in the sidebar. You'll see all unassigned leads. Use the dropdown next to each lead to select a salesperson and assign it.",
      },
      {
        q: "How do I set a claim limit for a salesperson?",
        a: "Go to Manage Team and click Edit next to the salesperson. You can set a Claim Limit (maximum number of leads they can hold at once) and a New Lead Threshold (they can't claim new leads until they contact this many NEW leads).",
      },
      {
        q: "How do I view my team's performance?",
        a: "Your dashboard shows a summary for your team. Super Admins also have access to a full Overview page with individual and team leaderboards.",
      },
    ],
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
      >
        <span>{q}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-gray-600 whitespace-pre-line leading-relaxed">
          {a}
        </div>
      )}
    </div>
  )
}

export default function FAQPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Help & FAQ</h1>
        <p className="text-sm text-gray-500 mt-0.5">Answers to common questions about using the CRM</p>
      </div>

      {faqs.map((section) => (
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
