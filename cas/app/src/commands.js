// The German command language of the calculator: every command with its category, syntax, explanation and a worked
// example, and how it becomes Giac. The command search, the autocompletion and the help all read this list, and a
// test runs every example through Giac.

const list = (args) => args.join(',');

/**
 * name: what is typed · aliases: other spellings · cat: category in the command search · syntax · text: what it does
 * example: runs in the tests · giac: Giac text from the Giac text of the arguments (default: same name)
 */
export const COMMANDS = [
  // Rechnen
  { name: 'näherung', aliases: ['naeherung', 'dezimal', 'numerisch'], cat: 'Rechnen', syntax: 'näherung(Term) oder näherung(Term, Stellen)', text: 'Dezimalwert eines Terms, auf Wunsch mit vielen Stellen.', example: 'näherung(pi, 20)', giac: (a) => `evalf(${list(a)})` },
  { name: 'exakt', aliases: ['bruch'], cat: 'Rechnen', syntax: 'exakt(Dezimalzahl)', text: 'Macht aus einer Dezimalzahl einen Bruch.', example: 'exakt(0.375)', giac: (a) => `exact(${a[0]})` },
  { name: 'runde', aliases: ['runden'], cat: 'Rechnen', syntax: 'runde(Zahl, Stellen)', text: 'Rundet auf die angegebene Anzahl Nachkommastellen.', example: 'runde(3.14159, 2)', giac: (a) => `round(${a[0]},${a[1] || 0})` },
  { name: 'betrag', aliases: ['abs'], cat: 'Rechnen', syntax: 'betrag(Zahl)', text: 'Betrag |x| einer Zahl, eines Vektors oder einer komplexen Zahl.', example: 'betrag(-7)', giac: (a) => (a[0].startsWith('[') ? `norm(${a[0]})` : `abs(${a[0]})`) },
  { name: 'fakultät', aliases: ['fakultaet'], cat: 'Rechnen', syntax: 'fakultät(n) oder n!', text: 'n! = 1·2·…·n', example: 'fakultät(6)', giac: (a) => `factorial(${a[0]})` },
  { name: 'nck', aliases: ['binomialkoeffizient', 'binom'], cat: 'Rechnen', syntax: 'nck(n, k)', text: 'Binomialkoeffizient „n über k“: Anzahl der k-elementigen Teilmengen.', example: 'nck(49, 6)', giac: (a) => `comb(${list(a)})` },
  { name: 'wurzel', aliases: ['sqrt'], cat: 'Rechnen', syntax: 'wurzel(x) oder wurzel(x, n)', text: 'Quadratwurzel, mit n die n-te Wurzel.', example: 'wurzel(72)', giac: (a) => (a.length > 1 ? `surd(${a[0]},${a[1]})` : `sqrt(${a[0]})`) },
  { name: 'prozentwert', cat: 'Rechnen', syntax: 'prozentwert(p, G)', text: 'Prozentwert W = p % von G.', example: 'prozentwert(20, 150)' },
  { name: 'prozentsatz', cat: 'Rechnen', syntax: 'prozentsatz(W, G)', text: 'Welcher Prozentsatz ist W von G?', example: 'prozentsatz(30, 150)' },
  { name: 'grundwert', cat: 'Rechnen', syntax: 'grundwert(W, p)', text: 'Grundwert G, wenn W genau p % sind.', example: 'grundwert(30, 20)' },
  { name: 'ggt', cat: 'Rechnen', syntax: 'ggt(a, b)', text: 'Größter gemeinsamer Teiler, auch von Polynomen.', example: 'ggt(84, 36)', giac: (a) => `gcd(${list(a)})` },
  { name: 'kgv', cat: 'Rechnen', syntax: 'kgv(a, b)', text: 'Kleinstes gemeinsames Vielfaches.', example: 'kgv(12, 18)', giac: (a) => `lcm(${list(a)})` },
  { name: 'primfaktoren', aliases: ['primfaktorzerlegung'], cat: 'Rechnen', syntax: 'primfaktoren(n)', text: 'Zerlegt eine ganze Zahl in Primfaktoren.', example: 'primfaktoren(360)', giac: (a) => `ifactor(${a[0]})` },
  { name: 'teiler', cat: 'Rechnen', syntax: 'teiler(n)', text: 'Alle Teiler einer natürlichen Zahl.', example: 'teiler(36)', giac: (a) => `idivis(${a[0]})` },
  { name: 'istprim', aliases: ['primzahl'], cat: 'Rechnen', syntax: 'istprim(n)', text: 'Prüft, ob n eine Primzahl ist.', example: 'istprim(97)', giac: (a) => `isprime(${a[0]})` },
  { name: 'rest', aliases: ['mod'], cat: 'Rechnen', syntax: 'rest(a, b)', text: 'Rest der ganzzahligen Division a : b.', example: 'rest(17, 5)', giac: (a) => `irem(${list(a)})` },
  { name: 'ganzzahldivision', aliases: ['div'], cat: 'Rechnen', syntax: 'ganzzahldivision(a, b)', text: 'Ganzzahliger Anteil von a : b.', example: 'ganzzahldivision(17, 5)', giac: (a) => `iquo(${list(a)})` },

  // Algebra
  { name: 'vereinfache', aliases: ['vereinfachen', 'simplify'], cat: 'Algebra', syntax: 'vereinfache(Term)', text: 'Fasst einen Term so weit wie möglich zusammen.', example: 'vereinfache(sin(x)^2+cos(x)^2)', giac: (a) => `simplify(${a[0]})` },
  { name: 'ausmultiplizieren', aliases: ['ausmultipliziere', 'expandiere', 'expand'], cat: 'Algebra', syntax: 'ausmultiplizieren(Term)', text: 'Löst Klammern auf.', example: 'ausmultiplizieren((x+2)^3)', giac: (a) => `expand(${a[0]})` },
  { name: 'faktorisiere', aliases: ['faktorisieren', 'factor'], cat: 'Algebra', syntax: 'faktorisiere(Term)', text: 'Schreibt einen Term als Produkt, eine ganze Zahl als Produkt von Primzahlen.', example: 'faktorisiere(x^3-6x^2+11x-6)', giac: (a) => (/^-?\d+$/.test(a[0]) ? `ifactor(${a[0]})` : `factor(${a[0]})`) },
  { name: 'zusammenfassen', aliases: ['fasse'], cat: 'Algebra', syntax: 'zusammenfassen(Term)', text: 'Fasst gleichartige Glieder zusammen und bringt Brüche auf einen Nenner.', example: 'zusammenfassen(1/x+1/(x+1))', giac: (a) => `normal(${a[0]})` },
  { name: 'kürze', aliases: ['kuerze', 'kürzen', 'kuerzen'], cat: 'Algebra', syntax: 'kürze(Bruchterm)', text: 'Kürzt einen Bruchterm.', example: 'kürze((x^2-1)/(x-1))', giac: (a) => `normal(${a[0]})` },
  { name: 'partialbruch', aliases: ['partialbruchzerlegung'], cat: 'Algebra', syntax: 'partialbruch(Bruchterm)', text: 'Partialbruchzerlegung einer gebrochen-rationalen Funktion.', example: 'partialbruch(1/(x^2-1))', giac: (a) => `partfrac(${a[0]})` },
  { name: 'ersetze', aliases: ['einsetzen', 'setzeein', 'subst'], cat: 'Algebra', syntax: 'ersetze(Term, x = Wert)', text: 'Setzt einen Wert oder Term für eine Variable ein.', example: 'ersetze(x^2+1, x = a+1)', giac: (a) => `subst(${list(a)})` },
  { name: 'zähler', aliases: ['zaehler'], cat: 'Algebra', syntax: 'zähler(Bruch)', text: 'Zähler eines Bruchs oder Bruchterms.', example: 'zähler((x+1)/(x-2))', giac: (a) => `numer(${a[0]})` },
  { name: 'nenner', cat: 'Algebra', syntax: 'nenner(Bruch)', text: 'Nenner eines Bruchs oder Bruchterms.', example: 'nenner((x+1)/(x-2))', giac: (a) => `denom(${a[0]})` },
  { name: 'koeffizienten', cat: 'Algebra', syntax: 'koeffizienten(Polynom, x)', text: 'Koeffizienten eines Polynoms, höchste Potenz zuerst.', example: 'koeffizienten(3x^2-2x+5, x)', giac: (a) => `symb2poly(${a[0]},${a[1] || 'x'})` },
  { name: 'grad', aliases: ['polynomgrad'], cat: 'Algebra', syntax: 'grad(Polynom, x)', text: 'Grad eines Polynoms.', example: 'grad(3x^4-x+1, x)', giac: (a) => `degree(${a[0]},${a[1] || 'x'})` },
  { name: 'polynomdivision', cat: 'Algebra', syntax: 'polynomdivision(p, q)', text: 'Quotient und Rest der Polynomdivision p : q.', example: 'polynomdivision(x^3-2x+1, x-1)', giac: (a) => `[quo(${a[0]},${a[1]},x),rem(${a[0]},${a[1]},x)]` },
  { name: 'annahme', aliases: ['angenommen', 'assume'], cat: 'Algebra', syntax: 'annahme(a > 0)', text: 'Legt eine Bedingung für eine Variable fest; sie gilt für alle weiteren Rechnungen.', example: 'annahme(k > 0)', giac: (a) => `assume(${a[0]})` },
  { name: 'vergiss', aliases: ['lösche', 'loesche', 'purge'], cat: 'Algebra', syntax: 'vergiss(Name)', text: 'Löscht den Wert, die Funktion oder die Annahme eines Namens.', example: 'vergiss(k)', giac: (a) => `purge(${a[0]})` },

  // Gleichungen
  { name: 'löse', aliases: ['loese', 'lösen', 'loesen', 'solve'], cat: 'Gleichungen', syntax: 'löse(Gleichung, x) · löse([Gl1, Gl2], [x, y])', text: 'Löst Gleichungen, Ungleichungen und Gleichungssysteme exakt; Ungleichungen als Intervalle.', example: 'löse(x^2-5x+6=0, x)', giac: (a) => `solve(${list(a)})` },
  { name: 'nullstellen', aliases: ['nst'], cat: 'Gleichungen', syntax: 'nullstellen(Term, x)', text: 'Alle Nullstellen einer Funktion.', example: 'nullstellen(x^3-4x)', giac: (a) => `solve((${a[0]})=0,${a[1] || 'x'})` },
  { name: 'lösenumerisch', aliases: ['loesenumerisch', 'nlöse', 'fsolve'], cat: 'Gleichungen', syntax: 'lösenumerisch(Gleichung, x) · lösenumerisch(Gleichung, x = Startwert)', text: 'Löst eine Gleichung näherungsweise, wenn es keine exakte Lösung gibt.', example: 'lösenumerisch(cos(x)=x, x)', giac: (a) => `fsolve(${list(a)})` },
  { name: 'lösekomplex', aliases: ['loesekomplex', 'csolve'], cat: 'Gleichungen', syntax: 'lösekomplex(Gleichung, x)', text: 'Löst über den komplexen Zahlen.', example: 'lösekomplex(x^2+1=0, x)', giac: (a) => `csolve(${list(a)})` },
  { name: 'lgs', aliases: ['gleichungssystem'], cat: 'Gleichungen', syntax: 'lgs([Gl1, Gl2, …], [x, y, …])', text: 'Löst ein lineares Gleichungssystem.', example: 'lgs([x+y+z=6, x-y=0, 2x+z=5], [x, y, z])', giac: (a) => `linsolve(${list(a)})` },
  { name: 'probe', aliases: ['prüfe', 'pruefe'], cat: 'Gleichungen', syntax: 'probe(Gleichung, x = Wert)', text: 'Setzt einen Wert ein und prüft, ob die Gleichung stimmt.', example: 'probe(x^2=9, x = -3)', giac: (a) => `evalb(subst(${a[0]},${a[1]}))` },

  // Funktionen
  { name: 'ableiten', aliases: ['ableitung', 'leiteab', 'diff'], cat: 'Analysis', syntax: 'ableiten(f(x)) · ableiten(f(x), x, n)', text: 'Ableitung, mit n die n-te Ableitung.', example: 'ableiten(x^3*sin(x))', giac: (a) => (a.length === 3 && /^\d+$/.test(a[2]) ? `diff(${a[0]},${a[1]}$${a[2]})` : `diff(${list(a)})`) },
  { name: 'integriere', aliases: ['integrieren', 'integral', 'integrate'], cat: 'Analysis', syntax: 'integriere(f(x), x) · integriere(f(x), x, a, b)', text: 'Stammfunktion oder bestimmtes Integral von a bis b.', example: 'integriere(x^2, x, 0, 3)', giac: (a) => `integrate(${list(a)})` },
  { name: 'stammfunktion', cat: 'Analysis', syntax: 'stammfunktion(f(x), x)', text: 'Eine Stammfunktion F mit F\' = f (ohne +C).', example: 'stammfunktion(x*exp(x), x)', giac: (a) => `integrate(${a[0]},${a[1] || 'x'})` },
  { name: 'fläche', aliases: ['flaeche'], cat: 'Analysis', syntax: 'fläche(f(x), a, b)', text: 'Fläche zwischen Graph und x-Achse von a bis b (Teilflächen unter der Achse zählen positiv).', example: 'fläche(x^2-1, 0, 2)', giac: (a) => `integrate(abs(${a[0]}),x,${a[1]},${a[2]})` },
  { name: 'flächezwischen', aliases: ['flaechezwischen'], cat: 'Analysis', syntax: 'flächezwischen(f(x), g(x), a, b)', text: 'Fläche zwischen zwei Graphen von a bis b.', example: 'flächezwischen(x, x^2, 0, 1)', giac: (a) => `integrate(abs((${a[0]})-(${a[1]})),x,${a[2]},${a[3]})` },
  { name: 'grenzwert', aliases: ['limes', 'limit'], cat: 'Analysis', syntax: 'grenzwert(f(x), x, a) · a = unendlich', text: 'Grenzwert für x gegen a.', example: 'grenzwert(sin(x)/x, x, 0)', giac: (a) => `limit(${list(a)})` },
  { name: 'grenzwertrechts', cat: 'Analysis', syntax: 'grenzwertrechts(f(x), x, a)', text: 'Rechtsseitiger Grenzwert (x → a von rechts).', example: 'grenzwertrechts(1/x, x, 0)', giac: (a) => `limit(${a[0]},${a[1]},${a[2]},1)` },
  { name: 'grenzwertlinks', cat: 'Analysis', syntax: 'grenzwertlinks(f(x), x, a)', text: 'Linksseitiger Grenzwert (x → a von links).', example: 'grenzwertlinks(1/x, x, 0)', giac: (a) => `limit(${a[0]},${a[1]},${a[2]},-1)` },
  { name: 'tangente', cat: 'Analysis', syntax: 'tangente(f(x), a)', text: 'Gleichung der Tangente an den Graphen an der Stelle a.', example: 'tangente(x^2, 1)', giac: (a) => `normal(subst(${a[0]},x=${a[1]})+subst(diff(${a[0]},x),x=${a[1]})*(x-(${a[1]})))` },
  { name: 'normale', cat: 'Analysis', syntax: 'normale(f(x), a)', text: 'Gleichung der Normalen (senkrecht zur Tangente) an der Stelle a.', example: 'normale(x^2, 1)', giac: (a) => `normal(subst(${a[0]},x=${a[1]})-1/subst(diff(${a[0]},x),x=${a[1]})*(x-(${a[1]})))` },
  { name: 'sekante', cat: 'Analysis', syntax: 'sekante(f(x), a, b)', text: 'Gerade durch die Graphpunkte bei a und b.', example: 'sekante(x^2, 1, 3)', giac: (a) => `normal(subst(${a[0]},x=${a[1]})+(subst(${a[0]},x=${a[2]})-subst(${a[0]},x=${a[1]}))/((${a[2]})-(${a[1]}))*(x-(${a[1]})))` },
  { name: 'steigung', cat: 'Analysis', syntax: 'steigung(f(x), a)', text: 'Steigung des Graphen an der Stelle a, also f\'(a).', example: 'steigung(x^3, 2)', giac: (a) => `subst(diff(${a[0]},x),x=${a[1]})` },
  { name: 'kurvendiskussion', aliases: ['funktionsuntersuchung', 'untersuche'], cat: 'Analysis', syntax: 'kurvendiskussion(f(x))', text: 'Vollständige Untersuchung: Definitionsmenge, Symmetrie, Nullstellen, Extrem-, Wende- und Sattelpunkte, Monotonie, Krümmung, Asymptoten.', example: 'kurvendiskussion(x^3-3x)', special: 'analysis' },
  { name: 'extrempunkte', aliases: ['extrema', 'extremstellen'], cat: 'Analysis', syntax: 'extrempunkte(f(x))', text: 'Hoch- und Tiefpunkte mit hinreichender Bedingung.', example: 'extrempunkte(x^3-3x)', special: 'analysis' },
  { name: 'wendepunkte', aliases: ['wendestellen'], cat: 'Analysis', syntax: 'wendepunkte(f(x))', text: 'Wende- und Sattelpunkte.', example: 'wendepunkte(x^3-3x^2)', special: 'analysis' },
  { name: 'asymptoten', aliases: ['asymptote'], cat: 'Analysis', syntax: 'asymptoten(f(x))', text: 'Senkrechte, waagerechte und schiefe Asymptoten.', example: 'asymptoten((2x^2+1)/(x-1))', special: 'analysis' },
  { name: 'monotonie', cat: 'Analysis', syntax: 'monotonie(f(x))', text: 'Wo die Funktion steigt und fällt.', example: 'monotonie(x^3-3x)', special: 'analysis' },
  { name: 'krümmung', aliases: ['kruemmung'], cat: 'Analysis', syntax: 'krümmung(f(x))', text: 'Wo der Graph links- und rechtsgekrümmt ist.', example: 'krümmung(x^3-3x^2)', special: 'analysis' },
  { name: 'definitionsmenge', aliases: ['definitionsbereich'], cat: 'Analysis', syntax: 'definitionsmenge(f(x))', text: 'Die maximale Definitionsmenge.', example: 'definitionsmenge(ln(x-2))', special: 'analysis' },
  { name: 'mittelwertfunktion', aliases: ['funktionsmittelwert'], cat: 'Analysis', syntax: 'mittelwertfunktion(f(x), a, b)', text: 'Mittlerer Funktionswert auf [a; b].', example: 'mittelwertfunktion(x^2, 0, 2)', giac: (a) => `integrate(${a[0]},x,${a[1]},${a[2]})/((${a[2]})-(${a[1]}))` },
  { name: 'rotationsvolumen', aliases: ['rotationskörper'], cat: 'Analysis', syntax: 'rotationsvolumen(f(x), a, b)', text: 'Volumen des Körpers, der entsteht, wenn der Graph um die x-Achse rotiert.', example: 'rotationsvolumen(sqrt(x), 0, 4)', giac: (a) => `pi*integrate((${a[0]})^2,x,${a[1]},${a[2]})` },
  { name: 'implizit', aliases: ['impliziteableitung'], cat: 'Analysis', syntax: 'implizit(F(x,y) = 0, x, y)', text: 'Ableitung dy/dx einer implizit gegebenen Kurve.', example: 'implizit(x^2+y^2=1, x, y)', giac: (a) => `schulimplizit(${list(a)})` },
  { name: 'gradient', cat: 'Analysis', syntax: 'gradient(f(x,y), [x, y])', text: 'Gradient einer Funktion mehrerer Variablen.', example: 'gradient(x^2*y, [x, y])', giac: (a) => `grad(${list(a)})` },
  { name: 'richtungsableitung', cat: 'Analysis', syntax: 'richtungsableitung(f, [x, y], [u1, u2])', text: 'Ableitung in Richtung des Vektors u.', example: 'richtungsableitung(x^2*y, [x, y], [1, 1])', giac: (a) => `dot(grad(${a[0]},${a[1]}),normalize(${a[2]}))` },
  { name: 'hesse', aliases: ['hessematrix'], cat: 'Analysis', syntax: 'hesse(f(x,y), [x, y])', text: 'Hesse-Matrix der zweiten partiellen Ableitungen.', example: 'hesse(x^2*y, [x, y])', giac: (a) => `hessian(${list(a)})` },
  { name: 'taylor', aliases: ['taylorpolynom'], cat: 'Analysis', syntax: 'taylor(f(x), x = a, n)', text: 'Taylorpolynom n-ten Grades an der Stelle a.', example: 'taylor(exp(x), x = 0, 4)', giac: (a) => `convert(taylor(${list(a)}),polynom)` },
  { name: 'summe', aliases: ['sum'], cat: 'Analysis', syntax: 'summe(Term, k, a, b) · summe(Liste)', text: 'Summe über k von a bis b, auch unendliche Reihen.', example: 'summe(1/2^k, k, 0, unendlich)', giac: (a) => `sum(${list(a)})` },
  { name: 'produkt', aliases: ['product'], cat: 'Analysis', syntax: 'produkt(Term, k, a, b)', text: 'Produkt über k von a bis b.', example: 'produkt(k, k, 1, 5)', giac: (a) => `product(${list(a)})` },

  // Numerik
  { name: 'newton', aliases: ['newtonverfahren'], cat: 'Numerik', syntax: 'newton(f(x), x, Startwert)', text: 'Nullstelle mit dem Newton-Verfahren.', example: 'newton(x^2-2, x, 1)', giac: (a) => `newton(${list(a)})` },
  { name: 'bisektion', aliases: ['intervallhalbierung'], cat: 'Numerik', syntax: 'bisektion(f(x), a, b)', text: 'Nullstelle zwischen a und b durch Intervallhalbierung.', example: 'bisektion(x^3-2, 1, 2)', giac: (a) => `fsolve(${a[0]},x=${a[1]}..${a[2]},bisection_solver)` },
  { name: 'integralnumerisch', aliases: ['nintegral'], cat: 'Numerik', syntax: 'integralnumerisch(f(x), a, b)', text: 'Bestimmtes Integral näherungsweise.', example: 'integralnumerisch(exp(-x^2), 0, 1)', giac: (a) => `romberg(${a[0]},x,${a[1]},${a[2]})` },
  { name: 'ableitungnumerisch', cat: 'Numerik', syntax: 'ableitungnumerisch(f(x), a)', text: 'Ableitung an der Stelle a näherungsweise (zentraler Differenzenquotient).', example: 'ableitungnumerisch(x^3, 2)', giac: (a) => `evalf((subst(${a[0]},x=${a[1]}+1e-6)-subst(${a[0]},x=${a[1]}-1e-6))/2e-6)` },

  // Folgen
  { name: 'folge', aliases: ['seq'], cat: 'Folgen', syntax: 'folge(Term, n, von, bis)', text: 'Die Glieder einer explizit gegebenen Folge.', example: 'folge(n^2, n, 1, 6)', giac: (a) => `seq(${list(a)})` },
  { name: 'rekursion', aliases: ['rekursiv'], cat: 'Folgen', syntax: 'rekursion(a(n+1) = …, a(n), a(0) = Start)', text: 'Explizite Formel einer rekursiv gegebenen Folge.', example: 'rekursion(a(n+1)=2*a(n)+1, a(n), a(0)=1)', giac: (a) => `rsolve(${list(a)})` },
  { name: 'fibonacci', cat: 'Folgen', syntax: 'fibonacci(n)', text: 'Die n-te Fibonacci-Zahl.', example: 'fibonacci(20)', giac: (a) => `schulfibonacci(${a[0]})` },

  // Vektoren
  { name: 'skalarprodukt', aliases: ['dot'], cat: 'Vektoren', syntax: 'skalarprodukt(u, v)', text: 'Skalarprodukt zweier Vektoren.', example: 'skalarprodukt([1,2,3], [4,5,6])', giac: (a) => `dot(${list(a)})` },
  { name: 'kreuzprodukt', aliases: ['vektorprodukt', 'cross'], cat: 'Vektoren', syntax: 'kreuzprodukt(u, v)', text: 'Kreuzprodukt zweier Vektoren im Raum.', example: 'kreuzprodukt([1,0,0], [0,1,0])', giac: (a) => `cross(${list(a)})` },
  { name: 'länge', aliases: ['laenge', 'norm'], cat: 'Vektoren', syntax: 'länge(v)', text: 'Länge (Betrag) eines Vektors.', example: 'länge([3,4])', giac: (a) => `norm(${a[0]})` },
  { name: 'einheitsvektor', aliases: ['normiere'], cat: 'Vektoren', syntax: 'einheitsvektor(v)', text: 'Vektor der Länge 1 in Richtung v.', example: 'einheitsvektor([3,4])', giac: (a) => `normalize(${a[0]})` },
  { name: 'winkel', cat: 'Vektoren', syntax: 'winkel(u, v)', text: 'Winkel zwischen zwei Vektoren in Grad.', example: 'winkel([1,0], [1,1])', giac: (a) => `acos(dot(${a[0]},${a[1]})/(norm(${a[0]})*norm(${a[1]})))*180/pi` },
  { name: 'orthogonal', aliases: ['senkrecht'], cat: 'Vektoren', syntax: 'orthogonal(u, v)', text: 'Prüft, ob zwei Vektoren senkrecht aufeinander stehen.', example: 'orthogonal([1,2], [-2,1])', giac: (a) => `evalb(dot(${a[0]},${a[1]})==0)` },
  { name: 'kollinear', aliases: ['parallel'], cat: 'Vektoren', syntax: 'kollinear(u, v)', text: 'Prüft, ob zwei Vektoren parallel (Vielfache voneinander) sind.', example: 'kollinear([1,2,3], [2,4,6])', giac: (a) => `evalb(rank([${a[0]},${a[1]}])<2)` },
  { name: 'spatprodukt', cat: 'Vektoren', syntax: 'spatprodukt(u, v, w)', text: 'Spatprodukt (u × v) · w: Volumen des Spats.', example: 'spatprodukt([1,0,0], [0,1,0], [0,0,1])', giac: (a) => `dot(cross(${a[0]},${a[1]}),${a[2]})` },

  // Matrizen
  { name: 'determinante', aliases: ['det'], cat: 'Matrizen', syntax: 'determinante(A)', text: 'Determinante einer quadratischen Matrix.', example: 'determinante([[1,2],[3,4]])', giac: (a) => `det(${a[0]})` },
  { name: 'inverse', aliases: ['inv'], cat: 'Matrizen', syntax: 'inverse(A)', text: 'Inverse Matrix.', example: 'inverse([[1,2],[3,4]])', giac: (a) => `inv(${a[0]})` },
  { name: 'transponiere', aliases: ['transponierte'], cat: 'Matrizen', syntax: 'transponiere(A)', text: 'Vertauscht Zeilen und Spalten.', example: 'transponiere([[1,2,3],[4,5,6]])', giac: (a) => `tran(${a[0]})` },
  { name: 'rang', cat: 'Matrizen', syntax: 'rang(A)', text: 'Rang einer Matrix.', example: 'rang([[1,2],[2,4]])', giac: (a) => `rank(${a[0]})` },
  { name: 'stufenform', aliases: ['gauss', 'gauß'], cat: 'Matrizen', syntax: 'stufenform(A)', text: 'Reduzierte Stufenform nach dem Gauß-Verfahren.', example: 'stufenform([[1,2,3],[4,5,6]])', giac: (a) => `rref(${a[0]})` },
  { name: 'eigenwerte', cat: 'Matrizen', syntax: 'eigenwerte(A)', text: 'Eigenwerte einer quadratischen Matrix.', example: 'eigenwerte([[2,1],[1,2]])', giac: (a) => `eigenvals(${a[0]})` },
  { name: 'eigenvektoren', cat: 'Matrizen', syntax: 'eigenvektoren(A)', text: 'Eigenvektoren als Spalten einer Matrix.', example: 'eigenvektoren([[2,1],[1,2]])', giac: (a) => `eigenvects(${a[0]})` },
  { name: 'einheitsmatrix', cat: 'Matrizen', syntax: 'einheitsmatrix(n)', text: 'n×n-Einheitsmatrix.', example: 'einheitsmatrix(3)', giac: (a) => `idn(${a[0]})` },
  { name: 'spur', cat: 'Matrizen', syntax: 'spur(A)', text: 'Summe der Diagonalelemente.', example: 'spur([[1,2],[3,4]])', giac: (a) => `trace(${a[0]})` },
  { name: 'lu', aliases: ['luzerlegung'], cat: 'Matrizen', syntax: 'lu(A)', text: 'LU-Zerlegung (Permutation, L, U).', example: 'lu([[4,3],[6,3]])', giac: (a) => `lu(${a[0]})` },
  { name: 'charpoly', aliases: ['charakteristischespolynom'], cat: 'Matrizen', syntax: 'charpoly(A, x)', text: 'Charakteristisches Polynom.', example: 'charpoly([[2,1],[1,2]], x)', giac: (a) => `charpoly(${a[0]},${a[1] || 'x'})` },

  // Komplexe Zahlen
  { name: 'realteil', aliases: ['re'], cat: 'Komplexe Zahlen', syntax: 'realteil(z)', text: 'Realteil.', example: 'realteil(3+4i)', giac: (a) => `re(${a[0]})` },
  { name: 'imaginärteil', aliases: ['imaginaerteil', 'im'], cat: 'Komplexe Zahlen', syntax: 'imaginärteil(z)', text: 'Imaginärteil.', example: 'imaginärteil(3+4i)', giac: (a) => `im(${a[0]})` },
  { name: 'argument', aliases: ['arg'], cat: 'Komplexe Zahlen', syntax: 'argument(z)', text: 'Winkel φ in der Gaußschen Zahlenebene.', example: 'argument(1+i)', giac: (a) => `arg(${a[0]})` },
  { name: 'konjugiert', aliases: ['konjugierte', 'conj'], cat: 'Komplexe Zahlen', syntax: 'konjugiert(z)', text: 'Konjugiert komplexe Zahl.', example: 'konjugiert(2+3i)', giac: (a) => `conj(${a[0]})` },
  { name: 'polarform', cat: 'Komplexe Zahlen', syntax: 'polarform(z)', text: 'Betrag r und Winkel φ: z = r·e^(iφ).', example: 'polarform(1+i)', giac: (a) => `[abs(${a[0]}),arg(${a[0]})]` },
  { name: 'kartesisch', aliases: ['algebraischeform'], cat: 'Komplexe Zahlen', syntax: 'kartesisch(z)', text: 'Schreibt z als a + b·i.', example: 'kartesisch(2*exp(i*pi/3))', giac: (a) => `simplify(exp2trig(${a[0]}))` },

  // Statistik
  { name: 'mittelwert', aliases: ['mean'], cat: 'Statistik', syntax: 'mittelwert(Liste)', text: 'Arithmetisches Mittel.', example: 'mittelwert([2, 4, 4, 5, 10])', giac: (a) => `mean(${list(a)})` },
  { name: 'median', aliases: ['zentralwert'], cat: 'Statistik', syntax: 'median(Liste)', text: 'Median (bei gerader Anzahl das Mittel der beiden mittleren Werte).', example: 'median([1, 3, 3, 8, 9, 12])', giac: (a) => `schulmedian(${a[0]})` },
  { name: 'modus', aliases: ['modalwert'], cat: 'Statistik', syntax: 'modus(Liste)', text: 'Häufigster Wert (oder mehrere).', example: 'modus([1, 2, 2, 3, 3, 4])', giac: (a) => `schulmodus(${a[0]})` },
  { name: 'minimum', aliases: ['min'], cat: 'Statistik', syntax: 'minimum(Liste)', text: 'Kleinster Wert.', example: 'minimum([4, 1, 7])', giac: (a) => `min(${list(a)})` },
  { name: 'maximum', aliases: ['max'], cat: 'Statistik', syntax: 'maximum(Liste)', text: 'Größter Wert.', example: 'maximum([4, 1, 7])', giac: (a) => `max(${list(a)})` },
  { name: 'spannweite', cat: 'Statistik', syntax: 'spannweite(Liste)', text: 'Maximum − Minimum.', example: 'spannweite([4, 1, 7])', giac: (a) => `max(${a[0]})-min(${a[0]})` },
  { name: 'quartile', cat: 'Statistik', syntax: 'quartile(Liste)', text: 'Unteres Quartil, Median, oberes Quartil.', example: 'quartile([1,2,3,4,5,6,7,8])', giac: (a) => `schulquartile(${a[0]})` },
  { name: 'quantil', cat: 'Statistik', syntax: 'quantil(Liste, p)', text: 'p-Quantil (Schuldefinition).', example: 'quantil([1,2,3,4,5,6,7,8,9,10], 0.9)', giac: (a) => `schulquantil(${list(a)})` },
  { name: 'varianz', cat: 'Statistik', syntax: 'varianz(Liste)', text: 'Empirische Varianz (durch n geteilt).', example: 'varianz([1, 2, 3, 4])', giac: (a) => `variance(${a[0]})` },
  { name: 'stichprobenvarianz', cat: 'Statistik', syntax: 'stichprobenvarianz(Liste)', text: 'Stichprobenvarianz (durch n − 1 geteilt).', example: 'stichprobenvarianz([1, 2, 3, 4])', giac: (a) => `stddevp(${a[0]})^2` },
  { name: 'standardabweichung', aliases: ['sigma'], cat: 'Statistik', syntax: 'standardabweichung(Liste)', text: 'Empirische Standardabweichung (durch n geteilt).', example: 'standardabweichung([1, 2, 3, 4])', giac: (a) => `stddev(${a[0]})` },
  { name: 'stichprobenstandardabweichung', aliases: ['stdabwstichprobe'], cat: 'Statistik', syntax: 'stichprobenstandardabweichung(Liste)', text: 'Standardabweichung einer Stichprobe (durch n − 1).', example: 'stichprobenstandardabweichung([1, 2, 3, 4])', giac: (a) => `stddevp(${a[0]})` },
  { name: 'standardfehler', cat: 'Statistik', syntax: 'standardfehler(Liste)', text: 'Standardfehler des Mittelwerts s/√n.', example: 'standardfehler([1, 2, 3, 4])', giac: (a) => `stddevp(${a[0]})/sqrt(size(${a[0]}))` },
  { name: 'anzahl', aliases: ['länge_liste', 'size'], cat: 'Statistik', syntax: 'anzahl(Liste)', text: 'Anzahl der Elemente.', example: 'anzahl([4, 1, 7])', giac: (a) => `size(${a[0]})` },
  { name: 'häufigkeiten', aliases: ['haeufigkeiten'], cat: 'Statistik', syntax: 'häufigkeiten(Liste)', text: 'Jeder Wert mit seiner absoluten Häufigkeit.', example: 'häufigkeiten([1, 1, 2, 3, 3, 3])', giac: (a) => `tran([sort(set[op(${a[0]})]),map(sort(set[op(${a[0]})]),v->count_eq(v,${a[0]}))])` },
  { name: 'relativehäufigkeiten', aliases: ['relativehaeufigkeiten'], cat: 'Statistik', syntax: 'relativehäufigkeiten(Liste)', text: 'Jeder Wert mit seiner relativen Häufigkeit.', example: 'relativehäufigkeiten([1, 1, 2, 3, 3, 3])', giac: (a) => `frequencies(${a[0]})` },
  { name: 'kovarianz', cat: 'Statistik', syntax: 'kovarianz(X, Y)', text: 'Kovarianz zweier Datenreihen.', example: 'kovarianz([1,2,3,4], [2,4,5,8])', giac: (a) => `covariance(${list(a)})` },
  { name: 'korrelation', aliases: ['korrelationskoeffizient'], cat: 'Statistik', syntax: 'korrelation(X, Y)', text: 'Korrelationskoeffizient r nach Pearson.', example: 'korrelation([1,2,3,4], [2,4,5,8])', giac: (a) => `correlation(${list(a)})` },

  // Regression
  { name: 'regressionlinear', aliases: ['linreg'], cat: 'Regression', syntax: 'regressionlinear(X, Y)', text: 'Ausgleichsgerade y = m·x + b.', example: 'regressionlinear([1,2,3,4], [2,4,5,8])', giac: (a) => `evalf(linear_regression(${list(a)})[0]*x+linear_regression(${list(a)})[1])` },
  { name: 'regressionquadratisch', aliases: ['quadreg'], cat: 'Regression', syntax: 'regressionquadratisch(X, Y)', text: 'Ausgleichsparabel y = a·x² + b·x + c.', example: 'regressionquadratisch([0,1,2,3], [1,2,5,10])', giac: (a) => `evalf(poly2symb(polynomial_regression(${list(a)},2),x))` },
  { name: 'regressionpolynom', aliases: ['polyreg'], cat: 'Regression', syntax: 'regressionpolynom(X, Y, Grad)', text: 'Ausgleichspolynom beliebigen Grades.', example: 'regressionpolynom([0,1,2,3,4], [1,0,1,8,27], 3)', giac: (a) => `evalf(poly2symb(polynomial_regression(${list(a)}),x))` },
  { name: 'regressionexponentiell', aliases: ['expreg'], cat: 'Regression', syntax: 'regressionexponentiell(X, Y)', text: 'Exponentielle Ausgleichskurve y = a·bˣ.', example: 'regressionexponentiell([1,2,3], [2,4,8])', giac: (a) => `evalf(exponential_regression(${list(a)})[1]*exponential_regression(${list(a)})[0]^x)` },
  { name: 'regressionlogarithmisch', aliases: ['logreg'], cat: 'Regression', syntax: 'regressionlogarithmisch(X, Y)', text: 'Ausgleichskurve y = a·ln(x) + b.', example: 'regressionlogarithmisch([1,2,3], [0,0.7,1.1])', giac: (a) => `evalf(logarithmic_regression(${list(a)})[0]*ln(x)+logarithmic_regression(${list(a)})[1])` },
  { name: 'regressionpotenz', aliases: ['potreg'], cat: 'Regression', syntax: 'regressionpotenz(X, Y)', text: 'Ausgleichskurve y = a·xᵇ.', example: 'regressionpotenz([1,2,3], [1,4,9])', giac: (a) => `evalf(power_regression(${list(a)})[1]*x^power_regression(${list(a)})[0])` },
  { name: 'bestimmtheitsmaß', aliases: ['bestimmtheitsmass', 'rquadrat'], cat: 'Regression', syntax: 'bestimmtheitsmaß(X, Y)', text: 'Bestimmtheitsmaß r² der linearen Regression.', example: 'bestimmtheitsmaß([1,2,3,4], [2,4,5,8])', giac: (a) => `evalf(correlation(${list(a)})^2)` },

  // Wahrscheinlichkeit
  { name: 'binomialpdf', aliases: ['binompdf', 'bpdf'], cat: 'Wahrscheinlichkeit', syntax: 'binomialpdf(n, p, k)', text: 'P(X = k) für X ~ B(n; p).', example: 'binomialpdf(10, 0.5, 3)', giac: (a) => `binomial(${a[0]},${a[2]},${a[1]})` },
  { name: 'binomialcdf', aliases: ['binomcdf', 'bcdf'], cat: 'Wahrscheinlichkeit', syntax: 'binomialcdf(n, p, k) · binomialcdf(n, p, a, b)', text: 'P(X ≤ k), mit zwei Grenzen P(a ≤ X ≤ b).', example: 'binomialcdf(10, 0.5, 3)', giac: (a) => (a.length === 4 ? `binomial_cdf(${a[0]},${a[1]},${a[2]},${a[3]})` : `binomial_cdf(${a[0]},${a[1]},${a[2]})`) },
  { name: 'normalpdf', aliases: ['normpdf'], cat: 'Wahrscheinlichkeit', syntax: 'normalpdf(μ, σ, x)', text: 'Dichte der Normalverteilung an der Stelle x.', example: 'normalpdf(0, 1, 0)', giac: (a) => `normald(${list(a)})` },
  { name: 'normalcdf', aliases: ['normcdf'], cat: 'Wahrscheinlichkeit', syntax: 'normalcdf(μ, σ, x) · normalcdf(μ, σ, a, b)', text: 'P(X ≤ x), mit zwei Grenzen P(a ≤ X ≤ b).', example: 'normalcdf(0, 1, -1.96, 1.96)', giac: (a) => `normal_cdf(${list(a)})` },
  { name: 'invnorm', aliases: ['normalquantil'], cat: 'Wahrscheinlichkeit', syntax: 'invnorm(μ, σ, p)', text: 'Das x mit P(X ≤ x) = p.', example: 'invnorm(0, 1, 0.975)', giac: (a) => `normal_icdf(${list(a)})` },
  { name: 'poissonpdf', cat: 'Wahrscheinlichkeit', syntax: 'poissonpdf(λ, k)', text: 'P(X = k) der Poissonverteilung.', example: 'poissonpdf(2, 3)', giac: (a) => `poisson(${list(a)})` },
  { name: 'poissoncdf', cat: 'Wahrscheinlichkeit', syntax: 'poissoncdf(λ, k)', text: 'P(X ≤ k) der Poissonverteilung.', example: 'poissoncdf(2, 3)', giac: (a) => `poisson_cdf(${list(a)})` },
  { name: 'geometrischpdf', cat: 'Wahrscheinlichkeit', syntax: 'geometrischpdf(p, k)', text: 'P(X = k): erster Treffer im k-ten Versuch.', example: 'geometrischpdf(0.2, 3)', giac: (a) => `geometric(${list(a)})` },
  { name: 'hypergeometrisch', aliases: ['hypergeompdf'], cat: 'Wahrscheinlichkeit', syntax: 'hypergeometrisch(N, M, n, k)', text: 'P(X = k) beim Ziehen ohne Zurücklegen: N Kugeln, davon M Treffer, n gezogen.', example: 'hypergeometrisch(20, 5, 5, 2)', giac: (a) => `comb(${a[1]},${a[3]})*comb(${a[0]}-(${a[1]}),${a[2]}-(${a[3]}))/comb(${a[0]},${a[2]})` },
  { name: 'exponentialcdf', cat: 'Wahrscheinlichkeit', syntax: 'exponentialcdf(λ, x)', text: 'P(X ≤ x) der Exponentialverteilung.', example: 'exponentialcdf(0.5, 2)', giac: (a) => `exponential_cdf(${list(a)})` },
  { name: 'tcdf', cat: 'Wahrscheinlichkeit', syntax: 'tcdf(Freiheitsgrade, x)', text: 'P(T ≤ x) der Student-t-Verteilung.', example: 'tcdf(10, 2.228)', giac: (a) => `student_cdf(${list(a)})` },
  { name: 'invt', cat: 'Wahrscheinlichkeit', syntax: 'invt(Freiheitsgrade, p)', text: 'Quantil der t-Verteilung.', example: 'invt(10, 0.975)', giac: (a) => `student_icdf(${list(a)})` },
  { name: 'chi2cdf', cat: 'Wahrscheinlichkeit', syntax: 'chi2cdf(Freiheitsgrade, x)', text: 'P(χ² ≤ x).', example: 'chi2cdf(3, 7.81)', giac: (a) => `chisquare_cdf(${list(a)})` },
  { name: 'erwartungswert', cat: 'Wahrscheinlichkeit', syntax: 'erwartungswert(Werte, Wahrscheinlichkeiten)', text: 'E(X) = Σ xᵢ·P(X = xᵢ).', example: 'erwartungswert([1,2,3,4,5,6], [1/6,1/6,1/6,1/6,1/6,1/6])', giac: (a) => `sum(${a[0]}[k]*${a[1]}[k],k,0,size(${a[0]})-1)` },

  // Zufall
  { name: 'zufallszahl', aliases: ['zufall'], cat: 'Zufall', syntax: 'zufallszahl(a, b)', text: 'Ganze Zufallszahl von a bis b.', example: 'zufallszahl(1, 6)', giac: (a) => `randint(${list(a)})` },
  { name: 'würfeln', aliases: ['wuerfeln'], cat: 'Zufall', syntax: 'würfeln(n)', text: 'n Würfe eines Würfels.', example: 'würfeln(10)', giac: (a) => `schulwuerfeln(${a[0]})` },
  { name: 'münzwurf', aliases: ['muenzwurf'], cat: 'Zufall', syntax: 'münzwurf(n)', text: 'n Münzwürfe (1 = Kopf, 0 = Zahl).', example: 'münzwurf(10)', giac: (a) => `seq(randint(0,1),k,1,${a[0]})` },

  // Einheiten
  { name: 'umrechnen', aliases: ['convert'], cat: 'Einheiten', syntax: 'umrechnen(Wert_Einheit, _Einheit)', text: 'Rechnet in eine andere Einheit um.', example: 'umrechnen(100_(km/h), _(m/s))', giac: (a) => `convert(${list(a)})` },
  { name: 'si', aliases: ['basiseinheiten'], cat: 'Einheiten', syntax: 'si(Wert_Einheit)', text: 'Schreibt eine Größe in SI-Basiseinheiten.', example: 'si(3_kWh)', giac: (a) => `mksa(${a[0]})` },

  // Differentialgleichungen
  { name: 'dgl', aliases: ['löse_dgl', 'desolve'], cat: 'Differentialgleichungen', syntax: 'dgl(y\' = …, y) · dgl([y\'\' + y = 0, y(0) = 0, y\'(0) = 1], y)', text: 'Löst eine Differentialgleichung, auch mit Anfangswerten.', example: 'dgl(y\'=2*y, y)', giac: (a) => `desolve(${list(a)})` },
  { name: 'laplace', cat: 'Transformationen', syntax: 'laplace(f(t), t, s)', text: 'Laplace-Transformierte.', example: 'laplace(sin(t), t, s)', giac: (a) => `laplace(${list(a)})` },
  { name: 'invlaplace', aliases: ['ilaplace'], cat: 'Transformationen', syntax: 'invlaplace(F(s), s, t)', text: 'Inverse Laplace-Transformation.', example: 'invlaplace(1/(s^2+1), s, t)', giac: (a) => `ilaplace(${list(a)})` },
  { name: 'ztransformation', aliases: ['ztrans'], cat: 'Transformationen', syntax: 'ztransformation(a(n), n, z)', text: 'Z-Transformation.', example: 'ztransformation(1, n, z)', giac: (a) => `ztrans(${list(a)})` },
  { name: 'fourierkoeffizient', aliases: ['fourier_an'], cat: 'Transformationen', syntax: 'fourierkoeffizient(f(x), x, T, n, a)', text: 'Fourier-Koeffizient aₙ auf [a; a+T].', example: 'fourierkoeffizient(x^2, x, 2*pi, 1, -pi)', giac: (a) => `fourier_an(${list(a)})` },
  { name: 'residuum', aliases: ['residue'], cat: 'Transformationen', syntax: 'residuum(f(z), z, z0)', text: 'Residuum einer Funktion an einer Polstelle.', example: 'residuum(1/(z^2+1), z, i)', giac: (a) => `residue(${list(a)})` },
  { name: 'divergenz', aliases: ['divergence'], cat: 'Vektoranalysis', syntax: 'divergenz([F1, F2, F3], [x, y, z])', text: 'Divergenz eines Vektorfelds.', example: 'divergenz([x^2, y^2, z^2], [x, y, z])', giac: (a) => `divergence(${list(a)})` },
  { name: 'rotation', aliases: ['rot', 'curl'], cat: 'Vektoranalysis', syntax: 'rotation([F1, F2, F3], [x, y, z])', text: 'Rotation eines Vektorfelds.', example: 'rotation([y, -x, 0], [x, y, z])', giac: (a) => `curl(${list(a)})` },
];

