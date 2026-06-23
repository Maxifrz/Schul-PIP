import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NewsItem, Event } from '../types';
import { Calendar, Bell, MapPin, Clock, X, Heart, Smile } from 'lucide-react';
import MascotMessage from './MascotMessage';

interface HomeProps {
  news: NewsItem[];
  events: Event[];
  onNavigate: (tab: 'catalog' | 'quiz' | 'card') => void;
}

export default function Home({ news, events, onNavigate }: HomeProps) {
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [rsvpEvents, setRsvpEvents] = useState<string[]>([]);
  const [likesNews, setLikesNews] = useState<Record<string, number>>({});

  const handleRsvp = (eventId: string, eventTitle: string) => {
    if (rsvpEvents.includes(eventId)) {
      setRsvpEvents(prev => prev.filter(id => id !== eventId));
    } else {
      setRsvpEvents(prev => [...prev, eventId]);
    }
  };

  const toggleLikeNews = (newsId: string) => {
    setLikesNews(prev => ({
      ...prev,
      [newsId]: (prev[newsId] || 0) + 1
    }));
  };

  const getEventIcon = (category: string) => {
    switch (category) {
      case 'reading':
        return '📖';
      case 'craft':
        return '🎨';
      case 'quiz':
        return '👑';
      case 'party':
        return '🎈';
      default:
        return '⭐️';
    }
  };

  // Sort events by date
  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-10" id="home-view">
      {/* Welcome Hero banner */}
      <section className="relative overflow-hidden bg-natural-green rounded-[40px] p-6 md:p-10 text-white shadow-md border border-natural-green-dark/10">
        <div className="absolute right-0 bottom-0 opacity-10 select-none text-9xl">📖</div>
        <div className="max-w-xl space-y-4 relative z-10">
          <span className="bg-white/20 text-xs md:text-sm font-semibold tracking-wider uppercase px-3 py-1 rounded-full text-white">
            Willkommen in deiner Schulbücherei!
          </span>
          <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-white leading-tight">
            Schlag das nächste Abenteuer auf! 📖✨
          </h1>
          <p className="text-sm md:text-base text-white/90 font-medium">
            Entdecke ferne Welten, löse spannende Rätsel mit Detektiven oder entdecke die Wunder unseres Weltalls. Bei uns ist für jeden Bücherwurm etwas dabei!
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => onNavigate('catalog')}
              className="bg-white text-natural-green hover:bg-natural-hover active:scale-95 transition-all px-5 py-3 rounded-xl font-semibold text-sm md:text-base shadow-sm pointer"
              id="hero-go-catalog"
            >
              🚀 Bücher entdecken
            </button>
            <button
              onClick={() => onNavigate('quiz')}
              className="bg-natural-green-dark text-white hover:bg-natural-green-dark/80 active:scale-95 transition-all px-5 py-3 rounded-xl font-semibold text-sm md:text-base border border-white/20 pointer"
              id="hero-go-quiz"
            >
              👑 Mitmach-Quiz spielen
            </button>
          </div>
        </div>
      </section>

      {/* Berti introduction */}
      <MascotMessage 
        message="Schön, dass du da bist! Unten auf meinem 'Schwarzen Brett' findest du brandheiße Neuigkeiten. Und rechts siehst du, welche coolen Events wir diese Woche planen!" 
        mood="happy"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* News Board (Schwarzes Brett) - Takes 7 cols */}
        <section className="lg:col-span-7 space-y-4" id="section-news">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📌</span>
            <h2 className="text-2xl font-display font-bold text-natural-dark">
              Das Schwarze Brett (Neuigkeiten)
            </h2>
          </div>

          <div className="bg-natural-soft p-6 rounded-[40px] border border-natural-border shadow-sm min-h-[450px] relative overflow-hidden">
            {/* Visual pins in key corners */}
            <div className="absolute top-2 left-1/3 text-lg select-none filter drop-shadow">📍</div>
            <div className="absolute top-4 right-1/4 text-lg select-none filter drop-shadow">📍</div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {news.map((item) => (
                <motion.div
                  key={item.id}
                  whileHover={{ scale: 1.02 }}
                  className="p-5 rounded-3xl bg-white shadow-xs cursor-pointer transition-all border border-natural-border hover:border-natural-green relative"
                  onClick={() => setSelectedNews(item)}
                  id={`news-card-${item.id}`}
                >
                  {/* Pushpin design top center */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg drop-shadow select-none">📌</div>
                  
                  <div className="text-xs font-mono font-bold text-natural-muted mb-2">
                    {item.date}
                  </div>
                  <h3 className="text-base font-display font-bold text-natural-dark mb-2 line-clamp-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-natural-text font-sans line-clamp-3 leading-relaxed mb-3">
                    {item.content}
                  </p>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-natural-soft text-xs">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-natural-soft text-natural-text">
                      {item.category === 'neu' ? '🆕 Neu' : item.category === 'aktion' ? '🎉 Aktion' : item.category === 'wichtig' ? '⚠️ Wichtig' : '💡 Tipp'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLikeNews(item.id);
                      }}
                      className="flex items-center gap-1 hover:text-natural-coral transition-colors text-natural-muted font-medium"
                    >
                      <Heart className="w-3 h-3 fill-natural-coral text-natural-coral" />
                      <span>{likesNews[item.id] || 0}</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Live Calendar Section - Takes 5 cols */}
        <section className="lg:col-span-5 space-y-4" id="section-calendar">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📅</span>
            <h2 className="text-2xl font-display font-bold text-natural-dark">
              Anstehende Termine
            </h2>
          </div>

          <div className="bg-white rounded-[40px] p-6 border border-natural-border shadow-sm space-y-4">
            <div className="bg-natural-soft rounded-2xl p-4 flex items-center gap-3 border border-natural-border/50">
              <Calendar className="w-8 h-8 text-natural-green" />
              <div>
                <h3 className="text-sm font-display font-bold text-natural-dark">Treffpunkt & Spaß</h3>
                <p className="text-xs text-natural-text">Alle Veranstaltungen finden direkt in unserer Schulbücherei statt!</p>
              </div>
            </div>

            <div className="space-y-4">
              {sortedEvents.map((event) => {
                const eventDate = new Date(event.date);
                const isSignedUp = rsvpEvents.includes(event.id);
                const day = eventDate.getDate();
                // German month names mapping
                const monthName = eventDate.toLocaleString('de-DE', { month: 'short' });
                const weekdayName = eventDate.toLocaleString('de-DE', { weekday: 'short' });

                return (
                  <div
                    key={event.id}
                    className="flex gap-4 p-4 rounded-3xl bg-white hover:bg-natural-hover/50 border border-natural-border transition-all duration-300 shadow-xs"
                    id={`event-card-${event.id}`}
                  >
                    {/* Retro calendar sheet style in coral/green */}
                    <div className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 bg-white border border-natural-border rounded-xl shadow-xs overflow-hidden">
                      <div className="w-full bg-natural-coral text-[10px] text-center py-0.5 text-white font-bold uppercase tracking-wider">
                        {monthName}
                      </div>
                      <div className="text-xl font-bold text-natural-dark -my-0.5">
                        {day}
                      </div>
                      <div className="text-[10px] text-natural-muted font-medium pb-0.5">
                        {weekdayName}
                      </div>
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-base font-display font-bold text-natural-dark leading-snug">
                          {event.title}
                        </h4>
                        <span className="text-xl select-none" title={event.icon}>
                          {getEventIcon(event.icon)}
                        </span>
                      </div>
                      
                      <p className="text-xs text-natural-text line-clamp-2">
                        {event.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-natural-muted pb-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-natural-muted" />
                          {event.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-natural-muted" />
                          {event.location}
                        </span>
                      </div>

                      {/* Attend Event button */}
                      <div className="pt-1 flex items-center justify-between">
                        {isSignedUp ? (
                          <span className="text-xs font-semibold text-natural-green flex items-center gap-1">
                            <Smile className="w-4 h-4 fill-natural-soft text-natural-green" /> Du bist dabei! 🎒
                          </span>
                        ) : (
                          <span className="text-xs text-natural-muted font-medium">Bist du dabei?</span>
                        )}
                        <button
                          onClick={() => handleRsvp(event.id, event.title)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all pointer ${
                            isSignedUp
                              ? 'bg-natural-soft text-natural-dark hover:bg-natural-border'
                              : 'bg-natural-green hover:bg-natural-green-dark active:scale-95 text-white'
                          }`}
                        >
                          {isSignedUp ? 'Abmelden' : 'Anmelden! 👍'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Modal for full News item detail */}
      <AnimatePresence>
        {selectedNews && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[40px] max-w-lg w-full overflow-hidden shadow-2xl border border-natural-border"
              id="news-modal"
            >
              <div className="bg-natural-soft p-6 relative border-b border-natural-border">
                <button
                  onClick={() => setSelectedNews(null)}
                  className="absolute right-4 top-4 p-1 rounded-full bg-white/80 hover:bg-white text-natural-muted shadow-xs transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="text-sm font-bold text-natural-green mb-1">
                  {selectedNews.date}
                </div>
                <h3 className="text-xl md:text-2xl font-display font-medium text-natural-dark pr-8">
                  {selectedNews.title}
                </h3>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-natural-text text-sm md:text-base leading-relaxed whitespace-pre-line">
                  {selectedNews.content}
                </p>

                <div className="flex justify-between items-center pt-4 border-t border-natural-soft">
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-natural-soft text-natural-text">
                      {selectedNews.category}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleLikeNews(selectedNews.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-natural-soft text-natural-coral hover:bg-natural-border/40 font-bold text-xs"
                  >
                    <Heart className="w-4 h-4 fill-natural-coral text-natural-coral" />
                    <span>Gefällt {likesNews[selectedNews.id] || 0} Kindern</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
