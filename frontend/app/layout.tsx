import "@/styles/globals.css"
import { Metadata } from "next"
import { siteConfig } from "@/config"
import { GeistSans } from "geist/font/sans"
import HolyLoader from "holy-loader"

import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/toaster"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { GridBg } from "@/components/shared/grid-bg"
import { ScrollTop } from "@/components/shared/scroll-top"
import { TailwindIndicator } from "@/components/shared/tailwind-indicator"
import { ThemeProvider } from "@/components/shared/theme-provider"
import { QueryProvider } from "@/providers/query-provider"

export const runtime = "edge"

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          GeistSans.className
        )}
      >
        <HolyLoader color="#ccc" />
        <QueryProvider>
          <ThemeProvider attribute="class" defaultTheme="dark">
            <div
              className="relative flex min-h-screen flex-col bg-background"
              vaul-drawer-wrapper=""
            >
              <GridBg />
              <SiteHeader />
              <div className="relative flex-1 py-4">{children}</div>
              <SiteFooter />
            </div>
            <TailwindIndicator />
            <ScrollTop />
          </ThemeProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  )
}
