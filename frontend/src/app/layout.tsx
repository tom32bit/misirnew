import type { Metadata } from "next"
import Script from "next/script"
import { Providers } from "./providers"
import { ConsentBanner } from "@/components/privacy/ConsentBanner"
import { DevGate } from "@/components/DevGate"
import "./globals.css"

export const metadata: Metadata = {
  title: "Misir",
  description:
    "Decision-readiness for founders and operators. Tracks your sources and tells you when you're ready to decide.",
}

const themeBootstrap = `
(function(){try{
  var t = localStorage.getItem('misir.theme');
  document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
}catch(e){
  document.documentElement.setAttribute('data-theme','light');
}})();
`

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <Script id="misir-theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrap}
        </Script>
      </head>
      <body>
        <DevGate>
          <Providers>
            {children}
            <ConsentBanner />
          </Providers>
        </DevGate>
      </body>
    </html>
  )
}
