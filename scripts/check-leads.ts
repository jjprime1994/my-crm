import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"

dotenv.config()

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

async function main() {
  const leads = await db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 5 })
  console.log("Leads in DB:", leads.length)
  leads.forEach((l) => console.log("-", l.firstName, l.lastName, l.email, l.status, l.createdAt))
}

main().finally(() => db.$disconnect())
