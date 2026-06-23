import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Ja, löschen",
  cancelText = "Abbrechen",
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop with a lower index than content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="fixed inset-0 bg-stone-950/70 backdrop-blur-xs transition-opacity"
        />

        {/* Modal content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative bg-white rounded-[32px] p-6 max-w-sm w-full border border-natural-border shadow-2xl space-y-4 font-sans text-left z-10"
        >
          <div className="flex items-center gap-3 text-natural-coral">
            <div className="p-2 bg-natural-coral/10 rounded-full flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-natural-coral animate-bounce" />
            </div>
            <h3 className="font-display font-bold text-lg text-stone-800 leading-tight">{title}</h3>
          </div>

          <p className="text-xs text-[#5C5446] leading-relaxed font-medium">
            {message}
          </p>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 bg-natural-soft hover:bg-[#EAE5D9] text-[#5C5446] font-bold rounded-2xl text-xs transition-all cursor-pointer border border-[#E1DCD1]/50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
              }}
              className="flex-1 py-3 bg-natural-coral hover:bg-natural-coral-dark text-white font-bold rounded-2xl text-xs shadow-md shadow-natural-coral/20 hover:scale-[1.02] transition-all cursor-pointer"
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
