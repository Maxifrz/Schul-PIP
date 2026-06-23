import React, { useState, useEffect } from 'react';
import { Book, Teacher, NewsItem, Event, BookSuggestion } from '../types';
import ConfirmModal from './ConfirmModal';
import { 
  Plus, 
  Trash2, 
  Search, 
  Lock, 
  User, 
  Users, 
  CheckCircle2, 
  BookOpen, 
  PieChart, 
  LogOut, 
  Key, 
  Minus, 
  Sparkles,
  Calendar,
  Bell
} from 'lucide-react';

interface AdminPanelProps {
  books: Book[];
  onAddBook: (newBook: Book) => void;
  onRemoveBook: (bookId: string) => void;
  onUpdateCopies: (bookId: string, total: number, available: number) => void;
  currentUser: { username: string; name: string; role: 'owner' | 'teacher' } | null;
  onLogin: (user: { username: string; name: string; role: 'owner' | 'teacher' } | null) => void;
  onLogout: () => void;
  news: NewsItem[];
  onAddNews: (newNews: NewsItem) => void;
  onRemoveNews: (newsId: string) => void;
  events: Event[];
  onAddEvent: (newEvent: Event) => void;
  onRemoveEvent: (eventId: string) => void;
  suggestions?: BookSuggestion[];
  onRemoveSuggestion?: (id: string) => void;
}

const PRESET_COVERS = [
  { name: 'Smaragd-Grün', value: 'bg-emerald-500 text-emerald-950' },
  { name: 'Kupfer-Orange', value: 'bg-orange-500 text-orange-950' },
  { name: 'Himmel-Blau', value: 'bg-sky-600 text-sky-50' },
  { name: 'Rose-Rot', value: 'bg-rose-500 text-rose-950' },
  { name: 'Tee-Gelb', value: 'bg-yellow-500 text-yellow-950' },
  { name: 'Ozean-Teal', value: 'bg-teal-500 text-teal-950' },
  { name: 'Flieder-Lila', value: 'bg-purple-500 text-purple-950' },
  { name: 'Nacht-Violett', value: 'bg-violet-600 text-violet-50' }
];

const PRESET_EMOJIS = ['📖', '🧙‍♀️', '🕵️‍♂️', '🦖', '🪐', '🐷', '🦄', '💻', '💡', '🦸‍♂️', '🏰', '🦁', '🦊', '🦉', '🐻', '🐰', '🚀', '👽', '⚽'];

const INITIAL_TEACHERS: Teacher[] = [
  { id: 't_1', username: 'lehrer1', name: 'Herr Schroeder (Klasse 3b)', password: 'klasse3b' },
  { id: 't_2', username: 'frau.mueller', name: 'Frau Müller (Kuschelecke)', password: 'leseinsel' }
];

