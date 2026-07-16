import type { Metadata } from "next"
import Script from "next/script"
import { Providers } from "./providers"
import { ConsentBanner } from "@/components/privacy/ConsentBanner"
import "./globals.css"

export const metadata: Metadata = {
  title: "Misir",
  description:
    "Decision-readiness for founders and operators. Tracks your sources and tells you when you're ready to decide.",
  // Icons live in public/ and are declared here rather than using the
  // app/icon.* file convention, which serves them from extensionless URLs
  // (/icon?<hash>, /apple-icon?<hash>). proxy.ts only exempts static assets by
  // file extension, so those URLs would be auth-gated and 307 to /sign-in for
  // exactly the signed-out visitors the favicon is for. Real extensions keep
  // them public. Keep these paths in sync with the matcher there.
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
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
        <Providers>
          {children}
          <ConsentBanner />
        </Providers>
      </body>
    </html>
  )
}
