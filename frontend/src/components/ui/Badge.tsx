import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'gold';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface-elevated text-text-secondary border-border shadow-xs',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
  danger: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25',
  gold: 'bg-gold/10 text-gold-soft dark:text-gold border-gold-border font-semibold shadow-[0_0_12px_rgba(212,175,90,0.08)]',
};

export default function Badge({ variant = 'default', children, dot, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-full border transition-colors',
        variants[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={clsx('w-1.5 h-1.5 rounded-full', {
            'bg-text-muted': variant === 'default',
            'bg-emerald-500': variant === 'success',
            'bg-amber-500': variant === 'warning',
            'bg-red-500': variant === 'danger',
            'bg-gold': variant === 'gold',
          })}
        />
      )}
      {children}
    </span>
  );
}
