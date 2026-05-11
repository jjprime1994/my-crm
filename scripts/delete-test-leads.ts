import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"

dotenv.config()

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

async function main() {
  const toDelete = await db.lead.findMany({
    where: {
      OR: [
        { metaLeadId: null },
        { email: "test@meta.com" },
        { metaLeadId: { startsWith: "test" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true, metaLeadId: true },
  })

  console.log(`Found ${toDelete.length} test leads to delete:`)
  toDelete.forEach((l) =>
    console.log(`  - ${l.firstName} ${l.lastName ?? ""} | ${l.email ?? "no email"} | metaLeadId: ${l.metaLeadId ?? "null"}`)
  )

  if (toDelete.length === 0) {
    console.log("Nothing to delete.")
    return
  }

  const result = await db.lead.deleteMany({
    where: {
      OR: [
        { metaLeadId: null },
        { email: "test@meta.com" },
        { metaLeadId: { startsWith: "test" } },
      ],
    },
  })

  console.log(`\nDeleted ${result.count} test leads.`)
}

main().finally(() => db.$disconnect())
