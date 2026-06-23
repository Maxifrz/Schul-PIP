import { LoanList } from "@/components/loans/loan-list";

export const metadata = {
  title: "Ausleihen – Schulbibliothek",
  description: "Übersicht über alle Ausleihen und Rückgabefristen.",
};

export default function LoansPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ausleihenübersicht</h1>
        <p className="text-sm text-muted-foreground">
          Verwalte, verlängere und überprüfe alle Buch-Ausleihen der Bibliothek.
        </p>
      </div>
      <LoanList />
    </div>
  );
}
