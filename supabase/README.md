# Social backend (Supabase)

The Kurs tab of the iOS app talks to a Supabase project of your own. Nothing else runs on a server.

1. Create a project at supabase.com. Pick an EU region (Frankfurt) for data protection.
2. SQL editor: paste `schema.sql`, run it.
3. Authentication -> Providers -> Email: for a school project switch "Confirm email" off, otherwise every sign-up needs a mail
   link first (the app handles both).
4. Project settings -> API: copy the project URL and the `anon` public key.
5. App: Kurs tab -> enter URL and key once. The key is public by design; the row level security in `schema.sql` is what
   protects the data. Never put the `service_role` key into the app.

What the schema guarantees: only members of a group read or write its messages, results and files; nobody adds themselves
to a group except through a join code (a work group additionally needs membership of its course); profiles are visible only
to people who share a group. Files live in one private bucket, 20 MB each, one folder per group.

Not covered, on purpose: push notifications (the chat refreshes every few seconds while it is open) and moderation beyond
the report button (reports land in the `reports` table; someone has to read it). If minors use the app, you need a privacy
notice and a contact who deals with reports.
