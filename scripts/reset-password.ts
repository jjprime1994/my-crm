import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import * as dotenv from "dotenv"
dotenv.config()

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

async function main() {
  const hashed = await bcrypt.hash("Groudon3397!", 12)
  const user = await db.user.update({
    where: { email: "jjprime1994@gmail.com" },
    data: { password: hashed },
    select: { name: true, email: true },
  })
  console.log("Password reset for:", user.email)
}

main().finally(() => db.$disconnect())