export default function AdminPanel({ 
  books, 
  onAddBook, 
  onRemoveBook, 
  onUpdateCopies,
  currentUser,
  onLogin,
  onLogout,
  news,
  onAddNews,
  onRemoveNews,
  events,
  onAddEvent,
  onRemoveEvent,
  suggestions = [],
  onRemoveSuggestion
}: AdminPanelProps) {
  // Authentication inputs
  const [typedUsername, setTypedUsername] = useState('');
  const [typedPassword, setTypedPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Non-blocking custom confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);

  const askConfirmation = (title: string, message: string, onConfirm: () => void, confirmText?: string) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(null);
      }
    });
  };

  // Active sub tab inside Admin view: 'books' | 'bulletin' | 'teachers' | 'stats' | 'wishes'
  const [activeSubTab, setActiveSubTab] = useState<'books' | 'bulletin' | 'teachers' | 'stats' | 'wishes'>('books');

  // Teachers database state (saved to localStorage so owners can create persistent accounts)
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  // Book manager form inputs
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newCategory, setNewCategory] = useState('Fantasie & Märchen');
  const [newAgeGroup, setNewAgeGroup] = useState<'6-8' | '8-10' | '10-12'>('8-10');
  const [newCoverColor, setNewCoverColor] = useState('bg-emerald-500 text-emerald-950');
  const [newEmoji, setNewEmoji] = useState('📖');
  const [newTotalCopies, setNewTotalCopies] = useState(3);

  // News form inputs
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsCategory, setNewsCategory] = useState<'neu' | 'aktion' | 'wichtig' | 'tipp'>('neu');

  // Events form inputs
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('Schulbücherei 🏫');
  const [eventIcon, setEventIcon] = useState<'reading' | 'craft' | 'party' | 'quiz' | 'book'>('reading');

  // Book search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterAge, setFilterAge] = useState('all');

  // Teacher generator input (Owner only)
  const [newTUsername, setNewTUsername] = useState('');
  const [newTName, setNewTName] = useState('');
  const [newTPassword, setNewTPassword] = useState('');

  // Toast feedback message
  const [actionSuccess, setActionSuccess] = useState('');

  // Load teachers list
  useEffect(() => {
    const savedTeachers = localStorage.getItem('library_teachers');
    if (savedTeachers) {
      setTeachers(JSON.parse(savedTeachers));
    } else {
      setTeachers(INITIAL_TEACHERS);
      localStorage.setItem('library_teachers', JSON.stringify(INITIAL_TEACHERS));
    }
  }, []);

  const saveTeachersList = (updated: Teacher[]) => {
    setTeachers(updated);
    localStorage.setItem('library_teachers', JSON.stringify(updated));
  };

  const showBannerSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => {
      setActionSuccess('');
    }, 4000);
  };

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const trimmedUser = typedUsername.trim().toLowerCase();
    const trimmedPass = typedPassword.trim();

    // 1. Owner Login
    if (trimmedUser === 'owner' && trimmedPass === 'loewenzahn-bibliothek') {
      onLogin({
        username: 'owner',
        name: 'Schulleitung (Haupt-Admin)',
        role: 'owner'
      });
      setTypedUsername('');
      setTypedPassword('');
      return;
    }

    // 2. Teachers Login
    const foundTeacher = teachers.find(
      t => t.username.toLowerCase() === trimmedUser && t.password === trimmedPass
    );

    if (foundTeacher) {
      onLogin({
        username: foundTeacher.username,
        name: foundTeacher.name,
        role: 'teacher'
      });
      setTypedUsername('');
      setTypedPassword('');
      setActiveSubTab('books');
    } else {
      setLoginError('Ungültiger Benutzername oder Passwort. Bitte überprüfe die Daten!');
    }
  };

  // Book Form submit
  const handleCreateBookSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAuthor.trim()) {
      alert('Bitte fülle Titel und Autor:in aus!');
      return;
    }

    // Create custom children-friendly summary dynamically
    const categoriesMap: Record<string, string> = {
      'Fantasie & Märchen': 'Ein zauberhaftes Märchen voller geheimer Magie und fabelhafter Abenteuer!',
      'Detektive & Rätsel': 'Ein hochgradig spannender Krimi zum Detektiv-Miträtseln und Spuren-Suchen.',
      'Abenteuer & Natur': 'Eine aufregende Forschungsreise mitten hinein in die wilde Natur und Ferne!',
      'Wissen & Sachbuch': 'Spannende, unglaubliche Sach-Fakten, die jeden kleinen Forscher schlauer machen.',
      'Comic & Spaß': 'Lachen garantiert! Eine urkomische Geschichte mit witzigen Einfällen.'
    };
    
    const calculatedSummary = `${categoriesMap[newCategory] || 'Ein spannendes neues Lesebuch!'} Entdecke die mitreißende Welten, die ${newAuthor.trim()} für uns geschaffen hat. Perfekt geeignet für Lesestufen der Altersstufe ${newAgeGroup} Jahre. Viel Spaß beim Lesen in der Schule!`;

    const freshBook: Book = {
      id: `book_${Date.now()}`,
      title: newTitle.trim(),
      author: newAuthor.trim(),
      category: newCategory,
      ageGroup: newAgeGroup,
      summary: calculatedSummary, // Removed manual input form as requested!
      coverColor: newCoverColor,
      coverPattern: 'stars', // Default layout pattern as requested to remove!
      emoji: newEmoji,
      totalCopies: Number(newTotalCopies),
      availableCopies: Number(newTotalCopies),
      publishedYear: new Date().getFullYear(),
      pages: 100, // Default page count as requested to remove!
      rating: 5.0,
      reviews: []
    };

    onAddBook(freshBook);
    showBannerSuccess(`🎉 Das Buch "${newTitle}" wurde erfolgreich eingepflegt!`);

    // Reset fields
    setNewTitle('');
    setNewAuthor('');
    setNewTotalCopies(3);
  };

  // Add news submission
  const handleCreateNewsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsTitle.trim() || !newsContent.trim()) {
      alert('Bitte fülle alle Nachrichtenfelder aus!');
      return;
    }

    const rotations = ['rotate-1', '-rotate-1', 'rotate-2', '-rotate-2'];
    const chosenRotation = rotations[Math.floor(Math.random() * rotations.length)];
    
    const colorsMap = {
      neu: 'bg-emerald-50 border-emerald-200',
      aktion: 'bg-amber-50 border-amber-200',
      wichtig: 'bg-rose-50 border-rose-200',
      tipp: 'bg-sky-50 border-sky-200'
    };

    const newNewsItem: NewsItem = {
      id: `news_${Date.now()}`,
      title: newsTitle.trim(),
      date: new Date().toLocaleDateString('de-DE'),
      content: newsContent.trim(),
      category: newsCategory,
      color: colorsMap[newsCategory] || 'bg-white',
      rotation: chosenRotation
    };

    onAddNews(newNewsItem);
    showBannerSuccess(`📌 Neuigkeit "${newsTitle}" erfolgreich auf dem Schwarzen Brett angeheftet!`);
    
    setNewsTitle('');
    setNewsContent('');
    setNewsCategory('neu');
  };

  // Add event submission
  const handleCreateEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDesc.trim() || !eventDate || !eventTime) {
      alert('Bitte fülle alle Pflichtfelder für das Event aus!');
      return;
    }

    const eventColorsMap = {
      reading: 'bg-emerald-50 border-emerald-300',
      craft: 'bg-purple-50 border-purple-300',
      party: 'bg-coral-50 border-coral-300',
      quiz: 'bg-amber-50 border-amber-300',
      book: 'bg-sky-50 border-sky-300'
    };

    const newEventItem: Event = {
      id: `event_${Date.now()}`,
      title: eventTitle.trim(),
      date: eventDate,
      time: eventTime,
      location: eventLocation,
      icon: eventIcon,
      description: eventDesc.trim(),
      color: eventColorsMap[eventIcon] || 'bg-white'
    };

    onAddEvent(newEventItem);
    showBannerSuccess(`📅 Termin "${eventTitle}" wurde erfolgreich im Kalender eingetragen!`);

    setEventTitle('');
    setEventDesc('');
    setEventDate('');
    setEventTime('');
  };

  // Owner admin accounts creation
  const handleCreateTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = newTUsername.trim().toLowerCase().replace(/\s+/g, '');
    const name = newTName.trim();
    const pass = newTPassword.trim();

    if (!user || !name || !pass) {
      alert('Bitte fülle alle Felder aus!');
      return;
    }

    if (user === 'owner') {
      alert('Der Benutzername "owner" ist für die Schulleitung reserviert!');
      return;
    }

    if (teachers.some(t => t.username.toLowerCase() === user)) {
      alert(`Eine Lehrkraft mit dem Benutzernamen "${user}" existiert bereits!`);
      return;
    }

    const newTeacher: Teacher = {
      id: `teach_${Date.now()}`,
      username: user,
      name,
      password: pass,
      createdAt: new Date().toLocaleDateString('de-DE')
    };

    saveTeachersList([...teachers, newTeacher]);
    showBannerSuccess(`👥 Lehrer-Account für "${name}" wurde erfolgreich erstellt!`);

    setNewTUsername('');
    setNewTName('');
    setNewTPassword('');
  };

  const handleDeleteTeacher = (id: string, name: string) => {
    askConfirmation(
      "Lehrkraft löschen?",
      `Soll der Lehrer-Account für "${name}" wirklich gelöscht werden?`,
      () => {
        const filtered = teachers.filter(t => t.id !== id);
        saveTeachersList(filtered);
        showBannerSuccess(`🗑️ Lehrer-Account gelöscht.`);
      },
      "Ja, löschen"
    );
  };

  const modifyStock = (bookId: string, type: 'total' | 'available', delta: number) => {
    const b = books.find(item => item.id === bookId);
    if (!b) return;

    let newTotal = b.totalCopies;
    let newAvailable = b.availableCopies;

    if (type === 'total') {
      newTotal = Math.max(1, b.totalCopies + delta);
      if (delta > 0) {
        newAvailable += delta;
      } else {
        newAvailable = Math.min(newTotal, b.availableCopies);
      }
    } else {
      newAvailable = Math.max(0, Math.min(b.totalCopies, b.availableCopies + delta));
    }

    onUpdateCopies(bookId, newTotal, newAvailable);
    showBannerSuccess(`Bestand für "${b.title}" erfolgreich aktualisiert.`);
  };

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          book.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || book.category === filterCategory;
    const matchesAge = filterAge === 'all' || book.ageGroup === filterAge;
    return matchesSearch && matchesCategory && matchesAge;
  });

  const categories = Array.from(new Set(books.map(b => b.category)));
  const totalPhysicalCopies = books.reduce((sum, b) => sum + b.totalCopies, 0);
  const totalAvailableCopies = books.reduce((sum, b) => sum + b.availableCopies, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8" id="admin-panel-view">
      
      {/* Dynamic Header */}
      <div className="bg-white rounded-[32px] p-6 md:p-8 border border-natural-border shadow-xs flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="space-y-2 text-center md:text-left">
          <span className="bg-natural-green/10 text-natural-green text-xs font-bold uppercase tracking-wider px-3.5 py-1 rounded-full">
            Interne Schul-Plattform
          </span>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-natural-dark">
            Lehrerzimmer & Bücherei-Verwaltung 🔑🔐
          </h2>
          <p className="text-sm text-natural-text max-w-xl">
            Schnittstelle für Lehrer und Schulleitung zum Eintragen neuer Schulbücher, Erstellen von Lehrer-Logins und Hinzufügen von Neuigkeiten / Terminen im Schulleben.
          </p>
        </div>
        <div className="text-5xl select-none filter drop-shadow hidden sm:block">🏫🗝️</div>
      </div>

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-natural-green-dark p-4 rounded-2xl flex items-center gap-2 text-sm font-semibold shadow-xs animate-pulse">
          <CheckCircle2 className="w-5 h-5 text-natural-green flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* LOGIN OVERLAY VIEW */}
      {!currentUser ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
          
          <div className="md:col-span-7 bg-white rounded-[40px] p-8 border border-natural-border shadow-md space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="w-6 h-6 text-natural-coral" />
                <h3 className="text-xl font-display font-bold text-natural-dark">Inhaber- / Lehrer-LogIn</h3>
              </div>
              
              <form onSubmit={handleLogin} className="space-y-4 text-xs font-semibold">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-natural-dark uppercase tracking-wider">Benutzername</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-natural-muted" />
                    <input
                      type="text"
                      required
                      placeholder="z.B. owner oder frau.mueller"
                      value={typedUsername}
                      onChange={(e) => setTypedUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-natural-soft border border-natural-border rounded-xl font-sans text-natural-dark text-sm focus:outline-hidden focus:border-natural-green"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-natural-dark uppercase tracking-wider">Passwort</label>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-natural-muted" />
                    <input
                      type="password"
                      required
                      placeholder="Sicherheitspasswort eingeben..."
                      value={typedPassword}
                      onChange={(e) => setTypedPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-natural-soft border border-natural-border rounded-xl font-sans text-natural-dark text-sm focus:outline-hidden focus:border-natural-green"
                    />
                  </div>
                </div>

                {loginError && (
                  <p className="text-xs font-bold text-natural-coral">{loginError}</p>
                )}

                <button
                  type="submit"
                  className="w-full bg-natural-green hover:bg-natural-green-dark active:scale-95 text-white font-bold py-3.5 rounded-xl shadow-xs transition-all text-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  🚪 Im Lehrerzimmer anmelden
                </button>
              </form>
            </div>
            
            <div className="pt-4 border-t border-natural-border mt-4">
              <p className="text-[11px] text-natural-muted leading-relaxed">
                Lehrkräfte können Bücher und Aushänge für das Schwarze Brett anlegen. Die Schulleitung ('owner') kann zusätzlich Lehrkräfte anlegen und löschen.
              </p>
            </div>
          </div>

          {/* Preset Logs to test seamlessly */}
          <div className="md:col-span-5 bg-[#FAF8F3] rounded-[40px] p-6 border border-natural-border shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-natural-dark">
              <Sparkles className="w-5 h-5 text-natural-gold animate-spin" />
              <h4 className="font-display font-bold text-base">Vorhandene Anmeldedaten</h4>
            </div>
            <p className="text-xs text-natural-text leading-relaxed">
              Nutze diese vorbereiteten Zugänge zum schnellen und unkomplizierten Testen der Schulverwaltung:
            </p>

            {/* Owner card */}
            <div className="bg-white p-4 rounded-2xl border border-natural-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-natural-coral bg-natural-coral/10 px-2.5 py-0.5 rounded-full">🏆 Haupt-Inhaber (Owner)</span>
                <button 
                  onClick={() => { setTypedUsername('owner'); setTypedPassword('loewenzahn-bibliothek'); }}
                  className="text-[10px] bg-natural-soft hover:bg-natural-hover text-natural-dark font-bold px-2 py-0.5 rounded border border-natural-border cursor-pointer transition-colors"
                >
                  Kopieren
                </button>
              </div>
              <div className="grid grid-cols-2 text-xs gap-y-1">
                <span className="text-natural-muted font-bold">Benutzername:</span>
                <code className="text-natural-dark font-bold text-right font-mono bg-natural-soft px-1 rounded">owner</code>
                <span className="text-natural-muted font-bold">Passwort:</span>
                <code className="text-natural-dark font-bold text-right font-mono bg-natural-soft px-1 rounded text-[10px]">loewenzahn-bibliothek</code>
              </div>
            </div>

            {/* Teachers card */}
            <div className="bg-white p-4 rounded-2xl border border-natural-border space-y-2">
              <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
                <span className="text-[11px] font-bold text-natural-green bg-natural-green/10 px-2.5 py-0.5 rounded-full">🎓 Lehrer-Konto</span>
                <button 
                  onClick={() => { setTypedUsername('lehrer1'); setTypedPassword('klasse3b'); }}
                  className="text-[10px] bg-natural-soft hover:bg-natural-hover text-natural-dark font-bold px-2 py-0.5 rounded border border-natural-border cursor-pointer transition-colors"
                >
                  Herr Schroeder
                </button>
              </div>
              <div className="grid grid-cols-2 text-xs gap-y-1">
                <span className="text-natural-muted font-bold">Benutzername:</span>
                <code className="text-natural-dark font-bold text-right font-mono bg-natural-soft px-1 rounded">lehrer1</code>
                <span className="text-natural-muted font-bold">Passwort:</span>
                <code className="text-natural-dark font-bold text-right font-mono bg-natural-soft px-1 rounded">klasse3b</code>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* WORKSPACE WITH ACTIVE LOGIN (WILL SURVIVE DYNAMIC NAVIGATION IN APP.TSX) */
        <div className="space-y-6">
          
          {/* Top user bar */}
          <div className="bg-white p-4 rounded-2xl border border-natural-border flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl select-none">🧑‍🏫</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-natural-dark">{currentUser.name}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white ${
                    currentUser.role === 'owner' ? 'bg-natural-coral' : 'bg-natural-green'
                  }`}>
                    {currentUser.role === 'owner' ? 'Schulleitung (Owner)' : 'Lehrkraft'}
                  </span>
                </div>
                <p className="text-[11px] text-natural-muted font-mono leading-none mt-1">Eingeloggt als: {currentUser.username}</p>
              </div>
            </div>

            {/* Admin Switch tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveSubTab('books')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'books'
                    ? 'bg-natural-dark text-white'
                    : 'text-natural-text hover:bg-natural-soft'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Bücher verwalten</span>
              </button>

              <button
                onClick={() => setActiveSubTab('bulletin')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'bulletin'
                    ? 'bg-natural-dark text-white'
                    : 'text-natural-text hover:bg-natural-soft'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Nachrichten & Termine</span>
              </button>
              
              {currentUser.role === 'owner' && (
                <button
                  onClick={() => setActiveSubTab('teachers')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeSubTab === 'teachers'
                      ? 'bg-natural-dark text-white'
                      : 'text-natural-text hover:bg-natural-soft'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Lehrer-Accounts</span>
                </button>
              )}

              <button
                onClick={() => setActiveSubTab('wishes')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'wishes'
                    ? 'bg-natural-dark text-white'
                    : 'text-natural-text hover:bg-natural-soft'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-natural-gold fill-natural-gold" />
                <span>Wunschbox ({suggestions.length})</span>
              </button>

              <button
                onClick={() => setActiveSubTab('stats')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'stats'
                    ? 'bg-natural-dark text-white'
                    : 'text-natural-text hover:bg-natural-soft'
                }`}
              >
                <PieChart className="w-3.5 h-3.5" />
                <span>Statistiken</span>
              </button>

              <button
                onClick={onLogout}
                className="ml-3 p-2 text-natural-coral hover:bg-natural-coral/10 hover:text-natural-coral rounded-xl transition-colors cursor-pointer"
                title="Sitzung beenden"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* SUBTAB: BOOK MANAGER */}
          {activeSubTab === 'books' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
              
              {/* Form - REMOVED coverPattern, summary, pages input fields as requested */}
              <div className="xl:col-span-5 bg-white p-6 rounded-[32px] border border-natural-border shadow-md space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
                  <Plus className="w-5 h-5 text-natural-green" />
                  <h3 className="font-display font-bold text-base text-natural-dark">Neues Schulbuch hinzufügen</h3>
                </div>

                <form onSubmit={handleCreateBookSubmit} className="space-y-4 text-xs font-semibold">
                  <div className="space-y-1">
                    <label className="text-natural-muted font-bold block">Buchtitel *</label>
                    <input
                      type="text"
                      required
                      placeholder="z.B. Gregs Tagebuch - Die große Welle"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full p-2.5 bg-natural-soft border border-natural-border rounded-xl text-natural-dark focus:outline-hidden focus:border-natural-green inline-block"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-natural-muted font-bold block">Autor:in *</label>
                    <input
                      type="text"
                      required
                      placeholder="z.B. Jeff Kinney"
                      value={newAuthor}
                      onChange={(e) => setNewAuthor(e.target.value)}
                      className="w-full p-2.5 bg-natural-soft border border-natural-border rounded-xl text-natural-dark focus:outline-hidden focus:border-natural-green inline-block"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-natural-muted font-bold block">Kategorie Rubrik</label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="w-full p-2.5 bg-white border border-natural-border rounded-xl text-natural-dark"
                      >
                        <option value="Fantasie & Märchen">Fantasie & Märchen</option>
                        <option value="Detektive & Rätsel">Detektive & Rätsel</option>
                        <option value="Abenteuer & Natur">Abenteuer & Natur</option>
                        <option value="Wissen & Sachbuch">Wissen & Sachbuch</option>
                        <option value="Comic & Spaß">Comic & Spaß</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-natural-muted font-bold block">Zielalter</label>
                      <select
                        value={newAgeGroup}
                        onChange={(e) => setNewAgeGroup(e.target.value as any)}
                        className="w-full p-2.5 bg-white border border-natural-border rounded-xl text-natural-dark text-xs font-sans"
                      >
                        <option value="6-8">6-8 Jahre</option>
                        <option value="8-10">8-10 Jahre</option>
                        <option value="10-12">10-12 Jahre</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-natural-muted font-bold block">Ausleihe-Menge (Freie Exemplare)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="15"
                      value={newTotalCopies}
                      onChange={(e) => setNewTotalCopies(Number(e.target.value))}
                      className="w-full p-2.5 bg-natural-soft border border-natural-border rounded-xl text-natural-dark font-mono text-center"
                    />
                  </div>

                  {/* Dynamic Cover designer options - removed pattern setting! */}
                  <div className="p-3 bg-[#FAF8F4] border border-natural-border rounded-2xl space-y-3">
                    <span className="text-[10px] font-bold text-natural-dark uppercase block text-center">Buchdeckel bestimmen</span>
                    
                    {/* Emoji */}
                    <div>
                      <span className="text-[10px] text-natural-muted block mb-1">Passendes Bild-Symbol (Emoji)</span>
                      <div className="flex flex-wrap gap-1 max-h-[70px] overflow-y-auto bg-white p-2 border border-natural-border rounded-xl justify-center">
                        {PRESET_EMOJIS.map(em => (
                          <button
                            type="button"
                            key={em}
                            onClick={() => setNewEmoji(em)}
                            className={`p-1 text-base rounded-md transition-all border text-center cursor-pointer ${
                              newEmoji === em ? 'bg-natural-gold border-stone-400 scale-110' : 'border-transparent hover:bg-natural-soft'
                            }`}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color selection */}
                    <div>
                      <span className="text-[10px] text-natural-muted block mb-1">Hintergrund-Farbe</span>
                      <div className="grid grid-cols-2 gap-1.5 max-h-[85px] overflow-y-auto p-1 bg-white border border-natural-border rounded-xl">
                        {PRESET_COVERS.map(cov => (
                          <button
                            type="button"
                            key={cov.value}
                            onClick={() => setNewCoverColor(cov.value)}
                            className={`p-1 rounded-lg text-[10px] text-left border cursor-pointer truncate font-medium flex items-center gap-1 ${
                              newCoverColor === cov.value ? 'ring-2 ring-natural-green border-transparent' : 'border-stone-100 hover:bg-natural-soft'
                            }`}
                          >
                            <span className={`w-3 h-3 rounded-full ${cov.value.split(' ')[0]}`} />
                            <span className="truncate">{cov.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-stone-400 leading-tight">
                    * Hinweis: Die Werte für das Einbandmuster, die exakte Seitenzahl sowie der Klappentext werden automatisch kindgerecht bestimmt, um den Prozess zu beschleunigen.
                  </p>

                  <button
                    type="submit"
                    className="w-full bg-natural-green hover:bg-natural-green-dark text-white font-bold py-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buch abspeichern & freigeben</span>
                  </button>
                </form>
              </div>

              {/* Books List Database Monitoring */}
              <div className="xl:col-span-7 bg-white p-6 rounded-[32px] border border-natural-border shadow-md space-y-6">
                
                <div className="flex flex-col md:flex-row gap-3 items-center justify-between pb-3 border-b border-natural-border">
                  <h3 className="font-display font-bold text-base text-natural-dark">
                    📚 Bestandskatalog ({filteredBooks.length} Titel)
                  </h3>

                  <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
                    <input
                      type="text"
                      placeholder="Suchen..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="text-[11px] p-2 bg-natural-soft border border-natural-border rounded-xl focus:outline-hidden text-natural-dark font-sans max-w-[120px]"
                    />
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="text-[10px] text-natural-dark p-2 bg-white border border-natural-border rounded-xl"
                    >
                      <option value="all">Sparten</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-natural-border text-natural-muted font-bold text-[10px] uppercase">
                        <th className="pb-3 pl-1">Decke</th>
                        <th className="pb-3">Werk & Autor</th>
                        <th className="pb-3 text-center">Bestand</th>
                        <th className="pb-3 text-right">Löschen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBooks.map((b) => (
                        <tr key={b.id} className="border-b border-stone-50 hover:bg-natural-soft/20 transition-all font-sans">
                          <td className="py-2.5">
                            <span className="text-2xl select-none leading-none p-1 bg-[#FCFAF5] block text-center rounded-lg border border-natural-border/60 w-9 h-9">
                              {b.emoji}
                            </span>
                          </td>
                          <td className="py-2.5 pr-2">
                            <h4 className="font-bold text-natural-dark leading-tight line-clamp-1">{b.title}</h4>
                            <p className="text-[10px] text-natural-muted">von {b.author}</p>
                          </td>
                          <td className="py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => modifyStock(b.id, 'available', -1)}
                                className="px-1 py-0.5 rounded-sm bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                              >
                                -
                              </button>
                              <strong className="font-mono text-natural-green min-w-[35px] text-center">{b.availableCopies} / {b.totalCopies}</strong>
                              <button
                                onClick={() => modifyStock(b.id, 'available', 1)}
                                className="px-1 py-0.5 rounded-sm bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-[8px] text-stone-400 font-semibold">(frei / gesamt)</span>
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => {
                                askConfirmation(
                                  "Buch löschen?",
                                  `Möchtest du das Buch "${b.title}" wirklich aus dem Bestand löschen?`,
                                  () => {
                                    onRemoveBook(b.id);
                                    showBannerSuccess(`🗑️ Buch "${b.title}" wurde gelöscht.`);
                                  }
                                );
                              }}
                              className="text-natural-coral hover:bg-natural-coral/10 p-1.5 rounded transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          )}

          {/* SUBTAB: BULLETIN (NEWS & EVENTS) */}
          {activeSubTab === 'bulletin' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Nachrichten (News) Form & List */}
              <div className="md:col-span-6 bg-white p-6 rounded-[32px] border border-natural-border shadow-md space-y-6">
                <div className="space-y-1 pb-2 border-b border-stone-100">
                  <div className="flex items-center gap-2 text-natural-green">
                    <Bell className="w-5 h-5" />
                    <h3 className="font-display font-bold text-base text-natural-dark">Schwarzes Brett (Aushänge)</h3>
                  </div>
                  <p className="text-[11px] text-natural-muted">Schreibe eine Neuigkeit für die Homepage der Kinder.</p>
                </div>

                <form onSubmit={handleCreateNewsSubmit} className="space-y-3.5 text-xs font-semibold">
                  <div className="space-y-1">
                    <label className="text-natural-muted font-bold">Überschrift *</label>
                    <input
                      type="text"
                      required
                      placeholder="z.B. Großer Lese-Wettbewerb am Freitag!"
                      value={newsTitle}
                      onChange={(e) => setNewsTitle(e.target.value)}
                      className="w-full p-2.5 bg-natural-soft border border-natural-border rounded-xl text-natural-dark"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-natural-muted font-bold">Inhalt der Ankündigung *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Schreibe deinen Text für die Kinder (Z.B. Bringt eure Lieblingsbücher mit...)"
                      value={newsContent}
                      onChange={(e) => setNewsContent(e.target.value)}
                      className="w-full p-2.5 bg-natural-soft border border-natural-border rounded-xl text-natural-dark resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-natural-muted font-bold block">Art des Beitrags</label>
                    <select
                      value={newsCategory}
                      onChange={(e) => setNewsCategory(e.target.value as any)}
                      className="w-full p-2.5 bg-white border border-natural-border rounded-xl text-natural-dark"
                    >
                      <option value="neu">🆕 Neuigkeit / Ankündigung</option>
                      <option value="aktion">🎉 Sonderaktion / Eventhinweis</option>
                      <option value="wichtig">⚠️ Wichtiger Warnhinweis / Info</option>
                      <option value="tipp">💡 Geheim-Tipp des Monats</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-natural-green hover:bg-natural-green-dark text-white font-bold py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Mitteilung anheften 📌
                  </button>
                </form>

                {/* List of current news with delete hooks */}
                <div className="pt-4 border-t border-natural-border space-y-3">
                  <span className="text-xs font-bold text-natural-dark block">Aktuell veröffentlichte Aushänge:</span>
                  
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {news.map((item) => (
                      <div key={item.id} className="p-3 bg-natural-soft rounded-xl flex justify-between items-start gap-2 border border-natural-border/40">
                        <div className="space-y-1">
                          <span className="text-[10px] text-natural-muted bg-white border border-stone-200 px-1.5 py-0.5 rounded-md font-bold">{item.date}</span>
                          <h4 className="text-[12px] font-bold text-natural-dark line-clamp-1">{item.title}</h4>
                          <p className="text-[11px] text-natural-text line-clamp-1 italic">{item.content}</p>
                        </div>
                        <button
                          onClick={() => {
                            askConfirmation(
                              "Aushang entfernen?",
                              `Soll der Aushang "${item.title}" wirklich vom Schwarzen Brett entfernt werden?`,
                              () => {
                                onRemoveNews(item.id);
                                showBannerSuccess(`🗑️ Aushang "${item.title}" wurde erfolgreich vom Schwarzen Brett entfernt.`);
                              }
                            );
                          }}
                          className="text-natural-coral hover:bg-natural-coral/10 p-1.5 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Column: Kalender Termine (Events) Form & List */}
              <div className="md:col-span-6 bg-white p-6 rounded-[32px] border border-natural-border shadow-md space-y-6">
                <div className="space-y-1 pb-2 border-b border-stone-100">
                  <div className="flex items-center gap-2 text-natural-coral">
                    <Calendar className="w-5 h-5" />
                    <h3 className="font-display font-bold text-base text-natural-dark">Bibliotheks-Terminkalender</h3>
                  </div>
                  <p className="text-[11px] text-natural-muted">Trage anstehende Gruppen-Events, Partys oder Lese-Ecken im Schulhaus ein.</p>
                </div>

                <form onSubmit={handleCreateEventSubmit} className="space-y-3 text-xs font-semibold">
                  <div className="space-y-1">
                    <label className="text-natural-muted font-bold">Event-Name (Titel) *</label>
                    <input
                      type="text"
                      required
                      placeholder="z.B. Lesenacht der 3. Klassen"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      className="w-full p-2 bg-natural-soft border border-natural-border rounded-xl text-natural-dark"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-natural-muted font-bold">Kurze Beschreibung *</label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Kurzer Infotext (z.B. Gemütliches Vorlesen bei Keksen und Saft...)"
                      value={eventDesc}
                      onChange={(e) => setEventDesc(e.target.value)}
                      className="w-full p-2 bg-natural-soft border border-natural-border rounded-xl text-natural-dark resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-natural-muted font-bold">Datum *</label>
                      <input
                        type="date"
                        required
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="w-full p-2 bg-natural-soft border border-natural-border rounded-xl text-natural-dark tracking-wide font-sans text-[11px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-natural-muted font-bold">Zeitspanne *</label>
                      <input
                        type="text"
                        required
                        placeholder="z.B. 14:00 - 15:30"
                        value={eventTime}
                        onChange={(e) => setEventTime(e.target.value)}
                        className="w-full p-2 bg-natural-soft border border-natural-border rounded-xl text-natural-dark"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-natural-muted font-bold block">Veranstaltungsort</label>
                      <input
                        type="text"
                        value={eventLocation}
                        onChange={(e) => setEventLocation(e.target.value)}
                        className="w-full p-2 bg-natural-soft border border-natural-border rounded-xl text-natural-dark"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-natural-muted font-bold block">Art (Symbol)</label>
                      <select
                        value={eventIcon}
                        onChange={(e) => setEventIcon(e.target.value as any)}
                        className="w-full p-2 bg-white border border-natural-border rounded-xl text-natural-dark text-xs"
                      >
                        <option value="reading">📖 Vorlesestunde</option>
                        <option value="craft">🎨 Basteln & Malen</option>
                        <option value="party">🎈 Spielefest / Party</option>
                        <option value="quiz">👑 Quiz-Turnier</option>
                        <option value="book">📕 Buchvorstellung</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-natural-coral hover:bg-natural-coral/95 text-white font-bold py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Termin im Kalender listen 📆
                  </button>
                </form>

                {/* List of current events with delete hooks */}
                <div className="pt-3 border-t border-natural-border space-y-3">
                  <span className="text-xs font-bold text-natural-dark block">Anstehende gelistete Termine:</span>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {events.map((e) => (
                      <div key={e.id} className="p-2.5 bg-stone-50 rounded-xl flex justify-between items-center gap-2 border border-natural-border/30">
                        <div className="text-[11px] font-sans">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{e.icon === 'reading' ? '📖' : e.icon === 'craft' ? '🎨' : e.icon === 'party' ? '🎈' : e.icon === 'quiz' ? '👑' : '📕'}</span>
                            <strong className="text-natural-dark">{e.title}</strong>
                          </div>
                          <div className="text-[10px] text-natural-muted mt-0.5">{e.date} • {e.time} • {e.location}</div>
                        </div>
                        <button
                          onClick={() => {
                            askConfirmation(
                              "Termin löschen?",
                              `Soll der Termin "${e.title}" wirklich aus dem Kalender gelöscht werden?`,
                              () => {
                                onRemoveEvent(e.id);
                                showBannerSuccess(`🗑️ Termin "${e.title}" wurde erfolgreich aus dem Kalender gelöscht.`);
                              }
                            );
                          }}
                          className="text-natural-coral hover:bg-natural-coral/10 p-1.5 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* SUBTAB: TEACHERS REGISTRATION (OWNER ONLY) */}
          {activeSubTab === 'teachers' && currentUser.role === 'owner' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              
              <div className="md:col-span-5 bg-white p-6 rounded-[32px] border border-natural-border shadow-md space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
                  <User className="w-5 h-5 text-natural-coral" />
                  <h3 className="font-display font-bold text-base text-natural-dark">Neues Lehrerkonto anlegen</h3>
                </div>

                <form onSubmit={handleCreateTeacherSubmit} className="space-y-4 text-xs font-semibold">
                  <div className="space-y-1">
                    <label className="text-natural-muted font-bold block">Benutzername (für das Login, Kleingeschrieben)*</label>
                    <input
                      type="text"
                      required
                      placeholder="z.B. frau.mueller"
                      value={newTUsername}
                      onChange={(e) => setNewTUsername(e.target.value)}
                      className="w-full p-2.5 bg-natural-soft border border-natural-border rounded-xl text-natural-dark lowercase inline-block"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-natural-muted font-bold block">Name & Pädagogischer Status *</label>
                    <input
                      type="text"
                      required
                      placeholder="z.B. Frau Müller (Lernwerkstatt)"
                      value={newTName}
                      onChange={(e) => setNewTName(e.target.value)}
                      className="w-full p-2.5 bg-natural-soft border border-natural-border rounded-xl text-natural-dark inline-block"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-natural-muted font-bold block">Sicherheitspasswort *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ein Passwort erfinden..."
                      value={newTPassword}
                      onChange={(e) => setNewTPassword(e.target.value)}
                      className="w-full p-2.5 bg-natural-soft border border-natural-border rounded-xl text-natural-dark inline-block"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-natural-coral hover:bg-natural-coral/95 text-white font-bold py-3 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Account freischalten ✅
                  </button>
                </form>
              </div>

              <div className="md:col-span-7 bg-white p-6 rounded-[32px] border border-natural-border shadow-md space-y-4">
                <h3 className="font-display font-bold text-base text-natural-dark">Gelistetes Schulpersonal</h3>
                
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-natural-border text-natural-muted font-bold">
                        <th className="pb-2.5">Name / Klasse</th>
                        <th className="pb-2.5 font-mono">Username</th>
                        <th className="pb-2.5 font-mono">Passwort</th>
                        <th className="pb-2.5 text-right">Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Owner default row */}
                      <tr className="border-b border-stone-100 bg-[#FAF8F3]">
                        <td className="py-2.5 px-1 font-bold text-natural-dark">Inhaber (Schulleitung)</td>
                        <td className="py-2.5 font-mono text-natural-coral font-bold">owner</td>
                        <td className="py-2.5 font-mono text-natural-muted">loewenzahn-bibliothek</td>
                        <td className="py-2.5 text-right px-1">
                          <span className="text-[10px] text-natural-muted font-bold bg-[#eae6dc] px-1.5 py-0.5 rounded">Gesichert</span>
                        </td>
                      </tr>
                      {/* Dynamic teachers */}
                      {teachers.map((t) => (
                        <tr key={t.id} className="border-b border-stone-100 font-sans text-stone-700">
                          <td className="py-2.5 font-bold text-natural-dark">{t.name}</td>
                          <td className="py-2.5 font-mono text-stone-600 font-semibold">{t.username}</td>
                          <td className="py-2.5 font-mono text-stone-600">{t.password}</td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => handleDeleteTeacher(t.id, t.name)}
                              className="text-natural-coral hover:bg-natural-coral/10 p-1 rounded font-bold"
                            >
                              Löschen
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* SUBTAB: WUNSCHBOX MODERATION */}
          {activeSubTab === 'wishes' && (
            <div className="bg-white p-8 rounded-[40px] border border-natural-border shadow-md space-y-6">
              <div className="space-y-1 pb-3 border-b border-stone-100 flex justify-between items-center">
                <div>
                  <h3 className="font-display font-bold text-base text-natural-dark">✨ Wunschbox-Moderation</h3>
                  <p className="text-xs text-natural-muted">Hier sehen Lehrkräfte die Buchwünsche der Kinder und können diese prüfen oder löschen.</p>
                </div>
                <span className="bg-natural-gold/20 text-natural-dark text-[10px] font-bold px-2 py-1 rounded-full border border-natural-border/40">
                  {suggestions.length} Wünsche eingegangen
                </span>
              </div>

              {suggestions.length === 0 ? (
                <div className="text-center py-8 bg-natural-soft/30 rounded-2xl border border-dashed border-natural-border">
                  <span className="text-5xl">🎉</span>
                  <h4 className="text-sm font-bold text-natural-dark mt-2">Aktuell keine ungelösten Wünsche vorhanden!</h4>
                  <p className="text-xs text-natural-muted">Kinder haben gerade keine Buch-Empfehlungen eingereicht oder alle wurden bearbeitet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-natural-border text-natural-muted font-bold uppercase tracking-wider text-[10px]">
                        <th className="pb-2 px-2">Buch & Autor</th>
                        <th className="pb-2">Vorgeschlagen von</th>
                        <th className="pb-2">Grund / Begründung</th>
                        <th className="pb-2 text-center">Stimmen (Votes)</th>
                        <th className="pb-2">Datum</th>
                        <th className="pb-2 text-right px-2">Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suggestions.map((s) => (
                        <tr key={s.id} className="border-b border-stone-100 hover:bg-natural-soft/15 transition-colors">
                          <td className="py-3 px-2 font-bold text-natural-dark">
                            <span className="text-sm mr-1.5 leading-none inline-block align-middle select-none">📖</span>
                            <span className="align-middle inline-block">{s.title} <span className="text-natural-muted font-normal text-[10px] block">von {s.author}</span></span>
                          </td>
                          <td className="py-3 font-semibold text-stone-700">{s.suggestorName}</td>
                          <td className="py-3 text-natural-text italic max-w-xs truncate" title={s.reason}>"{s.reason}"</td>
                          <td className="py-3 text-center">
                            <span className="bg-natural-soft border border-natural-border/55 px-2.5 py-0.5 rounded-full font-bold font-mono text-natural-green">
                              👍 {s.votes}
                            </span>
                          </td>
                          <td className="py-3 text-natural-muted font-mono">{s.date}</td>
                          <td className="py-3 text-right px-2">
                            <button
                              onClick={() => {
                                askConfirmation(
                                  "Buchwunsch löschen?",
                                  `Soll der Buchwunsch für "${s.title}" wirklich gelöscht werden?`,
                                  () => {
                                    onRemoveSuggestion?.(s.id);
                                  }
                                );
                              }}
                              className="text-natural-coral hover:bg-natural-coral/10 hover:text-natural-coral px-2.5 py-1.5 rounded-lg border border-natural-coral/20 font-bold transition-all cursor-pointer inline-flex items-center gap-1 text-[11px]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Löschen</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SUBTAB: STATISTICS & DATABASE METRICS */}
          {activeSubTab === 'stats' && (
            <div className="bg-white p-8 rounded-[40px] border border-natural-border shadow-md space-y-6">
              <div className="space-y-1 pb-3 border-b border-stone-100">
                <h3 className="font-display font-bold text-base text-natural-dark">📊 Bücherei-Bestandsanalyse & Kennzahlen</h3>
                <p className="text-xs text-natural-muted">Statistische Auswertungen über die Ausleihen und eingelagerten Bücher.</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-[#FAF8F3] p-5 rounded-2xl border border-natural-border space-y-1 text-center">
                  <span className="text-3xl select-none block">📚</span>
                  <span className="text-2xl font-bold font-mono text-natural-dark block pt-2">{books.length}</span>
                  <p className="text-[10px] text-natural-muted uppercase font-bold tracking-wider">Buchtitel</p>
                </div>

                <div className="bg-[#FAF8F3] p-5 rounded-2xl border border-natural-border space-y-1 text-center">
                  <span className="text-3xl select-none block">🗂️</span>
                  <span className="text-2xl font-bold font-mono text-natural-dark block pt-2">{totalPhysicalCopies}</span>
                  <p className="text-[10px] text-natural-muted uppercase font-bold tracking-wider">Physische Exemplare</p>
                </div>

                <div className="bg-[#FAF8F3] p-5 rounded-2xl border border-natural-border space-y-1 text-center">
                  <span className="text-3xl select-none block">🤝</span>
                  <span className="text-2xl font-bold font-mono text-natural-green block pt-2">{totalAvailableCopies}</span>
                  <p className="text-[10px] text-natural-muted uppercase font-bold tracking-wider">Verfügbar</p>
                </div>

                <div className="bg-[#FAF8F3] p-5 rounded-2xl border border-natural-border space-y-1 text-center">
                  <span className="text-3xl select-none block">🎒</span>
                  <span className="text-2xl font-bold font-mono text-natural-coral block pt-2">{totalPhysicalCopies - totalAvailableCopies}</span>
                  <p className="text-[10px] text-natural-muted uppercase font-bold tracking-wider">Aktuell Ausgeliehen</p>
                </div>
              </div>

              <div className="bg-natural-soft p-5 rounded-3xl border border-natural-border/60">
                <span className="text-xs font-bold text-natural-dark block mb-2">📋 Lese-Kategorien Aufteilung:</span>
                <div className="space-y-2">
                  {Array.from(new Set(books.map(b => b.category))).map(cat => {
                    const count = books.filter(b => b.category === cat).length;
                    const percent = Math.round((count / books.length) * 100);
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between items-center text-xs text-natural-dark font-bold">
                          <span>{cat}</span>
                          <span>{count} Bücher ({percent}%)</span>
                        </div>
                        <div className="w-full bg-white rounded-full h-2 border border-natural-border overflow-hidden">
                          <div className="bg-natural-green h-full rounded-full" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Non-blocking custom alert confirmation */}
      {confirmDialog && (
        <ConfirmModal
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

    </div>
  );
}
