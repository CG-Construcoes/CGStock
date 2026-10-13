import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { SyncProvider } from "@/components/sync-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CGStock - Gestão de Almoxarifado",
  description: "Sistema profissional de gestão de almoxarifado e inventário",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Coletor Web",
  },
};

export const viewport = {
  themeColor: "#4f46e5",
};

import { Toaster } from "sonner"
import { headers } from "next/headers"
import NextTopLoader from "nextjs-toploader"

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") || undefined;

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <NextTopLoader
            color="#C9832B"
            showSpinner={false}
            height={3}
            shadow="0 0 10px #C9832B,0 0 5px #C9832B"
          />
          <SyncProvider>
            <AppShell>{children}</AppShell>
          </SyncProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
