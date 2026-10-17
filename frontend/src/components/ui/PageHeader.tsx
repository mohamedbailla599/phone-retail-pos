import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={clsx(
        'h-[72px] flex items-center justify-between px-6 md:px-8 bg-surface border-b border-border flex-shrink-0 relative z-20',
        className
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold-border flex items-center justify-center text-gold flex-shrink-0 shadow-xs">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-page-title text-text truncate">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <div className="text-caption text-text-secondary mt-0.5 truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
