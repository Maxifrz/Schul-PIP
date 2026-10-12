import Foundation

/// Deutsch as a school subject for native speakers (Sekundarstufe I and the start of the Oberstufe): spelling,
/// punctuation, grammar and style, in the language engine's text format (see LanguageDSL). Terms, fills, facts and
/// forms only: there are no translations and no sentences to assemble. The text is the content; a teacher can read and
/// correct it without reading code. The course contains no backslash, no triple quote and no interpolation, because
/// Swift would read them.
enum GermanSchoolCourse {
    static let source = """
    course: de
    title: Deutsch
    subtitle: Rechtschreibung, Grammatik, Stil
    kind: school
    color: C46A55
    symbol: book.fill
    instruction: de

    section: Rechtschreibung und Zeichensetzung

    unit: das oder dass | Konjunktion, Artikel und Relativpronomen
    tip: Das Wort „das“ mit einem s hat drei Aufgaben. Es ist ein Artikel („das Haus“), ein Relativpronomen („Das Haus, das ich sehe, ist alt.“) oder ein Demonstrativpronomen („Das ist mein Bruder.“). Das Wort „dass“ mit zwei s ist dagegen immer eine Konjunktion und leitet einen Nebensatz ein: „Ich weiß, dass du kommst.“
    tip: Die Ersatzprobe hilft dir bei der Entscheidung: Kannst du „das“ durch „dieses“, „jenes“ oder „welches“ ersetzen, schreibst du „das“. Aus „Das Buch, das ich lese, ist spannend.“ wird „Dieses Buch, welches ich lese, ist spannend.“ Der Satz bleibt richtig, also „das“. Bei „Ich weiß, dass du kommst.“ geht das nicht: „Ich weiß, welches du kommst“ ergibt keinen Sinn, also „dass“.
    tip: „dass“ steht oft nach Verben des Sagens, Denkens und Fühlens wie „sagen“, „glauben“, „wissen“, „hoffen“ und nach Ausdrücken wie „Es ist schön, …“ oder „Ich freue mich, …“. Vor dem dass-Satz steht ein Komma. Steht der dass-Satz am Satzanfang, schreibst du „Dass“ groß, und das Komma folgt nach dem Nebensatz: „Dass du da bist, freut mich.“
    tip: Ein Relativpronomen richtet sich nach seinem Bezugswort: „das Mädchen, das singt“, „der Mann, der singt“, „die Frau, die singt“. Wenn du also nach einem Komma ein Wort suchst, das sich auf ein Nomen davor bezieht, brauchst du „das“, „der“ oder „die“, aber nicht „dass“.

    word: Konjunktion = Bindewort, das Wörter oder Sätze verbindet | Beispiele: und, weil, dass
    word: Artikel = Wortart, die Geschlecht und Fall eines Nomens zeigt | der, die, das, ein, eine
    word: Hauptsatz = selbstständiger Satz, der für sich stehen kann | Das Wetter ist schön.
    word: Nebensatz = unselbstständiger Satz, der von einem Hauptsatz abhängt | ..., dass du kommst.
    word: Relativpronomen = Pronomen, das einen Nebensatz an ein Nomen anschließt | der Hund, der bellt
    word: Bezugswort = Wort, auf das sich ein Relativpronomen bezieht | Im Satz „das Kind, das lacht“ ist es „Kind“.
    word: Ersatzprobe = Probe, bei der man ein Wort durch ein anderes ersetzt | Statt „das“: dieses, jenes oder welches.
    fill: Ich weiß, ___ du kommst. = dass | das ## Nach „wissen“ folgt ein Nebensatz, den die Konjunktion „dass“ einleitet.
    fill: ___ Buch liegt auf dem Tisch. = Das | Dass ## „Das“ ist hier der Artikel von „Buch“ und lässt sich durch „dieses“ ersetzen.
    fill: Das Kind, ___ dort steht, ist mein Bruder. = das | dass ## Das Relativpronomen „das“ bezieht sich auf „Kind“ und lässt sich durch „welches“ ersetzen.
    fill: Er sagt, ___ es regnet. = dass | das ## Nach „sagen“ leitet die Konjunktion „dass“ den Nebensatz ein.
    fill: Das ist das Haus, ___ wir kaufen wollen. = das | dass ## Das Relativpronomen bezieht sich auf „Haus“ und lässt sich durch „welches“ ersetzen.
    fill: Ich hoffe, ___ wir gewinnen. = dass | das ## Nach „hoffen“ steht die Konjunktion „dass“.
    fill: ___ er schon da ist, freut mich. = Dass | Das ## Der Nebensatz am Satzanfang wird von der Konjunktion „dass“ eingeleitet.
    fill: Sie hat das Fahrrad, ___ ich mir wünsche. = das | dass ## „Das“ bezieht sich auf „Fahrrad“ und lässt sich durch „welches“ ersetzen.
    fill: Es ist schön, ___ du da bist. = dass | das ## Nach „Es ist schön“ folgt ein Nebensatz mit der Konjunktion „dass“.
    fill: Wir wissen, ___ ihr Hilfe braucht. = dass | das ## Die Konjunktion „dass“ leitet den Nebensatz nach „wissen“ ein.
    fact: Wann schreibt man „dass“ mit zwei s? = Wenn es als Konjunktion einen Nebensatz einleitet | Wenn es der Artikel eines Nomens ist | Wenn es sich auf ein Bezugswort bezieht ## Nur die Konjunktion „dass“ wird mit zwei s geschrieben.
    fact: Welche Probe hilft bei „das“ oder „dass“? = Die Ersatzprobe mit „dieses“ oder „welches“ | Die Umstellprobe mit dem Verb | Die Verlängerungsprobe mit dem Plural ## Lässt sich „das“ durch „dieses“ oder „welches“ ersetzen, schreibt man es mit einem s.
    fact: Kann man das zweite „das“ in „Das Buch, das ich lese, ist spannend“ durch „welches“ ersetzen? = Ja, es ist ein Relativpronomen | Nein, es ist eine Konjunktion | Nein, es ist ein Verb ## Das Relativpronomen bezieht sich auf „Buch“ und wird mit einem s geschrieben.
    fact: Wo steht in „Ich glaube dass es stimmt“ das Komma? = Vor „dass“ | Nach „dass“ | Nach „es“ ## Ein dass-Satz wird durch ein Komma vom Hauptsatz getrennt.
    fact: Welche Wortart ist „dass“? = Konjunktion | Artikel | Relativpronomen ## „dass“ verbindet Hauptsatz und Nebensatz und ist darum eine Konjunktion.
    fact: Welches Relativpronomen passt: „Der Mann, ___ dort steht, ist Arzt“? = der | die | das ## Das Relativpronomen richtet sich nach dem Geschlecht seines Bezugsworts „Mann“.
    form: Relativpronomen im Nominativ, das Mädchen = das ## Das Bezugswort „Mädchen“ ist sächlich, also heißt das Relativpronomen „das“.
    form: Relativpronomen im Nominativ, der Mann = der ## Das Bezugswort „Mann“ ist männlich, also heißt das Relativpronomen „der“.
    form: Relativpronomen im Nominativ, die Frau = die ## Das Bezugswort „Frau“ ist weiblich, also heißt das Relativpronomen „die“.

    unit: Groß- und Kleinschreibung | Nomen, Nominalisierungen und Eigennamen
    tip: Nomen, Eigennamen und das erste Wort eines Satzes schreibt man groß. Ob ein Wort ein Nomen ist, zeigt die Artikelprobe: Passt ein Artikel davor, schreibst du das Wort groß, auch wenn der Artikel nur zu denken ist. „der Hund“, „das Glück“, „die Freude“.
    tip: Wörter anderer Wortarten werden zu Nomen, wenn sie nominalisiert sind. Das erkennst du an Signalwörtern: Artikel („das Lesen“), Präposition mit Artikel („beim Schwimmen“, „zum Lachen“), Adjektive („schnelles Rechnen“) und Mengenwörter wie „etwas“, „nichts“, „viel“, „wenig“, „alles“ („etwas Neues“, „nichts Gutes“).
    tip: Viele Nomen erkennst du an ihren Nachsilben: -heit, -keit, -ung, -nis, -schaft und -tum. „Freiheit“, „Höflichkeit“, „Erlebnis“, „Freundschaft“ schreibt man immer groß. Die Wörter vor der Nachsilbe können Adjektive oder Verben sein: aus „frei“ wird „Freiheit“, aus „erleben“ wird „Erlebnis“.
    tip: Zeitangaben: Nach „heute“, „gestern“ und „morgen“ schreibt man Tageszeiten groß („heute Abend“, „gestern Morgen“). Adverbien auf -s bleiben klein („abends“, „montags“), ebenso „morgen früh“. Die höfliche Anrede „Sie“ mit „Ihnen“ und „Ihr“ schreibt man immer groß.

    word: Nominalisierung = Wort einer anderen Wortart, das als Nomen gebraucht wird | beim Lesen, das Gute
    word: Eigenname = Name einer bestimmten Person, eines Ortes oder einer Sache | Anna, Hamburg, Rhein
    word: Artikelprobe = Probe, ob sich ein Artikel vor das Wort setzen lässt | das Glück, aber nicht „das schnell“
    word: Signalwort = Wort, das ein folgendes Nomen ankündigt | Artikel, „beim“, „etwas“
    word: Anredepronomen = Fürwort, mit dem man jemanden anspricht | du, ihr und die höfliche Form Sie
    word: Abstraktum = Nomen für etwas, das man nicht anfassen kann | Freiheit, Mut, Hoffnung
    word: Konkretum = Nomen für etwas Gegenständliches | Tisch, Hund, Apfel
    word: Nachsilbe = Wortbaustein am Wortende | -heit, -keit, -ung, -nis, -schaft
    fill: Die Freund___ hält ein Leben lang. = schaft | heit | keit | ung ## Die Nachsilbe -schaft macht aus „Freund“ das Nomen „Freundschaft“.
    fill: Die Krank___ dauerte lange. = heit | keit | nis | schaft ## Aus dem Adjektiv „krank“ wird mit -heit das Nomen „Krankheit“.
    fill: Die Höflich___ ist wichtig. = keit | heit | nis | schaft ## Adjektive auf -lich bilden Nomen mit -keit: „Höflichkeit“.
    fill: Das Gedächt___ wird besser. = nis | heit | keit | schaft ## Die Nachsilbe -nis bildet das Nomen „Gedächtnis“.
    fill: Wir haben viel Verständ___ für dich. = nis | heit | keit | schaft ## Die Nachsilbe -nis bildet das Nomen „Verständnis“.
    fill: Die Heiter___ der Kinder steckt an. = keit | heit | nis | schaft ## Adjektive auf -er bilden Nomen mit -keit: „Heiterkeit“.
    fact: Welche Wörter schreibt man im Satz immer groß? = Nomen, Eigennamen und das erste Wort eines Satzes | Nur Eigennamen und Satzanfänge | Nur Nomen ## Nomen, Eigennamen und Satzanfänge werden großgeschrieben.
    fact: Wie wird „Schwimmen“ in „Wir gehen zum Schwimmen“ geschrieben? = Groß, weil es nach „zum“ nominalisiert ist | Klein, weil es ein Verb ist | Klein, weil es hinter einer Präposition steht ## Nach „zum“ steht ein nominalisiertes Verb, das man großschreibt.
    fact: Wie schreibt man „Abend“ in „heute Abend“? = Groß, weil es ein Nomen ist | Klein, weil es ein Adverb ist | Klein, weil „heute“ davorsteht ## Tageszeiten nach „heute“, „gestern“ und „morgen“ sind Nomen und werden großgeschrieben.
    fact: Wie schreibt man „abends“ in „Wir lesen abends“? = Klein, weil es ein Adverb auf -s ist | Groß, weil es eine Tageszeit ist | Groß, weil es nach einem Verb steht ## Adverbien auf -s wie „abends“ und „montags“ schreibt man klein.
    fact: Wie schreibt man die höfliche Anrede „Sie“ mit „Ihnen“ und „Ihr“? = Immer groß | Immer klein | Nur am Satzanfang groß ## Die höfliche Anrede wird immer großgeschrieben, damit man sie vom Pronomen „sie“ unterscheidet.
    fact: Wie schreibt man „neues“ in „Ich habe etwas neues gelernt“ richtig? = Groß, weil es nach „etwas“ nominalisiert ist | Klein, weil es ein Adjektiv ist | Klein, weil es nach einem Verb steht ## Nach Mengenwörtern wie „etwas“ und „nichts“ werden Adjektive großgeschrieben.
    fact: Wie schreibt man „Hamburger“ in „der Hamburger Hafen“? = Groß, denn Ableitungen von Ortsnamen auf -er sind Eigennamen | Klein, weil es ein Adjektiv ist | Klein, weil es nach einem Artikel steht ## Ableitungen von Ortsnamen auf -er werden großgeschrieben.
    fact: Wie schreibt man „früh“ in „morgen früh“? = Klein, weil es ein Adverb ist | Groß, weil es eine Tageszeit ist | Groß, weil „morgen“ davorsteht ## „früh“ ist ein Adverb und wird kleingeschrieben.
    form: frei, Nomen auf -heit = Freiheit ## Aus dem Adjektiv „frei“ wird mit -heit das Nomen „Freiheit“.
    form: gesund, Nomen auf -heit = Gesundheit ## Aus dem Adjektiv „gesund“ wird mit -heit das Nomen „Gesundheit“.
    form: freundlich, Nomen auf -keit = Freundlichkeit ## Adjektive auf -lich bilden Nomen mit -keit.
    form: erleben, Nomen auf -nis = Erlebnis ## Vom Verbstamm „erleb“ wird mit -nis das Nomen „Erlebnis“ gebildet.

    unit: s, ss und ß | Kurze und lange Vokale vor dem s-Laut
    tip: Der stimmlose s-Laut wird auf drei Weisen geschrieben. Nach einem kurzen Vokal steht ss: „Wasser“, „Fluss“, „wissen“, „müssen“. Nach einem langen Vokal oder einem Doppellaut wie au, ei, eu steht ß: „Fuß“, „Straße“, „heißen“, „draußen“. Ein einfaches s steht, wenn der Laut weich (stimmhaft) gesprochen wird oder wenn das Wort sich verlängern lässt: „Rose“, „lesen“, „das Haus“.
    tip: Die Verlängerungsprobe zeigt dir das einfache s am Wortende. „Das Haus“ wird zu „die Häuser“ mit weichem s, also schreibst du ein s. „Das Gras“ wird zu „die Gräser“, „er liest“ zu „lesen“. Bei „der Fluss“ lautet die Verlängerung „die Flüsse“ mit stimmlosem Laut und kurzem Vokal, also ss.
    tip: Bei verwandten Wörtern ändert sich manchmal die Schreibung, weil sich der Vokal ändert: „essen – ich aß – gegessen“, „fließen – es floss – geflossen“, „lesen – ich las“. Das Wort „isst“ (von essen) und das Wort „ist“ (von sein) sind verschieden und werden oft verwechselt.
    tip: Die Konjunktion „dass“ schreibt man immer mit ss, auch wenn der Vokal kurz klingt. Das Wort „muss“ hat ein kurzes u und deshalb ss; „Gruß“ hat ein langes u und deshalb ß.

    word: Langvokal = Vokal, den man gedehnt spricht | Fuß, Straße
    word: Kurzvokal = Vokal, den man kurz spricht | Wasser, Fluss
    word: Diphthong = Doppellaut aus zwei Vokalen in einer Silbe | au, ei, eu
    word: stimmhaft = mit Stimmton gesprochen | das weiche s in Rose
    word: stimmlos = ohne Stimmton gesprochen | das scharfe s in Fluss und Fuß
    word: Verlängerungsprobe = Probe, bei der man das Wort in eine längere Form bringt | Haus, Häuser
    word: Wortstamm = Kern eines Wortes ohne Vor- und Nachsilben | les- in „lesen“, „Leser“
    fill: Er ___ jeden Morgen Müsli. = isst | ist ## „isst“ gehört zu „essen“, „ist“ gehört zu „sein“.
    fill: Das Wetter ___ heute schön. = ist | isst ## „ist“ gehört zu „sein“, „isst“ gehört zu „essen“.
    fill: Ich ___ die Antwort. = weiß | wies ## „weiß“ gehört zu „wissen“, „wies“ ist eine Form von „weisen“.
    fill: Sie ___ die Tür offen. = ließ | lies ## „ließ“ gehört zu „lassen“, „lies“ ist die Befehlsform von „lesen“.
    fill: ___ doch bitte den Text! = Lies | Ließ ## „Lies“ ist die Befehlsform von „lesen“.
    fill: Das Wa___er ist kalt. = ss | s ## Nach dem kurzen Vokal a steht ss.
    fill: Die Ro___e hat Dornen. = s | ss ## Das s in „Rose“ ist stimmhaft und wird einfach geschrieben.
    fill: Wir schwimmen im ___. = Fluss | Fuß ## „Fluss“ hat einen kurzen Vokal und deshalb ss, „Fuß“ einen langen Vokal und deshalb ß.
    fact: Welches Wort wird mit ß geschrieben? = Fuß | Fluss | Wasser ## „Fuß“ hat einen langen Vokal, danach steht ß.
    fact: Welches Wort wird mit ss geschrieben? = Fluss | Gruß | Straße ## „Fluss“ hat einen kurzen Vokal, danach steht ss.
    fact: Wann schreibt man ß? = Nach langem Vokal oder Doppellaut bei stimmlosem s-Laut | Nach kurzem Vokal | Am Wortanfang ## Nach langem Vokal und nach Doppellauten steht ß, nach kurzem Vokal ss.
    fact: Welches Wort wird mit ß geschrieben? = heißen | wissen | müssen ## Nach dem Doppellaut ei steht ß.
    fact: Welches Wort schreibt man mit einfachem s? = Rose | Rasse | Gasse ## In „Rose“ ist das s stimmhaft und wird einfach geschrieben.
    fact: Warum schreibt man „das Haus“ mit einem s? = Die Verlängerung „Häuser“ hat ein weiches s | Der Vokal ist kurz | „Haus“ ist ein Verb ## Die Verlängerungsprobe zeigt das weiche s in „Häuser“.
    fact: Wie spricht man das s in „Rose“? = Stimmhaft | Stimmlos ## Das s in „Rose“ ist stimmhaft und wird einfach geschrieben.
    form: essen, Präteritum ich = aß ## Nach dem langen Vokal a steht ß.
    form: lesen, Präteritum ich = las ## Der Vokal ist lang und das s ist weich (wie in „lasen“), also schreibt man ein einfaches s.
    form: wissen, Präsens ich = weiß ## Nach dem Doppellaut ei steht ß.
    form: fließen, Präteritum es = floss ## Im Präteritum ist der Vokal kurz, deshalb ss.

    unit: Lange und kurze Vokale | Doppelkonsonant, ie und Dehnungs-h
    tip: Ein kurzer Vokal wird oft durch einen Doppelkonsonanten gekennzeichnet: „Mitte“, „Bett“, „Stall“, „kommen“. Ein langer Vokal hat verschiedene Zeichen: das ie für langes i („Liebe“, „Wiese“), das Dehnungs-h („Zahl“, „Uhr“, „Lehrer“) und den Doppelvokal („Boot“, „Meer“, „Saal“). Viele Wörter haben auch gar kein Zeichen: „Tal“, „Wal“.
    tip: Das Dehnungs-h steht besonders oft vor l, m, n und r, aber nicht nach Doppelvokalen. Ob ein Wort ein Dehnungs-h hat, kannst du oft an verwandten Wörtern hören: „fahren – Fahrt“, „Zahl – zählen“.
    tip: Das Stammprinzip hilft bei ä und äu: Verwandte Wörter behalten ihre Schreibung. „Bäume“ schreibt man mit ä, weil „Baum“ mit a geschrieben wird. „Häuser“ kommt von „Haus“, „Hände“ von „Hand“, „Zähne“ von „Zahn“. Wenn es kein verwandtes Wort gibt, musst du dir die Schreibung merken, zum Beispiel „Bär“ oder „Käfer“.
    tip: Manche Wörter klingen gleich und werden doch verschieden geschrieben. Solche Homophone sind „Meer“ und „mehr“, „Stahl“ und „Stall“, „Wahl“ und „Wal“, „Bett“ und „Beet“. Hier entscheidet die Bedeutung im Satz.

    word: Doppelkonsonant = zwei gleiche Konsonanten nach einem kurzen Vokal | Mitte, Bett, kommen
    word: Dehnungs-h = stummes h, das einen langen Vokal anzeigt | Zahl, Uhr, Lehrer
    word: Doppelvokal = zwei gleiche Vokale, die einen langen Vokal anzeigen | Boot, Meer, Saal
    word: Dehnungszeichen = Zeichen in der Schrift, das einen langen Vokal anzeigt | ie, Dehnungs-h, Doppelvokal
    word: Stammprinzip = Regel, dass verwandte Wörter ihre Schreibung behalten | Bäume wegen Baum
    word: Merkwort = Wort, dessen Schreibung man sich einprägen muss | Vase, Bär
    word: Homophon = Wort, das gleich klingt wie ein anderes, aber anders geschrieben wird | Meer und mehr
    word: Umlaut = verändertes a, o oder u mit zwei Punkten | ä, ö, ü
    fill: Im Urlaub schwimme ich im ___. = Meer | mehr ## „Meer“ mit Doppelvokal ist das Gewässer, „mehr“ mit h bedeutet eine größere Menge.
    fill: Ich möchte noch ___ Suppe. = mehr | Meer ## „mehr“ mit h bedeutet eine größere Menge.
    fill: Sie macht eine ___ als Bäckerin. = Lehre | Leere ## „Lehre“ mit Dehnungs-h ist die Ausbildung, „Leere“ mit Doppelvokal ist das Leersein.
    fill: Wir wohnen zur ___. = Miete | Mitte ## „Miete“ mit ie ist das Entgelt fürs Wohnen, „Mitte“ mit tt ist die Mitte.
    fill: Das Haus steht in der ___ der Stadt. = Mitte | Miete ## „Mitte“ hat ein kurzes i und einen Doppelkonsonanten.
    fill: Das Pferd frisst im ___. = Stall | Stahl ## „Stall“ mit ll ist das Gebäude für Tiere, „Stahl“ mit Dehnungs-h ist ein Metall.
    fill: Das Schwert ist aus ___. = Stahl | Stall ## „Stahl“ mit Dehnungs-h ist ein Metall.
    fill: Ich schlafe im ___. = Bett | Beet ## „Bett“ mit tt hat einen kurzen Vokal.
    fill: Im Garten ist ein ___ mit Blumen. = Beet | Bett ## „Beet“ mit Doppelvokal ist das Blumenbeet.
    fact: Wie spricht man den Vokal vor einem Doppelkonsonanten, zum Beispiel in „Mitte“? = Kurz | Lang | Gar nicht ## Vor einem Doppelkonsonanten spricht man den Vokal kurz.
    fact: Welches Wort hat ein Dehnungs-h? = Wahl | Saal | Tal ## „Wahl“ hat ein stummes h nach dem langen a.
    fact: Welches Wort hat ein langes i, das mit ie geschrieben wird? = Liebe | Mitte | Kind ## „Liebe“ hat ein langes i, das als ie geschrieben wird.
    fact: Welches Wort hat einen Doppelvokal? = Boot | Bahn | Boden ## „Boot“ schreibt man mit zwei o.
    fact: Warum schreibt man „Bäume“ mit ä? = Das verwandte Wort „Baum“ hat ein a | Der Vokal ist lang | Es ist ein Plural ## Nach dem Stammprinzip leitet man ä von verwandten Wörtern mit a ab.
    fact: Vor welchen Buchstaben steht das Dehnungs-h besonders oft? = Vor l, m, n und r | Vor b, d und g | Vor s, t und z ## Das Dehnungs-h steht vor allem vor l, m, n und r, wie in „Zahl“, „Lehm“, „Sohn“ und „Uhr“.
    form: der Baum, Plural = die Bäume ## Der Plural von „Baum“ hat einen Umlaut, den man vom Stamm „Baum“ ableitet.
    form: der Zahn, Plural = die Zähne ## Der Plural von „Zahn“ hat einen Umlaut.
    form: die Hand, Plural = die Hände ## Der Plural von „Hand“ hat einen Umlaut.
    form: der Hals, Plural = die Hälse ## Der Plural von „Hals“ hat einen Umlaut.

    unit: Kommasetzung | Aufzählung, Nebensatz, Infinitivgruppe und wörtliche Rede
    tip: In einer Aufzählung trennt das Komma gleichrangige Wörter oder Satzteile: „Ich kaufe Äpfel, Birnen und Bananen.“ Vor „und“, „oder“, „sowie“ und „sowohl … als auch“ steht in der Aufzählung kein Komma, wohl aber vor „aber“, „sondern“ und „doch“.
    tip: Nebensätze werden immer durch Kommas vom Hauptsatz getrennt: „Ich bleibe zu Hause, weil ich krank bin.“ Steht der Nebensatz mittendrin, bekommt er zwei Kommas: „Das Kind, das singt, ist mein Bruder.“ Nebensätze erkennt man oft an einer einleitenden Konjunktion wie „weil“, „dass“, „ob“, „obwohl“, „damit“, „während“ und an dem Verb am Ende.
    tip: Bei Infinitivgruppen ist das Komma meistens freiwillig. Es muss stehen, wenn die Gruppe mit „um“, „ohne“, „statt“, „anstatt“, „außer“ oder „als“ beginnt („Er spart, um zu reisen.“), wenn sie von einem Nomen abhängt („Ich habe keine Lust, früh aufzustehen.“) oder wenn auf sie ein Hinweiswort wie „es“ oder „darauf“ hindeutet („Ich freue mich darauf, dich zu sehen.“).
    tip: Bei der wörtlichen Rede steht vor dem Redesatz ein Doppelpunkt, wenn der Begleitsatz vorangeht: Anna fragte: „Kommst du mit?“ Steht der Begleitsatz danach, endet der Redesatz ohne Punkt, und nach den Anführungszeichen folgt ein Komma: „Ich komme gleich“, sagte Max. Fragezeichen und Ausrufezeichen bleiben stehen: „Kommst du?“, fragte Max.

    word: Aufzählung = Reihung gleichrangiger Wörter oder Satzteile | Äpfel, Birnen und Bananen
    word: Satzreihe = Verbindung von zwei oder mehr Hauptsätzen | Ich lese, du schreibst.
    word: Satzgefüge = Verbindung aus Hauptsatz und Nebensatz | Ich lese, weil es regnet.
    word: Infinitivgruppe = Wortgruppe mit „zu“ und Infinitiv | Es ist schön, dich zu sehen.
    word: wörtliche Rede = genau wiedergegebene Äußerung in Anführungszeichen | Er sagte: „Ich komme.“
    word: Redebegleitsatz = Satz, der angibt, wer etwas sagt | sagte Max
    word: Apposition = nachgestellte Erläuterung zu einem Nomen | Berlin, die Hauptstadt, ist groß.
    word: Anrede = Ansprache einer Person im Satz | Komm, Anna, wir gehen.
    fill: Ich bleibe zu Hause, ___ ich krank bin. = weil | obwohl ## „weil“ gibt den Grund an und leitet einen Nebensatz ein, der durch ein Komma getrennt wird.
    fill: Er lernt viel, ___ er die Prüfung besteht. = damit | obwohl ## „damit“ gibt den Zweck an, nach „obwohl“ wäre der Satz widersprüchlich.
    fill: ___ es regnet, gehen wir spazieren. = Obwohl | Weil ## „Obwohl“ drückt einen Gegensatz aus, und der Nebensatz am Satzanfang wird durch ein Komma beendet.
    fill: Sie fragt, ___ ich mitkomme. = ob | weil ## „ob“ leitet eine indirekte Frage ein.
    fill: ___ ich frühstücke, lese ich die Zeitung. = Während | Damit ## „Während“ drückt Gleichzeitigkeit aus.
    fill: Wir essen, ___ wir ins Kino gehen. = bevor | obwohl ## „bevor“ drückt aus, dass das Essen zuerst kommt.
    fill: Sie lernt Deutsch, ___ sie in Wien studieren möchte. = weil | obwohl ## „weil“ nennt den Grund für das Lernen.
    fill: Er spart Geld, ___ ein Fahrrad zu kaufen. = um | damit ## Vor einer Infinitivgruppe mit „zu“ steht „um“, „damit“ braucht einen Nebensatz mit konjugiertem Verb.
    fill: Er spart Geld, ___ er ein Fahrrad kaufen kann. = damit | um ## „damit“ leitet einen Nebensatz mit konjugiertem Verb ein, „um“ braucht eine Infinitivgruppe mit „zu“.
    fact: Wo setzt man in „Ich kaufe Äpfel Birnen und Bananen“ ein Komma? = Nach „Äpfel“ | Nach „Birnen“ | Nach „kaufe“ ## In einer Aufzählung trennt das Komma die Glieder, vor „und“ steht keines.
    fact: Vor welchem Wort steht in einer Aufzählung kein Komma? = und | aber | sondern ## Vor „und“, „oder“ und „sowie“ steht in einer Aufzählung kein Komma.
    fact: Wo steht in „Ich weiß dass du kommst“ das Komma? = Vor „dass“ | Nach „dass“ | Nach „du“ ## Der dass-Satz wird vom Hauptsatz durch ein Komma getrennt.
    fact: Welches Zeichen steht in „Anna fragte „Kommst du mit?““ nach „fragte“? = Ein Doppelpunkt | Ein Komma | Ein Punkt ## Geht der Begleitsatz der wörtlichen Rede voraus, folgt ein Doppelpunkt.
    fact: Welches Zeichen steht nach den Anführungszeichen in „Ich komme gleich“ sagte Max? = Ein Komma | Ein Punkt | Ein Doppelpunkt ## Bei nachgestelltem Begleitsatz fällt der Punkt weg und nach den Anführungszeichen steht ein Komma.
    fact: Muss in „Ich habe keine Lust früh aufzustehen“ ein Komma stehen? = Ja, weil die Infinitivgruppe vom Nomen „Lust“ abhängt | Nein, bei Infinitivgruppen gibt es nie ein Komma | Nein, es steht nur bei Nebensätzen ## Hängt eine Infinitivgruppe von einem Nomen ab, muss ein Komma stehen.
    fact: Wie ist es vor „um … zu“ in „Er spart um zu reisen“? = Vor „um“ muss ein Komma stehen | Vor „um“ steht nie ein Komma | Das Komma ist freiwillig ## Infinitivgruppen mit „um“, „ohne“, „statt“ und „anstatt“ werden immer durch ein Komma abgetrennt.
    form: Infinitiv mit zu, aufstehen = aufzustehen ## Bei trennbaren Verben steht „zu“ zwischen Vorsilbe und Verb.
    form: Infinitiv mit zu, lesen = zu lesen ## Bei einfachen Verben steht „zu“ vor dem Infinitiv.
    form: Infinitiv mit zu, mitkommen = mitzukommen ## Bei trennbaren Verben steht „zu“ zwischen Vorsilbe und Verb.
    form: Infinitiv mit zu, verstehen = zu verstehen ## Bei untrennbaren Verben steht „zu“ vor dem Infinitiv.

    section: Grammatik

    unit: Wortarten | Nomen, Verb, Adjektiv und ihre Verwandten
    tip: Die zehn Wortarten helfen dir, Wörter zu beschreiben. Nomen bezeichnen Lebewesen, Dinge und Begriffe, Verben Tätigkeiten und Vorgänge, Adjektive Eigenschaften. Nomen, Artikel, Pronomen und Adjektive kann man deklinieren, Verben konjugieren. Adverbien, Präpositionen und Konjunktionen kann man nicht beugen: „gestern“, „in“, „und“.
    tip: Adjektive stehen vor einem Nomen („der schnelle Zug“) und werden dann gebeugt. Als Adverb beschreiben sie ein Verb und bleiben unverändert: „Der Zug fährt schnell.“ Adjektive lassen sich steigern: schnell, schneller, am schnellsten. Unregelmäßig sind gut, besser, am besten und viel, mehr, am meisten.
    tip: Pronomen stehen anstelle von Nomen: „Anna kommt. Sie lacht.“ Präpositionen wie „in“, „auf“, „mit“, „für“ und „wegen“ verlangen einen bestimmten Fall: „mit dem Bus“, „für den Bus“. Hilfsverben (sein, haben, werden) und Modalverben (können, müssen, wollen, dürfen, sollen, mögen) stehen zusammen mit einem Vollverb: „Ich habe gelacht.“ „Ich kann schwimmen.“

    word: Substantiv = Wort für Lebewesen, Dinge und Begriffe | auch Nomen genannt, mit Artikel
    word: Verb = Wort für Tätigkeiten, Vorgänge und Zustände | lachen, regnen, sein
    word: Adjektiv = Wort, das Eigenschaften nennt und sich steigern lässt | schnell, schneller, am schnellsten
    word: Adverb = Wort, das Umstände angibt und nicht gebeugt wird | heute, hier, gern
    word: Pronomen = Wort, das für ein Nomen steht oder es begleitet | er, sie, dieses
    word: Präposition = Verhältniswort, das einen Fall verlangt | in, auf, mit, für
    word: Numerale = Zahlwort | drei, der Dritte, einmal
    word: Interjektion = Ausrufewort | aua, oh, hurra
    word: Hilfsverb = Verb, das mit einem Vollverb Zeitformen bildet | sein, haben, werden
    word: Modalverb = Verb, das Möglichkeit, Wunsch oder Pflicht ausdrückt | können, müssen, wollen
    fill: Der ___ Hund bellt laut. = große | großer ## Nach dem bestimmten Artikel „der“ steht das Adjektiv im Nominativ mit der Endung -e.
    fill: Mit dem ___ Auto fahren wir los. = neuen | neue ## Nach „mit dem“ steht das Adjektiv im Dativ mit der Endung -en.
    fill: Sie ist ___ als ihr Bruder. = größer | am größten ## Beim Vergleich mit „als“ steht der Komparativ.
    fill: Er ist der ___ Schüler der Klasse. = beste | bessere ## Bei „der … der Klasse“ steht der Superlativ „beste“.
    fill: Das Buch liegt ___ dem Tisch. = auf | nach ## „auf“ gibt den Ort an, „nach“ wird mit Orten und Richtungen gebraucht.
    fill: Wir fahren ___ Berlin. = nach | zu ## Vor Städtenamen steht „nach“.
    fill: Er ___ gestern im Kino gewesen. = ist | hat ## Das Perfekt von „sein“ wird mit „sein“ gebildet.
    fill: Ich ___ heute nicht kommen, ich bin krank. = kann | kannst ## Zu „ich“ gehört die Form „kann“.
    fact: Welche Wortart ist „schnell“ in „der schnelle Zug“? = Adjektiv | Adverb | Verb ## „schnelle“ steht vor einem Nomen und beschreibt es, also ist es ein Adjektiv.
    fact: Welche Wortart ist „gestern“? = Adverb | Adjektiv | Präposition ## „gestern“ gibt die Zeit an und bleibt unverändert, also ist es ein Adverb.
    fact: Welche Wortarten kann man nicht beugen? = Adverbien, Präpositionen und Konjunktionen | Nomen, Verben und Adjektive | Artikel und Pronomen ## Adverbien, Präpositionen und Konjunktionen sind unveränderlich.
    fact: Welche Wortart ist „in“ in „in der Schule“? = Präposition | Konjunktion | Adverb ## „in“ steht vor einem Nomen und verlangt hier den Dativ.
    fact: Welche Wortart ist „habe“ in „Ich habe gegessen“? = Hilfsverb | Modalverb | Nomen ## „habe“ bildet mit dem Partizip II die Zeitform Perfekt.
    fact: Was nennt man „Konjugation“? = Die Beugung von Verben | Die Beugung von Nomen | Die Steigerung von Adjektiven ## Verben werden konjugiert, Nomen und Adjektive werden dekliniert.
    form: schnell, Komparativ = schneller ## Der Komparativ wird mit -er gebildet.
    form: schnell, Superlativ = am schnellsten; schnellsten ## Der Superlativ wird mit am … -sten gebildet.
    form: gut, Komparativ = besser ## „gut“ wird unregelmäßig gesteigert.
    form: gut, Superlativ = am besten; besten ## „gut“ wird unregelmäßig gesteigert.
    form: hoch, Komparativ = höher ## Bei „hoch“ fällt das c weg, und es entsteht ein Umlaut.

    unit: Satzglieder und die vier Fälle | Subjekt, Objekt und Kasus
    tip: Satzglieder erkennst du mit der Umstellprobe: Was beim Umstellen zusammenbleibt, ist ein Satzglied. „Der kleine Hund bellt laut.“ hat drei Satzglieder: „Der kleine Hund“, „bellt“, „laut“. Das Prädikat ist das gebeugte Verb, das Subjekt fragst du mit „Wer oder was?“ ab.
    tip: Die Objekte ergänzen das Prädikat: Das Akkusativobjekt erfragst du mit „Wen oder was?“, das Dativobjekt mit „Wem?“. Adverbiale Bestimmungen geben Ort, Zeit, Grund oder Art an, zum Beispiel „im Garten“, „gestern“, „weil es regnet“. Ein Attribut gehört zu einem Nomen: „der kleine Hund“.
    tip: Die vier Fälle heißen Nominativ (Wer oder was?), Genitiv (Wessen?), Dativ (Wem?) und Akkusativ (Wen oder was?). Männliche Nomen: der, des, dem, den. Weibliche Nomen: die, der, der, die. Sächliche Nomen: das, des, dem, das. Im Genitiv hängen männliche und sächliche Nomen oft -es oder -s an: „des Kindes“, „des Mannes“.
    tip: Manche Präpositionen verlangen einen festen Fall. Mit dem Akkusativ stehen „für“, „durch“, „gegen“, „ohne“, „um“. Mit dem Dativ stehen „mit“, „aus“, „bei“, „nach“, „von“, „zu“, „seit“. Mit dem Genitiv stehen „wegen“, „trotz“, „während“, „statt“. Wechselpräpositionen wie „in“, „auf“, „an“ stehen bei „Wo?“ mit dem Dativ und bei „Wohin?“ mit dem Akkusativ.

    word: Satzglied = Teil des Satzes, der sich beim Umstellen nur gemeinsam verschiebt | Der kleine Hund
    word: Subjekt = Satzglied, nach dem man mit „Wer oder was?“ fragt | Der Hund bellt.
    word: Prädikat = Satzglied mit dem gebeugten Verb | Der Hund bellt.
    word: Akkusativobjekt = Ergänzung, nach der man mit „Wen oder was?“ fragt | Ich sehe den Hund.
    word: Dativobjekt = Ergänzung, nach der man mit „Wem?“ fragt | Ich helfe dem Kind.
    word: adverbiale Bestimmung = Satzglied, das Ort, Zeit, Grund oder Art angibt | im Garten, gestern, leise
    word: Attribut = Beifügung, die ein Nomen näher bestimmt | der kleine Hund
    word: Kasus = Fall, in dem ein Nomen oder Pronomen steht | Nominativ, Genitiv, Dativ, Akkusativ
    fill: Ich gebe ___ Kind einen Apfel. = dem | den ## „geben“ verlangt ein Dativobjekt, und „Kind“ ist sächlich: „dem Kind“.
    fill: Er sieht ___ Hund im Garten. = den | dem ## „sehen“ verlangt den Akkusativ, und „Hund“ ist männlich: „den Hund“.
    fill: Wir fahren mit ___ Bus zur Schule. = dem | den ## „mit“ verlangt den Dativ: „dem Bus“.
    fill: Das ist das Auto ___ Lehrers. = des | dem ## Der Genitiv zeigt den Besitz: „des Lehrers“.
    fill: Sie wartet auf ___ Zug. = den | dem ## „warten auf“ verlangt den Akkusativ: „den Zug“.
    fill: Ich danke ___ für die Hilfe. = dir | dich ## „danken“ verlangt den Dativ: „dir“.
    fill: Wegen ___ Regens fällt das Spiel aus. = des | dem ## „wegen“ verlangt den Genitiv: „des Regens“.
    fill: Er hilft ___ Freundin bei den Hausaufgaben. = seiner | seine ## „helfen“ verlangt den Dativ, bei weiblichen Nomen „seiner“.
    fact: Welche Frage stellt man nach dem Genitiv? = Wessen? | Wem? | Wen? ## Nach dem Genitiv fragt man mit „Wessen?“.
    fact: Welche Frage stellt man nach dem Dativ? = Wem? | Wessen? | Wer? ## Nach dem Dativ fragt man mit „Wem?“.
    fact: Welcher Fall folgt auf „mit“? = Dativ | Akkusativ | Genitiv ## „mit“ verlangt den Dativ.
    fact: Welcher Fall folgt auf „für“? = Akkusativ | Dativ | Genitiv ## „für“ verlangt den Akkusativ.
    fact: Welche Präposition verlangt den Genitiv? = wegen | mit | für ## „wegen“ steht mit dem Genitiv.
    fact: Welches Satzglied ist „im Garten“ in „Wir spielen im Garten“? = Adverbiale Bestimmung des Ortes | Subjekt | Akkusativobjekt ## „im Garten“ antwortet auf die Frage „Wo?“ und gibt den Ort an.
    fact: Welches Satzglied ist „dem Kind“ in „Ich schenke dem Kind ein Buch“? = Dativobjekt | Akkusativobjekt | Subjekt ## Man fragt „Wem schenke ich ein Buch?“ und erhält „dem Kind“.
    fact: Wie viele Satzglieder hat „Der kleine Hund bellt laut“? = Drei | Vier | Fünf ## „Der kleine Hund“, „bellt“ und „laut“ lassen sich nur als Ganzes verschieben.
    form: der Mann, Genitiv = des Mannes; des Manns ## Im Genitiv hängt man bei männlichen Nomen -es oder -s an.
    form: das Kind, Genitiv = des Kindes ## Im Genitiv hängt man bei sächlichen Nomen -es oder -s an.
    form: die Frau, Dativ = der Frau ## Weibliche Nomen haben im Dativ den Artikel „der“.
    form: das Haus, Dativ = dem Haus ## Sächliche Nomen haben im Dativ den Artikel „dem“.
    form: der Hund, Akkusativ = den Hund ## Männliche Nomen haben im Akkusativ den Artikel „den“.

    unit: Zeiten, Aktiv und Passiv | Zeitformen und Handlungsrichtung
    tip: Das Deutsche hat sechs Zeitformen. Präsens (ich gehe), Präteritum (ich ging), Perfekt (ich bin gegangen), Plusquamperfekt (ich war gegangen), Futur I (ich werde gehen) und Futur II (ich werde gegangen sein). Das Präteritum nutzt man beim schriftlichen Erzählen, das Perfekt beim mündlichen Berichten.
    tip: Das Perfekt bildest du mit „haben“ oder „sein“ und dem Partizip II. Mit „sein“ stehen Verben der Bewegung und Zustandsänderung wie „gehen“, „fahren“, „aufwachen“, mit „haben“ die meisten anderen. Das Plusquamperfekt drückt aus, was vor etwas anderem in der Vergangenheit geschah: „Nachdem er gegessen hatte, ging er schlafen.“
    tip: Aktiv und Passiv sagen, wer handelt. Im Aktiv tut das Subjekt etwas: „Anna öffnet das Fenster.“ Im Passiv geschieht etwas mit dem Subjekt: „Das Fenster wird von Anna geöffnet.“ Das Vorgangspassiv bildest du mit „werden“ und dem Partizip II. Aus dem Akkusativobjekt des Aktivsatzes wird das Subjekt des Passivsatzes.
    tip: Die Stammformen von unregelmäßigen Verben solltest du lernen: gehen – ging – gegangen, bringen – brachte – gebracht, lesen – las – gelesen. Das Partizip II regelmäßiger Verben endet auf -t (gespielt), das unregelmäßiger meist auf -en (geschrieben).

    word: Präsens = Zeitform für Gegenwart und allgemeine Aussagen | ich gehe
    word: Präteritum = einfache Vergangenheit, oft beim schriftlichen Erzählen | ich ging
    word: Perfekt = Vergangenheitsform aus haben oder sein und Partizip II | ich bin gegangen
    word: Plusquamperfekt = Vorvergangenheit aus hatte oder war und Partizip II | ich war gegangen
    word: Futur I = Zukunftsform aus werden und Infinitiv | ich werde gehen
    word: Aktiv = Form, in der das Subjekt etwas tut | Anna öffnet das Fenster.
    word: Passiv = Form, in der mit dem Subjekt etwas geschieht | Das Fenster wird geöffnet.
    word: Partizip II = Verbform wie gespielt oder gegangen, die man für Perfekt und Passiv braucht | gespielt, gegangen
    fill: Gestern ___ ich lange geschlafen. = habe | bin ## „schlafen“ bildet das Perfekt mit „haben“.
    fill: Wir ___ nach Hamburg gefahren. = sind | haben ## „fahren“ als Bewegung bildet das Perfekt mit „sein“.
    fill: Sie ___ das Buch schon gelesen. = hat | ist ## „lesen“ bildet das Perfekt mit „haben“.
    fill: Nachdem er gegessen ___, ging er schlafen. = hatte | hat ## Eine Handlung vor einer Handlung in der Vergangenheit steht im Plusquamperfekt.
    fill: Morgen ___ es regnen. = wird | wurde ## Das Futur I wird mit „werden“ und dem Infinitiv gebildet.
    fill: Gestern ___ das Haus von Arbeitern gebaut. = wurde | wird ## Das Vorgangspassiv im Präteritum wird mit „wurde“ und dem Partizip II gebildet.
    fill: Ich ___ gestern meine Hausaufgaben gemacht. = habe | wurde ## Das Perfekt von „machen“ wird mit „haben“ gebildet.
    fill: Gestern ___ er spät nach Hause. = kam | kommt ## Das Präteritum von „kommen“ heißt „kam“.
    fill: Als ich ankam, ___ der Film schon begonnen. = hatte | hat ## Das Plusquamperfekt wird mit „hatte“ und dem Partizip II gebildet.
    fact: Wie bildet man das Perfekt? = Mit haben oder sein und dem Partizip II | Mit werden und dem Infinitiv | Mit war und dem Partizip II ## Das Perfekt besteht aus einer Form von „haben“ oder „sein“ und dem Partizip II.
    fact: Wie bildet man das Vorgangspassiv? = Mit werden und dem Partizip II | Mit sein und dem Infinitiv | Mit haben und dem Partizip II ## Das Vorgangspassiv besteht aus „werden“ und dem Partizip II.
    fact: Welche Zeitform nutzt man meist beim schriftlichen Erzählen? = Präteritum | Perfekt | Futur I ## Das Präteritum ist die Erzählform der Vergangenheit.
    fact: Welche Zeitform steht in „Er hatte schon gegessen“? = Plusquamperfekt | Perfekt | Präteritum ## „hatte“ und das Partizip II bilden das Plusquamperfekt.
    fact: Welcher Satz steht im Passiv? = Das Fenster wird von Anna geöffnet. | Anna öffnet das Fenster. | Anna hat das Fenster geöffnet. ## Im Passiv steht „werden“ mit dem Partizip II.
    fact: Mit welchem Hilfsverb bildet „gehen“ das Perfekt? = Mit sein | Mit haben ## Verben der Bewegung bilden das Perfekt mit „sein“.
    form: gehen, Präteritum ich = ging ## „gehen“ ist unregelmäßig und wird im Präteritum zu „ging“.
    form: bringen, Präteritum ich = brachte ## „bringen“ hat im Präteritum die Form „brachte“.
    form: schreiben, Partizip II = geschrieben ## Unregelmäßige Verben haben meist ein Partizip II auf -en.
    form: gehen, Partizip II = gegangen ## „gehen“ hat das Partizip II „gegangen“.
    form: lesen, Perfekt ich = habe gelesen ## Das Perfekt von „lesen“ wird mit „haben“ gebildet.
    form: kommen, Plusquamperfekt ich = war gekommen ## „kommen“ bildet das Plusquamperfekt mit „war“.

    unit: Konjunktiv I und II | Indirekte Rede und Möglichkeitsform
    tip: Der Modus zeigt, wie der Sprecher etwas darstellt. Der Indikativ nennt Tatsachen („Er ist krank.“), der Imperativ gibt Befehle („Komm!“), der Konjunktiv drückt Möglichkeit, Wunsch oder fremde Rede aus. Der Konjunktiv I dient der indirekten Rede: „Max sagt, er sei krank.“ Der Konjunktiv II steht für Unwirkliches, Wünsche und Höflichkeit: „Wenn ich Zeit hätte, käme ich mit.“ „Ich hätte gern ein Eis.“
    tip: Den Konjunktiv I bildest du aus dem Verbstamm mit den Endungen -e, -est, -e, -en, -et, -en: er habe, er komme, er gehe. Eine Besonderheit ist „sein“: er sei, sie seien. Steht der Konjunktiv I in einer Form wie der Indikativ („sie haben“, „ich komme“), nimmt man in der indirekten Rede den Konjunktiv II („sie hätten“, „ich käme“).
    tip: Den Konjunktiv II bildest du aus dem Präteritum, mit Umlaut, wenn möglich: ich hatte – ich hätte, ich war – ich wäre, ich kam – ich käme, ich konnte – ich könnte, ich ging – ich ginge. Viele Verben bilden ihn mit „würde“ und dem Infinitiv: ich würde gehen.
    tip: In irrealen Bedingungssätzen („Wenn ich du wäre, würde ich es tun.“) beschreibt der Konjunktiv II etwas, das nicht der Wirklichkeit entspricht. In der indirekten Rede darf die Zeit des Verbs nicht verändert werden, sondern nur der Modus: aus „Er ist krank.“ wird „Er sagt, er sei krank.“

    word: Modus = Aussageweise des Verbs | Indikativ, Konjunktiv, Imperativ
    word: Indikativ = Wirklichkeitsform des Verbs | Er kommt.
    word: Imperativ = Befehlsform des Verbs | Komm!
    word: Konjunktiv I = Form der indirekten Rede | er sei, sie habe
    word: Konjunktiv II = Möglichkeitsform für Wünsche, Unwirkliches und Höflichkeit | wäre, hätte, käme
    word: indirekte Rede = Wiedergabe einer fremden Äußerung ohne Anführungszeichen | Max sagt, er sei krank.
    word: Umschreibung mit würde = Ersatz für eine ungebräuchliche Konjunktiv-II-Form | ich würde gehen
    word: irrealer Bedingungssatz = Bedingungssatz, der etwas Unwirkliches ausdrückt | Wenn ich reich wäre, ...
    fill: Konjunktiv I: Anna sagt, sie ___ müde. = sei | ist ## In der indirekten Rede steht der Konjunktiv I: „sei“.
    fill: Konjunktiv I: Der Lehrer sagt, er ___ morgen Zeit. = habe | hat ## Der Konjunktiv I von „haben“ lautet „er habe“.
    fill: Konjunktiv I: Tom meint, es ___ schon spät. = sei | ist ## In der indirekten Rede steht der Konjunktiv I: „sei“.
    fill: Konjunktiv I: Sie sagt, die Kinder ___ im Garten. = seien | sind ## Der Konjunktiv I von „sein“ im Plural lautet „seien“.
    fill: Konjunktiv II: Wenn ich Zeit ___, käme ich mit. = hätte | habe ## Der irreale Bedingungssatz verlangt den Konjunktiv II: „hätte“.
    fill: Konjunktiv II: Wenn er hier ___, könnten wir spielen. = wäre | ist ## Der irreale Bedingungssatz verlangt den Konjunktiv II: „wäre“.
    fill: Konjunktiv II: Ich ___ gern ein Eis. = hätte | hat ## Höfliche Bitten stehen im Konjunktiv II: „hätte“.
    fill: Konjunktiv II: Wenn ich du ___, würde ich es tun. = wäre | war ## Der irreale Bedingungssatz verlangt den Konjunktiv II: „wäre“.
    fill: Konjunktiv II: ___ du mir bitte helfen? = Könntest | Wolltest ## Die höfliche Bitte steht im Konjunktiv II: „Könntest“.
    fact: Wann verwendet man den Konjunktiv I? = In der indirekten Rede | Bei Befehlen | In der wörtlichen Rede ## Der Konjunktiv I dient der indirekten Rede.
    fact: Wie lautet der Konjunktiv I von „sein“ in der 3. Person Singular? = sei | wäre | ist ## Der Konjunktiv I von „sein“ heißt „er sei“.
    fact: Wann nimmt man in der indirekten Rede den Konjunktiv II statt I? = Wenn der Konjunktiv I wie der Indikativ klingt | Wenn die Rede lang ist | Wenn die Aussage in der Vergangenheit steht ## Wenn man Konjunktiv I und Indikativ nicht unterscheiden kann, wählt man den Konjunktiv II.
    fact: Wie lautet der Konjunktiv II von „haben“ in der 1. Person Singular? = hätte | habe | hast ## Der Konjunktiv II von „haben“ heißt „ich hätte“.
    fact: Welcher Satz drückt einen irrealen Wunsch aus? = Wenn ich nur reich wäre! | Ich bin reich. | Er sagt, er sei reich. ## Der irreale Wunsch verlangt den Konjunktiv II.
    fact: Welcher Satz steht in indirekter Rede? = Er sagt, sie komme später. | Er sagt: „Sie kommt später.“ | Sie kommt später. ## Die indirekte Rede hat keine Anführungszeichen und steht im Konjunktiv.
    form: sein, Konjunktiv I er = sei ## Der Konjunktiv I von „sein“ ist unregelmäßig: „er sei“.
    form: sein, Konjunktiv II ich = wäre ## Der Konjunktiv II von „sein“ heißt „ich wäre“.
    form: haben, Konjunktiv II ich = hätte ## Der Konjunktiv II von „haben“ heißt „ich hätte“.
    form: kommen, Konjunktiv II ich = käme ## Der Konjunktiv II von „kommen“ heißt „ich käme“.
    form: werden, Konjunktiv II ich = würde ## Der Konjunktiv II von „werden“ heißt „ich würde“.
    form: können, Konjunktiv II ich = könnte ## Der Konjunktiv II von „können“ heißt „ich könnte“.

    section: Stil und Text

    unit: Stilmittel | Rhetorische Mittel erkennen und benennen
    tip: Stilmittel sind besondere Mittel der Sprache, mit denen ein Text wirkt. Die Metapher überträgt ein Bild ohne „wie“ („Du bist ein Fuchs.“), der Vergleich benutzt „wie“ oder „als ob“ („stark wie ein Bär“). Bei der Personifikation handeln Dinge wie Menschen („Der Wind flüstert.“).
    tip: Klangmittel und Wiederholungen: Die Alliteration wiederholt den Anfangslaut („Milch macht müde Männer munter“), die Anapher wiederholt Wörter am Anfang aufeinanderfolgender Sätze („Wir wollen Frieden. Wir wollen Freiheit.“). Die Antithese stellt Gegensätze gegenüber („Tag und Nacht“).
    tip: Weitere Mittel: Die Hyperbel übertreibt stark („tausendmal angerufen“), der Euphemismus beschönigt („Er ist von uns gegangen.“ für „Er ist gestorben“), die Ironie meint das Gegenteil des Gesagten, und die rhetorische Frage verlangt keine Antwort („Wer will schon Streit?“).
    tip: Beim Analysieren nennst du erst das Stilmittel, zitierst die Textstelle und beschreibst dann die Wirkung, zum Beispiel: Die Metapher macht die Aussage anschaulich.

    word: Metapher = Bild, das ohne „wie“ übertragen wird | der Zahn der Zeit
    word: Vergleich = Bild, das mit „wie“ oder „als ob“ verbunden wird | stark wie ein Bär
    word: Personifikation = Darstellung von Dingen oder Tieren als Menschen | Der Wind flüstert.
    word: Alliteration = Wiederholung des gleichen Anlauts mehrerer Wörter | Milch macht müde Männer munter
    word: Anapher = Wiederholung am Anfang aufeinanderfolgender Sätze oder Verse | Wir wollen ... Wir wollen ...
    word: Antithese = Gegenüberstellung von Gegensätzen | Tag und Nacht
    word: Ironie = Aussage, die das Gegenteil des Gemeinten sagt | Das hast du ja toll gemacht!
    word: Hyperbel = starke Übertreibung | tausendmal angerufen
    word: Euphemismus = Beschönigung eines unangenehmen Sachverhalts | von uns gegangen
    word: rhetorische Frage = Frage, auf die keine Antwort erwartet wird | Wer will schon Streit?
    fill: „Du bist ein Fuchs.“ Stilmittel: ___ = Metapher | Vergleich ## Es fehlt das Vergleichswort „wie“, also ist es eine Metapher.
    fill: „Er ist stark wie ein Bär.“ Stilmittel: ___ = Vergleich | Metapher ## Das Wort „wie“ verbindet beide Bilder, also ist es ein Vergleich.
    fill: „Der Wind flüstert in den Bäumen.“ Stilmittel: ___ = Personifikation | Hyperbel ## Der Wind tut etwas, was nur Menschen können.
    fill: „Ich habe tausendmal angerufen.“ Stilmittel: ___ = Hyperbel | Euphemismus ## Die Zahl ist stark übertrieben.
    fill: „Milch macht müde Männer munter.“ Stilmittel: ___ = Alliteration | Anapher ## Die Wörter beginnen mit dem gleichen Laut.
    fill: „Wir wollen Frieden. Wir wollen Freiheit.“ Stilmittel: ___ = Anapher | Alliteration ## Die Satzanfänge wiederholen sich.
    fill: Nach einem Fehler sagt jemand: „Das hast du ja toll gemacht!“ Stilmittel: ___ = Ironie | Euphemismus ## Der Sprecher meint das Gegenteil des Gesagten.
    fill: „Er ist von uns gegangen.“ Stilmittel: ___ = Euphemismus | Ironie ## Das unangenehme Wort „gestorben“ wird umschrieben.
    fill: „Wer will schon Streit?“ Stilmittel: ___ = rhetorische Frage | Antithese ## Auf die Frage wird keine Antwort erwartet.
    fact: Woran erkennt man einen Vergleich? = An Wörtern wie „wie“ oder „als ob“ | An der Wiederholung des Anlauts | An der Übertreibung ## Ein Vergleich verbindet zwei Bilder mit „wie“ oder „als ob“.
    fact: Was unterscheidet eine Metapher von einem Vergleich? = Die Metapher kommt ohne „wie“ aus | Die Metapher hat immer eine Zahl | Der Vergleich wiederholt den Anlaut ## Die Metapher überträgt ein Bild ohne Vergleichswort.
    fact: Wozu benutzt man eine Anapher? = Um einen Gedanken durch Wiederholung zu betonen | Um ein Wort zu übertreiben | Um etwas zu beschönigen ## Die Wiederholung am Satzanfang betont den Gedanken.
    fact: Welches Stilmittel liegt bei „Tag und Nacht“ oder „Krieg und Frieden“ vor? = Antithese | Anapher | Metapher ## Die Antithese stellt Gegensätze gegenüber.
    form: die Metapher, Plural = die Metaphern ## „Metapher“ bildet den Plural mit -n.
    form: die Hyperbel, Plural = die Hyperbeln ## „Hyperbel“ bildet den Plural mit -n.
    form: die Alliteration, Plural = die Alliterationen ## „Alliteration“ bildet den Plural mit -en.
    form: der Vergleich, Plural = die Vergleiche ## „Vergleich“ bildet den Plural mit -e.

    unit: Textanalyse | Gattungen, Gedichte und Argumentation
    tip: Es gibt drei Gattungen. Die Epik erzählt (Roman, Kurzgeschichte), die Lyrik sind Gedichte, die Dramatik ist für die Bühne geschrieben und besteht aus Dialogen. Bei Erzähltexten fragst du, wer erzählt: Ein Ich-Erzähler berichtet als Figur der Handlung, ein Er-Erzähler von außen.
    tip: Ein Gedicht besteht aus Versen (Zeilen) und Strophen (Abschnitten). Das lyrische Ich ist der Sprecher des Gedichts, nicht automatisch der Dichter. Reimschemata kennzeichnet man mit Buchstaben: Paarreim aabb, Kreuzreim abab, umarmender Reim abba.
    tip: Beim Argumentieren stellst du eine These auf, begründest sie mit Argumenten und belegst sie mit Beispielen. Eine Inhaltsangabe schreibst du im Präsens und in eigenen Worten, ohne wörtliche Rede.
    tip: Eine Textanalyse hat meist drei Teile: Einleitung (Autor, Titel, Thema), Hauptteil (Inhalt, Aufbau, Sprache, Wirkung) und Schluss (Fazit oder eigene Stellungnahme).

    word: Epik = erzählende Gattung | Roman, Kurzgeschichte
    word: Lyrik = Gattung der Gedichte | Verse und Strophen
    word: Dramatik = Gattung der Bühnenstücke | Dialoge, Regieanweisungen
    word: lyrisches Ich = Sprecher in einem Gedicht | nicht automatisch der Dichter
    word: Strophe = Abschnitt eines Gedichts aus mehreren Versen | Vierzeiler
    word: Vers = einzelne Zeile eines Gedichts | Zeile
    word: Paarreim = Reimschema, bei dem sich aufeinanderfolgende Verse reimen | aabb
    word: Kreuzreim = Reimschema, bei dem sich jeder zweite Vers reimt | abab
    word: These = Behauptung, die man begründen will | Hausaufgaben sind sinnvoll.
    word: Ich-Erzähler = Erzähler, der als Figur der Handlung berichtet | Ich ging nach Hause.
    fill: Reimschema: „Haus, Maus, Wald, kalt“ ___ = Paarreim | Kreuzreim ## Haus reimt auf Maus und Wald auf kalt, also aabb.
    fill: Reimschema: „Tag, Wald, Mag, kalt“ ___ = Kreuzreim | Paarreim ## Tag reimt auf Mag und Wald auf kalt, also abab.
    fill: Eine Inhaltsangabe schreibt man im ___. = Präsens | Präteritum ## Inhaltsangaben stehen im Präsens.
    fill: Ein Gedicht gehört zur ___. = Lyrik | Epik ## Gedichte gehören zur Lyrik.
    fill: Ein Roman gehört zur ___. = Epik | Lyrik ## Romane erzählen und gehören darum zur Epik.
    fill: Ein Theaterstück gehört zur ___. = Dramatik | Epik ## Theaterstücke bestehen aus Dialogen und gehören zur Dramatik.
    fill: Der Sprecher eines Gedichts heißt lyrisches ___. = Ich | Er ## Der Sprecher heißt „lyrisches Ich“.
    fill: Die Behauptung am Anfang einer Argumentation heißt ___. = These | Beleg ## Die These ist die Behauptung, die man begründen will.
    fill: Ein Text, in dem „ich“ erzählt, hat einen ___-Erzähler. = Ich | Er ## Wer als „ich“ erzählt, ist ein Ich-Erzähler.
    fact: Welches Reimschema hat ein umarmender Reim? = abba | abab | aabb ## Beim umarmenden Reim umschließt ein Reimpaar ein anderes.
    fact: Zu welcher Gattung gehört ein Roman? = Zur Epik | Zur Lyrik | Zur Dramatik ## Romane erzählen und gehören zur Epik.
    fact: Aus welcher Sicht berichtet ein Ich-Erzähler? = Aus der Sicht einer Figur, die selbst im Geschehen steht | Aus der Sicht eines Beobachters von außen | Aus der Sicht des Lesers ## Der Ich-Erzähler ist selbst Teil der Handlung.
    fact: Wen meint das lyrische Ich? = Den Sprecher im Gedicht, nicht automatisch den Dichter | Immer den Dichter selbst | Den Leser des Gedichts ## Das lyrische Ich ist die Sprecherrolle im Gedicht.
    fact: Wie baut man ein Argument auf? = Behauptung, Begründung, Beispiel | Einleitung, Hauptteil, Schluss | Reim, Vers, Strophe ## Ein Argument besteht aus Behauptung, Begründung und Beispiel.
    fact: In welcher Zeitform schreibt man eine Textanalyse über den Inhalt? = Im Präsens | Im Präteritum | Im Plusquamperfekt ## Inhaltliche Aussagen über Texte stehen im Präsens.
    form: das Gedicht, Plural = die Gedichte ## „Gedicht“ bildet den Plural mit -e.
    form: der Vers, Plural = die Verse ## „Vers“ bildet den Plural mit -e.
    form: die Strophe, Plural = die Strophen ## „Strophe“ bildet den Plural mit -n.
    form: das Drama, Plural = die Dramen ## „Drama“ bildet den Plural „Dramen“.
    """

    static let provider: any CourseProvider = LanguageCourseProvider.make(source: source).provider
}
