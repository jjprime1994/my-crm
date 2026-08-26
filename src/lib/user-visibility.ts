// A user disabled more than 30 days ago drops out of Business/Team Overview reporting
// (Team Breakdown, Funnel, Leaderboard) — someone disabled last week is still relevant
// context (a manager reviewing recent performance still wants to see them), but a
// departure from a month+ ago is just clutter. This has no effect on Manage Team, which
// always shows every account regardless of how long they've been disabled — that's the
// account-management view, not a performance report.
export const REPORTING_GRACE_DAYS = 30

export function reportingVisibleFilter() {
  const cutoff = new Date(Date.now() - REPORTING_GRACE_DAYS * 24 * 60 * 60 * 1000)
  return {
    OR: [
      { disabled: false },
      { disabledAt: null },
      { disabledAt: { gte: cutoff } },
    ],
  }
}
