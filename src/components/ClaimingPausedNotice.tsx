import Link from "next/link"

export default function ClaimingPausedNotice({ what }: { what: string }) {
  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
        <h1 className="text-xl font-bold text-gray-900">{what} is paused</h1>
        <p className="text-sm text-gray-600">
          Claiming is switched off for now. Record your daily numbers in Daily Activity, and submit commission claims
          in MA (Sales) and LA (Location).
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/daily-activity" className="text-sm font-semibold px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700">
            Go to Daily Activity
          </Link>
          <Link href="/commission/ma" className="text-sm font-semibold px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200">
            MA – Sales Commission
          </Link>
          <Link href="/commission/la" className="text-sm font-semibold px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200">
            LA – Location Commission
          </Link>
        </div>
      </div>
    </div>
  )
}
