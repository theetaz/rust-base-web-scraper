"use client";

import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/app-sidebar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en" className="dark">
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
