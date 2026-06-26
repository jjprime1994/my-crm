import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import PwaRegister from "@/components/PwaRegister"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

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
    <html lang="en" suppressHydrationWarning className={`${geist.variable} h-full`}>
      <head>
        {/* Prevent dark mode flash by applying class before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})()` }} />
      </head>
      <body className="h-full font-sans antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  )
}
