import React, { useState } from 'react';
import { X, CheckCircle, Printer, CreditCard, Banknote, ShieldCheck, AlertCircle } from 'lucide-react';
import { repairsApi, type RepairTicket, type DeliverRepairPayload } from '../../api/repairs';
import { printRepairDeliveryReceipt } from '../../utils/printRepairReceipt';

interface DeliverRepairModalProps {
  isOpen: boolean;
  ticket: RepairTicket | null;
  onClose: () => void;
  onSuccess: (delivered: RepairTicket) => void;
}

export const DeliverRepairModal: React.FC<DeliverRepairModalProps> = ({
  isOpen,
  ticket,
  onClose,
  onSuccess,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !ticket) return null;

  const finalCost = parseFloat(ticket.final_cost) || 0;
  const depositPaid = parseFloat(ticket.deposit_paid) || 0;
  const balanceDue = Math.max(0, finalCost - depositPaid);

  const handleDeliver = async (printReceipt: boolean = true) => {
    setLoading(true);
    setError(null);

    try {
      const payload: DeliverRepairPayload = {
        payment_method: paymentMethod,
        notes: deliveryNotes.trim() || undefined,
      };

      const deliveredTicket = await repairsApi.deliverRepair(ticket.id, payload);

      if (printReceipt) {
        printRepairDeliveryReceipt(deliveredTicket);
      }

      onSuccess(deliveredTicket);
      onClose();
    } catch (err: any) {
      console.error('Error delivering repair:', err);
      const detail = err.response?.data?.detail || err.response?.data?.message || 'Erreur lors de la livraison.';
      setError(typeof detail === 'object' ? JSON.stringify(detail) : String(detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">Restitution & Règlement</h2>
              <p className="text-xs text-text-muted">
                {ticket.ticket_number} • {ticket.device_brand} {ticket.device_model}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer & Device Recap */}
          <div className="p-3.5 bg-surface-elevated rounded-lg border border-border space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-muted">Client :</span>
              <span className="font-semibold text-text">{ticket.customer_name} ({ticket.customer_phone})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Appareil :</span>
              <span className="font-semibold text-text">{ticket.device_brand} {ticket.device_model}</span>
            </div>
            {ticket.imei_or_serial && (
              <div className="flex justify-between">
                <span className="text-text-muted">IMEI / N° Série :</span>
                <span className="font-mono text-text-secondary">{ticket.imei_or_serial}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-text-muted">Intervention :</span>
              <span className="text-text-secondary">{ticket.issue_type_display}</span>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="p-4 bg-gold/5 border border-gold-border rounded-xl space-y-2">
            <div className="flex justify-between text-xs text-text-secondary">
              <span>Coût total réparation :</span>
              <span className="font-mono font-medium text-text">{finalCost.toFixed(2)} DH</span>
            </div>
            {depositPaid > 0 && (
              <div className="flex justify-between text-xs text-emerald-400">
                <span>Acompte initial versé :</span>
                <span className="font-mono font-medium">-{depositPaid.toFixed(2)} DH</span>
              </div>
            )}
            <div className="pt-2 border-t border-gold-border/40 flex justify-between items-baseline">
              <span className="text-xs font-bold text-text uppercase tracking-wider">Reste à encaisser :</span>
              <span className="text-xl font-bold font-mono text-gold">{balanceDue.toFixed(2)} DH</span>
            </div>
          </div>

          {/* Payment Method */}
          {balanceDue > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gold uppercase tracking-wider">
                Mode d'encaissement du solde
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === 'CASH'
                      ? 'border-gold bg-gold/10 text-gold shadow-sm'
                      : 'border-border bg-surface-elevated text-text-secondary hover:text-text'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Espèces (Cash)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('BANK_TRANSFER')}
                  className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === 'BANK_TRANSFER'
                      ? 'border-gold bg-gold/10 text-gold shadow-sm'
                      : 'border-border bg-surface-elevated text-text-secondary hover:text-text'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Virement Bancaire</span>
                </button>
              </div>
            </div>
          )}

          {/* Warranty reminder badge */}
          <div className="p-3 bg-surface-elevated rounded-lg border border-border/70 flex items-center gap-3 text-xs text-text-secondary">
            <ShieldCheck className="w-5 h-5 text-gold flex-shrink-0" />
            <div>
              <span className="font-semibold text-text">Garantie atelier active : {ticket.warranty_days} jours</span>
              <p className="text-[11px] text-text-muted mt-0.5">
                Le certificat de garantie sera imprimé sur le ticket thermique du client.
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Note de remise / Remarques client (optionnel)
            </label>
            <input
              type="text"
              placeholder="ex: Appareil testé devant le client, fonctionnel."
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text focus:outline-none focus:border-gold transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-elevated/40 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-text-secondary hover:text-text hover:bg-white/5 transition-colors"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={() => handleDeliver(false)}
            disabled={loading}
            className="px-4 py-2 bg-surface-elevated border border-border hover:border-gold/50 rounded-lg text-xs font-semibold text-text flex items-center gap-1.5 transition-colors"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Valider sans ticket</span>
          </button>

          <button
            type="button"
            onClick={() => handleDeliver(true)}
            disabled={loading}
            className="px-4 py-2 bg-gold hover:bg-gold-light text-bg font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-gold/10 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Livrer & Imprimer Facture</span>
          </button>
        </div>
      </div>
    </div>
  );
};
