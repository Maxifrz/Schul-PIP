"use client";

import { ReturnForm } from "@/components/loans/return-form";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function ReturnsPage() {
  const { data: session } = useSession();
  const isAdminOrLibrarian = session?.user?.role === "ADMIN" || session?.user?.role === "LIBRARIAN";

  if (!isAdminOrLibrarian && session) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Card className="max-w-md border-destructive/20 bg-destructive/5 text-destructive p-6 flex items-center gap-3">
          <ShieldAlert className="h-6 w-6" />
          <div>
            <h3 className="font-semibold">Zugriff verweigert</h3>
            <p className="text-sm">Du hast keine Berechtigung, Buchrückgaben zu verbuchen.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Buchrückgabe</h1>
        <p className="text-sm text-muted-foreground">
          Bücher schnell per Barcode oder ID zurücknehmen.
        </p>
      </div>
      <ReturnForm />
    </div>
  );
}
