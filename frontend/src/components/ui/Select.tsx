import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  className,
  error,
  disabled,
  required
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full h-10 px-3.5 flex items-center justify-between text-sm transition-all rounded-[var(--radius-md)] border text-left",
          "bg-surface-alt focus:outline-none focus:ring-2 focus:ring-gold/30",
          error 
            ? "border-danger text-danger focus:border-danger focus:ring-danger/20" 
            : "border-border text-text hover:border-border-focus focus:border-gold-border hover:bg-surface-elevated",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && !error && "border-gold-border ring-2 ring-gold/20"
        )}
      >
        <span className={!selectedOption ? "text-text-muted" : "truncate"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-text-muted transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-surface-elevated border border-border rounded-[var(--radius-md)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <ul className="max-h-60 overflow-auto py-1 divide-y divide-border/20">
            {options.map((option) => (
              <li
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between px-3.5 py-2.5 text-sm cursor-pointer transition-colors",
                  value === option.value
                    ? "bg-gold/15 text-gold font-medium"
                    : "text-text hover:bg-surface-hover"
                )}
              >
                <span className="truncate">{option.label}</span>
                {value === option.value && <Check className="w-4 h-4 text-gold flex-shrink-0 ml-2" />}
              </li>
            ))}
            {options.length === 0 && (
              <li className="px-3 py-2 text-sm text-text-muted text-center">
                No options available
              </li>
            )}
          </ul>
        </div>
      )}
      {/* Hidden select for form submission/required validation */}
      <select 
        className="hidden" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
