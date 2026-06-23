import { motion } from 'motion/react';

interface MascotMessageProps {
  message?: string;
  mood?: 'happy' | 'thinking' | 'excited' | 'reading';
}

export default function MascotMessage({ 
  message = "Hallo! Ich bin Berti, dein smarter Bücherwurm. Schnupper doch mal in unsere Bücher hinein!", 
  mood = 'happy' 
}: MascotMessageProps) {
  
  const getAvatar = () => {
    switch (mood) {
      case 'excited':
        return '🐛✨';
      case 'thinking':
        return '🐛🧐';
      case 'reading':
        return '🐛📖';
      case 'happy':
      default:
        return '🐛🍎';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="flex items-start gap-4 p-4 bg-natural-soft border border-natural-border rounded-3xl shadow-sm max-w-2xl mx-auto my-4"
      id="mascot-bubble"
    >
      <div className="text-4xl select-none flex-shrink-0 animate-bounce p-2 bg-white rounded-full border border-natural-border/60 shadow-inner">
        {getAvatar()}
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-display font-bold text-natural-green">
          Berti der Bücherwurm sagt:
        </h4>
        <p className="text-sm md:text-base text-natural-text font-sans mt-1 leading-relaxed">
          "{message}"
        </p>
      </div>
    </motion.div>
  );
}
