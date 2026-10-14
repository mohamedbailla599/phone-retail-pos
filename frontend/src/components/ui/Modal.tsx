import { useEffect, useRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function Modal({ open, onClose, title, children, className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-black/60 backdrop-blur-sm',
        'animate-[fadeIn_150ms_ease-out]',
        'print:hidden',
      )}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className={cn(
          'w-full max-w-md',
          'bg-surface-elevated border border-border rounded-[var(--radius-xl)]',
          'shadow-2xl shadow-black/40',
          'animate-[scaleIn_200ms_cubic-bezier(0.16,1,0.3,1)]',
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <h3 className="text-base font-semibold text-text">{title}</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-text-muted hover:text-text hover:bg-[rgba(255,255,255,0.06)] transition-fast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className={clsx(!title && 'pt-6', 'px-6 pb-6')}>
          {children}
        </div>
      </div>
    </div>
  );
}
