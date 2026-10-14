import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Clock, AlertTriangle, Check, Wrench, DollarSign } from 'lucide-react';
import { repairsApi, type RepairStatus, type RepairTicket, type UpdateRepairStatusPayload } from '../../api/repairs';

interface UpdateRepairStatusModalProps {
  isOpen: boolean;
  ticket: RepairTicket | null;
  onClose: () => void;
  onSuccess: (updated: RepairTicket) => void;
}

const STATUS_OPTIONS: { value: RepairStatus; label: string; desc: string; color: string }[] = [
  {
    value: 'RECEIVED',
    label: 'Reçu / En attente',
    desc: "Appareil déposé à l'atelier, en file d'attente",
    color: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
  },
  {
    value: 'DIAGNOSING',
    label: 'Diagnostic en cours',
    desc: 'Démontage et tests des composants défectueux',
    color: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  },
  {
    value: 'WAITING_PARTS',
    label: 'Attente de pièces',
    desc: 'Commande écran / nappe / puce en transit',
    color: 'border-purple-500/30 text-purple-400 bg-purple-500/10',
  },
  {
    value: 'IN_PROGRESS',
    label: 'Réparation en cours',
    desc: 'Intervention active par le technicien',
    color: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10',
  },
  {
    value: 'READY',
    label: 'Prêt pour retrait client',
    desc: 'Réparation validée, contrôles passés, prêt au comptoir',
    color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  },
  {
    value: 'CANCELLED',
    label: 'Annulé / Non réparable',
    desc: 'Devis refusé ou carte mère irrécupérable',
    color: 'border-red-500/30 text-red-400 bg-red-500/10',
  },
];

export const UpdateRepairStatusModal: React.FC<UpdateRepairStatusModalProps> = ({
  isOpen,
  ticket,
  onClose,
  onSuccess,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<RepairStatus>('DIAGNOSING');
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [finalCost, setFinalCost] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ticket) {
      setSelectedStatus(ticket.status);
      setTechnicianNotes(ticket.technician_notes || '');
      setFinalCost(ticket.final_cost || ticket.estimated_cost || '0');
    }
  }, [ticket]);

  if (!isOpen || !ticket) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: UpdateRepairStatusPayload = {
        status: selectedStatus,
        technician_notes: technicianNotes.trim() || undefined,
        final_cost: finalCost ? parseFloat(finalCost) : undefined,
      };

      const updated = await repairsApi.updateStatus(ticket.id, payload);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Error updating repair status:', err);
      const detail = err.response?.data?.detail || err.response?.data?.message || 'Erreur lors de la mise à jour.';
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
            <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">Avancer le statut atelier</h2>
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

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Status list */}
            <div>
              <label className="block text-xs font-bold text-gold uppercase tracking-wider mb-2">
                Nouveau Statut
              </label>
              <div className="grid grid-cols-1 gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const isSelected = selectedStatus === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedStatus(opt.value)}
                      className={`w-full p-3 text-left rounded-lg border transition-all flex items-start justify-between ${
                        isSelected
                          ? 'border-gold bg-gold/10 shadow-sm'
                          : 'border-border bg-surface-elevated hover:bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${opt.color}`}>
                            {opt.label}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-1">{opt.desc}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Adjust Final Cost */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-gold" /> Coût final actualisé (DH)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={finalCost}
                onChange={(e) => setFinalCost(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm font-mono text-text focus:outline-none focus:border-gold transition-colors"
              />
              <p className="text-[11px] text-text-muted mt-1">
                Acompte déjà versé : <strong className="text-text">{parseFloat(ticket.deposit_paid).toFixed(2)} DH</strong>.
              </p>
            </div>

            {/* Technician notes */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5 text-gold" /> Notes d'intervention & Diagnostic
              </label>
              <textarea
                rows={3}
                placeholder="ex: Remplacement de l'écran OLED original effectué. Face ID testé et fonctionnel. Nettoyage écouteur interne."
                value={technicianNotes}
                onChange={(e) => setTechnicianNotes(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text focus:outline-none focus:border-gold transition-colors resize-none"
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
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-gold hover:bg-gold-light text-bg font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-gold/10 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Valider le statut</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
