"use client";

import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="lg:pl-64">
          <div className="pt-14 lg:pt-0">
            <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}
