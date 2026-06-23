import { useState, FormEvent } from 'react';
import { LibraryCard, Book, AvatarOption, Badge } from '../types';
import { AVATAR_OPTIONS, BADGES } from '../data/initialData';
import { CreditCard, Award, ArrowRight, BookOpen, Trash2, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
import MascotMessage from './MascotMessage';
import ConfirmModal from './ConfirmModal';

interface LibraryCardViewProps {
  libraryCard: LibraryCard | null;
  books: Book[];
  onRegister: (name: string, avatarId: string) => void;
  onReturnBook: (bookId: string) => void;
  onPickUpReservation: (bookId: string) => void;
  onCancelReservation: (bookId: string) => void;
  onRemoveBookmark: (bookId: string) => void;
  onResetCard: () => void;
  onNavigateToCatalog: () => void;
  onLogout?: () => void;
}

export default function LibraryCardView({
  libraryCard,
  books,
  onRegister,
  onReturnBook,
  onPickUpReservation,
  onCancelReservation,
  onRemoveBookmark,
  onResetCard,
  onNavigateToCatalog,
  onLogout
}: LibraryCardViewProps) {
  const [typedName, setTypedName] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState('owl');

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!typedName.trim()) return;
    onRegister(typedName.trim(), selectedAvatarId);
    setTypedName('');
  };

  const getAvatarData = (id: string): AvatarOption => {
    return AVATAR_OPTIONS.find(av => av.id === id) || AVATAR_OPTIONS[0];
  };

  const getBookData = (id: string): Book | undefined => {
    return books.find(b => b.id === id);
  };

  // Helper to draw a fake library barcode
  const renderBarcode = (cardNum: string) => {
    return (
      <div className="flex bg-white py-2 px-3 rounded-lg border border-stone-200 items-stretch gap-[2px] h-10 select-none overflow-hidden my-3">
        {Array.from({ length: 42 }).map((_, i) => {
          // Semi-random barcode thick & thin lines
          const widths = [1, 2, 3, 4, 1, 2, 1, 1, 3, 2];
          const isBlack = (i % 5 !== 0) && (i % 7 !== 0);
          const width = widths[i % widths.length];
          return (
            <div
              key={i}
              className={`${isBlack ? 'bg-stone-900' : 'bg-transparent'}`}
              style={{ width: `${width}px` }}
            />
          );
        })}
      </div>
    );
  };

  // Calculate percentage XP
  const xpNeeded = (libraryCard?.level || 1) * 35;
  const xpPercentage = libraryCard ? Math.min(100, (libraryCard.xp / xpNeeded) * 100) : 0;

  // Render registration if card does not exist
  if (!libraryCard) {
    return (
      <div className="max-w-xl mx-auto space-y-8" id="card-register-view">
        <MascotMessage 
          message="Oh, du hast ja noch keinen Bibliotheksausweis! Lass uns schnell zusammen einen zaubern. Du brauchst nur deinen Namen eintragen und dir einen süßen Lese-Avatar aussuchen!" 
          mood="excited"
        />

        <div className="bg-white rounded-[40px] p-6 md:p-8 border border-dashed border-natural-border shadow-md space-y-6">
          <div className="text-center space-y-2">
            <span className="text-4xl">🎟️✨</span>
            <h2 className="text-2xl font-display font-bold text-natural-dark">Dein magischer Leseausweis</h2>
            <p className="text-sm text-natural-text max-w-sm mx-auto">Mit diesem Ausweis kannst du Bücher ausleihen, das Lese-Quiz lösen und tolle Belohnungspunkte für Level-Ups sammeln!</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-display font-bold text-natural-dark">Wie heißt du?</label>
              <input
                type="text"
                required
                maxLength={18}
                placeholder="Trage deinen Vornamen ein..."
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                className="w-full px-4 py-3 bg-natural-soft border-2 border-natural-border rounded-2xl focus:outline-hidden focus:border-natural-green font-sans text-natural-dark text-base"
                id="name-input"
              />
            </div>

            {/* Avatar picker step */}
            <div className="space-y-3">
              <label className="block text-sm font-display font-bold text-natural-dark">Wähle deinen Lese-Begleiter:</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setSelectedAvatarId(av.id)}
                    className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      selectedAvatarId === av.id
                        ? `${av.color} ring-4 ring-natural-soft border-natural-green scale-105 font-bold`
                        : 'bg-white border-natural-border hover:bg-natural-soft text-natural-text'
                    }`}
                  >
                    <span className="text-3xl select-none">{av.emoji}</span>
                    <span className="text-[10px] text-center leading-tight truncate w-full">{av.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-natural-green hover:bg-natural-green-dark active:scale-95 text-white font-bold py-4 rounded-2xl shadow-sm transition-colors text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🎟️ Ausweis ausstellen lassen!</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  const userAvatar = getAvatarData(libraryCard.avatar);

  return (
    <div className="space-y-10" id="library-card-dashboard">
      <MascotMessage
        message={`Hey ${libraryCard.name}, schau mal auf deinen Ausweis! Mit jedem neuen Buch, das du liest oder zurückbringst, sammelst du Sternenstaub-XP für dein nächstes Lese-Level!`}
        mood={libraryCard.level > 1 ? 'excited' : 'happy'}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Physical badge/card widget - Takes 5 cols */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-6">
          <h3 className="text-xl font-display font-bold text-natural-dark flex items-center gap-2">
            <span>🎟️</span> Dein Lese-Ausweis
          </h3>

          {/* Interactive CSS physical card */}
          <div className="relative group overflow-hidden bg-gradient-to-tr from-natural-dark to-natural-green text-white rounded-[32px] p-6 shadow-xl border border-natural-green/20 min-h-[300px] flex flex-col justify-between">
            {/* Gloss shine card overlay */}
            <div className="absolute top-0 right-0 left-0 h-40 bg-linear-gradient(135deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_50%) pointer-events-none z-10" />
            
            {/* Header */}
            <div className="flex justify-between items-start z-10 relative">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#E9C381]">Schulbücherei</span>
                <h4 className="text-lg font-display font-bold">Lese-Ausweis</h4>
              </div>
              <span className="text-3xl select-none animate-bounce">🌟</span>
            </div>

            {/* Core user credentials layout */}
            <div className="my-6 flex items-center gap-4 z-10 relative">
              <span className="text-5xl bg-white/10 p-3.5 rounded-full border border-white/20 select-none shadow-inner">
                {userAvatar.emoji}
              </span>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white/70 italic">Karten-Inhaber:in:</div>
                <div className="text-xl md:text-2xl font-display font-bold leading-none tracking-tight">{libraryCard.name}</div>
                <div className="text-[11px] font-mono text-[#D7C49E]">Ausweis-ID: {libraryCard.cardNumber}</div>
              </div>
            </div>

            {/* Barcode / Card ID Footer */}
            <div className="z-10 relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-white/10 pt-4">
              <div className="flex-1 min-w-0">
                {renderBarcode(libraryCard.cardNumber)}
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-[#E9C381]">Lese-Status</div>
                <div className="text-lg font-bold">Level {libraryCard.level}</div>
              </div>
            </div>
          </div>

          {/* XP & Level up progress tracker */}
          <div className="bg-white rounded-[32px] p-5 border border-natural-border shadow-xs space-y-4">
            <div className="flex justify-between items-center text-sm font-bold">
              <span className="text-natural-dark flex items-center gap-1.5">
                <span>✨</span> Sternenstaub-Erfahrung
              </span>
              <span className="text-natural-muted">{libraryCard.xp} / {xpNeeded} XP</span>
            </div>
            
            <div className="relative w-full h-4 bg-natural-soft rounded-full overflow-hidden border border-natural-border">
              <div 
                className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-natural-green to-natural-gold rounded-full transition-all duration-700 ease-out"
                style={{ width: `${xpPercentage}%` }}
              />
            </div>
            <p className="text-xs text-natural-text italic">
              Du brauchst noch {xpNeeded - libraryCard.xp} XP für das nächste Lese-Level! Sammle XP durch Zurückgeben von Büchern oder fehlerfreien Quizrunden.
            </p>
          </div>

          {/* Reset profile or logout link */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-2 border-t border-natural-border/30">
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-natural-muted hover:text-natural-coral transition-colors text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Abmelden / Profil wechseln</span>
              </button>
            )}
            <span className="hidden sm:inline text-stone-300">|</span>
            <button
              onClick={() => {
                askConfirmation(
                  "Ausweis löschen?",
                  "Möchtest du deinen Ausweis und geliehene Bücher wirklich löschen? Dein gesamter Fortschritt wird auf Null gesetzt.",
                  () => {
                    onResetCard();
                  }
                );
              }}
              className="text-natural-muted hover:text-natural-dark transition-colors text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ausweis löschen (Konto zurücksetzen)</span>
            </button>
          </div>
        </div>

        {/* Borrows, Reservations list view - Takes 7 cols */}
        <div className="lg:col-span-12 xl:col-span-7 space-y-8">
          {/* Active borrows list */}
          <div className="bg-white rounded-[32px] p-6 border border-natural-border shadow-xs space-y-5">
            <h3 className="text-lg font-display font-bold text-natural-dark flex items-center gap-2 border-b border-natural-border pb-3">
              <span>📚</span> Meine ausgeliehenen Bücher ({libraryCard.borrowedBooks.length})
            </h3>

            {libraryCard.borrowedBooks.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <span className="text-4xl">🦉💨</span>
                <p className="text-sm text-natural-muted font-bold">Du hast gerade kein Buch ausgeliehen!</p>
                <button
                  onClick={onNavigateToCatalog}
                  className="bg-natural-green hover:bg-natural-green-dark font-bold text-xs text-white px-4 py-2.5 rounded-xl transition-all inline-flex items-center gap-1 pointer"
                >
                  Bücher durchstöbern
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {libraryCard.borrowedBooks.map((borrow) => {
                  const b = getBookData(borrow.bookId);
                  if (!b) return null;
                  
                  // Calculate days left to return
                  const today = new Date("2026-06-22");
                  const dueDate = new Date(borrow.dueDate);
                  const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                  const isOverdue = daysLeft < 0;

                  return (
                    <div
                      key={borrow.bookId}
                      className="bg-natural-soft/50 border border-natural-border p-4 rounded-2xl flex items-center justify-between gap-4"
                      id={`borrowed-item-${borrow.bookId}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl p-2 bg-white rounded-xl border border-natural-border shadow-xs select-none">
                          {b.emoji}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-natural-dark line-clamp-1">{b.title}</h4>
                          <p className="text-xs text-natural-muted">Autor: {b.author}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isOverdue 
                                ? 'bg-natural-coral/20 text-natural-coral' 
                                : daysLeft <= 3 
                                  ? 'bg-natural-gold/20 text-natural-gold' 
                                  : 'bg-natural-green/20 text-natural-green'
                            }`}>
                              {isOverdue ? '⚠️ Überfällig' : `${daysLeft} Tage übrig`}
                            </span>
                            <span className="text-[10px] text-natural-muted font-mono">Frist: {borrow.dueDate}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onReturnBook(borrow.bookId)}
                        className="bg-white hover:bg-natural-soft border border-natural-border text-natural-dark px-3 py-2 rounded-xl font-bold text-xs transition-all pointer flex flex-col items-center gap-0.5"
                        title="Buch zurückbringen"
                      >
                        <CheckCircle2 className="w-4 h-4 text-natural-green" />
                        <span>Zurückgeben</span>
                        <span className="text-[8px] text-natural-green font-mono">+15 XP</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active reservations */}
          <div className="bg-white rounded-[32px] p-6 border border-natural-border shadow-xs space-y-5">
            <h3 className="text-lg font-display font-bold text-natural-dark flex items-center gap-2 border-b border-natural-border pb-3">
              <span>🔑</span> Meine Abholstation & Vormerkungen ({libraryCard.reservations.length})
            </h3>
            
            <p className="text-xs text-natural-text">
              Reservierte Bücher liegen 3 Schultage in der Bücherei für dich bereit. Klicke unten, um das Buch "abzuholen" (Simuliert die Ausleihe).
            </p>

            {libraryCard.reservations.length === 0 ? (
              <p className="text-xs text-natural-muted italic text-center py-4">Keine aktuellen Reservierungen oder Vormerkungen vorhanden.</p>
            ) : (
              <div className="space-y-4">
                {libraryCard.reservations.map((resId) => {
                  const b = getBookData(resId);
                  if (!b) return null;

                  return (
                    <div
                      key={resId}
                      className="bg-natural-soft/30 border border-natural-border p-4 rounded-2xl flex items-center justify-between gap-4"
                      id={`reserved-item-${resId}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl p-2 bg-white rounded-xl border border-natural-border shadow-xs select-none">
                          {b.emoji}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-natural-dark line-clamp-1">{b.title}</h4>
                          <p className="text-xs text-natural-muted">von {b.author}</p>
                          <span className="inline-block mt-1 text-[10px] font-bold text-natural-gold bg-[#FDFBF7] border border-natural-border/60 px-2 py-0.5 rounded-full">
                            {b.availableCopies > 0 ? 'Bereit zur Abholung! 🎉' : 'In der Warteschleife ⏳'}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => onPickUpReservation(resId)}
                          className="bg-natural-green hover:bg-natural-green-dark text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-colors pointer flex flex-col items-center gap-0.5 justify-center"
                          title="Buch abholen"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-white" />
                          <span>Abholen!</span>
                          <span className="text-[8px] text-white/80 font-mono">+10 XP</span>
                        </button>
                        <button
                          onClick={() => {
                            askConfirmation(
                              "Reservierung stornieren?",
                              "Möchtest du diese Reservierung wirklich stornieren?",
                              () => {
                                onCancelReservation(resId);
                              }
                            );
                          }}
                          className="bg-white hover:bg-natural-soft border border-natural-border text-natural-coral px-3 py-1.5 rounded-xl font-bold text-xs transition-all pointer flex flex-col items-center justify-center gap-0.5"
                          title="Reservierung löschen / stornieren"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-natural-coral" />
                          <span>Löschen</span>
                          <span className="text-[8px] text-stone-400 font-mono">Freigeben</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Wunschliste Bookmarks */}
          <div className="bg-white rounded-[32px] p-6 border border-natural-border shadow-xs space-y-5">
            <h3 className="text-lg font-display font-bold text-natural-dark flex items-center gap-2 border-b border-natural-border pb-3">
              <span>💖</span> Mein Wunschzettel ({libraryCard.bookmarks.length})
            </h3>

            {libraryCard.bookmarks.length === 0 ? (
              <p className="text-xs text-natural-muted italic text-center py-4">Dein Wunschzettel ist leer. Setze im Bücher-Kosmos das Herz auf deine Lieblingsbücher!</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="bookmarks-catalog">
                {libraryCard.bookmarks.map((bId) => {
                  const b = getBookData(bId);
                  if (!b) return null;

                  return (
                    <div
                      key={bId}
                      className="bg-[#FDFBF7] border border-natural-border p-3 rounded-2xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-2xl flex-shrink-0 select-none">{b.emoji}</span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-natural-dark truncate" title={b.title}>{b.title}</h4>
                          <p className="text-[10px] text-natural-muted truncate">von {b.author}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => onRemoveBookmark(bId)}
                        className="text-natural-muted hover:text-natural-coral p-1.5 rounded-lg hover:bg-natural-soft transition-colors pointer"
                        title="Vom Wunschzettel entfernen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Badges / Auszeichnungen section */}
          <div className="bg-white rounded-[32px] p-6 border border-natural-border shadow-xs space-y-5">
            <h3 className="text-lg font-display font-bold text-natural-dark flex items-center gap-2 border-b border-natural-border pb-3">
              <span>🏅</span> Meine errungenen Abzeichen ({libraryCard.badges.length})
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {BADGES.map((badge) => {
                const isEarned = libraryCard.badges.includes(badge.id);

                return (
                  <div
                    key={badge.id}
                    className={`p-3 rounded-2xl border flex flex-col items-center text-center gap-2 transition-all duration-500 relative overflow-hidden ${
                      isEarned
                        ? `bg-[#EBE7DF] border-natural-border shadow-xs`
                        : 'bg-natural-soft/50 border-natural-border text-natural-muted grayscale'
                    }`}
                    title={badge.description}
                  >
                    <span className="text-3xl select-none filter drop-shadow">
                      {badge.emoji}
                    </span>
                    <div className="space-y-0.5">
                      <h4 className={`text-xs font-bold leading-tight ${isEarned ? 'text-natural-dark' : 'text-natural-muted'}`}>
                        {badge.title}
                      </h4>
                      <p className={`text-[9px] leading-tight ${isEarned ? 'text-natural-text' : 'text-natural-muted'}`}>
                        {badge.description}
                      </p>
                    </div>
                    {isEarned && (
                      <span className="absolute top-1 right-1 text-[10px] select-none" title="Erreicht!">✅</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

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
