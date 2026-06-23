"use client";

import { LoanForm } from "@/components/loans/loan-form";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function NewLoanPage() {
  const { data: session } = useSession();
  const isAdminOrLibrarian = session?.user?.role === "ADMIN" || session?.user?.role === "LIBRARIAN";

  if (!isAdminOrLibrarian && session) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Card className="max-w-md border-destructive/20 bg-destructive/5 text-destructive p-6 flex items-center gap-3">
          <ShieldAlert className="h-6 w-6" />
          <div>
            <h3 className="font-semibold">Zugriff verweigert</h3>
            <p className="text-sm">Du hast keine Berechtigung, Ausleihen zu erfassen.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Neue Ausleihe</h1>
        <p className="text-sm text-muted-foreground">
          Erfasse eine neue Buch-Ausleihe für eine:n Schüler:in.
        </p>
      </div>
      <LoanForm />
    </div>
  );
}
