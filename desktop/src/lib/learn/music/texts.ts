/** The titles, summaries and guides of the eight units. */
export interface MusicUnitText {
  title: string;
  summary: string;
  tip: string;
}

export const musicUnitTexts: MusicUnitText[] = [
  {
    title: "Notenlinien und Violinschlüssel",
    summary: "Die Noten C bis H im Violinschlüssel lesen",
    tip: "Noten stehen auf einem Notensystem: fünf Linien mit vier Zwischenräumen. Man zählt von unten nach oben. Je höher eine Note steht, desto höher klingt sie.\n\nAm Anfang steht der Violinschlüssel. Er heißt auch G-Schlüssel, weil sich seine Schnecke um die 2. Linie legt: Dort liegt das G.\n\nDie Notennamen folgen dem Alphabet: C D E F G A H, danach beginnt es wieder bei C. Von Linie zu Zwischenraum zu Linie geht es immer einen Buchstaben weiter. Die Linien heißen von unten E G H D F, die Zwischenräume F A C E.\n\nFür Töne außerhalb des Systems gibt es kurze Hilfslinien. Das eingestrichene C liegt auf einer Hilfslinie unter dem System.",
  },
  {
    title: "Bassschlüssel und Klaviatur",
    summary: "Tiefe Noten lesen und Töne auf dem Klavier finden",
    tip: "Der Bassschlüssel heißt auch F-Schlüssel: Seine zwei Punkte umfassen die 4. Linie, auf der das F liegt. Er steht für tiefe Töne.\n\nDie Linien heißen von unten G H D F A, die Zwischenräume A C E G. Dieselbe Stelle hat im Bassschlüssel also einen anderen Namen als im Violinschlüssel: Die unterste Linie ist im Violinschlüssel E, im Bassschlüssel G.\n\nDas eingestrichene C liegt in beiden Systemen auf einer Hilfslinie: im Violinschlüssel darunter, im Bassschlüssel darüber. Auf der Klaviatur ist es das C ungefähr in der Mitte.\n\nAuf dem Klavier wechseln sich Gruppen aus zwei und aus drei schwarzen Tasten ab. Das C liegt links neben den zwei schwarzen Tasten, das F links neben den drei. Die Oktaven heißen: große Oktave (C), kleine Oktave (c) und eingestrichene Oktave (c¹).",
  },
  {
    title: "Notenwerte und Pausen",
    summary: "Wie lange ein Ton dauert und wie man Schläge zählt",
    tip: "Notenwerte sagen, wie lange ein Ton dauert. Eine Ganze Note dauert vier Schläge, eine Halbe Note zwei und eine Viertelnote einen Schlag. Jeder Wert ist halb so lang wie der vorige: Eine Achtelnote dauert einen halben Schlag, eine Sechzehntelnote einen Viertelschlag.\n\nZu jedem Notenwert gibt es eine Pause gleicher Länge: Ganze Pause, Halbe Pause, Viertelpause, Achtelpause und Sechzehntelpause. In der Pause klingt nichts, aber sie zählt mit.\n\nDie Musik ist in Takte eingeteilt, getrennt durch Taktstriche. Die Taktangabe am Anfang sagt, wie viele Schläge ein Takt hat (obere Zahl) und welcher Notenwert einen Schlag bekommt (untere Zahl). Im 4/4-Takt passen vier Viertel in einen Takt, im 3/4-Takt drei Viertel.",
  },
  {
    title: "Vorzeichen",
    summary: "Kreuz, Be und Auflösungszeichen, Halbton und Ganzton",
    tip: "Der Halbton ist der kleinste Schritt auf dem Klavier: von einer Taste zur nächsten, auch zu einer schwarzen. Ein Ganzton sind zwei Halbtöne. Bei den weißen Tasten liegen nur zwischen E und F und zwischen H und C Halbtöne.\n\nVorzeichen verändern einen Ton: Das Kreuz (♯) erhöht um einen Halbton, das Be (♭) erniedrigt um einen Halbton, das Auflösungszeichen (♮) hebt beides wieder auf.\n\nIn den Namen zeigt sich das so: Erhöhte Töne bekommen die Endung -is (C wird Cis), erniedrigte die Endung -es (D wird Des). Besonders sind Es (E mit Be), As (A mit Be) und B (H mit Be).\n\nEine schwarze Taste hat zwei Namen: Cis und Des sind dieselbe Taste. Man nennt das enharmonische Verwechslung.",
  },
  {
    title: "Tonleitern",
    summary: "Dur aus Ganz- und Halbtonschritten bauen, natürliches Moll",
    tip: "Eine Tonleiter ordnet acht Töne vom Grundton bis zu seiner Oktave. Die Durtonleiter hat immer dasselbe Muster: ganz, ganz, halb, ganz, ganz, ganz, halb. Die Halbtonschritte liegen zwischen der 3. und 4. und zwischen der 7. und 8. Stufe.\n\nC-Dur braucht nur weiße Tasten: C D E F G A H C. Beginnt man auf G, muss man das F zu Fis erhöhen, damit der Halbton vor dem Grundton stimmt: G A H C D E Fis G. F-Dur hat ein B statt H. D-Dur hat Fis und Cis, B-Dur hat B und Es.\n\nJeder Buchstabe kommt in einer Tonleiter genau einmal vor. Darum heißt der vierte Ton in F-Dur B und nicht Ais.\n\nDie natürliche Molltonleiter hat das Muster ganz, halb, ganz, ganz, halb, ganz, ganz. Ihre Halbtonschritte liegen zwischen der 2. und 3. und zwischen der 5. und 6. Stufe. A-Moll: A H C D E F G A. E-Moll hat ein Fis, D-Moll ein B.",
  },
  {
    title: "Intervalle",
    summary: "Abstände zählen, benennen, bauen und hören",
    tip: "Ein Intervall ist der Abstand zwischen zwei Tönen. Man zählt beide Töne mit: C bis E ist eine Terz (C D E sind drei Töne). Die Namen: Prim (1), Sekunde (2), Terz (3), Quarte (4), Quinte (5), Sexte (6), Septime (7) und Oktave (8).\n\nDer genaue Name hängt von den Halbtönen ab. Prim, Quarte, Quinte und Oktave sind rein (0, 5, 7 und 12 Halbtöne). Sekunde, Terz, Sexte und Septime gibt es klein und groß: kleine Sekunde 1, große Sekunde 2, kleine Terz 3, große Terz 4, kleine Sexte 8, große Sexte 9, kleine Septime 10 und große Septime 11 Halbtöne.\n\nBeim Bauen zählt man erst die Buchstaben und passt dann das Vorzeichen an: Die große Terz über D ist Fis (D E F, vier Halbtöne). Dreht man ein Intervall um, wird aus einer Terz eine Sexte und aus groß wird klein: große Terz und kleine Sexte ergeben zusammen eine Oktave.\n\nZum Hören: „Alle meine Entchen“ beginnt mit Sekunden aufwärts, „O Tannenbaum“ mit einer Quarte aufwärts. Der Tritonus hat sechs Halbtöne, also drei Ganztöne.",
  },
  {
    title: "Dreiklänge",
    summary: "Dur und Moll bauen und unterscheiden",
    tip: "Ein Dreiklang besteht aus drei Tönen, die in Terzen übereinanderstehen: Grundton, Terz und Quinte. Der Dur-Dreiklang hat unten eine große Terz und darüber eine kleine Terz. C-Dur ist C E G.\n\nDer Moll-Dreiklang hat unten eine kleine Terz und darüber eine große. C-Moll ist C Es G. Von Dur zu Moll wird also nur die Terz einen Halbton tiefer; die Quinte (sieben Halbtöne über dem Grundton) bleibt.\n\nDur klingt hell und fest, Moll dunkler und weicher. Beim Aufschreiben nimmt man jeden zweiten Buchstaben: Der Es-Dur-Dreiklang ist Es, G, B.",
  },
  {
    title: "Tonarten und Quintenzirkel",
    summary: "Vorzeichen lesen, Paralleltonarten finden",
    tip: "Die Vorzeichen am Anfang eines Stücks heißen Vorzeichnung und zeigen die Tonart. Kreuze stehen immer in dieser Reihenfolge: Fis, Cis, Gis, Dis, Ais, Eis, His. Die Be kommen in der umgekehrten Reihenfolge: B, Es, As, Des, Ges, Ces, Fes.\n\nDer Quintenzirkel ordnet die Tonarten: Von C-Dur aus bringt jede Quinte aufwärts ein Kreuz mehr (G-Dur 1, D-Dur 2, A-Dur 3, E-Dur 4), jede Quinte abwärts ein Be mehr (F-Dur 1, B-Dur 2, Es-Dur 3, As-Dur 4).\n\nZu jeder Durtonart gehört eine Paralleltonart in Moll mit denselben Vorzeichen. Ihr Grundton liegt eine kleine Terz tiefer: Zu C-Dur gehört A-Moll, zu G-Dur E-Moll, zu A-Dur Fis-Moll und zu F-Dur D-Moll.",
  },
];
