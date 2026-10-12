import Foundation

/// "Mathe Mittelstufe", Klasse 5 bis 10: ten units from fractions to probability. Every lesson, practice round and
/// checkpoint draws its problems from templates with a seeded generator, so a new seed means new numbers.
enum MathMiddleCourse {
    static let provider: any CourseProvider = MathMiddleProvider()
}

struct MathMiddleProvider: CourseProvider {
    static let courseID = "mathm"

    let course: Course

    init() {
        func unit(_ number: Int, _ title: String, _ summary: String, _ tip: String) -> CourseUnit {
            CourseUnit.standard(courseID: MathMiddleProvider.courseID, number: number, title: title, summary: summary, tip: tip)
        }
        let units = [
            unit(
                1, "Brüche verstehen", "Bruchteile, gemischte Zahlen, Erweitern, Kürzen und Vergleichen",
                """
                Ein Bruch wie 3/8 sagt: Das Ganze ist in 8 gleiche Teile geteilt, und du nimmst 3 davon. Der Nenner (unten) zählt alle Teile, der Zähler (oben) die Teile, um die es geht. 3/8 von 40 € rechnest du so: 40 : 8 = 5, dann 5 · 3 = 15.

                Ist der Zähler größer als der Nenner, heißt der Bruch unecht. Du kannst ihn als gemischte Zahl schreiben: 13/5 = 2 3/5, denn 13 : 5 = 2 Rest 3. Zurück geht es mit Ganze mal Nenner plus Zähler: 2 · 5 + 3 = 13.

                Erweitern heißt: Zähler und Nenner mit derselben Zahl malnehmen. Kürzen heißt: beide durch dieselbe Zahl teilen. Der Wert bleibt gleich: 3/4 = 6/8 = 15/20. Vollständig gekürzt ist ein Bruch, wenn du mit dem größten gemeinsamen Teiler gekürzt hast: 18/24 : 6 = 3/4.

                Um Brüche zu vergleichen, bringst du sie auf einen gemeinsamen Nenner. Dann entscheidet der Zähler: 5/8 = 15/24 und 7/12 = 14/24, also ist 5/8 größer.
                """
            ),
            unit(
                2, "Bruchrechnung", "Addieren, Subtrahieren, Multiplizieren und Dividieren von Brüchen",
                """
                Addieren und Subtrahieren: Gleichnamige Brüche rechnest du über die Zähler, der Nenner bleibt: 3/7 + 2/7 = 5/7. Haben die Brüche verschiedene Nenner, erweiterst du sie zuerst auf einen gemeinsamen Nenner: 1/2 + 1/3 = 3/6 + 2/6 = 5/6. Zähler und Nenner dürfen nicht einfach getrennt addiert werden.

                Multiplizieren: Zähler mal Zähler, Nenner mal Nenner. 3/4 · 2/9 = 6/36 = 1/6. Du kannst schon vorher kürzen: Die 3 und die 9 haben den Teiler 3, die 2 und die 4 den Teiler 2.

                Dividieren: Durch einen Bruch teilst du, indem du mit seinem Kehrwert malnimmst. 3/4 : 3/8 = 3/4 · 8/3 = 2. Der erste Bruch bleibt, wie er ist; nur der zweite wird umgedreht.

                Gemischte Zahlen wandelst du vor dem Multiplizieren und Dividieren in unechte Brüche um. Es gilt Punkt vor Strich, Klammern zuerst: 1/2 + 1/3 · 3/4 = 1/2 + 1/4 = 3/4.
                """
            ),
            unit(
                3, "Dezimalzahlen und Prozent", "Prozent, Prozentwert, Grundwert, Prozentsatz, Zu- und Abnahme",
                """
                Prozent heißt Hundertstel: 1 % = 1/100 = 0,01. Also ist 75 % = 75/100 = 0,75 = 3/4. Zum Umrechnen verschiebst du das Komma um zwei Stellen: 7 % = 0,07 und 0,4 = 40 %.

                Bei Prozentaufgaben gibt es drei Größen: den Grundwert G (das Ganze, 100 %), den Prozentsatz p % und den Prozentwert W (der Teil). Es gilt W = G · p/100. 15 % von 80 € sind 80 · 0,15 = 12 €. Fehlt der Prozentsatz, rechnest du p = W : G · 100; fehlt der Grundwert, rechnest du G = W : p · 100.

                Bei einer Zunahme um p % ist der neue Wert G · (1 + p/100), bei einer Abnahme G · (1 − p/100). 80 € plus 15 % sind 80 · 1,15 = 92 €; 60 € minus 25 % sind 60 · 0,75 = 45 €. Der Faktor 1,15 bzw. 0,75 heißt Wachstumsfaktor.

                Brutto ist Netto plus Mehrwertsteuer: Bei 19 % ist Brutto = Netto · 1,19. Rückwärts teilst du durch 1,19. Du darfst nicht 19 % vom Bruttopreis abziehen, denn der Bruttopreis ist 119 % des Nettopreises.
                """
            ),
            unit(
                4, "Terme und lineare Gleichungen", "Terme umformen, Gleichungen lösen, Probe",
                """
                Ein Term besteht aus Zahlen, Variablen und Rechenzeichen, zum Beispiel 3x + 5. Setzt du für x eine Zahl ein, erhältst du einen Wert: Für x = 4 ist 3x + 5 = 3 · 4 + 5 = 17. Gleichartige Summanden fasst du zusammen: 3x + 5 − x + 2 = 2x + 7.

                Beim Auflösen von Klammern wird jeder Summand in der Klammer mit dem Faktor davor multipliziert: 3(x − 4) = 3x − 12. Steht ein Minus vor der Klammer, drehen sich die Vorzeichen um: 5 − 2(x + 3) = 5 − 2x − 6 = −2x − 1.

                Eine Gleichung löst du mit Äquivalenzumformungen: Du machst auf beiden Seiten dasselbe, also dieselbe Zahl addieren oder subtrahieren, mit derselben Zahl (nicht 0) multiplizieren oder durch sie teilen. 3x + 5 = 20 gibt 3x = 15 und x = 5. Steht x auf beiden Seiten, sammelst du die x zuerst auf einer Seite.

                Zur Probe setzt du die Lösung in die Gleichung ein: 3 · 5 + 5 = 20 stimmt. So findest du Rechenfehler.
                """
            ),
            unit(
                5, "Dreisatz und Proportionalität", "Proportionale und antiproportionale Zuordnungen, Dreisatz, Maßstab, Verhältnisse",
                """
                Bei einer proportionalen Zuordnung gehört zum Doppelten das Doppelte, zum Dreifachen das Dreifache. Der Quotient y : x ist immer gleich; er heißt Proportionalitätsfaktor. 5 Hefte kosten 10 €, also kostet 1 Heft 2 € und 8 Hefte kosten 16 €. Das ist der Dreisatz: erst auf die Einheit, dann auf die gesuchte Menge.

                Bei einer antiproportionalen Zuordnung gehört zum Doppelten die Hälfte. Das Produkt x · y ist immer gleich. 4 Arbeiter brauchen 6 Tage, das sind 24 Arbeitertage; 3 Arbeiter brauchen 24 : 3 = 8 Tage.

                Nicht jede Zuordnung ist proportional: Ein Taxi mit Grundgebühr gehört nicht dazu, und die Fläche eines Quadrats wächst mit dem Quadrat der Seitenlänge.

                Beim Maßstab 1 : 50 000 entspricht 1 cm auf der Karte 50 000 cm = 500 m in Wirklichkeit. Beim Aufteilen im Verhältnis 2 : 3 hat das Ganze 2 + 3 = 5 Teile.
                """
            ),
            unit(
                6, "Lineare Funktionen", "Steigung, y-Achsenabschnitt, Nullstelle, Gerade durch zwei Punkte, Punktprobe",
                """
                Eine lineare Funktion hat die Gleichung y = mx + b, ihr Graph ist eine Gerade. m ist die Steigung: Geht man 1 nach rechts, geht es um m nach oben (bei negativem m nach unten). b ist der y-Achsenabschnitt: Dort schneidet die Gerade die y-Achse, im Punkt (0|b). y = 2x − 3 hat die Steigung 2 und schneidet die y-Achse bei −3.

                Die Nullstelle ist die Stelle, an der y = 0 ist. Du setzt 0 ein und löst nach x auf: 0 = 2x − 3 gibt x = 3/2.

                Aus zwei Punkten P(x₁|y₁) und Q(x₂|y₂) berechnest du die Steigung: m = (y₂ − y₁) : (x₂ − x₁), also Höhenunterschied durch Breitenunterschied. Dann setzt du einen Punkt ein und bestimmst b. Für P(1|2) und Q(3|8) ist m = 6 : 2 = 3, und 2 = 3 · 1 + b gibt b = −1.

                Punktprobe: Ein Punkt liegt auf der Geraden, wenn seine Koordinaten die Gleichung erfüllen. Parallele Geraden haben dieselbe Steigung.
                """
            ),
            unit(
                7, "Potenzen und Wurzeln", "Potenzgesetze, Quadratzahlen, Wurzeln und Zehnerpotenzen",
                """
                Eine Potenz ist ein wiederholtes Malnehmen: 3⁴ = 3 · 3 · 3 · 3 = 81. Die 3 heißt Basis, die 4 Exponent. Quadratzahlen sind 1, 4, 9, 16, 25, …, Kubikzahlen 1, 8, 27, 64, … . Bei negativer Basis kommt es auf den Exponenten an: (−2)³ = −8, aber (−2)² = 4. Und −2² = −4, weil nur die 2 quadriert wird.

                Potenzgesetze bei gleicher Basis: Beim Malnehmen addierst du die Exponenten (2³ · 2⁴ = 2⁷), beim Teilen subtrahierst du sie (2⁷ : 2³ = 2⁴), beim Potenzieren multiplizierst du sie ((2³)² = 2⁶). Ein negativer Exponent bedeutet den Kehrwert: 2⁻³ = 1/2³ = 1/8. Bei gleichem Exponenten darfst du die Basen zusammenfassen: 2³ · 5³ = 10³.

                Die Quadratwurzel √a ist die nichtnegative Zahl, deren Quadrat a ist: √49 = 7, denn 7² = 49. Die Kubikwurzel von 125 ist 5, denn 5³ = 125. Vorsicht: √(9 + 16) = √25 = 5, aber √9 + √16 = 3 + 4 = 7.

                Große und kleine Zahlen schreibst du mit Zehnerpotenzen: 45 000 = 4,5 · 10⁴ und 0,0007 = 7 · 10⁻⁴.
                """
            ),
            unit(
                8, "Geometrie", "Umfang, Fläche, Volumen, Winkelsumme und Satz des Pythagoras",
                """
                Umfang und Fläche: Beim Rechteck ist U = 2 · (a + b) und A = a · b. Dreieck: A = g · h : 2. Parallelogramm: A = g · h. Trapez: A = (a + c) : 2 · h. Kreis mit Radius r: U = 2 · π · r und A = π · r². Bei Kreisen lassen wir π stehen: r = 5 cm gibt A = 25π cm².

                Körper: Quader V = a · b · c und O = 2 · (ab + ac + bc). Prisma und Zylinder: V = G · h, beim Zylinder ist G = π · r². Einheiten: 1 dm³ = 1 l = 1000 cm³. Bei Flächen ist 1 dm² = 100 cm², bei Volumen 1 dm³ = 1000 cm³.

                Winkel: Im Dreieck beträgt die Winkelsumme 180°, im Viereck 360°. Nebenwinkel ergeben zusammen 180°. Im gleichschenkligen Dreieck sind die Basiswinkel gleich groß.

                Satz des Pythagoras: In einem rechtwinkligen Dreieck gilt a² + b² = c². Dabei ist c die Hypotenuse, die Seite gegenüber dem rechten Winkel: 3² + 4² = 5². Gilt die Gleichung für die drei Seiten eines Dreiecks, ist es rechtwinklig.
                """
            ),
            unit(
                9, "Quadratische Gleichungen und Funktionen", "Scheitelpunkt, Nullstellen, pq-Formel und Diskriminante",
                """
                Der Graph einer quadratischen Funktion ist eine Parabel. In der Scheitelpunktform y = a(x − d)² + e liest du den Scheitelpunkt S(d|e) ab: y = (x − 3)² + 2 hat S(3|2). Die Parabel ist für a > 0 nach oben geöffnet, für a < 0 nach unten. Ist |a| > 1, ist sie enger als die Normalparabel y = x², ist |a| < 1, weiter.

                Rein quadratische Gleichungen: x² = 49 hat die Lösungen 7 und −7, x² = −4 hat keine Lösung. Ist ein Produkt gleich 0, muss ein Faktor 0 sein: (x − 2)(x + 5) = 0 gibt x = 2 oder x = −5.

                Die pq-Formel löst x² + px + q = 0: x₁,₂ = −p/2 ± √((p/2)² − q). Der Ausdruck unter der Wurzel heißt Diskriminante D = (p/2)² − q. Ist D > 0, gibt es zwei Lösungen, bei D = 0 genau eine, bei D < 0 keine. Beispiel: x² − 5x + 6 = 0 hat D = 6,25 − 6 = 0,25 und die Lösungen 2,5 ± 0,5, also 2 und 3.

                Steht vor x² eine Zahl a ≠ 1, teilst du zuerst durch a. Die Nullstellen einer Funktion sind die Lösungen von f(x) = 0.
                """
            ),
            unit(
                10, "Wahrscheinlichkeit", "Laplace, Baumdiagramm, Pfadregeln und Gegenereignis",
                """
                Bei einem Laplace-Experiment sind alle Ergebnisse gleich wahrscheinlich. Dann gilt P(E) = Anzahl der günstigen Ergebnisse : Anzahl aller möglichen Ergebnisse. Beim Würfel ist P(Augenzahl größer als 4) = 2/6 = 1/3, denn günstig sind 5 und 6. Eine Wahrscheinlichkeit liegt immer zwischen 0 und 1.

                Das Gegenereignis tritt genau dann ein, wenn E nicht eintritt: P(nicht E) = 1 − P(E). Das hilft bei „mindestens einmal“: P(mindestens eine 6 bei zwei Würfen) = 1 − (5/6)² = 11/36.

                Mehrstufige Zufallsexperimente zeichnest du als Baumdiagramm. Erste Pfadregel: Entlang eines Pfades multiplizierst du die Wahrscheinlichkeiten. Zweite Pfadregel: Führen mehrere Pfade zum Ereignis, addierst du ihre Wahrscheinlichkeiten. Beim Ziehen ohne Zurücklegen ändern sich die Zahlen im zweiten Zug: Aus 4 roten und 3 blauen Kugeln ziehst du zweimal rot mit 4/7 · 3/6 = 2/7.

                Die relative Häufigkeit ist Treffer : Versuche. Bei vielen Versuchen liegt sie nahe bei der Wahrscheinlichkeit.
                """
            ),
        ]
        course = Course(
            id: MathMiddleProvider.courseID,
            title: "Mathe Mittelstufe",
            subtitle: "Klasse 5 bis 10",
            kind: .math,
            color: 0x3D6FB6,
            symbol: "percent",
            sections: [
                CourseSection(id: "mathm.s1", title: "A · Zahlen und Rechnen", units: Array(units[0..<3])),
                CourseSection(id: "mathm.s2", title: "B · Gleichungen und Funktionen", units: Array(units[3..<6])),
                CourseSection(id: "mathm.s3", title: "C · Potenzen und Geometrie", units: Array(units[6..<8])),
                CourseSection(id: "mathm.s4", title: "D · Quadratisches und Zufall", units: Array(units[8..<10])),
            ]
        )
    }

    func exercises(for node: CourseNode, seed: UInt64) -> [LearnExercise] {
        MathMiddleBuilder.exercises(for: node, seed: seed)
    }
}
