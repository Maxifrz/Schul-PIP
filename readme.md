# Schulbibliothek – Ausleihsystem (Phase 1 MVP)

Ein lauffähiger MVP (Minimum Viable Product) für das Schulbibliotheks-Ausleihsystem, optimiert für den Thekenbetrieb ohne zusätzliche RFID-Hardware.

## Features (Phase 1)
- **Benutzerverwaltung (CRUD)**: Kontenverwaltung für Schüler:innen, Bibliothekar:innen und Administrator:innen.
- **Bücherkatalog**:
  - Hinzufügen, Bearbeiten und Löschen von Büchern.
  - Automatisierter Metadaten-Lookup via Google Books / Open Library über die ISBN.
  - Kamera-basierter ISBN-Scanner (`html5-qrcode`) direkt in der Weboberfläche (Kiosk-tauglich).
- **Ausleihprozess**:
  - Manuelle Ausleihe (Kopplung von Nutzer:in und Buch).
  - Übersicht aller aktiven, überfälligen und abgeschlossenen Ausleihen.
  - Verlängerung der Leihfrist (berücksichtigt globale Limits).
  - Schnelle Rückgabe am Desk via Barcode-Scan oder ID.
- **Dashboard**:
  - Wichtige Kennzahlen (Gesamt-Bücher, Verfügbar, Ausgeliehen, Überfällig).
  - Schnellzugriffs-Aktionen ("Neue Ausleihe", "Rückgabe", "Bücherkatalog").
  - Liste aller überfälligen Ausleihen mit direkter Rückgabeaktion.
- **PWA-Unterstützung**: Manifest und Service Worker für Offline-Caching und App-Installation auf Kiosk-Tablets.

## Tech-Stack
- **Framework**: Next.js 15 (App Router) & TypeScript
- **Styling**: TailwindCSS & shadcn/ui
- **Datenbank**: PostgreSQL mit Prisma ORM
- **Validierung**: Zod
- **Authentifizierung**: NextAuth.js (Auth.js v5) mit Credentials-Provider (vorbereitet für IServ-OIDC)
- **Testing**: Vitest

---

## Installation und Setup

### 1. Repository klonen und installieren
```bash
git clone https://github.com/maxifrz/schul-bib.git
cd schul-bib
npm install
```

### 2. Umgebungsvariablen einrichten
Kopiere die `.env.example` zu `.env` und passe die Verbindungsdaten an:
```bash
cp .env.example .env
```
Standardinhalt für lokale Entwicklung:
```env
DATABASE_URL="postgresql://schulbib:schulbib@localhost:5432/schulbib?schema=public"
AUTH_SECRET="fL6yR5D4J2K8mS7qP9zV3bN1xW0eY9aB8cDbEaFbGgH"
AUTH_URL="http://localhost:3000"
GOOGLE_BOOKS_API_KEY=""
```

### 3. Datenbank starten (via Docker)
Um eine lokale PostgreSQL-Datenbank per Docker zu starten, führe folgenden Befehl aus:
```bash
docker compose up -d
```

### 4. Datenbank-Migrationen & Seeding
Führe die Migrationen aus und befülle die Datenbank mit den Standard-Seed-Daten:
```bash
npx prisma migrate dev
npx prisma db seed
```

---

## Lokale Ausführung

Starte den Next.js-Entwicklungsserver:
```bash
npm run dev
```
Die Anwendung ist anschließend unter [http://localhost:3000](http://localhost:3000) erreichbar.

---

## Test-Zugangsdaten (aus dem Datenbank-Seed)

Zum Testen der unterschiedlichen Rollen können folgende Zugangsdaten verwendet werden (Passwort ist jeweils `password123`):

- **Administrator:in**: `admin@schulbib.de`
- **Bibliothekar:in**: `bibliothek@schulbib.de`
- **Schüler:in**: `lena.mueller@schueler.schulbib.de`

---

## Tests ausführen
Um die Unit-Tests für die Services auszuführen, nutze:
```bash
npm test
```