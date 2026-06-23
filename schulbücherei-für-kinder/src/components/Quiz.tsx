import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QuizQuestion, LibraryCard, Book } from '../types';
import ConfirmModal from './ConfirmModal';
import { 
  Award, 
  CheckCircle, 
  XCircle, 
  ArrowRight, 
  BookOpen, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Sparkles, 
  BookOpenCheck,
  Brain,
  HelpCircle,
  Clock
} from 'lucide-react';
import MascotMessage from './MascotMessage';

interface QuizProps {
  libraryCard: LibraryCard | null;
  books: Book[];
  onAwardXP: (xp: number, badgeId?: string) => void;
}

export default function Quiz({ libraryCard, books, onAwardXP }: QuizProps) {
  // Navigation & Game State
  const [quizState, setQuizState] = useState<'welcome' | 'generating' | 'playing' | 'completed'>('welcome');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dynamic generated active questions
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [badgeUnlocked, setBadgeUnlocked] = useState(false);

  // Playful Generator steps state
  const [genStep, setGenStep] = useState(0);
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  const [errorBody, setErrorBody] = useState<string | null>(null);

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

  // Filtered books matching the Search bar typing!
  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Child-friendly sound synthesizer via Web Audio (no external files needed)
  const playSoundEffect = (type: 'correct' | 'wrong' | 'victory') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'correct') {
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      } else if (type === 'wrong') {
        osc.frequency.setValueAtTime(220, audioCtx.currentTime); // A3
        osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.25);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'victory') {
        const now = audioCtx.currentTime;
        osc.frequency.setValueAtTime(261.63, now); // C4
        osc.frequency.setValueAtTime(329.63, now + 0.1); // E4
        osc.frequency.setValueAtTime(392.00, now + 0.2); // G4
        osc.frequency.setValueAtTime(523.25, now + 0.3); // C5
        gainNode.gain.setValueAtTime(0.1, now);
        osc.start();
        osc.stop(now + 0.55);
      }
    } catch (e) {
      // AudioContext might be blocked, safe to ignore
    }
  };

  const currentQuestion = activeQuestions[currentQuestionIndex];

  // AI Generation sequence trigger !
  const handleSelectBookForQuiz = async (book: Book) => {
    setActiveBook(book);
    setQuizState('generating');
    setErrorHeader(null);
    setErrorBody(null);
    setGenStep(0);

    // Dynamic sequence simulation steps
    const timer1 = setTimeout(() => setGenStep(1), 800);
    const timer2 = setTimeout(() => setGenStep(2), 1600);
    
    try {
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ book }),
      });

      if (!response.ok) {
        const errText = await response.json().catch(() => ({}));
        throw new Error(errText.error || `Fehlercode: ${response.status}`);
      }

      const data = await response.json();
      if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error('Keine gültigen Quizfragen zurückgeliefert.');
      }

      clearTimeout(timer1);
      clearTimeout(timer2);
      setGenStep(2);

      setActiveQuestions(data.questions);
      
      // Start actual game state
      setCurrentQuestionIndex(0);
      setSelectedOptionIndex(null);
      setIsAnswered(false);
      setScore(0);
      setBadgeUnlocked(false);
      setQuizState('playing');
    } catch (e: any) {
      console.error(e);
      clearTimeout(timer1);
      clearTimeout(timer2);
      setErrorHeader('Oje, ein kleiner Fehler bei Bertis KI-Gehirn...');
      setErrorBody(e.message || 'Berti konnte das automatische Quiz gerade nicht erstellen. Überprüfe die Verbindung oder ob der GEMINI_API_KEY eingetragen ist.');
    }
  };

  const retryQuiz = () => {
    if (activeBook) {
      handleSelectBookForQuiz(activeBook);
    }
  };

  const handleAnswerSubmit = (optionIndex: number) => {
    if (isAnswered) return;
    
    setSelectedOptionIndex(optionIndex);
    setIsAnswered(true);

    const isCorrect = optionIndex === currentQuestion.correctAnswer;
    if (isCorrect) {
      setScore(prev => prev + 1);
      playSoundEffect('correct');
    } else {
      playSoundEffect('wrong');
    }
  };

  const handleNextQuestion = () => {
    setSelectedOptionIndex(null);
    setIsAnswered(false);

    if (currentQuestionIndex + 1 < activeQuestions.length) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Quiz completed!
      setQuizState('completed');
      playSoundEffect('victory');

      // Award XP from correct answers (10 XP per question)
      const earnedXP = score * 10;
      let earnedBadge: string | undefined = undefined;

      // Earn crown badge if they get full score (100%) and profile exists
      if (score === activeQuestions.length && libraryCard) {
        earnedBadge = 'badge_quiz';
        setBadgeUnlocked(true);
      }
      
      onAwardXP(earnedXP, earnedBadge);
    }
  };

  const getBertiRatingMessage = () => {
    const qLen = activeQuestions.length;
    if (score === qLen) {
      return `Mensch, ${libraryCard ? libraryCard.name : 'Du'}! Ein wahres Lese-Genie! Du hast alle ${score} Quizfragen zu "${activeBook?.title}" fehlerfrei gelöst. Trage stolz deine Krone! 👑⭐️🏆`;
    } else if (score >= qLen * 0.7) {
      return `Das war absolute Spitze! Du konntest ${score} von ${qLen} kniffligen Fragen richtig lösen. Du hast das Buch wirklich aufmerksam gelesen! 📖🐛`;
    } else {
      return `Gar nicht übel! Du hast ${score} Fragen richtig beantwortet. Schnapp dir "${activeBook?.title}" noch mal aus dem Regal in der Schulbücherei, lies ein paar Seiten und versuche es bald wieder! Übung macht den Meister! 💪📚`;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8" id="quiz-view">
      
      {/* Quiz Welcome Screen / Book Search list */}
      {quizState === 'welcome' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[40px] p-6 md:p-8 border border-dashed border-natural-border shadow-md text-center space-y-4">
            <div className="text-5xl animate-bounce select-none">🤖✨📚</div>
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-natural-dark">
                KI Bücher-Quiz Generator!
              </h2>
              <p className="text-xs sm:text-sm text-natural-text max-w-md mx-auto">
                Berti hat die künstliche Bibliotheks-Flügel-Intelligenz eingeschaltet! Wähle ein beliebiges Buch aus unserer Schule, um sofort ein frisch geschmiedetes Quiz mit 10-15 kniffligen Fragen zu starten!
              </p>
            </div>

            {/* Rules list */}
            <div className="bg-[#FAF8F5] p-4 rounded-3xl border border-natural-border text-left grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-natural-green uppercase tracking-wide">Spiel-Modus</span>
                <p className="text-[11px] text-natural-text font-sans">Jedes generierte Quiz hat genau **12 spannende Fragen** rund um Spuren, Genres, Helden und Geschichten.</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-natural-gold uppercase tracking-wide">Belohnung</span>
                <p className="text-[11px] text-natural-text font-sans">Erhalte **+10 XP** für jede richtige Antwort und ein goldenes Abzeichen für volle Punkte! 👑</p>
              </div>
            </div>

            {!libraryCard && (
              <div className="bg-natural-coral/10 border border-natural-coral/15 text-natural-coral px-3 py-2.5 rounded-2xl flex items-center gap-2 text-[10px] font-bold text-left leading-normal">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>Hinweis: Du kannst alle Quizzes spielen, um deine Punkte abzuspeichern benötigst du jedoch in "Ausweiskarte" einen eigenen Leseausweis.</span>
              </div>
            )}
          </div>

          {/* SEARCH BAR (BÜCHER SUCHE) */}
          <div className="bg-white p-5 rounded-[28px] border border-natural-border shadow-xs space-y-4">
            <span className="text-xs font-bold text-natural-dark uppercase tracking-wider block">
              🔍 Bücherei-Bestand durchsuchen für KI-Quiz:
            </span>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-natural-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Schreibe einen Buchtitel, Autor oder Sparte (z.B. Detektive, Michael Ende)..."
                className="w-full px-4 py-3 bg-natural-soft border border-natural-border rounded-xl text-xs sm:text-sm font-semibold pl-11 focus:outline-hidden text-natural-dark focus:border-natural-green inline-block"
              />
            </div>

            {/* Dynamic Results Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {filteredBooks.map((book) => (
                <div 
                  key={book.id}
                  className="p-3 bg-[#FAF9F5] hover:bg-natural-hover/35 transition-all rounded-2xl border border-natural-border/70 flex items-center gap-3 justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-2xl p-1 bg-white border border-stone-200 rounded-lg select-none leading-none w-9 h-9 flex items-center justify-center">
                      {book.emoji}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-natural-dark leading-tight truncate">{book.title}</h4>
                      <p className="text-[9px] text-natural-muted truncate font-sans">von {book.author}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectBookForQuiz(book)}
                    className="flex-shrink-0 bg-natural-green hover:bg-natural-green-dark text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer flex items-center gap-0.5"
                  >
                    <span>Starten</span>
                    <span>⚡</span>
                  </button>
                </div>
              ))}

              {filteredBooks.length === 0 && (
                <div className="col-span-full py-8 text-center text-xs text-natural-muted font-bold">
                  Kein Buch in der Bücherei gefunden, das zu "{searchQuery}" passt! <br/>
                  <span className="text-[10px] text-stone-400 font-semibold font-sans">Füge im Lehrerzimmer ein neues Buch hinzu!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KI QUIZ GENERATOR ANIMATED POPUP */}
      {quizState === 'generating' && activeBook && (
        <div className="bg-white rounded-[40px] p-8 border border-natural-border shadow-xl text-center space-y-6">
          <div className="relative inline-block">
            <div className="text-6xl animate-pulse select-none">🧐📖🤖</div>
            <div className="absolute -top-1 -right-1 text-2xl animate-spin">⚡</div>
          </div>

          <div className="space-y-1">
            <h3 className="text-lg md:text-xl font-display font-bold text-natural-dark">
              KI Berti schmiedet das Quiz...
            </h3>
            <p className="text-xs text-natural-muted font-bold">
              für das Buch: <span className="text-natural-coral font-bold bg-natural-soft px-3.5 py-1 rounded-full font-sans">"{activeBook.title}"</span>
            </p>
          </div>

          {/* Stepper with progress ticks */}
          <div className="max-w-xs mx-auto space-y-3 pt-2 text-left font-sans text-xs">
            <div className="flex items-center gap-2.5 font-bold text-natural-dark">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                genStep >= 0 ? 'bg-natural-green text-white font-bold' : 'bg-natural-soft'
              }`}>1</div>
              <span className={genStep === 0 ? 'animate-pulse text-natural-green font-bold' : 'opacity-70'}>
                Suche im Archiv nach "{activeBook.title}"...
              </span>
            </div>

            <div className={`flex items-center gap-2.5 font-bold ${genStep >= 1 ? 'text-natural-dark' : 'text-stone-300'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                genStep >= 1 ? 'bg-natural-green text-white font-bold' : 'bg-natural-soft'
              }`}>2</div>
              <span className={genStep === 1 ? 'animate-pulse text-natural-green font-bold' : 'opacity-70'}>
                Lese Kapitel & Charaktere quer... 🧠
              </span>
            </div>

            <div className={`flex items-center gap-2.5 font-bold ${genStep >= 2 ? 'text-natural-dark' : 'text-stone-300'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                genStep >= 2 ? 'bg-natural-green text-white font-bold' : 'bg-natural-soft'
              }`}>3</div>
              <span className={genStep === 2 ? 'animate-pulse text-natural-green font-bold' : 'opacity-70'}>
                Erstelle 10-15 knifflige Quizfragen... 🪄
              </span>
            </div>
          </div>

          <div className="w-48 mx-auto h-2 bg-natural-soft rounded-full overflow-hidden border border-natural-border/30">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(genStep + 1) * 33}%` }}
              transition={{ duration: 0.5 }}
              className="bg-natural-green h-full rounded-full"
            />
          </div>
        </div>
      )}

      {/* ACTIVE QUIZ PLAYING STATE */}
      {quizState === 'playing' && currentQuestion && (
        <div className="space-y-6" id="quiz-playing-box">
          
          <div className="bg-white p-3.5 rounded-2xl border border-natural-border flex justify-between items-center text-xs">
            <div className="flex items-center gap-2 font-bold text-natural-dark">
              <span className="text-xl">{activeBook?.emoji}</span>
              <div>
                <h4 className="line-clamp-1">Quiz: {activeBook?.title}</h4>
                <p className="text-[10px] text-natural-muted font-normal font-sans">Sparte: {activeBook?.category}</p>
              </div>
            </div>
            <button
              onClick={() => {
                askConfirmation(
                  "Quiz beenden?",
                  "Möchtest du das Quiz wirklich beenden und zurück zur Übersicht?",
                  () => {
                    setQuizState('welcome');
                  },
                  "Ja, beenden"
                );
              }}
              className="px-2 py-1 bg-natural-soft text-natural-text rounded-md font-bold text-[10px] hover:bg-natural-border cursor-pointer"
            >
              Abbrechen
            </button>
          </div>

          {/* Progress labels */}
          <div className="flex justify-between items-center text-xs font-bold text-natural-muted uppercase px-1">
            <span>Frage {currentQuestionIndex + 1} von {activeQuestions.length}</span>
            <span className="text-natural-green">Richtig beantwortet: {score}</span>
          </div>

          {/* Graphical custom progress dots */}
          <div className="flex gap-1.5 h-2.5">
            {activeQuestions.map((_, i) => (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all duration-300 ${
                  i < currentQuestionIndex
                    ? 'bg-natural-green'
                    : i === currentQuestionIndex
                      ? 'bg-natural-gold scale-y-110 shadow-xs'
                      : 'bg-natural-soft'
                }`}
              />
            ))}
          </div>

          {/* Actual Question */}
          <div className="bg-white rounded-[40px] p-6 md:p-8 border border-natural-border shadow-xs space-y-6">
            <h3 className="text-lg md:text-xl font-display font-bold text-natural-dark leading-snug">
              {currentQuestion.question}
            </h3>

            {/* Multiple choices list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedOptionIndex === index;
                const isCorrectVal = index === currentQuestion.correctAnswer;
                
                let btnStyle = 'bg-[#FDFBF7] hover:bg-natural-soft border-natural-border text-natural-text';
                
                if (isAnswered) {
                  if (isSelected) {
                     btnStyle = isCorrectVal
                      ? 'bg-natural-green/20 border-natural-green text-natural-dark font-bold'
                      : 'bg-natural-coral/20 border-natural-coral text-natural-dark font-bold';
                  } else if (isCorrectVal) {
                    btnStyle = 'bg-natural-green/20 border-natural-green text-natural-dark font-bold';
                  } else {
                    btnStyle = 'opacity-40 bg-natural-soft border-natural-border text-natural-muted';
                  }
                }

                return (
                  <button
                    key={index}
                    disabled={isAnswered}
                    onClick={() => handleAnswerSubmit(index)}
                    className={`p-4 rounded-2xl border transition-all text-left text-xs sm:text-sm font-bold flex items-center justify-between gap-3 cursor-pointer active:scale-98 ${btnStyle}`}
                  >
                    <span>{option}</span>
                    <span className="flex-shrink-0">
                      {isAnswered && isCorrectVal && <CheckCircle className="w-5 h-5 text-natural-green fill-white" />}
                      {isAnswered && isSelected && !isCorrectVal && <XCircle className="w-5 h-5 text-natural-coral fill-white" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Answer feedback explanation box */}
            <AnimatePresence>
              {isAnswered && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-natural-soft/40 border border-natural-border rounded-3xl p-4 md:p-5 space-y-2 overflow-hidden"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💡</span>
                    <h4 className="text-sm font-display font-bold text-natural-dark">
                      Berti klärt auf:
                    </h4>
                  </div>
                  <p className="text-natural-text text-xs sm:text-sm leading-relaxed">
                    {currentQuestion.explanation}
                  </p>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleNextQuestion}
                      className="bg-natural-green hover:bg-natural-green-dark text-white font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1 shadow-xs hover:shadow-md active:scale-95 transition-all cursor-pointer"
                    >
                      <span>
                        {currentQuestionIndex + 1 === activeQuestions.length ? 'Zum Ergebnis' : 'Nächste Frage'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* QUIZ COMPLETED SCREEN */}
      {quizState === 'completed' && activeBook && (
        <div className="bg-white rounded-[40px] p-6 md:p-8 border border-natural-border shadow-xl space-y-6 text-center">
          <div className="text-6xl select-none filter drop-shadow animate-bounce">👑🏆🎓</div>

          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-natural-dark">
              KI-Quiz beendet!
            </h2>
            <p className="text-xs text-natural-muted font-bold font-sans">
              Du hast <span className="text-natural-dark font-sans font-bold bg-natural-soft px-3 py-1 rounded-full">{score} von {activeQuestions.length}</span> Fragen richtig beantwortet!
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <MascotMessage
              message={getBertiRatingMessage()}
              mood={score === activeQuestions.length ? 'excited' : 'happy'}
            />
          </div>

          {/* XP & Rewards details */}
          <div className="bg-natural-soft/50 border border-natural-border p-4 rounded-3xl max-w-sm mx-auto space-y-4">
            <h3 className="text-xs font-bold text-natural-dark uppercase tracking-wider">Deine Belohnung:</h3>
            <div className="flex items-center justify-around gap-2">
              <div className="text-center">
                <div className="text-2xl">✨</div>
                <div className="text-lg font-bold text-natural-green font-mono">+{score * 10} XP</div>
                <div className="text-[10px] text-natural-muted font-sans font-semibold">Erfahrungspunkte</div>
              </div>

              {badgeUnlocked && (
                <div className="text-center animation-pulse">
                  <div className="text-2xl">👑</div>
                  <div className="text-xs font-bold text-natural-gold leading-none">Quiz-König</div>
                  <div className="text-[10px] text-natural-muted font-sans mt-1">Abzeichen erhalten!</div>
                </div>
              )}
            </div>
            
            {!libraryCard && score > 0 && (
              <p className="text-[10px] text-natural-coral italic font-bold pt-1 leading-normal font-sans">
                Melde dich im Menü unter "Ausweiskarte" an, um diese {score * 10} XP für deinen Bibliotheksausweis zu beanspruchen!
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 max-w-sm mx-auto pt-2">
            <button
              onClick={retryQuiz}
              className="flex-1 bg-natural-gold hover:bg-natural-gold/90 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Nochmal spielen</span>
            </button>
            <button
              onClick={() => setQuizState('welcome')}
              className="flex-1 bg-natural-soft hover:bg-natural-hover text-natural-dark font-bold py-3 rounded-xl transition-all cursor-pointer"
            >
              Anderes Buch quizzen 📚
            </button>
          </div>
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
