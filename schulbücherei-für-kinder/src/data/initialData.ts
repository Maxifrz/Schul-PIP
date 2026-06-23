import { Book, Event, NewsItem, QuizQuestion, AvatarOption, Badge, BookSuggestion } from '../types';

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'owl', emoji: '🦉', name: 'Schlaue Eule', color: 'bg-amber-100 border-amber-300 text-amber-700' },
  { id: 'fox', emoji: '🦊', name: 'Schlauer Fuchs', color: 'bg-orange-100 border-orange-300 text-orange-700' },
  { id: 'rabbit', emoji: '🐰', name: 'Flotti Karotti', color: 'bg-sky-100 border-sky-300 text-sky-700' },
  { id: 'cat', emoji: '🐱', name: 'Lese-Kätzchen', color: 'bg-rose-100 border-rose-300 text-rose-700' },
  { id: 'dragon', emoji: '🐉', name: 'Bücher-Drache', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
  { id: 'bear', emoji: '🐻', name: 'Brummi Bär', color: 'bg-yellow-100 border-yellow-300 text-yellow-700' }
];

export const BADGES: Badge[] = [
  {
    id: 'first_book',
    title: 'Lese-Lehrling',
    description: 'Dein erstes Buch ausgeliehen!',
    emoji: '🌱',
    color: 'from-green-400 to-emerald-500 text-white shadow-emerald-200'
  },
  {
    id: 'badge_quiz',
    title: 'Bücher-Quiz-König',
    description: 'Ein Lese-Quiz fehlerfrei gelöst!',
    emoji: '👑',
    color: 'from-amber-400 to-orange-500 text-white shadow-orange-200'
  },
  {
    id: 'badge_borrow_three',
    title: 'Sammel-Meister',
    description: 'Gleichzeitig 3 tolle Bücher ausgeliehen.',
    emoji: '📚',
    color: 'from-blue-400 to-indigo-500 text-white shadow-indigo-200'
  },
  {
    id: 'badge_review',
    title: 'Bücher-Kritiker',
    description: 'Deine erste eigene Buchbewertung abgegeben.',
    emoji: '✍️',
    color: 'from-rose-400 to-pink-500 text-white shadow-pink-200'
  },
  {
    id: 'badge_suggest',
    title: 'Wunsch-Stifter',
    description: 'Ein neues Buch für die Bücherei vorgeschlagen.',
    emoji: '✨',
    color: 'from-purple-400 to-fuchsia-500 text-white shadow-purple-200'
  }
];

