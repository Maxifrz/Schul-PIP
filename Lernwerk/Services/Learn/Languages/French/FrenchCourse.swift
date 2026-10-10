import Foundation

/// The French course for German speakers, level A1 (CEFR; DELF A1): eight units in the language engine's text format
/// (see LanguageDSL). The text is the content; a teacher can read and correct it without reading code. The course
/// contains no backslash, no triple quote and no interpolation, because Swift would read them.
enum FrenchCourse {
    static let source = """
    course: fr
    title: Französisch
    subtitle: Für Deutschsprachige · A1
    kind: language
    color: 5A7FC4
    symbol: text.bubble.fill
    speech: fr-FR
    instruction: de
    target-name: Französisch
    into-name: Französische

    section: A1 · Erste Schritte

    unit: Salutations et se présenter | Begrüßen, sich vorstellen, être
    tip: „Bonjour“ sagst du tagsüber zu jedem, auch zu Lehrern und Fremden. Erst am späten Nachmittag und abends sagst du „bonsoir“. „Salut“ ist locker und heißt unter Freunden „hallo“ und „tschüss“. Höflich verabschiedest du dich mit „au revoir“. Auf „Ça va ?“ (Wie geht's?) antwortest du zum Beispiel „Oui, ça va, merci.“
    tip: Die Personalpronomen: je (ich), tu (du), il (er), elle (sie), nous (wir), vous (ihr oder Sie), ils (sie, mehrere Jungen oder eine gemischte Gruppe) und elles (sie, nur Mädchen oder Frauen). Vor einem Vokal wird „je“ zu „j'“. „Tu“ sagst du zu Freunden, zur Familie und zu Kindern; „vous“ sagst du zu Erwachsenen, die du nicht gut kennst, zu Lehrern und zu mehreren Personen.
    tip: „Être“ (sein) ist unregelmäßig: je suis, tu es, il est, elle est, nous sommes, vous êtes, ils sont, elles sont. Mit „de“ sagst du, woher du kommst: „Je suis de Berlin.“ heißt „Ich komme aus Berlin.“ (wörtlich: Ich bin aus Berlin).
    tip: Mit „s'appeler“ (heißen) stellst du dich vor: je m'appelle Léa, tu t'appelles, il s'appelle. Wörtlich heißt das „ich nenne mich“. Du fragst „Comment tu t'appelles ?“ Eine Frage erkennst du auch ohne Fragewort an der steigenden Stimme: „Tu es de Paris ?“
    tip: Aussprache: Die Endbuchstaben -s, -t und -x sind meist stumm, „Paris“ klingt also wie „Pari“ und in „il est“ hörst du kein t. Vor einem Vokal werden Wörter verbunden (Liaison): In „vous êtes“ klingt das s von „vous“ wie ein weiches s [z]. Bei „nous sommes“ gibt es keine Liaison. Vor „?“ und „!“ steht im Französischen ein Leerzeichen. Den Apostroph tippst du ganz normal als '.
    known: Léa, Paul, Marie, Paris, Berlin, Munich, Lyon, comment, de, ils, elles
    word: bonjour = guten Tag; guten Morgen | tagsüber, bis zum späten Nachmittag
    word: je = ich | vor einem Vokal: j'
    word: salut = hallo; tschüss | unter Freunden und in der Familie
    word: tu = du | unter Freunden, in der Familie, unter Kindern
    word: ça va = wie geht's; es geht gut | wörtlich: das geht
    word: merci = danke
    word: être = sein | unregelmäßig: je suis, tu es, il est, nous sommes, vous êtes, ils sont
    word: oui = ja
    word: nous = wir
    word: vous = Sie (höflich); ihr | höfliche Anrede oder mehrere Personen
    word: il = er | Plural: ils
    word: elle = sie | Singular; Plural: elles
    word: au revoir = auf Wiedersehen
    sentence: Bonjour, je m'appelle Léa. = Guten Tag, ich heiße Léa.
    sentence: Comment tu t'appelles ? = Wie heißt du?
    sentence: Ça va, merci. = Gut, danke.; Es geht gut, danke.
    sentence: Je suis de Berlin. = Ich komme aus Berlin.
    sentence: Nous sommes de Munich. = Wir kommen aus München.
    sentence: Vous êtes de Paris ? = Kommen Sie aus Paris?; Kommt ihr aus Paris?
    form: s'appeler, je = m'appelle ## Zu „je“ gehört „m'appelle“: je m'appelle.
    form: s'appeler, tu = t'appelles ## Zu „tu“ gehört „t'appelles“, mit -s am Ende.
    form: être, je = suis ## Zu „je“ gehört „suis“: je suis.
    form: être, nous = sommes ## Zu „nous“ gehört „sommes“: nous sommes.
    form: être, il = est ## Zu „il“ und „elle“ gehört „est“: il est, elle est.
    fill: Salut ! Je ___ Marie. = m'appelle | t'appelles | s'appelle ## Zu „je“ gehört „m'appelle“.
    fill: Tu ___ Paul ? = t'appelles | m'appelle | s'appelle ## Zu „tu“ gehört „t'appelles“, mit -s am Ende.
    fill: Vous ___ de Lyon ? = êtes | est | sommes ## Zu „vous“ gehört „êtes“: vous êtes.
    fill: Elles ___ de Paris. = sont | est | êtes ## Zu „elles“ (und „ils“) gehört „sont“.
    fact: Was sagst du am Abend zur Begrüßung? = bonsoir | bonjour | salut ## Am späten Nachmittag und abends sagst du „bonsoir“.
    fact: Du sprichst mit deiner Lehrerin. Welches Pronomen passt? = vous | tu | elle ## Lehrer und fremde Erwachsene siezt du mit „vous“.

    unit: La famille | Familie, avoir, mon – ma – mes
    tip: „Avoir“ (haben) ist unregelmäßig: j'ai, tu as, il a, elle a, nous avons, vous avez, ils ont, elles ont. Vor „ai“ wird „je“ zu „j'“: „J'ai un frère.“ heißt „Ich habe einen Bruder.“ „Tu as une sœur ?“ heißt „Hast du eine Schwester?“
    tip: Jedes Nomen ist im Französischen männlich oder weiblich. Männlich ist „le“ (der) oder „un“ (ein), weiblich ist „la“ (die) oder „une“ (eine): le père, la mère, un frère, une sœur. Lerne jedes Nomen gleich mit seinem Artikel. Im Plural steht „les“: les parents. „Et“ heißt „und“: un fils et une fille.
    tip: Besitzwörter: mon père (männlich), ma mère (weiblich), mes parents (Plural). Genauso gehören ton, ta, tes zu „du“ und son, sa, ses zu „er“ oder „sie“. Das Besitzwort richtet sich nach dem Nomen, das folgt, nicht nach dem Besitzer: „son père“ kann „sein Vater“ oder „ihr Vater“ heißen, und „sa mère“ ist „seine“ oder „ihre Mutter“.
    tip: Aussprache: In „fils“ (Sohn) hörst du das s: [fis]. „Fille“ (Tochter) klingt ganz anders: [fij]. Bei „grand-père“ bleibt das d stumm. Vor einem Vokal verbindest du die Wörter: „vous avez“ [vuzave], „nous avons“ [nuzavõ], „ils ont“ [ilzõ]. Das „œ“ in „sœur“ tippst du als ein Zeichen: auf der iPhone-Tastatur hältst du das o gedrückt.
    known: Anne, et, un, une, s'appelle
    word: le frère = der Bruder | m
    word: la sœur = die Schwester | f
    word: mon, ma, mes = mein; meine | mon vor männlichen Nomen, ma vor weiblichen, mes im Plural
    word: avoir = haben | unregelmäßig: j'ai, tu as, il a, nous avons, vous avez, ils ont
    word: la mère = die Mutter | f
    word: le père = der Vater | m
    word: le fils = der Sohn | m
    word: la fille = die Tochter; das Mädchen | f
    word: son, sa, ses = seine; ihre | auch „sein“; son vor männlichen Nomen, sa vor weiblichen, ses im Plural
    word: les parents = die Eltern | Plural
    word: ton, ta, tes = dein; deine | ton vor männlichen Nomen, ta vor weiblichen, tes im Plural
    word: le grand-père = der Großvater | m
    word: la grand-mère = die Großmutter | f
    sentence: J'ai un frère. = Ich habe einen Bruder.
    sentence: Ma mère s'appelle Anne. = Meine Mutter heißt Anne.
    sentence: Tu as une sœur ? = Hast du eine Schwester?
    sentence: Mon père est de Berlin. = Mein Vater kommt aus Berlin.
    sentence: Mes parents ont un fils et une fille. = Meine Eltern haben einen Sohn und eine Tochter.
    sentence: Son frère est de Lyon. = Sein Bruder kommt aus Lyon.; Ihr Bruder kommt aus Lyon.
    sentence: Ton grand-père est de Munich ? = Kommt dein Großvater aus München?
    form: avoir, je = j'ai ## Vor „ai“ wird „je“ zu „j'“: j'ai.
    form: avoir, tu = as ## Zu „tu“ gehört „as“: tu as.
    form: avoir, il = a ## Zu „il“ und „elle“ gehört „a“: il a, elle a.
    form: avoir, nous = avons ## Zu „nous“ gehört „avons“: nous avons.
    form: avoir, vous = avez ## Zu „vous“ gehört „avez“: vous avez.
    fill: Ma sœur ___ Marie. = s'appelle | t'appelles | m'appelle ## Zu „ma sœur“ (sie) gehört „s'appelle“.
    fill: Elles ___ un frère. = ont | a | avez ## Zu „elles“ (und „ils“) gehört „ont“.
    fill: ___ parents sont de Paris. = Mes | Mon | Ma ## Vor einem Plural steht „mes“.
    fact: Wann benutzt du „ma“? = vor einem weiblichen Nomen im Singular | vor einem männlichen Nomen im Singular | vor einem Nomen im Plural ## „Ma“ steht vor weiblichen Nomen im Singular: ma mère, ma sœur.
    fact: Was bedeutet „son père“? = sein Vater oder ihr Vater | nur sein Vater | nur ihr Vater ## „Son“ richtet sich nach „père“, nicht nach dem Besitzer.

    unit: Nombres, âge et couleurs | Zahlen, Alter, Farben
    tip: Die Zahlen von 1 bis 10: un (une), deux, trois, quatre, cinq, six, sept, huit, neuf, dix. Dann: onze (11), douze (12), treize (13), quatorze (14), quinze (15), seize (16), dix-sept (17), dix-huit (18), dix-neuf (19), vingt (20). „Un“ steht vor männlichen, „une“ vor weiblichen Nomen.
    tip: Dein Alter sagst du mit „avoir“ (haben), nicht mit „être“: „J'ai douze ans.“ heißt wörtlich „Ich habe zwölf Jahre“. Du fragst „Tu as quel âge ?“ (Wie alt bist du?). Ein Satz wie „Je suis douze ans“ ist falsch. Ab zwei Jahren heißt es „ans“ (Plural), bei einem Jahr „un an“.
    tip: Die Farben stehen im Französischen nach dem Nomen: „un chat noir“ (eine schwarze Katze). Du kennst jetzt rouge (rot), bleu (blau), blanc (weiß) und noir (schwarz). Die französische Flagge heißt „le drapeau bleu, blanc, rouge“. Wie bei allen Adjektiven richtet sich die Farbe nach dem Nomen in Geschlecht und Zahl; das üben wir in der nächsten Einheit.
    tip: Aussprache: Vor einem Vokal wird oft ein stummer Endkonsonant gesprochen: „deux ans“ [døzɑ̃], „trois ans“ [trwazɑ̃], „six ans“ [sizɑ̃], „dix ans“ [dizɑ̃]. Bei „neuf ans“ wird das f zu einem v: [nœvɑ̃]. Das t von „huit“ hörst du fast immer: [ɥit]. „Cinq“ klingt [sɛ̃k], mit k am Ende.
    word: le chat = die Katze | m
    word: deux = zwei
    word: ans = Jahre | Plural; ein Jahr heißt „un an“
    word: trois = drei
    word: quel âge = wie alt | wörtlich: welches Alter
    word: quatre = vier
    word: bleu = blau
    word: blanc = weiß
    word: rouge = rot
    word: noir = schwarz
    word: cinq = fünf
    word: six = sechs
    word: sept = sieben
    word: huit = acht
    word: neuf = neun
    word: dix = zehn
    sentence: Mon chat a deux ans. = Meine Katze ist zwei Jahre alt.
    sentence: Tu as quel âge ? = Wie alt bist du?
    sentence: J'ai douze ans. = Ich bin zwölf Jahre alt.
    sentence: Mon chat est blanc et noir. = Meine Katze ist weiß und schwarz.
    sentence: Mon frère a quinze ans. = Mein Bruder ist fünfzehn Jahre alt.
    sentence: Ma sœur a huit ans. = Meine Schwester ist acht Jahre alt.
    form: Zahl in Worten, 11 = onze ## 11 heißt „onze“.
    form: Zahl in Worten, 12 = douze ## 12 heißt „douze“.
    form: Zahl in Worten, 15 = quinze ## 15 heißt „quinze“.
    form: Zahl in Worten, 20 = vingt ## 20 heißt „vingt“; das g und das t am Ende bleiben stumm.
    fill: Mon frère ___ douze ans. = a | est | ai ## Das Alter sagst du mit „avoir“: il a douze ans.
    fill: Trois, quatre, ___, six. = cinq | sept | huit ## Nach quatre kommt cinq.
    fact: Wie sagst du „Ich bin zwölf Jahre alt“? = J'ai douze ans. | Je suis douze ans. | Tu as douze ans. ## Das Alter sagst du mit „avoir“ und „ans“.
    fact: Welche Farben hat die französische Flagge? = bleu, blanc, rouge | noir, blanc, rouge | rouge, bleu, noir ## Die Trikolore ist blau, weiß, rot.

    unit: Articles, genre et pluriel | le, la, les, un, une, des
    tip: Im Französischen gibt es zwei Artikelgruppen. Der bestimmte Artikel heißt im Singular „le“ (männlich) und „la“ (weiblich), im Plural „les“: le livre, la table, les livres. Der unbestimmte Artikel heißt „un“ (männlich), „une“ (weiblich) und im Plural „des“: un livre, une table, des livres. Im Plural unterscheidet man nicht mehr zwischen männlich und weiblich.
    tip: Vor einem Vokal oder einem stummen h werden „le“ und „la“ zu „l'“: l'école, l'ami, l'amie. Man erkennt am Artikel dann nicht mehr, ob das Nomen männlich oder weiblich ist, deshalb lernst du das Geschlecht mit dem Wort: l'ami (m), l'amie (f). Bei „mon“, „ton“ und „son“ gilt dasselbe: Vor einem Vokal sagst du auch bei einem weiblichen Nomen „mon amie“, nicht „ma amie“.
    tip: Der Plural entsteht meist mit einem angehängten -s: un stylo, des stylos. Dieses -s hörst du nicht. Den Unterschied zwischen „le livre“ und „les livres“ hörst du nur am Artikel. Vor einem Vokal verbindet „les“ sich mit dem Nomen und das s klingt wie ein z: „les amis“ [lezami], „des amis“ [dezami].
    tip: Adjektive richten sich nach dem Nomen. Die weibliche Form bekommt meist ein -e: noir wird zu noire, bleu zu bleue. Bei „blanc“ wird sie zu „blanche“. Endet das Adjektiv schon auf -e, ändert sich nichts: un stylo rouge, une trousse rouge. Im Plural kommt ein -s dazu: des stylos noirs, des tables noires.
    tip: Mit „c'est“ sagst du, was etwas ist: „C'est un livre.“ (Das ist ein Buch.) Mit „voilà“ zeigst du etwas: „Voilà la table.“ (Da ist der Tisch.) Das Genus eines Nomens musst du mit dem Artikel lernen; es gibt wenige sichere Regeln, deshalb merkst du dir immer „le livre“ und „la table“, nie nur „livre“ und „table“.
    word: le livre = das Buch | m
    word: c'est = das ist | Plural: ce sont
    word: la table = der Tisch | f
    word: voilà = da ist; hier ist | zeigt etwas, das man sieht
    word: le stylo = der Kugelschreiber | m
    word: la chaise = der Stuhl | f
    word: la trousse = das Federmäppchen | f
    word: le cahier = das Heft | m
    word: l'ami = der Freund | m
    word: l'amie = die Freundin | f
    word: l'école = die Schule | f
    word: le sac = die Tasche | m
    sentence: C'est un livre. = Das ist ein Buch.
    sentence: Voilà la table. = Da ist der Tisch.
    sentence: Mon stylo est bleu. = Mein Kugelschreiber ist blau.
    sentence: La trousse de Léa est noire. = Léas Federmäppchen ist schwarz.
    sentence: J'ai des amis. = Ich habe Freunde.
    sentence: Voilà les livres de Paul. = Da sind Pauls Bücher.; Hier sind Pauls Bücher.
    sentence: L'amie de Léa s'appelle Marie. = Léas Freundin heißt Marie.
    form: Plural, le livre = les livres ## Der Plural bekommt ein -s und den Artikel „les“.
    form: weiblich, noir = noire ## Die weibliche Form bekommt ein -e: noire.
    form: Plural, la table = les tables ## Der Plural bekommt ein -s und den Artikel „les“.
    form: Plural, l'ami = les amis ## Aus „l'ami“ wird „les amis“ mit s-Liaison [z].
    form: weiblich, blanc = blanche ## Die weibliche Form von „blanc“ ist unregelmäßig: blanche.
    fill: C'est ___ table. = une | un | les ## „Table“ ist weiblich: une table.
    fill: J'ai ___ cahier. = un | une | des ## „Cahier“ ist männlich und steht im Singular: un cahier.
    fill: Voilà ___ stylos. = des | un | une ## „Stylos“ ist ein Plural: des stylos.
    fill: La table est ___. = blanche | blanc | blancs ## „Table“ ist weiblich und im Singular: blanche.
    fact: Wie heißt der bestimmte Artikel im Plural? = les | des | la ## „Les“ ist der bestimmte Artikel im Plural, „des“ der unbestimmte.
    fact: Du sagst „meine Freundin“. Wie heißt das? = mon amie | ma amie | mes amie ## Vor einem Vokal steht „mon“, auch bei einem weiblichen Nomen.

    section: A1 · Im Alltag

    unit: Les verbes en -er | parler, aimer, habiter
    tip: Die meisten Verben enden im Infinitiv auf -er. Sie werden alle gleich konjugiert: Du nimmst den Stamm (parl-) und hängst die Endungen an: je parle, tu parles, il parle, elle parle, nous parlons, vous parlez, ils parlent, elles parlent. So gehen auch aimer (mögen), habiter (wohnen), jouer (spielen), regarder (anschauen), écouter (zuhören) und travailler (arbeiten).
    tip: Aussprache: Die Endungen -e, -es und -ent hörst du nicht. „Je parle“, „tu parles“ und „ils parlent“ klingen gleich, nur „nous parlons“ und „vous parlez“ klingen anders. Vor einem Vokal oder einem stummen h wird „je“ zu „j'“: j'aime, j'habite. Bei „ils habitent“ verbindest du die Wörter: [ilzabit].
    tip: Die Sprache steht nach „parler“ ohne Artikel: „Je parle français.“ („Je parle bien français.“ mit „bien“ dazwischen.) Nach „aimer“ steht dagegen der Artikel: „J'aime le français.“ „Beaucoup“ (viel, sehr) und „bien“ (gut) stehen direkt hinter dem Verb: „J'aime beaucoup le français.“
    tip: Mit „à“ und einer Stadt sagst du, wo du wohnst oder arbeitest: „J'habite à Berlin.“ Das heißt „Ich wohne in Berlin.“ Eine Frage stellst du ganz einfach mit steigender Stimme: „Tu parles allemand ?“
    known: allemand, écoutons, travaillent, regarde
    word: parler = sprechen | Verb auf -er: je parle, tu parles, nous parlons, vous parlez, ils parlent
    word: le français = Französisch | m; die Sprache, ohne Artikel nach „parler“
    word: habiter = wohnen | Verb auf -er: j'habite, tu habites, nous habitons
    word: à = in (bei Städten); nach; zu | à Paris = in Paris
    word: l'allemand = Deutsch | m; die Sprache
    word: aimer = mögen; lieben | Verb auf -er: j'aime, tu aimes, nous aimons
    word: beaucoup = viel; sehr
    word: écouter = zuhören; anhören | Verb auf -er
    word: bien = gut | steht direkt hinter dem Verb
    word: travailler = arbeiten | Verb auf -er
    word: regarder = anschauen; ansehen | Verb auf -er
    word: jouer = spielen | Verb auf -er
    sentence: Je parle français. = Ich spreche Französisch.
    sentence: Tu parles français ? = Sprichst du Französisch?
    sentence: J'habite à Berlin. = Ich wohne in Berlin.
    sentence: J'aime beaucoup le français. = Ich mag Französisch sehr.; Ich liebe Französisch.
    sentence: Tu parles allemand ? = Sprichst du Deutsch?
    sentence: Nous écoutons Léa. = Wir hören Léa zu.
    sentence: Mes parents travaillent à Paris. = Meine Eltern arbeiten in Paris.
    sentence: Vous parlez bien français ! = Sie sprechen gut Französisch!; Ihr sprecht gut Französisch!
    form: parler, tu = parles ## Zu „tu“ gehört „parles“, mit -s am Ende.
    form: habiter, je = j'habite ## Vor dem stummen h wird „je“ zu „j'“: j'habite.
    form: aimer, je = j'aime ## Vor einem Vokal wird „je“ zu „j'“: j'aime.
    form: parler, nous = parlons ## Zu „nous“ gehört die Endung -ons: nous parlons.
    form: parler, ils = parlent ## Zu „ils“ und „elles“ gehört die Endung -ent: ils parlent.
    fill: Léa ___ français. = parle | parles | parlons ## Zu „elle“ gehört „parle“, ohne Endung -s.
    fill: Nous ___ à Lyon. = habitons | habitez | habitent ## Zu „nous“ gehört die Endung -ons: nous habitons.
    fill: Vous ___ allemand ? = parlez | parlons | parlent ## Zu „vous“ gehört die Endung -ez: vous parlez.
    fill: Mes amis ___ beaucoup. = jouent | joue | jouons ## Zu „mes amis“ (ils) gehört die Endung -ent: ils jouent.
    fact: Welche Endung hat ein Verb auf -er bei „je“? = -e | -s | -ons ## Je parle, j'habite, j'aime: Bei „je“ steht -e.

    unit: Manger et boire | Essen und Trinken, der Teilungsartikel
    tip: „Manger“ (essen) geht wie die anderen Verben auf -er; nur bei „nous“ steht ein e vor der Endung: nous mangeons. „Boire“ (trinken) ist unregelmäßig: je bois, tu bois, il boit, nous buvons, vous buvez, ils boivent. „Bois“ und „boit“ klingen gleich.
    tip: Wenn du von einer Menge sprichst, die man nicht zählt, brauchst du den Teilungsartikel: „du“ vor männlichen Nomen (du pain), „de la“ vor weiblichen (de la viande), „de l'“ vor einem Vokal (de l'eau) und „des“ im Plural (des pommes). Er heißt etwa „etwas, ein bisschen“, im Deutschen lässt man ihn meist weg: „Je mange du pain.“ heißt „Ich esse Brot.“
    tip: Nach „aimer“ steht der bestimmte Artikel, weil du die Sache allgemein meinst: „J'aime le café.“ (Ich mag Kaffee.) Wenn du eine einzelne Portion bestellst, sagst du „un café“, „une pomme“. Beim Bestellen sagst du höflich „Je voudrais du fromage, s'il vous plaît.“ Unter Freunden heißt es „s'il te plaît“.
    tip: Hunger und Durst „hat“ man im Französischen: „J'ai faim.“ (Ich habe Hunger.) und „J'ai soif.“ (Ich habe Durst.) Ein Satz mit „être“ wäre falsch. Aussprache: „pain“ klingt [pɛ̃], „eau“ klingt einfach [o] und „lait“ [lɛ], das t bleibt stumm.
    known: mangent
    word: manger = essen | Verb auf -er; nous mangeons
    word: le pain = das Brot | m
    word: la pomme = der Apfel | f
    word: le café = der Kaffee; das Café | m
    word: avoir faim = Hunger haben | mit „avoir“, nicht mit „être“
    word: boire = trinken | unregelmäßig: je bois, tu bois, il boit, nous buvons, vous buvez, ils boivent
    word: avoir soif = Durst haben | mit „avoir“, nicht mit „être“
    word: l'eau = das Wasser | f
    word: s'il vous plaît = bitte | höflich; unter Freunden: s'il te plaît
    word: je voudrais = ich möchte | höflich; von „vouloir“
    word: le fromage = der Käse | m
    word: le lait = die Milch | m
    word: la viande = das Fleisch | f
    sentence: Je mange du pain. = Ich esse Brot.
    sentence: Tu bois du café ? = Trinkst du Kaffee?
    sentence: J'ai faim. = Ich habe Hunger.
    sentence: J'ai soif ! Je bois de l'eau. = Ich habe Durst! Ich trinke Wasser.
    sentence: Un café, s'il vous plaît. = Einen Kaffee, bitte.
    sentence: Je voudrais de l'eau, s'il vous plaît. = Ich möchte Wasser, bitte.
    sentence: Mes parents mangent de la viande. = Meine Eltern essen Fleisch.
    form: Teilungsartikel, le pain = du pain ## Vor einem männlichen Nomen steht „du“: du pain.
    form: boire, je = bois ## Zu „je“ gehört „bois“.
    form: manger, nous = mangeons ## Bei „nous“ steht ein e vor der Endung: nous mangeons.
    form: Teilungsartikel, l'eau = de l'eau ## Vor einem Vokal steht „de l'“: de l'eau.
    form: boire, nous = buvons ## Zu „nous“ gehört „buvons“; der Stamm ändert sich.
    form: Teilungsartikel, la viande = de la viande ## Vor einem weiblichen Nomen steht „de la“: de la viande.
    fill: Léa ___ une pomme. = mange | manges | mangeons ## Zu „Léa“ (elle) gehört „mange“ ohne -s.
    fill: Il ___ de l'eau. = boit | bois | boivent ## Zu „il“ gehört „boit“.
    fill: Tu manges ___ viande ? = de la | du | des ## „Viande“ ist weiblich: de la viande.
    fact: Wie sagst du „Ich mag Kaffee“? = J'aime le café. | J'aime du café. | J'aime de café. ## Nach „aimer“ steht der bestimmte Artikel.

    unit: La ville | Stadt, aller, à + le = au
    tip: „Aller“ (gehen, fahren) ist unregelmäßig: je vais, tu vas, il va, elle va, nous allons, vous allez, ils vont, elles vont. Das Ziel schließt du mit „à“ an: „Je vais à la gare.“ Mit „aller“ und einem Infinitiv sagst du auch, was du gleich tust: „Je vais manger.“ (Ich werde gleich essen.)
    tip: Nach „à“ verschmilzt der Artikel „le“ zu „au“ und „les“ zu „aux“: à + le parc wird zu au parc, à + le cinéma wird zu au cinéma. „La“ und „l'“ bleiben: à la gare, à l'école. Mit „de“ ist es genauso: de + le wird zu du (à côté du parc), de + les wird zu des. Bei „la“ bleibt „de la“: à côté de la gare.
    tip: Orte beschreibst du mit Präpositionen: dans (in), sur (auf), sous (unter), devant (vor), derrière (hinter), à côté de (neben) und chez (bei, zu jemandem nach Hause). „Mon cahier est dans mon sac.“ heißt „Mein Heft ist in meiner Tasche.“ „Chez“ steht immer vor einer Person: chez Paul, chez moi.
    tip: Mit „il y a“ sagst du, was es gibt: „Il y a une boulangerie dans la rue.“ (In der Straße gibt es eine Bäckerei.) Das klingt wie ein Wort: [ilja]. Aussprache: „vais“ klingt [vɛ], „vont“ [vɔ̃], „gare“ [gaʁ] und „rue“ [ʁy], mit dem französischen r hinten im Rachen.
    word: aller = gehen; fahren | unregelmäßig: je vais, tu vas, il va, nous allons, vous allez, ils vont
    word: le cinéma = das Kino | m
    word: la gare = der Bahnhof | f
    word: le parc = der Park | m
    word: dans = in | drinnen: dans la ville
    word: chez = bei | auch: zu jemandem nach Hause; chez Paul, chez moi
    word: la poste = die Post | f
    word: la ville = die Stadt | f
    word: à côté de = neben | à côté du parc, à côté de la gare
    word: il y a = es gibt | Plural genauso: il y a des parcs
    word: la boulangerie = die Bäckerei | f
    word: la rue = die Straße | f
    word: la maison = das Haus | f
    sentence: Je vais à la gare. = Ich gehe zum Bahnhof.; Ich fahre zum Bahnhof.
    sentence: Je vais au parc. = Ich gehe in den Park.
    sentence: Mon cahier est dans mon sac. = Mein Heft ist in meiner Tasche.
    sentence: Nous allons au cinéma. = Wir gehen ins Kino.
    sentence: La poste est à côté de la gare. = Die Post ist neben dem Bahnhof.
    sentence: Mes amis vont chez Léa. = Meine Freunde gehen zu Léa.
    sentence: Il y a une boulangerie dans la rue. = In der Straße gibt es eine Bäckerei.
    form: aller, je = vais ## Zu „je“ gehört „vais“: je vais.
    form: à + Artikel, le parc = au parc ## À + le wird zu „au“: au parc.
    form: aller, nous = allons ## Zu „nous“ gehört „allons“: nous allons.
    form: aller, ils = vont ## Zu „ils“ und „elles“ gehört „vont“.
    form: à + Artikel, la gare = à la gare ## Vor „la“ bleibt „à la“ unverändert.
    fill: Je vais ___ cinéma. = au | à la | aux ## „Cinéma“ ist männlich im Singular: à + le wird zu „au“.
    fill: Tu ___ à la poste ? = vas | vais | va ## Zu „tu“ gehört „vas“: tu vas.
    fill: Je vais ___ Paul. = chez | à | dans ## Vor einer Person steht „chez“.
    fact: Was wird aus „à + les“? = aux | au | à les ## À + les wird zu „aux“.
    fact: Wie sagst du „neben dem Park“? = à côté du parc | à côté de le parc | à côté de la parc ## De + le wird zu „du“.

    unit: La négation, l'heure et les questions | Verneinen, Uhrzeit, Fragen
    tip: Die Verneinung besteht aus zwei Teilen, die das konjugierte Verb umschließen: „ne … pas“. „Je parle allemand.“ wird zu „Je ne parle pas allemand.“ Vor einem Vokal wird „ne“ zu „n'“: „Je n'aime pas le café.“ Nach der Verneinung werden „un“, „une“, „du“, „de la“ und „des“ zu „de“: „Léa a un frère.“ wird zu „Léa n'a pas de frère.“ und „Je mange de la viande.“ wird zu „Je ne mange pas de viande.“
    tip: Fragen stellst du auf drei Arten. Am einfachsten sprichst du den Satz mit steigender Stimme: „Tu parles français ?“ Oder du setzt „est-ce que“ davor: „Est-ce que tu parles français ?“ Mit einem Fragewort fragst du nach Einzelheiten: „Où est la gare ?“ oder „Comment s'appelle ta sœur ?“ Die dritte Art, die Umstellung („Parles-tu français ?“), erkennst du in Texten, musst sie aber noch nicht selbst bilden.
    tip: Die wichtigsten Fragewörter: comment (wie), où (wo), qui (wer), quand (wann), pourquoi (warum), combien (wie viel) und quel oder quelle (welcher, welche). „Quel“ richtet sich nach dem Nomen: quel âge (männlich), quelle heure (weiblich). Auf „pourquoi ?“ antwortest du mit „parce que“ (weil): „Pourquoi ? – Parce que j'ai faim.“
    tip: Die Uhrzeit: „Quelle heure est-il ?“ heißt „Wie spät ist es?“ Du antwortest „Il est huit heures.“ oder „Il est midi.“ Dazu kommen „et quart“ (Viertel nach), „et demie“ (30 Minuten nach der vollen Stunde) und „moins le quart“ (Viertel vor). Achtung: „Il est trois heures et demie.“ ist 3:30 Uhr, im Deutschen „halb vier“, denn man zählt von der vollen Stunde aus weiter.
    tip: Aussprache: „Heure“ klingt [œʁ] und das h bleibt stumm. Vor einem Vokal verbindest du die Zahl mit „heures“: „deux heures“ [døzœʁ], „trois heures“ [trwazœʁ]. „Quart“ klingt [kaʁ] ohne t, und „où“ klingt wie ein deutsches u. In „est-ce que“ sprichst du das e am Ende nur ganz kurz: [ɛskə].
    known: non, est-il, heures
    word: ne … pas = nicht; kein | umschließt das Verb: je ne parle pas
    word: comment = wie | Fragewort
    word: où = wo | Fragewort
    word: qui = wer | Fragewort
    word: quand = wann | Fragewort
    word: pourquoi = warum | Antwort: parce que
    word: parce que = weil | vor einem Vokal: parce qu'
    word: combien = wie viel; wie viele | Fragewort
    word: quelle heure = wie spät | wörtlich: welche Stunde
    word: et demie = und eine halbe Stunde | trois heures et demie = 3:30 Uhr
    word: midi = zwölf Uhr mittags | m
    word: et quart = Viertel nach | il est midi et quart
    word: moins le quart = Viertel vor | il est huit heures moins le quart
    sentence: Non, je ne mange pas de viande. = Nein, ich esse kein Fleisch.
    sentence: Léa n'aime pas le lait. = Léa mag keine Milch.; Léa mag die Milch nicht.
    sentence: Est-ce que tu parles français ? = Sprichst du Französisch?
    sentence: Où est la gare ? = Wo ist der Bahnhof?
    sentence: Comment s'appelle ta sœur ? = Wie heißt deine Schwester?
    sentence: Quelle heure est-il ? = Wie spät ist es?
    sentence: Il est midi et quart. = Es ist Viertel nach zwölf.
    sentence: Il est huit heures moins le quart. = Es ist Viertel vor acht.
    form: verneinen, j'aime le café = je n'aime pas le café ## Vor einem Vokal wird „ne“ zu „n'“.
    form: Frage mit est-ce que, tu as un frère = est-ce que tu as un frère ## „Est-ce que“ steht vor dem unveränderten Satz.
    form: verneinen, Léa a un frère = Léa n'a pas de frère ## Nach „ne … pas“ wird „un“ zu „de“.
    form: Frage mit est-ce que, vous parlez allemand = est-ce que vous parlez allemand ## „Est-ce que“ steht vor dem unveränderten Satz.
    form: verneinen, je parle allemand = je ne parle pas allemand ## „Ne“ steht vor dem Verb, „pas“ dahinter.
    fill: ___ tu t'appelles ? = Comment | Où | Qui ## Nach dem Namen fragt man mit „comment“.
    fill: Je ne mange pas ___ viande. = de | du | de la ## Nach „ne … pas“ steht „de“.
    fact: Wo steht „ne … pas“ im Satz? = um das konjugierte Verb herum | vor dem Subjekt | am Ende des Satzes ## Je ne parle pas: „ne“ steht vor dem Verb, „pas“ danach.
    fact: Welche Uhrzeit ist „trois heures et demie“? = 3:30 Uhr | 4:30 Uhr | 2:30 Uhr ## Im Französischen zählt man von der vollen Stunde aus weiter: 3:30 Uhr, im Deutschen „halb vier“.
    """

    static let provider: any CourseProvider = LanguageCourseProvider.make(source: source).provider
}
