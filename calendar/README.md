# Ferien und Feiertage

`holidays-de.json` bundles German school holidays (Ferien) and public holidays (Feiertage) for all 16
Bundesländer, 2023–2029, so the app works offline and does not depend on a yearly-changing web service.

- Source: [openholidaysapi.org](https://openholidaysapi.org), which aggregates the dates each Land's education
  ministry publishes (school holidays are set years in advance by the Kultusministerkonferenz). The dates
  themselves are public facts, not creative content.
- Format: `nationalHolidays` are the public holidays that apply everywhere in Germany; `regionalHolidays` and
  `schoolHolidays` are keyed by the two-letter state code used throughout the app (`Bundesland`).
- Regenerate with `fetch.py` in this folder when the bundled years run out; it re-fetches all 16 states from the
  API and writes a fresh, deduplicated `holidays-de.json`.
- Read by `HolidayCalendar` (Swift) and `HolidayCalendar` (Kotlin) — same data, same query logic, same tests.
