import type { Metadata } from "next";
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
  title: "ReguLens - AI Autonomous Digital Trade Regulator Discovery",
  description: "Automate regulatory mapping & evidence discovery under UNESCAP RDTII framework using Neuro-Symbolic Hybrid architecture.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-slate-900 text-slate-300">
        <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
              R
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">ReguLens</h1>
              <p className="text-xs text-slate-500 font-mono">UNESCAP RDTII Discovery Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-400">System Gateway: Online</span>
          </div>
        </header>
        <main className="flex flex-col flex-1">{children}</main>
      </body>
    </html>
  );
}
