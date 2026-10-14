import { type InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  label?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, label, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={clsx(
              'w-full h-10 bg-surface-alt border border-border rounded-[var(--radius-md)]',
              'text-text text-sm placeholder:text-text-muted',
              'focus:outline-none focus:border-gold-border focus:ring-2 focus:ring-gold/20',
              'hover:border-border-focus',
              'transition-all duration-200',
              icon ? 'pl-10 pr-4' : 'px-4',
              className,
            )}
            {...props}
          />
        </div>
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