export const INITIAL_BOOKS: Book[] = [
  {
    id: 'book_1',
    title: 'Der geheimnisvolle Zauberwald',
    author: 'Elena Grünwald',
    category: 'Fantasie & Märchen',
    ageGroup: '6-8',
    summary: 'Als Lili hinter der alten Schulturnhalle ein geheimes Tor findet, betritt sie ein Land voller sprechender Eichhörnchen und freundlicher Riesen. Doch der schusseligen Waldfee Luise ist ihr Zauberstab in einen Seerosenteich gefallen! Schafft es Lili, Luise zu helfen und rechtzeitig zum Abendbrot zurück zu sein?',
    coverColor: 'bg-emerald-500 text-emerald-950',
    coverPattern: 'stars',
    emoji: '🧙‍♀️',
    totalCopies: 4,
    availableCopies: 3,
    publishedYear: 2024,
    pages: 64,
    rating: 4.8,
    reviews: [
      { id: 'r1', reviewerName: 'Mia (7)', reviewerAvatar: '🦊', rating: 5, comment: 'Ich fand die Eichhörnchen super witzig! Ich will auch fliegen können.', date: '2026-06-15' },
      { id: 'r2', reviewerName: 'Lukas (8)', reviewerAvatar: '🐰', rating: 4, comment: 'Die Fee war echt schludrig, aber die Abenteuer waren klasse!', date: '2026-06-18' }
    ]
  },
  {
    id: 'book_2',
    title: 'Detektiv Kluftig und der Kakaoraub',
    author: 'Stefan Lupe',
    category: 'Detektive & Rätsel',
    ageGroup: '8-10',
    summary: 'Skandal in der Schulkantine! Jemand hat alle Flaschen des leckeren Schoko-Kakaos aus dem Keller geklaut. Detektiv Kluftig und sein cleverer Spürhund Wuschel nehmen die Fährte auf. Gibt es eine Spur im Schlamm? Und was hat der lila Kaugummi am Tatort zu bedeuten? Ein packender Mitratekrimi für neugierige Detektive!',
    coverColor: 'bg-amber-600 text-amber-50',
    coverPattern: 'stripes',
    emoji: '🕵️‍♂️',
    totalCopies: 3,
    availableCopies: 0, // Not available to showcase reservation status
    publishedYear: 2023,
    pages: 112,
    rating: 4.5,
    reviews: [
      { id: 'r3', reviewerName: 'Paul (9)', reviewerAvatar: '🐻', rating: 5, comment: 'Spannend bis zum Schluss! Ich habe den Dieb fast richtig erraten!', date: '2026-06-10' }
    ]
  },
  {
    id: 'book_3',
    title: 'Auf der Jagd nach dem Saurier-Ei',
    author: 'Prof. Dr. Theo Fossil',
    category: 'Abenteuer & Natur',
    ageGroup: '8-10',
    summary: 'Eine abenteuerliche Zeitreise ins Zeitalter der Dinosaurier! Die Geschwister Jonas und Marie schlüpfen durch eine seltsame Höhle im Schwarzwald direkt in die Kreidezeit. Plötzlich stehen sie einem gewaltigen Triceratops-Muttertier gegenüber! Ein fesselndes Abenteuer mit viel Wissen rund um die Giganten der Urzeit.',
    coverColor: 'bg-orange-500 text-orange-950',
    coverPattern: 'waves',
    emoji: '🦖',
    totalCopies: 5,
    availableCopies: 4,
    publishedYear: 2025,
    pages: 128,
    rating: 4.9,
    reviews: []
  },
  {
    id: 'book_4',
    title: 'Der Weltraum für kleine Entdecker',
    author: 'Dr. Stella Mondschein',
    category: 'Wissen & Sachbuch',
    ageGroup: '6-8',
    summary: 'Wie heiß ist die Sonne? Warum schweben Astronauten im Weltall? Und wie sieht eigentlich die Erde aus, wenn man sie vom Mond aus betrachtet? Mit großen farbigen Zeichnungen, kleinen Rätseln und spannenden Fakten führt dieses Sachbuch schon die Jüngsten behutsam in die Wunder unseres Universums ein.',
    coverColor: 'bg-sky-600 text-sky-50',
    coverPattern: 'circles',
    emoji: '🪐',
    totalCopies: 2,
    availableCopies: 2,
    publishedYear: 2024,
    pages: 48,
    rating: 4.6,
    reviews: [
      { id: 'r4', reviewerName: 'Emilia (6)', reviewerAvatar: 'cat', rating: 5, comment: 'Die Planetenbilder sind wunderschön!', date: '2026-06-19' }
    ]
  },
  {
    id: 'book_5',
    title: 'Kichern verboten! Der Chaos-Schultag',
    author: 'Marc Witzig',
    category: 'Comic & Spaß',
    ageGroup: '6-8',
    summary: 'Heute läuft an der Schule alles schief: Die Lehrer machen Handstand, die Pausenglocke singt wie ein Papagei, und aus den Wasserhähnen kommt Himbeersaft! Und was macht eigentlich das kleine Hausschwein von Hausmeister Huby im Lehrerzimmer? Ein lustiges Taschenbuch mit vielen bunten Comic-Panels!',
    coverColor: 'bg-rose-500 text-rose-950',
    coverPattern: 'grid',
    emoji: '🐷',
    totalCopies: 6,
    availableCopies: 5,
    publishedYear: 2025,
    pages: 80,
    rating: 4.7,
    reviews: [
      { id: 'r5', reviewerName: 'Finn (8)', reviewerAvatar: 'fox', rating: 5, comment: 'Ich musste so lachen, als das Schwein die Hausaufgaben gefressen hat!', date: '2026-06-20' }
    ]
  },
  {
    id: 'book_6',
    title: 'Die geheime Pony-Insel',
    author: 'Sabine Weide',
    category: 'Fantasie & Märchen',
    ageGroup: '8-10',
    summary: 'Emma liebt Ponys über alles. In den Sommerferien darf sie auf die Nordseeinsel Halligwind reisen. Dort entdeckt sie am einsamen Strand eine winzige Insel, die nur bei Ebbe zu sehen ist. Und dort grasen zauberhafte Ponys mit Flügeln! Doch die Ponys brauchen Emmas Hilfe, um ihre versteckte Lagune vor Stürmen zu schützen.',
    coverColor: 'bg-purple-500 text-purple-950',
    coverPattern: 'stars',
    emoji: '🦄',
    totalCopies: 3,
    availableCopies: 2,
    publishedYear: 2023,
    pages: 96,
    rating: 4.4,
    reviews: []
  },
  {
    id: 'book_7',
    title: 'Mila und der Hacker-Club',
    author: 'Timo Bytes',
    category: 'Detektive & Rätsel',
    ageGroup: '10-12',
    summary: 'Mila bekommt ein altes, seltsames Notebook von ihrem Opa geerbt. Als sie es einschaltet, öffnet sich kein normales Windows, sondern eine rätselhafte Chatbox einer Geheimgruppe an ihrer Schule. Bald merkt Mila, dass ein Betrüger im Internet die Schulkinder hereinlegen will. Mit Programmier-Tricks und Köpfchen nehmen Mila und ihre neuen Nerd-Freunde den Kampf auf.',
    coverColor: 'bg-zinc-800 text-emerald-400 font-mono',
    coverPattern: 'grid',
    emoji: '💻',
    totalCopies: 3,
    availableCopies: 3,
    publishedYear: 2025,
    pages: 160,
    rating: 4.9,
    reviews: [
      { id: 'r6', reviewerName: 'Leon (11)', reviewerAvatar: 'dragon', rating: 5, comment: 'Spannend geschrieben und ich habe echt gelernt, wie man starke Passwörter macht!', date: '2026-06-11' }
    ]
  },
  {
    id: 'book_8',
    title: 'Tief im Korallenriff: Ozean-Abenteuer',
    author: 'Uli Unterwasser',
    category: 'Abenteuer & Natur',
    ageGroup: '10-12',
    summary: 'Schnapp dir deine Taucherbrille! Dieses Buch nimmt dich mit zu den buntesten Ecken des Meeres. Entdecke, wie Delfine miteinander sprechen, wie genial sich Oktopusse tarnen können und warum die Erhaltung der Korallenriffe lebensnotwendig für unseren ganzen Planeten ist. Packendes Naturabenteuer voller spektakulärer Aufnahmen.',
    coverColor: 'bg-teal-500 text-teal-950',
    coverPattern: 'waves',
    emoji: '🪸',
    totalCopies: 4,
    availableCopies: 4,
    publishedYear: 2024,
    pages: 144,
    rating: 4.8,
    reviews: []
  },
  {
    id: 'book_9',
    title: 'Wie man zum Erfinder wird',
    author: 'Klara Pfiffig',
    category: 'Wissen & Sachbuch',
    ageGroup: '10-12',
    summary: 'Flugzeuge, Computer, die Glühbirne und der Klettverschluss – hinter jeder Erfindung steckt eine geniale Idee. In diesem Handbuch erfährst du alles über wegweisende Tüftler. Das Beste: Es gibt 15 spannende Experimente zum Selbermachen zu Hause, wie eine Zitronen-Batterie oder einen Mini-Vulkan!',
    coverColor: 'bg-yellow-500 text-yellow-950',
    coverPattern: 'circles',
    emoji: '💡',
    totalCopies: 3,
    availableCopies: 1,
    publishedYear: 2024,
    pages: 118,
    rating: 4.7,
    reviews: []
  },
  {
    id: 'book_10',
    title: 'Super-Leo: Schule gerettet!',
    author: 'Benno Blitz',
    category: 'Comic & Spaß',
    ageGroup: '8-10',
    summary: 'Leo ist ein ganz normaler Junge, bis er aus Versehen einen Kaugummi herunterschluckt, der mit radioaktiver Kirschbrause getränkt war! Jetzt hat er Superkräfte: Er kann wie ein Flummi 10 Meter hoch springen und Witze so schnell erzählen, dass die Zeit stehen bleibt. Perfekt, um die Diebe aufzuhalten, die das Freibad-Geld klauen wollen!',
    coverColor: 'bg-cyan-500 text-cyan-950',
    coverPattern: 'stripes',
    emoji: '🦸‍♂️',
    totalCopies: 5,
    availableCopies: 3,
    publishedYear: 2025,
    pages: 94,
    rating: 4.6,
    reviews: []
  },
  {
    id: 'book_11',
    title: 'Das Geheimnis von Schloss Drachenstein',
    author: 'Klaus Gruselmann',
    category: 'Fantasie & Märchen',
    ageGroup: '10-12',
    summary: 'Einmal auf einem echten Schloss wohnen! Tim zieht mit seinen Eltern in das verlassene Schloss Drachenstein ein. Doch nachts hört er Geigenmusik aus der Bibliothek und sieht schwebende Kerzen. Zusammen mit dem uralten, aber sehr hungrigen Hausgespenst Ferdinand begibt er sich auf eine geheimnisvolle Schatzsuche durch unterirdische Gänge.',
    coverColor: 'bg-violet-600 text-violet-50',
    coverPattern: 'stars',
    emoji: '🏰',
    totalCopies: 4,
    availableCopies: 2,
    publishedYear: 2024,
    pages: 176,
    rating: 4.8,
    reviews: [
      { id: 'r7', reviewerName: 'Sarah (10)', reviewerAvatar: 'owl', rating: 5, comment: 'Ferdinand das Gespenst war am besten! Er liebt Käsebrote.', date: '2026-06-12' }
    ]
  },
  {
    id: 'book_12',
    title: 'Geheime Botschaften & Geheimschriften',
    author: 'Clemens Code',
    category: 'Wissen & Sachbuch',
    ageGroup: '8-10',
    summary: 'Willst du deinem besten Freund einen Zettel schreiben, den der Lehrer nicht lesen kann? Dieses Buch zeigt dir die genialsten Verschlüsselungen der Weltgeschichte: von den alten Ägyptern über Julius Cäsar bis hin zur unsichtbaren Tinte aus Zitronensaft. Inklusive praktischen Bastelbögen für eigene Codierscheiben!',
    coverColor: 'bg-indigo-600 text-indigo-50',
    coverPattern: 'grid',
    emoji: '✉️',
    totalCopies: 3,
    availableCopies: 3,
    publishedYear: 2023,
    pages: 88,
    rating: 4.7,
    reviews: []
  }
];

