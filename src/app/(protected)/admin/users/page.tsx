import { UserList } from "@/components/users/user-list";

export const metadata = {
  title: "Nutzerverwaltung – Schulbibliothek",
  description: "Systemnutzer und Schülerkonten verwalten.",
};

export default function UsersAdminPage() {
  return <UserList />;
}
