import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"
dotenv.config()

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

async function main() {
  const updated = await db.lead.update({
    where: { metaLeadId: "2109781756249066" },
    data: { firstName: "Teh", adName: "Gorogoro Opening" },
    select: { firstName: true, lastName: true, email: true, adName: true },
  })
  console.log("Updated:", JSON.stringify(updated))
}

main().finally(() => db.$disconnect())
