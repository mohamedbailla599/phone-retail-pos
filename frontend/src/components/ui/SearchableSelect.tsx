import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Loader2, Search } from 'lucide-react';
import { cn } from './Select';
import { useDebounce } from '../../hooks/useDebounce';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  onSearch: (query: string) => void;
  loading?: boolean;
  placeholder?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  onSearch,
  loading,
  placeholder = 'Search...',
  className,
  error,
  disabled
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    onSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, onSearch]);

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
      <div
        className={cn(
          "w-full h-10 px-3 flex items-center justify-between text-sm transition-colors rounded-[var(--radius-md)] border text-left",
          "bg-[rgba(255,255,255,0.02)] focus-within:border-gold/50",
          error ? "border-red-500/50" : "border-border",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && !error && "border-gold/50"
        )}
        onClick={() => !disabled && setIsOpen(true)}
      >
        <div className="flex items-center gap-2 w-full flex-1 min-w-0">
          {!isOpen && selectedOption ? (
             <span className="text-text truncate cursor-pointer w-full">{selectedOption.label}</span>
          ) : (
            <>
              <Search className="w-4 h-4 text-text-muted shrink-0" />
              <input
                type="text"
                disabled={disabled}
                placeholder={selectedOption ? selectedOption.label : placeholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-text w-full placeholder:text-text-muted truncate"
              />
            </>
          )}
        </div>
        <div className="shrink-0 flex items-center ml-2">
          {loading ? (
            <Loader2 className="w-4 h-4 text-gold animate-spin" />
          ) : (
            <ChevronDown className={cn("w-4 h-4 text-text-muted transition-transform duration-200 cursor-pointer", isOpen && "rotate-180")} onClick={(e) => { e.stopPropagation(); if(!disabled) setIsOpen(!isOpen); }} />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-[var(--radius-md)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <ul className="max-h-60 overflow-auto py-1">
            {options.map((option) => (
              <li
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setSearchTerm('');
                  setIsOpen(false);
                }}
                className={cn(
                  "flex flex-col px-3 py-2 text-sm cursor-pointer transition-colors",
                  value === option.value
                    ? "bg-gold/10 text-gold"
                    : "text-text hover:bg-[rgba(255,255,255,0.05)]"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{option.label}</span>
                  {value === option.value && <Check className="w-4 h-4 shrink-0" />}
                </div>
                {option.description && (
                  <span className="text-xs text-text-muted truncate mt-0.5">{option.description}</span>
                )}
              </li>
            ))}
            {options.length === 0 && !loading && (
              <li className="px-3 py-2 text-sm text-text-muted text-center">
                No products found
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
