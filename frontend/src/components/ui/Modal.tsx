import { useEffect, useRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  children: React.ReactNode;
  className?: string;
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
};

export default function Modal({
  open,
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  className,
}: ModalProps) {
  const isVisible = open ?? isOpen ?? false;
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isVisible) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div
      ref={overlayRef}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-black/70 backdrop-blur-md',
        'animate-[fadeIn_150ms_ease-out]',
        'print:hidden',
      )}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className={cn(
          'w-full max-h-[90vh] flex flex-col',
          'bg-surface-elevated border border-border rounded-[var(--radius-xl)]',
          'shadow-xl',
          'animate-[scaleIn_200ms_cubic-bezier(0.16,1,0.3,1)]',
          sizeClasses[size] || 'max-w-md',
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50 flex-shrink-0">
            <h3 className="text-[15px] font-semibold text-text tracking-tight">{title}</h3>
            <button
              onClick={onClose}
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-text-muted hover:text-text hover:bg-surface-hover transition-fast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className={clsx(!title && 'pt-6', 'px-6 py-5 overflow-y-auto flex-1')}>
          {children}
        </div>
      </div>
    </div>
  );
}
