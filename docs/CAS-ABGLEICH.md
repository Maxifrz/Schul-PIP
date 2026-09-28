# CAS-Rechner: Abgleich mit der Feature-Checkliste

Stand: 28.09.2026, Commit f29962d. Geprüft am Code und mit rund 150 Beispielaufgaben gegen den echten Rechenkern (Giac 1.9 über `cas/web/cas.js`, wie in der App).

Legende: `[x]` in der App nutzbar (Taste, deutscher Befehl oder Graph-Ansicht) · `[~]` rechnet, aber nur per (meist englischem) Giac-Befehl ohne Taste/Hilfe, oder nur teilweise · `[!]` geht, aber mit Fehler · `[ ]` fehlt

## Zusammenfassung

703 Punkte: 151 in der App, 95 nur per Befehl, 144 teilweise, 14 mit Fehler, 299 fehlen.

| Kapitel | Punkte | in der App | nur Befehl | teilweise | Fehler | fehlt |
|---|---:|---:|---:|---:|---:|---:|
| 1. Grundfunktionen | 18 | 14 | 1 | 1 | 2 | 0 |
| 2. CAS – Computer Algebra System | 18 | 12 | 5 | 0 | 0 | 1 |
| 3. Gleichungen | 18 | 13 | 2 | 1 | 0 | 2 |
| 4. Ungleichungen | 13 | 0 | 0 | 9 | 0 | 4 |
| 5. Funktionen | 21 | 12 | 7 | 2 | 0 | 0 |
| 6. Funktionsanalyse | 24 | 11 | 0 | 4 | 0 | 9 |
| 7. Differentialrechnung | 17 | 5 | 1 | 6 | 1 | 4 |
| 8. Integralrechnung | 14 | 4 | 1 | 8 | 0 | 1 |
| 9. Grenzwerte und Reihen | 14 | 6 | 2 | 2 | 3 | 1 |
| 10. Numerische Mathematik | 11 | 1 | 4 | 0 | 0 | 6 |
| 11. 2D-Grafik | 25 | 5 | 0 | 3 | 0 | 17 |
| 12. Dynamische Mathematik | 13 | 0 | 0 | 1 | 0 | 12 |
| 13. Geometrie | 28 | 0 | 2 | 1 | 0 | 25 |
| 14. Geometrische Transformationen | 10 | 0 | 0 | 1 | 0 | 9 |
| 15. Analytische Geometrie | 24 | 5 | 5 | 13 | 1 | 0 |
| 16. 3D-Rechner | 24 | 0 | 0 | 0 | 0 | 24 |
| 17. Matrizen | 15 | 9 | 4 | 1 | 1 | 0 |
| 18. Komplexe Zahlen | 11 | 2 | 7 | 1 | 0 | 1 |
| 19. Folgen | 9 | 1 | 1 | 2 | 0 | 5 |
| 20. Statistik | 21 | 4 | 4 | 4 | 1 | 8 |
| 21. Regression | 12 | 0 | 4 | 1 | 2 | 5 |
| 22. Wahrscheinlichkeitsrechnung | 15 | 0 | 8 | 6 | 0 | 1 |
| 23. Stochastische Simulationen | 9 | 0 | 0 | 1 | 1 | 7 |
| 24. Statistische Tests | 10 | 0 | 0 | 3 | 0 | 7 |
| 25. Tabellenkalkulation | 14 | 0 | 0 | 0 | 0 | 14 |
| 26. Einheiten | 15 | 1 | 12 | 2 | 0 | 0 |
| 27. Physikalische Mathematik | 13 | 0 | 1 | 10 | 1 | 1 |
| 28. Interaktive Benutzeroberfläche | 15 | 3 | 0 | 3 | 0 | 9 |
| 29. Animation | 12 | 0 | 0 | 0 | 0 | 12 |
| 30. Skripting | 12 | 0 | 0 | 0 | 0 | 12 |
| 31. Programmier-/Entwicklerfunktionen | 12 | 1 | 4 | 0 | 1 | 6 |
| 32. Lernfunktionen | 11 | 0 | 0 | 6 | 0 | 5 |
| 33. Dokumente und Materialien | 12 | 1 | 0 | 7 | 0 | 4 |
| 34. Dateisystem | 13 | 2 | 0 | 5 | 0 | 6 |
| 35. Prüfung / Exam Mode | 7 | 0 | 0 | 0 | 0 | 7 |
| 36. Bedienkomfort | 13 | 2 | 0 | 2 | 0 | 9 |
| 37. Mobile Funktionen | 12 | 8 | 0 | 3 | 0 | 1 |
| 38. Erweiterte Visualisierung | 13 | 0 | 0 | 1 | 0 | 12 |
| 39. Mathematik-Eingabe | 12 | 2 | 0 | 2 | 0 | 8 |
| 40. KI-Funktionen | 12 | 4 | 0 | 7 | 0 | 1 |
| 41. Qualitätskontrolle der Berechnungen | 10 | 4 | 0 | 4 | 0 | 2 |
| 42. Professionelle CAS-Funktionen | 17 | 0 | 12 | 2 | 0 | 3 |
| 43. Differentialgleichungen | 11 | 0 | 4 | 3 | 0 | 4 |
| 44. Erweiterte 3D-Mathematik | 13 | 0 | 2 | 1 | 0 | 10 |
| 45. Architektur der App | 16 | 5 | 0 | 4 | 0 | 7 |
| 46. Kernanforderung für eine vollständige CAS-App | 16 | 5 | 0 | 5 | 0 | 6 |
| Minimaler Funktionsumfang | 28 | 9 | 2 | 6 | 0 | 11 |

## Gefundene Fehler

1. `20% * 150` bringt den Rechenkern zum Absturz (Giac-Ausnahme); Prozent wird nicht übersetzt.
2. `implicitdiff(...)` bringt den Rechenkern ebenfalls zum Absturz.
3. Die Näherung (≈) zeigt bei mehreren Werten nur den ersten: `eigenvals`, `linear_regression`.
4. `taylor(...)` hängt `order_size(x)` an.
5. Physikalische Konstanten (`_c_`) werden nicht als Wert angezeigt.
6. `rand(1, 6)` liefert eine Kommazahl, `randvector(n, 6)` zählt 0–5.
7. `näherung(pi, 30)` zeigt trotzdem nur 10 Stellen.
8. Ungleichungen kommen als `x>-2 and x<2` statt als Intervall `]-2; 2[`.
9. Geometrie-Ergebnisse (`inter`, `plane`) erscheinen als Giac-Rohtext.

