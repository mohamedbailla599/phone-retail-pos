import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export type StatCardVariant = 'gold' | 'emerald' | 'blue' | 'amber' | 'rose' | 'neutral' | 'cyan' | 'purple';

interface StatCardProps {
  label?: string;
  title?: string;
  value: string | number;
  subValue?: React.ReactNode;
  icon?: LucideIcon;
  variant?: StatCardVariant;
  iconColor?: StatCardVariant;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}

const variantStyles: Record<StatCardVariant, { badge: string; icon: string; glow: string }> = {
  gold: {
    badge: 'bg-gold/10 border-gold/25',
    icon: 'text-gold',
    glow: 'from-gold/5 to-transparent',
  },
  emerald: {
    badge: 'bg-emerald-500/10 border-emerald-500/25',
    icon: 'text-emerald-500 dark:text-emerald-400',
    glow: 'from-emerald-500/5 to-transparent',
  },
  blue: {
    badge: 'bg-blue-500/10 border-blue-500/25',
    icon: 'text-blue-500 dark:text-blue-400',
    glow: 'from-blue-500/5 to-transparent',
  },
  amber: {
    badge: 'bg-amber-500/10 border-amber-500/25',
    icon: 'text-amber-500 dark:text-amber-400',
    glow: 'from-amber-500/5 to-transparent',
  },
  rose: {
    badge: 'bg-red-500/10 border-red-500/25',
    icon: 'text-red-500 dark:text-red-400',
    glow: 'from-red-500/5 to-transparent',
  },
  cyan: {
    badge: 'bg-cyan-500/10 border-cyan-500/25',
    icon: 'text-cyan-500 dark:text-cyan-400',
    glow: 'from-cyan-500/5 to-transparent',
  },
  purple: {
    badge: 'bg-purple-500/10 border-purple-500/25',
    icon: 'text-purple-500 dark:text-purple-400',
    glow: 'from-purple-500/5 to-transparent',
  },
  neutral: {
    badge: 'bg-surface-elevated border-border',
    icon: 'text-text-secondary',
    glow: 'from-surface-elevated to-transparent',
  },
};

export default function StatCard({
  label,
  title,
  value,
  subValue,
  icon: Icon,
  variant,
  iconColor,
  loading = false,
  className,
  onClick,
}: StatCardProps) {
  const effectiveVariant = variant || iconColor || 'gold';
  const styles = variantStyles[effectiveVariant] || variantStyles.gold;

  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-surface border border-border rounded-[var(--radius-lg)] p-5 shadow-xs relative overflow-hidden transition-all duration-200 group',
        onClick ? 'cursor-pointer hover:border-border-focus hover:shadow-md active:scale-[0.99]' : '',
        className
      )}
    >
      {/* Subtle top accent gradient */}
      <div
        className={clsx(
          'absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-50 transition-opacity group-hover:opacity-100',
          styles.glow
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <span className="text-overline text-text-muted select-none">
          {label || title}
        </span>
        {Icon && (
          <div
            className={clsx(
              'w-9 h-9 rounded-[var(--radius-md)] border flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105',
              styles.badge,
              styles.icon
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="h-8 flex items-center">
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
          </div>
        ) : (
          <div className="text-2xl md:text-[28px] font-bold text-text tabular-nums tracking-tight leading-none">
            {value}
          </div>
        )}
        {subValue && (
          <div className="text-caption text-text-secondary mt-2 flex items-center gap-1.5 truncate">
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
}
