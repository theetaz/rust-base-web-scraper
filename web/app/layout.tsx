"use client";

import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/app-sidebar";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en" className={cn("dark", "font-sans", inter.variable)}>
      <body className="min-h-screen">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={0}>
            <SidebarProvider>{children}</SidebarProvider>
          </TooltipProvider>
          <Toaster />
        </QueryClientProvider>
      </body>
    </html>
  );
}