export const INITIAL_NEWS: NewsItem[] = [
  {
    id: 'n_1',
    title: '☀️ Sommerferien-Ausleihaktion!',
    date: '18. Juni 2026',
    content: 'Bald gähnen die Schultaschen! Bis zum 25. Juni dürft ihr euch statt 3 sogar bis zu 6 Bücher gleichzeitig ausleihen, damit euch am Badesee oder im Urlaub garantiert nicht der Lesestoff ausgeht. Bringt einfach euren Leseausweis mit!',
    category: 'aktion',
    color: 'bg-amber-100 border-amber-300 text-amber-900',
    rotation: '-rotate-1'
  },
  {
    id: 'n_2',
    title: '🐉 Neue Dino-Bücher eingetroffen!',
    date: '20. Juni 2026',
    content: 'Frisch ausgepackt: Super spannende Abenteuer aus der Kreidezeit und Bilderbücher zu Triceratops und T-Rex sind auf dem grünen Regal eingezogen. Kommt schnell vorbei, bevor alle weggeschnappt sind!',
    category: 'neu',
    color: 'bg-emerald-100 border-emerald-300 text-emerald-900',
    rotation: 'rotate-2'
  },
  {
    id: 'n_3',
    title: '🕵️ Munteres Mitraten beim Krimirätsel!',
    date: '21. Juni 2026',
    content: 'Glückwunsch an Paul aus der Klasse 3b! Er hat das Rätsel um den gestohlenen Schulschlüssel als Erster gelöst und einen Eisgutschein erhalten. Gleich am Eingang hängt das neue Wochenrätsel aus - schaut mal rein!',
    category: 'tipp',
    color: 'bg-sky-100 border-sky-300 text-sky-900',
    rotation: '-rotate-2'
  },
  {
    id: 'n_4',
    title: '⚠️ Geänderte Öffnungszeiten am Donnerstag',
    date: '15. Juni 2026',
    content: 'Liebe Bücherfreunde, am Donnerstag, den 25. Juni, schließt das Team der Schulbücherei wegen einer Lehrer-Fortbildung bereits um 11:30 Uhr. Klärt eure Rückgaben bitte vorher oder nutzt die Rückgabebox am Flur!',
    category: 'wichtig',
    color: 'bg-rose-100 border-rose-300 text-rose-900',
    rotation: 'rotate-1'
  }
];

