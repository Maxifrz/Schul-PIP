# CAS-Rechner: Abgleich mit der Feature-Checkliste

Stand: 29.09.2026, nach Stufe 6 (Programme, Prüfungsmodus und der Rest) des neuen Rechners; zuerst geprüft am 28.09.2026, Commit f29962d. Geprüft am Code und mit rund 150 Beispielaufgaben gegen den echten Rechenkern (Giac 1.9 über `cas/web/cas.js`, wie in der App).

Legende: `[x]` in der App nutzbar (Taste, deutscher Befehl oder Graph-Ansicht) · `[~]` rechnet, aber nur per (meist englischem) Giac-Befehl ohne Taste/Hilfe, oder nur teilweise · `[!]` geht, aber mit Fehler · `[ ]` fehlt

## Zusammenfassung

703 Punkte: 607 in der App, 13 nur per Befehl, 72 teilweise, 0 mit Fehler, 11 fehlen.

| Kapitel | Punkte | in der App | nur Befehl | teilweise | Fehler | fehlt |
|---|---:|---:|---:|---:|---:|---:|
| 1. Grundfunktionen | 18 | 18 | 0 | 0 | 0 | 0 |
| 2. CAS – Computer Algebra System | 18 | 18 | 0 | 0 | 0 | 0 |
| 3. Gleichungen | 18 | 16 | 0 | 2 | 0 | 0 |
| 4. Ungleichungen | 13 | 9 | 0 | 4 | 0 | 0 |
| 5. Funktionen | 21 | 21 | 0 | 0 | 0 | 0 |
| 6. Funktionsanalyse | 24 | 24 | 0 | 0 | 0 | 0 |
| 7. Differentialrechnung | 17 | 17 | 0 | 0 | 0 | 0 |
| 8. Integralrechnung | 14 | 11 | 0 | 3 | 0 | 0 |
| 9. Grenzwerte und Reihen | 14 | 14 | 0 | 0 | 0 | 0 |
| 10. Numerische Mathematik | 11 | 11 | 0 | 0 | 0 | 0 |
| 11. 2D-Grafik | 25 | 25 | 0 | 0 | 0 | 0 |
| 12. Dynamische Mathematik | 13 | 13 | 0 | 0 | 0 | 0 |
| 13. Geometrie | 28 | 27 | 0 | 1 | 0 | 0 |
| 14. Geometrische Transformationen | 10 | 10 | 0 | 0 | 0 | 0 |
| 15. Analytische Geometrie | 24 | 24 | 0 | 0 | 0 | 0 |
| 16. 3D-Rechner | 24 | 21 | 0 | 3 | 0 | 0 |
| 17. Matrizen | 15 | 15 | 0 | 0 | 0 | 0 |
| 18. Komplexe Zahlen | 11 | 10 | 0 | 1 | 0 | 0 |
| 19. Folgen | 9 | 9 | 0 | 0 | 0 | 0 |
| 20. Statistik | 21 | 21 | 0 | 0 | 0 | 0 |
| 21. Regression | 12 | 12 | 0 | 0 | 0 | 0 |
| 22. Wahrscheinlichkeitsrechnung | 15 | 15 | 0 | 0 | 0 | 0 |
| 23. Stochastische Simulationen | 9 | 9 | 0 | 0 | 0 | 0 |
| 24. Statistische Tests | 10 | 10 | 0 | 0 | 0 | 0 |
| 25. Tabellenkalkulation | 14 | 14 | 0 | 0 | 0 | 0 |
| 26. Einheiten | 15 | 3 | 11 | 1 | 0 | 0 |
| 27. Physikalische Mathematik | 13 | 2 | 0 | 11 | 0 | 0 |
| 28. Interaktive Benutzeroberfläche | 15 | 13 | 0 | 2 | 0 | 0 |
| 29. Animation | 12 | 12 | 0 | 0 | 0 | 0 |
| 30. Skripting | 12 | 11 | 0 | 1 | 0 | 0 |
| 31. Programmier-/Entwicklerfunktionen | 12 | 11 | 1 | 0 | 0 | 0 |
| 32. Lernfunktionen | 11 | 7 | 0 | 4 | 0 | 0 |
| 33. Dokumente und Materialien | 12 | 1 | 0 | 8 | 0 | 3 |
| 34. Dateisystem | 13 | 10 | 0 | 1 | 0 | 2 |
| 35. Prüfung / Exam Mode | 7 | 7 | 0 | 0 | 0 | 0 |
| 36. Bedienkomfort | 13 | 12 | 0 | 1 | 0 | 0 |
| 37. Mobile Funktionen | 12 | 8 | 0 | 3 | 0 | 1 |
| 38. Erweiterte Visualisierung | 13 | 12 | 0 | 0 | 0 | 1 |
| 39. Mathematik-Eingabe | 12 | 10 | 0 | 2 | 0 | 0 |
| 40. KI-Funktionen | 12 | 4 | 0 | 8 | 0 | 0 |
| 41. Qualitätskontrolle der Berechnungen | 10 | 7 | 0 | 3 | 0 | 0 |
| 42. Professionelle CAS-Funktionen | 17 | 12 | 1 | 2 | 0 | 2 |
| 43. Differentialgleichungen | 11 | 10 | 0 | 1 | 0 | 0 |
| 44. Erweiterte 3D-Mathematik | 13 | 11 | 0 | 1 | 0 | 1 |
| 45. Architektur der App | 16 | 12 | 0 | 4 | 0 | 0 |
| 46. Kernanforderung für eine vollständige CAS-App | 16 | 12 | 0 | 4 | 0 | 0 |
| Minimaler Funktionsumfang | 28 | 26 | 0 | 1 | 0 | 1 |

## Gefundene Fehler

Alle neun sind seit Stufe 1 behoben und durch Tests abgedeckt (`cas/test/cas.test.js`), bis auf die Rohtext-Ausgabe von `inter(...)` (9); Schnittpunkte von Graphen zeigt die Grafik mit Koordinaten.

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
- [x] Prozentrechnung — in der App: 20% * 150 = 30
- [x] Potenzen
- [x] Wurzeln
- [x] Fakultät
- [x] Absolutwert
- [x] Vorzeichenwechsel — in der App: über Minus-Taste; keine eigene ±-Taste
- [x] Klammerrechnung
- [x] Prioritätsregeln
- [x] Exakte Berechnung
- [x] Numerische Näherungswerte — in der App: näherung(Term, Stellen), beliebig viele Stellen
- [x] Automatische Vereinfachung — in der App: Giac vereinfacht exakt, z. B. √72 → 6√2
- [x] Einheitenunterstützung — in der App: 3_m + 20_cm, umrechnen, si, einheiten(), temperatur
- [x] Konstanten wie π und e
- [x] Physikalische Konstanten — in der App: lichtgeschwindigkeit, _c_ als Wert mit Einheit

## 2. CAS – Computer Algebra System

