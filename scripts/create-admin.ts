import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import * as dotenv from "dotenv"

dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

async function main() {
  const existing = await db.user.findUnique({ where: { email: "jjprime1994@gmail.com" } })
  if (existing) {
    console.log("Admin already exists:", existing.email)
    return
  }

  const password = await bcrypt.hash("admin123", 12)
  const user = await db.user.create({
    data: { name: "Admin", email: "jjprime1994@gmail.com", password, role: "ADMIN" },
  })
  console.log("Admin created:", user.email)
}

main().finally(() => db.$disconnect())
