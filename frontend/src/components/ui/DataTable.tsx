import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

interface DataTableProps {
  children: React.ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
  tableClassName?: string;
}

export default function DataTable({
  children,
  loading = false,
  isEmpty = false,
  emptyState,
  className,
  tableClassName,
}: DataTableProps) {
  return (
    <div
      className={clsx(
        'bg-surface border border-border rounded-[var(--radius-lg)] overflow-hidden relative shadow-xs min-h-[220px] flex flex-col',
        className
      )}
    >
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-surface/60 backdrop-blur-xs flex items-center justify-center z-20">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-surface-elevated border border-border shadow-md">
            <Loader2 className="w-5 h-5 text-gold animate-spin" />
            <span className="text-caption text-text-secondary font-medium">Chargement...</span>
          </div>
        </div>
      )}

      {/* Responsive Table Wrapper */}
      <div className="overflow-x-auto flex-1">
        <table className={clsx('w-full text-left border-collapse text-body', tableClassName)}>
          {children}
        </table>
      </div>

      {/* Empty State */}
      {!loading && isEmpty && (
        <div className="p-8 flex-1 flex items-center justify-center">
          {emptyState || (
            <div className="text-center py-8 text-text-muted text-body">
              Aucun élément trouvé.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
