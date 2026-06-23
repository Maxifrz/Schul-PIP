"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Settings, ShieldAlert, Check } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [defaultLoanDays, setDefaultLoanDays] = useState(21);
  const [maxRenewals, setMaxRenewals] = useState(2);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          setDefaultLoanDays(data.defaultLoanDays);
          setMaxRenewals(data.maxRenewals);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccess(false);
    setError(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          defaultLoanDays,
          maxRenewals,
        }),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Fehler beim Speichern der Einstellungen.");
      }
    } catch (err) {
      console.error(err);
      setError("Netzwerkfehler.");
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
            <p className="text-sm">Du hast keine Berechtigung, die Systemeinstellungen zu ändern.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Systemeinstellungen</h1>
        <p className="text-sm text-muted-foreground">
          Konfiguriere Standardfristen und Verlängerungsregeln für die Buchausleihe.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="border-none shadow-md bg-card/60 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Ausleihregeln
            </CardTitle>
            <CardDescription>
              Diese Regeln gelten global für alle neuen Ausleihen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive animate-shake">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 animate-scale-in">
                <Check className="h-4 w-4 text-emerald-600 font-bold" />
                Einstellungen erfolgreich gespeichert!
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="defaultLoanDays">Standard-Leihfrist (in Tagen)</Label>
              <Input
                id="defaultLoanDays"
                type="number"
                min={1}
                max={365}
                value={defaultLoanDays}
                onChange={(e) => setDefaultLoanDays(parseInt(e.target.value) || 21)}
                className="h-10 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Gibt an, wie viele Tage ein Buch nach der Ausleihe fällig wird. Standard ist 21.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxRenewals">Maximale Verlängerungen</Label>
              <Input
                id="maxRenewals"
                type="number"
                min={0}
                max={10}
                value={maxRenewals}
                onChange={(e) => setMaxRenewals(parseInt(e.target.value) || 0)}
                className="h-10 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Gibt an, wie oft Schüler:innen ein Buch verlängern können. Standard ist 2.
              </p>
            </div>
          </CardContent>
          <CardFooter className="border-t bg-muted/20 px-6 py-4 flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="flex items-center gap-1.5">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Einstellungen speichern
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
