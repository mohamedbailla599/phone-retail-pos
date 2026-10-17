import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-gold text-[#080808] font-semibold hover:bg-gold-bright active:bg-gold-soft shadow-[0_2px_12px_rgba(212,175,90,0.20)] hover:shadow-[0_4px_20px_rgba(212,175,90,0.30)] cursor-pointer',
  secondary:
    'bg-surface-elevated text-text border border-border hover:bg-surface-hover hover:border-border-focus shadow-xs cursor-pointer',
  danger:
    'bg-danger/10 text-red-500 dark:text-red-400 border border-red-500/25 hover:bg-danger/20 hover:border-red-500/40 shadow-xs cursor-pointer',
  ghost:
    'bg-transparent text-text-secondary hover:text-text hover:bg-surface-hover cursor-pointer border border-transparent',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-xs rounded-[var(--radius-md)] gap-1.5',
  md: 'h-10 px-4 text-sm rounded-[var(--radius-md)] gap-2',
  lg: 'h-11 px-5 text-sm rounded-[var(--radius-lg)] gap-2.5',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', icon, loading, children, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center font-medium transition-all duration-150 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:border-gold-border',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
          'active:scale-[0.98]',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <span className="flex-shrink-0 inline-flex items-center">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </span>
        ) : icon ? (
          <span className="flex-shrink-0 inline-flex items-center">{icon}</span>
        ) : null}
        {children && <span className="inline-flex items-center">{children}</span>}
      </button>
    );
  }
);


Button.displayName = 'Button';
export default Button;
