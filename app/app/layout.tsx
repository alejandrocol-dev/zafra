import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import { Banner } from "@/components/banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LocaleProvider } from "@/lib/i18n";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zafra — Cash against the grain you already stored",
  description:
    "Open on-chain liquidity for grain warrants: lock a warrant as collateral and borrow USDC on Solana. Devnet demo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <LocaleProvider>
          <AppProviders>
            <Banner />
            <SiteHeader />
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
              {children}
            </main>
            <SiteFooter />
            <Toaster
              theme="dark"
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "var(--color-elevated)",
                  border: "1px solid var(--color-line-strong)",
                  color: "var(--color-ink)",
                },
              }}
            />
          </AppProviders>
        </LocaleProvider>
      </body>
    </html>
  );
}
