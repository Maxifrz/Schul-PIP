"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookForm } from "@/components/books/book-form";
import { CreateBookInput } from "@/schemas/book";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function NewBookPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdminOrLibrarian = session?.user?.role === "ADMIN" || session?.user?.role === "LIBRARIAN";

  const handleSubmit = async (data: CreateBookInput) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/books", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        router.push("/books");
        router.refresh();
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Fehler beim Erstellen des Buches.");
      }
    } catch (error) {
      console.error(error);
      alert("Ein Netzwerkfehler ist aufgetreten.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdminOrLibrarian && session) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Card className="max-w-md border-destructive/20 bg-destructive/5 text-destructive p-6 flex items-center gap-3">
          <ShieldAlert className="h-6 w-6" />
          <div>
            <h3 className="font-semibold">Zugriff verweigert</h3>
            <p className="text-sm">Du hast keine Berechtigung, neue Bücher anzulegen.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Buch hinzufügen</h1>
        <p className="text-sm text-muted-foreground">
          Erfasse ein neues Buch manuell oder suche nach der ISBN-Nummer.
        </p>
      </div>

      <BookForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}