## 1. Grundfunktionen

- [x] Wissenschaftlicher Taschenrechner
- [x] Grundrechenarten
- [x] Bruchrechnung
- [x] Dezimalrechnung
- [!] Prozentrechnung — Fehler: „20% * 150“ bringt den Rechenkern zum Absturz; 0.2*150 geht
- [x] Potenzen
- [x] Wurzeln
- [x] Fakultät
- [x] Absolutwert
- [x] Vorzeichenwechsel — in der App: über Minus-Taste; keine eigene ±-Taste
- [x] Klammerrechnung
- [x] Prioritätsregeln
- [x] Exakte Berechnung
- [~] Numerische Näherungswerte — teilweise: immer 10 Stellen; näherung(pi, 30) zeigt trotzdem nur 10
- [x] Automatische Vereinfachung — in der App: Giac vereinfacht exakt, z. B. √72 → 6√2
- [~] Einheitenunterstützung — nur Befehl: Giac-Einheiten wie 3_m + 20_cm, convert(...); keine Taste, keine Hilfe
- [x] Konstanten wie π und e
- [!] Physikalische Konstanten — Fehler: _c_ wird nicht als Zahl ausgewertet angezeigt

## 2. CAS – Computer Algebra System

- [x] Symbolische Variablen
- [x] Symbolische Ausdrücke
- [x] Algebraische Vereinfachung
- [x] Ausmultiplizieren
- [x] Faktorisieren
- [x] Zusammenfassen — in der App: vereinfache(...)
- [x] Kürzen
- [~] Partialbruchzerlegung — nur Befehl: partfrac(...), subst(...)
- [~] Ersetzen von Variablen — nur Befehl: partfrac(...), subst(...)
- [~] Substitution — nur Befehl: partfrac(...), subst(...)
- [x] Ausdrücke expandieren
- [x] Exakte Brüche
- [x] Exakte Wurzeln
- [x] Exakte trigonometrische Werte
- [x] Symbolische Konstanten
- [~] Annahmen über Variablen — nur Befehl: assume(a>0)
- [ ] Definitionsbereiche — fehlt: keine Ausgabe der Definitionsmenge
- [~] Bedingungen für Variablen — nur Befehl: assume(...)

## 3. Gleichungen

- [x] Lineare Gleichungen
- [x] Quadratische Gleichungen
- [x] Polynomgleichungen
- [x] Bruchgleichungen
- [x] Wurzelgleichungen
- [x] Exponentialgleichungen
- [x] Logarithmische Gleichungen
- [x] Trigonometrische Gleichungen
- [x] Betragsgleichungen
- [x] Parameterabhängige Gleichungen
- [x] Gleichungssysteme
- [x] Nichtlineare Gleichungssysteme
- [x] Exakte Lösungen
- [~] Numerische Lösungen — nur Befehl: fsolve(...); löse() liefert exakt plus Näherung
- [~] Mehrere Lösungszweige — teilweise: alle Lösungen im Intervall [0; 2π) statt allgemeiner Form mit k·2π
- [~] Komplexe Lösungen — nur Befehl: csolve(...)
- [ ] Lösungsprüfung — fehlt: keine automatische Probe
- [ ] Schrittweise Lösungsdarstellung — fehlt: der Rechner zeigt nur das Ergebnis; der KI-Tutor erklärt in Dokumenten

## 4. Ungleichungen

