import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Select } from '../ui/Select';
import { customersApi, type Customer, type CustomerDebtPayment } from '../../api/customers';
import OperatorSelectionModal from '../ui/OperatorSelectionModal';
import { useRequireOperator } from '../../hooks/useRequireOperator';
import { Banknote, FileText, Loader2, ArrowRight } from 'lucide-react';

interface RecordDebtPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (payment: CustomerDebtPayment, updatedCustomer: Customer) => void;
  customer: Customer | null;
}

export default function RecordDebtPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  customer,
}: RecordDebtPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'CARD'>('CASH');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    isOperatorModalOpen,
    onOperatorSelected,
    onOperatorModalClose,
    handleOperatorRequired,
  } = useRequireOperator();

  useEffect(() => {
    if (isOpen && customer) {
      setAmount('');
      setPaymentMethod('CASH');
      setNotes('');
      setError('');
    }
  }, [isOpen, customer]);

  const handleClose = () => {
    onClose();
    setAmount('');
    setNotes('');
    setError('');
  };

  const currentDebt = customer ? parseFloat(customer.current_debt || '0') : 0;
  const payAmount = parseFloat(amount || '0');
  const remainingDebt = Math.max(0, currentDebt - (isNaN(payAmount) ? 0 : payAmount));

  const executePayment = async () => {
    if (!customer) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Veuillez saisir un montant de règlement valide.');
      return;
    }

    if (numAmount > currentDebt) {
      setError(`Le montant ne peut pas dépasser la dette actuelle (${currentDebt.toFixed(2)} DH).`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await customersApi.recordDebtPayment(customer.id, {
        amount: numAmount.toFixed(2),
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
      });
      handleClose();
      onSuccess(res.payment, res.customer);
    } catch (err: any) {
      if (handleOperatorRequired(err, executePayment)) {
        return;
      }
      setError(err.response?.data?.error || 'Erreur lors de l’enregistrement du remboursement.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executePayment();
  };

  if (!customer) return null;

  return (
    <>
      <Modal open={isOpen} onClose={handleClose} title="Règlement de Dette">
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Customer Summary Card */}
          <div className="p-4 rounded-xl bg-surface border border-border flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted uppercase font-semibold">Client</p>
              <h4 className="text-base font-bold text-text mt-0.5">{customer.full_name}</h4>
              <p className="text-xs text-text-secondary mt-0.5">{customer.phone_number}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted uppercase font-semibold">Dette actuelle</p>
              <p className="text-lg font-black text-amber-400 mt-0.5 font-mono">
                {currentDebt.toFixed(2)} <span className="text-xs text-text-muted">DH</span>
              </p>
            </div>
          </div>

          {/* Amount input & quick actions */}
          <div className="space-y-2">
            <Input
              label="Montant du versement (DH) *"
              type="number"
              step="0.01"
              min="0.01"
              max={currentDebt}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              icon={<Banknote className="w-4 h-4" />}
              autoFocus
              required
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAmount(currentDebt.toFixed(2))}
                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-gold/15 text-gold hover:bg-gold/25 transition-colors border border-gold/30"
              >
                Régler la totalité ({currentDebt.toFixed(2)} DH)
              </button>
              {currentDebt >= 100 && (
                <button
                  type="button"
                  onClick={() => setAmount((Math.floor(currentDebt / 2)).toFixed(2))}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-surface hover:bg-surface-elevated text-text-secondary transition-colors border border-border"
                >
                  50%
                </button>
              )}
            </div>
          </div>

          {/* Projected Remaining Debt */}
          {!isNaN(payAmount) && payAmount > 0 && (
            <div className="p-3 rounded-lg bg-surface-elevated border border-border flex items-center justify-between text-xs">
              <span className="text-text-muted">Solde restant après ce paiement:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-text-secondary line-through">
                  {currentDebt.toFixed(2)} DH
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-gold" />
                <span className={`font-mono font-bold ${remainingDebt === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {remainingDebt.toFixed(2)} DH
                </span>
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              Mode de paiement
            </label>
            <Select
              value={paymentMethod}
              onChange={(val: string) => setPaymentMethod(val as 'CASH' | 'TRANSFER' | 'CARD')}
              options={[
                { value: 'CASH', label: 'Espèces (Cash)' },
                { value: 'TRANSFER', label: 'Virement bancaire' },
                { value: 'CARD', label: 'Carte Bancaire' },
              ]}
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-text-muted" />
              Référence / Remarque (Optionnel)
            </label>
            <input
              type="text"
              placeholder="Ex: Reçu n° 124, acompte..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-10 bg-surface border border-border rounded-[var(--radius-md)] px-4 text-text text-sm placeholder:text-text-muted focus:outline-none focus:border-gold-border focus:ring-1 focus:ring-gold/20 transition-smooth"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !amount || payAmount <= 0 || payAmount > currentDebt}
              className="min-w-[140px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Validation...
                </>
              ) : (
                'Confirmer le versement'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Operator Requirement fallback modal */}
      <OperatorSelectionModal
        isOpen={isOperatorModalOpen}
        onClose={onOperatorModalClose}
        onSelect={onOperatorSelected}
      />
    </>
  );
}