export const INITIAL_EVENTS: Event[] = [
  {
    id: 'ev_1',
    title: 'Große Lesestunde: Märchen & Sagen',
    date: '2026-06-24', // Wed
    time: '14:30 - 15:30',
    location: 'Zelt der Phantasie (Kuschelecke)',
    icon: 'reading',
    description: 'Frau Müller liest die schönsten Geschichten aus dem Zauberreich. Es gibt weiche Kissen, Sternenlichter und für jeden etwas Saft und Kekse!',
    color: 'border-l-purple-500 bg-purple-50 text-purple-950'
  },
  {
    id: 'ev_2',
    title: 'Bastel-Werkstatt: Eigene Lesezeichen kreieren',
    date: '2026-06-26', // Fri
    time: '13:00 - 14:30',
    location: 'Butil-Tisch am Fenster',
    icon: 'craft',
    description: 'Wir basteln super coole Monster-Ecken, Quasten-Lesezeichen und bemalen hölzerne Buchbegleiter. Scheren und Glitzerkleber stellen wir!',
    color: 'border-l-amber-500 bg-amber-50 text-amber-900'
  },
  {
    id: 'ev_3',
    title: 'Bücherei-Duell: Das große Klassiker-Quiz',
    date: '2026-06-30', // next Tue
    time: '15:00 - 16:00',
    location: 'Am runden Lese-Tisch',
    icon: 'quiz',
    description: 'Testet euer Wissen über Pippi Langstrumpf, Harry Potter und Co.! Tritt mit deinem Team an und gewinne süße Bücherwurm-Trophäen!',
    color: 'border-l-sky-500 bg-sky-50 text-sky-950'
  },
  {
    id: 'ev_4',
    title: 'Spiele-Nachmittag: Brettspiele ausleihen',
    date: '2026-07-03', // next Fri
    time: '13:30 - 15:30',
    location: 'Ganzer Bücherei-Raum',
    icon: 'party',
    description: 'Wir entdecken neue Brettspiele und probieren sie gemeinsam aus. Bringt gerne auch eure eigenen Spiele mit!',
    color: 'border-l-emerald-500 bg-emerald-50 text-emerald-950'
  }
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q_1',
    question: 'Welches freche Mädchen mit roten, abstehenden Zöpfen wohnt ganz allein in der Villa Kunterbunt?',
    options: [
      'Ronja Räubertochter',
      'Pippi Langstrumpf',
      'Conni',
      'Heidi'
    ],
    correctAnswer: 1,
    explanation: 'Pippi Langstrumpf wurde von der berühmten Autorin Astrid Lindgren erfunden! Sie ist super stark und ihr bester Freund ist das Pferd "Kleiner Onkel".',
    bookReference: 'Pippi Langstrumpf'
  },
  {
    id: 'q_2',
    question: 'Wie heißt der treue, magische Eulenfreund von Zauberlehrling Harry Potter?',
    options: [
      'Hedwig',
      'Errol',
      'Hermine',
      'Krosh'
    ],
    correctAnswer: 0,
    explanation: 'Hedwig ist eine wunderschöne weiße Schnee-Eule, die Harry Potter an seinem elften Geburtstag geschenkt bekommen hat.',
    bookReference: 'Harry Potter'
  },
  {
    id: 'q_3',
    question: 'Welches Tier verbirgt sich hinter dem Namen "Wuschel" in unserm Detektiv-Krimi-Buch?',
    options: [
      'Ein dicker Hauskater',
      'Ein grüner Papagei',
      'Ein cleverer Spürhund',
      'Ein kleines Meerschweinchen'
    ],
    correctAnswer: 2,
    explanation: 'Wuschel hilft Detektiv Kluftig dabei, die Kakaodiebe anhand der Schlammspuren in der Schulküche aufzuspüren!',
    bookReference: 'Detektiv Kluftig und der Kakaoraub'
  },
  {
    id: 'q_4',
    question: 'Wer hat Angst vor Knoblauch, schläft tagsüber im Sarg und ist der beste Freund von Anton?',
    options: [
      'Das Burggespenst Ferdinand',
      'Der kleine Vampir (Rüdiger)',
      'Graf Dracula',
      'Der Werwolf Waldemar'
    ],
    correctAnswer: 1,
    explanation: 'Rüdiger von Schlotterstein ist "Der kleine Vampir". Er fliegt nachts heimlich zu Anton ans Fenster und erlebt tolle Abenteuer mit ihm.',
    bookReference: 'Der kleine Vampir'
  },
  {
    id: 'q_5',
    question: 'Wie wehren Jonas und Marie sich in der Kreidezeit gegen Dinos?',
    options: [
      'Sie klettern schnell auf eine Kiefer',
      'Sie werfen mit Schlamm-Kugeln',
      'Sie locken ein Triceratops-Muttertier an',
      'Sie verstecken sich ganz leise in einer Höhle'
    ],
    correctAnswer: 3,
    explanation: 'Sich ganz still und mucksmäuschenstill in einer kleinen Höhlenspalte zu verstecken, rettet Jonas und Marie vor dem hungrigen Raubsaurier!',
    bookReference: 'Auf der Jagd nach dem Saurier-Ei'
  }
];

export const INITIAL_SUGGESTIONS: BookSuggestion[] = [
  {
    id: 's_1',
    title: 'Die Schule der magischen Tiere (Band 1)',
    author: 'Margit Auer',
    reason: 'Weil diese Serie absolut spitze ist! Jedes Kind wünscht sich ein magisches, sprechendes Haustier.',
    suggestorName: 'Leonie (9)',
    votes: 14,
    date: '2026-06-19'
  },
  {
    id: 's_2',
    title: 'Gregs Tagebuch: Von Idioten umzingelt!',
    author: 'Jeff Kinney',
    reason: 'Sehr lustige Zeichnungen, wir lachen alle immer im Bus darüber. Wir brauchen mehr Comic-Romane!',
    suggestorName: 'Nico (10)',
    votes: 19,
    date: '2026-06-20'
  },
  {
    id: 's_3',
    title: 'Lustiges Taschenbuch: Entenhausen in Gefahr',
    author: 'Disney',
    reason: 'LTBs sind einfach perfekt für die Pause, man kann sie superschnell durchlesen und sie machen Laune.',
    suggestorName: 'Anna (8)',
    votes: 8,
    date: '2026-06-21'
  }
];
