import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { reservationsApi, type Reservation } from '../../api/reservations';
import { AlertTriangle, AlertCircle, Loader2, RotateCcw } from 'lucide-react';

interface CancelReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
  onSuccess: (reservation: Reservation) => void;
}

export default function CancelReservationModal({
  isOpen,
  onClose,
  reservation,
  onSuccess,
}: CancelReservationModalProps) {
  if (!reservation) return null;

  const paidAmount = parseFloat(reservation.paid_amount) || 0;
  const [refundDeposit, setRefundDeposit] = useState(paidAmount > 0);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setSubmitting(true);
    try {
      const updated = await reservationsApi.cancelReservation(reservation.id, {
        reason: reason.trim() || undefined,
        refund_deposit: refundDeposit && paidAmount > 0,
        refund_method: refundDeposit ? refundMethod : undefined,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed to cancel reservation', err);
      const detail = err.response?.data?.detail || err.message || "Erreur lors de l'annulation.";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Annuler la Réservation" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Warning banner */}
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-300 space-y-1">
            <div className="font-semibold text-amber-200">Attention : Libération de stock</div>
            <div>
              En annulant cette réservation, l'appareil{' '}
              <span className="font-bold text-white">
                {reservation.device_name} (IMEI: {reservation.device_imei})
              </span>{' '}
              sera immédiatement remis en stock disponible (<span className="text-emerald-400 font-mono">IN_STOCK</span>).
            </div>
          </div>
        </div>

        {/* Deposit handling */}
        {paidAmount > 0 && (
          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Acompte déjà encaissé :</span>
              <span className="font-bold text-emerald-400">{paidAmount.toFixed(2)} DH</span>
            </div>

            <div className="pt-2 border-t border-neutral-800 space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm text-neutral-200">
                <input
                  type="checkbox"
                  checked={refundDeposit}
                  onChange={(e) => setRefundDeposit(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-neutral-800 border-neutral-700"
                />
                <span>Rembourser cet acompte ({paidAmount.toFixed(2)} DH) au client</span>
              </label>

              {refundDeposit && (
                <div className="pl-6 pt-1 space-y-1">
                  <label className="text-xs text-neutral-400">Moyen de remboursement :</label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value as any)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="CASH">Espèces (Caisse)</option>
                    <option value="BANK_TRANSFER">Virement Bancaire</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reason field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
            Motif / Raison d'annulation (Optionnel)
          </label>
          <Input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Le client ne s'est pas présenté / changement d'avis..."
          />
        </div>

        {/* Modal actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Retour
          </Button>
          <Button type="submit" variant="danger" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Annulation...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Confirmer l'Annulation
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
