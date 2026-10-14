import { clsx } from 'clsx';

interface PriceDisplayProps {
  amount: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  highlight?: boolean;
}

const sizes = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-4xl',
};

export default function PriceDisplay({
  amount,
  currency = 'DH',
  size = 'md',
  highlight = false,
  className,
}: PriceDisplayProps) {
  const formatted = amount.toLocaleString('fr-MA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <span
      className={clsx(
        'price-display inline-flex items-baseline gap-1.5',
        sizes[size],
        highlight ? 'text-gold' : 'text-text',
        className,
      )}
    >
      <span>{formatted}</span>
      <span
        className={clsx(
          'font-semibold',
          size === 'xl' ? 'text-lg' : size === 'lg' ? 'text-sm' : 'text-xs',
          highlight ? 'text-gold-soft' : 'text-text-muted',
        )}
      >
        {currency}
      </span>
    </span>
  );
}