- [x] Symbolische Variablen
- [x] Symbolische Ausdrücke
- [x] Algebraische Vereinfachung
- [x] Ausmultiplizieren
- [x] Faktorisieren
- [x] Zusammenfassen — in der App: vereinfache(...)
- [x] Kürzen
- [x] Partialbruchzerlegung — in der App: partialbruch(...)
- [x] Ersetzen von Variablen — in der App: ersetze(...)
- [x] Substitution — in der App: ersetze(...)
- [x] Ausdrücke expandieren
- [x] Exakte Brüche
- [x] Exakte Wurzeln
- [x] Exakte trigonometrische Werte
- [x] Symbolische Konstanten
- [x] Annahmen über Variablen — in der App: annahme(a > 0), vergiss(a)
- [x] Definitionsbereiche — in der App: definitionsmenge(f), in der Kurvendiskussion
- [x] Bedingungen für Variablen — in der App: annahme(...)

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
- [x] Numerische Lösungen — in der App: lösenumerisch(...)
- [~] Mehrere Lösungszweige — teilweise: alle Lösungen im Intervall [0; 2π) statt allgemeiner Form mit k·2π
- [x] Komplexe Lösungen — in der App: lösekomplex(...)
- [x] Lösungsprüfung — in der App: jede Lösung von löse(…) wird eingesetzt (✓ Probe), dazu probe(...)
- [~] Schrittweise Lösungsdarstellung — teilweise: lösungsschritte für lineare und quadratische Gleichungen, ableitungsschritte, gaußschritte, newton- und bisektionsschritte

## 4. Ungleichungen

