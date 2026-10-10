import Foundation

/// Spanisch for German speakers, level A1 (Spain's standard Spanish with tú and vosotros). The course is plain text in
/// the format of LanguageDSL, so a teacher can read and correct it; LanguageCourseProvider turns it into lessons.
/// The text has no backslashes, triple quotes or interpolation, because Swift would read them.
enum SpanishCourse {
    static let source = """
    # Spanish for German speakers, A1: the standard Spanish of Spain, with tú and vosotros.
    # Built on the Plan curricular del Instituto Cervantes (A1) and the first-year syllabi of German schools.
    course: es
    title: Spanisch
    subtitle: Für Deutschsprachige · A1
    kind: language
    color: D9903A
    symbol: text.bubble.fill
    speech: es-ES
    instruction: de
    target-name: Spanisch
    into-name: Spanische

    section: A1 · Erste Schritte

    unit: Saludos y presentarse | Begrüßen, vorstellen und das Verb ser
    tip: Spanisch schreibt man fast so, wie man es spricht. Fragen beginnen mit einem umgedrehten Fragezeichen und enden mit einem normalen: ¿Cómo te llamas? Ausrufe beginnen mit einem umgedrehten Ausrufezeichen: ¡Hola! So weißt du schon am Satzanfang, wie du den Satz lesen musst.
    tip: Der Akzent (á, é, í, ó, ú) zeigt, welche Silbe betont wird, und gehört fest zur Schreibung. Er kann auch Wörter unterscheiden: tú heißt „du“, tu heißt „dein“; él heißt „er“, el heißt „der“. Fragewörter tragen immer einen Akzent: qué, cómo, dónde. Das h am Wortanfang spricht man nicht (hola klingt wie „ola“), das ñ wie „nj“ (España).
    tip: Wo liegt die Betonung? Wörter auf Vokal, -n oder -s betonst du auf der vorletzten Silbe (mesa, hablan, lunes), alle anderen auf der letzten (hablar, ciudad). Weicht ein Wort davon ab, steht ein Akzent auf der betonten Silbe: café, adiós, lápiz, miércoles.
    tip: Das wichtigste Verb ist ser (sein): yo soy, tú eres, él / ella es, nosotros somos, vosotros sois, ellos / ellas son. Du benutzt ser für Namen, Herkunft und Eigenschaften: Soy Ana. Soy de Alemania. Zu Freunden und Mitschülern sagst du tú, zu mehreren vosotros. Erwachsene, die du siezt, sprichst du mit usted an.
    tip: Das Subjektpronomen lässt man meist weg, weil die Verbform schon zeigt, wer gemeint ist: Soy Ana. Yo soy Ana klingt betont, etwa „ICH bin Ana“. Verneint wird mit no vor dem Verb: No soy de Madrid. Zur Begrüßung sagt man in Spanien bis zum Mittagessen buenos días, danach buenas tardes und abends buenas noches.
    known: Ana, Luis, Marta, Madrid, Alemania, de, y, cómo, dónde, muy, bien, mucho, gusto
    word: hola = hallo
    word: adiós = tschüss; auf Wiedersehen
    word: buenos días = guten Morgen | bis zum Mittagessen
    word: buenas tardes = guten Tag; guten Nachmittag | nach dem Mittagessen
    word: buenas noches = guten Abend; gute Nacht | wenn es dunkel ist
    word: ¿qué tal? = wie geht's?; wie geht es dir? | unter Freunden
    word: gracias = danke
    word: me llamo = ich heiße | von llamarse, „sich nennen“
    word: te llamas = du heißt | von llamarse, „sich nennen“
    word: yo = ich
    word: tú = du | mit Akzent; ohne Akzent heißt tu „dein“
    word: él = er | mit Akzent; ohne Akzent heißt el „der“
    word: ella = sie | eine Frau oder ein Mädchen
    word: no = nein; nicht
    word: sí = ja | mit Akzent; ohne Akzent heißt si „wenn“
    sentence: Hola, me llamo Ana. = Hallo, ich heiße Ana.
    sentence: ¿Cómo te llamas? = Wie heißt du?
    sentence: Mucho gusto. = Freut mich.
    sentence: ¿De dónde eres? = Woher kommst du?
    sentence: Soy de Alemania. = Ich komme aus Deutschland.
    sentence: Él es Luis y ella es Marta. = Er ist Luis und sie ist Marta.
    sentence: Muy bien, gracias. ¿Y tú? = Sehr gut, danke. Und du?
    form: ser, yo = soy ## Zu „yo“ gehört „soy“.
    form: ser, tú = eres ## Zu „tú“ gehört „eres“.
    form: ser, él = es ## Zu „él“ und „ella“ gehört „es“.
    form: ser, nosotros = somos ## Zu „nosotros“ (wir) gehört „somos“.
    form: ser, vosotros = sois ## Zu „vosotros“ (ihr) gehört „sois“.
    form: ser, ellos = son ## Zu „ellos“ (sie, Plural) gehört „son“.
    fill: Yo ___ Marta. = soy | eres | es ## Zu „yo“ gehört „soy“.
    fill: ¿De dónde ___ tú? = eres | soy | es ## Zu „tú“ gehört „eres“.
    fact: Womit beginnt im Spanischen eine Frage? = mit einem umgedrehten Fragezeichen | mit einem normalen Fragezeichen | mit einem Ausrufezeichen ## Eine Frage beginnt mit ¿ und endet mit ?.

    unit: La familia | Die Familie, tener und mein, dein, sein
    tip: Jedes Nomen ist männlich oder weiblich. Der bestimmte Artikel ist el (männlich) oder la (weiblich), der unbestimmte un oder una: el padre, la madre, un hermano, una hermana. Lerne jedes Nomen immer gleich mit seinem Artikel. Bei Personen endet das Wort oft auf -o (männlich) oder -a (weiblich): el hijo, la hija, el abuelo, la abuela.
    tip: Das Verb tener (haben) ist unregelmäßig: tengo, tienes, tiene, tenemos, tenéis, tienen. Bei yo heißt es tengo; bei tú, él und ellos wird das e im Stamm zu ie; nosotros und vosotros behalten das e. Fragen und Antworten: ¿Tienes hermanos? Sí, tengo un hermano. No, no tengo hermanos.
    tip: Besitz zeigst du mit mi, tu und su. Sie stehen vor dem Nomen und ersetzen den Artikel: mi madre, tu padre, su hijo. Gehören mehrere Dinge oder Personen dazu, steht ein -s: mis padres, tus hermanos, sus hijos. Su heißt „sein“ und „ihr“. Dazu kommt nuestro / nuestra für „unser“: nuestra familia.
    tip: Einen Besitzer nennst du nicht mit ’s, sondern mit de: la madre de Ana, „die Mutter von Ana“. Los padres heißt „die Eltern“, los hermanos heißt „die Geschwister“ (Brüder und Schwestern zusammen).
    known: un, una, se, llama, Rosa, hermanos
    word: la familia = die Familie | f · Pl. las familias
    word: el padre = der Vater | m · Pl. los padres
    word: la madre = die Mutter | f · Pl. las madres
    word: los padres = die Eltern | Plural von el padre, bedeutet auch „die Eltern“
    word: el hermano = der Bruder | m · Pl. los hermanos
    word: la hermana = die Schwester | f · Pl. las hermanas
    word: el abuelo = der Großvater | m · Pl. los abuelos
    word: la abuela = die Großmutter | f · Pl. las abuelas
    word: el hijo = der Sohn | m · Pl. los hijos
    word: la hija = die Tochter | f · Pl. las hijas
    word: tener = haben | unregelmäßig
    word: mi, mis = mein; meine | steht vor dem Nomen, ohne Artikel
    word: tu, tus = dein; deine | steht vor dem Nomen, ohne Artikel
    word: su, sus = sein; ihr | steht vor dem Nomen, ohne Artikel
    sentence: Tengo un hermano. = Ich habe einen Bruder.
    sentence: Mi madre se llama Rosa. = Meine Mutter heißt Rosa.
    sentence: Mi padre es de Madrid. = Mein Vater kommt aus Madrid.
    sentence: Tengo una hermana y un hermano. = Ich habe eine Schwester und einen Bruder.
    sentence: Mis padres son de Alemania. = Meine Eltern kommen aus Deutschland.
    sentence: ¿Tienes hermanos? = Hast du Geschwister?
    sentence: Su hijo se llama Luis. = Sein Sohn heißt Luis.
    form: tener, yo = tengo ## Zu „yo“ gehört „tengo“.
    form: tener, tú = tienes ## Zu „tú“ gehört „tienes“ (e wird zu ie).
    form: tener, él = tiene ## Zu „él“ und „ella“ gehört „tiene“.
    form: tener, nosotros = tenemos ## Bei „nosotros“ bleibt das e: „tenemos“.
    form: tener, vosotros = tenéis ## Bei „vosotros“ bleibt das e: „tenéis“.
    form: tener, ellos = tienen ## Zu „ellos“ gehört „tienen“ (e wird zu ie).
    fill: Tengo ___ hermana. = una | un | el ## „hermana“ ist weiblich, also „una“.
    fill: Mi padre ___ un hermano. = tiene | tengo | tienes ## Zu „mi padre“ (er) gehört „tiene“.
    fact: Wie sagt man „deine Eltern“? = tus padres | tu padres | tus padre ## Mehrere Personen: „tus“ und „padres“ stehen im Plural.

    unit: Los números y la edad | Zahlen von 0 bis 10, Alter und Plural
    tip: Die Zahlen von null bis zehn: cero, uno, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez. Nur uno verändert sich: Vor einem Nomen heißt es un (un hermano) oder una (una hermana). Alle anderen Zahlen bleiben gleich: dos hermanos, tres amigas.
    tip: Das Alter sagst du mit tener, nicht mit ser. Wörtlich heißt es „Ich habe zehn Jahre“: Tengo diez años. Die Frage dazu lautet ¿Cuántos años tienes? Auch bei anderen Personen steht tener: Mi hermano tiene siete años.
    tip: Endet ein Nomen auf einen Vokal, hängst du im Plural ein -s an, und der Artikel wird zu los (männlich) oder las (weiblich): el amigo, los amigos; la amiga, las amigas; el año, los años. Nach einer Zahl ab dos steht immer der Plural: dos amigos, tres años.
    tip: Mit y („und“) verbindest du zwei Wörter: un amigo y una amiga. Beim Rechnen sagt man más für „plus“ und son für „sind“: Seis más cuatro son diez.
    known: Lucía, cuántos, hijos, amigos, amigas, más
    word: cero = null
    word: uno = eins | vor männlichem Nomen un, vor weiblichem una
    word: dos = zwei
    word: tres = drei
    word: cuatro = vier
    word: cinco = fünf
    word: seis = sechs
    word: siete = sieben
    word: ocho = acht
    word: nueve = neun
    word: diez = zehn
    word: el año = das Jahr | m · Pl. los años
    word: el amigo = der Freund | m · Pl. los amigos (auch gemischte Gruppen)
    word: la amiga = die Freundin | f · Pl. las amigas
    sentence: Tengo diez años. = Ich bin zehn Jahre alt.
    sentence: ¿Cuántos años tienes? = Wie alt bist du?
    sentence: Mi hermano tiene siete años. = Mein Bruder ist sieben Jahre alt.
    sentence: Mi amiga se llama Lucía. = Meine Freundin heißt Lucía.
    sentence: Tengo tres amigos y dos amigas. = Ich habe drei Freunde und zwei Freundinnen.
    sentence: Mis padres tienen dos hijos. = Meine Eltern haben zwei Kinder.
    sentence: Mi amigo no tiene hermanos. = Mein Freund hat keine Geschwister.
    sentence: Seis más cuatro son diez. = Sechs plus vier ist zehn.
    form: uno, vor männlichem Nomen = un ## Vor einem männlichen Nomen wird „uno“ zu „un“.
    form: uno, vor weiblichem Nomen = una ## Vor einem weiblichen Nomen wird „uno“ zu „una“.
    form: el amigo, Plural = los amigos ## Auf Vokal endet der Plural auf -s.
    form: la amiga, Plural = las amigas ## Auf Vokal endet der Plural auf -s.
    form: el año, Plural = los años ## Auf Vokal endet der Plural auf -s.
    fill: Tengo cinco ___. = años | año | hermana ## Nach einer Zahl ab zwei steht der Plural: „años“.
    fill: Mi hermana ___ siete años. = tiene | es | tengo ## Das Alter sagt man mit „tener“.
    fact: Welches Verb benutzt du, um dein Alter zu sagen? = tener | ser | llamarse ## Im Spanischen „hat“ man Jahre: tengo diez años.

    unit: En clase | Zahlen von 11 bis 20, Schulsachen und Plural
    tip: Die Zahlen von elf bis zwanzig: once, doce, trece, catorce, quince, dieciséis, diecisiete, dieciocho, diecinueve, veinte. Ab sechzehn sind sie zusammengesetzt: dieci- plus die Einerzahl. Bei dieciséis trägt das é den Akzent.
    tip: Der Plural der Nomen: Endet das Wort auf einen Vokal, kommt ein -s an: el libro, los libros; la mochila, las mochilas. Endet es auf einen Konsonanten, kommt -es an: el color, los colores. Endet es auf -z, wird das z zu c: el lápiz, los lápices.
    tip: Fragen nach der Menge richten sich nach dem Nomen: ¿Cuántos libros tienes? bei männlichen Nomen, ¿Cuántas mochilas tienes? bei weiblichen. Du antwortest mit der Zahl: Tengo cinco lápices en mi mochila.
    tip: Mit de zeigst du, wem etwas gehört: Es la mochila de Luis, „Das ist der Rucksack von Luis“. Die Frage ¿Qué es? heißt „Was ist das?“, die Antwort beginnt mit Es: Es un libro.
    known: en
    word: once = elf
    word: doce = zwölf
    word: trece = dreizehn
    word: catorce = vierzehn
    word: quince = fünfzehn
    word: dieciséis = sechzehn | mit Akzent auf dem é
    word: diecisiete = siebzehn
    word: dieciocho = achtzehn
    word: diecinueve = neunzehn
    word: veinte = zwanzig
    word: el libro = das Buch | m · Pl. los libros
    word: el cuaderno = das Heft | m · Pl. los cuadernos
    word: la mochila = der Rucksack | f · Pl. las mochilas
    word: el lápiz = der Bleistift | m · Pl. los lápices (z wird zu c)
    sentence: Tengo quince años. = Ich bin fünfzehn Jahre alt.
    sentence: Mi hermana tiene catorce años. = Meine Schwester ist vierzehn Jahre alt.
    sentence: Mi hermano tiene dieciocho años. = Mein Bruder ist achtzehn Jahre alt.
    sentence: Tengo tres cuadernos y dos libros. = Ich habe drei Hefte und zwei Bücher.
    sentence: ¿Cuántos libros tienes? = Wie viele Bücher hast du?
    sentence: Tengo cinco lápices en mi mochila. = Ich habe fünf Bleistifte in meinem Rucksack.
    sentence: Es la mochila de Luis. = Das ist der Rucksack von Luis.
    sentence: Once más nueve son veinte. = Elf plus neun ist zwanzig.
    form: el libro, Plural = los libros ## Auf Vokal endet der Plural auf -s.
    form: el cuaderno, Plural = los cuadernos ## Auf Vokal endet der Plural auf -s.
    form: la mochila, Plural = las mochilas ## Auf Vokal endet der Plural auf -s.
    form: el lápiz, Plural = los lápices ## Nach z wird im Plural c geschrieben: „lápices“.
    fill: Tengo tres ___. = lápices | lápiz | libro ## Nach einer Zahl ab zwei steht der Plural.
    fill: Cinco más ___ son diez. = cinco | cuatro | seis ## Fünf plus fünf ist zehn.
    fact: Wie bildest du den Plural von „el color“? = los colores | los colors | los color ## Nomen auf Konsonant bekommen im Plural -es.

    section: A1 · Alltag
    unit: Comida y bebida | Essen und Trinken, Artikel im Plural und gustar
    tip: Der bestimmte Artikel hat im Plural die Formen los (männlich) und las (weiblich): el café, los cafés; la manzana, las manzanas. Der unbestimmte Artikel heißt im Plural unos und unas und bedeutet „einige“: unos huevos, unas manzanas. Wörter auf Konsonant bekommen -es: el pan, los panes.
    tip: Mit gustar sagst du, was du magst. Wörtlich heißt me gusta el café „der Kaffee gefällt mir“. Deshalb richtet sich das Verb nach dem, was gefällt: ein Ding oder ein Infinitiv gibt gusta, mehrere Dinge geben gustan. Me gusta el café. Me gustan las manzanas. Me gusta comer.
    tip: Die Person steht davor: me (mir), te (dir), le (ihm, ihr). Verneint wird mit no vor me: No me gusta la leche. Nach gustar braucht das Nomen immer einen Artikel: Me gusta el queso, nicht Me gusta queso.
    tip: Zum Bestellen sagst du einfach, was du möchtest, und hängst por favor an: Un café, por favor. Das Wort agua ist weiblich, hat aber im Singular den Artikel el, weil es mit betontem a beginnt: el agua, aber las aguas.
    word: el pan = das Brot | m · Pl. los panes
    word: la leche = die Milch | f
    word: el café = der Kaffee | m · Pl. los cafés
    word: el agua = das Wasser | f, aber mit el: el agua · Pl. las aguas
    word: el zumo = der Saft | m · Pl. los zumos
    word: la manzana = der Apfel | f · Pl. las manzanas
    word: el queso = der Käse | m · Pl. los quesos
    word: el huevo = das Ei | m · Pl. los huevos
    word: el bocadillo = das belegte Brötchen | m · Pl. los bocadillos
    word: la comida = das Essen | f · Pl. las comidas
    word: comer = essen | Verb auf -er
    word: beber = trinken | Verb auf -er
    word: me gusta = ich mag; mir gefällt | von gustar
    word: por favor = bitte
    sentence: Me gusta el café. = Ich mag Kaffee.
    sentence: No me gusta la leche. = Ich mag keine Milch.
    sentence: Me gustan las manzanas. = Ich mag Äpfel.
    sentence: ¿Te gusta el queso? = Magst du Käse?
    sentence: Un café, por favor. = Einen Kaffee, bitte.
    sentence: Me gusta comer pan. = Ich esse gern Brot.
    sentence: Me gusta beber agua. = Ich trinke gern Wasser.
    form: gustar, a mí + Singular = me gusta ## Ein Ding: „me gusta“.
    form: gustar, a ti + Singular = te gusta ## Ein Ding: „te gusta“.
    form: gustar, a ella + Singular = le gusta ## Für „ihr“ und „ihm“ steht „le“.
    form: gustar, a mí + Plural = me gustan ## Mehrere Dinge: „me gustan“.
    form: gustar, a ti + Plural = te gustan ## Mehrere Dinge: „te gustan“.
    form: la manzana, Plural = las manzanas ## Auf Vokal endet der Plural auf -s.
    fill: Me ___ el queso. = gusta | gustan | gusto ## Ein Ding gibt „gusta“.
    fill: Me gustan ___ huevos. = los | las | el ## „huevo“ ist männlich und steht im Plural.
    fill: ¿Te ___ los huevos? = gustan | gusta | gustas ## Mehrere Dinge geben „gustan“.
    fact: Wonach richtet sich bei „gustar“ die Verbform? = nach dem, was gefällt | nach der Person, die etwas mag | gar nicht, sie bleibt immer gleich ## Die Äpfel gefallen mir: „gustan“ steht im Plural.

    unit: La ciudad | Die Stadt, estar, hay und Orte beschreiben
    tip: Mit estar sagst du, wo etwas oder jemand ist: estoy, estás, está, estamos, estáis, están. ¿Dónde está el parque? El parque está en la plaza. Der Akzent ist wichtig: está (er ist) ist nicht esta (diese). Mit ser sagst du, wer oder was etwas ist, mit estar, wo es ist: Soy de Madrid, aber estoy en Madrid.
    tip: Mit hay sagst du, dass es etwas gibt: Hay un parque en mi ciudad. Hay bleibt immer gleich, im Singular und im Plural: Hay un cine, hay dos cines. Nach hay steht nie der bestimmte Artikel, sondern un, una, eine Zahl oder gar nichts. Mit dem bestimmten Artikel nimmst du estar: El cine está en la calle Goya.
    tip: Ortsangaben: en (in, an, auf), cerca de (nahe bei), lejos de (weit weg von), al lado de (neben). Steht nach de der Artikel el, verschmelzen beide zu del: al lado del parque. Bei la, los und las bleibt de la, de los, de las: lejos de la plaza.
    tip: Städte und die meisten Länder haben keinen Artikel: Madrid está en España. Mit aquí („hier“) und ¿Hay … cerca de aquí? fragst du, ob es in der Nähe etwas gibt.
    known: Goya, Berlín, aquí, del
    word: la ciudad = die Stadt | f · Pl. las ciudades
    word: la calle = die Straße | f · Pl. las calles
    word: la plaza = der Platz | f · Pl. las plazas
    word: el parque = der Park | m · Pl. los parques
    word: el supermercado = der Supermarkt | m · Pl. los supermercados
    word: el cine = das Kino | m · Pl. los cines
    word: la casa = das Haus | f · Pl. las casas
    word: hay = es gibt | bleibt immer gleich
    word: estar = sich befinden; sein (Ort, Zustand) | unregelmäßig
    word: en = in; auf; an
    word: cerca de = nahe bei; in der Nähe von
    word: lejos de = weit weg von
    word: al lado de = neben
    sentence: Hay un parque en mi ciudad. = In meiner Stadt gibt es einen Park.
    sentence: ¿Dónde está el supermercado? = Wo ist der Supermarkt?
    sentence: El supermercado está al lado del parque. = Der Supermarkt ist neben dem Park.
    sentence: Mi casa está lejos de la plaza. = Mein Haus ist weit weg vom Platz.
    sentence: El cine está en la calle Goya. = Das Kino ist in der Goya-Straße.
    sentence: ¿Hay un cine cerca de aquí? = Gibt es hier in der Nähe ein Kino?
    sentence: Berlín está en Alemania. = Berlin liegt in Deutschland.
    sentence: Estamos en la plaza. = Wir sind auf dem Platz.
    form: estar, yo = estoy ## Zu „yo“ gehört „estoy“.
    form: estar, tú = estás ## Zu „tú“ gehört „estás“.
    form: estar, él = está ## Zu „él“ und „ella“ gehört „está“.
    form: estar, nosotros = estamos ## Zu „nosotros“ gehört „estamos“.
    form: estar, vosotros = estáis ## Zu „vosotros“ gehört „estáis“.
    form: estar, ellos = están ## Zu „ellos“ gehört „están“.
    fill: El parque ___ cerca de mi casa. = está | hay | es ## Mit dem bestimmten Artikel („el parque“) sagt man, wo etwas ist: „está“.
    fill: ___ dos cines en mi ciudad. = Hay | Están | Estamos ## Dass es etwas gibt, sagt man mit „hay“, auch bei mehreren Dingen.
    fact: Welches Verb sagt, wo etwas ist? = estar | ser | tener ## Der Ort steht bei „estar“: El parque está en la plaza.

    unit: Mi día | Mein Tag, regelmäßige Verben auf -ar, -er und -ir
    tip: Spanische Verben enden im Infinitiv auf -ar, -er oder -ir: hablar, comer, vivir. Im Präsens nimmst du den Stamm (habl-, com-, viv-) und hängst die Endung an. Verben auf -ar: -o, -as, -a, -amos, -áis, -an. Verben auf -er: -o, -es, -e, -emos, -éis, -en. Verben auf -ir: -o, -es, -e, -imos, -ís, -en.
    tip: Nur nosotros und vosotros unterscheiden sich bei -er und -ir. Alle anderen Endungen sind gleich. Beispiele: hablo, hablas, habla, hablamos, habláis, hablan; como, comes, come, comemos, coméis, comen; vivo, vives, vive, vivimos, vivís, viven.
    tip: Das Pronomen lässt du weg: Hablo español. Yo hablo español betont das Subjekt, etwa „ICH spreche Spanisch“. Sprachen stehen nach hablar ohne Artikel: Hablo español y alemán. Die Frage ¿Hablas inglés? beantwortest du mit Sí, hablo un poco oder No, no hablo inglés.
    tip: Die Tageszeiten sagst du mit por la mañana (morgens, am Vormittag), por la tarde (nachmittags) und por la noche (abends, nachts): Estudio español por la mañana.
    known: hablo, estudio, trabaja, leo, compro, inglés
    word: hablar = sprechen | Verb auf -ar
    word: estudiar = lernen; studieren | Verb auf -ar
    word: trabajar = arbeiten | Verb auf -ar
    word: comprar = kaufen | Verb auf -ar
    word: vivir = wohnen; leben | Verb auf -ir
    word: escribir = schreiben | Verb auf -ir
    word: leer = lesen | Verb auf -er
    word: el español = Spanisch | m, ohne Artikel nach hablar
    word: el alemán = Deutsch | m, ohne Artikel nach hablar
    word: por la mañana = morgens; am Vormittag
    word: por la tarde = nachmittags
    word: por la noche = abends; nachts
    sentence: Hablo español y alemán. = Ich spreche Spanisch und Deutsch.
    sentence: ¿Hablas inglés? = Sprichst du Englisch?
    sentence: Estudio español por la mañana. = Ich lerne morgens Spanisch.
    sentence: Mi madre trabaja por la tarde. = Meine Mutter arbeitet nachmittags.
    sentence: Leo un libro por la noche. = Ich lese abends ein Buch.
    sentence: Compro leche en el supermercado. = Ich kaufe Milch im Supermarkt.
    sentence: Vivimos en Madrid. = Wir wohnen in Madrid.
    form: hablar, tú = hablas ## Verben auf -ar: Endung -as bei „tú“.
    form: hablar, nosotros = hablamos ## Verben auf -ar: Endung -amos bei „nosotros“.
    form: hablar, ellos = hablan ## Verben auf -ar: Endung -an bei „ellos“.
    form: comer, yo = como ## Bei „yo“ endet jedes regelmäßige Verb auf -o.
    form: comer, vosotros = coméis ## Verben auf -er: Endung -éis bei „vosotros“.
    form: comer, ellos = comen ## Verben auf -er: Endung -en bei „ellos“.
    form: vivir, él = vive ## Verben auf -ir: Endung -e bei „él“.
    form: vivir, nosotros = vivimos ## Verben auf -ir: Endung -imos bei „nosotros“.
    fill: Yo ___ español. = hablo | hablas | habla ## Bei „yo“ endet das Verb auf -o.
    fill: Nosotros ___ en Madrid. = vivimos | viven | vive ## Zu „nosotros“ gehört bei -ir die Endung -imos.
    fact: Welche Endung haben Verben auf -ar bei „nosotros“? = -amos | -emos | -imos ## Hablar wird zu hablamos.

    section: A1 · Beschreiben und Zeit
    unit: Descripciones | Beschreiben, Adjektive und Farben
    tip: Adjektive stehen im Spanischen meistens nach dem Nomen und richten sich nach ihm in Geschlecht und Zahl. Bei Adjektiven auf -o gibt es vier Formen: un chico alto, una chica alta, unos chicos altos, unas chicas altas. Das Adjektiv ändert sich, das Nomen bestimmt, wie.
    tip: Adjektive auf -e oder auf Konsonant haben für männlich und weiblich nur eine Form und bekommen im Plural -s oder -es: un parque grande, una ciudad grande, dos parques grandes; un lápiz azul, dos lápices azules. Adjektive wie simpático verhalten sich wie alle auf -o: simpática, simpáticos, simpáticas, der Akzent bleibt.
    tip: Mit ser beschreibst du, wie jemand oder etwas ist: Mi hermana es alta. Los libros son nuevos. Mit muy („sehr“) verstärkst du das Adjektiv. Muy bleibt immer gleich, das Adjektiv richtet sich weiter nach dem Nomen: muy simpático, muy simpática. Die Frage lautet ¿Cómo es tu abuela?
    tip: Farben sind Adjektive und richten sich nach dem Nomen: una mochila roja, un lápiz negro, dos libros blancos. Bei azul und verde gibt es keine eigene weibliche Form: una mochila azul, un libro azul, dos mochilas verdes.
    known: nuevos, pequeña, roja
    word: el chico = der Junge | m · Pl. los chicos
    word: la chica = das Mädchen | f · Pl. las chicas
    word: grande = groß | für Dinge und Orte; Plural grandes
    word: pequeño = klein | pequeño, pequeña, pequeños, pequeñas
    word: alto = hoch; hochgewachsen | bei Personen: groß; alto, alta, altos, altas
    word: nuevo = neu | nuevo, nueva, nuevos, nuevas
    word: viejo = alt | viejo, vieja, viejos, viejas
    word: simpático = sympathisch; nett | simpático, simpática, simpáticos, simpáticas
    word: rojo = rot | rojo, roja, rojos, rojas
    word: azul = blau | Plural azules
    word: verde = grün | Plural verdes
    word: negro = schwarz | negro, negra, negros, negras
    word: blanco = weiß | blanco, blanca, blancos, blancas
    word: amarillo = gelb | amarillo, amarilla, amarillos, amarillas
    sentence: Mi hermana es alta. = Meine Schwester ist groß.
    sentence: El chico es alto y la chica es pequeña. = Der Junge ist groß und das Mädchen ist klein.
    sentence: Mi amigo es muy simpático. = Mein Freund ist sehr nett.
    sentence: Tengo una mochila roja. = Ich habe einen roten Rucksack.
    sentence: Tengo dos lápices azules. = Ich habe zwei blaue Bleistifte.
    sentence: Los libros son nuevos. = Die Bücher sind neu.
    sentence: ¿Cómo es tu abuela? = Wie ist deine Großmutter?
    form: alto, weiblich = alta ## Adjektive auf -o enden weiblich auf -a.
    form: alto, Plural = altos ## Männlicher Plural: -os.
    form: pequeño, weiblicher Plural = pequeñas ## Weiblicher Plural: -as.
    form: grande, Plural = grandes ## Adjektive auf -e bekommen im Plural nur ein -s.
    form: azul, Plural = azules ## Adjektive auf Konsonant bekommen im Plural -es.
    form: simpático, weiblich = simpática ## Adjektive auf -o enden weiblich auf -a, der Akzent bleibt.
    fill: Mi mochila es ___. = azul | azules | nuevos ## „mochila“ ist weiblich und Singular; „azul“ hat nur eine Form.
    fill: Los chicos son ___. = altos | alto | alta ## „chicos“ ist männlich und Plural: „altos“.
    fact: Wo steht das Adjektiv im Spanischen meistens? = nach dem Nomen | vor dem Nomen | vor dem Artikel ## Un chico alto, una mochila roja.

    unit: La hora y los días | Uhrzeit und Wochentage
    tip: Die Wochentage heißen lunes, martes, miércoles, jueves, viernes, sábado und domingo. Sie sind männlich und werden klein geschrieben. Mit dem Artikel el sagst du „am“: el lunes, „am Montag“. Mit los sagst du „montags“, „jeden Montag“: los lunes. Die Woche beginnt in Spanien am Montag.
    tip: Nach der Uhrzeit fragst du mit ¿Qué hora es? Um ein Uhr sagst du Es la una, sonst steht der Plural: Son las dos, son las tres, bis son las doce. Dazu kommen y cuarto (Viertel nach), y media (dreißig Minuten nach der vollen Stunde) und menos cuarto (Viertel vor): Son las dos y cuarto. Son las seis menos cuarto.
    tip: Achtung bei der halben Stunde: Im Spanischen zählst du von der vollen Stunde aus weiter. Son las tres y media heißt wörtlich „drei und halb“, also 3:30 Uhr, im Deutschen „halb vier“. Die Minuten hängst du mit y an: Son las ocho y diez.
    tip: Mit ¿A qué hora …? fragst du, wann etwas stattfindet. Die Antwort beginnt mit a las: Como a las dos. Mit hoy (heute) und mañana (morgen) sprichst du über Tage: Hoy es lunes. Mañana es martes. Ohne por la ist mañana „morgen“, mit por la mañana ist es „morgens“.
    known: a
    word: lunes = Montag | m
    word: martes = Dienstag | m
    word: miércoles = Mittwoch | m
    word: jueves = Donnerstag | m
    word: viernes = Freitag | m
    word: sábado = Samstag | m
    word: domingo = Sonntag | m
    word: el día = der Tag | m (trotz der Endung -a) · Pl. los días
    word: hoy = heute
    word: mañana = morgen | ohne „por la“
    word: la hora = die Uhrzeit; die Stunde | f · Pl. las horas
    word: la semana = die Woche | f · Pl. las semanas
    word: el fin de semana = das Wochenende | m
    word: la clase = der Unterricht; die Klasse | f · Pl. las clases
    sentence: ¿Qué hora es? = Wie spät ist es?
    sentence: Son las ocho. = Es ist acht Uhr.
    sentence: Hoy es lunes. = Heute ist Montag.
    sentence: ¿Qué día es hoy? = Welcher Tag ist heute?
    sentence: Mañana es martes. = Morgen ist Dienstag.
    sentence: El sábado no hay clase. = Am Samstag ist keine Schule.
    sentence: Estudio español el martes por la tarde. = Am Dienstagnachmittag lerne ich Spanisch.
    sentence: Como a las dos. = Ich esse um zwei Uhr.
    form: Uhrzeit auf Spanisch, 1:00 Uhr = Es la una. ## Um ein Uhr steht der Singular: „Es la una.“
    form: Uhrzeit auf Spanisch, 3:00 Uhr = Son las tres. ## Ab zwei Uhr steht der Plural: „Son las tres.“
    form: Uhrzeit auf Spanisch, 2:15 Uhr = Son las dos y cuarto. ## Viertel nach zwei: „y cuarto“.
    form: Uhrzeit auf Spanisch, 4:30 Uhr = Son las cuatro y media. ## Halb fünf ist 4:30 Uhr: „cuatro y media“.
    form: Uhrzeit auf Spanisch, 5:45 Uhr = Son las seis menos cuarto. ## Viertel vor sechs: „seis menos cuarto“.
    form: Uhrzeit auf Spanisch, 8:10 Uhr = Son las ocho y diez. ## Zehn nach acht: „ocho y diez“.
    fill: ___ las cuatro. = Son | Es | Está ## Ab zwei Uhr steht der Plural: „Son las cuatro.“
    fill: ___ la una y media. = Es | Son | Están ## Um ein Uhr steht der Singular: „Es la una y media.“
    fact: Welche Uhrzeit ist „Son las tres y media“? = 3:30 Uhr | 2:30 Uhr | 3:15 Uhr ## „y media“ zählt nach der vollen Stunde: drei Uhr dreißig.

    unit: Los meses y la fecha | Monate, Datum und Geburtstag
    tip: Die Monate heißen enero, febrero, marzo, abril, mayo, junio, julio, agosto, septiembre, octubre, noviembre und diciembre. Wie die Wochentage schreibt man sie klein und sie sind männlich. Mit en sagst du „im“: en mayo, „im Mai“.
    tip: Das Datum bildest du aus el, einer Grundzahl, de und dem Monat: el cinco de mayo, „der fünfte Mai“. Du benutzt also dieselben Zahlen wie beim Zählen, nicht die Ordnungszahlen. Für den ersten Tag sagt man el uno de enero oder el primero de enero.
    tip: Nach dem Datum fragst du mit ¿Qué fecha es hoy? Die Antwort lautet Hoy es el cinco de mayo. Nach dem Geburtstag fragst du mit ¿Cuándo es tu cumpleaños? Du antwortest Mi cumpleaños es el diez de enero oder einfach Mi cumpleaños es en mayo.
    tip: Das Wort cumpleaños ist männlich und im Singular und Plural gleich: un cumpleaños, dos cumpleaños. Es kommt von cumplir („erfüllen“) und años („Jahre“). Mit den Zahlen bis veinte kannst du schon alle Daten vom 1. bis zum 20. eines Monats sagen.
    known: cuándo, mes, meses
    word: enero = Januar | m, wird klein geschrieben
    word: febrero = Februar | m
    word: marzo = März | m
    word: abril = April | m
    word: mayo = Mai | m
    word: junio = Juni | m
    word: julio = Juli | m
    word: agosto = August | m
    word: septiembre = September | m
    word: octubre = Oktober | m
    word: noviembre = November | m
    word: diciembre = Dezember | m
    word: la fecha = das Datum | f · Pl. las fechas
    word: el cumpleaños = der Geburtstag | m, Plural los cumpleaños
    sentence: ¿Cuándo es tu cumpleaños? = Wann hast du Geburtstag?
    sentence: Mi cumpleaños es en mayo. = Mein Geburtstag ist im Mai.
    sentence: Mi cumpleaños es el diez de enero. = Mein Geburtstag ist am zehnten Januar.
    sentence: ¿Qué fecha es hoy? = Welches Datum ist heute?
    sentence: Hoy es el cinco de mayo. = Heute ist der fünfte Mai.
    sentence: El año tiene doce meses. = Das Jahr hat zwölf Monate.
    sentence: El cumpleaños de mi hermana es en julio. = Der Geburtstag meiner Schwester ist im Juli.
    form: Datum auf Spanisch, 5. Mai = el cinco de mayo ## Zuerst die Zahl, dann „de“ und der Monat.
    form: Datum auf Spanisch, 12. Oktober = el doce de octubre ## Zuerst die Zahl, dann „de“ und der Monat.
    form: Datum auf Spanisch, 1. Januar = el uno de enero; el primero de enero ## Für den ersten Tag sagt man „uno“ oder „primero“.
    form: Datum auf Spanisch, 20. Juni = el veinte de junio ## Zuerst die Zahl, dann „de“ und der Monat.
    fill: Mi cumpleaños es ___ junio. = en | de | el ## Mit einem Monat allein steht „en“: „en mayo“.
    fill: Hoy es el doce ___ octubre. = de | en | del ## Zwischen Tag und Monat steht „de“.
    fact: Wie schreibt man Wochentage und Monate im Spanischen? = klein: lunes, mayo | groß: Lunes, Mayo ## Im Spanischen sind beide kleingeschrieben, außer am Satzanfang.
    fact: Welche Zahlen benutzt man beim Datum? = Grundzahlen: el cinco de mayo | Ordnungszahlen: el quinto de mayo | Zahlen mit Punkt wie im Deutschen ## Das Datum nennt man mit den Grundzahlen; nur der erste Tag hat auch „primero“.
    """

    static let provider: any CourseProvider = LanguageCourseProvider.make(source: source).provider
}
