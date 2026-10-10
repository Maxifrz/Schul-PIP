import Foundation

/// German as a foreign language for speakers of English, level A1 (CEFR; Goethe-Zertifikat Start Deutsch 1): eight units
/// in the language engine's text format (see LanguageDSL). Prompts, tips and glosses are English, the words and
/// sentences German. The text is the content; a teacher can read and correct it without reading code. The course
/// contains no backslash, no triple quote and no interpolation, because Swift would read them.
enum GermanForeignCourse {
    static let source = """
    course: daf
    title: Deutsch als Fremdsprache
    subtitle: German for English speakers · A1
    kind: language
    color: B8A04A
    symbol: textformat
    speech: de-DE
    instruction: en
    target-name: German
    into-name: German
    known-name: English

    section: A1 · Getting started

    unit: Hello and goodbye | Greetings, introducing yourself, sein
    tip: “Hallo” works with everyone at any time. To be a little more polite, greet by the time of day: “Guten Morgen” in the morning, “Guten Tag” during the day and “Guten Abend” in the evening. “Gute Nacht” is only for saying goodnight before bed. To say goodbye use “Tschüss” with friends and “Auf Wiedersehen” in formal situations. With “Herr” (Mr) or “Frau” (Mrs, Ms) and a surname you sound polite: “Guten Tag, Frau Weber.”
    tip: German has two words for “you”. Say “du” to friends, family, children and young people, and “Sie” (always with a capital S) to adults you do not know well, to teachers and in shops. “Sie” takes the same verb form as “sie” (they): “Wie heißt du?” but “Wie heißen Sie?” The small word “sie” means “she” or “they”.
    tip: The verb “sein” (to be) is irregular: ich bin, du bist, er ist, sie ist, wir sind, ihr seid, sie sind. You can say your name with “Ich bin Anna.” or with “Ich heiße Anna.” (I am called Anna). The ending of the verb changes with the person: ich heiße, du heißt, er heißt.
    tip: “Wie geht's?” (How are you?) is answered with “Gut, danke.” German has four letters English does not: ä, ö, ü and ß. On a phone keyboard, hold down the a, o, u or s key to find them. The ß is a sharp “ss” sound, as in “heißen” and “Straße”. All nouns are written with a capital letter.
    known: Anna, Max, Frau, Herr, Weber, Müller, Morgen, geht's
    word: hallo = hello; hi
    word: guten Tag = good day; hello (formal)
    word: tschüss = bye
    word: auf Wiedersehen = goodbye
    word: danke = thank you; thanks
    word: ich = I
    word: du = you (informal)
    word: er = he
    word: sie = she; they | the capital Sie is the formal you
    word: wie = how
    word: gut = good; well
    word: sein = to be | forms: ich bin, du bist, er ist, wir sind, ihr seid, sie sind
    word: heißen = to be called | forms: ich heiße, du heißt, er heißt, wir heißen, ihr heißt, sie heißen
    sentence: Hallo, ich bin Anna. = Hello, I am Anna.; Hello, I'm Anna.
    sentence: Guten Tag, Frau Weber. = Good day, Mrs Weber.; Hello, Mrs Weber.
    sentence: Guten Morgen, Herr Müller. = Good morning, Mr Müller.
    sentence: Wie heißt du? = What is your name?; What are you called?
    sentence: Ich heiße Max. = My name is Max.; I am called Max.
    sentence: Wie geht's? = How are you?; How is it going?
    sentence: Gut, danke. = Fine, thank you.; Fine, thanks.; Good, thanks.
    sentence: Wie heißen Sie? = What is your name? (formal)
    form: sein, ich = bin ## “Ich” goes with “bin”: ich bin.
    form: sein, du = bist ## “Du” goes with “bist”: du bist.
    form: sein, er = ist ## “Er” goes with “ist”: er ist; “sie ist” (she is) is the same.
    form: heißen, ich = heiße ## The ending for “ich” is -e: ich heiße.
    form: heißen, du = heißt ## After the s-sound ß the ending for “du” is only -t: du heißt.
    fill: Das ist Anna. ___ heißt Anna. = Sie | Er | Ich ## Anna is a girl, so “sie” (she) is right.
    fill: Wie ___ Sie? = heißen | heißt | heiße ## “Sie” takes the same verb form as “wir” and “sie” (they): heißen.
    fact: It is seven in the evening and you meet a neighbour. What do you say? = Guten Abend | Guten Morgen | Gute Nacht ## In the evening you say “Guten Abend”; “Gute Nacht” is for going to bed.
    fact: You talk to your teacher, Frau Weber. Which word for “you” do you use? = Sie | du | ihr ## Teachers and adults you do not know well are addressed with the formal “Sie”.

    unit: Numbers, age and the alphabet | Counting to twenty, saying your age, the letters
    tip: The numbers from zero to ten: null, eins, zwei, drei, vier, fünf, sechs, sieben, acht, neun, zehn. Then learn two special ones: elf (11) and zwölf (12). “Eins” is the form for counting; before a noun it becomes “ein” or “eine”: “ein Buch”, “eine Tasche”.
    tip: The numbers from 13 to 19 are the unit plus “zehn”: dreizehn (3 + 10), vierzehn, fünfzehn, achtzehn, neunzehn. Two of them lose letters: sechzehn (not sechszehn) and siebzehn (not siebenzehn). Twenty is zwanzig; tens end in -zig.
    tip: You say your age with “sein”, just as in English: “Ich bin zwanzig Jahre alt.” (I am twenty years old) or only “Ich bin zwanzig.” You ask “Wie alt bist du?” and, about another person, “Wie alt ist er?” “Ja” means yes and “nein” means no: “Bist du zwölf?” – “Nein, ich bin dreizehn.”
    tip: The German alphabet has the 26 letters you know, plus the umlauts ä, ö, ü and the letter ß (Eszett). Some letters sound different from English: W sounds like English V (“weh”), V sounds like F (“fau”), J sounds like English Y (“jot”) and Z sounds like “ts” (“zett”). When you spell a name aloud you use these letter names: Weber is “weh, eh, beh, eh, err”.
    known: Jahre
    word: null = zero
    word: eins = one | before a noun: ein or eine
    word: zwei = two
    word: drei = three
    word: vier = four
    word: fünf = five
    word: sechs = six
    word: sieben = seven
    word: acht = eight
    word: neun = nine
    word: zehn = ten
    word: alt = old
    word: ja = yes
    word: nein = no
    sentence: Wie alt bist du? = How old are you?
    sentence: Ich bin zwanzig Jahre alt. = I am twenty years old.
    sentence: Bist du zwölf? = Are you twelve?
    sentence: Nein, ich bin dreizehn. = No, I am thirteen.
    sentence: Er ist sechzehn. = He is sixteen.
    sentence: Sie ist siebzehn Jahre alt. = She is seventeen years old.
    form: in words, 11 = elf ## Eleven is special: elf.
    form: in words, 12 = zwölf ## Twelve is special: zwölf.
    form: in words, 13 = dreizehn ## Thirteen is drei + zehn.
    form: in words, 16 = sechzehn ## The s of sechs is dropped: sechzehn.
    form: in words, 17 = siebzehn ## The -en of sieben is dropped: siebzehn.
    form: in words, 20 = zwanzig ## Tens end in -zig: zwanzig.
    fill: Fünf plus drei ist ___. = acht | sieben | sechs ## Five plus three is eight: acht.
    fill: Sie ___ siebzehn Jahre alt. = ist | bin | bist ## “Sie” (she) goes with “ist”.
    fact: Which letters are the German umlauts? = ä, ö, ü | ä, é, ü | å, ö, ü ## The umlauts are ä, ö and ü.
    fact: What is the letter ß called? = Eszett | Beta | Zett ## The ß is called Eszett; it sounds like a sharp “ss”.

    unit: Family | Family members, haben, mein and dein
    tip: The family words: der Vater, die Mutter, die Eltern (parents), der Bruder, die Schwester, die Geschwister (brothers and sisters), der Großvater, die Großmutter. “Eltern” and “Geschwister” exist only in the plural: “Meine Eltern heißen Peter und Julia.” Always learn a noun with its article, because the gender cannot be guessed.
    tip: The verb “haben” (to have) is irregular: ich habe, du hast, er hat, wir haben, ihr habt, sie haben. “Ich habe eine Schwester.” means I have a sister. In a yes/no question the verb comes first: “Hast du Geschwister?” – “Ja, ich habe einen Bruder.” For now learn “eine Schwester” and “einen Bruder” as they are; the next units explain them.
    tip: “Mein” (my) and “dein” (your, to a friend) change their endings like “ein”. With masculine and neuter nouns there is no ending: mein Vater, dein Bruder. With feminine nouns and with plurals they get -e: meine Mutter, deine Schwester, meine Eltern. To someone you call “Sie” you say “Ihr” and “Ihre”: Ihr Name, Ihre Familie.
    tip: In a question with a question word the verb is second: “Wie heißt deine Schwester?” The word “und” joins two nouns or sentences: “Mein Vater und meine Mutter heißen Peter und Julia.”
    known: Peter, Julia, das, eine, einen
    word: die Familie = family | pl. die Familien
    word: der Vater = father | pl. die Väter
    word: die Mutter = mother | pl. die Mütter
    word: der Bruder = brother | pl. die Brüder
    word: die Schwester = sister | pl. die Schwestern
    word: die Eltern = parents | plural only
    word: die Geschwister = siblings | plural only
    word: der Großvater = grandfather | pl. die Großväter
    word: die Großmutter = grandmother | pl. die Großmütter
    word: mein = my | feminine and plural: meine
    word: dein = your (informal) | feminine and plural: deine
    word: haben = to have | forms: ich habe, du hast, er hat, wir haben, ihr habt, sie haben
    word: und = and
    sentence: Das ist meine Familie. = This is my family.
    sentence: Mein Vater heißt Peter. = My father is called Peter.; My father's name is Peter.
    sentence: Meine Eltern heißen Peter und Julia. = My parents are called Peter and Julia.
    sentence: Wie heißt deine Schwester? = What is your sister called?; What is your sister's name?
    sentence: Hast du Geschwister? = Do you have siblings?
    sentence: Ja, ich habe eine Schwester. = Yes, I have a sister.
    sentence: Ich habe einen Bruder und eine Schwester. = I have a brother and a sister.
    sentence: Mein Großvater hat drei Geschwister. = My grandfather has three siblings.
    form: haben, ich = habe ## “Ich” goes with “habe”: ich habe.
    form: haben, du = hast ## “Du” goes with “hast”: du hast.
    form: haben, er = hat ## “Er” and “sie” (she) go with “hat”: er hat, sie hat.
    form: mein, die Mutter = meine Mutter ## Feminine nouns take -e: meine Mutter.
    form: mein, die Eltern = meine Eltern ## Plural nouns take -e too: meine Eltern.
    form: dein, die Schwester = deine Schwester ## Feminine nouns take -e: deine Schwester.
    fill: Ich ___ eine Schwester. = habe | hast | hat ## “Ich” goes with “habe”.
    fill: ___ Mutter heißt Julia. = Meine | Mein | Meinen ## “Mutter” is feminine, so “meine”.
    fact: Frau Weber is your teacher. How do you say “your name” to her? = Ihr Name | dein Name | mein Name ## To a person you call “Sie” you say “Ihr”, with a capital letter.

    unit: Articles and plural | der, die, das, ein, eine, kein
    tip: Every German noun has one of three genders: masculine (der), feminine (die) or neuter (das). The gender is not logical and has nothing to do with meaning, so you must learn each noun with its article: der Tisch, die Tasche, das Buch. In the plural all nouns take “die”: die Tische, die Taschen, die Bücher.
    tip: All nouns are written with a capital letter, wherever they stand in the sentence: “Das Buch ist hier.” Adjectives and verbs are not capitalised. This helps you to spot the nouns in a German text.
    tip: “Ein” (a, an) is the indefinite article: ein Tisch, ein Buch, eine Tasche. Feminine nouns take “eine”. To say “not a” or “no” before a noun use “kein”, which has the same endings: kein Tisch, kein Buch, keine Tasche. In the plural it is “keine”: keine Bücher. There is no plural of “ein”.
    tip: There is no single rule for the plural, so learn it with the noun. The common patterns are: -e (Tisch, Tische), umlaut + -e (Stuhl, Stühle), -n (Tasche, Taschen), umlaut + -er (Buch, Bücher) and -s (Handy, Handys). To point at one thing say “Das ist ein Buch.” and at several things “Das sind zwei Bücher.”
    known: sind
    word: der = the (masculine) | masculine nouns: der Tisch
    word: die = the (feminine, plural) | feminine nouns and all plurals: die Tasche, die Tische
    word: das = the (neuter) | neuter nouns: das Buch
    word: ein = a; an | feminine: eine
    word: kein = not a; not any | feminine and plural: keine
    word: das Buch = book | pl. die Bücher
    word: der Tisch = table | pl. die Tische
    word: die Tasche = bag | pl. die Taschen
    word: der Stuhl = chair | pl. die Stühle
    word: das Heft = notebook | pl. die Hefte
    word: das Handy = mobile phone; cell phone | pl. die Handys
    word: hier = here
    sentence: Das ist ein Buch. = This is a book.
    sentence: Das ist eine Tasche. = This is a bag.
    sentence: Das ist kein Heft. = This is not a notebook.
    sentence: Das ist keine Tasche. = This is not a bag.
    sentence: Hier ist mein Handy. = Here is my mobile phone.; Here is my cell phone.
    sentence: Hier sind die Bücher. = Here are the books.
    sentence: Das sind zwei Stühle. = These are two chairs.; Those are two chairs.
    sentence: Ich habe kein Buch. = I do not have a book.; I have no book.
    form: Plural, das Buch = die Bücher ## Umlaut + -er: das Buch, die Bücher.
    form: Plural, der Tisch = die Tische ## This noun adds -e: der Tisch, die Tische.
    form: Plural, der Stuhl = die Stühle ## Umlaut + -e: der Stuhl, die Stühle.
    form: Plural, die Tasche = die Taschen ## This noun adds -n: die Tasche, die Taschen.
    form: ein, das Heft = ein Heft ## Neuter nouns take “ein” without an ending.
    form: kein, die Tasche = keine Tasche ## Feminine nouns take -e: keine Tasche.
    fill: Das ist ___ Tasche. = eine | ein | kein ## “Tasche” is feminine, so “eine”.
    fill: ___ Buch ist hier. = Das | Der | Die ## “Buch” is neuter, so “das”.
    fact: Which article do all plural nouns take? = die | der | das ## In the plural every noun takes “die”.
    fact: How should you learn a new German noun? = With its article | Without its article | Only by its meaning ## The gender cannot be guessed, so learn der, die or das together with the noun.

    section: A1 · Everyday life

    unit: Food and drink | Ordering, accusative, möchten
    tip: To order or to say what you would like, use “möchten”: ich möchte, du möchtest, er möchte, wir möchten, ihr möchtet, sie möchten. “Ich möchte einen Kaffee, bitte.” is polite and very useful. In a café you are asked: “Was möchten Sie?” With a friend: “Möchtest du ein Ei?”
    tip: What you eat, drink or want is the object of the verb and stands in the accusative. Only masculine nouns change: der becomes den, ein becomes einen and kein becomes keinen. Feminine, neuter and plural nouns stay the same: “Ich esse einen Apfel.” but “Ich trinke eine Milch.” and “Ich esse ein Ei.”
    tip: Compare the subject with the object: “Der Kaffee ist gut.” (subject, der) but “Ich trinke den Kaffee.” (object, den). “Ich esse keinen Käse.” means I do not eat cheese. For food and drink in general you often use no article at all: “Ich trinke Wasser.”, “Ich möchte Brot und Wasser.”
    tip: The verb “essen” changes its vowel in the du and er forms: ich esse, du isst, er isst, wir essen, ihr esst, sie essen. “Trinken” is regular: ich trinke, du trinkst, er trinkt. Notice that the verb in a statement always comes second: “Du isst einen Apfel.”
    known: esse, trinke
    word: bitte = please; you're welcome
    word: möchten = would like | forms: ich möchte, du möchtest, er möchte, wir möchten, ihr möchtet, sie möchten
    word: essen = to eat | forms: ich esse, du isst, er isst, wir essen, ihr esst, sie essen
    word: trinken = to drink | forms: ich trinke, du trinkst, er trinkt, wir trinken, ihr trinkt, sie trinken
    word: das Brot = bread | pl. die Brote
    word: das Wasser = water | no plural
    word: die Milch = milk | no plural
    word: der Kaffee = coffee | pl. die Kaffees
    word: der Apfel = apple | pl. die Äpfel
    word: der Käse = cheese | no plural
    word: das Ei = egg | pl. die Eier
    word: was = what
    sentence: Ich möchte einen Kaffee, bitte. = I would like a coffee, please.
    sentence: Was möchten Sie? = What would you like?
    sentence: Ich möchte Brot und Wasser, bitte. = I would like bread and water, please.
    sentence: Du isst einen Apfel. = You are eating an apple.; You eat an apple.
    sentence: Er trinkt Milch. = He drinks milk.; He is drinking milk.
    sentence: Ich trinke Wasser. = I drink water.; I am drinking water.
    sentence: Ich esse keinen Käse. = I do not eat cheese.
    sentence: Möchtest du ein Ei? = Would you like an egg?
    form: möchten, ich = möchte ## “Ich” goes with “möchte”: ich möchte.
    form: möchten, du = möchtest ## “Du” goes with “möchtest”: du möchtest.
    form: essen, du = isst ## “Essen” changes e to i: du isst.
    form: trinken, er = trinkt ## The ending for “er” is -t: er trinkt.
    form: accusative, der Kaffee = den Kaffee ## Masculine “der” becomes “den” in the accusative.
    form: accusative, ein Apfel = einen Apfel ## Masculine “ein” becomes “einen” in the accusative.
    form: accusative, kein Käse = keinen Käse ## Masculine “kein” becomes “keinen” in the accusative.
    fill: Ich möchte ___ Kaffee. = einen | ein | eine ## “Kaffee” is masculine, so the accusative “einen”.
    fill: Du ___ einen Apfel. = isst | esse | essen ## “Du” goes with “isst”.
    fact: Which nouns change their article in the accusative? = Only masculine nouns | Only feminine nouns | Only neuter nouns ## Only masculine nouns change: der to den, ein to einen.

    unit: My day | Regular verbs, word order
    tip: Most verbs are regular. Take the infinitive (kommen), remove -en to get the stem (komm-) and add the endings: ich -e, du -st, er/sie -t, wir -en, ihr -t, sie/Sie -en. So: ich komme, du kommst, er kommt, wir kommen, ihr kommt, sie kommen. “Wir” means we and “ihr” is the plural of “du”: you (several friends).
    tip: If the stem ends in -t or -d, an extra -e- is needed to pronounce the ending: du arbeitest, er arbeitet, ihr arbeitet. The other persons follow the normal pattern: ich arbeite, wir arbeiten, sie arbeiten. Other regular verbs in this unit: wohnen (to live), lernen (to learn), machen (to do, to make: ihr macht), spielen (to play).
    tip: In a statement the verb stands in second position. The subject or something else can come first: “Ich lerne heute Deutsch.” or “Heute lerne ich Deutsch.” The verb stays second and the subject moves behind it. In a question with a question word it is also second: “Woher kommst du?” In a yes/no question it comes first: “Kommst du aus Berlin?”
    tip: To say where you are from, use “aus”: “Ich komme aus Berlin.” To say where you live, use “in”: “Ich wohne in München.” The questions are “Woher kommst du?” (where from) and “Wo wohnst du?” (where).
    known: wohne, Deutsch, Fußball, Berlin, München
    word: wir = we
    word: ihr = you (plural)
    word: kommen = to come | forms: ich komme, du kommst, er kommt, wir kommen, ihr kommt, sie kommen
    word: wohnen = to live | forms: ich wohne, du wohnst, er wohnt, wir wohnen, ihr wohnt, sie wohnen
    word: lernen = to learn | forms: ich lerne, du lernst, er lernt, wir lernen, ihr lernt, sie lernen
    word: arbeiten = to work | forms: ich arbeite, du arbeitest, er arbeitet, wir arbeiten, ihr arbeitet, sie arbeiten
    word: machen = to do; to make | forms: ich mache, du machst, er macht, wir machen, ihr macht, sie machen
    word: spielen = to play | forms: ich spiele, du spielst, er spielt, wir spielen, ihr spielt, sie spielen
    word: aus = from; out of
    word: woher = where from
    word: wo = where
    word: in = in
    word: heute = today
    sentence: Woher kommst du? = Where are you from?; Where do you come from?
    sentence: Ich komme aus Berlin. = I am from Berlin.; I come from Berlin.
    sentence: Wo wohnst du? = Where do you live?
    sentence: Ich wohne in München. = I live in Munich.
    sentence: Heute lerne ich Deutsch. = Today I am learning German.; Today I learn German.
    sentence: Er arbeitet heute. = He is working today.; He works today.
    sentence: Wir spielen heute Fußball. = We are playing football today.; We play football today.
    sentence: Was macht ihr heute? = What are you doing today?
    form: kommen, ich = komme ## “Ich” takes the ending -e: ich komme.
    form: kommen, du = kommst ## “Du” takes the ending -st: du kommst.
    form: wohnen, du = wohnst ## “Du” takes the ending -st: du wohnst.
    form: lernen, ich = lerne ## “Ich” takes the ending -e: ich lerne.
    form: arbeiten, er = arbeitet ## The stem ends in -t, so “er” takes -et: er arbeitet.
    form: machen, ihr = macht ## “Ihr” takes the ending -t: ihr macht.
    fill: Er ___ in München. = arbeitet | arbeite | arbeitest ## “Er” takes -et after a stem ending in -t: er arbeitet.
    fill: Heute ___ wir Fußball. = spielen | spielt | spielst ## “Wir” takes -en: wir spielen.
    fact: Where does the verb stand in a German statement? = In second position | At the end | In first position ## In a statement the verb is always the second element.

    unit: Time, days and months | Telling the time, weekdays, months
    tip: To ask the time say “Wie spät ist es?” and answer “Es ist drei Uhr.” (It is three o'clock.) For one o'clock you say “ein Uhr”, not “eins Uhr”. A quarter past is “Viertel nach” and a quarter to is “Viertel vor”: “Es ist Viertel nach zwei.” (2:15), “Es ist Viertel vor sechs.” (5:45).
    tip: Beware of “halb”: it means half to the next hour. So 3:30 is “halb vier” (half to four), not half past three: “Es ist halb vier.” To say at what time something happens, use “um”: “Der Kurs ist um acht Uhr.”
    tip: The days of the week are Montag, Dienstag, Mittwoch, Donnerstag, Freitag, Samstag and Sonntag. They are all masculine (der Montag) and the week starts on Monday. With “am” you say on which day something happens: “Der Kurs ist am Montag.” “Wann” means when: “Wann kommst du?” The verb stays second even if the day comes first: “Am Freitag habe ich Deutsch.”
    tip: The months are Januar, Februar, März, April, Mai, Juni, Juli, August, September, Oktober, November, Dezember. All are masculine and capitalised. With “im” you say in which month: “im Mai”, “im Dezember”. The word for month is “der Monat”, the plural is “die Monate”.
    known: Es, Kurs, Deutsch
    word: der Montag = Monday | all days are masculine
    word: der Dienstag = Tuesday | all days are masculine
    word: der Mittwoch = Wednesday | all days are masculine
    word: der Donnerstag = Thursday | all days are masculine
    word: der Freitag = Friday | all days are masculine
    word: der Samstag = Saturday | all days are masculine
    word: der Sonntag = Sunday | all days are masculine
    word: die Uhr = o'clock; clock | pl. die Uhren
    word: spät = late
    word: wann = when
    word: um = at (a time)
    word: der Monat = month | pl. die Monate
    sentence: Wie spät ist es? = What time is it?
    sentence: Es ist drei Uhr. = It is three o'clock.
    sentence: Es ist halb vier. = It is half past three.; It is three thirty.
    sentence: Wann kommst du? = When are you coming?; When do you come?
    sentence: Der Kurs ist am Montag. = The course is on Monday.
    sentence: Der Kurs ist um neun Uhr. = The course is at nine o'clock.
    sentence: Heute ist Mittwoch. = Today is Wednesday.
    sentence: Am Freitag habe ich Deutsch. = On Friday I have German.
    form: time, 1:00 = Es ist ein Uhr. ## For one o'clock you say “ein Uhr”, not “eins Uhr”.
    form: time, 3:30 = Es ist halb vier. ## “Halb” means half to the next hour: half to four.
    form: time, 2:15 = Es ist Viertel nach zwei. ## A quarter past two is “Viertel nach zwei”.
    form: time, 5:45 = Es ist Viertel vor sechs. ## A quarter to six is “Viertel vor sechs”.
    form: on, der Montag = am Montag ## “An dem” becomes “am”: am Montag.
    form: on, der Freitag = am Freitag ## “An dem” becomes “am”: am Freitag.
    fill: Der Kurs ist ___ Montag. = am | um | im ## For a day of the week you use “am”.
    fill: Der Kurs ist ___ acht Uhr. = um | am | im ## For a time of day you use “um”.
    fact: Which day comes after Mittwoch? = der Donnerstag | der Dienstag | der Freitag ## The order is Montag, Dienstag, Mittwoch, Donnerstag, Freitag.
    fact: Which month comes after Februar? = März | Januar | April ## The order starts Januar, Februar, März, April.

    unit: The city | Places, prepositions, Wo? and Wohin?
    tip: Some places in town: die Stadt (city), der Bahnhof (train station), die Schule, der Supermarkt, das Kino (cinema), der Park, die Straße (street), das Haus. “Wo ist der Bahnhof?” asks where something is. The answer is “Der Bahnhof ist dort.” (there).
    tip: German distinguishes the place where you are (Wo?) from the direction you go to (Wohin?). After “in” the question Wo? takes the dative: in der Schule (die Schule), im Park (der Park, in + dem), im Kino (das Kino). The question Wohin? takes the accusative: in die Schule, in den Park, ins Kino (in + das). Note that after “in” with Wo? the feminine article “die” becomes “der”.
    tip: With cities and most countries use “nach” for the direction: “Wir gehen nach Berlin.” With people and some places you can also use “zu” plus the dative: zum Bahnhof (zu + dem), zur Schule (zu + der). “Ich gehe zum Bahnhof.”
    tip: The verb “gehen” is regular: ich gehe, du gehst, er geht, wir gehen, ihr geht, sie gehen. Use “wohnen” or “sein” with Wo? and “gehen” with Wohin?: “Wo wohnst du?” – “Ich wohne in der Stadt.” but “Wohin gehst du?” – “Ich gehe in die Schule.”
    known: gehe
    word: die Stadt = city; town | pl. die Städte
    word: der Bahnhof = train station | pl. die Bahnhöfe
    word: die Schule = school | pl. die Schulen
    word: der Supermarkt = supermarket | pl. die Supermärkte
    word: das Kino = cinema | pl. die Kinos
    word: der Park = park | pl. die Parks
    word: die Straße = street | pl. die Straßen
    word: das Haus = house | pl. die Häuser
    word: gehen = to go | forms: ich gehe, du gehst, er geht, wir gehen, ihr geht, sie gehen
    word: nach = to (a city or country)
    word: wohin = where to
    word: dort = there
    sentence: Ich wohne in der Stadt. = I live in the city.; I live in the town.
    sentence: Wo ist der Bahnhof? = Where is the train station?
    sentence: Der Bahnhof ist dort. = The train station is there.
    sentence: Wohin gehst du? = Where are you going?
    sentence: Ich gehe in die Schule. = I am going to school.; I go to school.
    sentence: Ich gehe heute ins Kino. = I am going to the cinema today.
    sentence: Wir gehen nach Berlin. = We are going to Berlin.
    sentence: Ich gehe zum Bahnhof. = I am going to the train station.
    form: Wo? in, die Schule = in der Schule ## Where? needs the dative: feminine “die” becomes “der”.
    form: Wo? in, der Park = im Park ## Where? needs the dative: “in dem” becomes “im”.
    form: Wohin? in, der Park = in den Park ## Where to? needs the accusative: “der” becomes “den”.
    form: Wohin? in, das Kino = ins Kino ## Where to? needs the accusative: “in das” becomes “ins”.
    form: zu, der Bahnhof = zum Bahnhof ## “Zu” takes the dative: “zu dem” becomes “zum”.
    form: gehen, du = gehst ## “Du” takes the ending -st: du gehst.
    fill: Wir gehen ___ Berlin. = nach | zum | im ## Before a city you use “nach” for the direction.
    fill: Ich gehe in ___ Park. = den | dem | der ## Wohin? takes the accusative: masculine “den”.
    fact: Which question asks for the place where you are? = Wo? | Wohin? | Woher? ## “Wo?” asks where you are; “Wohin?” asks where you are going.
    fact: Which word do you use for the direction before the name of a city? = nach | in | zu ## Cities and most countries use “nach” for the direction.
    """

    static let provider: any CourseProvider = LanguageCourseProvider.make(source: source).provider
}
