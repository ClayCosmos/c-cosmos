import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
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
        className={`${inter.variable} ${geistMono.variable} font-sans min-h-screen`}
        suppressHydrationWarning
      >
        <nav className="border-b bg-background">
          <div className="mx-auto flex h-11 max-w-4xl items-center justify-between px-6">
            <Link
              href="/"
              className="text-sm font-semibold tracking-tight text-foreground"
            >
              ClayCosmos
            </Link>
            <NavLinks />
          </div>
        </nav>
        <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
