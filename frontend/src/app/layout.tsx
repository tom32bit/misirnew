import type { Metadata } from "next"
import Script from "next/script"
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google"
import { Providers } from "./providers"
import { ConsentBanner } from "@/components/privacy/ConsentBanner"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
})

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
  weight: ["500", "600", "700", "800"],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  title: "Misir",
  description:
    "Decision-readiness for founders and operators. Tracks your sources and tells you when you're ready to decide.",
}

const themeBootstrap = `
(function(){try{
  var t = localStorage.getItem('misir.theme');
  // Light is the default. Dark only when the user explicitly chose it.
  document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
}catch(e){
  document.documentElement.setAttribute('data-theme','light');
}})();
`

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <Script
          id="misir-theme-bootstrap"
          strategy="beforeInteractive"
        >
          {themeBootstrap}
        </Script>
      </head>
      <body>
        <Providers>
          {children}
          <ConsentBanner />
        </Providers>
      </body>
    </html>
  )
}