- [x] Lineare Ungleichungen — in der App: Intervall ]a; b[
- [x] Quadratische Ungleichungen
- [x] Polynom-Ungleichungen
- [x] Bruch-Ungleichungen
- [~] Wurzel-Ungleichungen — teilweise
- [~] Exponential-Ungleichungen — teilweise
- [~] Logarithmische Ungleichungen — teilweise
- [~] Trigonometrische Ungleichungen — teilweise
- [x] Betragsungleichungen
- [x] Ungleichungssysteme — in der App: ungleichungssystem(...) als Intervall oder Fläche
- [x] Intervalllösungen — in der App: L = ]-∞; -2] ∪ [2; ∞[
- [x] Grafische Lösungsdarstellung — in der App: Ungleichung in x und y als gefärbte Fläche in der Grafik
- [x] Automatische Vorzeichenanalyse — in der App: vorzeichentabelle(f)

## 5. Funktionen

- [x] Funktionsdefinitionen
- [x] Verkettete Funktionen
- [x] Umkehrfunktionen — in der App: umkehrfunktion(f)
- [x] Parameterfunktionen — in der App: a = 2 wird Schieberegler, f(x) = a·x² bewegt sich mit
- [x] Stückweise definierte Funktionen — in der App: Fälle-Taste, Ausgabe als Fallunterscheidung, gezeichnet
- [x] Polynomfunktionen
- [x] Gebrochen-rationale Funktionen
- [x] Potenzfunktionen
- [x] Wurzelfunktionen
- [x] Exponentialfunktionen
- [x] Logarithmusfunktionen
- [x] Sinus
- [x] Kosinus
- [x] Tangens
- [x] Arkussinus — in der App: Taste sin⁻¹
- [x] Arkuskosinus — in der App: Taste cos⁻¹
- [x] Arkustangens — in der App: Taste tan⁻¹
- [x] Hyperbelfunktionen — in der App: Tasten sinh, cosh
- [x] Betragsfunktionen
- [x] Floor/Ceiling-Funktionen — in der App: abrunden, aufrunden
- [x] Signum-Funktion — in der App: Taste sgn, signum

## 6. Funktionsanalyse

- [x] Definitionsmenge — in der App: definitionsmenge(f)
- [x] Wertebereich — in der App: wertebereich(f)
- [x] Nullstellen — in der App: im Graph-Modus automatisch markiert, nullstellen(...) im Rechner
- [x] y-Achsenabschnitt — in der App: im Graph-Modus automatisch markiert, nullstellen(...) im Rechner
- [x] x-Achsenabschnitte — in der App: im Graph-Modus automatisch markiert, nullstellen(...) im Rechner
- [x] Extrempunkte — in der App: im Graph-Modus automatisch markiert, nullstellen(...) im Rechner
- [x] Hochpunkte — in der App: im Graph-Modus automatisch markiert, nullstellen(...) im Rechner
- [x] Tiefpunkte — in der App: im Graph-Modus automatisch markiert, nullstellen(...) im Rechner
- [x] Wendepunkte — in der App: wendepunkte(f) mit hinreichender Bedingung
- [x] Sattel-/Terrassenpunkte — in der App: in wendepunkte und kurvendiskussion
- [x] Polstellen — in der App: kurvendiskussion, vorzeichentabelle
- [x] Lücken — in der App: hebbare Lücken mit Grenzwert in asymptoten/kurvendiskussion
- [x] Asymptoten — in der App: asymptoten(f)
- [x] Schnittpunkte — in der App: im Graph-Modus automatisch markiert, nullstellen(...) im Rechner
- [x] Monotonie — in der App: monotonie(f)
- [x] Krümmung — in der App: krümmung(f)
- [x] Vorzeichenbereiche — in der App: vorzeichentabelle(f)
- [x] Grenzwerte — in der App: grenzwert(...)
- [x] Verhalten im Unendlichen — in der App: grenzwert(f, x, unendlich)
- [x] Funktionswertberechnung — in der App: f(3)
- [x] Tangenten — in der App: tangente(f, a)
- [x] Sekanten — in der App: sekante(...)
- [x] Normale — in der App: normale(f, a)
- [x] Vollständige Funktionsuntersuchung — in der App: kurvendiskussion(f)

## 7. Differentialrechnung

- [x] Erste Ableitung
- [x] Zweite Ableitung
- [x] Höhere Ableitungen
- [x] Partielle Ableitungen — in der App: ableiten(f, y)
- [x] Gradient — in der App: gradient(...)
- [x] Richtungsableitung — in der App: richtungsableitung(...)
- [x] Produktregel — in der App: ableitungsschritte zeigt u, v, u′, v′
- [x] Quotientenregel — in der App: ableitungsschritte
- [x] Kettenregel — in der App: ableitungsschritte zeigt innen und außen
- [x] Implizite Ableitung — in der App: implizit(x^2+y^2=1, x, y) = −x/y
- [x] Parametrische Ableitung — in der App: parameterableitung(x(t), y(t))
- [x] Numerische Ableitung — in der App: ableitungnumerisch(f, a)
- [x] Ableitungsgraph — in der App: f'(x) als Zeile, in der Grafik einschalten
- [x] Tangentensteigung
- [x] Normale — in der App: normale(f, a)
- [x] Extremwertanalyse — in der App: extrempunkte(f) mit hinreichender Bedingung
- [x] Kurvendiskussion — in der App: kurvendiskussion(f)

## 8. Integralrechnung

- [x] Unbestimmte Integrale
- [x] Bestimmte Integrale
- [x] Stammfunktionen
- [x] Numerische Integration — in der App: integralnumerisch(f, a, b)
- [x] Flächen unter Funktionen — in der App: fläche(f, a, b), in der Grafik schraffiert
- [x] Flächen zwischen Funktionen — in der App: flächezwischen(f, g, a, b), schraffiert
- [x] Uneigentliche Integrale
- [~] Parametrische Integrale — teilweise: Parameter möglich
- [~] Mehrfachintegrale — teilweise: verschachtelt integriere(integriere(...))
- [x] Flächenintegrale — in der App: flächenintegral(...)
- [x] Volumenberechnung — in der App: volumen(Körper), rotationsvolumen
- [x] Rotationsvolumen — in der App: rotationsvolumen(...)
- [x] Mittelwert einer Funktion — in der App: mittelwertfunktion(f, a, b)
- [~] Hauptsatz der Differential- und Integralrechnung — teilweise: rechnet, erklärt nicht

## 9. Grenzwerte und Reihen

- [x] Grenzwerte
- [x] Rechtsseitige Grenzwerte
- [x] Linksseitige Grenzwerte
- [x] Grenzwerte gegen ±∞
- [x] Folgen — in der App: folge(...), folgenplot(...)
- [x] Reihen
- [x] Konvergenz — in der App: konvergenz(aₙ, n) für Folge und Reihe
- [x] Divergenz — in der App: konvergenz(aₙ, n): bestimmt oder unbestimmt divergent
- [x] Geometrische Reihen
- [x] Potenzreihen — in der App: taylor(...)
- [x] Taylorreihen — in der App: taylor(f(x), x = a, n)
- [x] Maclaurinreihen — in der App: taylor(f(x), x = 0, n)
- [x] Taylorpolynome — in der App: taylor(f(x), x = a, n)
- [x] Restglied-/Fehlerbetrachtung — in der App: restglied(f, a, n, b)

## 10. Numerische Mathematik

- [x] Numerische Nullstellensuche — in der App: lösenumerisch, newton, bisektion
- [x] Newton-Verfahren — in der App: newtonschritte(f, x₀) mit Tangenten im Bild
- [x] Bisektionsverfahren — in der App: bisektionsschritte(f, a, b)
- [x] Iterationsverfahren — in der App: iteration(f, x₀, n)
- [x] Numerische Integration — in der App: integralnumerisch(f, a, b)
- [x] Numerische Ableitung — in der App: ableitungnumerisch(f, a)
- [x] Numerische Gleichungslösung — in der App: lösenumerisch(...)
- [x] Näherungslösungen — in der App: jedes Ergebnis auch als Dezimalzahl
- [x] Fehlerabschätzung — in der App: Fehlerschranke in bisektionsschritte, iteration, restglied
- [x] Rundungsfehleranalyse — in der App: rundungsfehler(Term)
- [x] Iterationsvisualisierung — in der App: spinnweb, newtonschritte, bisektionsschritte

## 11. 2D-Grafik

- [x] Funktionsplotter — in der App: Grafikansicht
- [x] Mehrere Funktionen gleichzeitig — in der App: beliebig viele
- [x] Parametrische Kurven — in der App: kurve(x(t), y(t), t, a, b)
- [x] Polarkurven — in der App: polarkurve(r(t), t, a, b)
- [x] Implizite Kurven — in der App: x² + y² = 9
- [x] Gleichungen grafisch darstellen
- [x] Ungleichungen grafisch darstellen — in der App: gefärbte Fläche, Rand gestrichelt wenn echt
- [x] Punkte — in der App: A(1|2)
- [x] Geraden — in der App: gerade(A, B), gerade(A, m), y = mx + b
- [x] Strecken — in der App: strecke(A, B)
- [x] Strahlen — in der App: strahl(A, B)
- [x] Kreise — in der App: kreis(M, r), kreis(M, P)
- [x] Ellipsen — in der App: als Gleichung
- [x] Parabeln
- [x] Hyperbeln — in der App: als Gleichung
- [x] Kegelschnitte — in der App: als Gleichung
- [x] Freies Zoomen — in der App: Pinch, Mausrad, Doppelklick, Knöpfe
- [x] Verschieben des Koordinatensystems — in der App: Ziehen
- [x] Raster
- [x] Achsen
- [x] Achsenbeschriftungen
- [x] Dynamische Skalierung — in der App: Bereich frei, gleiche Einheiten wählbar
- [x] Logarithmische Achsen
- [x] Koordinatenanzeige — in der App: Maus zeigt x/y, Gedrückthalten fährt den Graphen nach
- [x] Punktkoordinaten — in der App: besondere Punkte mit Koordinaten

## 12. Dynamische Mathematik

- [x] Dynamische Variablen
- [x] Abhängige Objekte — in der App: Gerade durch A folgt dem gezogenen A
- [x] Automatische Neuberechnung — in der App: CAS-Zeilen rechnen beim Ziehen mit
- [x] Schieberegler
- [x] Animierte Parameter
- [x] Animationen
- [x] Abhängigkeiten zwischen Objekten
- [x] Dynamische Bedingungen — in der App: „Nur zeigen, wenn a > 0“
- [x] Bedingte Sichtbarkeit
- [x] Spuren/Trajektorien — in der App: Spur pro Objekt
- [x] Ortslinien — in der App: ortslinie(P, a)
- [x] Interaktive Modelle — in der App: Regler, Checkboxen, ziehbare Punkte, Konstruktionswerkzeuge
- [x] Reset-Funktion — in der App: ⟲ setzt alle Regler zurück

## 13. Geometrie

- [x] Punkte
- [x] Punkt auf Objekt — in der App: punktauf(Objekt, Wert), ziehbar entlang des Objekts
- [x] Schnittpunkte — in der App: schnittpunkt(g, h), Werkzeug „Schnitt“
- [x] Geraden
- [x] Strecken
- [x] Strahlen
- [x] Parallelen — in der App: parallele(g, P)
- [x] Senkrechten — in der App: senkrechte(g, P)
- [x] Mittelsenkrechten — in der App: mittelsenkrechte(A, B)
- [x] Winkelhalbierenden — in der App: winkelhalbierende(A, B, C)
- [~] Tangenten — teilweise: tangente(f, a) an Graphen; Kreistangenten noch nicht
- [x] Kreise
- [x] Kreisbögen — in der App: kreisbogen(M, A, B)
- [x] Kreissektoren — in der App: kreissektor(M, A, B)
- [x] Polygone — in der App: polygon(A, B, C, …), Wert: Fläche
- [x] Dreiecke — in der App: polygon(A, B, C), Werkzeug „Vieleck“
- [x] Vierecke
- [x] Regelmäßige Polygone — in der App: vieleck(A, B, n)
- [x] Winkel — in der App: winkel(A, B, C) mit Bogen und Gradzahl
- [x] Längen — in der App: strecke(A, B)
- [x] Abstände — in der App: abstand(A, B), abstand(P, g)
- [x] Flächen — in der App: polygon(…)
- [x] Umfänge — in der App: umfang(…)
- [x] Höhen — in der App: höhe(A, B, C)
- [x] Schwerpunkt
- [x] Inkreismittelpunkt
- [x] Umkreismittelpunkt
- [x] Eulergerade

## 14. Geometrische Transformationen

- [x] Translation — in der App: verschieben(Objekt, v)
- [x] Rotation — in der App: drehen(Objekt, Winkel, Z)
- [x] Spiegelung an einer Geraden — in der App: spiegeln(Objekt, g)
- [x] Spiegelung an einem Punkt — in der App: spiegeln(Objekt, P)
- [x] Streckung — in der App: strecken(Objekt, k, Z)
- [x] Zentrische Streckung
- [x] Affine Transformationen — in der App: abbilden(Objekt, M, v)
- [x] Transformation mit Matrizen — in der App: abbilden(Objekt, M) zeichnet das Bild
- [x] Transformationen animieren — in der App: Winkel oder Faktor als Schieberegler
- [x] Original und Bild gleichzeitig darstellen

## 15. Analytische Geometrie

- [x] 2D-Vektoren — in der App: [3, 4] als Liste
- [x] 3D-Vektoren — in der App: [1, 2, 3]
- [x] Vektoraddition
- [x] Vektorsubtraktion
- [x] Skalarmultiplikation
- [x] Betrag eines Vektors — in der App: länge(v), betrag(v)
- [x] Einheitsvektoren — in der App: einheitsvektor(v)
- [x] Skalarprodukt — in der App: skalarprodukt(u, v)
- [x] Kreuzprodukt — in der App: kreuzprodukt(u, v)
- [x] Winkel zwischen Vektoren — in der App: winkel(u, v)
- [x] Orthogonalität — in der App: orthogonal(u, v)
- [x] Parallelität — in der App: kollinear(u, v)
- [x] Geradengleichungen — in der App: gerade(A, B) in Ebene und Raum, im Raum in Parameterform
- [x] Ebenengleichungen — in der App: ebene(A, B, C), ebene(P, n), E: 2x + y − z = 4
- [x] Parameterform — in der App: parameterform(E)
- [x] Normalenform — in der App: normalenform(E)
- [x] Koordinatenform — in der App: koordinatenform(E)
- [x] Hesse-Normalform — in der App: hessenormalform(E)
- [x] Lagebeziehungen — in der App: lage(g, h), lage(g, E), lage(E, F), lage(P, E) in Worten
- [x] Schnittpunkte — in der App: schnittpunkt(…) in Ebene und Raum
- [x] Schnittgeraden — in der App: schnittgerade(E, F)
- [x] Abstände — in der App: abstand(…) zwischen Punkten, Geraden und Ebenen, auch windschief
- [x] Lotfußpunkte — in der App: lotfußpunkt(P, g), lotfußpunkt(P, E)
- [x] Spiegelpunkte — in der App: spiegeln(P, E), spiegeln(P, g), spiegeln(P, Q)

## 16. 3D-Rechner

- [x] 3D-Koordinatensystem — in der App: 3D-Ansicht
- [x] 3D-Punkte — in der App: A(1|2|3)
- [x] 3D-Geraden
- [x] 3D-Strecken
- [x] Ebenen
- [x] Kugeln — in der App: kugel(M, r)
- [x] Zylinder — in der App: zylinder(M₁, M₂, r)
- [x] Kegel — in der App: kegel(M, S, r)
- [x] Prismen — in der App: prisma(A, B, C, …, A')
- [x] Pyramiden — in der App: pyramide(A, B, C, …, S)
- [x] Polyeder — in der App: quader, würfel, prisma, pyramide mit Volumen und Oberfläche
- [x] 3D-Funktionen — in der App: f(x, y) = … und z = …
- [x] Parametrische Flächen — in der App: parameterfläche(…)
- [x] Implizite Flächen — in der App: x² + y² − z² = 1
- [~] Schnittflächen — teilweise: Körper und Flächen überlagert, keine berechnete Schnittfläche
- [~] Schnittkurven — teilweise: schnittgerade(E, F); Schnittkurven gekrümmter Flächen fehlen
- [x] 3D-Abstände
- [x] 3D-Winkel — in der App: winkel(g, h), winkel(g, E), winkel(E, F)
- [~] 3D-Transformationen — teilweise: spiegeln und verschieben von Punkten
- [x] Freies Drehen
- [x] Zoomen
- [x] Perspektivische Darstellung
- [x] Orthografische Darstellung
- [x] 3D-Animationen — in der App: Schieberegler bewegen alles im Raum

## 17. Matrizen

- [x] Matrizen erstellen
- [x] Matrixaddition
- [x] Matrixsubtraktion
- [x] Matrixmultiplikation
- [x] Matrix-Vektor-Multiplikation
- [x] Transponieren
- [x] Determinante
- [x] Inverse Matrix
- [x] Rang — in der App: rang(M)
- [x] Eigenwerte — in der App: eigenwerte(A)
- [x] Eigenvektoren — in der App: eigenvektoren(M)
- [x] Lineare Gleichungssysteme — in der App: löse([…], [x, y])
- [x] Gauß-Verfahren — in der App: gaußschritte(M) mit jeder Zeilenumformung
- [x] Matrixzerlegungen — in der App: lu(M)
- [x] Lineare Transformationen — in der App: abbilden(Objekt, M), dazu eigenwerte, determinante

## 18. Komplexe Zahlen

- [x] Komplexe Zahlen — in der App: i eintippbar
- [x] Realteil — in der App: realteil(z)
- [x] Imaginärteil — in der App: imaginärteil(z)
- [x] Betrag — in der App: betrag(3+4i)
- [x] Argument — in der App: argument(z)
- [x] Konjugation — in der App: konjugiert(z)
- [x] Polarform — in der App: polarform(z)
- [x] Exponentialform — in der App: polarform(z) gibt r und φ für r·e^(iφ)
- [x] Komplexe Gleichungen — in der App: lösekomplex(...)
- [x] Gaußsche Zahlenebene — in der App: zahlenebene(z₁, z₂, …)
- [~] Komplexe Funktionen — teilweise: rechnet, kein Plot

## 19. Folgen

- [x] Arithmetische Folgen — in der App: folge, folgenplot, summe
- [x] Geometrische Folgen — in der App: folge, folgenplot, summe
- [x] Rekursive Folgen — in der App: rekursion(...), iteration(f, x₀, n)
- [x] Explizite Folgen — in der App: folge(Term, n, von, bis)
- [x] Fibonacci-Folge — in der App: fibonacci(n)
- [x] Folgeniteration — in der App: iteration(f, x₀, n)
- [x] Folgen grafisch darstellen — in der App: folgenplot(...)
- [x] Grenzwerte von Folgen — in der App: grenzwert(a(n), n, unendlich)
- [x] Rekursionsdiagramme — in der App: spinnweb(f, x₀, n)

## 20. Statistik

- [x] Dateneingabe — in der App: Liste [1, 2, 3], Tabelle (auch eingefügt aus einer Tabellenkalkulation oder CSV), zellen(A1, A10)
- [x] Tabellenkalkulation — in der App: Ansicht „Tabelle“
- [x] Häufigkeitstabellen — in der App: häufigkeitstabelle(L), klassen(L, Breite)
- [x] Absolute Häufigkeit — in der App: häufigkeitstabelle(L), häufigkeiten(L)
- [x] Relative Häufigkeit — in der App: häufigkeitstabelle(L), relativehäufigkeiten(L)
- [x] Mittelwert — in der App: Taste mittelwert, statistik(L)
- [x] Median — in der App: Schul-Median (Mittel der beiden mittleren Werte)
- [x] Modus — in der App: modus(L), statistik(L)
- [x] Minimum — in der App: minimum(L), statistik(L)
- [x] Maximum — in der App: maximum(L), statistik(L)
- [x] Spannweite — in der App: spannweite(L), statistik(L)
- [x] Quartile — in der App: quartile(Liste)
- [x] Quantile — in der App: quantil(L, p) (Schuldefinition)
- [x] Varianz — in der App: varianz(...), stichprobenvarianz(...)
- [x] Standardabweichung — in der App: empirisch (÷ n) und Stichprobe (÷ n − 1) getrennt benannt
- [x] Standardfehler — in der App: standardfehler(L), statistik(L)
- [x] Boxplot — in der App: boxplot(L) zeichnet in der Grafik
- [x] Histogramm — in der App: histogramm(L, Klassenbreite)
- [x] Balkendiagramm — in der App: balkendiagramm(L) oder (Werte, Häufigkeiten)
- [x] Kreisdiagramm — in der App: kreisdiagramm(Werte, Häufigkeiten), mit Anteilen und Winkeln
- [x] Streudiagramm — in der App: streudiagramm(X, Y), mit Korrelationskoeffizient

## 21. Regression

- [x] Lineare Regression — in der App: regressionlinear(X, Y)
- [x] Quadratische Regression — in der App: regressionquadratisch(X, Y)
- [x] Polynomiale Regression — in der App: regressionpolynom(X, Y, Grad), regressionkubisch
- [x] Exponentielle Regression — in der App: regressionexponentiell(X, Y), als a·bˣ
- [x] Logarithmische Regression — in der App: regressionlogarithmisch(X, Y)
- [x] Potenzregression — in der App: regressionpotenz(X, Y)
- [x] Sinusregression — in der App: regressionsinus(X, Y)
- [x] Modellvergleich — in der App: regression(X, Y) listet alle Modelle mit R², bestes zuerst
- [x] Regressionsgleichung — in der App: regression(X, Y, Modell)
- [x] Bestimmtheitsmaß — in der App: bestimmtheitsmaß(X, Y, Modell), für jedes Modell
- [x] Residuen — in der App: residuen(X, Y, Modell)
- [x] Residuenplot — in der App: residuenplot(X, Y, Modell)

## 22. Wahrscheinlichkeitsrechnung

- [x] Binomialverteilung — in der App: binomialpdf/binomialcdf, invbinom, verteilung(binomial, n, p)
- [x] Normalverteilung — in der App: normalpdf, normalcdf, invnorm, verteilung(normal, μ, σ)
- [x] Poissonverteilung — in der App: poissonpdf, poissoncdf, verteilung(poisson, λ)
- [x] Geometrische Verteilung — in der App: geometrischpdf, geometrischcdf, verteilung(geometrisch, p)
- [x] Hypergeometrische Verteilung — in der App: hypergeometrisch, hypergeometrischcdf, verteilung(hypergeometrisch, N, M, n)
- [x] Gleichverteilung — in der App: verteilung(gleich, a, b) und verteilung(stetiggleich, a, b)
- [x] Exponentialverteilung — in der App: exponentialpdf, exponentialcdf, verteilung(exponential, λ)
- [x] Wahrscheinlichkeitsdichte — in der App: Dichte als Kurve in verteilung(…), normalpdf, exponentialpdf
- [x] Verteilungsfunktion — in der App: …cdf-Befehle, Spalte P(X ≤ k) in verteilung(…)
- [x] Erwartungswert — in der App: erwartungswert(Werte, W), kenngrößen, verteilung(…)
- [x] Varianz — in der App: kenngrößen(Werte, W), verteilung(…)
- [x] Standardabweichung — in der App: kenngrößen(Werte, W), verteilung(…)
- [x] Quantile — in der App: invnorm, invt, invbinom
- [x] Wahrscheinlichkeitsintervalle — in der App: verteilung(…, a, b) mit markierter Fläche, sigmaumgebung(n, p, c)
- [x] Interaktive Verteilungsparameter — in der App: Schieberegler als Parameter, z. B. p = 0.3 und verteilung(binomial, 20, p)

## 23. Stochastische Simulationen

- [x] Würfelsimulation — in der App: würfelsimulation(n, Würfelzahl), würfeln(n) zählt 1–6
- [x] Münzwurfsimulation — in der App: münzwurfsimulation(n)
- [x] Zufallszahlen — in der App: zufallszahl(1, 6)
- [x] Zufallsexperimente — in der App: zufallsexperiment(Ergebnisse, Wahrscheinlichkeiten, n), ziehen(Urne, n, ohne)
- [x] Monte-Carlo-Simulation — in der App: montecarlo(f(x), a, b, n), montecarlopi(n) mit Bild
- [x] Wiederholte Experimente — in der App: simuliere(Verteilung, …, Wiederholungen)
- [x] Relative Häufigkeiten — in der App: jede Simulation mit Tabelle und Säulen gegen die Wahrscheinlichkeit
- [x] Gesetz der großen Zahlen — in der App: gesetzdergroßenzahlen(p, n) zeichnet den Verlauf
- [x] Simulation von Verteilungen — in der App: simuliere(normal, 0, 1, 1000) u. a., mit Dichte darüber

## 24. Statistische Tests

- [x] Hypothesentests — in der App: Nullhypothese, Gegenhypothese, Entscheidung in Worten
- [x] Binomialtest — in der App: binomialtest(n, p₀, α, Seite, k) mit Ablehnungsbereich und Diagramm
- [x] Mittelwerttests — in der App: gausstest (σ bekannt), ttest, zweistichprobenttest
- [x] Varianztests — in der App: varianztest (χ²), ftest
- [x] Chi-Quadrat-Tests — in der App: chi2test als Anpassungs- und Unabhängigkeitstest
- [x] Konfidenzintervalle — in der App: konfidenzintervall(k, n, γ) und für Mittelwerte
- [x] p-Werte — in der App: bei jedem Test
- [x] Signifikanzniveau — in der App: Argument α, tatsächliche Irrtumswahrscheinlichkeit beim Binomialtest
- [x] Teststatistik — in der App: z, t, χ², F mit kritischem Wert
- [x] Ein- und zweiseitige Tests — in der App: links, rechts, beidseitig

## 25. Tabellenkalkulation

- [x] Tabellen — in der App: Ansicht „Tabelle“, 26 Spalten, wächst mit
- [x] Zellformeln — in der App: =A1*2, deutsche Namen (SUMME, WENN …) und jeder CAS-Befehl
- [x] Zellbezüge — in der App: A1, Bereiche A1:B5, Zirkelbezüge werden erkannt
- [x] Absolute Zellbezüge — in der App: $A$1, $A1, A$1
- [x] Relative Zellbezüge — in der App: wandern beim Ausfüllen, Kopieren und Sortieren mit
- [x] Automatisches Ausfüllen — in der App: „↓ Füllen“, „→ Füllen“: Zahlenreihen setzen sich fort, Formeln werden angepasst
- [x] Datenreihen — in der App: „Reihe …“ mit Start, Schritt, Anzahl
- [x] Sortieren — in der App: nach jeder Spalte, auf- oder absteigend
- [x] Filtern — in der App: Bedingung je Spalte (>5, <>0, Wort)
- [x] Statistische Funktionen — in der App: MITTELWERT, MEDIAN, STABW, VARIANZ, KORREL … und alle Statistik-Befehle
- [x] Mathematische Funktionen — in der App: WURZEL, RUNDEN, POTENZ, SIN … und exakte CAS-Terme
- [x] Diagramme — in der App: „Diagramm …“ aus dem markierten Bereich
- [x] Verbindung zwischen Tabelle und Grafik — in der App: Diagramme und Streudiagramme aus Zellen, sie folgen den Zellen
- [x] Verbindung zwischen Tabelle und CAS — in der App: Zellen heißen im CAS A1, B2 …, zellen(A1, A10); Formeln nutzen CAS-Definitionen

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
- [x] Temperatur — in der App: temperatur(20, C, F) mit Nullpunkt
- [x] Winkel — in der App: Umschalter Grad/Bogenmaß
- [x] Automatische Einheitenumrechnung — in der App: umrechnen, si
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
- [x] Einheitenumrechnung — in der App: umrechnen(...)
- [x] Physikalische Konstanten — in der App: lichtgeschwindigkeit, _c_ als Wert mit Einheit
- [~] Dynamische physikalische Modelle — teilweise: Schieberegler, lösungskurve, phasenporträt, Skripte

## 28. Interaktive Benutzeroberfläche

- [x] Schieberegler
- [x] Eingabefelder
- [x] Checkboxen — in der App: zeige = wahr
- [x] Buttons
- [x] Dropdown-Menüs
- [x] Dynamische Texte — in der App: Beschriftung mit {a}
- [x] Dynamische Werte
- [x] Bedingte Sichtbarkeit
- [x] Tooltips — in der App: Koordinaten beim Antippen
- [~] Kontextmenüs — teilweise: im Verlauf
- [x] Drag & Drop — in der App: Punkte ziehen
- [x] Touch-Unterstützung
- [~] Stiftunterstützung — teilweise: in Notizen („Rechnen in Notizen“), nicht im Rechner
- [x] Multi-Touch — in der App: Pinch
- [x] Zoom-Gesten

## 29. Animation

- [x] Automatische Animation
- [x] Manuelle Animation — in der App: Regler ziehen
- [x] Animationsgeschwindigkeit — in der App: ¼× bis 4×
- [x] Animationsrichtung — in der App: ↔ → ←
- [x] Wiederholung
- [x] Start/Stopp
- [x] Pause
- [x] Reset
- [x] Animierte Schieberegler
- [x] Animierte Punkte — in der App: P(a|f(a))
- [x] Animierte geometrische Konstruktionen
- [x] Animierte Funktionen

## 30. Skripting

- [x] Ereignisse — in der App: Skripte beim Antippen, bei Änderung und an Knöpfen
- [x] Klickaktionen — in der App: Skript „beim Antippen“
- [x] Objektänderungen — in der App: Skript „wenn sich der Wert ändert“
- [x] Bedingungen — in der App: wenn … dann … sonst in Skripten
- [x] Variablen setzen — in der App: a = a + 1, setze A = (2|3)
- [x] Objekte erzeugen — in der App: erzeuge Q(1|2)
- [x] Objekte löschen — in der App: lösche Q
- [x] Animation starten — in der App: starte a
- [x] Animation stoppen — in der App: stoppe a
- [x] Konstruktion zurücksetzen — in der App: zurücksetzen
- [x] Benutzerinteraktionen programmieren — in der App: knopf("…") mit Skript
- [~] Eigene mathematische Werkzeuge — teilweise: Programme als eigene Befehle, keine eigenen Grafikwerkzeuge

## 31. Programmier-/Entwicklerfunktionen

- [x] Eigene Befehle — in der App: programm name(n) … ende
- [x] Benutzerdefinierte Funktionen — in der App: f(x) = …, bleibt nach Neustart erhalten
- [x] Listenverarbeitung — in der App: anwenden, auswählen, folge, x -> …
- [x] Schleifenähnliche Konstruktionen — in der App: für, solange, wiederhole
- [~] Bedingungen — nur Befehl: if/else in Giac-Programmen
- [x] Rekursion — in der App: Programme dürfen sich selbst aufrufen
- [x] Skripte — in der App: Skripte an Objekten und Knöpfen
- [x] JavaScript-Integration — in der App: window.Mathe.api
- [x] JavaScript API — in der App: evaluate, addRow, getValue, setValue, objects, cell, on(change)
- [x] Einbettung in Webseiten — in der App: mathe.html im iframe, gesteuert per postMessage
- [x] Zugriff auf mathematische Objekte über API — in der App: api.objects(), getValue
- [x] Dynamische Kommunikation zwischen Webseite und Rechner — in der App: postMessage in beide Richtungen

## 32. Lernfunktionen

- [~] Schritt-für-Schritt-Lösungen — teilweise: Ableitungen, lineare und quadratische Gleichungen, Gauß, Newton, Bisektion
- [~] Mathematische Erklärungen — teilweise: KI-Tutor in Dokumenten, nicht im Rechner
- [x] Interaktive Aufgaben — in der App: aufgabe(Thema, Stufe) und prüfe(Antwort)
- [x] Automatische Aufgaben — in der App: aufgabe(...) erzeugt Zahlen
- [x] Übungsmodus — in der App: aufgabe/prüfe, Karteikarten im Wiederholen-Tab
- [x] Sofortiges Feedback — in der App: prüfe(...) mit Hinweis
- [~] Fehleranalyse — teilweise: Hinweise auf Vorzeichen, Faktor, Kettenregel, fehlende Lösung
- [x] Ähnliche Aufgaben generieren — in der App: aufgabe(…, Variante)
- [~] Lernfortschritt — teilweise: Lernplan und Wiederholen
- [x] Aufgabenserien — in der App: aufgabe(Thema, Stufe, Anzahl)
- [x] Schwierigkeitsstufen — in der App: Stufe 1 bis 3

## 33. Dokumente und Materialien

- [~] Textfelder — teilweise
- [~] Überschriften — teilweise
- [~] Bilder — teilweise
- [ ] Videos
- [~] mathematische Konstruktionen — teilweise: Graph als Seite in ein Dokument einfügen
- [~] interaktive Aufgaben — teilweise: im Rechner (aufgabe, prüfe), nicht in Dokumenten
- [~] mehrere Seiten — teilweise
- [ ] Kapitel
- [ ] Lernbücher
- [x] Präsentationsmodus — in der App: Präsentationen-Tab
- [~] Materialien speichern — teilweise
- [~] Materialien teilen — teilweise

## 34. Dateisystem

- [x] Projektdateien — in der App: Projekt als Datei teilen und aus Datei öffnen
- [x] Import — in der App: Projektdateien, CSV, Einfügen in die Tabelle
- [x] Export — in der App: Text, Projektdatei, CSV, Grafik als Bild
- [x] Speichern
- [x] Autosave — in der App: Verlauf und Definitionen werden gespeichert
- [x] Versionsverwaltung — in der App: die letzten 10 Fassungen je Projekt
- [ ] Cloud-Speicherung
- [ ] Teilen per Link
- [x] Import von Daten — in der App: CSV-Datei, Einfügen aus Tabellen
- [x] Export von Daten — in der App: Tabelle als CSV
- [x] Export als Bild — in der App: Grafik als PNG teilen oder als Dokumentseite
- [~] Export als PDF — teilweise: über das Dokument
- [x] Export mathematischer Ergebnisse — in der App: Als Text teilen

## 35. Prüfung / Exam Mode

- [x] Prüfungsmodus — in der App: Menü → Prüfungsmodus
- [x] Einschränkung bestimmter Funktionen — in der App: mit CAS, GTR (nur Zahlen), WTR; Programme, Tabelle, 3D abschaltbar
- [x] Kontrollierter Funktionsumfang — in der App: gesperrte Befehle verschwinden aus der Liste
- [x] Sperrung externer Inhalte — in der App: kein Öffnen, Teilen, Einfügen; die App bleibt im Rechner
- [x] Prüfungsstatus — in der App: Umfang, Beginn, Dauer, Code zum Beenden
- [x] sichtbare Statusanzeige — in der App: rotes Band mit Uhr, roter Rahmen
- [x] Zurücksetzen nach Prüfung — in der App: alles aus der Prüfung wird gelöscht

## 36. Bedienkomfort

- [x] Suchfunktion für Befehle — in der App: Befehle (Strg+K)
- [x] Autovervollständigung — in der App: Vorschläge beim Tippen
- [x] Syntax-Hervorhebung — in der App: Textzeilen und Programme
- [x] mathematische Tastatur — in der App: eigene Tastatur mit Befehlstasten
- [x] Verlauf — in der App: mit ans und Wiederverwenden
- [x] Rückgängig — in der App: ↶, Strg+Z
- [x] Wiederholen — in der App: ↷, Strg+Umschalt+Z
- [x] Favoriten — in der App: ☆ in der Befehlsliste
- [x] zuletzt verwendete Befehle — in der App: „Zuletzt“ in der Befehlsliste
- [x] Tastaturkürzel — in der App: F1 zeigt alle
- [~] Kontextabhängige Werkzeuge — teilweise
- [x] Hilfetexte — in der App: Hilfe im Menü
- [x] Befehlsdokumentation — in der App: jeder Befehl mit Beispiel, hilfe(befehl)

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

- [x] frei konfigurierbare Farben
- [x] Linienarten
- [x] Linienstärke
- [x] Punktgrößen
- [x] Transparenz — in der App: Füllung 0–100 %
- [x] Füllungen
- [x] Beschriftungen
- [x] dynamische Beschriftungen
- [x] Achsenkonfiguration — in der App: Namen, Pfeile, π, log
- [x] Rasterkonfiguration — in der App: grob/fein/aus
- [x] logarithmische Skalierung
- [ ] mehrere Koordinatensysteme
- [x] benutzerdefinierte Ansichten — in der App: gespeicherte Ansichten im Koordinatensystem

## 39. Mathematik-Eingabe

- [x] LaTeX-Eingabe — in der App: $…$ oder \frac … in einer Textzeile
- [x] Brucheditor — in der App: Formeleditor, Taste a/b
- [x] Wurzeleditor — in der App: Formeleditor, Tasten √ und ⁿ√
- [x] Integraleditor — in der App: Formeleditor, Tasten ∫ und ∫ₐᵇ
- [x] Summeneditor — in der App: Formeleditor, Tasten Σ und Π
- [~] Matrixeditor — teilweise: Matrix-Vorlage [[ , ], [ , ]], Ausgabe als Tabelle
- [x] Indexe — in der App: Taste xₙ
- [x] Exponenten — in der App: x², xⁿ-Taste, hochgestellte Ausgabe
- [x] griechische Buchstaben — in der App: αβγ-Tastatur
- [x] mathematische Symbole — in der App: √, π, ≤, ≥, ≠, ×, ÷ werden verstanden
- [x] Autovervollständigung — in der App: Vorschläge beim Tippen
- [~] natürliche mathematische Eingabe — teilweise: feste deutsche Wendungen wie „Ableitung von x^3“, „20 Prozent von 150“

## 40. KI-Funktionen

- [~] Erkennung fotografierter Aufgaben — teilweise: Foto als Dokument, Tutor liest die Seite
- [x] automatische Texterkennung — in der App: OCR für Dokumente, Handschrift in Notizen
- [x] automatische mathematische Interpretation — in der App: Rechnen in Notizen
- [~] Schritt-für-Schritt-Erklärungen — teilweise: sokratischer Tutor, bewusst mit Gegenfragen statt Lösungsweg
- [~] Fehlererkennung — teilweise
- [~] alternative Lösungswege — teilweise
- [x] automatische Aufgabengenerierung — in der App: Übungsaufgaben im Lernplan
- [~] Schwierigkeitsanpassung — teilweise: Hinweisstufen des Tutors
- [~] natürliche Sprache → mathematische Formel — teilweise: feste Wendungen, ohne KI
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
- [x] Rundungsfehler anzeigen — in der App: rundungsfehler(Term)
- [x] exakte/numerische Ergebnisse unterscheiden — in der App: exakt und ≈ getrennt
- [x] Lösungsmenge korrekt darstellen — in der App: L = {…}, Intervalle, ∅
- [x] Ergebnis automatisch verifizieren — in der App: ✓ Probe bei Gleichungen

## 42. Professionelle CAS-Funktionen

- [~] Symbolische Matrizen — nur Befehl
- [x] Eigenwertprobleme — in der App: eigenwerte, eigenvektoren, charpoly
- [x] Differentialgleichungen — in der App: dgl(...)
- [~] Systeme von Differentialgleichungen — teilweise: desolve mit Systemen, nicht geprüft
- [ ] partielle Differentialgleichungen
- [x] Laplace-Transformation — in der App: laplace(...)
- [x] inverse Laplace-Transformation — in der App: invlaplace(...)
- [x] Fourier-Reihen — in der App: fourierkoeffizient(...)
- [x] Fourier-Transformation — in der App: fouriertransformation(...)
- [x] Z-Transformation — in der App: ztransformation(...)
- [x] symbolische Summen — in der App: summe(...)
- [x] symbolische Produkte — in der App: produkt(...)
- [x] Reihenentwicklung — in der App: taylor(...)
- [x] Residuen — in der App: residuum(...)
- [~] komplexe Analysis — teilweise: residue(...) geht
- [x] Vektoranalysis — in der App: gradient, divergenz, rotation, kurvenintegral, fluss
- [ ] Tensor-/Indexnotation

## 43. Differentialgleichungen

- [x] ODE erster Ordnung — in der App: dgl(y' = …, y)
- [x] ODE höherer Ordnung — in der App: dgl mit y′′
- [x] Anfangswertprobleme — in der App: dgl([…, y(0) = …], y), lösungskurve
- [x] Randwertprobleme — in der App: dgl([y′′ + y = 0, y(0) = 0, y(π/2) = 1], y)
- [~] Systeme von ODEs — teilweise
- [x] analytische Lösungen — in der App: dgl(...)
- [x] numerische Lösungen — in der App: lösungskurve (Runge-Kutta)
- [x] Richtungsfelder — in der App: richtungsfeld(...)
- [x] Lösungskurven — in der App: lösungskurve(…, x₀, y₀)
- [x] Phasenporträts — in der App: phasenporträt(...)
- [x] Parameterstudien — in der App: Schieberegler in richtungsfeld und lösungskurve

## 44. Erweiterte 3D-Mathematik

- [x] Vektorfelder — in der App: vektorfeld([P, Q, R])
- [x] Skalarfelder — in der App: höhenlinien(f), z = f(x, y) in 3D
- [~] Gradientfelder — teilweise: grad(...) rechnerisch
- [x] Divergenz — in der App: divergenz(...)
- [x] Rotation/Curl — in der App: rotation(...)
- [x] Fluss — in der App: fluss(F, Fläche, …)
- [x] parametrische Flächen — in der App: parameterfläche(…)
- [x] Flächennormalen — in der App: flächennormale(...)
- [x] Tangentialebenen — in der App: tangentialebene(f, a, b)
- [x] Kurvenintegrale — in der App: kurvenintegral(...)
- [x] Flächenintegrale — in der App: flächenintegral(...)
- [ ] 3D-Ortslinien
- [x] dynamische 3D-Simulationen — in der App: Schieberegler in der 3D-Ansicht

## 45. Architektur der App

- [x] zentrale CAS-Engine — in der App: Giac 1.9 (WebAssembly)
- [x] numerische Engine — in der App: Giac
- [x] 2D-Rendering-Engine — in der App: Graph und Folien
- [x] 3D-Rendering-Engine — in der App: three.js (WebGL)
- [x] Geometrie-Engine — in der App: exakt über Giac, live beim Ziehen
- [x] Statistik-Engine — in der App: eigenes Modul für Kennzahlen, Tests und Regression
- [x] Wahrscheinlichkeits-Engine — in der App: Verteilungen mit Umkehrfunktionen, Simulationen
- [~] Einheiten-Engine — teilweise: Giac
- [x] Plotting-Engine
- [x] Dokument-Engine — in der App: PDF-Dokumente mit Notizen
- [x] Skript-Engine — in der App: Programme und Objekt-Skripte
- [~] Plugin-/Erweiterungssystem — teilweise: eigene Befehle als Programme, JavaScript-API
- [x] API — in der App: window.Mathe.api und postMessage
- [~] persistenter Objektgraph — in der App: Objekte aus den gespeicherten Zeilen mit Stil und Reglern
- [x] Undo/Redo-System — in der App: 100 Schritte im Rechner
- [~] Versions-/Dateisystem — teilweise: Versionen je Projekt, Projektdateien, kein Ordnersystem

## 46. Kernanforderung für eine vollständige CAS-App

- [x] Jede Berechnung kann exakt durchgeführt werden, wenn mathematisch möglich
- [x] Numerische Näherungen können explizit angefordert werden — in der App: näherung(...) und ≈ bei jedem Ergebnis
- [x] Algebraische Objekte bleiben symbolisch erhalten
- [x] Ergebnisse können direkt weiterverwendet werden — in der App: ans, Definitionen
- [x] Algebra und Grafik sind miteinander verbunden — in der App: eine Zeile = ein Objekt, CAS und Grafik nebeneinander
- [x] Änderungen werden automatisch propagiert
- [x] 2D und 3D verwenden dieselbe mathematische Objektlogik — in der App: eine Zeile = ein Objekt, in 2D oder 3D
- [x] CAS, Geometrie, Statistik und Tabellen greifen auf gemeinsame Objekte zu — in der App: Zellen sind CAS-Variablen, Regler steuern Diagramme
- [~] Jede Funktion ist über GUI und Kommando-/Eingabesystem erreichbar — teilweise: jeder Befehl in der Befehlsliste, manche nur als Befehl
- [~] Ergebnisse sind nachvollziehbar — teilweise: Schritte für Ableitungen, Gleichungen, Gauß, Numerik; Probe
- [x] Fehler werden mathematisch korrekt behandelt — in der App: Absturz-Fehler behoben
- [~] Definitionsbedingungen werden automatisch berücksichtigt — teilweise: Giac beim Lösen, keine Anzeige
- [x] Exakte und approximierte Ergebnisse werden klar unterschieden
- [x] Komplexe Konstruktionen bleiben editierbar — in der App: jede Konstruktion ist eine CAS-Zeile
- [~] Große Berechnungen werden performant verarbeitet — teilweise: Giac im Hintergrund, kein Abbruch-Knopf
- [x] Benutzer können eigene interaktive mathematische Modelle erstellen

## Minimaler Funktionsumfang

- [x] Vollständiges CAS — in der App: Giac
- [x] Wissenschaftlicher Rechner
- [x] 2D-Plotter
- [x] 3D-Plotter
- [x] Dynamische Geometrie
- [x] Differentialrechnung
- [x] Integralrechnung
- [x] Gleichungslöser
- [x] Ungleichungslöser — in der App: mit Intervallen
- [x] Matrizen
- [x] Vektoren — in der App: deutsche Befehle, Ebene und Raum
- [x] Statistik
- [x] Regression
- [x] Wahrscheinlichkeitsrechnung
- [x] Tabellenkalkulation
- [x] Schieberegler
- [x] Animation
- [x] Skripting — in der App: Programme, Skripte, Knöpfe
- [x] Interaktive Elemente — in der App: Regler, Checkboxen, ziehbare Punkte
- [x] Datei-/Projektverwaltung — in der App: Projekte, Versionen, Projektdateien
- [x] Import/Export — in der App: Projekt, CSV, Text, Bild
- [~] Schritt-für-Schritt-Lösungen — teilweise: Ableitungen, lineare und quadratische Gleichungen, Gauß, Newton, Bisektion
- [x] Prüfungssystem — in der App: Prüfungsmodus
- [x] KI-Unterstützung — in der App: Tutor, Rechnen in Notizen
- [x] API — in der App: window.Mathe.api und postMessage
- [x] mobile Bedienung
- [x] Offline-Fähigkeit — in der App: Rechner komplett offline
- [ ] Cloud-Synchronisation

