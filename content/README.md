# Shared learning content

One copy of the content, read by the iOS app and by the desktop and Android ports.

* `courses/<id>.txt`: the five language courses in the format of `docs/learn/language-engine.md`. The Swift strings in
  `Lernwerk/Services/Learn/Languages/*/*Course.swift` are the source; `node scripts/export-courses.mjs` writes these
  files and `--check` (run by the desktop tests and by `LernwerkTests/CourseTextFilesTests.swift`) fails when they differ.
* `fixtures/`: what the Swift engines produce, for the ports to be tested against. `courses/<id>.json` holds every node
  of every course with two seeds; `random.json` the random generator's streams; `quests.json` the quests chosen for a
  range of days. Rebuild with `scripts/learn-swift/export.sh`; the Desktop workflow fails when they are out of date.
