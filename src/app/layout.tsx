import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import PwaRegister from "@/components/PwaRegister"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })

export const metadata: Metadata = {
  title: "Nu Vending CRM",
  description: "Lead management for the Nu Vending sales team",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NV CRM",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="h-full bg-gray-50 font-sans antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  )
}
