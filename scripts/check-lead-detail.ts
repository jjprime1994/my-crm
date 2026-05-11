import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"

dotenv.config()

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

async function main() {
  const lead = await db.lead.findFirst({ where: { email: "angelateh196@gmail.com" } })
  console.log(JSON.stringify(lead, null, 2))
}

main().finally(() => db.$disconnect())
