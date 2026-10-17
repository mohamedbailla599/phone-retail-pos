import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import Button from './Button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-[var(--radius-lg)] border border-dashed border-border bg-surface/40',
        className
      )}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center text-text-muted mb-3.5 shadow-xs">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <h3 className="text-section-title text-text font-bold mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-body text-text-secondary max-w-md mx-auto mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant="secondary"
          size="sm"
          onClick={action.onClick}
          icon={ActionIcon ? <ActionIcon className="w-4 h-4" /> : undefined}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
