"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, MapPin, Barcode, Calendar, User, Edit, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface BookDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function BookDetailPage({ params }: BookDetailPageProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { id } = use(params);

  const [book, setBook] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-sm py-1 px-3">Verfügbar</Badge>;
      case "LOANED":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 text-sm py-1 px-3">Ausgeliehen</Badge>;
      case "RESERVED":
        return <Badge variant="outline" className="border-blue-300 text-blue-800 bg-blue-50 text-sm py-1 px-3">Reserviert</Badge>;
      case "LOST":
        return <Badge variant="destructive" className="text-sm py-1 px-3">Verloren</Badge>;
      default:
        return <Badge variant="outline" className="text-sm py-1 px-3">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeLoan = book.loans && book.loans[0];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/books")} title="Zurück zur Liste">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Buchdetails</h1>
          <p className="text-sm text-muted-foreground">Detailansicht und aktuelle Ausleihinformationen.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Cover image column */}
        <div className="md:col-span-1">
          <Card className="overflow-hidden border-none shadow-md h-full flex flex-col justify-between bg-card/60 backdrop-blur-md">
            <div className="relative aspect-[3/4] bg-muted flex items-center justify-center border-b">
              {book.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="object-cover w-full h-full"
                />
              ) : (
                <BookOpen className="h-20 w-20 text-muted-foreground/30" />
              )}
            </div>
            {isAdminOrLibrarian && (
              <CardFooter className="p-4 bg-muted/20 justify-center">
                <Button asChild className="w-full flex items-center gap-2">
                  <Link href={`/books/${book.id}/edit`}>
                    <Edit className="h-4 w-4" />
                    Bearbeiten
                  </Link>
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* Details column */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-none shadow-md bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                {getStatusBadge(book.status)}
                {book.location && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>{book.location}</span>
                  </div>
                )}
              </div>
              <CardTitle className="text-2xl leading-snug">{book.title}</CardTitle>
              <p className="text-base text-muted-foreground font-medium">{book.author}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm border-t border-b py-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block font-semibold">
                    Inventarcode
                  </span>
                  <span className="font-mono font-medium flex items-center gap-1.5">
                    <Barcode className="h-4 w-4 text-muted-foreground" />
                    {book.inventoryCode}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block font-semibold">
                    ISBN
                  </span>
                  <span className="font-mono font-medium">{book.isbn || "Keine"}</span>
                </div>
                {book.publisher && (
                  <div className="space-y-1 col-span-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider block font-semibold">
                      Verlag
                    </span>
                    <span className="font-medium">{book.publisher}</span>
                  </div>
                )}
              </div>

              {book.description && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Beschreibung</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {book.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active loan information */}
          {activeLoan && (
            <Card className="border-none shadow-md bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                  <User className="h-5 w-5" />
                  Aktuelle Ausleihe
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground block">Ausgeliehen an</span>
                    <span className="font-semibold">
                      {activeLoan.user.firstName} {activeLoan.user.lastName}
                    </span>
                    {activeLoan.user.schoolClass && (
                      <span className="text-xs text-muted-foreground block">Klasse {activeLoan.user.schoolClass}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Rückgabefrist (Fälligkeit)</span>
                    <span className="font-semibold flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {new Date(activeLoan.dueDate).toLocaleDateString("de-DE")}
                    </span>
                    {new Date(activeLoan.dueDate) < new Date() && (
                      <span className="text-xs text-red-600 font-semibold block animate-pulse">Überfällig!</span>
                    )}
                  </div>
                </div>
                {isAdminOrLibrarian && (
                  <div className="flex gap-2 pt-2">
                    <Button asChild size="sm" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/95">
                      <Link href="/returns">Zur Rückgabe</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link href="/loans">Details einsehen</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
