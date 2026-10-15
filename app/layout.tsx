import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";
import { GlassFilter } from "@/components/GlassFilter";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#F2F2F7" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Personal Finance",
  description:
    "Intelligent personal finance dashboard, live bank integration via Plaid, automated category rules, net worth analytics, split charges & custom tagging.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Personal Finance",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Render per request so Next.js can apply the CSP nonce from proxy.ts
  await connection();
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Personal Finance" />
      </head>
      <body className={`${inter.variable} bg-bg text-white antialiased`}>
        <GlassFilter />
        {children}
      </body>
    </html>
  );
}
