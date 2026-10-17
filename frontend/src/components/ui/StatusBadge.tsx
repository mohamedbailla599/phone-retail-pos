import { clsx } from 'clsx';

export type BadgeTone = 'success' | 'info' | 'warning' | 'danger' | 'orange' | 'purple' | 'neutral' | 'gold';

interface StatusBadgeProps {
  status?: string;
  label?: string;
  tone?: BadgeTone;
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const toneStyles: Record<BadgeTone, { badge: string; dot: string }> = {
  success: {
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  info: {
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
    dot: 'bg-blue-500',
  },
  warning: {
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
    dot: 'bg-amber-500',
  },
  orange: {
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25',
    dot: 'bg-orange-500',
  },
  danger: {
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25',
    dot: 'bg-red-500',
  },
  purple: {
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25',
    dot: 'bg-purple-500',
  },
  gold: {
    badge: 'bg-gold/10 text-gold-soft dark:text-gold border-gold-border',
    dot: 'bg-gold',
  },
  neutral: {
    badge: 'bg-surface-elevated text-text-secondary border-border',
    dot: 'bg-text-muted',
  },
};

/**
 * Normalized status dictionary mapping DB codes to unified French labels and semantic colors.
 */
const statusMap: Record<string, { label: string; tone: BadgeTone }> = {
  // Inventory Devices & Accessories
  IN_STOCK: { label: 'En stock', tone: 'success' },
  SOLD: { label: 'Vendu', tone: 'info' },
  RESERVED: { label: 'Réservé', tone: 'warning' },
  REPAIR: { label: 'En réparation', tone: 'orange' },
  DAMAGED: { label: 'Endommagé', tone: 'danger' },
  LOST: { label: 'Perdu', tone: 'danger' },

  // Reservations & Sales
  ACTIVE: { label: 'En cours', tone: 'warning' },
  COMPLETED: { label: 'Finalisé', tone: 'success' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
  EXPIRED: { label: 'Expiré', tone: 'neutral' },
  DRAFT: { label: 'Brouillon', tone: 'neutral' },

  // Debts & Payments
  PAID: { label: 'Soldé', tone: 'success' },
  SETTLED: { label: 'Soldé', tone: 'success' },
  PARTIAL: { label: 'Partiel', tone: 'warning' },
  UNPAID: { label: 'Impayé', tone: 'danger' },
  OVERDUE: { label: 'En retard', tone: 'danger' },

  // Approvals, Returns & Refunds
  PENDING: { label: 'En attente', tone: 'warning' },
  REQUESTED: { label: 'En attente', tone: 'warning' },
  UNDER_REVIEW: { label: 'En révision', tone: 'info' },
  APPROVED: { label: 'Approuvé', tone: 'success' },
  REJECTED: { label: 'Rejeté', tone: 'danger' },
  RESTOCKED: { label: 'Restocké', tone: 'purple' },
  REFUNDED: { label: 'Remboursé', tone: 'purple' },

  // Repairs & Warranty
  RECEIVED: { label: 'Reçu', tone: 'info' },
  DIAGNOSING: { label: 'Diagnostic', tone: 'info' },
  IN_PROGRESS: { label: 'En cours', tone: 'warning' },
  AWAITING_PARTS: { label: 'Attente pièces', tone: 'orange' },
  WAITING_PARTS: { label: 'Attente pièces', tone: 'orange' },
  READY: { label: 'Prêt', tone: 'success' },
  DELIVERED: { label: 'Livré', tone: 'neutral' },
  WARRANTY_ACTIVE: { label: 'Sous garantie', tone: 'success' },
  WARRANTY_EXPIRED: { label: 'Garantie expirée', tone: 'neutral' },
};

export default function StatusBadge({
  status,
  label,
  tone,
  dot = true,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const normKey = (status || '').toUpperCase().trim();
  const matched = statusMap[normKey];

  const resolvedLabel = label || (matched ? matched.label : status ? status.replace(/_/g, ' ') : '—');
  const resolvedTone = tone || (matched ? matched.tone : 'neutral');
  const styles = toneStyles[resolvedTone];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-semibold rounded-full border transition-colors select-none tracking-normal whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]',
        styles.badge,
        className
      )}
    >
      {dot && (
        <span
          className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', styles.dot)}
        />
      )}
      <span>{resolvedLabel}</span>
    </span>
  );
}
