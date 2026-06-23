"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { BookForm } from "@/components/books/book-form";
import { CreateBookInput } from "@/schemas/book";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert, Loader2 } from "lucide-react";

interface EditBookPageProps {
  params: Promise<{ id: string }>;
}

export default function EditBookPage({ params }: EditBookPageProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { id } = use(params);

  const [book, setBook] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdminOrLibrarian = session?.user?.role === "ADMIN" || session?.user?.role === "LIBRARIAN";

  useEffect(() => {
    async function loadBook() {
      try {
        const response = await fetch(`/api/books/${id}`);
        if (response.ok) {
          const data = await response.json();
          setBook(data);
        } else {
          alert("Buch konnte nicht geladen werden.");
          router.push("/books");
        }
      } catch (err) {
        console.error(err);
        alert("Fehler beim Laden des Buches.");
      } finally {
        setIsLoading(false);
      }
    }
    loadBook();
  }, [id, router]);

  const handleSubmit = async (data: CreateBookInput) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/books/${id}`, {
        method: "PUT",
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
        alert(errorData.error || "Fehler beim Aktualisieren des Buches.");
      }
    } catch (error) {
      console.error(error);
      alert("Ein Netzwerkfehler ist aufgetreten.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdminOrLibrarian && session) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Card className="max-w-md border-destructive/20 bg-destructive/5 text-destructive p-6 flex items-center gap-3">
          <ShieldAlert className="h-6 w-6" />
          <div>
            <h3 className="font-semibold">Zugriff verweigert</h3>
            <p className="text-sm">Du hast keine Berechtigung, Buchdaten zu bearbeiten.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Buch bearbeiten</h1>
        <p className="text-sm text-muted-foreground">
          Ändere die Details des Buches &quot;{book?.title}&quot;.
        </p>
      </div>

      <BookForm initialData={book} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}
