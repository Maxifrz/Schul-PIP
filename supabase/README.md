# Social backend (Supabase)

The Kurs tab of the iOS app talks to a Supabase project of your own. Nothing else runs on a server.

1. Create a project at supabase.com. Pick an EU region (Frankfurt) for data protection.
2. SQL editor: paste `schema.sql`, run it. Then paste `board.sql` and run it too (the Tafelbild: boards, contributions,
   polls, versions; it needs the tables of `schema.sql`).
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

## Tafelbild

`board.sql` adds the shared lesson result. Moderators (the founder of a course or group, and members the founder makes
moderators in the member list) start a board per lesson, accept, edit and reject contributions, put several up for a vote,
lock the board and close it. Everybody else proposes blocks (definition, formula, example, ...) and votes. Every acceptance
saves a version, so a moderator can step back. Closing freezes the board: no function accepts changes to a final board.

Limits, on purpose: the board refreshes every three seconds (no live cursor, no typing in one block at once; two people
editing the same block get "somebody changed it, reload"), there is no free-form canvas with connecting lines yet, and
"online" is not shown because the app does not track presence.
