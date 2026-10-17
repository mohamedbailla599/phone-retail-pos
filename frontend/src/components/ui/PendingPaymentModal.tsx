import { useState } from 'react';
import Button from './Button';
import PriceDisplay from './PriceDisplay';
import { CheckCircle, XCircle, Clock, Loader2, X } from 'lucide-react';

interface PendingPayment {
  id: number;
  amount: string;
  method: string;
  status: string;
}

interface PendingPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingPayments: PendingPayment[];
  onConfirm: (paymentId: number) => Promise<void> | void;
  onReject: (paymentId: number) => Promise<void> | void;
}

export default function PendingPaymentModal({
  isOpen,
  onClose,
  pendingPayments,
  onConfirm,
  onReject,
}: PendingPaymentModalProps) {
  const [loadingAction, setLoadingAction] = useState<'confirm' | 'reject' | null>(null);

  if (!isOpen || pendingPayments.length === 0) return null;

  const payment = pendingPayments[0];

  const handleConfirm = async () => {
    try {
      setLoadingAction('confirm');
      await onConfirm(payment.id);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReject = async () => {
    try {
      setLoadingAction('reject');
      await onReject(payment.id);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-surface border border-border/80 rounded-[var(--radius-xl)] p-6 max-w-md w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-text-muted hover:text-text hover:bg-surface-alt rounded-full transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center flex-shrink-0 text-gold">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text">Virement Bancaire en Attente</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Vérifiez la réception sur votre téléphone ou compte bancaire avant de finaliser la vente.
            </p>
          </div>
        </div>

        <div className="bg-surface-alt rounded-xl p-4 mb-5 border border-border/60 space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-text-muted font-medium">Montant à vérifier</span>
            <PriceDisplay amount={parseFloat(payment.amount)} size="md" highlight />
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-text-muted font-medium">Mode de règlement</span>
            <span className="text-text font-semibold">Virement bancaire</span>
          </div>
          <div className="flex justify-between items-center text-xs pt-1 border-t border-border/40">
            <span className="text-text-muted font-medium">Statut</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              En attente de confirmation
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            variant="primary"
            size="lg"
            className="w-full font-bold shadow-md flex items-center justify-center gap-2"
            disabled={loadingAction !== null}
            onClick={handleConfirm}
            icon={loadingAction === 'confirm' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          >
            {loadingAction === 'confirm'
              ? 'Finalisation en cours...'
              : `Confirmer la réception (${parseFloat(payment.amount).toFixed(2)} DH)`}
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="w-full text-xs font-semibold hover:!text-red-400 hover:!bg-red-500/10 hover:!border-red-500/30 flex items-center justify-center gap-2"
            disabled={loadingAction !== null}
            onClick={handleReject}
            icon={loadingAction === 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
          >
            {loadingAction === 'reject' ? 'Annulation...' : 'Rejeter / Annuler ce virement'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="w-full text-xs text-text-muted hover:text-text"
            disabled={loadingAction !== null}
            onClick={onClose}
          >
            Garder en attente (Fermer)
          </Button>
        </div>
      </div>
    </div>
  );
}
