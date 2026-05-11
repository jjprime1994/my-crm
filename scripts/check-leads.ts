import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"

dotenv.config()

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

async function main() {
  const leads = await db.lead.findMany({ orderBy: { createdAt: "desc" } })
  console.log("Leads in DB:", leads.length)
  leads.forEach((l) =>
    console.log(
      `  ${new Date(l.createdAt).toLocaleString("en-MY").padEnd(22)}` +
      `  ${(l.firstName ?? "") + " " + (l.lastName ?? "")}`.padEnd(25) +
      `  ad: ${l.adName ?? "null"}` +
      `  | campaign: ${l.campaignName ?? "null"}`
    )
  )
}

main().finally(() => db.$disconnect())
