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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-gray-50 text-gray-900 min-h-screen antialiased">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="block">
              <h1 className="text-xl font-bold tracking-tight">Earnings Monitor</h1>
              <p className="text-sm text-gray-500">Automated quarterly earnings analysis</p>
            </Link>
            <nav className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <Link
                href="/"
                className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-white transition-all"
              >
                Earnings
              </Link>
              <Link
                href="/supply-chain"
                className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-white transition-all"
              >
                Supply Chain
              </Link>
              <Link
                href="/wiki"
                className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-white transition-all"
              >
                Wiki
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
