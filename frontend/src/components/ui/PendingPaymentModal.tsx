import Button from './Button';
import PriceDisplay from './PriceDisplay';
import { AlertCircle } from 'lucide-react';

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
  onConfirm: (paymentId: number) => void;
  onReject: (paymentId: number) => void;
}

export default function PendingPaymentModal({
  isOpen,
  onClose,
  pendingPayments,
  onConfirm,
  onReject
}: PendingPaymentModalProps) {
  if (!isOpen || pendingPayments.length === 0) return null;

  const payment = pendingPayments[0]; // Handle the first pending payment

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-[var(--radius-lg)] p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-gold" />
          <h2 className="text-lg font-bold text-text">Bank Transfer Pending</h2>
        </div>
        
        <div className="bg-surface-alt rounded-lg p-4 mb-6 border border-border">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-text-muted">Amount</span>
            <PriceDisplay amount={parseFloat(payment.amount)} size="sm" highlight />
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-text-muted">Method</span>
            <span className="text-text font-medium">{payment.method.replace('_', ' ')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Status</span>
            <span className="text-amber-400 font-medium">Waiting for confirmation</span>
          </div>
        </div>

        <div className="flex gap-3 justify-end flex-col">
          <Button variant="primary" onClick={() => onConfirm(payment.id)}>
            Confirm Transfer
          </Button>
          <Button variant="secondary" className="hover:!text-red-400 hover:!bg-red-500/10" onClick={() => onReject(payment.id)}>
            Reject Transfer
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
