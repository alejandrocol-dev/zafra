import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import { LocaleProvider } from "@/lib/i18n";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zafra-gilt.vercel.app"),
  title: "Zafra — Cash against the grain you already stored",
  description:
    "Open on-chain liquidity for grain warrants: lock a warrant as collateral and borrow USDC on Solana. Devnet demo.",
  openGraph: {
    title: "Zafra — Cash against the grain you already stored",
    description:
      "Open on-chain liquidity for grain warrants: lock a warrant as collateral and borrow USDC on Solana. Devnet demo.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Zafra — grain-backed credit on Solana" }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${geist.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <LocaleProvider>
          <AppProviders>
            {children}
            <Toaster
              theme="light"
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-line-strong)",
                  color: "var(--color-ink)",
                  boxShadow: "var(--shadow-float)",
                },
              }}
            />
          </AppProviders>
        </LocaleProvider>
      </body>
    </html>
  );
}
