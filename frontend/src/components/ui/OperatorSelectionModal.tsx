import { useState, useEffect } from 'react';
import { User, ChevronRight, X, Loader2 } from 'lucide-react';
import { authApi, type User as ApiUser } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';

interface OperatorSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: () => void; // Called after operator is successfully selected
  title?: string;
  description?: string;
}

export default function OperatorSelectionModal({
  isOpen,
  onClose,
  onSelect,
  title = "Who is operating?",
  description = "This operation will be recorded under the selected operator."
}: OperatorSelectionModalProps) {
  const [operators, setOperators] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState('');
  const { setOperator } = useAuthStore();

  useEffect(() => {
    if (isOpen) {
      loadOperators();
    }
  }, [isOpen]);

  const loadOperators = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await authApi.getOperators();
      setOperators(data);
    } catch (err) {
      setError('Failed to load operators.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (op: ApiUser) => {
    try {
      setSelecting(true);
      setError('');
      const data = await authApi.selectOperator(op.id);
      setOperator(data.operator);
      onSelect();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to select operator.');
    } finally {
      setSelecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm glass-panel rounded-[var(--radius-xl)] shadow-2xl border border-border/50 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border/50">
          <div>
            <h2 className="text-lg font-bold text-text tracking-tight">{title}</h2>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">{description}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 -mt-2 text-text-muted hover:text-text hover:bg-surface-hover rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          {error && (
            <div className="p-3 text-sm text-red-200 bg-danger/10 border border-danger/20 rounded-lg">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 text-gold animate-spin" />
            </div>
          ) : operators.length === 0 ? (
            <div className="text-center p-6 text-sm text-text-muted">
              No operators found.
            </div>
          ) : (
            operators.map((op) => (
              <button
                key={op.id}
                onClick={() => handleSelect(op)}
                disabled={selecting}
                className="w-full group flex items-center justify-between p-4 rounded-xl bg-surface-alt border border-border/50 hover:border-gold-border hover:bg-gold/5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold-border/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <User className="w-4 h-4 text-gold" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-text text-[14px]">{op.display_name}</p>
                    <p className="text-[11px] text-text-muted uppercase tracking-wider">OPERATOR</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-gold group-hover:translate-x-1 transition-all" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
