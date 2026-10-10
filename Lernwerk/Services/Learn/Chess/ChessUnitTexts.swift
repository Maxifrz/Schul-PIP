import Foundation

/// The titles and guides of the eight units, in German as the student reads them.
enum ChessUnitTexts {
    struct Text {
        let title: String
        let summary: String
        let tip: String
    }

    static let all: [Text] = [
        Text(
            title: "Das Brett",
            summary: "Linien, Reihen, Felder und ihre Farben",
            tip: """
            Das Schachbrett hat 64 Felder, acht mal acht, abwechselnd hell und dunkel. Du legst es so hin, dass unten rechts ein helles Feld liegt. Weiß sitzt unten und beginnt, Schwarz sitzt oben.

            Die senkrechten Felderreihen heißen Linien. Sie haben die Buchstaben a bis h, von links nach rechts aus der Sicht von Weiß. Die waagerechten Felderreihen heißen Reihen und sind von unten nach oben von 1 bis 8 nummeriert. Schräge Felderketten heißen Diagonalen.

            Jedes Feld hat einen Namen aus Buchstabe und Zahl: erst die Linie, dann die Reihe. Das Feld auf der e-Linie in der 4. Reihe heißt e4. Die Eckfelder sind a1 (unten links), h1 (unten rechts), a8 (oben links) und h8 (oben rechts).

            Zu den Farben: a1 ist dunkel, danach wechselt die Farbe von Feld zu Feld. Zähle den Buchstaben als Zahl (a = 1, b = 2, …) und addiere die Reihe. Ist die Summe gerade, ist das Feld dunkel, sonst hell. Bei d4 ist es 4 + 4 = 8, also dunkel.
            """
        ),
        Text(
            title: "Die Figuren und ihre Züge",
            summary: "König, Dame, Turm, Läufer und Springer: ziehen und schlagen",
            tip: """
            Jede Seite beginnt mit 16 Steinen: König, Dame, zwei Türme, zwei Läufer, zwei Springer und acht Bauern. Die Figuren stehen auf der 1. Reihe (Weiß) und der 8. Reihe (Schwarz), die Bauern davor. Die Dame steht auf einem Feld ihrer eigenen Farbe: die weiße auf d1, die schwarze auf d8.

            Der Turm zieht gerade, der Läufer schräg, beide so weit sie wollen. Die Dame darf beides, sie zieht wie Turm und Läufer zusammen. Der König zieht nur ein Feld, aber in jede Richtung. Der Springer springt: zwei Felder in eine Richtung und eins quer dazu. Er ist die einzige Figur, die über andere hinwegspringen darf.

            Turm, Läufer und Dame dürfen nicht über Figuren hinwegziehen. Eine eigene Figur versperrt den Weg, und auf ihr Feld darfst du nicht. Eine gegnerische Figur darfst du schlagen: Du stellst deine Figur auf ihr Feld und nimmst die geschlagene vom Brett. Dahinter geht es nicht weiter. Der König darf nie auf ein Feld ziehen, das der Gegner angreift, und nie neben den gegnerischen König.

            In der Schachschreibweise hat jede Figur einen Buchstaben: K König, D Dame, T Turm, L Läufer, S Springer. Sf3 heißt: Der Springer zieht nach f3. Beim Schlagen kommt ein x dazu: Sxe5. Bauern haben keinen Buchstaben, e4 heißt: Ein Bauer zieht nach e4.
            """
        ),
        Text(
            title: "Der Bauer",
            summary: "Schritt, Doppelschritt, Schlagen, en passant und Umwandlung",
            tip: """
            Der Bauer zieht nur vorwärts, nie zurück: Weiße Bauern nach oben, schwarze nach unten. Er zieht ein Feld geradeaus. Steht direkt vor ihm eine Figur, ist er blockiert, auch gegen eine gegnerische Figur kann er geradeaus nicht schlagen.

            Aus seiner Ausgangsstellung darf ein Bauer einmal zwei Felder ziehen, wenn beide Felder frei sind. Das ist der Doppelschritt.

            Geschlagen wird anders, als gezogen wird: Ein Bauer schlägt ein Feld schräg vorwärts. Er greift also die beiden Felder links und rechts vor sich an.

            En passant (französisch für „im Vorbeigehen“): Zieht ein gegnerischer Bauer zwei Felder und landet direkt neben deinem Bauern, darfst du ihn schlagen, als wäre er nur ein Feld gezogen. Dein Bauer zieht dann auf das übersprungene Feld. Das geht nur im allernächsten Zug.

            Erreicht ein Bauer die letzte Reihe, muss er sich umwandeln (Bauernumwandlung): in Dame, Turm, Läufer oder Springer, meistens in eine Dame. Er wird nie zum König und bleibt nie ein Bauer.
            """
        ),
        Text(
            title: "Schach und Matt",
            summary: "Schach, Schach aufheben, Matt, Patt und Remis",
            tip: """
            Greift eine gegnerische Figur den König an, steht er im Schach. Du musst das Schach sofort aufheben. Dafür gibt es drei Wege: den König auf ein sicheres Feld ziehen, die Figur schlagen, die Schach gibt, oder eine Figur dazwischenstellen (das geht nicht gegen Springer und Bauern). Ein Zug, nach dem dein eigener König im Schach stünde, ist verboten.

            Gibt es keinen Ausweg, ist es Matt (Schachmatt), und die Partie ist zu Ende: Wer den Gegner mattsetzt, hat gewonnen. Der König wird nie wirklich geschlagen.

            Patt ist etwas ganz anderes: Der Spieler am Zug steht nicht im Schach, hat aber keinen erlaubten Zug. Die Partie endet unentschieden (Remis). Pass auf, wenn du weit vorn liegst: Wer den Gegner einsperrt, ohne Schach zu geben, verschenkt den Sieg.

            Remis gibt es außerdem sofort bei zu wenig Material, zum Beispiel König gegen König oder König und ein Läufer oder Springer gegen König. Auf Antrag ist die Partie auch remis nach dreimaliger Wiederholung derselben Stellung und nach 50 Zügen ohne Bauernzug und ohne Schlagen. Natürlich auch, wenn sich beide Spieler einigen.
            """
        ),
        Text(
            title: "Sonderzüge",
            summary: "Rochade, en passant und Umwandlung genau genommen",
            tip: """
            Die Rochade ist der einzige Zug, bei dem zwei Figuren ziehen. Der König geht zwei Felder auf einen Turm zu, und der Turm springt auf die andere Seite des Königs. Kurze Rochade (O-O): König nach g1, Turm von h1 nach f1 (Schwarz: g8 und f8). Lange Rochade (O-O-O): König nach c1, Turm von a1 nach d1 (Schwarz: c8 und d8). Du führst den Zug mit dem König aus.

            Die Rochade geht nur, wenn der König und dieser Turm sich noch nie bewegt haben, wenn zwischen beiden keine Figur steht, wenn der König nicht im Schach steht und wenn er weder über ein angegriffenes Feld zieht noch auf einem landet. Dass der Turm angegriffen wird oder (bei der langen Rochade) das Feld b1 angegriffen ist, stört nicht.

            En passant gilt nur im Zug direkt nach dem Doppelschritt. Auch dabei darf dein König nicht ins Schach geraten: Ein Schlag en passant, der deinen eigenen König ins Schach stellen würde, ist verboten.

            Bei der Umwandlung wählst du Dame, Turm, Läufer oder Springer, ganz gleich, welche Figuren schon geschlagen wurden. Meistens ist die Dame die beste Wahl; manchmal ist eine andere besser, zum Beispiel um ein Patt zu vermeiden.
            """
        ),
        Text(
            title: "Werte und Tausch",
            summary: "Figurenwerte, Material zählen und gute Tauschgeschäfte",
            tip: """
            Damit du Gewinn und Verlust vergleichen kannst, hat jede Figur einen Richtwert in Punkten: Bauer 1, Springer 3, Läufer 3, Turm 5, Dame 9. Der König hat keinen Wert, denn er darf nie verloren gehen. Die Werte sind Faustregeln, aber sie helfen dir sehr.

            Zähle das Material, indem du die Werte jeder Seite addierst. Wer mehr hat, steht materiell besser. Tauschst du einen Springer (3) gegen einen Turm (5), gewinnst du 2 Punkte. Gibst du eine Dame (9) für einen Bauern (1) her, verlierst du 8.

            Bevor du schlägst, schau, ob die Figur gedeckt ist, also ob der Gegner zurückschlagen kann. Schlägst du eine gedeckte Figur, bekommst du ihren Wert und gibst den Wert deiner schlagenden Figur her. Das lohnt sich nur, wenn die geschlagene Figur mehr wert ist als deine.

            Greifen mehrere Figuren dasselbe Feld an, schlagen beide Seiten der Reihe nach. Zähle die Schläge durch und höre auf, sobald sich das Weiterschlagen nicht mehr lohnt.
            """
        ),
        Text(
            title: "Matt in einem Zug",
            summary: "Grundreihenmatt, Erstickungsmatt, Schäfermatt, Leitermatt und Matt mit Dame oder Turm",
            tip: """
            Ein Mattzug gibt Schach, und danach gibt es keinen Ausweg: kein freies Feld für den König, die Figur lässt sich nicht schlagen, und nichts kann dazwischengestellt werden. Prüfe diese drei Fragen bei jedem Schach.

            Beim Grundreihenmatt steht der König hinter seinen eigenen Bauern auf der Grundreihe, und ein Turm oder eine Dame setzt dort matt. Beim Erstickungsmatt setzt ein Springer matt, weil eigene Figuren dem König alle Felder nehmen. Beim Schäfermatt zielen Dame und Läufer auf den Bauern f7 (bei Schwarz f2), und Dxf7 ist Matt. Das Narrenmatt ist das schnellste mögliche Matt: 1. f3 e5 2. g4 Dh4. Beim Leitermatt gehen zwei Türme Reihe um Reihe vor. Mit Dame oder Turm und König wird am Brettrand matt gesetzt.

            In der Schachschreibweise tragen Mattzüge ein Doppelkreuz, Schachs ein Plus: Ta8# ist Matt, Ta8+ nur Schach.

            Gesucht sind immer alle Züge, die sofort matt setzen. Manchmal gibt es mehr als einen.
            """
        ),
        Text(
            title: "Taktik-Grundlagen",
            summary: "Hängende Figuren, Gabel, Fesselung, Spieß und Abzugsangriff",
            tip: """
            Taktik heißt: Du findest einen Zug, gegen den der Gegner nicht alles retten kann. Dafür suchst du Figuren, die ungedeckt oder wertvoller als dein Angreifer sind.

            Eine hängende Figur ist angegriffen und nicht gedeckt: Du kannst sie ohne Verlust schlagen. Prüfe vor jedem Zug auch, ob eine deiner Figuren hängt.

            Gabel: Eine Figur greift zwei Figuren gleichzeitig an, oft ein Springer oder ein Bauer. Der Gegner kann nur eine retten. Fesselung: Eine Figur darf nicht ziehen, weil dahinter eine wertvollere steht. Steht dahinter der König, ist der Zug sogar verboten. Greife eine gefesselte Figur zusätzlich an. Spieß: Du greifst eine wertvolle Figur an, sie muss weichen, und dahinter wird eine andere Figur auf derselben Linie frei. Abzugsangriff: Eine Figur zieht weg und gibt der Figur dahinter eine Linie frei. Gibt dabei die freigegebene Figur Schach (Abzugsschach), hat der Gegner keine Zeit, die Figur zu retten, die gerade gezogen hat.

            In den Aufgaben ist ein Zug richtig, wenn er nachgerechnet am meisten Material bringt.
            """
        ),
    ]
}
