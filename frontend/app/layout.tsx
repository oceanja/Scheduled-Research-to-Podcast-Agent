import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Daily Brief — Your morning podcast, made fresh",
  description:
    "An AI agent that researches your topic every morning and delivers a 5-minute audio briefing to your inbox.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Daily Brief",
    description:
      "An AI agent that researches your topic every morning and delivers a 5-minute podcast.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-[#FAFAF9] text-zinc-900 selection:bg-zinc-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
