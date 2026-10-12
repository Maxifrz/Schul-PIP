import XCTest
@testable import Lernwerk

/// A small course in the text format, as large per unit as a real one: the engine's tests run on it.
enum LanguageSample {
    static let source = """
    # A sample, not the Spanish course.
    course: sample
    title: Beispiel
    subtitle: Für Tests
    kind: language
    color: D9903A
    symbol: text.bubble.fill
    speech: es-ES
    target-name: Spanisch
    into-name: Spanische

    section: A1 · Erste Schritte
    unit: Hallo und Tschüss | Begrüßen und sich vorstellen
    tip: Im Spanischen begrüßt man sich je nach Tageszeit anders.
    tip: „Ser“ ist das Verb für „sein“, wenn es um Namen, Herkunft und Eigenschaften geht.
    word: hola = hallo
    word: adiós = tschüss; auf Wiedersehen
    word: buenos días = guten Morgen
    word: buenas tardes = guten Tag
    word: buenas noches = gute Nacht
    word: por favor = bitte
    word: gracias = danke
    word: sí = ja
    word: no = nein
    word: yo = ich
    word: tú = du
    word: el nombre = der Name | m
    sentence: Me llamo Ana. = Ich heiße Ana.
    sentence: ¿Cómo te llamas? = Wie heißt du?
    sentence: Mucho gusto. = Freut mich.
    sentence: Soy de Alemania. = Ich komme aus Deutschland.
    sentence: ¿De dónde eres? = Woher kommst du?
    sentence: Buenos días, Ana. = Guten Morgen, Ana.
    sentence: Gracias, hasta luego. = Danke, bis später.
    sentence: No, gracias. = Nein, danke.
    form: ser, yo = soy ## Mit „yo“ steht „soy“.
    form: ser, tú = eres
    form: ser, él = es
    form: ser, nosotros = somos
    fill: Yo ___ Ana. = soy | eres | es
    fill: ¿Cómo ___ llamas? = te | me | se
    fill: ___ días. = Buenos | Buenas | Bueno
    fact: Was sagt man am Abend zur Begrüßung? = buenas noches | buenos días | adiós ## Abends: buenas noches.
    fact: Welches Zeichen steht vor einer spanischen Frage? = ¿ | ! | ?

    unit: La familia | Die Familie
    tip: Spanische Nomen haben ein Geschlecht: „el“ für männlich, „la“ für weiblich.
    word: la madre = die Mutter | f
    word: el padre = der Vater | m
    word: el hermano = der Bruder | m
    word: la hermana = die Schwester | f
    word: el abuelo = der Großvater | m
    word: la abuela = die Großmutter | f
    word: el hijo = der Sohn | m
    word: la hija = die Tochter | f
    word: el tío = der Onkel | m
    word: la tía = die Tante | f
    word: la familia = die Familie | f
    word: mi = mein
    sentence: Mi madre se llama Ana. = Meine Mutter heißt Ana.
    sentence: Tengo un hermano. = Ich habe einen Bruder.
    sentence: Mi padre es alto. = Mein Vater ist groß.
    sentence: Mi familia es grande. = Meine Familia ist groß.
    sentence: Mi abuela vive en Madrid. = Meine Großmutter wohnt in Madrid.
    sentence: Tengo dos tíos. = Ich habe zwei Onkel.
    sentence: Mi hermana es pequeña. = Meine Schwester ist klein.
    sentence: Mi hijo se llama Luis. = Mein Sohn heißt Luis.
    form: tener, yo = tengo
    form: tener, tú = tienes
    form: tener, él = tiene
    form: tener, nosotros = tenemos
    fill: Tengo un ___. = hermano | hermana | madre
    fill: Mi ___ se llama Rosa. = tía | tío | padre
    fill: Mi familia ___ grande. = es | eres | soy
    fact: Welcher Artikel gehört zu „madre“? = la | el | un ## „madre“ ist weiblich.
    fact: Was bedeutet „mis padres“? = meine Eltern | meine Väter | mein Vater
    """

    static func provider() -> LanguageCourseProvider {
        LanguageCourseProvider.make(source: source).provider
    }
}

