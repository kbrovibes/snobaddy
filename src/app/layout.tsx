import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import PullToRefresh from "@/components/PullToRefresh";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Serve Snoqualmie Badminton",
  description: "Badminton session and season tracker for snoqualmie club",
  icons: {
    icon: "/favicon.gif",
    apple: "/serve-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Snobaddy",
    statusBarStyle: "default",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextTopLoader color="#0ea5e9" height={4} showSpinner={false} />
        <PullToRefresh />
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
