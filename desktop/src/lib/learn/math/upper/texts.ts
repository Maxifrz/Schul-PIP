/** The guides of the units. */
export const tips: string[] = [
  `Die Ableitung f′(x) gibt die Steigung des Graphen an der Stelle x an. f′(2) ist die Steigung der Tangente im Punkt P(2 | f(2)).

Potenzregel: (xⁿ)′ = n·xⁿ⁻¹. Beispiel: (x⁴)′ = 4x³. Ein Faktor bleibt stehen (Faktorregel): (3x²)′ = 3·2x = 6x. Summen leitest du Summand für Summand ab (Summenregel): f(x) = x³ − 5x + 7 gibt f′(x) = 3x² − 5. Eine Konstante hat die Ableitung 0, x hat die Ableitung 1.

Wurzeln und Brüche schreibst du zuerst als Potenz: √x = x^(1/2) und 1/x² = x⁻². Dann gilt wieder die Potenzregel.

Die Tangente an der Stelle a hat die Gleichung y = f(a) + f′(a)·(x − a). Eine waagerechte Tangente hat die Steigung 0, also f′(x) = 0. Setzt du in f ein, bekommst du die Höhe (y-Wert); setzt du in f′ ein, bekommst du die Steigung.`,
  `Nullstellen lösen f(x) = 0: Bei einer quadratischen Gleichung nutzt du die pq-Formel oder faktorisierst, bei x³ − 4x klammerst du zuerst x aus: x·(x² − 4) = 0 gibt x = 0, x = 2 oder x = −2. Der y-Achsenabschnitt ist f(0).

Extremstellen: Notwendig ist f′(x) = 0. Ist zusätzlich f″(x) < 0, liegt ein Hochpunkt vor; bei f″(x) > 0 ein Tiefpunkt. Den y-Wert des Punktes erhältst du, indem du die Stelle in f einsetzt, nicht in f′. Ist f″(x) = 0, schaust du, ob f′ das Vorzeichen wechselt: Wenn nicht, ist es ein Sattelpunkt.

Wendestellen: f″(x) = 0 und f‴(x) ≠ 0. Dort wechselt der Graph zwischen Links- und Rechtskurve.

Monotonie: Wo f′ > 0 ist, steigt der Graph, wo f′ < 0 ist, fällt er. Symmetrie: Kommen nur gerade Exponenten vor (auch das absolute Glied), ist der Graph achsensymmetrisch zur y-Achse, denn f(−x) = f(x). Kommen nur ungerade Exponenten vor, ist er punktsymmetrisch zum Ursprung, denn f(−x) = −f(x).`,
  `Eine Stammfunktion F von f erfüllt F′ = f. Aufleiten ist die Umkehrung der Potenzregel: ∫ xⁿ dx = xⁿ⁺¹/(n + 1) + C für n ≠ −1. Beispiel: ∫ 3x² dx = x³ + C. Die Konstante C steht für unendlich viele Stammfunktionen, die sich nur um eine Zahl unterscheiden.

Das bestimmte Integral berechnest du mit F(b) − F(a). Beispiel: ∫₁³ 2x dx = [x²]₁³ = 9 − 1 = 8. Ein C brauchst du dabei nicht, denn es hebt sich bei der Differenz auf.

Das Integral zählt Flächen unter der x-Achse negativ. Für den Flächeninhalt zwischen Graph und x-Achse zerlegst du das Intervall an den Nullstellen, rechnest jedes Stück einzeln und addierst die Beträge.

Rechenregeln: Konstante Faktoren kommen vor das Integral, Summen darfst du einzeln integrieren, aneinandergrenzende Intervalle addierst du, und vertauschte Grenzen ändern das Vorzeichen. Der Mittelwert einer Funktion auf [a; b] ist 1/(b − a) · ∫ₐᵇ f(x) dx.`,
  `Die Funktion eˣ ist ihre eigene Ableitung: (eˣ)′ = eˣ und ∫ eˣ dx = eˣ + C. Steht im Exponenten kx, kommt wegen der Kettenregel die innere Ableitung dazu: (e^(kx))′ = k·e^(kx). Beim Aufleiten teilst du durch k: ∫ e^(kx) dx = e^(kx)/k + C. Es gilt e⁰ = 1 und eˣ > 0 für alle x.

Der natürliche Logarithmus ln ist die Umkehrfunktion von eˣ: ln(eˣ) = x und e^(ln x) = x für x > 0. Außerdem ist ln 1 = 0, ln e = 1 und (ln x)′ = 1/x. Allgemein fragt log_b(x): b hoch wie viel ergibt x? Zum Beispiel ist log₂(8) = 3.

Logarithmusgesetze für positive a und b: log(a·b) = log a + log b, log(a/b) = log a − log b, log(aⁿ) = n·log a. Ein Logarithmus einer Summe lässt sich nicht aufteilen.

Gleichungen: eˣ = 5 hat die Lösung x = ln 5. Bei e^(2x) = 7 ist 2x = ln 7, also x = ln(7)/2. Bei 2ˣ = 32 vergleichst du Potenzen derselben Basis: 2ˣ = 2⁵, also x = 5.`,
  `Das Bogenmaß misst einen Winkel als Länge des Kreisbogens am Einheitskreis. 180° entsprechen π. Du rechnest um mit Bogenmaß = Gradmaß · π/180. Merke: 30° = π/6, 45° = π/4, 60° = π/3, 90° = π/2.

Exakte Werte: Für 0°, 30°, 45°, 60° und 90° ist sin gleich 0, 1/2, √2/2, √3/2, 1 und cos gleich 1, √3/2, √2/2, 1/2, 0. Es gilt tan x = sin x / cos x und sin²x + cos²x = 1. Für andere Winkel nimmst du den Bezugswinkel und das Vorzeichen des Quadranten: sin ist im 1. und 2. Quadranten positiv, cos im 1. und 4.

Ableitungen: (sin x)′ = cos x und (cos x)′ = −sin x. Mit innerer Funktion kx kommt k dazu: (sin(kx))′ = k·cos(kx) und (cos(kx))′ = −k·sin(kx). Aufleiten: ∫ sin x dx = −cos x + C und ∫ cos x dx = sin x + C.

Bei f(x) = a·sin(kx) + d ist die Amplitude |a|, die Periode 2π/k und die Mittellinie y = d. Das Maximum ist |a| + d, das Minimum d − |a|.`,
  `Ein Vektor a = (a₁ | a₂ | a₃) hat den Betrag |a| = √(a₁² + a₂² + a₃²). Der Verbindungsvektor von A nach B ist AB = B − A (Spitze minus Fuß). Der Abstand zweier Punkte ist |AB|; der Mittelpunkt hat die Koordinaten (A + B)/2.

Das Skalarprodukt a·b = a₁b₁ + a₂b₂ + a₃b₃ ist eine Zahl, kein Vektor. Zwei Vektoren (ungleich dem Nullvektor) stehen genau dann senkrecht aufeinander, wenn a·b = 0 gilt. Für den Winkel gilt cos φ = a·b / (|a|·|b|).

Eine Gerade durch A mit Richtungsvektor u hat die Gleichung g: x = A + t·u. Für jedes t erhältst du einen Punkt. Der Richtungsvektor der Geraden durch A und B ist B − A.

Punktprobe: Setze P = A + t·u und löse die Koordinatengleichungen. Der Punkt liegt nur dann auf der Geraden, wenn jede Koordinate dasselbe t liefert.`,
  `Laplace-Wahrscheinlichkeit: P(E) = Anzahl der günstigen Fälle / Anzahl der möglichen Fälle, wenn alle Fälle gleich wahrscheinlich sind. Bei zwei Würfeln gibt es 36 gleich wahrscheinliche Paare; die Augensummen selbst sind nicht gleich wahrscheinlich. Beim Ziehen ohne Zurücklegen ändern sich Zähler und Nenner mit jedem Zug.

Der Binomialkoeffizient (n über k) = n! / (k!·(n − k)!) zählt, auf wie viele Arten man k von n Dingen auswählt. Beispiele: 5 über 2 = 10, n über 0 = n über n = 1, und (n über k) = (n über n−k).

Binomialverteilung: Bei n unabhängigen Versuchen mit Trefferwahrscheinlichkeit p gilt P(X = k) = (n über k)·pᵏ·(1−p)ⁿ⁻ᵏ. P(X ≤ k) ist die Summe der Einzelwahrscheinlichkeiten von 0 bis k. „Mindestens einmal“ rechnest du über das Gegenereignis: 1 − (1−p)ⁿ. Erwartungswert E(X) = n·p, Standardabweichung σ = √(n·p·(1−p)).

Bedingte Wahrscheinlichkeit: P(B|A) = P(A∩B) / P(A). Verwechsle nie P(A∩B) mit P(A|B). A und B sind unabhängig, wenn P(A∩B) = P(A)·P(B) gilt. Eine Vierfeldertafel ordnet alle vier Fälle und hilft beim Ausrechnen fehlender Werte.`,
];