const byName = new Map();
for (const command of COMMANDS) {
  byName.set(command.name, command);
  for (const alias of command.aliases || []) if (!byName.has(alias)) byName.set(alias, command);
}

/** The command for a typed name, any spelling, or undefined. */
export function command(name) {
  return byName.get(String(name).toLowerCase());
}

/** Every spelling, longest first, for recognizing words typed letter by letter. */
export const COMMAND_NAMES = [...byName.keys()];

/** Giac text for a call of a German command; unknown names pass through. */
export function giacCall(name, args) {
  const found = command(name);
  if (!found) return null;
  if (found.giac) return found.giac(args);
  return `${found.name}(${args.join(',')})`;
}

/** Commands matching a search, by name first, then by description. */
export function searchCommands(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return COMMANDS;
  const scored = [];
  for (const c of COMMANDS) {
    const names = [c.name, ...(c.aliases || [])];
    let score = 0;
    if (names.some((n) => n === q)) score = 100;
    else if (names.some((n) => n.startsWith(q))) score = 80;
    else if (names.some((n) => n.includes(q))) score = 60;
    else if (c.text.toLowerCase().includes(q)) score = 40;
    else if (c.cat.toLowerCase().includes(q)) score = 30;
    if (score) scored.push([score, c]);
  }
  return scored.sort((a, b) => b[0] - a[0]).map(([, c]) => c);
}

export const CATEGORIES = [...new Set(COMMANDS.map((c) => c.cat))];
