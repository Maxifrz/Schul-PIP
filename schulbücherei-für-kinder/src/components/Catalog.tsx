import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Book, Review, LibraryCard, BookSuggestion } from '../types';
import { Search, Star, Bookmark, Heart, BookOpen, Clock, ThumbsUp, Send, CheckCircle, Trash2 } from 'lucide-react';
import MascotMessage from './MascotMessage';
import ConfirmModal from './ConfirmModal';

interface CatalogProps {
  books: Book[];
  libraryCard: LibraryCard | null;
  onReserve: (bookId: string) => void;
  onBookmark: (bookId: string) => void;
  onAddReview: (bookId: string, review: Omit<Review, 'id' | 'date'>) => void;
  onRemoveReview?: (bookId: string, reviewId: string) => void;
  isAdmin?: boolean;
  suggestions: BookSuggestion[];
  onAddSuggestion: (suggestion: Omit<BookSuggestion, 'id' | 'date' | 'votes'>) => void;
  onVoteSuggestion: (suggestionId: string) => void;
  onRemoveSuggestion?: (suggestionId: string) => void;
}

export default function Catalog({
  books,
  libraryCard,
  onReserve,
  onBookmark,
  onAddReview,
  onRemoveReview,
  isAdmin = false,
  suggestions,
  onAddSuggestion,
  onVoteSuggestion,
  onRemoveSuggestion
}: CatalogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAge, setSelectedAge] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  
  // Custom suggestion form states
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newReason, setNewReason] = useState('');
  const [suggestorName, setSuggestorName] = useState('');
  const [showSuggestSuccess, setShowSuggestSuccess] = useState(false);

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

  // New review form states inside details modal
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerAvatar, setReviewerAvatar] = useState('🦉');
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');

  const ageGroups = [
    { value: 'all', label: '🎉 Alle Lese-Verrückten' },
    { value: '6-8', label: '🌟 Erstleser (6-8 Jahre)' },
    { value: '8-10', label: '📖 Bücherwürmer (8-10 Jahre)' },
    { value: '10-12', label: '🚀 Lese-Profis (10-12 Jahre)' }
  ];

  const categories = [
    { value: 'all', label: 'Alle Arten' },
    { value: 'Fantasie & Märchen', label: '🦄 Fantasie' },
    { value: 'Detektive & Rätsel', label: '🕵️‍♂️ Detektive' },
    { value: 'Abenteuer & Natur', label: '🦖 Abenteuer' },
    { value: 'Wissen & Sachbuch', label: '🪐 Wissen' },
    { value: 'Comic & Spaß', label: '🎨 Comic & Spaß' }
  ];

  const handleSuggestionSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAuthor.trim() || !suggestorName.trim()) return;
    
    onAddSuggestion({
      title: newTitle,
      author: newAuthor,
      reason: newReason || 'Einfach ein tolles Buch!',
      suggestorName: suggestorName
    });

    // Reset Form
    setNewTitle('');
    setNewAuthor('');
    setNewReason('');
    setSuggestorName('');
    setShowSuggestSuccess(true);
    setTimeout(() => setShowSuggestSuccess(false), 4000);
  };

  const handleReviewSubmit = (e: FormEvent, bookId: string) => {
    e.preventDefault();
    if (!reviewerName.trim() || !newComment.trim()) return;

    onAddReview(bookId, {
      reviewerName: reviewerName,
      reviewerAvatar: reviewerAvatar,
      rating: newRating,
      comment: newComment
    });

    // Update the selectedBook state on-the-fly to show new review
    const updatedBook = books.find(b => b.id === bookId);
    if (updatedBook) {
      setSelectedBook({
        ...updatedBook,
        reviews: [
          ...updatedBook.reviews,
          {
            id: Date.now().toString(),
            reviewerName,
            reviewerAvatar,
            rating: newRating,
            comment: newComment,
            date: new Date().toISOString().split('T')[0]
          }
        ]
      });
    }

    // Reset reviewer form
    setReviewerName('');
    setNewComment('');
  };

  // Filtering books
  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          book.summary.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAge = selectedAge === 'all' || book.ageGroup === selectedAge;
    const matchesCategory = selectedCategory === 'all' || book.category === selectedCategory;
    return matchesSearch && matchesAge && matchesCategory;
  });

  const getCoverPatternClass = (pattern: string) => {
    switch (pattern) {
      case 'stripes':
        return 'bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:20px_20px]';
      case 'stars':
        return 'bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.2)_20%,transparent_60%)] bg-[size:16px_16px]';
      case 'circles':
        return 'bg-[radial-gradient(circle,rgba(255,255,255,0.15)_10%,transparent_11%)] bg-[length:12px_12px] bg-repeat';
      case 'waves':
        return 'bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.15)_20%,transparent_80%)]';
      case 'grid':
      default:
        return 'bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:10px_10px]';
    }
  };

  return (
    <div className="space-y-8" id="catalog-view">
      {/* Search & Theme Intro */}
      <section className="bg-natural-soft rounded-[40px] p-6 border border-natural-border shadow-xs">
        <h2 className="text-2xl font-display font-bold text-natural-dark mb-2">
          Der Große Bücher-Kosmos 🚀
        </h2>
        <p className="text-sm md:text-base text-natural-text max-w-2xl">
          Suche nach deinem neuen Lieblingsbuch! Du kannst nach Alter filtern oder das Genre wählen, das dich heute am meisten fesselt.
        </p>

        {/* Floating search input */}
        <div className="mt-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-natural-muted w-5 h-5 pointer-events-none" />
            <input
              type="text"
              placeholder="Welches Buch suchst du? (z.B. Zauberwald, Dino, Mila...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-natural-border rounded-2xl focus:outline-hidden focus:border-natural-green font-sans shadow-xs text-base text-natural-text"
              id="search-input"
            />
          </div>
        </div>
      </section>

      {/* Berti the Bookworm's comment on catalog */}
      <MascotMessage 
        message={
          searchTerm 
            ? `Ich suche mit! Wir haben ${filteredBooks.length} tolle Bücher für deine Suche gefunden.` 
            : "Klicke auf die bunten Buchdeckel, um das Inhaltsverzeichnis zu lesen oder eine coole Bewertung abzugeben! Du kannst Bücher auch für den nächsten Schultag reservieren!"
        }
        mood="reading"
      />

      {/* Main Filter Island and Shelves Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white rounded-[40px] p-5 border border-natural-border shadow-sm space-y-4">
            <h3 className="text-base font-display font-bold text-natural-dark border-b border-natural-soft pb-2 flex items-center gap-1.5">
              👶 Dein Alter auswählen
            </h3>
            <div className="flex flex-col gap-2">
              {ageGroups.map((age) => (
                <button
                  key={age.value}
                  onClick={() => setSelectedAge(age.value)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-between pointer ${
                    selectedAge === age.value
                      ? 'bg-natural-green text-white shadow-xs'
                      : 'bg-natural-soft text-natural-text hover:bg-natural-hover'
                  }`}
                >
                  <span>{age.label}</span>
                  {selectedAge === age.value && <span className="text-xs">💪</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[40px] p-5 border border-natural-border shadow-sm space-y-4">
            <h3 className="text-base font-display font-bold text-natural-dark border-b border-natural-soft pb-2 flex items-center gap-1.5">
              🔖 Buchtyp / Genre
            </h3>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`text-xs px-3.5 py-2 rounded-full font-bold uppercase transition-all border pointer ${
                    selectedCategory === cat.value
                      ? 'bg-natural-gold border-natural-gold text-natural-dark shadow-xs'
                      : 'bg-natural-soft hover:bg-natural-hover border-natural-border text-natural-text'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Book Suggestion Box (Wunsch-Box) */}
          <div className="bg-[#F1EFE9]/60 border border-natural-border rounded-[40px] p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-display font-bold text-natural-dark flex items-center gap-1.5">
                <span>🪄</span> Buch-Wunschbox
              </h3>
              <p className="text-xs text-natural-text leading-snug mt-1">
                Gibt es ein tolles Buch, das unsere Bücherei unbedingt kaufen sollte? Trag deinen Wunsch her ein! Andere Kinder können dafür stimmen.
              </p>
            </div>

            {showSuggestSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-natural-green/15 text-natural-green p-2.5 rounded-xl text-xs flex items-center gap-2 font-bold border border-natural-green/30"
              >
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>Super! Dein Wunsch ist in der Box gelandet!</span>
              </motion.div>
            )}

            <form onSubmit={handleSuggestionSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-natural-green uppercase mb-1">
                  Buchtitel *
                </label>
                <input
                  type="text"
                  required
                  placeholder="z.B. Das magische Baumhaus"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2 bg-white border border-natural-border rounded-xl text-xs text-natural-text focus:outline-hidden focus:border-natural-green"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-natural-green uppercase mb-1">
                    Autor *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Mary Pope Osborne"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="w-full p-2 bg-white border border-natural-border rounded-xl text-xs text-natural-text focus:outline-hidden focus:border-natural-green"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-natural-green uppercase mb-1">
                    Dein Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Emil (8)"
                    value={suggestorName}
                    onChange={(e) => setSuggestorName(e.target.value)}
                    className="w-full p-2 bg-white border border-natural-border rounded-xl text-xs text-natural-text focus:outline-hidden focus:border-natural-green"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-natural-green uppercase mb-1">
                  Warum wünschst du es dir?
                </label>
                <textarea
                  placeholder="Weil es super Abenteuer hat..."
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  rows={2}
                  className="w-full p-2 bg-white border border-natural-border rounded-xl text-xs text-natural-text focus:outline-hidden resize-none focus:border-natural-green"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-natural-green hover:bg-natural-green-dark active:scale-95 text-white py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Wunsch einsenden (+XP)</span>
              </button>
            </form>

            {/* Voting List */}
            <div className="border-t border-natural-border pt-4 space-y-2">
              <h4 className="text-[11px] font-bold text-natural-green uppercase">
                Wunschzettel anderer Kinder ({suggestions.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {suggestions.map((s) => (
                  <div key={s.id} className="bg-white border border-natural-border/60 p-2.5 rounded-2xl flex items-start gap-2 justify-between">
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-semibold text-natural-dark truncate" title={s.title}>{s.title}</h5>
                      <p className="text-[10px] text-natural-muted">von {s.author} | {s.suggestorName}</p>
                      <p className="text-[10px] text-natural-muted italic line-clamp-1 mt-0.5">"{s.reason}"</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => onVoteSuggestion(s.id)}
                        className="bg-natural-soft hover:bg-natural-border/80 text-natural-green px-2 py-1.5 rounded-xl flex flex-col items-center gap-0.5 transition-colors pointer"
                      >
                        <ThumbsUp className="w-3.5 h-3.5 fill-natural-soft" />
                        <span className="text-[10px] font-bold leading-none">{s.votes}</span>
                      </button>
                      {isAdmin && (
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
                          className="bg-natural-soft hover:bg-natural-coral/10 hover:text-natural-coral text-natural-muted p-2 rounded-xl transition-all cursor-pointer"
                          title="Buchwunsch löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Books Shelf & Cards - Takes 3 cols */}
        <div className="xl:col-span-3 space-y-8">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-natural-text">
              Es werden <span className="text-natural-dark font-bold bg-natural-soft border border-natural-border/60 px-3 py-1 rounded-full">{filteredBooks.length}</span> von <span className="text-natural-dark font-bold">{books.length}</span> Büchern angezeigt
            </div>
          </div>

          {filteredBooks.length === 0 ? (
            <div className="bg-white rounded-[40px] p-12 text-center border border-dashed border-natural-border">
              <span className="text-5xl">🥺</span>
              <h3 className="text-lg font-display font-bold text-natural-dark mt-4">Oh je, kein Buch gefunden!</h3>
              <p className="text-natural-muted text-sm mt-1">Ändere die Suchbegriffe oder wähle ein anderes Alter aus, damit wir wieder fette Beute machen!</p>
              <button
                onClick={() => { setSearchTerm(''); setSelectedAge('all'); setSelectedCategory('all'); }}
                className="mt-4 bg-natural-green hover:bg-natural-green-dark font-bold text-xs text-white px-5 py-2.5 rounded-xl transition-all pointer shadow-xs"
              >
                Zurücksetzen 🧹
              </button>
            </div>
          ) : (
            /* Traditional Books grid layout with beautiful pseudo-3D books */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredBooks.map((book) => {
                const isBookmarked = libraryCard?.bookmarks.includes(book.id);
                const isReserved = libraryCard?.reservations.includes(book.id);
                const isBorrowed = libraryCard?.borrowedBooks.some(b => b.bookId === book.id);
                const isAvailable = book.availableCopies > 0;

                return (
                  <motion.div
                    key={book.id}
                    layout
                    whileHover={{ y: -8, transition: { duration: 0.2 } }}
                    className="flex flex-col group h-full"
                    id={`book-wrapper-${book.id}`}
                  >
                    {/* Visual Spine & Cover Plate */}
                    <div className="relative flex-1 aspect-[3/4.2] rounded-r-2xl rounded-l-md shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden flex flex-col justify-between p-4 cursor-pointer"
                      style={{ contentVisibility: 'auto' }}
                      onClick={() => setSelectedBook(book)}
                    >
                      {/* Left book spine look gradient overlay */}
                      <div className="absolute top-0 left-0 bottom-0 w-3 bg-gradient-to-r from-black/25 via-white/10 to-transparent rounded-l-md z-20" />
                      
                      {/* Real Book background color */}
                      <div className={`absolute inset-0 ${book.coverColor} z-0`} />
                      
                      {/* Overlay Pattern texture based on custom styles */}
                      <div className={`absolute inset-0 z-1 opacity-15 ${getCoverPatternClass(book.coverPattern)}`} />

                      {/* Header bar on cover */}
                      <div className="relative z-10 flex items-start justify-between">
                        <span className="bg-white/95 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded text-stone-800 shadow-xs border border-stone-200">
                          {book.ageGroup === '6-8' ? '6-8 J.' : book.ageGroup === '8-10' ? '8-10 J.' : '10-12 J.'}
                        </span>
                        
                        {/* Bookmark / Wishlist button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onBookmark(book.id);
                          }}
                          className={`p-1.5 rounded-full transition-colors pointer shadow-xs ${
                            isBookmarked 
                              ? 'bg-natural-coral text-white' 
                              : 'bg-white text-natural-text hover:bg-natural-soft'
                          }`}
                          title="Auf den Wunschzettel setzen"
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-white' : ''}`} />
                        </button>
                      </div>

                      {/* Cover Center Art */}
                      <div className="relative z-10 flex flex-col items-center justify-center py-4">
                        <span className="text-5xl select-none filter drop-shadow-md animate-pulse">
                          {book.emoji}
                        </span>
                      </div>

                      {/* Typography Title and Author */}
                      <div className="relative z-10 bg-white/95 rounded-xl p-2.5 shadow-sm border border-black/5">
                        <h4 className="text-xs font-display font-bold text-natural-dark line-clamp-2 leading-tight">
                          {book.title}
                        </h4>
                        <div className="text-[10px] font-bold text-natural-muted truncate mt-0.5">
                          {book.author}
                        </div>
                      </div>
                    </div>

                    {/* Book footer details & buttons */}
                    <div className="bg-[#FBF9F4] border-x border-b border-natural-border p-3 rounded-b-3xl shadow-sm space-y-2 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-0.5 text-natural-gold font-bold">
                          <Star className="w-3.5 h-3.5 fill-natural-gold text-natural-gold" />
                          {book.rating.toFixed(1)}
                        </span>
                        
                        {/* Short stock status text */}
                        <span className={`font-bold ${isBorrowed ? 'text-blue-600' : isReserved ? 'text-natural-gold' : isAvailable ? 'text-natural-green' : 'text-natural-coral'}`}>
                          {isBorrowed 
                            ? '💻 Gekauft/Ausgeliehen' 
                            : isReserved 
                              ? '🔑 Reserviert' 
                              : isAvailable 
                                ? 'Ausleihbar' 
                                : 'Verliehen'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => setSelectedBook(book)}
                          className="bg-natural-soft hover:bg-natural-hover text-natural-dark text-[11px] font-bold py-1.5 rounded-lg transition-colors pointer flex items-center justify-center gap-1"
                        >
                          <BookOpen className="w-3 h-3" />
                          Reinschauen
                        </button>
                        
                        <button
                          disabled={isBorrowed || isReserved}
                          onClick={() => onReserve(book.id)}
                          className={`text-[11px] font-bold py-1.5 rounded-lg transition-all flex items-center justify-center gap-0.5 pointer ${
                            isBorrowed 
                              ? 'bg-[#EAE6DF] text-[#A39B8E] cursor-not-allowed font-medium'
                              : isReserved
                                ? 'bg-natural-soft border border-natural-gold/50 text-natural-gold cursor-not-allowed font-medium'
                                : isAvailable
                                  ? 'bg-natural-green hover:bg-natural-green-dark text-white'
                                  : 'bg-natural-soft border border-natural-border text-natural-text hover:bg-natural-hover'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {isReserved ? 'Gesichert' : isAvailable ? 'Reservieren' : 'Vormerken'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Book details dialog pop-up */}
      <AnimatePresence>
        {selectedBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[40px] max-w-2xl w-full overflow-hidden shadow-2xl border border-natural-border my-8 flex flex-col max-h-[90vh]"
              id="book-details-modal"
            >
              {/* Modal header with matching book cover background color */}
              <div className={`${selectedBook.coverColor} p-6 relative border-b border-black/10 flex items-start gap-4 flex-shrink-0`}>
                <button
                  onClick={() => setSelectedBook(null)}
                  className="absolute right-4 top-4 p-1 rounded-full bg-white/80 hover:bg-natural-soft text-natural-text hover:text-natural-dark shadow-xs pointer"
                >
                  <span className="text-base">❌</span>
                </button>

                <div className="text-4xl p-3 bg-white/20 rounded-2xl select-none">
                  {selectedBook.emoji}
                </div>
                
                <div className="flex-1 pr-8 text-white">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="bg-white text-stone-900 border border-semibold text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                      {selectedBook.category}
                    </span>
                    <span className="bg-black/25 text-white/90 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                      Alter: {selectedBook.ageGroup} Jahre
                    </span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-display font-medium leading-tight">
                    {selectedBook.title}
                  </h3>
                  <p className="text-xs text-white/90 font-medium">von {selectedBook.author}</p>
                </div>
              </div>

              {/* Scrollable Modal Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
                {/* Book specs */}
                <div className="grid grid-cols-4 gap-2 text-center bg-natural-soft p-3 rounded-2xl border border-natural-border">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-natural-muted uppercase">Seiten</div>
                    <div className="text-sm font-bold text-natural-dark">{selectedBook.pages} 📖</div>
                  </div>
                  <div className="space-y-1 border-l border-natural-border">
                    <div className="text-[10px] font-bold text-natural-muted uppercase">Jahr</div>
                    <div className="text-sm font-bold text-natural-dark">{selectedBook.publishedYear}</div>
                  </div>
                  <div className="space-y-1 border-l border-natural-border">
                    <div className="text-[10px] font-bold text-natural-muted uppercase">Sterne</div>
                    <div className="text-sm font-bold text-natural-gold flex items-center justify-center gap-0.5">
                      ★ {selectedBook.rating.toFixed(1)}
                    </div>
                  </div>
                  <div className="space-y-1 border-l border-natural-border">
                    <div className="text-[10px] font-bold text-natural-muted uppercase">Bestand</div>
                    <div className="text-sm font-bold text-natural-green">
                      {selectedBook.availableCopies}/{selectedBook.totalCopies} frei
                    </div>
                  </div>
                </div>

                {/* Summary section */}
                <div className="space-y-2">
                  <h4 className="text-sm font-display font-bold text-natural-dark uppercase tracking-wider">
                    Worum geht es in dem Buch?
                  </h4>
                  <p className="text-natural-text text-sm md:text-base leading-relaxed p-4 bg-natural-soft/50 rounded-3xl border border-natural-border">
                    {selectedBook.summary}
                  </p>
                </div>

                {/* Reviews section */}
                <div className="space-y-4 pt-2 border-t border-natural-border">
                  <h4 className="text-sm font-display font-bold text-natural-dark uppercase tracking-wider">
                    Bewertungen von anderen Kindern ({selectedBook.reviews.length})
                  </h4>

                  {selectedBook.reviews.length === 0 ? (
                    <p className="text-xs text-natural-muted italic">Noch keine Bewertung da. Schreibe du doch die allererste!</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedBook.reviews.map((rev) => (
                        <div key={rev.id} className="bg-[#FDFBF7] border border-natural-border p-3 rounded-2xl flex items-start gap-3">
                          <span className="text-2xl p-1.5 bg-white rounded-full border border-natural-border shadow-xs flex-shrink-0 select-none">
                            {rev.reviewerAvatar}
                          </span>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-natural-dark">{rev.reviewerName}</span>
                              <div className="flex items-center text-natural-gold text-xs">
                                {Array.from({ length: rev.rating }).map((_, i) => (
                                  <Star key={i} className="w-3 h-3 fill-natural-gold text-natural-gold" />
                                ))}
                              </div>
                            </div>
                            <p className="text-xs text-natural-text font-sans leading-relaxed">"{rev.comment}"</p>
                            <div className="flex items-center justify-between text-[9px] text-[#A89F91] font-mono mt-1">
                              <span>{rev.date}</span>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    askConfirmation(
                                      "Buchkritik löschen?",
                                      "Möchtest du diese Buchkritik wirklich löschen?",
                                      () => {
                                        onRemoveReview?.(selectedBook.id, rev.id);
                                      }
                                    );
                                  }}
                                  className="text-natural-coral hover:bg-natural-coral/15 px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer inline-flex items-center gap-0.5"
                                  title="Rezension löschen"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                  <span>Löschen</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add review form */}
                  <form onSubmit={(e) => handleReviewSubmit(e, selectedBook.id)} className="bg-natural-soft/40 border border-natural-border p-4 rounded-3xl space-y-3">
                    <h5 className="text-xs font-bold text-natural-green">
                      Schreibe eine Buchkritik (+XP)
                    </h5>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-natural-green uppercase mb-1">Dein Lese-Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="z.B. Tim (9) oder Lese-Fuchs"
                          value={reviewerName}
                          onChange={(e) => setReviewerName(e.target.value)}
                          className="w-full p-2 bg-white border border-natural-border rounded-xl text-xs text-natural-dark focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-natural-green uppercase mb-1">Dein Avatar-Emoji *</label>
                        <select
                          value={reviewerAvatar}
                          onChange={(e) => setReviewerAvatar(e.target.value)}
                          className="w-full p-2 bg-white border border-natural-border rounded-xl text-xs text-natural-dark focus:outline-hidden"
                        >
                          <option value="🦉">🦉 Eule</option>
                          <option value="🦊">🦊 Fuchs</option>
                          <option value="🐰">🐰 Hase</option>
                          <option value="🐱">🐱 Katze</option>
                          <option value="🐉">🐉 Drache</option>
                          <option value="🐻">🐻 Bär</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-natural-green uppercase mb-1">Wie viele Sterne gibst du? *</label>
                      <div className="flex gap-1.5 items-center">
                        {[1, 2, 3, 4, 5].map((starVal) => (
                          <button
                            key={starVal}
                            type="button"
                            onClick={() => setNewRating(starVal)}
                            className="text-xl focus:outline-hidden pointer"
                          >
                            <Star className={`w-6 h-6 ${starVal <= newRating ? 'fill-natural-gold text-natural-gold' : 'text-stone-300'}`} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-natural-green uppercase mb-1">Deine Rückmeldung *</label>
                      <textarea
                        required
                        placeholder="Was hat dir besonders gut gefallen? Gab es lustige Stellen?"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={2}
                        className="w-full p-2 bg-white border border-natural-border rounded-xl text-xs text-natural-dark focus:outline-hidden resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="bg-natural-green hover:bg-natural-green-dark active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-natural-green transition-all shadow-xs pointer flex items-center gap-1"
                    >
                      <span>Bewertung posten!</span>
                      <span>✍️</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Action buttons footer */}
              <div className="p-4 bg-natural-soft border-t border-natural-border flex gap-3 flex-shrink-0">
                <button
                  disabled={libraryCard?.borrowedBooks.some(b => b.bookId === selectedBook.id) || libraryCard?.reservations.includes(selectedBook.id)}
                  onClick={() => {
                    onReserve(selectedBook.id);
                  }}
                  className={`flex-1 font-bold text-sm py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 pointer ${
                    libraryCard?.borrowedBooks.some(b => b.bookId === selectedBook.id)
                      ? 'bg-[#EAE6DF] text-[#A39B8E] cursor-not-allowed font-medium'
                      : libraryCard?.reservations.includes(selectedBook.id)
                        ? 'bg-natural-soft border border-natural-gold/50 text-natural-gold cursor-not-allowed font-medium'
                        : selectedBook.availableCopies > 0
                          ? 'bg-natural-green hover:bg-natural-green-dark text-white'
                          : 'bg-natural-soft border border-natural-border text-natural-text hover:bg-natural-hover'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>
                    {libraryCard?.borrowedBooks.some(b => b.bookId === selectedBook.id) 
                      ? 'Bereits ausgeliehen' 
                      : libraryCard?.reservations.includes(selectedBook.id)
                        ? 'Reserviert schultagsnah' 
                        : selectedBook.availableCopies > 0 
                          ? 'Morgen abholen (Reservieren)' 
                          : 'Vormerken (Warteliste)'}
                  </span>
                </button>
                <button
                  onClick={() => onBookmark(selectedBook.id)}
                  className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition-colors pointer shadow-xs flex items-center gap-1 ${
                    libraryCard?.bookmarks.includes(selectedBook.id)
                      ? 'bg-[#FDFBF7] border-natural-coral text-natural-coral'
                      : 'bg-white hover:bg-natural-soft border-natural-border text-natural-text'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 ${libraryCard?.bookmarks.includes(selectedBook.id) ? 'fill-natural-coral text-natural-coral' : ''}`} />
                  <span>{libraryCard?.bookmarks.includes(selectedBook.id) ? 'Entfernen' : 'Wunschzettel'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
