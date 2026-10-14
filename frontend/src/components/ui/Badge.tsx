import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'gold';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-[rgba(255,255,255,0.06)] text-text-secondary border-border',
  success: 'bg-success-bg text-emerald-400 border-emerald-500/20',
  warning: 'bg-warning-bg text-amber-400 border-amber-500/20',
  danger: 'bg-danger-bg text-red-400 border-red-500/20',
  gold: 'bg-gold-muted text-gold border-gold-border',
};

export default function Badge({ variant = 'default', children, dot, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-full border',
        variants[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={clsx('w-1.5 h-1.5 rounded-full', {
            'bg-text-muted': variant === 'default',
            'bg-emerald-400': variant === 'success',
            'bg-amber-400': variant === 'warning',
            'bg-red-400': variant === 'danger',
            'bg-gold': variant === 'gold',
          })}
        />
      )}
      {children}
    </span>
  );
}
