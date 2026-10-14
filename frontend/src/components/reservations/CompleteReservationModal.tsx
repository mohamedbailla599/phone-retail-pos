import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import { reservationsApi, type Reservation } from '../../api/reservations';
import { CheckCircle, AlertCircle, Loader2, Smartphone, User, DollarSign } from 'lucide-react';

interface CompleteReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
  onSuccess: (reservation: Reservation) => void;
}

export default function CompleteReservationModal({
  isOpen,
  onClose,
  reservation,
  onSuccess,
}: CompleteReservationModalProps) {
  if (!reservation) return null;

  const reservedPrice = parseFloat(reservation.reserved_price) || 0;
  const paidAmount = parseFloat(reservation.paid_amount) || 0;
  const remainingBalance = Math.max(reservedPrice - paidAmount, 0);

  const [paymentAmount, setPaymentAmount] = useState<string>(remainingBalance.toString());
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'DEBT'>('CASH');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numPayment = parseFloat(paymentAmount) || 0;
    if (remainingBalance > 0 && numPayment < remainingBalance) {
      setError(
        `Le montant payé (${numPayment} DH) ne couvre pas la totalité du solde restant (${remainingBalance} DH).`
      );
      return;
    }

    setSubmitting(true);
    try {
      const updated = await reservationsApi.completeReservation(reservation.id, {
        payment_amount: remainingBalance > 0 ? numPayment : undefined,
        payment_method: remainingBalance > 0 ? paymentMethod : undefined,
        payment_reference: paymentReference.trim() || undefined,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed to complete reservation', err);
      const detail = err.response?.data?.detail || err.message || 'Erreur lors de la finalisation.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Finaliser la Vente & Retrait du Téléphone" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Summary Card */}
        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
            <div className="flex items-center gap-2 text-sm text-neutral-300">
              <User className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-neutral-100">{reservation.customer_name}</span>
            </div>
            <span className="text-xs text-neutral-400 font-mono">{reservation.customer_phone}</span>
          </div>

          <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
            <div className="flex items-center gap-2 text-sm text-neutral-300">
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span>{reservation.device_name}</span>
            </div>
            <span className="text-xs text-neutral-500 font-mono">
              IMEI: {reservation.device_imei}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="p-2 bg-neutral-950/60 rounded-lg border border-neutral-800/80">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Prix Total</div>
              <div className="font-bold text-sm text-neutral-200 mt-0.5">
                {reservedPrice.toFixed(2)} DH
              </div>
            </div>
            <div className="p-2 bg-neutral-950/60 rounded-lg border border-neutral-800/80">
              <div className="text-[10px] text-emerald-500 uppercase tracking-wider">Acompte Reçu</div>
              <div className="font-bold text-sm text-emerald-400 mt-0.5">
                {paidAmount.toFixed(2)} DH
              </div>
            </div>
            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
              <div className="text-[10px] text-amber-400 uppercase tracking-wider">Solde Restant</div>
              <div className="font-bold text-sm text-amber-300 mt-0.5">
                {remainingBalance.toFixed(2)} DH
              </div>
            </div>
          </div>
        </div>

        {/* Payment input if balance remains */}
        {remainingBalance > 0 ? (
          <div className="space-y-3 p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl">
            <div className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Règlement du Solde Restant ({remainingBalance.toFixed(2)} DH)
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-neutral-400">Montant Encaissé (DH) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-400">Moyen de Paiement *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="CASH">Espèces (Cash)</option>
                  <option value="BANK_TRANSFER">Virement Bancaire</option>
                  <option value="DEBT">Crédit / Dette</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-neutral-400">Référence / Note de paiement (Optionnel)</label>
              <Input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Ex: Solde réglé par virement..."
              />
            </div>
          </div>
        ) : (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Cette réservation est déjà intégralement payée ! Vous pouvez valider la remise de l'appareil.</span>
          </div>
        )}

        <div className="text-xs text-neutral-500 leading-relaxed">
          En validant, le téléphone passera au statut <span className="text-neutral-300 font-semibold">VENDU (SOLD)</span>, 
          la garantie officielle commencera aujourd'hui, et le ticket de caisse définitif sera prêt.
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validation en cours...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmer la Vente & Remise
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
