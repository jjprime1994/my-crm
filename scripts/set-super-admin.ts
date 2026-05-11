import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"
dotenv.config()

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any)

async function main() {
  const user = await db.user.update({
    where: { email: "jjprime1994@gmail.com" },
    data: { role: "SUPER_ADMIN" },
    select: { name: true, email: true, role: true },
  })
  console.log("Updated:", JSON.stringify(user))
}

main().finally(() => db.$disconnect())
