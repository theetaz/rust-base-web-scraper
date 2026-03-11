"use client";

import { useState } from "react";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider } from "@/components/app-sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased dark", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="dark" storageKey="spider-theme">
            <TooltipProvider delayDuration={0}>
              <SidebarProvider>
                {children}
                <Toaster />
              </SidebarProvider>
            </TooltipProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
