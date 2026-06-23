import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Book, LibraryCard, NewsItem, Event, QuizQuestion, BookSuggestion, Review } from './types';
import { 
  INITIAL_BOOKS, 
  INITIAL_NEWS, 
  INITIAL_EVENTS, 
  QUIZ_QUESTIONS, 
  INITIAL_SUGGESTIONS,
  BADGES 
} from './data/initialData';
import Home from './components/Home';
import Catalog from './components/Catalog';
import LibraryCardView from './components/LibraryCardView';
import Quiz from './components/Quiz';
import AdminPanel from './components/AdminPanel';
import LoginPortal from './components/LoginPortal';
import { BookOpen, Calendar, HelpCircle, User, Award, Gift, Sparkles, X, Heart, Smile, Lock } from 'lucide-react';
import { db } from './lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, updateDoc } from 'firebase/firestore';

export default function App() {
  // Navigation active tab
  const [currentTab, setCurrentTab] = useState<'home' | 'catalog' | 'card' | 'quiz' | 'admin'>('home');
  
  // Persistent core states
  const [books, setBooks] = useState<Book[]>(INITIAL_BOOKS);
  const [libraryCard, setLibraryCard] = useState<LibraryCard | null>(() => {
    try {
      const saved = localStorage.getItem('library_card');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>(INITIAL_SUGGESTIONS);
  const [news, setNews] = useState<NewsItem[]>(INITIAL_NEWS);
  const [events, setEvents] = useState<Event[]>(INITIAL_EVENTS);
  const [allCards, setAllCards] = useState<LibraryCard[]>(() => {
    try {
      const saved = localStorage.getItem('library_cards');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [adminUser, setAdminUser] = useState<{ username: string; name: string; role: 'owner' | 'teacher' } | null>(() => {
    try {
      const saved = localStorage.getItem('library_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  
  // High-fidelity UI statuses
  const [alerts, setAlerts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'award' }[]>([]);
  const [showLevelUp, setShowLevelUp] = useState<{ oldLevel: number; newLevel: number } | null>(null);

  // Initialize and load saved state from Firestore
  useEffect(() => {
    const initDb = async () => {
      try {
        const booksRef = doc(db, 'library_data', 'books');
        const booksSnap = await getDoc(booksRef);
        if (!booksSnap.exists()) await setDoc(booksRef, { items: INITIAL_BOOKS });

        const newsRef = doc(db, 'library_data', 'news');
        const newsSnap = await getDoc(newsRef);
        if (!newsSnap.exists()) await setDoc(newsRef, { items: INITIAL_NEWS });

        const suggestionsRef = doc(db, 'library_data', 'suggestions');
        const sugSnap = await getDoc(suggestionsRef);
        if (!sugSnap.exists()) await setDoc(suggestionsRef, { items: INITIAL_SUGGESTIONS });

        const eventsRef = doc(db, 'library_data', 'events');
        const eventsSnap = await getDoc(eventsRef);
        if (!eventsSnap.exists()) await setDoc(eventsRef, { items: INITIAL_EVENTS });

        const usersRef = doc(db, 'library_data', 'users');
        const usersSnap = await getDoc(usersRef);
        if (!usersSnap.exists()) await setDoc(usersRef, { items: [] });
      } catch (err) {
        console.warn('DB init error:', err);
      }
    };
    initDb();

    // 1. Fetch Books
    const booksDocRef = doc(db, 'library_data', 'books');
    const unsubBooks = onSnapshot(booksDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.items)) {
          setBooks(data.items);
        }
      }
    });

    // 2. Fetch News
    const newsDocRef = doc(db, 'library_data', 'news');
    const unsubNews = onSnapshot(newsDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.items)) {
          setNews(data.items);
        }
      }
    });

    // 3. Fetch Suggestions
    const suggestionsDocRef = doc(db, 'library_data', 'suggestions');
    const unsubSug = onSnapshot(suggestionsDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.items)) {
          setSuggestions(data.items);
        }
      }
    });

    // 4. Fetch Events
    const eventsDocRef = doc(db, 'library_data', 'events');
    const unsubEvents = onSnapshot(eventsDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.items)) {
          setEvents(data.items);
        }
      }
    });

    // 5. Fetch All Library Cards
    const usersDocRef = doc(db, 'library_data', 'users');
    const unsubUsers = onSnapshot(usersDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.items)) {
          setAllCards(data.items);
          localStorage.setItem('library_cards', JSON.stringify(data.items));
          
          // Resync logged in user if it matches
          const savedCardStr = localStorage.getItem('library_card');
          if (savedCardStr) {
            const savedCard = JSON.parse(savedCardStr) as LibraryCard;
            const updatedCard = data.items.find((c: LibraryCard) => c.cardNumber === savedCard.cardNumber);
            if (updatedCard) {
              // Update local active state from backend
              setLibraryCard(updatedCard);
              localStorage.setItem('library_card', JSON.stringify(updatedCard));
            }
          }
        }
      }
    });

    return () => {
      unsubBooks();
      unsubNews();
      unsubSug();
      unsubEvents();
      unsubUsers();
    };
  }, []);

  // Sync state changes to Firestore
  const saveBooksState = (updatedBooks: Book[]) => {
    setBooks(updatedBooks);
    setDoc(doc(db, 'library_data', 'books'), { items: updatedBooks });
  };

  const saveCardState = (updatedCard: LibraryCard | null) => {
    setLibraryCard(updatedCard);
    
    // Always load the most recent list of allCards from state or localstorage fallback
    const savedCardsStr = localStorage.getItem('library_cards');
    let currentCards: LibraryCard[] = allCards.length > 0 ? [...allCards] : (savedCardsStr ? JSON.parse(savedCardsStr) : []);

    if (updatedCard) {
      localStorage.setItem('library_card', JSON.stringify(updatedCard));
      // Sync into the global library_cards list
      const index = currentCards.findIndex(c => c.cardNumber === updatedCard.cardNumber);
      if (index >= 0) {
        currentCards[index] = updatedCard;
      } else {
        currentCards.push(updatedCard);
      }
      setAllCards(currentCards);
      localStorage.setItem('library_cards', JSON.stringify(currentCards));
      setDoc(doc(db, 'library_data', 'users'), { items: currentCards });
    } else {
      localStorage.removeItem('library_card');
      // Do not remove from global array since it just means current user logged out. 
      // User deletion goes via ResetCard.
    }
  };

  const handleStudentLogout = () => {
    setLibraryCard(null);
    localStorage.removeItem('library_card');
    addAlert('👋 Erfolgreich abgemeldet! Bis zum nächsten Mal!', 'info');
  };

  const handleTeacherLoginFromPortal = (username: string, pass: string): string | null => {
    const trimmedUser = username.trim().toLowerCase();
    const trimmedPass = pass.trim();

    // 1. Owner Login
    if (trimmedUser === 'owner' && trimmedPass === 'loewenzahn-bibliothek') {
      const newUser = {
        username: 'owner',
        name: 'Schulleitung (Haupt-Admin)',
        role: 'owner'
      } as const;
      setAdminUser(newUser);
      localStorage.setItem('library_admin_user', JSON.stringify(newUser));
      setCurrentTab('admin');
      addAlert('🔓 Als Schulleitung im Lehrerzimmer angemeldet!', 'success');
      return null;
    }

    // 2. Teachers Login
    const savedTeachers = localStorage.getItem('library_teachers');
    const teachersList = savedTeachers ? JSON.parse(savedTeachers) : [
      { id: 't_1', username: 'lehrer1', name: 'Herr Schroeder (Klasse 3b)', password: 'klasse3b' },
      { id: 't_2', username: 'frau.mueller', name: 'Frau Müller (Kuschelecke)', password: 'leseinsel' }
    ];

    const foundTeacher = teachersList.find(
      (t: any) => t.username.toLowerCase() === trimmedUser && t.password === trimmedPass
    );

    if (foundTeacher) {
      const newUser = {
        username: foundTeacher.username,
        name: foundTeacher.name,
        role: 'teacher'
      } as const;
      setAdminUser(newUser);
      localStorage.setItem('library_admin_user', JSON.stringify(newUser));
      setCurrentTab('admin');
      addAlert(`🔓 Willkommen zurück, ${foundTeacher.name}!`, 'success');
      return null;
    }

    return 'Benutzername oder Passwort falsch. Bitte versuche es erneut!';
  };

  const handleTeacherLogout = () => {
    setAdminUser(null);
    localStorage.removeItem('library_admin_user');
    addAlert('👋 Erfolgreich abgemeldet.', 'info');
  };

  const handleTeacherLoginSetUser = (user: { username: string; name: string; role: 'owner' | 'teacher' } | null) => {
    setAdminUser(user);
    if (user) {
      localStorage.setItem('library_admin_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('library_admin_user');
    }
  };

  const saveSuggestionsState = (updatedSuggestions: BookSuggestion[]) => {
    setSuggestions(updatedSuggestions);
    setDoc(doc(db, 'library_data', 'suggestions'), { items: updatedSuggestions });
  };

  // Trigger floating alert toast helper
  const addAlert = (message: string, type: 'success' | 'info' | 'award' = 'success') => {
    const id = Date.now().toString();
    setAlerts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(alert => alert.id !== id));
    }, 4500);
  };

  // Sound synthesizer for achievements & level ups
  const playCelebrateSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(freq, start);
        gainNode.gain.setValueAtTime(0.08, start);
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.start(start);
        osc.stop(start + duration);
      };

      // Play a beautiful triumphant arpeggio
      playTone(261.63, now, 0.15); // C4
      playTone(329.63, now + 0.1, 0.15); // E4
      playTone(392.00, now + 0.2, 0.15); // G4
      playTone(523.25, now + 0.3, 0.18); // C5
      playTone(659.25, now + 0.45, 0.35); // E5
    } catch (e) {
      // Ignored if sound system is blocked by browser restrictions
    }
  };

  // Universal XP award & badges checker logic
  const awardXP = (xpAmount: number, specificBadgeId?: string, currentCardState: LibraryCard | null = libraryCard) => {
    if (!currentCardState) return;

    let updatedXP = currentCardState.xp + xpAmount;
    let currentLevel = currentCardState.level;
    let xpNeeded = currentLevel * 35;
    let didLevelUp = false;
    let oldLevel = currentLevel;

    // Process potential multiple level ups
    while (updatedXP >= xpNeeded) {
      updatedXP -= xpNeeded;
      currentLevel += 1;
      xpNeeded = currentLevel * 35;
      didLevelUp = true;
    }

    const updatedBadges = [...currentCardState.badges];
    if (specificBadgeId && !updatedBadges.includes(specificBadgeId)) {
      updatedBadges.push(specificBadgeId);
      addAlert(`🏅 Neues Abzeichen verliehen: "${BADGES.find(b => b.id === specificBadgeId)?.title}"!`, 'award');
      playCelebrateSound();
    }

    // Check custom trigger-based badges
    // 1. Borrower three badge
    if (currentCardState.borrowedBooks.length >= 3 && !updatedBadges.includes('badge_borrow_three')) {
      updatedBadges.push('badge_borrow_three');
      addAlert('🏅 Auszeichnung freigeschaltet: "Sammel-Meister"! (Drei Bücher)', 'award');
      playCelebrateSound();
    }

    const updatedCard: LibraryCard = {
      ...currentCardState,
      xp: updatedXP,
      level: currentLevel,
      badges: updatedBadges
    };

    saveCardState(updatedCard);

    if (didLevelUp) {
      setTimeout(() => {
        setShowLevelUp({ oldLevel, newLevel: currentLevel });
        playCelebrateSound();
      }, 500);
    }
  };

  // App API: Create new library card card
  const handleRegister = (name: string, avatarId: string) => {
    const newCard: LibraryCard = {
      name,
      avatar: avatarId,
      cardNumber: `SB-${Math.floor(100000 + Math.random() * 900000)}`,
      level: 1,
      xp: 0,
      badges: [],
      borrowedBooks: [],
      bookmarks: [],
      reservations: []
    };

    saveCardState(newCard);
    addAlert(`🎉 Herzlich willkommen, ${name}! Dein Leseausweis wurde erfolgreich erstellt.`, 'success');
  };

  // App API: Book reservation / placement logic
  const handleReserve = (bookId: string) => {
    if (!libraryCard) {
      addAlert('🎟️ Hoppla! Du brauchst zuerst einen Leseausweis. Klicke im Menü auf "🎟️ Mein Ausweis"!', 'info');
      setCurrentTab('card');
      return;
    }

    const targetBook = books.find(b => b.id === bookId);
    if (!targetBook) return;

    // Check duplication
    const isAlreadyReserved = libraryCard.reservations.includes(bookId);
    const isAlreadyBorrowed = libraryCard.borrowedBooks.some(b => b.bookId === bookId);
    
    if (isAlreadyReserved || isAlreadyBorrowed) {
      addAlert('📚 Du hast dieses Buch bereits reserviert oder ausgeliehen!', 'info');
      return;
    }

    // Calculate copy availability
    const isAvailable = targetBook.availableCopies > 0;
    
    let updatedBooks = books.map(b => {
      if (b.id === bookId && isAvailable) {
        return { ...b, availableCopies: b.availableCopies - 1 };
      }
      return b;
    });

    saveBooksState(updatedBooks);

    const updatedCard = {
      ...libraryCard,
      reservations: [...libraryCard.reservations, bookId]
    };

    saveCardState(updatedCard);

    if (isAvailable) {
      addAlert(`📚 "${targetBook.title}" reserviert! Berti hat es ins Abholregal gestellt.`, 'success');
      // Award 5 XP for reservation
      awardXP(8, undefined, updatedCard);
    } else {
      addAlert(`⏳ Für "${targetBook.title}" vorgemerkt (Warteschlange)!`, 'info');
      awardXP(5, undefined, updatedCard);
    }
  };

  // App API: Bookmark / Wishlist toggler
  const handleBookmark = (bookId: string) => {
    if (!libraryCard) {
      addAlert('🎟️ Du brauchst zuerst einen Leseausweis im Menü "🎟️ Mein Ausweis"!', 'info');
      setCurrentTab('card');
      return;
    }

    const isBookmarked = libraryCard.bookmarks.includes(bookId);
    let updatedBookmarks: string[];

    if (isBookmarked) {
      updatedBookmarks = libraryCard.bookmarks.filter(id => id !== bookId);
      addAlert('💔 Buch von deinem Wunschzettel entfernt.', 'info');
    } else {
      updatedBookmarks = [...libraryCard.bookmarks, bookId];
      addAlert('💖 Buch auf deinen Wunschzettel gelegt!', 'success');
    }

    saveCardState({
      ...libraryCard,
      bookmarks: updatedBookmarks
    });
  };

  // App API: Review posting logic
  const handleAddReview = (bookId: string, reviewData: Omit<Review, 'id' | 'date'>) => {
    const newId = `rev_${Date.now()}`;
    const formattedDate = new Date().toISOString().split('T')[0];
    
    const newReview: Review = {
      id: newId,
      ...reviewData,
      date: formattedDate
    };

    const updatedBooks = books.map(b => {
      if (b.id === bookId) {
        const newReviews = [...b.reviews, newReview];
        // Calculate new weighted rating score
        const totalRating = newReviews.reduce((sum, r) => sum + r.rating, 0);
        const newRating = parseFloat((totalRating / newReviews.length).toFixed(1));
        return {
          ...b,
          reviews: newReviews,
          rating: newRating
        };
      }
      return b;
    });

    saveBooksState(updatedBooks);
    
    if (libraryCard) {
      addAlert('✍️ Danke für deine Buchkritik! +10 XP erhalten.', 'success');
      awardXP(10, 'badge_review');
    } else {
      addAlert('✍️ Danke für deine Kritik! Sie wurde unter dem Buch veröffentlicht.', 'success');
    }
  };

  // App API: Book return logic
  const handleReturnBook = (bookId: string) => {
    if (!libraryCard) return;

    const targetBook = books.find(b => b.id === bookId);
    if (!targetBook) return;

    // Put copy back in stock
    const updatedBooks = books.map(b => {
      if (b.id === bookId) {
        return { ...b, availableCopies: Math.min(b.totalCopies, b.availableCopies + 1) };
      }
      return b;
    });
    saveBooksState(updatedBooks);

    // Filter out from borrowedBooks
    const updatedCard = {
      ...libraryCard,
      borrowedBooks: libraryCard.borrowedBooks.filter(item => item.bookId !== bookId)
    };

    saveCardState(updatedCard);
    addAlert(`👍 "${targetBook.title}" zurückgebracht! +15 XP erhalten.`, 'success');
    awardXP(15, undefined, updatedCard);
  };

  // App API: Pick up / checkout reserved book
  const handlePickUpReservation = (bookId: string) => {
    if (!libraryCard) return;

    const targetBook = books.find(b => b.id === bookId);
    if (!targetBook) return;

    const todayStr = new Date("2026-06-22").toISOString().split('T')[0];
    const dueTime = new Date("2026-06-22");
    dueTime.setDate(dueTime.getDate() + 14);
    const dueStr = dueTime.toISOString().split('T')[0];

    const newBorrow = {
      bookId,
      borrowDate: todayStr,
      dueDate: dueStr
    };

    // Remove from reservations, add to borrowedBooks
    const updatedCard = {
      ...libraryCard,
      reservations: libraryCard.reservations.filter(id => id !== bookId),
      borrowedBooks: [...libraryCard.borrowedBooks, newBorrow]
    };

    saveCardState(updatedCard);
    addAlert(`🎒 Du hast "${targetBook.title}" ausgeliehen! Frist bis ${dueStr}`, 'success');
    awardXP(10, 'first_book', updatedCard);
  };

  // App API: Submit book suggestions for wishbox
  const handleAddSuggestion = (suggestionData: Omit<BookSuggestion, 'id' | 'date' | 'votes'>) => {
    const newId = `sug_${Date.now()}`;
    const formattedDate = new Date().toISOString().split('T')[0];

    const newSug: BookSuggestion = {
      id: newId,
      ...suggestionData,
      votes: 1,
      date: formattedDate
    };

    const updated = [newSug, ...suggestions];
    saveSuggestionsState(updated);
    addAlert('✨ Wunsch erfolgreich eingereicht! Andere Kinder können nun abstimmen.', 'success');

    if (libraryCard) {
      awardXP(8, 'badge_suggest');
    }
  };

  // App API: Upvote suggestions
  const handleVoteSuggestion = (suggestionId: string) => {
    const updated = suggestions.map(s => {
      if (s.id === suggestionId) {
        return { ...s, votes: s.votes + 1 };
      }
      return s;
    });

    saveSuggestionsState(updated);
    addAlert('👍 Deine Stimme für das Buch wurde gezählt!', 'success');
  };

  const handleCancelReservation = (bookId: string) => {
    if (!libraryCard) return;

    const targetBook = books.find(b => b.id === bookId);
    if (!targetBook) return;

    const isReadyForPickup = targetBook.availableCopies < targetBook.totalCopies;
    let updatedBooks = books.map(b => {
      if (b.id === bookId && isReadyForPickup) {
        return { ...b, availableCopies: Math.min(b.totalCopies, b.availableCopies + 1) };
      }
      return b;
    });

    saveBooksState(updatedBooks);

    const updatedCard = {
      ...libraryCard,
      reservations: libraryCard.reservations.filter(id => id !== bookId)
    };

    saveCardState(updatedCard);
    addAlert(`❌ Reservierung für "${targetBook.title}" storniert.`, 'info');
  };

  const handleRemoveSuggestion = (id: string) => {
    const updated = suggestions.filter(s => s.id !== id);
    saveSuggestionsState(updated);
    addAlert('🗑️ Buchwunsch wurde gelöscht.', 'info');
  };

  const handleRemoveReview = (bookId: string, reviewId: string) => {
    const updatedBooks = books.map(b => {
      if (b.id === bookId) {
        const filteredReviews = b.reviews.filter(r => r.id !== reviewId);
        let newRating = 0;
        if (filteredReviews.length > 0) {
          const totalRating = filteredReviews.reduce((sum, r) => sum + r.rating, 0);
          newRating = parseFloat((totalRating / filteredReviews.length).toFixed(1));
        }
        return {
          ...b,
          reviews: filteredReviews,
          rating: newRating
        };
      }
      return b;
    });

    saveBooksState(updatedBooks);
    addAlert('🗑️ Buchkritik gelöscht.', 'info');
  };

  // Administrative API: Book creation, removal and copy count updates
  const handleAddNewBookByTeacher = (newBook: Book) => {
    const updated = [...books, newBook];
    saveBooksState(updated);
  };

  const handleRemoveBookByTeacher = (bookId: string) => {
    const updated = books.filter(b => b.id !== bookId);
    saveBooksState(updated);

    // Also clean up any references to this deleted book on the library card
    if (libraryCard) {
      const isReserved = libraryCard.reservations.includes(bookId);
      const isBorrowed = libraryCard.borrowedBooks.some(item => item.bookId === bookId);
      const isBookmarked = libraryCard.bookmarks.includes(bookId);

      if (isReserved || isBorrowed || isBookmarked) {
        const cleanedCard = {
          ...libraryCard,
          reservations: libraryCard.reservations.filter(id => id !== bookId),
          borrowedBooks: libraryCard.borrowedBooks.filter(item => item.bookId !== bookId),
          bookmarks: libraryCard.bookmarks.filter(id => id !== bookId)
        };
        saveCardState(cleanedCard);
      }
    }

    addAlert('🗑️ Buch wurde erfolgreich aus dem Bestand gelöscht.', 'info');
  };

  const handleUpdateBookCopiesByTeacher = (bookId: string, total: number, available: number) => {
    const updated = books.map(b => {
      if (b.id === bookId) {
        return { ...b, totalCopies: total, availableCopies: available };
      }
      return b;
    });
    saveBooksState(updated);
  };

  const handleAddNewNews = (newNews: NewsItem) => {
    const updated = [newNews, ...news];
    setNews(updated);
    setDoc(doc(db, 'library_data', 'news'), { items: updated });
  };

  const handleRemoveNews = (newsId: string) => {
    const updated = news.filter(n => n.id !== newsId);
    setNews(updated);
    setDoc(doc(db, 'library_data', 'news'), { items: updated });
    addAlert('🗑️ Mitteilung wurde vom Schwarzen Brett gelöscht.', 'info');
  };

  const handleAddNewEvent = (newEvent: Event) => {
    const updated = [...events, newEvent];
    setEvents(updated);
    setDoc(doc(db, 'library_data', 'events'), { items: updated });
  };

  const handleRemoveEvent = (eventId: string) => {
    const updated = events.filter(e => e.id !== eventId);
    setEvents(updated);
    setDoc(doc(db, 'library_data', 'events'), { items: updated });
    addAlert('🗑️ Termin wurde aus dem Kalender gelöscht.', 'info');
  };

  // App API: Reset / Clear library card card to restart fresh
  const handleResetCard = () => {
    // Return all copies of currently borrowed books to stock first
    if (libraryCard) {
      const updatedBooks = books.map(b => {
        const isBorrowed = libraryCard.borrowedBooks.some(item => item.bookId === b.id);
        const isReserved = libraryCard.reservations.includes(b.id);
        
        let bonusCopies = 0;
        if (isBorrowed) bonusCopies += 1;
        if (isReserved && b.availableCopies < b.totalCopies) {
          // Put back what was secured
          bonusCopies += 1;
        }

        return {
          ...b,
          availableCopies: Math.min(b.totalCopies, b.availableCopies + bonusCopies)
        };
      });

      saveBooksState(updatedBooks);

      try {
        const savedCardsStr = localStorage.getItem('library_cards');
        let currentCards: LibraryCard[] = allCards.length > 0 ? [...allCards] : (savedCardsStr ? JSON.parse(savedCardsStr) : []);
        
        const filtered = currentCards.filter(c => c.cardNumber !== libraryCard.cardNumber);
        setAllCards(filtered);
        localStorage.setItem('library_cards', JSON.stringify(filtered));
        setDoc(doc(db, 'library_data', 'users'), { items: filtered });
      } catch (e) {
        console.error("Failed to remove card from list during reset", e);
      }
    }

    saveCardState(null);
    addAlert('🎟️ Dein Bibliotheks-Ausweis wurde gelöscht.', 'info');
  };

  // If not logged in as student AND not logged in as teacher, show the gating portal
  if (!libraryCard && !adminUser) {
    return (
      <LoginPortal
        onRegisterStudent={handleRegister}
        availableCards={allCards}
        onLoginStudent={(card) => {
          setLibraryCard(card);
          localStorage.setItem('library_card', JSON.stringify(card));
          addAlert(`🎉 Willkommen zurück, ${card.name}!`, 'success');
          setCurrentTab('home');
        }}
        onLoginTeacher={handleTeacherLoginFromPortal}
      />
    );
  }

  return (
    <div className="bg-natural-bg text-natural-text min-h-screen font-sans flex flex-col antialiased">
      
      {/* Top Banner Branding / Header */}
      <header className="bg-white border-b border-natural-border sticky top-0 z-40 shadow-sm" id="app-header">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          
          {/* Logo brand */}
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setCurrentTab('home')}>
            <div className="bg-natural-green p-2.5 rounded-2xl text-white shadow-sm flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-display font-bold text-natural-dark tracking-tight flex items-center gap-2">
                Schulbücherei - AGG 🦁📖
              </h1>
              <p className="text-xs text-natural-muted mt-0.5 font-sans leading-none flex items-center gap-1">
                <span>🐛</span> Berti der Bücherwurm wartet auf dich!
              </p>
            </div>
          </div>

          {/* Core Interactive Tabs Menu */}
          <nav className="flex flex-wrap bg-natural-soft/50 p-1.5 rounded-2xl border border-natural-border gap-1">
            <button
              onClick={() => setCurrentTab('home')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 pointer ${
                currentTab === 'home'
                  ? 'bg-natural-green text-white shadow-sm'
                  : 'text-natural-text hover:bg-natural-hover/80 hover:text-natural-dark'
              }`}
              id="tab-btn-home"
            >
              <Smile className="w-4 h-4" />
              <span>Lese-Insel</span>
            </button>
            <button
              onClick={() => setCurrentTab('catalog')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 pointer ${
                currentTab === 'catalog'
                  ? 'bg-natural-coral text-white shadow-sm'
                  : 'text-natural-text hover:bg-natural-hover/80 hover:text-natural-dark'
              }`}
              id="tab-btn-catalog"
            >
              <BookOpen className="w-4 h-4" />
              <span>Bücher-Kosmos</span>
            </button>
            <button
              onClick={() => setCurrentTab('quiz')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 pointer ${
                currentTab === 'quiz'
                  ? 'bg-natural-gold text-natural-dark shadow-sm'
                  : 'text-natural-text hover:bg-natural-hover/80 hover:text-natural-dark'
              }`}
              id="tab-btn-quiz"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Buch-Quiz</span>
            </button>
            <button
              onClick={() => setCurrentTab('card')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 relative pointer ${
                currentTab === 'card'
                  ? 'bg-natural-dark text-white shadow-sm'
                  : 'text-natural-text hover:bg-natural-hover/80 hover:text-natural-dark'
              }`}
              id="tab-btn-card"
            >
              <User className="w-4 h-4" />
              <span>Mein Ausweis</span>
              {libraryCard && (
                <span className="absolute -top-1.5 -right-1 bg-natural-coral text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs leading-none">
                  Lvl {libraryCard.level}
                </span>
              )}
            </button>
            <button
              onClick={() => setCurrentTab('admin')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 pointer ${
                currentTab === 'admin'
                  ? 'bg-natural-green text-white shadow-sm'
                  : 'text-natural-text hover:bg-natural-hover/80 hover:text-natural-dark'
              }`}
              id="tab-btn-admin"
            >
              <Lock className="w-4 h-4" />
              <span>Lehrerzimmer</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Floating active alerts container */}
      <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {alerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className={`p-4 rounded-2xl shadow-lg border-l-4 flex items-start gap-3 pointer-events-auto bg-white ${
                alert.type === 'award'
                  ? 'border-l-natural-coral text-natural-dark border-natural-border border'
                  : alert.type === 'info'
                    ? 'border-l-natural-gold text-natural-dark border-natural-border border'
                    : 'border-l-natural-green text-natural-dark border-natural-border border'
              }`}
            >
              <span className="text-xl select-none leading-none">
                {alert.type === 'award' ? '🏅' : alert.type === 'info' ? '💡' : '🎉'}
              </span>
              <p className="text-xs sm:text-sm font-semibold flex-1 leading-snug">
                {alert.message}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Master Content Router */}
      <main className="flex-grow max-w-7xl mx-auto px-4 md:px-6 py-8 w-full">
        {books.length > 0 && (
          <AnimatePresence mode="wait">
            {currentTab === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
              >
                <Home 
                  news={news} 
                  events={events} 
                  onNavigate={(tab) => setCurrentTab(tab)} 
                />
              </motion.div>
            )}

            {currentTab === 'catalog' && (
              <motion.div
                key="catalog"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
              >
                <Catalog
                  books={books}
                  libraryCard={libraryCard}
                  onReserve={handleReserve}
                  onBookmark={handleBookmark}
                  onAddReview={handleAddReview}
                  onRemoveReview={handleRemoveReview}
                  isAdmin={!!adminUser}
                  suggestions={suggestions}
                  onAddSuggestion={handleAddSuggestion}
                  onVoteSuggestion={handleVoteSuggestion}
                  onRemoveSuggestion={handleRemoveSuggestion}
                />
              </motion.div>
            )}

            {currentTab === 'card' && (
              <motion.div
                key="card"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
              >
                <LibraryCardView
                  libraryCard={libraryCard}
                  books={books}
                  onRegister={handleRegister}
                  onReturnBook={handleReturnBook}
                  onPickUpReservation={handlePickUpReservation}
                  onCancelReservation={handleCancelReservation}
                  onRemoveBookmark={handleBookmark}
                  onResetCard={handleResetCard}
                  onNavigateToCatalog={() => setCurrentTab('catalog')}
                  onLogout={handleStudentLogout}
                />
              </motion.div>
            )}

            {currentTab === 'quiz' && (
              <motion.div
                key="quiz"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
              >
                <Quiz
                  libraryCard={libraryCard}
                  books={books}
                  onAwardXP={(xpAmount, badgeId) => awardXP(xpAmount, badgeId)}
                />
              </motion.div>
            )}

            {currentTab === 'admin' && (
              <motion.div
                key="admin"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
              >
                <AdminPanel
                  books={books}
                  onAddBook={handleAddNewBookByTeacher}
                  onRemoveBook={handleRemoveBookByTeacher}
                  onUpdateCopies={handleUpdateBookCopiesByTeacher}
                  currentUser={adminUser}
                  onLogin={handleTeacherLoginSetUser}
                  onLogout={handleTeacherLogout}
                  news={news}
                  onAddNews={handleAddNewNews}
                  onRemoveNews={handleRemoveNews}
                  events={events}
                  onAddEvent={handleAddNewEvent}
                  onRemoveEvent={handleRemoveEvent}
                  suggestions={suggestions}
                  onRemoveSuggestion={handleRemoveSuggestion}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Playful level-up celebration overlay modal */}
      <AnimatePresence>
        {showLevelUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.7, opacity: 0, rotate: -5 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.7, opacity: 0, rotate: 5 }}
              className="bg-white rounded-[40px] p-8 max-w-sm w-full text-center border border-natural-border shadow-2xl space-y-6 relative overflow-hidden"
              id="levelup-celebration-popup"
            >
              {/* Confetti graphics / Border highlight line */}
              <div className="absolute top-0 inset-x-0 h-2 bg-linear-to-r from-natural-coral via-natural-gold to-natural-green" />
              <button
                onClick={() => setShowLevelUp(null)}
                className="absolute top-4 right-4 text-natural-muted hover:text-natural-dark p-1 rounded-full bg-natural-soft"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-7xl animate-bounce select-none">🎉🐛🆙</div>
              
              <div className="space-y-1">
                <span className="bg-natural-green/15 text-natural-green text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full">
                  Lese-Aufstieg!
                </span>
                <h3 className="text-2xl font-display font-bold text-natural-dark pt-2">
                  Level {showLevelUp.newLevel} erreicht!
                </h3>
                <p className="text-xs text-natural-muted font-medium font-sans">
                  Klasse Arbeit, deine Bücherwurm-Macht wächst rasant!
                </p>
              </div>

              {/* Star sparkles banner */}
              <div className="bg-natural-soft p-4 border border-natural-border rounded-2xl flex items-center justify-center gap-3 text-natural-dark">
                <Sparkles className="w-6 h-6 text-natural-gold" />
                <span className="text-base font-bold">Lese-Bonus freigeschaltet!</span>
                <Sparkles className="w-6 h-6 text-natural-gold" />
              </div>

              <p className="text-xs text-natural-text">
                Lese fleißig weiter, um neue tolle Abzeichen zu gewinnen und Bertis bester Freund zu werden!
              </p>

              <button
                onClick={() => setShowLevelUp(null)}
                className="w-full bg-natural-green hover:bg-natural-green-dark text-white font-bold py-3.5 rounded-xl shadow-md cursor-pointer transition-colors"
              >
                Weiter geht's! 🌟
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Decorative footer */}
      <footer className="bg-[#F1EFE9]/40 py-6 border-t border-natural-border mt-16 text-center text-xs text-natural-muted font-sans animate-fade-in">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <div>🦁 Schulbücherei - AGG</div>
          <div className="text-[10pt] text-natural-muted/80">Mit Liebe für kleine Entdecker und Leseratten entwickelt.</div>
        </div>
      </footer>

    </div>
  );
}
