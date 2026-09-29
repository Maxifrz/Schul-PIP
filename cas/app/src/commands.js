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

  // Grafik: objects the graphics view draws; their value is what the CAS shows (equation, length, area).
  { name: 'gerade', cat: 'Grafik', syntax: 'gerade(A, B) oder gerade(A, m)', text: 'Gerade durch zwei Punkte oder durch einen Punkt mit Steigung m. Wert: die Geradengleichung.', example: 'gerade((1|2), (3|6))', graphic: 'line' },
  { name: 'strecke', cat: 'Grafik', syntax: 'strecke(A, B)', text: 'Strecke von A nach B. Wert: ihre Länge.', example: 'strecke((0|0), (3|4))', graphic: 'segment' },
  { name: 'strahl', aliases: ['halbgerade'], cat: 'Grafik', syntax: 'strahl(A, B)', text: 'Strahl von A durch B. Wert: die Gleichung der Geraden, auf der er liegt.', example: 'strahl((0|0), (1|1))', graphic: 'ray' },
  { name: 'vektor', cat: 'Grafik', syntax: 'vektor(A, B) oder vektor(v)', text: 'Pfeil von A nach B (oder vom Ursprung). Wert: der Vektor B − A.', example: 'vektor((1|1), (4|3))', graphic: 'vector' },
  { name: 'kreis', cat: 'Grafik', syntax: 'kreis(M, r) oder kreis(M, P)', text: 'Kreis um M mit Radius r oder durch den Punkt P. Wert: die Kreisgleichung.', example: 'kreis((1|2), 3)', graphic: 'circle' },
  { name: 'polygon', aliases: ['vieleck', 'dreieck', 'viereck'], cat: 'Grafik', syntax: 'polygon(A, B, C, …)', text: 'Vieleck mit den Ecken A, B, C, … Wert: sein Flächeninhalt.', example: 'polygon((0|0), (4|0), (4|3))', graphic: 'polygon' },
  { name: 'vieleck', aliases: ['regelmäßigesvieleck', 'regelmaessigesvieleck'], cat: 'Grafik', syntax: 'vieleck(A, B, n)', text: 'Regelmäßiges n-Eck mit der Seite AB. Wert: sein Flächeninhalt.', example: 'vieleck((0|0), (2|0), 6)', graphic: 'polygon' },
  { name: 'mittelpunkt', aliases: ['mitte'], cat: 'Geometrie', syntax: 'mittelpunkt(A, B) oder mittelpunkt(Strecke)', text: 'Mittelpunkt einer Strecke; bei einem Kreis sein Mittelpunkt.', example: 'mittelpunkt((0|0), (4|2))', graphic: 'point' },
  { name: 'schnittpunkt', aliases: ['schnittpunkte', 'schneide'], cat: 'Geometrie', syntax: 'schnittpunkt(Objekt1, Objekt2)', text: 'Schnittpunkte zweier Geraden, Kreise, Graphen oder Kurven.', example: 'schnittpunkt(y = x, x^2 + y^2 = 8)', graphic: 'points' },
  { name: 'parallele', cat: 'Geometrie', syntax: 'parallele(g, P)', text: 'Parallele zu g durch den Punkt P.', example: 'parallele(y = 2x, (1|0))', graphic: 'line' },
  { name: 'senkrechte', aliases: ['lot', 'orthogonale'], cat: 'Geometrie', syntax: 'senkrechte(g, P)', text: 'Senkrechte zu g durch den Punkt P.', example: 'senkrechte(y = 2x, (0|0))', graphic: 'line' },
  { name: 'mittelsenkrechte', cat: 'Geometrie', syntax: 'mittelsenkrechte(A, B)', text: 'Mittelsenkrechte der Strecke AB.', example: 'mittelsenkrechte((0|0), (4|0))', graphic: 'line' },
  { name: 'winkelhalbierende', cat: 'Geometrie', syntax: 'winkelhalbierende(A, B, C)', text: 'Halbiert den Winkel ABC (Scheitel B).', example: 'winkelhalbierende((4|0), (0|0), (0|4))', graphic: 'line' },
  { name: 'höhe', aliases: ['hoehe'], cat: 'Geometrie', syntax: 'höhe(A, B, C)', text: 'Höhe im Dreieck von A auf die Seite BC. Wert: ihre Länge.', example: 'höhe((0|3), (-2|0), (2|0))', graphic: 'segment' },
  { name: 'kreisbogen', aliases: ['bogen'], cat: 'Geometrie', syntax: 'kreisbogen(M, A, B)', text: 'Bogen um M von A gegen den Uhrzeigersinn bis zur Richtung von B. Wert: seine Länge.', example: 'kreisbogen((0|0), (2|0), (0|2))', graphic: 'arc' },
  { name: 'kreissektor', aliases: ['sektor', 'kreisausschnitt'], cat: 'Geometrie', syntax: 'kreissektor(M, A, B)', text: 'Kreisausschnitt um M von A bis zur Richtung von B. Wert: sein Flächeninhalt.', example: 'kreissektor((0|0), (2|0), (0|2))', graphic: 'sector' },
  { name: 'umkreis', cat: 'Geometrie', syntax: 'umkreis(A, B, C) oder kreis(A, B, C)', text: 'Kreis durch drei Punkte. Wert: seine Gleichung.', example: 'umkreis((0|0), (4|0), (0|4))', graphic: 'circle' },
  { name: 'inkreis', cat: 'Geometrie', syntax: 'inkreis(A, B, C)', text: 'Inkreis eines Dreiecks. Wert: seine Gleichung.', example: 'inkreis((0|0), (4|0), (0|3))', graphic: 'circle' },
  { name: 'schwerpunkt', cat: 'Geometrie', syntax: 'schwerpunkt(A, B, C)', text: 'Schwerpunkt eines Dreiecks (Schnitt der Seitenhalbierenden).', example: 'schwerpunkt((0|0), (6|0), (0|3))', graphic: 'point' },
  { name: 'umkreismittelpunkt', cat: 'Geometrie', syntax: 'umkreismittelpunkt(A, B, C)', text: 'Mittelpunkt des Umkreises (Schnitt der Mittelsenkrechten).', example: 'umkreismittelpunkt((0|0), (4|0), (0|4))', graphic: 'point' },
  { name: 'inkreismittelpunkt', cat: 'Geometrie', syntax: 'inkreismittelpunkt(A, B, C)', text: 'Mittelpunkt des Inkreises (Schnitt der Winkelhalbierenden).', example: 'inkreismittelpunkt((0|0), (4|0), (0|3))', graphic: 'point' },
  { name: 'höhenschnittpunkt', aliases: ['hoehenschnittpunkt'], cat: 'Geometrie', syntax: 'höhenschnittpunkt(A, B, C)', text: 'Schnittpunkt der Höhen eines Dreiecks.', example: 'höhenschnittpunkt((0|0), (4|0), (1|3))', graphic: 'point' },
  { name: 'eulergerade', cat: 'Geometrie', syntax: 'eulergerade(A, B, C)', text: 'Gerade durch Schwerpunkt, Umkreismittelpunkt und Höhenschnittpunkt.', example: 'eulergerade((0|0), (4|0), (1|3))', graphic: 'line' },
  { name: 'abstand', aliases: ['entfernung'], cat: 'Geometrie', syntax: 'abstand(A, B) oder abstand(P, g)', text: 'Abstand zweier Punkte oder eines Punkts von einer Geraden.', example: 'abstand((0|0), y = -x + 2)', graphic: 'measure' },
  { name: 'umfang', cat: 'Geometrie', syntax: 'umfang(Vieleck) oder umfang(A, B, C, …)', text: 'Umfang eines Vielecks oder Kreises.', example: 'umfang((0|0), (3|0), (3|4))', graphic: 'measure' },
  { name: 'punktauf', aliases: ['gleiter'], cat: 'Geometrie', syntax: 'punktauf(Objekt, Wert)', text: 'Punkt, der sich nur auf einem Objekt ziehen lässt. Der Wert sagt, wo er sitzt: x auf einem Graphen, Winkel auf einem Kreis, Anteil auf einer Strecke.', example: 'punktauf(kreis((0|0), 2), pi/4)', graphic: 'point' },
  { name: 'ortslinie', aliases: ['ortskurve'], cat: 'Geometrie', syntax: 'ortslinie(P, a)', text: 'Die Bahn des Punkts P, wenn der Schieberegler a (oder ein Punkt auf einem Objekt) seinen Bereich durchläuft.', example: 'ortslinie(P, a)', graphic: 'locus', noExample: true },
  { name: 'spiegeln', aliases: ['spiegelung', 'spiegle'], cat: 'Abbildungen', syntax: 'spiegeln(Objekt, P) oder spiegeln(Objekt, g)', text: 'Spiegelt einen Punkt, eine Strecke, einen Kreis oder ein Vieleck an einem Punkt oder einer Geraden.', example: 'spiegeln((3|1), y = x)', graphic: 'transform' },
  { name: 'verschieben', aliases: ['verschiebung', 'verschiebe'], cat: 'Abbildungen', syntax: 'verschieben(Objekt, v)', text: 'Verschiebt ein Objekt um den Vektor v.', example: 'verschieben((1|1), (3|-2))', graphic: 'transform' },
  { name: 'drehen', aliases: ['drehung', 'drehe', 'rotieren'], cat: 'Abbildungen', syntax: 'drehen(Objekt, Winkel, Z)', text: 'Dreht ein Objekt um Z (sonst um den Ursprung), Winkel in Grad gegen den Uhrzeigersinn.', example: 'drehen((2|0), 90, (0|0))', graphic: 'transform' },
  { name: 'strecken', aliases: ['streckung', 'zentrischestreckung'], cat: 'Abbildungen', syntax: 'strecken(Objekt, k, Z)', text: 'Zentrische Streckung mit dem Faktor k um Z (sonst um den Ursprung).', example: 'strecken((1|2), 3, (0|0))', graphic: 'transform' },
  // Raum
  { name: 'ebene', cat: 'Raum', syntax: 'ebene(A, B, C), ebene(P, n) oder ebene(2x + y − z = 4)', text: 'Ebene durch drei Punkte, durch einen Punkt mit Normalenvektor n oder aus einer Gleichung. Wert: die Koordinatenform. Auch direkt: E: 2x + y − z = 4.', example: 'ebene((1|0|0), (0|2|0), (0|0|3))', graphic: 'space' },
  { name: 'koordinatenform', cat: 'Raum', syntax: 'koordinatenform(E)', text: 'Ebene als a·x + b·y + c·z = d.', example: 'koordinatenform(ebene((0|0|0), vektor((1|2|2))))', graphic: 'space' },
  { name: 'normalenform', cat: 'Raum', syntax: 'normalenform(E)', text: 'Ebene als (x⃗ − p⃗) · n⃗ = 0.', example: 'normalenform(ebene((1|0|0), (0|2|0), (0|0|3)))', graphic: 'space' },
  { name: 'parameterform', cat: 'Raum', syntax: 'parameterform(E)', text: 'Ebene als x⃗ = p⃗ + r·u⃗ + s·v⃗.', example: 'parameterform(ebene((1|0|0), (0|2|0), (0|0|3)))', graphic: 'space' },
  { name: 'hessenormalform', aliases: ['hnf'], cat: 'Raum', syntax: 'hessenormalform(E)', text: 'Hesse-Normalform, zum Ablesen von Abständen.', example: 'hessenormalform(ebene((1|0|0), (0|2|0), (0|0|3)))', graphic: 'space' },
  { name: 'schnittgerade', cat: 'Raum', syntax: 'schnittgerade(E, F)', text: 'Gerade, in der sich zwei Ebenen schneiden.', example: 'schnittgerade(x + y + z = 5, 2x - y = 1)', graphic: 'space' },
  { name: 'lage', aliases: ['lagebeziehung'], cat: 'Raum', syntax: 'lage(g, h), lage(g, E), lage(E, F) oder lage(P, E)', text: 'Lagebeziehung in Worten: schneiden sich (wo), parallel, identisch, windschief.', example: 'lage(gerade((1|0|0), (1|1|1)), gerade((0|0|0), (1|1|0)))', graphic: 'space' },
  { name: 'lotfußpunkt', aliases: ['lotfusspunkt', 'lotfuss'], cat: 'Raum', syntax: 'lotfußpunkt(P, g) oder lotfußpunkt(P, E)', text: 'Fußpunkt des Lots von P auf eine Gerade oder Ebene.', example: 'lotfußpunkt((0|0|0), x + y + z = 3)', graphic: 'space' },
  { name: 'kugel', cat: 'Raum', syntax: 'kugel(M, r) oder kugel(M, P)', text: 'Kugel um M. Wert: die Kugelgleichung.', example: 'kugel((1|2|3), 2)', graphic: 'space' },
  { name: 'pyramide', cat: 'Raum', syntax: 'pyramide(A, B, C, …, S)', text: 'Pyramide mit der Grundfläche A, B, C, … und der Spitze S. Wert: ihr Volumen.', example: 'pyramide((0|0|0), (4|0|0), (4|4|0), (0|4|0), (2|2|6))', graphic: 'space' },
  { name: 'prisma', cat: 'Raum', syntax: "prisma(A, B, C, …, A')", text: 'Prisma mit der Grundfläche A, B, C, …; der letzte Punkt ist das Bild von A in der Deckfläche. Wert: sein Volumen.', example: 'prisma((0|0|0), (2|0|0), (0|2|0), (0|0|5))', graphic: 'space' },
  { name: 'quader', cat: 'Raum', syntax: 'quader(A, G)', text: 'Achsenparalleler Quader mit den gegenüberliegenden Ecken A und G. Wert: sein Volumen.', example: 'quader((0|0|0), (2|3|4))', graphic: 'space' },
  { name: 'würfel', aliases: ['wuerfel'], cat: 'Raum', syntax: 'würfel(A, a)', text: 'Würfel mit der Ecke A und der Kantenlänge a. Wert: sein Volumen.', example: 'würfel((0|0|0), 2)', graphic: 'space' },
  { name: 'zylinder', cat: 'Raum', syntax: 'zylinder(M₁, M₂, r)', text: 'Zylinder zwischen den Mittelpunkten der Grund- und Deckfläche. Wert: sein Volumen.', example: 'zylinder((0|0|0), (0|0|4), 1)', graphic: 'space' },
  { name: 'kegel', cat: 'Raum', syntax: 'kegel(M, S, r)', text: 'Kegel mit dem Grundkreismittelpunkt M, der Spitze S und dem Radius r. Wert: sein Volumen.', example: 'kegel((0|0|0), (0|0|3), 2)', graphic: 'space' },
  { name: 'volumen', cat: 'Raum', syntax: 'volumen(Körper)', text: 'Volumen eines Körpers, Zylinders, Kegels oder einer Kugel.', example: 'volumen(kugel((0|0|0), 3))', graphic: 'space' },
  { name: 'oberfläche', aliases: ['oberflaeche', 'oberflächeninhalt'], cat: 'Raum', syntax: 'oberfläche(Körper)', text: 'Oberflächeninhalt eines Körpers, Zylinders, Kegels oder einer Kugel.', example: 'oberfläche(quader((0|0|0), (2|3|4)))', graphic: 'space' },
  { name: 'parameterfläche', aliases: ['parameterflaeche'], cat: 'Raum', syntax: 'parameterfläche(x(u,v), y(u,v), z(u,v), u, a, b, v, c, d)', text: 'Parameterfläche im Raum.', example: 'parameterfläche(cos(u)*sin(v), sin(u)*sin(v), cos(v), u, 0, 2pi, v, 0, pi)', graphic: 'space' },
  { name: 'vektorfeld', cat: 'Raum', syntax: 'vektorfeld([P, Q, R])', text: 'Vektorfeld mit Pfeilen in der 3D-Ansicht.', example: 'vektorfeld([y, -x, 0])', graphic: 'space' },
  { name: 'tangentialebene', cat: 'Raum', syntax: 'tangentialebene(f, a, b)', text: 'Tangentialebene an den Graphen von f(x, y) im Punkt über (a | b).', example: 'tangentialebene(x^2 - y^2, 1, 1)', graphic: 'space' },

  { name: 'kurve', aliases: ['parameterkurve', 'raumkurve'], cat: 'Grafik', syntax: 'kurve(x(t), y(t), t, a, b) oder kurve(x(t), y(t), z(t), t, a, b)', text: 'Parameterkurve: der Punkt (x(t)|y(t)) oder im Raum (x(t)|y(t)|z(t)) für t von a bis b.', example: 'kurve(cos(t), sin(2t), t, 0, 2pi)', graphic: 'curve' },
  { name: 'polarkurve', aliases: ['polar'], cat: 'Grafik', syntax: 'polarkurve(r(t), t, a, b)', text: 'Kurve in Polarkoordinaten: Abstand r(t) vom Ursprung beim Winkel t.', example: 'polarkurve(1+cos(t), t, 0, 2pi)', graphic: 'polar' },
  { name: 'funktion', aliases: ['einschränkung'], cat: 'Grafik', syntax: 'funktion(Term, a, b)', text: 'Funktionsgraph nur zwischen x = a und x = b.', example: 'funktion(x^2, -1, 2)', graphic: 'restricted' },

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
  { name: 'lgs', aliases: ['gleichungssystem'], cat: 'Gleichungen', syntax: 'lgs([Gl1, Gl2, …], [x, y, …])', text: 'Löst ein lineares Gleichungssystem.', example: 'lgs([x+y+z=6, x-y=1, x+z=4], [x, y, z])', giac: (a) => `linsolve(${list(a)})` },
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
  { name: 'winkel', cat: 'Vektoren', syntax: 'winkel(u, v) oder winkel(A, B, C)', text: 'Winkel zwischen zwei Vektoren in Grad; mit drei Punkten der Winkel ABC am Scheitel B, auch in der Grafik.', example: 'winkel([1,0], [1,1])', giac: (a) => `simplify(acos(dot(${a[0]},${a[1]})/(norm(${a[0]})*norm(${a[1]})))*180/pi)` },
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
  { name: 'stichprobenvarianz', cat: 'Statistik', syntax: 'stichprobenvarianz(Liste)', text: 'Stichprobenvarianz (durch n − 1 geteilt).', example: 'stichprobenvarianz([1, 2, 3, 4])', giac: (a) => `simplify(stddevp(${a[0]})^2)` },
  { name: 'standardabweichung', aliases: ['sigma'], cat: 'Statistik', syntax: 'standardabweichung(Liste)', text: 'Empirische Standardabweichung (durch n geteilt).', example: 'standardabweichung([1, 2, 3, 4])', giac: (a) => `stddev(${a[0]})` },
  { name: 'stichprobenstandardabweichung', aliases: ['stdabwstichprobe'], cat: 'Statistik', syntax: 'stichprobenstandardabweichung(Liste)', text: 'Standardabweichung einer Stichprobe (durch n − 1).', example: 'stichprobenstandardabweichung([1, 2, 3, 4])', giac: (a) => `stddevp(${a[0]})` },
  { name: 'standardfehler', cat: 'Statistik', syntax: 'standardfehler(Liste)', text: 'Standardfehler des Mittelwerts s/√n.', example: 'standardfehler([1, 2, 3, 4])', giac: (a) => `simplify(stddevp(${a[0]})/sqrt(size(${a[0]})))` },
  { name: 'anzahl', aliases: ['länge_liste', 'size'], cat: 'Statistik', syntax: 'anzahl(Liste)', text: 'Anzahl der Elemente.', example: 'anzahl([4, 1, 7])', giac: (a) => `size(${a[0]})` },
  { name: 'häufigkeiten', aliases: ['haeufigkeiten'], cat: 'Statistik', syntax: 'häufigkeiten(Liste)', text: 'Jeder Wert mit seiner absoluten Häufigkeit.', example: 'häufigkeiten([1, 1, 2, 3, 3, 3])', giac: (a) => `tran([sort(set[op(${a[0]})]),map(sort(set[op(${a[0]})]),v->count_eq(v,${a[0]}))])` },
  { name: 'relativehäufigkeiten', aliases: ['relativehaeufigkeiten'], cat: 'Statistik', syntax: 'relativehäufigkeiten(Liste)', text: 'Jeder Wert mit seiner relativen Häufigkeit.', example: 'relativehäufigkeiten([1, 1, 2, 3, 3, 3])', giac: (a) => `frequencies(${a[0]})` },
  { name: 'kovarianz', cat: 'Statistik', syntax: 'kovarianz(X, Y)', text: 'Kovarianz zweier Datenreihen.', example: 'kovarianz([1,2,3,4], [2,4,5,8])', giac: (a) => `covariance(${list(a)})` },
  { name: 'korrelation', aliases: ['korrelationskoeffizient'], cat: 'Statistik', syntax: 'korrelation(X, Y)', text: 'Korrelationskoeffizient r nach Pearson.', example: 'korrelation([1,2,3,4], [2,4,5,8])', giac: (a) => `correlation(${list(a)})` },

  // Regression
  { name: 'regressionlinear', aliases: ['linreg'], cat: 'Regression', syntax: 'regressionlinear(X, Y)', text: 'Ausgleichsgerade y = m·x + b.', example: 'regressionlinear([1,2,3,4], [2,4,5,8])' },
  { name: 'regressionquadratisch', aliases: ['quadreg'], cat: 'Regression', syntax: 'regressionquadratisch(X, Y)', text: 'Ausgleichsparabel y = a·x² + b·x + c.', example: 'regressionquadratisch([0,1,2,3], [1,2,5,10])' },
  { name: 'regressionpolynom', aliases: ['polyreg'], cat: 'Regression', syntax: 'regressionpolynom(X, Y, Grad)', text: 'Ausgleichspolynom beliebigen Grades.', example: 'regressionpolynom([0,1,2,3,4], [1,0,1,8,27], 3)' },
  { name: 'regressionexponentiell', aliases: ['expreg'], cat: 'Regression', syntax: 'regressionexponentiell(X, Y)', text: 'Exponentielle Ausgleichskurve y = a·bˣ.', example: 'regressionexponentiell([1,2,3], [2,4,8])' },
  { name: 'regressionlogarithmisch', aliases: ['logreg'], cat: 'Regression', syntax: 'regressionlogarithmisch(X, Y)', text: 'Ausgleichskurve y = a·ln(x) + b.', example: 'regressionlogarithmisch([1,2,3], [0,0.7,1.1])' },
  { name: 'regressionpotenz', aliases: ['potreg'], cat: 'Regression', syntax: 'regressionpotenz(X, Y)', text: 'Ausgleichskurve y = a·xᵇ.', example: 'regressionpotenz([1,2,3], [1,4,9])' },
  { name: 'bestimmtheitsmaß', aliases: ['bestimmtheitsmass', 'rquadrat'], cat: 'Regression', syntax: 'bestimmtheitsmaß(X, Y) oder bestimmtheitsmaß(X, Y, Modell)', text: 'Bestimmtheitsmaß R² einer Regression (Modell: linear, quadratisch, kubisch, exponentiell, logarithmisch, potenz, sinus).', example: 'bestimmtheitsmaß([1,2,3,4], [2,4,5,8])' },
  { name: 'regressionsinus', aliases: ['sinreg', 'sinusregression'], cat: 'Regression', syntax: 'regressionsinus(X, Y)', text: 'Ausgleichskurve y = a·sin(b·x + c) + d.', example: 'regressionsinus([0,1,2,3,4,5,6,7], [1,2.7,2.8,1.3,-0.5,-0.9,0.4,2.2])' },
  { name: 'regressionkubisch', aliases: ['kubreg'], cat: 'Regression', syntax: 'regressionkubisch(X, Y)', text: 'Ausgleichspolynom dritten Grades.', example: 'regressionkubisch([0,1,2,3,4], [1,0,1,8,27])' },
  { name: 'regression', aliases: ['modellvergleich', 'regressionsgleichung'], cat: 'Regression', syntax: 'regression(X, Y) oder regression(X, Y, Modell)', text: 'Ohne Modell: alle Modelle mit Gleichung und R², das beste zuerst. Mit Modell: Regressionsgleichung, R² und Residuen.', example: 'regression([1,2,3,4,5,6], [2.1,3.9,8.2,15.8,32.5,63.7])' },
  { name: 'residuen', cat: 'Regression', syntax: 'residuen(X, Y, Modell)', text: 'Die Residuen yᵢ − f(xᵢ) als Liste.', example: 'residuen([1,2,3,4], [2,4,5,8], linear)' },
  { name: 'residuenplot', aliases: ['residuendiagramm'], cat: 'Diagramme', syntax: 'residuenplot(X, Y, Modell)', text: 'Zeichnet die Residuen über x, mit Nulllinie.', example: 'residuenplot([1,2,3,4,5], [2,4,5,8,9], linear)' },

  { name: 'zellen', aliases: ['bereich'], cat: 'Tabelle', syntax: 'zellen(A1, A10) oder zellen(A1, C5)', text: 'Die Werte eines Tabellenbereichs: eine Spalte oder Zeile als Liste, mehrere als Matrix. Einzelne Zellen heißen im CAS einfach A1, B2 …', example: 'zellen(A1, A3)', noExample: true },

  { name: 'hilfe', aliases: ['help', 'erklärung'], cat: 'Rechnen', syntax: 'hilfe(Befehl)', text: 'Zeigt Schreibweise, Erklärung und Beispiel eines Befehls; hilfe() listet die Bereiche.', example: 'hilfe(ableiten)' },

  // Schritt für Schritt und weitere Untersuchungen
  { name: 'ableitungsschritte', aliases: ['ableitungsregel', 'ableitungsweg'], cat: 'Analysis', syntax: 'ableitungsschritte(f(x))', text: 'Zeigt, welche Regel gilt (Summen-, Faktor-, Potenz-, Produkt-, Quotienten-, Kettenregel), mit u, v, u′, v′ und dem Ergebnis.', example: 'ableitungsschritte(x^2*sin(x))' },
  { name: 'lösungsschritte', aliases: ['loesungsschritte', 'lösungsweg'], cat: 'Gleichungen', syntax: 'lösungsschritte(Gleichung) · lösungsschritte(Gleichung, x)', text: 'Lineare Gleichungen durch Umformen, quadratische mit Normalform, Diskriminante und pq-Formel.', example: 'lösungsschritte(2x^2 - 8x + 6 = 0)' },
  { name: 'gaußschritte', aliases: ['gaussschritte', 'gaußverfahren', 'gaussverfahren'], cat: 'Matrizen', syntax: 'gaußschritte(Matrix)', text: 'Das Gauß-Jordan-Verfahren mit jeder Zeilenumformung, exakt mit Brüchen.', example: 'gaußschritte([[2, 1, -1, 8], [-3, -1, 2, -11], [-2, 1, 2, -3]])' },
  { name: 'umkehrfunktion', aliases: ['inversefunktion'], cat: 'Analysis', syntax: 'umkehrfunktion(f(x))', text: 'Löst y = f(x) nach x auf und tauscht x und y.', example: 'umkehrfunktion((2x+1)/(x-3))' },
  { name: 'wertebereich', aliases: ['wertemenge'], cat: 'Analysis', syntax: 'wertebereich(f(x))', text: 'Der Wertebereich aus Extremwerten, Grenzwerten und Polstellen.', example: 'wertebereich(x^2 - 4x + 1)' },
  { name: 'vorzeichentabelle', aliases: ['vorzeichen', 'vorzeichenbereiche'], cat: 'Analysis', syntax: 'vorzeichentabelle(f(x))', text: 'Wo die Funktion positiv, negativ oder null ist, zwischen Null- und Polstellen.', example: 'vorzeichentabelle((x^2-4)/(x-1))' },
  { name: 'ungleichungssystem', aliases: ['ungleichungen'], cat: 'Gleichungen', syntax: 'ungleichungssystem(U₁, U₂, …)', text: 'Mehrere Ungleichungen zugleich: in x als Intervall, in x und y als Fläche in der Grafik.', example: 'ungleichungssystem(y > x^2 - 2, y < x, x > -1)' },
  { name: 'parameterableitung', cat: 'Analysis', syntax: 'parameterableitung(x(t), y(t)) oder parameterableitung(x(t), y(t), t)', text: 'Steigung dy/dx = ẏ/ẋ einer Kurve in Parameterform.', example: 'parameterableitung(cos(t), sin(t))' },
  { name: 'konvergenz', aliases: ['konvergiert', 'divergenz_folge'], cat: 'Folgen', syntax: 'konvergenz(aₙ, n)', text: 'Ob die Folge konvergiert (mit Grenzwert) und ob die Reihe Σ aₙ konvergiert, mit dem Quotientenkriterium.', example: 'konvergenz(1/n^2, n)' },
  { name: 'kurvenintegral', aliases: ['linienintegral', 'arbeitsintegral'], cat: 'Vektoranalysis', syntax: 'kurvenintegral(F oder f, [x(t), y(t), z(t)], t, a, b)', text: 'Kurvenintegral eines Vektorfelds (∫ F · dr) oder einer Funktion (∫ f ds) längs einer Kurve.', example: 'kurvenintegral([y, x, z], [cos(t), sin(t), t], t, 0, 2*pi)' },
  { name: 'flächenintegral', aliases: ['flaechenintegral', 'oberflächenintegral'], cat: 'Vektoranalysis', syntax: 'flächenintegral(f, [x(u,v), y(u,v), z(u,v)], u, a, b, v, c, d)', text: 'Integral einer Funktion über eine Fläche in Parameterform.', example: 'flächenintegral(1, [u, v, 0], u, 0, 2, v, 0, 3)' },
  { name: 'fluss', aliases: ['flussintegral'], cat: 'Vektoranalysis', syntax: 'fluss(F, [x(u,v), y(u,v), z(u,v)], u, a, b, v, c, d)', text: 'Fluss eines Vektorfelds durch eine Fläche.', example: 'fluss([0, 0, 1], [u, v, 0], u, 0, 1, v, 0, 1)' },
  { name: 'flächennormale', aliases: ['flaechennormale', 'normalenvektorfläche'], cat: 'Vektoranalysis', syntax: 'flächennormale([x(u,v), y(u,v), z(u,v)], u, v)', text: 'Der Normalenvektor rᵤ × rᵥ einer Fläche in Parameterform.', example: 'flächennormale([cos(u)*sin(v), sin(u)*sin(v), cos(v)], u, v)' },
  { name: 'höhenlinien', aliases: ['hoehenlinien', 'skalarfeld', 'isolinien'], cat: 'Vektoranalysis', syntax: 'höhenlinien(f(x, y))', text: 'Zeichnet ein Skalarfeld als Höhenlinien in der Ebene.', example: 'höhenlinien(x^2 + 2y^2)' },
  { name: 'temperatur', cat: 'Einheiten', syntax: 'temperatur(Wert, von, nach) mit C, K oder F', text: 'Rechnet Temperaturen mit ihrem Nullpunkt um.', example: 'temperatur(20, C, F)' },
  { name: 'einheiten', aliases: ['einheitenliste'], cat: 'Einheiten', syntax: 'einheiten()', text: 'Die Einheiten nach Größen, wie man sie schreibt.', example: 'einheiten()' },

  { name: 'aufgabe', aliases: ['übung', 'uebung', 'übungsaufgabe'], cat: 'Üben', syntax: 'aufgabe(Thema, Stufe, Anzahl) · Themen: ableiten, integrieren, gleichung, bruch, prozent, binomial', text: 'Übungsaufgaben in drei Schwierigkeitsstufen, einzeln oder als Serie. aufgabe() zeigt die Themen; eine vierte Zahl gibt neue Zahlen.', example: 'aufgabe(ableiten, 2)' },
  { name: 'prüfe', aliases: ['pruefe', 'antwort'], cat: 'Üben', syntax: 'prüfe(Antwort) · prüfe(Nummer, Antwort)', text: 'Prüft die Antwort zur Aufgabe darüber mit dem CAS und nennt bei Fehlern den wahrscheinlichen Grund (Vorzeichen, Faktor, Kettenregel, fehlende Lösung …).', example: 'prüfe(3)', noExample: true },

  // Folgen, Iterationen, Numerik
  { name: 'folgenplot', aliases: ['folgengraph', 'folgendiagramm'], cat: 'Folgen', syntax: 'folgenplot(Term, n, von, bis)', text: 'Zeichnet die Folgenglieder als Punkte (n | aₙ), mit Tabelle und Grenzwert.', example: 'folgenplot((1+1/n)^n, n, 1, 20)' },
  { name: 'iteration', aliases: ['iteriere', 'fixpunktiteration'], cat: 'Folgen', syntax: 'iteration(f(x), Startwert, Schritte)', text: 'Folgeniteration xₖ₊₁ = f(xₖ) mit Tabelle und Fehlerschätzung aus der letzten Änderung.', example: 'iteration(cos(x), 1, 15)' },
  { name: 'spinnweb', aliases: ['rekursionsdiagramm', 'spinnwebdiagramm', 'cobweb'], cat: 'Folgen', syntax: 'spinnweb(f(x), Startwert, Schritte)', text: 'Spinnwebdiagramm einer Rekursion xₖ₊₁ = f(xₖ): Graph von f, die Gerade y = x und der Weg der Iteration.', example: 'spinnweb(2.8x(1-x), 0.2, 30)' },
  { name: 'newtonschritte', aliases: ['newtonverfahren'], cat: 'Numerik', syntax: 'newtonschritte(f(x), Startwert) · newtonschritte(f(x), Startwert, Schritte)', text: 'Das Newton-Verfahren Schritt für Schritt, mit den Tangenten im Bild.', example: 'newtonschritte(x^2-2, 1)' },
  { name: 'bisektionsschritte', aliases: ['intervallhalbierung'], cat: 'Numerik', syntax: 'bisektionsschritte(f(x), a, b) · bisektionsschritte(f(x), a, b, Schritte)', text: 'Das Bisektionsverfahren Schritt für Schritt, mit den Intervallen im Bild und der Fehlerschranke.', example: 'bisektionsschritte(x^3-2, 1, 2, 10)' },
  { name: 'rundungsfehler', aliases: ['rundungsfehleranalyse'], cat: 'Numerik', syntax: 'rundungsfehler(Term)', text: 'Der exakte Wert gegen gerundete Werte mit 4 bis 15 Stellen und ihre Fehler.', example: 'rundungsfehler(1/3 + pi)' },
  { name: 'restglied', aliases: ['taylorfehler'], cat: 'Numerik', syntax: 'restglied(f(x), a, n, b)', text: 'Taylorpolynom vom Grad n um a, die Fehlerschranke nach Lagrange auf [a; b] und der tatsächliche Fehler bei b.', example: 'restglied(sin(x), 0, 5, 1)' },
  { name: 'richtungsfeld', aliases: ['steigungsfeld'], cat: 'Differentialgleichungen', syntax: "richtungsfeld(y' = f(x, y))", text: 'Zeichnet das Richtungsfeld einer Differentialgleichung erster Ordnung.', example: "richtungsfeld(y' = x - y)" },
  { name: 'lösungskurve', aliases: ['loesungskurve', 'anfangswertkurve'], cat: 'Differentialgleichungen', syntax: "lösungskurve(y' = f(x, y), x₀, y₀)", text: 'Die Lösungskurve durch (x₀ | y₀), numerisch mit Runge-Kutta, in beide Richtungen.', example: "lösungskurve(y' = x - y, 0, 1)" },
  { name: 'phasenporträt', aliases: ['phasenportraet', 'phasendiagramm'], cat: 'Differentialgleichungen', syntax: "phasenporträt(x' = f(x, y), y' = g(x, y))", text: 'Phasenporträt eines Systems: Pfeile und einige Bahnen.', example: 'phasenporträt(y, -x - 0.3y)' },
  { name: 'zahlenebene', aliases: ['gaußschezahlenebene', 'gausszahlenebene', 'argand'], cat: 'Komplexe Zahlen', syntax: 'zahlenebene(z₁, z₂, …)', text: 'Zeichnet komplexe Zahlen als Pfeile in der Gaußschen Zahlenebene, mit Betrag und Argument.', example: 'zahlenebene(3+4i, 1-i, -2i)' },

  // Programme
  { name: 'programm', aliases: ['funktion'], cat: 'Programme', syntax: 'programm name(Parameter) … ende', text: 'Ein eigener Befehl aus mehreren Zeilen (Umschalt+Eingabe oder Eingabe bis zum letzten „ende“): wenn … dann / sonst / ende, solange … ende, für k von 1 bis n … ende, wiederhole n mal … ende, zurück Wert, ausgabe Wert, lokal a, b. Rekursion ist erlaubt. Giacs Schreibweise f(n):={ … } geht auch.', example: 'programm fak(n)\n  wenn n <= 1 dann\n    zurück 1\n  ende\n  zurück n * fak(n - 1)\nende' },
  { name: 'anwenden', aliases: ['map'], cat: 'Programme', syntax: 'anwenden(Liste, x -> Term)', text: 'Wendet eine Funktion auf jedes Element einer Liste an.', example: 'anwenden([1, 2, 3, 4], x -> x^2)', giac: (a) => `map(${a[0]},${a[1]})` },
  { name: 'auswählen', aliases: ['auswaehlen', 'filter', 'select'], cat: 'Programme', syntax: 'auswählen(Liste, x -> Bedingung)', text: 'Die Elemente einer Liste, für die die Bedingung gilt.', example: 'auswählen([1, 2, 3, 4, 5, 6], x -> irem(x, 2) == 0)', giac: (a) => `select(${a[1]},${a[0]})` },

  { name: 'knopf', aliases: ['schaltfläche', 'button'], cat: 'Programme', syntax: 'knopf("Beschriftung")', text: 'Ein Knopf unter der Grafik und in der Zeile. Sein Skript (⋯ am Knopf) läuft bei jedem Druck: Regler setzen, Objekte erzeugen, zeigen oder löschen, Animationen starten, Meldungen.', example: 'knopf("Würfeln")', giac: (a) => a[0] || '"Knopf"' },

  // Diagramme: they draw in the graphics and list their values in the CAS.
  { name: 'boxplot', aliases: ['kastenschaubild'], cat: 'Diagramme', syntax: 'boxplot(Liste) oder boxplot(Liste, Höhe)', text: 'Boxplot mit Minimum, Quartilen, Median und Maximum (auf Höhe 1 oder der angegebenen).', example: 'boxplot([2, 3, 5, 7, 8, 9, 12, 15])' },
  { name: 'histogramm', cat: 'Diagramme', syntax: 'histogramm(Liste, Klassenbreite) oder histogramm(Liste, Breite, Start)', text: 'Histogramm mit gleich breiten Klassen [a; a + Breite[.', example: 'histogramm([1.2, 1.5, 2.1, 2.2, 2.8, 3.4, 3.5, 4.1], 1)' },
  { name: 'balkendiagramm', aliases: ['säulendiagramm', 'saeulendiagramm', 'stabdiagramm'], cat: 'Diagramme', syntax: 'balkendiagramm(Liste) oder balkendiagramm(Werte, Häufigkeiten)', text: 'Säulendiagramm: zählt die Werte einer Liste oder nimmt die Häufigkeiten wie angegeben.', example: 'balkendiagramm([1, 2, 3, 4], [5, 9, 7, 2])' },
  { name: 'kreisdiagramm', aliases: ['tortendiagramm'], cat: 'Diagramme', syntax: 'kreisdiagramm(Werte, Häufigkeiten) · kreisdiagramm(…, [x, y], r)', text: 'Kreisdiagramm mit Anteilen und Winkeln; auf Wunsch mit Mittelpunkt und Radius.', example: 'kreisdiagramm([1, 2, 3], [10, 25, 15])' },
  { name: 'streudiagramm', aliases: ['punktdiagramm', 'punktwolke'], cat: 'Diagramme', syntax: 'streudiagramm(X, Y)', text: 'Punktwolke der Wertepaare, mit dem Korrelationskoeffizienten.', example: 'streudiagramm([1,2,3,4,5], [2,4,5,4,6])' },
  { name: 'statistik', aliases: ['kennzahlen', 'kennwerte', 'lagemaße'], cat: 'Statistik', syntax: 'statistik(Liste)', text: 'Alle Kennzahlen auf einmal: Mittelwert, Median, Modus, Quartile, Spannweite, Varianz, Standardabweichung, Standardfehler …', example: 'statistik([2, 4, 4, 5, 7, 9])' },
  { name: 'häufigkeitstabelle', aliases: ['haeufigkeitstabelle', 'strichliste'], cat: 'Statistik', syntax: 'häufigkeitstabelle(Liste)', text: 'Jeder Wert mit absoluter, relativer und kumulierter Häufigkeit.', example: 'häufigkeitstabelle([1, 1, 2, 3, 3, 3])' },
  { name: 'klassen', aliases: ['klasseneinteilung'], cat: 'Statistik', syntax: 'klassen(Liste, Breite) oder klassen(Liste, Breite, Start)', text: 'Teilt die Daten in gleich breite Klassen und zählt.', example: 'klassen([1.2, 1.5, 2.1, 2.2, 2.8, 3.4], 1)' },

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
  { name: 'geometrischcdf', cat: 'Wahrscheinlichkeit', syntax: 'geometrischcdf(p, k)', text: 'P(X ≤ k): erster Treffer spätestens im k-ten Versuch.', example: 'geometrischcdf(0.2, 3)', giac: (a) => `1-(1-(${a[0]}))^(${a[1]})` },
  { name: 'hypergeometrischcdf', cat: 'Wahrscheinlichkeit', syntax: 'hypergeometrischcdf(N, M, n, k)', text: 'P(X ≤ k) beim Ziehen ohne Zurücklegen.', example: 'hypergeometrischcdf(20, 5, 5, 2)', giac: (a) => `sum(comb(${a[1]},j)*comb(${a[0]}-(${a[1]}),${a[2]}-j)/comb(${a[0]},${a[2]}),j,0,${a[3]})` },
  { name: 'exponentialpdf', cat: 'Wahrscheinlichkeit', syntax: 'exponentialpdf(λ, x)', text: 'Dichte der Exponentialverteilung.', example: 'exponentialpdf(0.5, 2)', giac: (a) => `(${a[0]})*exp(-(${a[0]})*(${a[1]}))` },
  { name: 'invbinom', aliases: ['binomialquantil'], cat: 'Wahrscheinlichkeit', syntax: 'invbinom(n, p, q)', text: 'Das kleinste k mit P(X ≤ k) ≥ q für X ~ B(n; p).', example: 'invbinom(100, 0.5, 0.95)' },
  { name: 'verteilung', aliases: ['verteilungsdiagramm', 'wahrscheinlichkeitsverteilung'], cat: 'Wahrscheinlichkeit', syntax: 'verteilung(Name, Parameter …) · verteilung(Name, Parameter …, a, b)', text: 'Tabelle, Erwartungswert, σ und Diagramm einer Verteilung (binomial, poisson, geometrisch, hypergeometrisch, gleich, normal, exponential, stetiggleich, t, chi2). Mit a und b: P(a ≤ X ≤ b), im Diagramm markiert. Mit Schiebereglern als Parametern wird es interaktiv.', example: 'verteilung(binomial, 20, 0.3, 4, 8)' },
  { name: 'kenngrößen', aliases: ['kenngroessen', 'zufallsgröße', 'zufallsgroesse'], cat: 'Wahrscheinlichkeit', syntax: 'kenngrößen(Werte, Wahrscheinlichkeiten)', text: 'Erwartungswert, Varianz und Standardabweichung einer Zufallsgröße.', example: 'kenngrößen([0, 1, 2], [1/4, 1/2, 1/4])' },
  { name: 'sigmaumgebung', aliases: ['sigmaregel', 'sigmaregeln'], cat: 'Wahrscheinlichkeit', syntax: 'sigmaumgebung(n, p, c)', text: 'Das Intervall μ ± c·σ von B(n; p) und seine Wahrscheinlichkeit (c = 1, 2, 3, 1.64, 1.96, 2.58 …).', example: 'sigmaumgebung(100, 0.5, 1.96)' },

  // Tests
  { name: 'binomialtest', aliases: ['hypothesentest'], cat: 'Tests', syntax: 'binomialtest(n, p₀, α, links | rechts | beidseitig) · binomialtest(…, k)', text: 'Ablehnungsbereich und tatsächliche Irrtumswahrscheinlichkeit; mit beobachtetem k auch p-Wert und Entscheidung. Zeichnet die Verteilung mit markiertem Ablehnungsbereich.', example: 'binomialtest(100, 0.5, 0.05, rechts, 60)' },
  { name: 'gausstest', aliases: ['gaußtest', 'ztest', 'mittelwerttest'], cat: 'Tests', syntax: 'gausstest(Liste, μ₀, σ, α, Seite) oder gausstest(x̄, n, μ₀, σ, α, Seite)', text: 'Test für einen Mittelwert bei bekanntem σ: Teststatistik z, p-Wert, Entscheidung.', example: 'gausstest(103, 36, 100, 12, 0.05, rechts)' },
  { name: 'ttest', aliases: ['t_test'], cat: 'Tests', syntax: 'ttest(Liste, μ₀, α, Seite)', text: 't-Test für einen Mittelwert bei unbekanntem σ.', example: 'ttest([5.1, 4.9, 5.3, 5.2, 4.8, 5.0, 5.4], 5, 0.05, beidseitig)' },
  { name: 'zweistichprobenttest', aliases: ['ttest2'], cat: 'Tests', syntax: 'zweistichprobenttest(L₁, L₂, α, Seite)', text: 'Vergleicht die Mittelwerte zweier Stichproben (Welch-Test).', example: 'zweistichprobenttest([5,6,7,8,9], [7,8,9,10,11], 0.05, beidseitig)' },
  { name: 'varianztest', aliases: ['chi2varianztest'], cat: 'Tests', syntax: 'varianztest(Liste, σ₀², α, Seite)', text: 'χ²-Test für eine Varianz.', example: 'varianztest([4.8, 5.2, 5.1, 4.7, 5.3, 5.0], 0.04, 0.05, rechts)' },
  { name: 'ftest', aliases: ['varianzvergleich'], cat: 'Tests', syntax: 'ftest(L₁, L₂, α, Seite)', text: 'F-Test: haben zwei Stichproben dieselbe Varianz?', example: 'ftest([1,3,5,7,9], [4,5,5,6,5], 0.05, beidseitig)' },
  { name: 'chi2test', aliases: ['chiquadrattest', 'anpassungstest', 'unabhängigkeitstest'], cat: 'Tests', syntax: 'chi2test(beobachtet, erwartet, α) oder chi2test(Kreuztabelle, α)', text: 'χ²-Anpassungstest (erwartet als Anzahlen oder Wahrscheinlichkeiten) oder Unabhängigkeitstest einer Kreuztabelle.', example: 'chi2test([18, 22, 16, 25, 20, 19], [1/6, 1/6, 1/6, 1/6, 1/6, 1/6], 0.05)' },
  { name: 'konfidenzintervall', aliases: ['vertrauensintervall'], cat: 'Tests', syntax: 'konfidenzintervall(k, n, γ) oder konfidenzintervall(Liste, γ) · konfidenzintervall(Liste, γ, σ)', text: 'Konfidenzintervall für einen Anteil p (aus k Treffern bei n) oder für einen Mittelwert.', example: 'konfidenzintervall(40, 100, 0.95)' },

  // Simulation
  { name: 'würfelsimulation', aliases: ['wuerfelsimulation'], cat: 'Simulation', syntax: 'würfelsimulation(n) oder würfelsimulation(n, Würfelzahl)', text: 'n Würfe (mit mehreren Würfeln die Augensumme): Häufigkeiten gegen Wahrscheinlichkeiten, als Tabelle und Diagramm.', example: 'würfelsimulation(600)' },
  { name: 'münzwurfsimulation', aliases: ['muenzwurfsimulation'], cat: 'Simulation', syntax: 'münzwurfsimulation(n)', text: 'n Münzwürfe mit Häufigkeiten und Diagramm.', example: 'münzwurfsimulation(100)' },
  { name: 'zufallsexperiment', cat: 'Simulation', syntax: 'zufallsexperiment(Ergebnisse, Wahrscheinlichkeiten, n)', text: 'Führt ein Zufallsexperiment n-mal durch und vergleicht die relativen Häufigkeiten mit den Wahrscheinlichkeiten.', example: 'zufallsexperiment([0, 1, 5], [0.7, 0.25, 0.05], 500)' },
  { name: 'simuliere', aliases: ['simulation', 'wiederhole'], cat: 'Simulation', syntax: 'simuliere(Verteilung, Parameter …, Wiederholungen)', text: 'Wiederholt ein Experiment und vergleicht mit der Verteilung, z. B. simuliere(binomial, 10, 0.3, 1000).', example: 'simuliere(binomial, 10, 0.3, 1000)' },
  { name: 'ziehen', aliases: ['urne', 'ziehung'], cat: 'Simulation', syntax: 'ziehen(Urne, n) oder ziehen(Urne, n, ohne)', text: 'Zieht n Kugeln aus einer Urne, mit oder ohne Zurücklegen.', example: 'ziehen([1, 1, 1, 2, 2, 3], 3, ohne)' },
  { name: 'montecarlo', aliases: ['montecarlointegral'], cat: 'Simulation', syntax: 'montecarlo(f(x), a, b, n)', text: 'Schätzt ∫ f(x) dx auf [a; b] mit n Zufallspunkten und vergleicht mit dem Integral.', example: 'montecarlo(x^2, 0, 3, 2000)' },
  { name: 'montecarlopi', aliases: ['pisimulation'], cat: 'Simulation', syntax: 'montecarlopi(n)', text: 'Schätzt π mit n Zufallspunkten im Einheitsquadrat, mit Bild.', example: 'montecarlopi(2000)' },
  { name: 'gesetzdergroßenzahlen', aliases: ['gesetzdergrossenzahlen', 'relativehäufigkeitsverlauf'], cat: 'Simulation', syntax: 'gesetzdergroßenzahlen(p, n)', text: 'Zeichnet die relative Häufigkeit der Treffer nach 1, 2, …, n Versuchen: sie pendelt sich bei p ein.', example: 'gesetzdergroßenzahlen(0.3, 2000)' },

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
