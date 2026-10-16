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

  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  const lastSearchTermRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastSearchTermRef.current !== debouncedSearchTerm) {
      lastSearchTermRef.current = debouncedSearchTerm;
      try {
        onSearchRef.current(debouncedSearchTerm);
      } catch (err) {
        console.error('Search error in SearchableSelect:', err);
      }
    }
  }, [debouncedSearchTerm]);

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
          "w-full h-10 px-3.5 flex items-center justify-between text-sm transition-all rounded-[var(--radius-md)] border text-left",
          "bg-surface-alt focus-within:ring-2 focus-within:ring-gold/30 focus-within:border-gold-border",
          error ? "border-danger focus-within:border-danger focus-within:ring-danger/20" : "border-border hover:border-border-focus",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && !error && "border-gold-border ring-2 ring-gold/20"
        )}
        onClick={() => !disabled && setIsOpen(true)}
      >
        <div className="flex items-center gap-2 w-full flex-1 min-w-0">
          {!isOpen && selectedOption ? (
             <span className="text-text truncate cursor-pointer w-full font-medium">{selectedOption.label}</span>
          ) : (
            <>
              <Search className="w-4 h-4 text-text-muted shrink-0" />
              <input
                type="text"
                disabled={disabled}
                placeholder={selectedOption ? selectedOption.label : placeholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-text w-full placeholder:text-text-muted truncate text-sm"
              />
            </>
          )}
        </div>
        <div className="shrink-0 flex items-center ml-2">
          {loading ? (
            <Loader2 className="w-4 h-4 text-gold animate-spin" />
          ) : (
            <ChevronDown className={cn("w-4 h-4 text-text-muted transition-transform duration-200 cursor-pointer hover:text-text", isOpen && "rotate-180")} onClick={(e) => { e.stopPropagation(); if(!disabled) setIsOpen(!isOpen); }} />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-surface-elevated border border-border rounded-[var(--radius-md)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <ul className="max-h-60 overflow-auto py-1 divide-y divide-border/20">
            {options.map((option) => (
              <li
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setSearchTerm('');
                  setIsOpen(false);
                }}
                className={cn(
                  "flex flex-col px-3.5 py-2.5 text-sm cursor-pointer transition-colors",
                  value === option.value
                    ? "bg-gold/15 text-gold font-medium"
                    : "text-text hover:bg-surface-hover"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{option.label}</span>
                  {value === option.value && <Check className="w-4 h-4 shrink-0 text-gold ml-2" />}
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
