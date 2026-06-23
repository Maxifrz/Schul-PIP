"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { UserForm } from "@/components/users/user-form";
import { UpdateUserInput } from "@/schemas/user";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { ShieldAlert, Loader2 } from "lucide-react";

interface EditUserPageProps {
  params: Promise<{ id: string }>;
}

export default function EditUserPage({ params }: EditUserPageProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { id } = use(params);

  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch(`/api/users/${id}`);
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        } else {
          alert("Nutzer:in konnte nicht geladen werden.");
          router.push("/admin/users");
        }
      } catch (err) {
        console.error(err);
        alert("Fehler beim Laden des Nutzers.");
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [id, router]);

  const handleSubmit = async (data: UpdateUserInput) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PUT",
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
        alert(errorData.error || "Fehler beim Aktualisieren des Nutzers.");
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

  if (!isAdmin && session) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Card className="max-w-md border-destructive/20 bg-destructive/5 text-destructive p-6 flex items-center gap-3">
          <ShieldAlert className="h-6 w-6" />
          <div>
            <h3 className="font-semibold">Zugriff verweigert</h3>
            <p className="text-sm">Du hast keine Berechtigung, Nutzerkonten zu bearbeiten.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nutzerprofil bearbeiten</h1>
        <p className="text-sm text-muted-foreground">
          Passe das Profil von {user?.firstName} {user?.lastName} an.
        </p>
      </div>

      <UserForm initialData={user} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}