- [~] Lineare Ungleichungen — teilweise: Lösung stimmt, aber als „x>-2 and x<2“ statt Intervall ]-2; 2[
- [~] Quadratische Ungleichungen — teilweise: Lösung stimmt, aber als „x>-2 and x<2“ statt Intervall ]-2; 2[
- [~] Polynom-Ungleichungen — teilweise: Lösung stimmt, aber als „x>-2 and x<2“ statt Intervall ]-2; 2[
- [~] Bruch-Ungleichungen — teilweise: Lösung stimmt, aber als „x>-2 and x<2“ statt Intervall ]-2; 2[
- [~] Wurzel-Ungleichungen — teilweise
- [~] Exponential-Ungleichungen — teilweise
- [~] Logarithmische Ungleichungen — teilweise
- [~] Trigonometrische Ungleichungen — teilweise
- [~] Betragsungleichungen — teilweise: Lösung stimmt, aber als „x>-2 and x<2“ statt Intervall ]-2; 2[
- [ ] Ungleichungssysteme — fehlt: nicht geprüft/angeboten
- [ ] Intervalllösungen — fehlt: keine Intervallschreibweise
- [ ] Grafische Lösungsdarstellung
- [ ] Automatische Vorzeichenanalyse — fehlt: keine Vorzeichentabelle

## 5. Funktionen

- [x] Funktionsdefinitionen
- [x] Verkettete Funktionen
- [~] Umkehrfunktionen — teilweise: über löse(y=…, x), kein eigener Befehl
- [~] Parameterfunktionen — teilweise: Parameter als Variable definierbar, kein Schieberegler
- [~] Stückweise definierte Funktionen — nur Befehl: piecewise(...), Ausgabe unschön
- [x] Polynomfunktionen
- [x] Gebrochen-rationale Funktionen
- [x] Potenzfunktionen
- [x] Wurzelfunktionen
- [x] Exponentialfunktionen
- [x] Logarithmusfunktionen
- [x] Sinus
- [x] Kosinus
- [x] Tangens
- [~] Arkussinus — nur Befehl: asin/acos/atan eintippbar, keine Taste
- [~] Arkuskosinus — nur Befehl: asin/acos/atan eintippbar, keine Taste
- [~] Arkustangens — nur Befehl: asin/acos/atan eintippbar, keine Taste
- [~] Hyperbelfunktionen — nur Befehl: sinh, cosh, tanh eintippbar, keine Taste
- [x] Betragsfunktionen
- [~] Floor/Ceiling-Funktionen — nur Befehl: floor, ceil
- [~] Signum-Funktion — nur Befehl: sign

## 6. Funktionsanalyse

- [ ] Definitionsmenge
- [ ] Wertebereich
- [x] Nullstellen — in der App: im Graph-Modus automatisch markiert, nullstellen(...) im Rechner
- [x] y-Achsenabschnitt — in der App: im Graph-Modus automatisch markiert, nullstellen(...) im Rechner
- [x] x-Achsenabschnitte — in der App: im Graph-Modus automatisch markiert, nullstellen(...) im Rechner
- [x] Extrempunkte — in der App: im Graph-Modus automatisch markiert, nullstellen(...) im Rechner
- [x] Hochpunkte — in der App: im Graph-Modus automatisch markiert, nullstellen(...) im Rechner
- [x] Tiefpunkte — in der App: im Graph-Modus automatisch markiert, nullstellen(...) im Rechner
- [~] Wendepunkte — teilweise: nur über löse(ableiten(f,x,2)=0)
- [ ] Sattel-/Terrassenpunkte
- [~] Polstellen — teilweise: Graph erkennt Sprünge, keine Ausgabe als Polstelle
- [ ] Lücken
- [~] Asymptoten — teilweise: über grenzwert(...), keine Asymptoten-Ausgabe
- [x] Schnittpunkte — in der App: im Graph-Modus automatisch markiert, nullstellen(...) im Rechner
- [ ] Monotonie
- [ ] Krümmung
- [ ] Vorzeichenbereiche
- [x] Grenzwerte — in der App: grenzwert(...)
- [x] Verhalten im Unendlichen — in der App: grenzwert(f, x, unendlich)
- [x] Funktionswertberechnung — in der App: f(3)
- [x] Tangenten — in der App: tangente(f, a)
- [ ] Sekanten
- [~] Normale — teilweise: nur von Hand zusammengesetzt
- [ ] Vollständige Funktionsuntersuchung

## 7. Differentialrechnung

- [x] Erste Ableitung
- [x] Zweite Ableitung
- [x] Höhere Ableitungen
- [x] Partielle Ableitungen — in der App: ableiten(f, y)
- [~] Gradient — nur Befehl: grad(f, [x, y])
- [ ] Richtungsableitung
- [~] Produktregel — teilweise: rechnet richtig, zeigt die Regel aber nicht
- [~] Quotientenregel — teilweise: rechnet richtig, zeigt die Regel aber nicht
- [~] Kettenregel — teilweise: rechnet richtig, zeigt die Regel aber nicht
- [!] Implizite Ableitung — Fehler: implicitdiff(...) bringt den Rechenkern zum Absturz
- [ ] Parametrische Ableitung
- [ ] Numerische Ableitung
- [~] Ableitungsgraph — teilweise: ableiten(f) in den Graph eintragen, nicht automatisch
- [x] Tangentensteigung
- [~] Normale — teilweise: nur von Hand
- [~] Extremwertanalyse — teilweise: Graph markiert Extrempunkte, keine hinreichende Bedingung
- [ ] Kurvendiskussion — fehlt: keine vollständige Kurvendiskussion

## 8. Integralrechnung

- [x] Unbestimmte Integrale
- [x] Bestimmte Integrale
- [x] Stammfunktionen
- [~] Numerische Integration — nur Befehl: romberg(...)
- [~] Flächen unter Funktionen — teilweise: Wert ja, keine Flächenmarkierung im Graph
- [~] Flächen zwischen Funktionen — teilweise: integriere(f-g, …) von Hand, keine Flächenmarkierung im Graph
- [x] Uneigentliche Integrale
- [~] Parametrische Integrale — teilweise: Parameter möglich
- [~] Mehrfachintegrale — teilweise: verschachtelt integriere(integriere(...))
- [ ] Flächenintegrale
- [~] Volumenberechnung — teilweise: über die Formel von Hand
- [~] Rotationsvolumen — teilweise: π·integriere(f², …) von Hand
- [~] Mittelwert einer Funktion — teilweise: von Hand
- [~] Hauptsatz der Differential- und Integralrechnung — teilweise: rechnet, erklärt nicht

## 9. Grenzwerte und Reihen

- [x] Grenzwerte
- [x] Rechtsseitige Grenzwerte
- [x] Linksseitige Grenzwerte
- [x] Grenzwerte gegen ±∞
- [~] Folgen — nur Befehl: seq(...)
- [x] Reihen
- [~] Konvergenz — teilweise: über den Grenzwert, keine Aussage „konvergent“
- [~] Divergenz — teilweise: über den Grenzwert
- [x] Geometrische Reihen
- [~] Potenzreihen — nur Befehl: series(...)
- [!] Taylorreihen — Fehler: taylor(...) hängt „order_size(x)“ an
- [!] Maclaurinreihen — Fehler: wie Taylor
- [!] Taylorpolynome — Fehler: wie Taylor
- [ ] Restglied-/Fehlerbetrachtung

## 10. Numerische Mathematik

- [~] Numerische Nullstellensuche — nur Befehl: fsolve(...); der Graph findet Nullstellen numerisch
- [~] Newton-Verfahren — nur Befehl: newton(...), ohne Schritte
- [ ] Bisektionsverfahren
- [ ] Iterationsverfahren
- [~] Numerische Integration — nur Befehl: romberg(...)
- [ ] Numerische Ableitung
- [~] Numerische Gleichungslösung — nur Befehl: fsolve(...)
- [x] Näherungslösungen — in der App: jedes Ergebnis auch als Dezimalzahl
- [ ] Fehlerabschätzung
- [ ] Rundungsfehleranalyse
- [ ] Iterationsvisualisierung

## 11. 2D-Grafik

- [x] Funktionsplotter — in der App: Graph-Modus
- [~] Mehrere Funktionen gleichzeitig — teilweise: bis zu 3 Funktionen
- [ ] Parametrische Kurven
- [ ] Polarkurven
- [ ] Implizite Kurven
- [ ] Gleichungen grafisch darstellen
- [ ] Ungleichungen grafisch darstellen
- [ ] Punkte
- [ ] Geraden
- [ ] Strecken
- [ ] Strahlen
- [ ] Kreise
- [ ] Ellipsen
- [~] Parabeln — teilweise: als Funktionsgraph
- [ ] Hyperbeln
- [ ] Kegelschnitte
- [ ] Freies Zoomen — fehlt: nur x-Bereich eintippen, keine Geste
- [ ] Verschieben des Koordinatensystems
- [x] Raster
- [x] Achsen
- [x] Achsenbeschriftungen
- [~] Dynamische Skalierung — teilweise: y-Bereich automatisch, x-Bereich per Eingabe
- [ ] Logarithmische Achsen
- [ ] Koordinatenanzeige — fehlt: kein Antippen/Nachfahren
- [x] Punktkoordinaten — in der App: besondere Punkte mit Koordinaten

## 12. Dynamische Mathematik

- [~] Dynamische Variablen — teilweise: a = 5 definieren, Graph muss neu gezeichnet werden
- [ ] Abhängige Objekte
- [ ] Automatische Neuberechnung
- [ ] Schieberegler
- [ ] Animierte Parameter
- [ ] Animationen
- [ ] Abhängigkeiten zwischen Objekten
- [ ] Dynamische Bedingungen
- [ ] Bedingte Sichtbarkeit
- [ ] Spuren/Trajektorien
- [ ] Ortslinien
- [ ] Interaktive Modelle
- [ ] Reset-Funktion

## 13. Geometrie

- [ ] Punkte
- [ ] Punkt auf Objekt
- [~] Schnittpunkte — nur Befehl: inter(...) rechnet, Ausgabe unlesbar
- [ ] Geraden
- [ ] Strecken
- [ ] Strahlen
- [ ] Parallelen
- [ ] Senkrechten
- [ ] Mittelsenkrechten
- [ ] Winkelhalbierenden
- [ ] Tangenten
- [ ] Kreise
- [ ] Kreisbögen
- [ ] Kreissektoren
- [ ] Polygone
- [ ] Dreiecke
- [ ] Vierecke
- [ ] Regelmäßige Polygone
- [~] Winkel — teilweise: über Vektoren
- [ ] Längen
- [~] Abstände — nur Befehl: distance(...)
- [ ] Flächen
- [ ] Umfänge
- [ ] Höhen
- [ ] Schwerpunkt
- [ ] Inkreismittelpunkt
- [ ] Umkreismittelpunkt
- [ ] Eulergerade

## 14. Geometrische Transformationen

- [ ] Translation
- [ ] Rotation
- [ ] Spiegelung an einer Geraden
- [ ] Spiegelung an einem Punkt
- [ ] Streckung
- [ ] Zentrische Streckung
- [ ] Affine Transformationen
- [~] Transformation mit Matrizen — teilweise: Matrix · Vektor rechnet, ohne Darstellung
- [ ] Transformationen animieren
- [ ] Original und Bild gleichzeitig darstellen

## 15. Analytische Geometrie

- [x] 2D-Vektoren — in der App: [3, 4] als Liste
- [x] 3D-Vektoren — in der App: [1, 2, 3]
- [x] Vektoraddition
- [x] Vektorsubtraktion
- [x] Skalarmultiplikation
- [~] Betrag eines Vektors — nur Befehl: norm(...)
- [~] Einheitsvektoren — nur Befehl: normalize(...)
- [~] Skalarprodukt — nur Befehl: dot(...)
- [~] Kreuzprodukt — nur Befehl: cross(...)
- [~] Winkel zwischen Vektoren — teilweise: Formel von Hand
- [~] Orthogonalität — teilweise: über dot(...)=0
- [~] Parallelität — teilweise: von Hand
- [~] Geradengleichungen — teilweise: Giac-Geometriebefehle (line, plane, …) rechnen, Ausgabe ist aber unlesbar
- [~] Ebenengleichungen — teilweise: Giac-Geometriebefehle (line, plane, …) rechnen, Ausgabe ist aber unlesbar
- [~] Parameterform — teilweise: Giac-Geometriebefehle (line, plane, …) rechnen, Ausgabe ist aber unlesbar
- [~] Normalenform — teilweise: Giac-Geometriebefehle (line, plane, …) rechnen, Ausgabe ist aber unlesbar
- [~] Koordinatenform — teilweise: Giac-Geometriebefehle (line, plane, …) rechnen, Ausgabe ist aber unlesbar
- [~] Hesse-Normalform — teilweise: Giac-Geometriebefehle (line, plane, …) rechnen, Ausgabe ist aber unlesbar
- [~] Lagebeziehungen — teilweise: Giac-Geometriebefehle (line, plane, …) rechnen, Ausgabe ist aber unlesbar
- [!] Schnittpunkte — Fehler: inter(...) rechnet, zeigt aber „group[pnt(...)]“
- [~] Schnittgeraden — teilweise: Giac-Geometriebefehle (line, plane, …) rechnen, Ausgabe ist aber unlesbar
- [~] Abstände — nur Befehl: distance(point(...), plane(...)) korrekt
- [~] Lotfußpunkte — teilweise: Giac-Geometriebefehle (line, plane, …) rechnen, Ausgabe ist aber unlesbar
- [~] Spiegelpunkte — teilweise: Giac-Geometriebefehle (line, plane, …) rechnen, Ausgabe ist aber unlesbar

## 16. 3D-Rechner

- [ ] 3D-Koordinatensystem
- [ ] 3D-Punkte
- [ ] 3D-Geraden
- [ ] 3D-Strecken
- [ ] Ebenen
- [ ] Kugeln
- [ ] Zylinder
- [ ] Kegel
- [ ] Prismen
- [ ] Pyramiden
- [ ] Polyeder
- [ ] 3D-Funktionen
- [ ] Parametrische Flächen
- [ ] Implizite Flächen
- [ ] Schnittflächen
- [ ] Schnittkurven
- [ ] 3D-Abstände
- [ ] 3D-Winkel
- [ ] 3D-Transformationen
- [ ] Freies Drehen
- [ ] Zoomen
- [ ] Perspektivische Darstellung
- [ ] Orthografische Darstellung
- [ ] 3D-Animationen

## 17. Matrizen

- [x] Matrizen erstellen
- [x] Matrixaddition
- [x] Matrixsubtraktion
- [x] Matrixmultiplikation
- [x] Matrix-Vektor-Multiplikation
- [x] Transponieren
- [x] Determinante
- [x] Inverse Matrix
- [~] Rang — nur Befehl: rank(...)
- [!] Eigenwerte — Fehler: eigenvals(...) rechnet, Näherungsanzeige verschluckt Werte
- [~] Eigenvektoren — nur Befehl: eigenvects(...)
- [x] Lineare Gleichungssysteme — in der App: löse([…], [x, y])
- [~] Gauß-Verfahren — nur Befehl: rref(...), ohne Schritte
- [~] Matrixzerlegungen — nur Befehl: lu(...), qr(...)
- [~] Lineare Transformationen — teilweise: nur rechnerisch

## 18. Komplexe Zahlen

- [x] Komplexe Zahlen — in der App: i eintippbar
- [~] Realteil — nur Befehl
- [~] Imaginärteil — nur Befehl
- [x] Betrag — in der App: betrag(3+4i)
- [~] Argument — nur Befehl
- [~] Konjugation — nur Befehl
- [~] Polarform — nur Befehl
- [~] Exponentialform — nur Befehl
- [~] Komplexe Gleichungen — nur Befehl
- [ ] Gaußsche Zahlenebene
- [~] Komplexe Funktionen — teilweise: rechnet, kein Plot

## 19. Folgen

- [~] Arithmetische Folgen — teilweise
- [~] Geometrische Folgen — teilweise
- [ ] Rekursive Folgen — fehlt: seqsolve fehlt in dieser Giac-Version
- [~] Explizite Folgen — nur Befehl: seq(k^2, k, 1, 6)
- [ ] Fibonacci-Folge — fehlt: fibonacci(...) wird nicht ausgewertet
- [ ] Folgeniteration
- [ ] Folgen grafisch darstellen
- [x] Grenzwerte von Folgen — in der App: grenzwert(a(n), n, unendlich)
- [ ] Rekursionsdiagramme

## 20. Statistik

- [~] Dateneingabe — teilweise: als Liste [1, 2, 3] in der Eingabezeile
- [ ] Tabellenkalkulation
- [ ] Häufigkeitstabellen
- [~] Absolute Häufigkeit — teilweise: über frequencies(...) · n
- [~] Relative Häufigkeit — nur Befehl: frequencies(...)
- [x] Mittelwert — in der App: Taste mittelwert
- [x] Median — in der App: Schul-Median (Mittel der beiden mittleren Werte)
- [ ] Modus — fehlt: mode(...) gibt es in dieser Giac-Version nicht
- [~] Minimum — nur Befehl: min(...)
- [~] Maximum — nur Befehl: max(...)
- [~] Spannweite — teilweise: max − min von Hand
- [!] Quartile — Fehler: quartiles(...) rechnet, Ausgabe schwer lesbar
- [~] Quantile — nur Befehl: quantile(...)
- [x] Varianz — in der App: varianz(...)
- [x] Standardabweichung — in der App: Taste; Achtung: Grundgesamtheit, stddevp für Stichprobe
- [ ] Standardfehler
- [ ] Boxplot
- [ ] Histogramm
- [~] Balkendiagramm — teilweise: KI-Diagramme in Notizen/Präsentationen, nicht im Rechner
- [ ] Kreisdiagramm
- [ ] Streudiagramm

## 21. Regression

- [!] Lineare Regression — Fehler: linear_regression(...) rechnet, Näherungsanzeige verschluckt einen Wert
- [~] Quadratische Regression — nur Befehl: polynomial_regression(..., 2)
- [~] Polynomiale Regression — nur Befehl: polynomial_regression(...)
- [!] Exponentielle Regression — Fehler: exakte Ausgabe riesig und unlesbar
- [~] Logarithmische Regression — nur Befehl: logarithmic_regression(...)
- [~] Potenzregression — nur Befehl: power_regression(...)
- [ ] Sinusregression
- [ ] Modellvergleich
- [ ] Regressionsgleichung
- [~] Bestimmtheitsmaß — teilweise: correlation(...)² von Hand
- [ ] Residuen
- [ ] Residuenplot

## 22. Wahrscheinlichkeitsrechnung

- [~] Binomialverteilung — nur Befehl: binomial(n, k, p), binomial_cdf(...)
- [~] Normalverteilung — nur Befehl: normal_cdf, normal_icdf
- [~] Poissonverteilung — nur Befehl
- [~] Geometrische Verteilung — nur Befehl
- [~] Hypergeometrische Verteilung — teilweise: über nck(...) von Hand
- [~] Gleichverteilung — teilweise: von Hand
- [~] Exponentialverteilung — nur Befehl
- [~] Wahrscheinlichkeitsdichte — nur Befehl
- [~] Verteilungsfunktion — nur Befehl
- [~] Erwartungswert — teilweise: Formel von Hand
- [~] Varianz — teilweise: Formel von Hand
- [~] Standardabweichung — teilweise: Formel von Hand
- [~] Quantile — nur Befehl
- [~] Wahrscheinlichkeitsintervalle — teilweise: über cdf-Differenzen
- [ ] Interaktive Verteilungsparameter

## 23. Stochastische Simulationen

- [~] Würfelsimulation — teilweise: randvector(n, 6) zählt 0–5 statt 1–6
- [ ] Münzwurfsimulation
- [!] Zufallszahlen — Fehler: rand(1, 6) liefert eine Kommazahl statt einer Würfelzahl
- [ ] Zufallsexperimente
- [ ] Monte-Carlo-Simulation
- [ ] Wiederholte Experimente
- [ ] Relative Häufigkeiten
- [ ] Gesetz der großen Zahlen
- [ ] Simulation von Verteilungen

## 24. Statistische Tests

- [ ] Hypothesentests
- [~] Binomialtest — teilweise: über binomial_cdf von Hand
- [ ] Mittelwerttests
- [ ] Varianztests
- [ ] Chi-Quadrat-Tests
- [~] Konfidenzintervalle — teilweise: Formel von Hand, Quantile über normal_icdf/student_icdf
- [ ] p-Werte
- [~] Signifikanzniveau — teilweise: nur als Zahl in eigenen Rechnungen
- [ ] Teststatistik
- [ ] Ein- und zweiseitige Tests

## 25. Tabellenkalkulation

- [ ] Tabellen
- [ ] Zellformeln
- [ ] Zellbezüge
- [ ] Absolute Zellbezüge
- [ ] Relative Zellbezüge
- [ ] Automatisches Ausfüllen
- [ ] Datenreihen
- [ ] Sortieren
- [ ] Filtern
- [ ] Statistische Funktionen
- [ ] Mathematische Funktionen
- [ ] Diagramme
- [ ] Verbindung zwischen Tabelle und Grafik
- [ ] Verbindung zwischen Tabelle und CAS

## 26. Einheiten

- [~] Längeneinheiten — nur Befehl
- [~] Flächeneinheiten — nur Befehl
- [~] Volumeneinheiten — nur Befehl
- [~] Zeiteinheiten — nur Befehl
- [~] Geschwindigkeit — nur Befehl
- [~] Beschleunigung — nur Befehl
- [~] Masse — nur Befehl
- [~] Kraft — nur Befehl
- [~] Energie — nur Befehl
- [~] Leistung — nur Befehl
- [~] Druck — nur Befehl
- [~] Temperatur — teilweise: Giac kennt °C/K, Umrechnung mit Nullpunkt heikel
- [x] Winkel — in der App: Umschalter Grad/Bogenmaß
- [~] Automatische Einheitenumrechnung — nur Befehl
- [~] Dimensionsprüfung — teilweise: Giac lehnt m + s ab, Meldung unverständlich

## 27. Physikalische Mathematik

- [~] Vektorgrößen — teilweise
- [~] Skalare — teilweise
- [~] Bewegungsfunktionen — teilweise
- [~] Geschwindigkeit — teilweise
- [~] Beschleunigung — teilweise
- [~] Wurfbewegungen — teilweise
- [~] Kreisbewegungen — teilweise
- [~] Energie — teilweise
- [~] Arbeit — teilweise
- [~] Kräfte — teilweise
- [~] Einheitenumrechnung — nur Befehl: convert(...)
- [!] Physikalische Konstanten — Fehler: _c_ usw. werden nicht als Wert angezeigt
- [ ] Dynamische physikalische Modelle

## 28. Interaktive Benutzeroberfläche

- [ ] Schieberegler
- [x] Eingabefelder
- [ ] Checkboxen
- [x] Buttons
- [~] Dropdown-Menüs — teilweise: Grad/Bogenmaß
- [ ] Dynamische Texte
- [ ] Dynamische Werte
- [ ] Bedingte Sichtbarkeit
- [ ] Tooltips
- [~] Kontextmenüs — teilweise: im Verlauf
- [ ] Drag & Drop
- [x] Touch-Unterstützung
- [~] Stiftunterstützung — teilweise: in Notizen („Rechnen in Notizen“), nicht im Rechner
- [ ] Multi-Touch
- [ ] Zoom-Gesten

## 29. Animation

- [ ] Automatische Animation
- [ ] Manuelle Animation
- [ ] Animationsgeschwindigkeit
- [ ] Animationsrichtung
- [ ] Wiederholung
- [ ] Start/Stopp
- [ ] Pause
- [ ] Reset
- [ ] Animierte Schieberegler
- [ ] Animierte Punkte
- [ ] Animierte geometrische Konstruktionen
- [ ] Animierte Funktionen

## 30. Skripting

- [ ] Ereignisse
- [ ] Klickaktionen
- [ ] Objektänderungen
- [ ] Bedingungen
- [ ] Variablen setzen
- [ ] Objekte erzeugen
- [ ] Objekte löschen
- [ ] Animation starten
- [ ] Animation stoppen
- [ ] Konstruktion zurücksetzen
- [ ] Benutzerinteraktionen programmieren
- [ ] Eigene mathematische Werkzeuge

## 31. Programmier-/Entwicklerfunktionen

- [~] Eigene Befehle — nur Befehl: Giac-Programme g(n):={…}
- [x] Benutzerdefinierte Funktionen — in der App: f(x) = …, bleibt nach Neustart erhalten
- [~] Listenverarbeitung — nur Befehl: map, seq, sum
- [~] Schleifenähnliche Konstruktionen — nur Befehl: for/while in Giac-Programmen
- [~] Bedingungen — nur Befehl: if/else in Giac-Programmen
- [!] Rekursion — Fehler: rekursive Programme laufen, die Definition zeigt aber eine Fehlermeldung
- [ ] Skripte
- [ ] JavaScript-Integration
- [ ] JavaScript API
- [ ] Einbettung in Webseiten
- [ ] Zugriff auf mathematische Objekte über API
- [ ] Dynamische Kommunikation zwischen Webseite und Rechner

## 32. Lernfunktionen

- [ ] Schritt-für-Schritt-Lösungen
- [~] Mathematische Erklärungen — teilweise: KI-Tutor in Dokumenten, nicht im Rechner
- [~] Interaktive Aufgaben — teilweise: Übungsaufgaben aus dem Lernplan
- [~] Automatische Aufgaben — teilweise: Übungsaufgaben pro Thema im Lernplan
- [~] Übungsmodus — teilweise: Karteikarten (Wiederholen-Tab)
- [~] Sofortiges Feedback — teilweise: Tutor und Karteikarten
- [ ] Fehleranalyse
- [ ] Ähnliche Aufgaben generieren
- [~] Lernfortschritt — teilweise: Lernplan und Wiederholen
- [ ] Aufgabenserien
- [ ] Schwierigkeitsstufen

## 33. Dokumente und Materialien

- [~] Textfelder — teilweise
- [~] Überschriften — teilweise
- [~] Bilder — teilweise
- [ ] Videos
- [~] mathematische Konstruktionen — teilweise: Graph als Seite in ein Dokument einfügen
- [ ] interaktive Aufgaben
- [~] mehrere Seiten — teilweise
- [ ] Kapitel
- [ ] Lernbücher
- [x] Präsentationsmodus — in der App: Präsentationen-Tab
- [~] Materialien speichern — teilweise
- [~] Materialien teilen — teilweise

## 34. Dateisystem

- [ ] Projektdateien — fehlt: Rechner-Verlauf ist kein eigenes Dokument
- [~] Import — teilweise
- [~] Export — teilweise
- [x] Speichern
- [x] Autosave — in der App: Verlauf und Definitionen werden gespeichert
- [ ] Versionsverwaltung
- [ ] Cloud-Speicherung
- [ ] Teilen per Link
- [ ] Import von Daten
- [ ] Export von Daten
- [~] Export als Bild — teilweise: Graph als Dokumentseite
- [~] Export als PDF — teilweise: über das Dokument
- [~] Export mathematischer Ergebnisse — teilweise: Ergebnis in Notizen übernehmen

## 35. Prüfung / Exam Mode

- [ ] Prüfungsmodus
- [ ] Einschränkung bestimmter Funktionen
- [ ] Kontrollierter Funktionsumfang
- [ ] Sperrung externer Inhalte
- [ ] Prüfungsstatus
- [ ] sichtbare Statusanzeige
- [ ] Zurücksetzen nach Prüfung

## 36. Bedienkomfort

- [ ] Suchfunktion für Befehle
- [ ] Autovervollständigung
- [ ] Syntax-Hervorhebung
- [x] mathematische Tastatur — in der App: eigene Tastatur mit Befehlstasten
- [x] Verlauf — in der App: mit ans und Wiederverwenden
- [~] Rückgängig — teilweise: ⌫/AC, kein Undo
- [ ] Wiederholen
- [ ] Favoriten
- [ ] zuletzt verwendete Befehle
- [ ] Tastaturkürzel
- [~] Kontextabhängige Werkzeuge — teilweise
- [ ] Hilfetexte
- [ ] Befehlsdokumentation

## 37. Mobile Funktionen

- [x] Touch-Bedienung
- [~] Stift — teilweise: in Notizen
- [x] Multi-Touch
- [~] Smartphone-Oberfläche — teilweise: für iPad/Tablet gebaut, Telefon geht, ist aber eng
- [x] Tablet-Oberfläche
- [x] Querformat
- [x] Hochformat
- [x] mobile Werkzeugleiste
- [x] mobile Tastatur
- [ ] Kameraeingabe
- [x] Handschrifterkennung — in der App: „Rechnen in Notizen“: geschriebene Rechnung mit = wird erkannt und gerechnet
- [~] Foto mathematischer Aufgaben — teilweise: Foto als Dokument importieren, dann Tutor fragen

## 38. Erweiterte Visualisierung

- [ ] frei konfigurierbare Farben
- [ ] Linienarten
- [ ] Linienstärke
- [ ] Punktgrößen
- [ ] Transparenz
- [ ] Füllungen
- [~] Beschriftungen — teilweise: besondere Punkte beschriftet
- [ ] dynamische Beschriftungen
- [ ] Achsenkonfiguration
- [ ] Rasterkonfiguration
- [ ] logarithmische Skalierung
- [ ] mehrere Koordinatensysteme
- [ ] benutzerdefinierte Ansichten

## 39. Mathematik-Eingabe

- [ ] LaTeX-Eingabe
- [ ] Brucheditor
- [ ] Wurzeleditor
- [ ] Integraleditor
- [ ] Summeneditor
- [~] Matrixeditor — teilweise: Matrix-Vorlage [[ , ], [ , ]], Ausgabe als Tabelle
- [ ] Indexe
- [x] Exponenten — in der App: x², xⁿ-Taste, hochgestellte Ausgabe
- [~] griechische Buchstaben — teilweise: π, sonst als Wort (alpha)
- [x] mathematische Symbole — in der App: √, π, ≤, ≥, ≠, ×, ÷ werden verstanden
- [ ] Autovervollständigung
- [ ] natürliche mathematische Eingabe

## 40. KI-Funktionen

- [~] Erkennung fotografierter Aufgaben — teilweise: Foto als Dokument, Tutor liest die Seite
- [x] automatische Texterkennung — in der App: OCR für Dokumente, Handschrift in Notizen
- [x] automatische mathematische Interpretation — in der App: Rechnen in Notizen
- [~] Schritt-für-Schritt-Erklärungen — teilweise: sokratischer Tutor, bewusst mit Gegenfragen statt Lösungsweg
- [~] Fehlererkennung — teilweise
- [~] alternative Lösungswege — teilweise
- [x] automatische Aufgabengenerierung — in der App: Übungsaufgaben im Lernplan
- [~] Schwierigkeitsanpassung — teilweise: Hinweisstufen des Tutors
- [ ] natürliche Sprache → mathematische Formel
- [~] mathematische Formel → Erklärung — teilweise
- [~] Diagramm-/Graphenanalyse — teilweise: Tutor liest markierte Bereiche
- [x] interaktive KI-Nachhilfe — in der App: Tutor

## 41. Qualitätskontrolle der Berechnungen

- [~] Definitionsbereich prüfen — teilweise
- [x] verbotene Division durch 0 erkennen — in der App: Meldung „Division durch 0.“
- [x] Wurzelbedingungen prüfen — in der App: Giac verwirft Scheinlösungen, z. B. √(x+2)=x → {2}
- [~] Logarithmusbedingungen prüfen — teilweise
- [x] Scheinlösungen erkennen — in der App: siehe oben
- [~] numerische Stabilität berücksichtigen — teilweise: Giac rechnet exakt, Graph numerisch
- [ ] Rundungsfehler anzeigen
- [x] exakte/numerische Ergebnisse unterscheiden — in der App: exakt und ≈ getrennt
- [~] Lösungsmenge korrekt darstellen — teilweise: L = {…}, Ungleichungen nicht als Intervall
- [ ] Ergebnis automatisch verifizieren

## 42. Professionelle CAS-Funktionen

- [~] Symbolische Matrizen — nur Befehl
- [~] Eigenwertprobleme — nur Befehl
- [~] Differentialgleichungen — nur Befehl
- [~] Systeme von Differentialgleichungen — teilweise: desolve mit Systemen, nicht geprüft
- [ ] partielle Differentialgleichungen
- [~] Laplace-Transformation — nur Befehl
- [~] inverse Laplace-Transformation — nur Befehl
- [~] Fourier-Reihen — nur Befehl
- [ ] Fourier-Transformation — fehlt: nicht geprüft; Fourier-Koeffizienten per fourier_an
- [~] Z-Transformation — nur Befehl
- [~] symbolische Summen — nur Befehl
- [~] symbolische Produkte — nur Befehl
- [~] Reihenentwicklung — nur Befehl
- [~] Residuen — nur Befehl
- [~] komplexe Analysis — teilweise: residue(...) geht
- [~] Vektoranalysis — nur Befehl: divergence, curl, hessian
- [ ] Tensor-/Indexnotation

## 43. Differentialgleichungen

- [~] ODE erster Ordnung — nur Befehl: desolve(y'=2*y, y)
- [~] ODE höherer Ordnung — nur Befehl: desolve mit y''
- [~] Anfangswertprobleme — nur Befehl: desolve([…, y(0)=0], y)
- [~] Randwertprobleme — teilweise
- [~] Systeme von ODEs — teilweise
- [~] analytische Lösungen — nur Befehl: desolve
- [~] numerische Lösungen — teilweise: odesolve, nicht geprüft
- [ ] Richtungsfelder
- [ ] Lösungskurven
- [ ] Phasenporträts
- [ ] Parameterstudien

## 44. Erweiterte 3D-Mathematik

- [ ] Vektorfelder
- [ ] Skalarfelder
- [~] Gradientfelder — teilweise: grad(...) rechnerisch
- [~] Divergenz — nur Befehl: divergence(...)
- [~] Rotation/Curl — nur Befehl: curl(...)
- [ ] Fluss
- [ ] parametrische Flächen
- [ ] Flächennormalen
- [ ] Tangentialebenen
- [ ] Kurvenintegrale
- [ ] Flächenintegrale
- [ ] 3D-Ortslinien
- [ ] dynamische 3D-Simulationen

## 45. Architektur der App

- [x] zentrale CAS-Engine — in der App: Giac 1.9 (WebAssembly)
- [x] numerische Engine — in der App: Giac
- [x] 2D-Rendering-Engine — in der App: Graph und Folien
- [ ] 3D-Rendering-Engine
- [ ] Geometrie-Engine
- [~] Statistik-Engine — teilweise: Giac
- [~] Wahrscheinlichkeits-Engine — teilweise: Giac
- [~] Einheiten-Engine — teilweise: Giac
- [x] Plotting-Engine
- [x] Dokument-Engine — in der App: PDF-Dokumente mit Notizen
- [ ] Skript-Engine
- [ ] Plugin-/Erweiterungssystem
- [ ] API
- [ ] persistenter Objektgraph
- [~] Undo/Redo-System — teilweise: in Dokumenten und Präsentationen, nicht im Rechner
- [ ] Versions-/Dateisystem

## 46. Kernanforderung für eine vollständige CAS-App

- [x] Jede Berechnung kann exakt durchgeführt werden, wenn mathematisch möglich
- [x] Numerische Näherungen können explizit angefordert werden — in der App: näherung(...) und ≈ bei jedem Ergebnis
- [x] Algebraische Objekte bleiben symbolisch erhalten
- [x] Ergebnisse können direkt weiterverwendet werden — in der App: ans, Definitionen
- [~] Algebra und Grafik sind miteinander verbunden — teilweise: definierte f(x) im Graph nutzbar, aber getrennte Ansichten
- [ ] Änderungen werden automatisch propagiert
- [ ] 2D und 3D verwenden dieselbe mathematische Objektlogik
- [ ] CAS, Geometrie, Statistik und Tabellen greifen auf gemeinsame Objekte zu
- [ ] Jede Funktion ist über GUI und Kommando-/Eingabesystem erreichbar
- [~] Ergebnisse sind nachvollziehbar — teilweise: Ergebnis ja, Weg nein
- [~] Fehler werden mathematisch korrekt behandelt — teilweise: zwei Befehle stürzen ab (Prozent, implicitdiff)
- [~] Definitionsbedingungen werden automatisch berücksichtigt — teilweise: Giac beim Lösen, keine Anzeige
- [x] Exakte und approximierte Ergebnisse werden klar unterschieden
- [ ] Komplexe Konstruktionen bleiben editierbar
- [~] Große Berechnungen werden performant verarbeitet — teilweise: Giac im Hintergrund, kein Abbruch-Knopf
- [ ] Benutzer können eigene interaktive mathematische Modelle erstellen

## Minimaler Funktionsumfang

- [x] Vollständiges CAS — in der App: Giac
- [x] Wissenschaftlicher Rechner
- [~] 2D-Plotter — teilweise: 3 Funktionen, ohne Zoom-Geste
- [ ] 3D-Plotter
- [ ] Dynamische Geometrie
- [x] Differentialrechnung
- [x] Integralrechnung
- [x] Gleichungslöser
- [~] Ungleichungslöser — teilweise: ohne Intervalle
- [x] Matrizen
- [~] Vektoren — teilweise: ohne deutsche Befehle
- [~] Statistik — teilweise: Grundwerte
- [~] Regression — nur Befehl: nur Giac-Befehle
- [~] Wahrscheinlichkeitsrechnung — nur Befehl: nur Giac-Befehle
- [ ] Tabellenkalkulation
- [ ] Schieberegler
- [ ] Animation
- [ ] Skripting
- [ ] Interaktive Elemente
- [~] Datei-/Projektverwaltung — teilweise
- [~] Import/Export — teilweise
- [ ] Schritt-für-Schritt-Lösungen
- [ ] Prüfungssystem
- [x] KI-Unterstützung — in der App: Tutor, Rechnen in Notizen
- [ ] API
- [x] mobile Bedienung
- [x] Offline-Fähigkeit — in der App: Rechner komplett offline
- [ ] Cloud-Synchronisation

