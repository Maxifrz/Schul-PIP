import { BookList } from "@/components/books/book-list";

export const metadata = {
  title: "Bücherkatalog – Schulbibliothek",
  description: "Durchsuche den Bestand der Schulbibliothek.",
};

export default function BooksPage() {
  return <BookList />;
}
