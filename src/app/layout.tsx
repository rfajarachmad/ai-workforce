import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "AI Workforce",
  description: "AI Workforce dashboard shell",
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
      <body className="min-h-full bg-slate-950 text-slate-100">
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
          <aside className="border-b border-slate-800 bg-slate-900/80 p-4 lg:border-b-0 lg:border-r">
            <div className="mb-8 px-2">
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-400">
                AI Workforce
              </p>
              <h1 className="mt-2 text-xl font-semibold text-white">
                Control Center
              </h1>
            </div>

            <nav className="space-y-1">
              {[
                { href: "/", label: "Overview" },
                { href: "/workforce", label: "Workforce Graph" },
                { href: "#", label: "Agents" },
                { href: "#", label: "Automations" },
                { href: "#", label: "Tasks" },
                { href: "#", label: "Settings" },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>

          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 px-6 py-4 backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">Welcome back</p>
                <button
                  type="button"
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  New Task
                </button>
              </div>
            </header>

            <main className="flex-1 px-6 py-8">{children}</main>

            <footer className="border-t border-slate-800 px-6 py-4 text-xs text-slate-500">
              <p>© {new Date().getFullYear()} AI Workforce. All rights reserved.</p>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
