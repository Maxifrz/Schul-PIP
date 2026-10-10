import Foundation

/// The Latin course for German students in their first year, written in the language engine's text format.
/// Nouns follow the usual teaching convention ("puella, -ae f."), verbs are given in the 3rd person ("amat, amant"),
/// and long vowels are not written. The text contains no backslashes, triple quotes or interpolation.
enum LatinCourse {
    static let source = """
    course: la
    title: Latein
    subtitle: Für Deutschsprachige · Anfänger
    kind: language
    color: 9A7B5B
    symbol: building.columns.fill
    instruction: de
    target-name: Latein
    into-name: Lateinische
    produce: no

    section: Lehrgang · Erstes Lernjahr

    unit: Die a-Deklination | Nominativ und das Prädikat
    tip: Lateinische Nomen ändern ihre Endung, je nachdem welche Rolle sie im Satz spielen. Diese Änderung heißt Deklination. Die a-Deklination erkennst du am Nominativ Singular auf -a: puella (das Mädchen), femina (die Frau). Im Wörterbuch steht neben dem Wort die Endung des Genitivs und das Genus: „puella, -ae f.“ heißt: Genitiv puellae, Femininum.
    tip: Der Nominativ ist der Fall des Subjekts („Wer oder was?“). Singular: puella. Plural: puellae. Ein Artikel fehlt im Lateinischen; puella kann „das Mädchen“ oder „ein Mädchen“ heißen, je nach Satz. Merke: puella cantat (Singular) und puellae cantant (Plural).
    tip: Eine Besonderheit: Einige Wörter auf -a sind Maskulina, vor allem Berufe: agricola (der Bauer) und nauta (der Seemann) sind männlich, haben aber trotzdem die Endungen der a-Deklination. Im Wörterbuch erkennst du das am Zusatz m.: „agricola, -ae m.“.
    tip: Das Prädikat (das Verb) richtet sich nach dem Subjekt im Numerus. In der 3. Person Singular endet es auf -t, in der 3. Person Plural auf -nt: laborat (er arbeitet) und laborant (sie arbeiten). Wörterbucheinträge von Verben nennen deshalb beide Formen: „laborat, laborant“. Stehen zwei Subjekte mit et, steht das Prädikat im Plural: dea et femina ambulant.
    tip: Im lateinischen Satz steht das Prädikat meist am Ende. Beim Übersetzen suchst du zuerst das Prädikat, dann das Subjekt im Nominativ.
    known: amicae, laborant, cantant, saltant
    word: puella = das Mädchen | -ae f.
    word: femina = die Frau | -ae f.
    word: amica = die Freundin | -ae f.
    word: dea = die Göttin | -ae f.
    word: agricola = der Bauer | -ae m.
    word: nauta = der Seemann | -ae m.
    word: laborat, laborant = arbeiten; er arbeitet | a-Konjugation
    word: cantat, cantant = singen; er singt | a-Konjugation
    word: saltat, saltant = tanzen; er tanzt | a-Konjugation
    word: clamat, clamant = schreien; laut rufen | a-Konjugation
    word: ambulat, ambulant = spazieren gehen; gehen | a-Konjugation
    word: et = und
    sentence: Puella cantat. = Das Mädchen singt.; Ein Mädchen singt.
    sentence: Puellae saltant. = Die Mädchen tanzen.
    sentence: Nauta laborat. = Der Seemann arbeitet.
    sentence: Agricolae laborant. = Die Bauern arbeiten.
    sentence: Femina clamat. = Die Frau schreit.; Die Frau ruft laut.
    sentence: Dea et femina ambulant. = Die Göttin und die Frau gehen spazieren.; Die Göttin und die Frau gehen.
    sentence: Amicae cantant et saltant. = Die Freundinnen singen und tanzen.
    sentence: Nautae clamant. = Die Seeleute schreien.; Die Seeleute rufen laut.
    form: puella, Nominativ Plural = puellae ## Die a-Deklination bildet den Nominativ Plural auf -ae.
    form: femina, Nominativ Plural = feminae
    form: agricola, Nominativ Plural = agricolae ## Auch männliche Wörter auf -a enden im Plural auf -ae.
    form: nauta, Nominativ Plural = nautae
    fill: Femina et dea ___. = ambulant | ambulat ## Zwei Subjekte verlangen ein Prädikat im Plural.
    fill: ___ saltant. = Puellae | Puella ## Das Prädikat steht im Plural, also auch das Subjekt.
    fact: Welches Genus hat „agricola“? = Maskulinum | Femininum | Neutrum ## Trotz der Endung -a bezeichnet agricola einen Mann.
    fact: Welche Endung hat der Nominativ Plural der a-Deklination? = -ae | -a | -am ## puella wird zu puellae.

    unit: Der Akkusativ | Subjekt und Objekt
    tip: Der Akkusativ ist der Fall des Objekts („Wen oder was?“). In der a-Deklination endet er im Singular auf -am (puellam) und im Plural auf -as (puellas). Der Nominativ zeigt das Subjekt, der Akkusativ das Objekt: Puella rosam amat heißt „Das Mädchen liebt die Rose“.
    tip: Die Wortstellung entscheidet nicht über Subjekt und Objekt, die Endung tut es. „Puellam agricola laudat“ bedeutet „Der Bauer lobt das Mädchen“, denn agricola steht im Nominativ und puellam im Akkusativ. Gehe beim Übersetzen immer so vor: Prädikat finden, Subjekt im Nominativ suchen, Objekt im Akkusativ suchen.
    tip: Das Prädikat bleibt in der 3. Person: -t bei einem Subjekt, -nt bei mehreren. Feminae rosas portant: Die Frauen (Subjekt, Plural) tragen Rosen (Objekt, Plural).
    tip: Verneint wird mit non direkt vor dem Verb: Puella viam non amat. „Non“ verändert sich nie.
    known: rosas, silvam, viam, villas, aquam, agricolam
    word: rosa = die Rose | -ae f.
    word: aqua = das Wasser | -ae f.
    word: villa = das Landhaus | -ae f.
    word: via = der Weg | -ae f.
    word: silva = der Wald | -ae f.
    word: terra = das Land; die Erde | -ae f.
    word: amat, amant = lieben; er liebt | a-Konjugation, steht mit Akkusativ
    word: portat, portant = tragen; er trägt | a-Konjugation, steht mit Akkusativ
    word: vocat, vocant = rufen; herbeirufen | a-Konjugation, steht mit Akkusativ
    word: spectat, spectant = betrachten; anschauen | a-Konjugation, steht mit Akkusativ
    word: laudat, laudant = loben; er lobt | a-Konjugation, steht mit Akkusativ
    word: non = nicht
    sentence: Puella rosam amat. = Das Mädchen liebt die Rose.
    sentence: Agricola aquam portat. = Der Bauer trägt Wasser.
    sentence: Nauta silvam spectat. = Der Seemann betrachtet den Wald.; Der Seemann schaut den Wald an.
    sentence: Feminae rosas portant. = Die Frauen tragen Rosen.
    sentence: Amica puellam vocat. = Die Freundin ruft das Mädchen.
    sentence: Puellam agricola laudat. = Der Bauer lobt das Mädchen. ## Agricola steht im Nominativ, ist also das Subjekt.
    sentence: Puella viam non amat. = Das Mädchen liebt den Weg nicht.
    sentence: Nautae villas spectant. = Die Seeleute betrachten die Landhäuser.; Die Seeleute schauen die Landhäuser an.
    form: puella, Akkusativ Singular = puellam ## Der Akkusativ Singular endet auf -am.
    form: puella, Akkusativ Plural = puellas ## Der Akkusativ Plural endet auf -as.
    form: rosa, Akkusativ Singular = rosam
    form: via, Akkusativ Plural = vias
    fill: Agricola ___ portat. = aquam | aqua | aquae ## Aqua ist hier das Objekt, also steht es im Akkusativ.
    fill: Puellam ___ laudat. = agricola | agricolam | agricolas ## Puellam ist Objekt, also braucht der Satz ein Subjekt im Nominativ.
    fill: Nautae ___ spectant. = silvas | silva | silvam ## Mehrere Seeleute betrachten mehrere Wälder: Akkusativ Plural.
    fact: Welche Endung hat der Akkusativ Plural der a-Deklination? = -as | -am | -ae ## puellas ist der Akkusativ Plural.
    fact: Mit welcher Frage ermittelt man das Objekt? = Wen oder was? | Wer oder was? | Wem? ## Das Objekt steht im Akkusativ.

    unit: Die o-Deklination | Maskulina, Neutra und esse
    tip: Die o-Deklination hat zwei Gruppen. Maskulina enden im Nominativ Singular auf -us, Neutra auf -um. Im Wörterbuch stehen sie so: „servus, -i m.“ (der Sklave) und „templum, -i n.“ (der Tempel). Das -i ist die Endung des Genitivs.
    tip: Maskulina: Nominativ servus, servi; Akkusativ servum, servos. Neutra: Nominativ und Akkusativ sind immer gleich: templum, templa. Der Plural der Neutra endet auf -a, und das gilt für Nominativ und Akkusativ. Templa spectant kann also nur „sie betrachten die Tempel“ heißen, weil templa das Objekt ist.
    tip: Das wichtigste unregelmäßige Verb ist esse (sein). Die Formen: sum, es, est, sumus, estis, sunt. Es verbindet das Subjekt mit einem Nomen, das ebenfalls im Nominativ steht: Marcus amicus est. Hier gibt es kein Objekt im Akkusativ.
    tip: Die Namen Marcus und Iulia brauchst du nicht zu lernen. Sie dienen in den Sätzen als Subjekt.
    known: Marcus, Iulia, servi, dominum, equos, amici
    word: amicus = der Freund | -i m.
    word: servus = der Sklave | -i m.
    word: dominus = der Herr | -i m.
    word: filius = der Sohn | -i m.
    word: equus = das Pferd | -i m.
    word: hortus = der Garten | -i m.
    word: templum = der Tempel | -i n.
    word: oppidum = die Stadt | -i n.
    word: bellum = der Krieg | -i n.
    word: donum = das Geschenk | -i n.
    word: est, sunt = sein; er ist, sie sind | esse, unregelmäßig
    sentence: Dominus servum laudat. = Der Herr lobt den Sklaven.
    sentence: Servi dominum vocant. = Die Sklaven rufen den Herrn.
    sentence: Filius equum amat. = Der Sohn liebt das Pferd.
    sentence: Marcus et Iulia amici sunt. = Marcus und Iulia sind Freunde.
    sentence: Servus non est dominus. = Der Sklave ist nicht der Herr.
    sentence: Marcus bellum non amat. = Marcus liebt den Krieg nicht.
    sentence: Amici templum et oppidum spectant. = Die Freunde betrachten den Tempel und die Stadt.
    sentence: Servi donum portant. = Die Sklaven tragen das Geschenk.
    form: esse, 1. Person Singular = sum ## Ich bin: sum.
    form: esse, 2. Person Singular = es
    form: esse, 1. Person Plural = sumus
    form: esse, 2. Person Plural = estis
    form: servus, Akkusativ Singular = servum ## Die Maskulina auf -us haben den Akkusativ auf -um.
    form: templum, Nominativ Plural = templa ## Neutra enden im Plural auf -a.
    fill: Marcus et Iulia amici ___. = sunt | est | sum ## Zwei Subjekte verlangen den Plural.
    fill: Filius ___ amat. = equum | equus | equi ## Equus ist hier das Objekt: Akkusativ.
    fact: Welches Genus hat „templum“? = Neutrum | Maskulinum | Femininum ## Die Endung -um zeigt ein Neutrum.

    unit: Präpositionen | Akkusativ und Ablativ
    tip: Präpositionen verlangen einen bestimmten Fall. Mit dem Akkusativ stehen ad (zu) und per (durch). Mit dem Ablativ stehen cum (mit), sine (ohne), a oder ab (von) und e oder ex (aus). A und e stehen vor Konsonanten, ab und ex vor Vokalen: ab insula, e villa.
    tip: Die Präposition in hat zwei Bedeutungen. Mit Ablativ antwortet sie auf „Wo?“: in villa (im Landhaus). Mit Akkusativ antwortet sie auf „Wohin?“: in villam (ins Landhaus).
    tip: Der Ablativ Singular endet in der a-Deklination auf -a (villa) und in der o-Deklination auf -o (horto, templo). Der Ablativ Plural endet in beiden Deklinationen auf -is (servis, villis). Villa kann also Nominativ oder Ablativ sein; die Präposition und der Satz zeigen es.
    tip: Der Ablativ wird mit Präpositionen oft nur durch den Zusammenhang erkannt. Achte deshalb zuerst auf die Präposition und frage dich, welchen Fall sie verlangt.
    known: portam, scholam, hortum, silvam, amico
    word: in = in
    word: ad = zu; nach | + Akkusativ
    word: per = durch | + Akkusativ
    word: cum = mit | + Ablativ
    word: a, ab = von; von weg | + Ablativ
    word: e, ex = aus; heraus | + Ablativ
    word: sine = ohne | + Ablativ
    word: schola = die Schule | -ae f.
    word: porta = das Tor | -ae f.
    word: insula = die Insel | -ae f.
    word: murus = die Mauer | -i m.
    word: habitat, habitant = wohnen; er wohnt | a-Konjugation
    sentence: Puella in villa habitat. = Das Mädchen wohnt im Landhaus.
    sentence: Servi in horto laborant. = Die Sklaven arbeiten im Garten.
    sentence: Servi ad portam ambulant. = Die Sklaven gehen zum Tor.
    sentence: Agricola per silvam ambulat. = Der Bauer geht durch den Wald.
    sentence: Puella cum amica ad scholam ambulat. = Das Mädchen geht mit der Freundin zur Schule.
    sentence: Servus e villa in hortum ambulat. = Der Sklave geht aus dem Landhaus in den Garten. ## In mit Akkusativ antwortet auf „Wohin?“.
    sentence: Dea in templo est. = Die Göttin ist im Tempel.
    sentence: Nautae ab insula ad oppidum ambulant. = Die Seeleute gehen von der Insel zur Stadt.
    form: villa, Ablativ Singular = villa ## Der Ablativ Singular der a-Deklination sieht aus wie der Nominativ (mit langem a).
    form: hortus, Ablativ Singular = horto ## Der Ablativ Singular der o-Deklination endet auf -o.
    form: templum, Ablativ Singular = templo
    form: servus, Ablativ Plural = servis ## Der Ablativ Plural endet auf -is.
    fill: Puella ___ villa habitat. = in | ad | per ## Auf die Frage „Wo?“ antwortet in mit Ablativ.
    fill: Puella cum ___ ambulat. = amica | amicam | amicae ## Cum verlangt den Ablativ.
    fill: Servi ad ___ ambulant. = portam | porta | portae ## Ad verlangt den Akkusativ.
    fact: Welchen Fall verlangt „cum“? = Ablativ | Akkusativ | Genitiv ## Cum steht immer mit dem Ablativ.
    fact: Welche Präposition verlangt den Akkusativ? = ad | ex | sine ## Ex und sine stehen mit dem Ablativ.

    unit: Adjektive | a-/o-Deklination und KNG
    tip: Die Adjektive der a-/o-Deklination haben drei Endungen: „magnus, -a, -um“ (groß). Männliche Nomen bekommen -us, weibliche -a und sächliche -um: dominus magnus, villa magna, templum magnum. Männlich, weiblich und sächlich stehen im Wörterbuch immer in dieser Reihenfolge.
    tip: Das Adjektiv gleicht sich dem Nomen an, zu dem es gehört: in Kasus, Numerus und Genus. Das nennt man KNG-Kongruenz. Servus bonus dominum bonum laudat: Beide Adjektive passen zu ihrem Nomen, das erste im Nominativ, das zweite im Akkusativ.
    tip: Wichtig ist das Genus des Nomens, nicht die Endung. Agricola bonus heißt „der gute Bauer“: agricola ist männlich, also steht bonus. Im Plural heißt es agricolae boni.
    tip: Das Adjektiv kann beim Nomen stehen (puella laeta cantat: das fröhliche Mädchen singt) oder mit esse verbunden sein (via longa est: der Weg ist lang). Beide Male gilt dieselbe Angleichung.
    known: oppido, laeta, longa, antiqua, alta, clara, bonum, magnum, magno, novo
    word: magnus, -a, -um = groß
    word: parvus, -a, -um = klein
    word: bonus, -a, -um = gut
    word: malus, -a, -um = schlecht
    word: novus, -a, -um = neu
    word: antiquus, -a, -um = alt; antik
    word: laetus, -a, -um = froh; fröhlich
    word: longus, -a, -um = lang
    word: altus, -a, -um = hoch
    word: clarus, -a, -um = berühmt; hell
    word: sed = aber
    sentence: Villa magna est. = Das Landhaus ist groß.
    sentence: Puella laeta cantat. = Das fröhliche Mädchen singt.
    sentence: Servus bonus dominum bonum laudat. = Der gute Sklave lobt den guten Herrn.
    sentence: Nautae oppidum magnum spectant. = Die Seeleute betrachten die große Stadt.
    sentence: Templa antiqua alta sunt. = Die alten Tempel sind hoch.
    sentence: Via longa est, sed puella laeta ambulat. = Der Weg ist lang, aber das fröhliche Mädchen geht spazieren.
    sentence: Dea clara in templo magno est. = Die berühmte Göttin ist im großen Tempel.
    sentence: Marcus et Iulia in oppido novo habitant. = Marcus und Iulia wohnen in der neuen Stadt.
    form: magnus, Femininum Nominativ Singular = magna ## Das Femininum endet auf -a.
    form: magnus, Neutrum Nominativ Singular = magnum ## Das Neutrum endet auf -um.
    form: bonus, Maskulinum Nominativ Plural = boni
    form: novus, Femininum Nominativ Plural = novae
    form: parvus, Neutrum Nominativ Plural = parva
    fill: Puella ___ cantat. = laeta | laetus | laetum ## Puella ist feminin: laeta.
    fill: Servi ___ dominum laudant. = boni | bonus | bona ## Servi ist Maskulinum Plural.
    fill: Templum ___ est. = altum | altus | alta ## Templum ist ein Neutrum.
    fact: Wonach richtet sich ein Adjektiv in KNG-Kongruenz? = nach dem Nomen, zu dem es gehört | nach dem Verb des Satzes | nach der Präposition ## Es passt zu seinem Bezugswort.
    fact: Wofür steht KNG? = Kasus, Numerus, Genus | Konjugation, Nominativ, Genitiv | Kasus, Nomen, Genitiv ## Die drei Merkmale, in denen das Adjektiv übereinstimmt.

    unit: Genitiv und Dativ | Besitz und Empfänger
    tip: Der Genitiv antwortet auf „Wessen?“ und gibt Besitz an. Er steht meist hinter seinem Bezugswort: villa agricolae (das Landhaus des Bauern). Endungen: a-Deklination Singular -ae, Plural -arum (puellarum); o-Deklination Singular -i, Plural -orum (servorum).
    tip: Der Dativ antwortet auf „Wem?“ und bezeichnet den Empfänger. Endungen: a-Deklination Singular -ae, Plural -is; o-Deklination Singular -o, Plural -is. So heißt es domina (Herrin), dominae (der Herrin), und servus (Nominativ), servo (dem Sklaven), servis (den Sklaven).
    tip: Die Endung -ae ist mehrdeutig: puellae kann Nominativ Plural, Genitiv Singular oder Dativ Singular sein. Der Satz zeigt, was gemeint ist: Puellae cantant (Nominativ Plural), villa puellae (Genitiv), puellae rosam dat (Dativ).
    tip: Die ganze a-Deklination im Überblick, jeweils Singular, Plural: Nominativ puella, puellae. Genitiv puellae, puellarum. Dativ puellae, puellis. Akkusativ puellam, puellas. Ablativ puella, puellis.
    tip: Die ganze o-Deklination (Maskulina) im Überblick: Nominativ servus, servi. Genitiv servi, servorum. Dativ servo, servis. Akkusativ servum, servos. Ablativ servo, servis. Das Verb dare (geben) verlangt Dativ und Akkusativ: Servus dominae pecuniam dat.
    known: pecuniam, discipulum, dominae, dominarum, servo, dominorum, amici, nautarum, agricolae, filio, puellis, amicis, fabulas, gladios, discipuli, laetus
    word: dat, dant = geben; er gibt | a-Konjugation, steht mit Dativ und Akkusativ
    word: narrat, narrant = erzählen; er erzählt | a-Konjugation, steht mit Dativ und Akkusativ
    word: discipulus = der Schüler | -i m.
    word: domina = die Herrin | -ae f.
    word: fabula = die Geschichte | -ae f.
    word: pecunia = das Geld | -ae f.
    word: gloria = der Ruhm | -ae f.
    word: gladius = das Schwert | -i m.
    word: vita = das Leben | -ae f.
    word: hodie = heute
    word: semper = immer
    sentence: Servus dominae pecuniam dat. = Der Sklave gibt der Herrin Geld.
    sentence: Domina servo pecuniam dat. = Die Herrin gibt dem Sklaven Geld.
    sentence: Agricola puellis fabulam narrat. = Der Bauer erzählt den Mädchen eine Geschichte.
    sentence: Villa agricolae magna est. = Das Landhaus des Bauern ist groß.
    sentence: Filius dominae semper laetus est. = Der Sohn der Herrin ist immer froh.
    sentence: Gloria nautarum magna est. = Der Ruhm der Seeleute ist groß.
    sentence: Agricolae filio donum dant. = Die Bauern geben dem Sohn ein Geschenk.
    sentence: Hodie discipuli amicis fabulas narrant. = Heute erzählen die Schüler den Freunden Geschichten.
    form: domina, Dativ Singular = dominae ## Der Dativ Singular der a-Deklination endet auf -ae.
    form: domina, Genitiv Plural = dominarum ## Der Genitiv Plural der a-Deklination endet auf -arum.
    form: servus, Dativ Singular = servo ## Der Dativ Singular der o-Deklination endet auf -o.
    form: dominus, Genitiv Plural = dominorum ## Der Genitiv Plural der o-Deklination endet auf -orum.
    form: amicus, Genitiv Singular = amici
    fill: Servus ___ pecuniam dat. = dominae | dominam | domina ## Wem gibt er? Der Dativ ist dominae.
    fill: Villa ___ magna est. = agricolae | agricolam | agricola ## Wessen Landhaus? Der Genitiv ist agricolae.
    fill: Agricola puellis ___ narrat. = fabulam | fabulae | fabula ## Fabulam ist das Objekt im Akkusativ.
    fact: Auf welche Frage antwortet der Dativ? = Wem? | Wessen? | Wen? ## Der Dativ bezeichnet den Empfänger.
    fact: Welche Endung hat der Genitiv Plural der a-Deklination? = -arum | -orum | -is ## puellarum.

    unit: Die Konjugation | a- und e-Konjugation im Präsens
    tip: Das Verb hat im Lateinischen für jede Person eine eigene Endung, deshalb braucht man das Personalpronomen nicht. Die Personalendungen sind: 1. Person Singular -o, 2. Person Singular -s, 3. Person Singular -t, 1. Person Plural -mus, 2. Person Plural -tis, 3. Person Plural -nt. Die Grundform heißt Infinitiv und endet auf -re: amare (lieben), habere (haben).
    tip: Die a-Konjugation: amo, amas, amat, amamus, amatis, amant. Vor den Endungen steht ein langes a (nur in der 1. Person Singular fällt es weg).
    tip: Die e-Konjugation: habeo, habes, habet, habemus, habetis, habent. Hier steht ein e vor der Endung, in der 1. Person Singular heißt es -eo.
    tip: Die Personalpronomen ego (ich), tu (du), nos (wir), vos (ihr) stehen nur zur Betonung. Tu respondes, sed vos tacetis: Du antwortest, aber ihr schweigt.
    known: moneo, laudamus, laboratis, respondes, tacetis, habitamus, habes, amicos, laudamus
    word: ego = ich
    word: tu = du
    word: nos = wir
    word: vos = ihr
    word: habet, habent = haben; er hat | e-Konjugation
    word: videt, vident = sehen; er sieht | e-Konjugation
    word: respondet, respondent = antworten; er antwortet | e-Konjugation
    word: monet, monent = ermahnen; er ermahnt | e-Konjugation
    word: tacet, tacent = schweigen; er schweigt | e-Konjugation
    word: etiam = auch
    sentence: Ego Marcus sum, tu Iulia es. = Ich bin Marcus, du bist Iulia.
    sentence: Tu pecuniam habes. = Du hast Geld.
    sentence: Nos amicos laudamus. = Wir loben die Freunde.
    sentence: Ego discipulum moneo. = Ich ermahne den Schüler.
    sentence: Vos in schola laboratis. = Ihr arbeitet in der Schule.
    sentence: Tu respondes, sed vos tacetis. = Du antwortest, aber ihr schweigt.
    sentence: Nos etiam in oppido habitamus. = Wir wohnen auch in der Stadt.
    form: amare, 1. Person Singular = amo ## In der a-Konjugation fällt das a vor -o weg.
    form: amare, 2. Person Singular = amas
    form: amare, 1. Person Plural = amamus
    form: amare, 2. Person Plural = amatis
    form: habere, 1. Person Singular = habeo ## In der e-Konjugation heißt die Endung -eo.
    form: habere, 2. Person Singular = habes
    form: habere, 1. Person Plural = habemus
    form: habere, 2. Person Plural = habetis
    fill: Ego puellam ___. = amo | amas | amat ## Ego verlangt die 1. Person Singular auf -o.
    fill: Tu pecuniam ___. = habes | habeo | habet ## Tu verlangt die 2. Person Singular auf -s.
    fill: Nos in horto ___. = laboramus | laboratis | laborant ## Nos verlangt die Endung -mus.
    fact: Welche Endung hat die 2. Person Plural? = -tis | -mus | -nt ## Vos laboratis.
    fact: Wie heißt „ich habe“ auf Latein? = habeo | habo | habet ## Die e-Konjugation hat in der 1. Person Singular -eo.

    unit: Die i-Konjugation | Imperativ und Fragen
    tip: Die i-Konjugation hat in den meisten Formen ein i vor der Endung: audio, audis, audit, audimus, auditis, audiunt. Die 3. Person Plural endet also auf -iunt, in der a- und e-Konjugation dagegen auf -nt. Der Infinitiv ist audire.
    tip: Der Imperativ ist die Befehlsform. Im Singular besteht er aus dem Verbstamm ohne Endung: ama! (liebe), vide! (sieh), audi! (hör). Im Plural kommt -te dazu: amate, videte, audite, venite.
    tip: Der Imperativ Plural ähnelt der 2. Person Plural, hat aber -te statt -tis: vos auditis (ihr hört), audite! (hört!). Mit dem Vokativ rufst du Personen an: Venite, amici! (Kommt, Freunde!).
    tip: Die Fragewörter quid? (was?), ubi? (wo?) und cur? (warum?) stehen am Satzanfang: Quid audis? Ubi est Marcus? Cur tacetis? Im Ausblick folgen später die 3. Deklination und weitere Zeiten, zum Beispiel das Imperfekt.
    known: fabulam
    word: audit, audiunt = hören; er hört | i-Konjugation
    word: venit, veniunt = kommen; er kommt | i-Konjugation
    word: dormit, dormiunt = schlafen; er schläft | i-Konjugation
    word: ubi = wo
    word: cur = warum
    word: quid = was
    word: ecce = sieh da; siehe
    word: salve, salvete = hallo; sei gegrüßt; seid gegrüßt
    word: vale, valete = leb wohl; lebt wohl
    sentence: Quid audis? = Was hörst du?
    sentence: Ubi est Marcus? = Wo ist Marcus?
    sentence: Marcus dormit. = Marcus schläft.
    sentence: Venite, amici! = Kommt, Freunde!
    sentence: Salvete, discipuli! = Seid gegrüßt, Schüler!; Hallo, Schüler!
    sentence: Cur tacetis? = Warum schweigt ihr?
    sentence: Audite, discipuli! = Hört zu, Schüler!; Hört, Schüler!
    sentence: Servi dormiunt, sed domina laborat. = Die Sklaven schlafen, aber die Herrin arbeitet.
    form: audire, 1. Person Singular = audio
    form: audire, 2. Person Singular = audis
    form: audire, 2. Person Plural = auditis
    form: amare, Imperativ Singular = ama ## Der Imperativ Singular ist der Verbstamm.
    form: amare, Imperativ Plural = amate ## Der Imperativ Plural hat -te.
    form: audire, Imperativ Plural = audite
    form: venire, Imperativ Plural = venite
    fill: ___, discipuli! = Audite | Audi | Audis ## Mehrere Personen werden angesprochen: Imperativ Plural.
    fill: Tu fabulam ___. = audis | audio | audit ## Tu verlangt die 2. Person Singular.
    fill: Servi in horto ___. = dormiunt | dormit | dormio ## Mehrere Subjekte verlangen -iunt.
    fact: Wie lautet der Imperativ Plural von „monere“? = monete | mone | monetis ## Stamm plus -te.
    fact: Welche Endung hat die 3. Person Plural der i-Konjugation? = -iunt | -unt | -ent ## audiunt.
    """

    static let provider: any CourseProvider = LanguageCourseProvider.make(source: source).provider
}
