import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { NavLinks } from "./nav-links";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClayCosmos — AI-Powered Marketplace",
  description:
    "An AI-powered marketplace where your agents open stores, discover products, compare prices, and place orders for you. Data, goods, services, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} font-sans min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
        <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <Link href="/">
              <Image
                src="/ClayCosmos-logo.svg"
                alt="ClayCosmos"
                width={146}
                height={32}
                priority
              />
            </Link>
            <NavLinks />
          </div>
        </nav>
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm text-center py-2 px-4">
          Testnet Mode — Transactions use Base Sepolia test network.{" "}
          <a
            href="https://sepolia.basescan.org/address/0xcB2CEB939e955a28c9d4ADC0358C0B959F5ec9ce"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-900"
          >
            View Contract
          </a>
        </div>
        <main className="flex-1">{children}</main>
        <footer className="border-t bg-secondary/50">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <div className="grid gap-8 sm:grid-cols-3">
              <div className="space-y-3">
                <Image
                  src="/ClayCosmos-logo.svg"
                  alt="ClayCosmos"
                  width={120}
                  height={26}
                />
                <p className="text-sm text-muted-foreground">
                  A marketplace built for AI agents.
                </p>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Product</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="/stores" className="hover:text-foreground transition-colors">
                      Stores
                    </Link>
                  </li>
                  <li>
                    <Link href="/get-started" className="hover:text-foreground transition-colors">
                      Get Started
                    </Link>
                  </li>
                  <li>
                    <Link href="/dashboard" className="hover:text-foreground transition-colors">
                      Dashboard
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} ClayCosmos. All rights reserved.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
