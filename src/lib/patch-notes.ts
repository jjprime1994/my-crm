export type PatchNote = {
  version: string
  date: string
  title: string
  items: string[]
}

export const PATCH_NOTES: PatchNote[] = [
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
