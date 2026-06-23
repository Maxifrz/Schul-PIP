import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, User, Lock, Heart, ShieldAlert, Sparkles, Plus, Smile, Users, ArrowRight } from 'lucide-react';
import { LibraryCard, Teacher } from '../types';
import { AVATAR_OPTIONS } from '../data/initialData';

interface LoginPortalProps {
  onRegisterStudent: (name: string, avatarId: string) => void;
  onLoginStudent: (card: LibraryCard) => void;
  onLoginTeacher: (username: string, pass: string) => string | null; // Returns error msg or null on success
  availableCards: LibraryCard[];
}

export default function LoginPortal({
  onRegisterStudent,
  onLoginStudent,
  onLoginTeacher,
  availableCards
}: LoginPortalProps) {
  // Modes: 'role-select' | 'student-login' | 'student-register' | 'teacher-login'
  const [portalMode, setPortalMode] = useState<'role-select' | 'student-login' | 'student-register' | 'teacher-login'>('role-select');
  
  // Student registration state
  const [studentName, setStudentName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('owl');

  // Student manual login state
  const [manualCardNum, setManualCardNum] = useState('');
  const [manualError, setManualError] = useState('');

  // Teacher credentials state
  const [teacherUser, setTeacherUser] = useState('');
  const [teacherPass, setTeacherPass] = useState('');
  const [teacherError, setTeacherError] = useState('');

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;
    onRegisterStudent(studentName.trim(), selectedAvatar);
  };

  const handleManualStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');
    const typed = manualCardNum.trim().toUpperCase();
    if (!typed) return;

    // Search locally saved cards or search inside saved cards
    const found = availableCards.find(
      c => c.cardNumber === typed || c.name.toLowerCase() === typed.toLowerCase()
    );

    if (found) {
      onLoginStudent(found);
    } else {
      // Create a dummy card or inform them to register
      setManualError('💡 Ausweis nicht gefunden. Bitte erstelle einen neuen Ausweis oder überprüfe die Nummer (z.B. SB-123456).');
    }
  };

  const handleTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError('');
    const errorMsg = onLoginTeacher(teacherUser, teacherPass);
    if (errorMsg) {
      setTeacherError(errorMsg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-100 flex items-center justify-center p-4 md:p-6" id="login-portal">
      {/* Background illustration effect */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#5C946E_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 bg-white rounded-[40px] shadow-2xl border border-natural-border overflow-hidden relative min-h-[550px] z-10">
        
        {/* Left Side: Welcoming Banner (Kids-focused) */}
        <div className="md:col-span-5 bg-natural-green text-white p-8 flex flex-col justify-between relative overflow-hidden">
          {/* Wave/circle decorative assets */}
          <div className="absolute -top-12 -left-12 w-44 h-44 bg-natural-green-dark/30 rounded-full" />
          <div className="absolute -bottom-16 -right-12 w-48 h-48 bg-natural-green-dark/20 rounded-full" />
          
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-semibold backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-natural-gold animate-spin" />
              <span>Hier beginnt dein Abenteuer!</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-display font-extrabold tracking-tight leading-tight pt-2">
                Löwenzahn Bücherei 🦁📖
              </h1>
              <p className="text-xs text-stone-100 leading-relaxed font-medium">
                Unsere wunderschöne Schulbücherei der Albert-Schweitzer-Grundschule.
              </p>
            </div>
          </div>

          {/* BERTIE MASCOT PROMPT */}
          <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-3xl p-5 border border-white/10 space-y-3 mt-6">
            <div className="flex gap-3 items-start">
              <div className="text-4xl select-none leading-none animate-bounce">🐛</div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-natural-gold">Berti der Bücherwurm</span>
                <p className="text-xs text-white leading-relaxed font-semibold">
                  "Huhu! Bevor du in den Bücher-Kosmos eintauchen kannst, brauche ich deinen Leseausweis. Du kannst dir ganz leicht einen erstellen!"
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-4 text-[10px] text-stone-200 font-semibold tracking-wider uppercase">
            Albert-Schweitzer-Gemeinschaft
          </div>
        </div>

        {/* Right Side: Interactive Forms Portal */}
        <div className="md:col-span-7 p-8 flex flex-col justify-center bg-stone-50/50 min-h-[480px]">
          
          <AnimatePresence mode="wait">
            {/* 1. ROLE SELECT WINDOW */}
            {portalMode === 'role-select' && (
              <motion.div
                key="role"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-1">
                  <h2 className="text-2xl font-display font-bold text-stone-800 leading-tight">Willkommen zurück!</h2>
                  <p className="text-xs text-[#5C5446] font-medium leading-relaxed">
                    Wähle deinen Eingang aus, um die Welt der Bücher zu betreten:
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3.5 pt-2">
                  
                  {/* Card selector / Student log-in block */}
                  <button
                    onClick={() => {
                      if (availableCards.length > 0) {
                        setPortalMode('student-login');
                      } else {
                        setPortalMode('student-register');
                      }
                    }}
                    className="flex items-center gap-4 p-5 bg-white border border-natural-border hover:border-natural-coral hover:bg-natural-soft/40 rounded-3xl text-left class shadow-sm hover:shadow-md transition-all group pointer cursor-pointer"
                  >
                    <div className="p-3.5 bg-natural-coral/10 text-natural-coral rounded-2xl group-hover:scale-110 transition-transform">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-stone-800 leading-tight">🦁 Schüler-Eingang</h3>
                      <p className="text-xs text-[#5C5446]/85 font-semibold mt-0.5">
                        {availableCards.length > 0 
                          ? `Ausweis auswählen oder neuen erstellen (${availableCards.length} gespeichert)` 
                          : 'Erstelle deinen eigenen magischen Leseausweis!'}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-stone-400 group-hover:text-natural-coral group-hover:translate-x-1 transition-all" />
                  </button>

                  {/* Teacher log-in block */}
                  <button
                    onClick={() => setPortalMode('teacher-login')}
                    className="flex items-center gap-4 p-5 bg-white border border-natural-border hover:border-natural-green hover:bg-natural-soft/40 rounded-3xl text-left class shadow-sm hover:shadow-md transition-all group pointer cursor-pointer"
                  >
                    <div className="p-3.5 bg-natural-green/10 text-natural-green rounded-2xl group-hover:scale-110 transition-transform">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-stone-800 leading-tight">🏫 Lehrer & Team</h3>
                      <p className="text-xs text-[#5C5446]/85 font-semibold mt-0.5">
                        Für Lehrkräfte, Schulleitung und Bücherei-Helfer.
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-stone-400 group-hover:text-natural-green group-hover:translate-x-1 transition-all" />
                  </button>

                </div>
              </motion.div>
            )}

            {/* 2. STUDENT SELECT / MANAGE LOGIN PORTAL */}
            {portalMode === 'student-login' && (
              <motion.div
                key="student-login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h2 className="text-2xl font-display font-bold text-stone-800">Schüler-Eingang 🦁</h2>
                    <p className="text-xs text-[#5C5446] font-semibold">Tippe auf dein Profil, um dich anzumelden:</p>
                  </div>
                  <button
                    onClick={() => setPortalMode('student-register')}
                    className="px-3.5 py-1.5 bg-natural-coral/10 hover:bg-natural-coral/20 text-natural-coral rounded-xl text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Anderes Kind</span>
                  </button>
                </div>

                {/* Profile Grid (Saves Directory) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[220px] overflow-y-auto pr-1 pb-1">
                  {availableCards.map((card) => {
                    const avatar = AVATAR_OPTIONS.find(av => av.id === card.avatar) || AVATAR_OPTIONS[0];
                    return (
                      <button
                        key={card.cardNumber}
                        onClick={() => onLoginStudent(card)}
                        className="p-3 bg-white border border-natural-border hover:border-natural-coral hover:bg-natural-soft/30 rounded-2xl text-center group transition-all duration-200 pointer flex flex-col items-center gap-2 cursor-pointer shadow-xs"
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border ${avatar.color} group-hover:scale-110 transition-transform shadow-xs`}>
                          {avatar.emoji}
                        </div>
                        <div className="min-w-0 w-full text-center">
                          <div className="font-bold text-xs text-stone-800 truncate leading-none">{card.name}</div>
                          <div className="text-[9px] text-[#5C5446] font-medium leading-tight mt-1 bg-stone-100 rounded px-1 py-0.2 inline-block">
                            Lvl {card.level} ({card.cardNumber})
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-[#E1DCD1]/80"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold">
                    <span className="bg-[#FAF8F5] px-2.5 text-[#888173]">Oder manuell suchen</span>
                  </div>
                </div>

                {/* Manual Card Form */}
                <form onSubmit={handleManualStudentLogin} className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-grow">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        type="text"
                        placeholder="Ausweisnummer (z.B. SB-123456) oder Vorname"
                        value={manualCardNum}
                        onChange={(e) => setManualCardNum(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-natural-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-natural-coral placeholder:text-stone-400 text-stone-800"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 bg-natural-dark hover:bg-natural-dark/90 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                    >
                      Suchen
                    </button>
                  </div>
                  {manualError && (
                    <p className="text-[10px] text-natural-coral font-bold leading-relaxed">{manualError}</p>
                  )}
                </form>

                <div className="pt-2 flex justify-between">
                  <button
                    onClick={() => setPortalMode('role-select')}
                    className="text-xs text-[#5C5446]/80 hover:text-stone-800 font-bold transition-colors cursor-pointer"
                  >
                    ← Zurück zur Auswahl
                  </button>
                </div>
              </motion.div>
            )}

            {/* 3. STUDENT REGISTER WINDOW */}
            {portalMode === 'student-register' && (
              <motion.div
                key="student-reg"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="space-y-0.5">
                  <h2 className="text-2xl font-display font-bold text-stone-800">Neuer Leseausweis erstellen 🎟️</h2>
                  <p className="text-xs text-[#5C5446] font-semibold">
                    Super! Gib deinen Namen ein und such dir einen schicken Lese-Begleiter aus:
                  </p>
                </div>

                <form onSubmit={handleCreateStudent} className="space-y-4">
                  {/* Name field */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Dein Vorname:</label>
                    <div className="relative">
                      <Smile className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-natural-coral" />
                      <input
                        type="text"
                        maxLength={20}
                        required
                        placeholder="Wie heißt du?"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-natural-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-natural-coral placeholder:text-stone-400 text-stone-800"
                      />
                    </div>
                  </div>

                  {/* Character picker */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Wähle deinen Lese-Helden:</label>
                    <div className="grid grid-cols-3 gap-2">
                      {AVATAR_OPTIONS.map((av) => (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => setSelectedAvatar(av.id)}
                          className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer pointer ${
                            selectedAvatar === av.id
                              ? 'border-natural-coral bg-natural-soft bg-opacity-70 scale-[1.03] ring-1 ring-natural-coral/20'
                              : 'border-natural-border bg-white hover:bg-stone-50'
                          }`}
                        >
                          <span className="text-2xl md:text-3xl select-none leading-none">{av.emoji}</span>
                          <span className="text-[9px] font-bold text-stone-700 leading-none truncate w-full">{av.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-natural-coral hover:bg-natural-coral-dark text-white font-bold py-3.5 rounded-xl shadow-md cursor-pointer transition-colors text-xs hover:scale-[1.01]"
                  >
                    Meinen Leseausweis drucken! 🎉
                  </button>
                </form>

                <div className="pt-1 flex justify-between text-xs font-bold text-[#5C5446]/80 select-none">
                  <button
                    onClick={() => {
                      if (availableCards.length > 0) {
                        setPortalMode('student-login');
                      } else {
                        setPortalMode('role-select');
                      }
                    }}
                    className="hover:text-stone-800 transition-colors cursor-pointer"
                  >
                    ← Abbrechen
                  </button>
                </div>
              </motion.div>
            )}

            {/* 4. TEACHER LOGIN WINDOW */}
            {portalMode === 'teacher-login' && (
              <motion.div
                key="teacher-log"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="space-y-0.5">
                  <h2 className="text-2xl font-display font-bold text-stone-800">Lehrkräfte-Login 🏫</h2>
                  <p className="text-xs text-[#5C5446] font-semibold">Melde dich mit deinen Zugangsdaten für das Lehrerzimmer an:</p>
                </div>

                <form onSubmit={handleTeacherSubmit} className="space-y-4">
                  
                  {/* Username */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Benutzername:</label>
                    <input
                      type="text"
                      required
                      placeholder="z.B. lehrer1 oder owner"
                      value={teacherUser}
                      onChange={(e) => setTeacherUser(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-natural-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-natural-green placeholder:text-stone-400 text-stone-800"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Muster-Passwort:</label>
                      <span className="text-[9px] text-[#888173] font-medium italic">Tipp: "klasse3b" oder "loewenzahn-bibliothek"</span>
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="Dein geheimes Passwort"
                      value={teacherPass}
                      onChange={(e) => setTeacherPass(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-natural-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-natural-green placeholder:text-stone-400 text-stone-800"
                    />
                  </div>

                  {teacherError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex gap-2.5 items-start text-xs font-bold text-red-600">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                      <span>{teacherError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-natural-green hover:bg-natural-green-dark text-white font-bold py-3.5 rounded-xl shadow-md cursor-pointer transition-colors text-xs"
                  >
                    Anmelden & Betreten 🚪
                  </button>
                </form>

                <div className="pt-1 flex justify-between text-xs font-bold text-[#5C5446]/80 select-none">
                  <button
                    onClick={() => setPortalMode('role-select')}
                    className="hover:text-stone-800 transition-colors cursor-pointer"
                  >
                    ← Zurück zur Auswahl
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>
    </div>
  );
}
