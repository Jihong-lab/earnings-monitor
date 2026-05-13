import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Earnings Monitor",
  description: "Automated quarterly earnings analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-5xl mx-auto px-6 py-5">
            <Link href="/" className="block">
              <h1 className="text-2xl font-semibold tracking-tight">
                Earnings Monitor
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Automated quarterly earnings analysis
              </p>
            </Link>
            <nav className="mt-4 flex gap-6 text-sm">
              <Link href="/" className="hover:underline">
                Earnings
              </Link>
              <Link href="/supply-chain" className="hover:underline">
                Supply Chain
              </Link>
              <Link href="/wiki" className="hover:underline">
                Wiki
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
