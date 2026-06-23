"use client";

import { useEffect, useState } from "react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { OverdueList } from "@/components/dashboard/overdue-list";
import { Button } from "@/components/ui/button";
import { BookPlus, RotateCcw, BookOpen, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface Stats {
  totalBooks: number;
  availableBooks: number;
  loanedBooks: number;
  activeLoans: number;
  overdueLoans: number;
  totalUsers: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const isAdminOrLibrarian = session?.user?.role === "ADMIN" || session?.user?.role === "LIBRARIAN";

  const [stats, setStats] = useState<Stats | null>(null);
  const [overdueLoans, setOverdueLoans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      // Fetch statistics and overdue loans in parallel
      const [statsRes, overdueRes] = await Promise.all([
        fetch("/api/loans?stats=true"),
        fetch("/api/loans?overdue=true"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (overdueRes.ok) {
        const overdueData = await overdueRes.json();
        setOverdueLoans(overdueData || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Hallo, {session?.user?.name || "Bibliothekar:in"}!</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Willkommen im Schulbibliothek-Ausleihsystem. Hier sind deine heutigen Aufgaben.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && <StatsCards stats={stats} />}

      {/* Quick Actions for Admin and Librarians */}
      {isAdminOrLibrarian && (
        <div className="space-y-3">
          <h3 className="text-base font-bold tracking-tight">Schnellzugriff</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Button asChild size="lg" className="h-16 justify-start text-base gap-3 border shadow-sm">
              <Link href="/loans/new">
                <BookPlus className="h-5 w-5 text-primary-foreground" />
                <div className="text-left">
                  <p className="font-semibold text-sm">Neue Ausleihe</p>
                  <p className="text-[10px] opacity-80 font-normal">Buch an Schüler:in übergeben</p>
                </div>
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="h-16 justify-start text-base gap-3 border shadow-sm">
              <Link href="/returns">
                <RotateCcw className="h-5 w-5 text-secondary-foreground" />
                <div className="text-left">
                  <p className="font-semibold text-sm">Rückgabe</p>
                  <p className="text-[10px] opacity-80 font-normal">Bücher per Barcode zurücknehmen</p>
                </div>
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-16 justify-start text-base gap-3 border shadow-sm">
              <Link href="/books">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <div className="text-left">
                  <p className="font-semibold text-sm">Bücherkatalog</p>
                  <p className="text-[10px] opacity-80 font-normal">Katalog durchsuchen und verwalten</p>
                </div>
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Main Grid: Overdue List & Info card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {isAdminOrLibrarian ? (
            <OverdueList
              overdueLoans={overdueLoans}
              onActionComplete={loadDashboardData}
              isAdminOrLibrarian={isAdminOrLibrarian}
            />
          ) : (
            <div className="border border-dashed rounded-xl p-8 text-center bg-card/40 flex flex-col items-center justify-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">Bibliothekskatalog</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
                Durchsuche das gesamte Buchangebot der Bibliothek und entdecke dein nächstes Lieblingsbuch.
              </p>
              <Button asChild className="gap-2">
                <Link href="/books">
                  Zum Bücherkatalog
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Info / Quick Help Card */}
        <div className="space-y-6">
          <div className="border rounded-xl p-6 bg-gradient-to-br from-primary/5 to-primary/10 space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-primary">Info & Support</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Dieses Ausleihsystem dient der digitalen Verwaltung von Büchern, Ausleihen und Rückgaben der Schulbibliothek. 
              Im Dashboard siehst du eine Übersicht aller Kennzahlen.
            </p>
            <div className="text-xs space-y-2 border-t pt-4">
              <p className="font-semibold">Nützliche Hinweise:</p>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                <li>Bücher können max. {stats?.totalBooks ? "2x" : "2-mal"} verlängert werden.</li>
                <li>Die Standardleihfrist beträgt 21 Tage.</li>
                <li>Bei Fragen wende dich an den Systemadministrator.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
