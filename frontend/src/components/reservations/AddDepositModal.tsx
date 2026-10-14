import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { reservationsApi, type Reservation } from '../../api/reservations';
import { PlusCircle, AlertCircle } from 'lucide-react';

interface AddDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
  onSuccess: (reservation: Reservation) => void;
}

export default function AddDepositModal({
  isOpen,
  onClose,
  reservation,
  onSuccess,
}: AddDepositModalProps) {
  if (!reservation) return null;

  const reservedPrice = parseFloat(reservation.reserved_price) || 0;
  const paidAmount = parseFloat(reservation.paid_amount) || 0;
  const remainingBalance = Math.max(reservedPrice - paidAmount, 0);

  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'DEBT'>('CASH');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) {
      setError('Veuillez saisir un montant supérieur à 0.');
      return;
    }

    if (numAmount > remainingBalance) {
      setError(
        `Le versement (${numAmount} DH) dépasse le solde restant à payer (${remainingBalance} DH).`
      );
      return;
    }

    setSubmitting(true);
    try {
      const updated = await reservationsApi.addPayment(reservation.id, {
        amount: numAmount,
        method,
        reference: reference.trim() || undefined,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed to add deposit payment', err);
      const detail = err.response?.data?.detail || err.message || "Erreur lors de l'enregistrement du versement.";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter un Acompte / Versement" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* State snapshot */}
        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Client :</span>
            <span className="font-semibold text-neutral-100">{reservation.customer_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Appareil :</span>
            <span className="text-neutral-200">{reservation.device_name}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-neutral-800">
            <span className="text-neutral-400">Déjà versé :</span>
            <span className="font-semibold text-emerald-400">{paidAmount.toFixed(2)} DH</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Solde restant à payer :</span>
            <span className="font-bold text-amber-400">{remainingBalance.toFixed(2)} DH</span>
          </div>
        </div>

        {/* Form fields */}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">
              Montant du Versement (DH) *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={remainingBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Max: ${remainingBalance.toFixed(2)}`}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">
              Moyen de Paiement *
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-amber-500"
            >
              <option value="CASH">Espèces (Cash)</option>
              <option value="BANK_TRANSFER">Virement Bancaire</option>
              <option value="DEBT">Crédit / Dette</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">
              Référence / Note (Optionnel)
            </label>
            <Input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex: Reçu virement 500 DH..."
            />
          </div>
        </div>

        {/* Modal actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            icon={<PlusCircle className="w-4 h-4" />}
          >
            {submitting ? 'Enregistrement...' : 'Enregistrer le Versement'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
