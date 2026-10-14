import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { returnsApi, type ReturnRecord, type RefundMethod } from '../../api/returns';
import {
  AlertCircle,
  CheckCircle2,
  PackageCheck,
  XCircle,
  Coins,
  ArrowRight,
} from 'lucide-react';

export type ReturnActionType = 'APPROVE' | 'RESTOCK' | 'REJECT' | 'ISSUE_REFUND';

interface ProcessReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnRecord: ReturnRecord | null;
  actionType: ReturnActionType;
  onSuccess: () => void;
}

export default function ProcessReturnModal({
  isOpen,
  onClose,
  returnRecord,
  actionType,
  onSuccess,
}: ProcessReturnModalProps) {
  // Reject reason
  const [rejectReason, setRejectReason] = useState('');

  // Refund issuance state
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('CASH');
  const [refundAmount, setRefundAmount] = useState<string>(
    returnRecord?.total_amount || '0.00'
  );
  const [refundReference, setRefundReference] = useState('');
  const [autoCompleteRefund, setAutoCompleteRefund] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !returnRecord) return null;

  const handleAction = async () => {
    setLoading(true);
    setError(null);

    try {
      if (actionType === 'APPROVE') {
        await returnsApi.approveReturn(returnRecord.id);
      } else if (actionType === 'RESTOCK') {
        await returnsApi.restockReturn(returnRecord.id);
      } else if (actionType === 'REJECT') {
        if (!rejectReason.trim()) {
          setError('Veuillez spécifier le motif du refus.');
          setLoading(false);
          return;
        }
        await returnsApi.rejectReturn(returnRecord.id, rejectReason.trim());
      } else if (actionType === 'ISSUE_REFUND') {
        if (!returnRecord.customer) {
          setError('Le client associé au ticket est introuvable.');
          setLoading(false);
          return;
        }

        const refund = await returnsApi.createRefund({
          customer_id: returnRecord.customer,
          source_type: 'RETURN',
          source_id: returnRecord.id,
          amount: parseFloat(refundAmount) || parseFloat(returnRecord.total_amount),
          method: refundMethod,
          reference: refundReference.trim() || undefined,
          reason: `Remboursement retour ${returnRecord.return_number}`,
        });

        // If auto-complete is checked (as owner/admin), approve and complete immediately
        if (autoCompleteRefund) {
          await returnsApi.approveRefund(refund.id);
          await returnsApi.completeRefund(refund.id);
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Process return action failed', err);
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        "Une erreur est survenue lors de l'opération.";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (actionType) {
      case 'APPROVE':
        return 'Approuver le Retour';
      case 'RESTOCK':
        return 'Réintégrer l’Article en Stock';
      case 'REJECT':
        return 'Refuser la Demande de Retour';
      case 'ISSUE_REFUND':
        return 'Émettre le Remboursement Caisse';
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title={getTitle()} className="max-w-md">
      <div className="space-y-4 pt-1">
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1 font-medium">{error}</span>
          </div>
        )}

        {/* Return Summary Card */}
        <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-gold">
              {returnRecord.return_number}
            </span>
            <span className="text-[11px] text-text-muted">
              Ticket : {returnRecord.receipt_id}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Client :</span>
            <span className="font-semibold text-text">{returnRecord.customer_name}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Montant total :</span>
            <span className="font-bold text-gold">
              {parseFloat(returnRecord.total_amount).toLocaleString()} DH
            </span>
          </div>

          {returnRecord.items && returnRecord.items.length > 0 && (
            <div className="pt-2 border-t border-border/60 text-[11px] text-text-muted">
              <span className="font-medium text-text">Article : </span>
              {returnRecord.items[0].product_name}
              {returnRecord.items[0].identifier && ` (IMEI: ${returnRecord.items[0].identifier})`}
              {` × ${returnRecord.items[0].quantity}`}
            </div>
          )}
        </div>

        {/* ACTION: APPROVE */}
        {actionType === 'APPROVE' && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                L'approbation valide la demande de retour du client. Vous pourrez ensuite réintégrer l'article en stock avant de décaisser le remboursement.
              </span>
            </div>
          </div>
        )}

        {/* ACTION: RESTOCK */}
        {actionType === 'RESTOCK' && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2.5">
              <PackageCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Cette action va réintégrer l'appareil ou l'accessoire directement dans le stock disponible de la boutique et enregistrer le mouvement d'inventaire.
              </span>
            </div>
          </div>
        )}

        {/* ACTION: REJECT */}
        {actionType === 'REJECT' && (
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Motif du refus <span className="text-danger">*</span> :
            </label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Délai de rétractation dépassé, produit endommagé par le client..."
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-danger resize-none"
              autoFocus
            />
          </div>
        )}

        {/* ACTION: ISSUE_REFUND */}
        {actionType === 'ISSUE_REFUND' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Mode de remboursement :
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRefundMethod('CASH')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                    refundMethod === 'CASH'
                      ? 'border-gold bg-gold/15 text-gold'
                      : 'border-border bg-surface-2 text-text-secondary hover:text-text'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  Espèces (Caisse)
                </button>
                <button
                  type="button"
                  onClick={() => setRefundMethod('BANK_TRANSFER')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                    refundMethod === 'BANK_TRANSFER'
                      ? 'border-gold bg-gold/15 text-gold'
                      : 'border-border bg-surface-2 text-text-secondary hover:text-text'
                  }`}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Virement Bancaire
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Montant à rembourser (DH) :
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={returnRecord.total_amount}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs font-mono font-bold text-gold focus:outline-none focus:border-gold"
              />
            </div>

            {refundMethod === 'BANK_TRANSFER' && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Référence de virement (facultatif) :
                </label>
                <input
                  type="text"
                  value={refundReference}
                  onChange={(e) => setRefundReference(e.target.value)}
                  placeholder="Ex: VIR-2026-XXXX"
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-gold"
                />
              </div>
            )}

            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-surface border border-border cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoCompleteRefund}
                onChange={(e) => setAutoCompleteRefund(e.target.checked)}
                className="w-4 h-4 rounded text-gold focus:ring-gold bg-surface-2 border-border"
              />
              <span className="text-xs text-text">
                Décaisser et clôturer immédiatement (Propriétaire/Admin)
              </span>
            </label>
          </div>
        )}

        {/* Modal Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="text-xs">
            Annuler
          </Button>

          {actionType === 'APPROVE' && (
            <Button
              variant="primary"
              onClick={handleAction}
              loading={loading}
              className="text-xs gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Confirmer l'Approbation
            </Button>
          )}

          {actionType === 'RESTOCK' && (
            <Button
              variant="primary"
              onClick={handleAction}
              loading={loading}
              className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              Réintégrer en Stock
            </Button>
          )}

          {actionType === 'REJECT' && (
            <Button
              variant="danger"
              onClick={handleAction}
              loading={loading}
              className="text-xs gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              Refuser le Retour
            </Button>
          )}

          {actionType === 'ISSUE_REFUND' && (
            <Button
              variant="primary"
              onClick={handleAction}
              loading={loading}
              className="text-xs gap-1.5"
            >
              <Coins className="w-3.5 h-3.5" />
              Valider le Remboursement
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
