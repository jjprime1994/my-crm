import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import * as dotenv from "dotenv"

dotenv.config()

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

const leads = [
  { firstName: "Maria", lastName: "Santos", email: "maria.santos@gmail.com", phone: "+639171234567", status: "NEW" },
  { firstName: "Jose", lastName: "Reyes", email: "jose.reyes@yahoo.com", phone: "+639281234567", status: "CONTACTED" },
  { firstName: "Ana", lastName: "Cruz", email: "ana.cruz@gmail.com", phone: "+639391234567", status: "QUALIFIED" },
  { firstName: "Pedro", lastName: "Lim", email: "pedro.lim@gmail.com", phone: "+639451234567", status: "PROPOSAL" },
  { firstName: "Luz", lastName: "Garcia", email: "luz.garcia@gmail.com", phone: "+639561234567", status: "CLOSED_WON" },
  { firstName: "Ramon", lastName: "Dela Cruz", email: "ramon@gmail.com", phone: "+639671234567", status: "NEW" },
  { firstName: "Teresa", lastName: "Bautista", email: "teresa@gmail.com", phone: "+639781234567", status: "CONTACTED" },
  { firstName: "Carlo", lastName: "Mendoza", email: "carlo@gmail.com", phone: "+639891234567", status: "CLOSED_LOST" },
]

async function main() {
  // Create a test salesperson
  const existing = await db.user.findUnique({ where: { email: "juan@nuvending.com" } })
  let salesperson = existing
  if (!salesperson) {
    const pw = await bcrypt.hash("sales123", 12)
    salesperson = await db.user.create({
      data: { name: "Juan Dela Cruz", email: "juan@nuvending.com", password: pw, role: "SALESPERSON" },
    })
    console.log("Created salesperson:", salesperson.email)
  }

  // Create test leads
  for (const lead of leads) {
    const exists = await db.lead.findFirst({ where: { email: lead.email } })
    if (!exists) {
      await db.lead.create({
        data: {
          ...lead,
          status: lead.status as any,
          adName: "Nu Vending - Lead Form",
          campaignName: "Metro Manila Leads 2026",
          assignedToId: Math.random() > 0.4 ? salesperson!.id : null,
          // Make some leads old for follow-up testing
          updatedAt: Math.random() > 0.5
            ? new Date(Date.now() - Math.floor(Math.random() * 7 + 2) * 24 * 60 * 60 * 1000)
            : new Date(),
        },
      })
      console.log("Created lead:", lead.firstName, lead.lastName)
    }
  }

  console.log("\nDone! Test salesperson login: juan@nuvending.com / sales123")
}

main().finally(() => db.$disconnect())
