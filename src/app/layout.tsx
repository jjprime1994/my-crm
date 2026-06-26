import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import PwaRegister from "@/components/PwaRegister"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

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
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="h-full bg-gray-50 font-sans antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  )
}
