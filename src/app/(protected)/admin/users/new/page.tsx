"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserForm } from "@/components/users/user-form";
import { CreateUserInput } from "@/schemas/user";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function NewUserPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN";

  const handleSubmit = async (data: CreateUserInput) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        router.push("/admin/users");
        router.refresh();
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Fehler beim Erstellen des Nutzers.");
      }
    } catch (error) {
      console.error(error);
      alert("Ein Netzwerkfehler ist aufgetreten.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdmin && session) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Card className="max-w-md border-destructive/20 bg-destructive/5 text-destructive p-6 flex items-center gap-3">
          <ShieldAlert className="h-6 w-6" />
          <div>
            <h3 className="font-semibold">Zugriff verweigert</h3>
            <p className="text-sm">Du hast keine Berechtigung, neue Nutzerkonten anzulegen.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nutzer:in anlegen</h1>
        <p className="text-sm text-muted-foreground">
          Erstelle ein neues Benutzerkonto für Schüler, Bibliothekare oder Administratoren.
        </p>
      </div>

      <UserForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}