extension LanguageSample {
    /// A Latin-style course: no voice, nothing to produce freely, forms typed.
    static let latinSource = """
    course: la
    title: Latein
    subtitle: Für Tests
    color: 9A7B5B
    symbol: building.columns.fill
    produce: no
    target-name: Latein
    into-name: Lateinische

    section: Grundlagen
    unit: Die a-Deklination | Nominativ und Akkusativ
    tip: Lateinische Nomen haben eine Endung, die ihre Rolle im Satz zeigt.
    known: Marcus, Roma, aquam, terram, habitant
    word: puella = das Mädchen | -ae f.
    word: villa = das Landhaus | -ae f.
    word: via = der Weg | -ae f.
    word: silva = der Wald | -ae f.
    word: aqua = das Wasser | -ae f.
    word: terra = das Land | -ae f.
    word: amat = er liebt
    word: habitat = er wohnt
    word: videt = er sieht
    word: portat = er trägt
    word: in = in
    word: et = und
    sentence: Puella aquam portat. = Das Mädchen trägt Wasser.
    sentence: Puella in villa habitat. = Das Mädchen wohnt im Landhaus.
    sentence: Marcus silvam videt. = Marcus sieht den Wald.
    sentence: Puella viam amat. = Das Mädchen liebt den Weg.
    sentence: Marcus et puella in silva habitant. = Marcus und das Mädchen wohnen im Wald.
    sentence: Marcus terram videt. = Marcus sieht das Land.
    form: puella, Akk. Sg. = puellam
    form: puella, Akk. Pl. = puellas
    form: puella, Nom. Pl. = puellae
    form: villa, Akk. Sg. = villam
    form: villa, Akk. Pl. = villas
    form: villa, Nom. Pl. = villae
    fill: Puella ___ amat. = viam | via | viae
    fill: Marcus ___ videt. = silvam | silva | silvae
    fact: Welche Endung hat der Akkusativ Singular der a-Deklination? = -am | -a | -ae ## Puellam: Endung -am.
    """

    /// A school subject: terms with definitions, facts and fills, no voice.
    static let schoolSource = """
    course: de
    title: Deutsch
    subtitle: Rechtschreibung und Grammatik
    kind: school
    color: C46A55
    symbol: book.fill

    section: Grammatik
    unit: Stilmittel | Begriffe der Textanalyse
    tip: Stilmittel sind sprachliche Mittel, mit denen ein Text wirkt.
    word: die Metapher = ein Bild ohne „wie“
    word: der Vergleich = ein Bild mit „wie“
    word: die Personifikation = ein Ding handelt wie ein Mensch
    word: die Alliteration = gleicher Anlaut mehrerer Wörter
    word: die Anapher = gleicher Satzanfang
    word: die Hyperbel = starke Übertreibung
    word: die Ironie = das Gegenteil des Gemeinten
    word: die Antithese = ein scharfer Gegensatz
    fact: Welches Stilmittel steckt in „Milch und Honig“? = Alliteration | Anapher | Hyperbel
    fact: Was ist „Er ist ein Fels in der Brandung“? = eine Metapher | ein Vergleich | eine Ironie ## Kein „wie“: Metapher.
    fact: Was ist „stark wie ein Bär“? = ein Vergleich | eine Metapher | eine Anapher
    fill: „Der Wind flüstert.“ ist eine ___. = Personifikation | Anapher | Hyperbel
    fill: „Ich habe tausendmal gewartet.“ ist eine ___. = Hyperbel | Ironie | Antithese
    fill: Zwei gleiche Satzanfänge nennt man ___. = Anapher | Metapher | Vergleich
    fact: Wofür steht das Zeichen „!“? = Ausrufezeichen | Fragezeichen | Komma
    fact: Welche Wortart ist „schnell“? = Adjektiv | Nomen | Verb
    fact: Wie viele Fälle gibt es im Deutschen? = vier | drei | fünf
    fact: Welcher Fall antwortet auf „wem“? = Dativ | Akkusativ | Genitiv
    """
}
