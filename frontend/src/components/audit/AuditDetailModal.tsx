import { X, ShieldCheck, UserCheck, Clock, FileText, ArrowRight } from 'lucide-react';
import type { AuditLog } from '../../api/audit';

interface AuditDetailModalProps {
  log: AuditLog | null;
  onClose: () => void;
}

export default function AuditDetailModal({ log, onClose }: AuditDetailModalProps) {
  if (!log) return null;

  const formatDateTime = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'full',
        timeStyle: 'medium',
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CANCEL') || action.includes('REJECT') || action.includes('DEACTIVATED')) {
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    }
    if (action.includes('PAYMENT') || action.includes('COMPLETED') || action.includes('APPROVED')) {
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
    if (action.includes('STOCK') || action.includes('STATUS') || action.includes('OVERRIDE')) {
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    }
    return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  };

  // Collect all keys from old and new values
  const allKeys = Array.from(
    new Set([
      ...Object.keys(log.old_values || {}),
      ...Object.keys(log.new_values || {}),
    ])
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-surface-alt/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Détails de l'Action d'Audit</h3>
                <span className="text-xs text-text-muted font-mono">#{log.id}</span>
              </div>
              <p className="text-xs text-text-secondary">Traçabilité système et intégrité des données</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-surface-hover flex items-center justify-center text-text-secondary hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Main Info Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-bg border border-border">
            <div>
              <span className="text-text-muted text-[11px] block mb-1">Type d'Action :</span>
              <span className={`inline-flex px-2.5 py-1 rounded-md font-semibold border text-xs ${getActionBadgeColor(log.action)}`}>
                {log.action_display || log.action}
              </span>
            </div>

            <div>
              <span className="text-text-muted text-[11px] block mb-1">Opérateur Responsable :</span>
              <div className="flex items-center gap-1.5 font-medium text-white">
                <UserCheck className="w-3.5 h-3.5 text-gold" />
                <span>{log.actor_name}</span>
                <span className="text-text-muted text-[11px]">(@{log.actor_username})</span>
              </div>
            </div>

            <div>
              <span className="text-text-muted text-[11px] block mb-1">Entité Concernée :</span>
              <div className="font-mono text-white font-medium">
                {log.entity_type} <span className="text-gold">#{log.entity_id}</span>
              </div>
            </div>

            <div>
              <span className="text-text-muted text-[11px] block mb-1">Date & Heure :</span>
              <div className="flex items-center gap-1.5 text-text-secondary font-mono">
                <Clock className="w-3.5 h-3.5 text-gold" />
                <span>{formatDateTime(log.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Reason / Motifs */}
          {log.reason && (
            <div className="p-4 rounded-xl bg-surface-alt border border-border">
              <span className="text-text-muted text-[11px] flex items-center gap-1.5 font-semibold uppercase tracking-wider mb-1.5">
                <FileText className="w-3.5 h-3.5 text-gold" />
                <span>Motif / Description de l'action :</span>
              </span>
              <p className="text-sm text-white font-medium whitespace-pre-wrap">{log.reason}</p>
            </div>
          )}

          {/* Before & After Values Diff */}
          {allKeys.length > 0 ? (
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>Modifications des données (Avant / Après)</span>
              </h4>

              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-bg text-text-secondary border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Champ / Propriété</th>
                      <th className="py-2.5 px-4 font-semibold text-red-400">Valeur Précédente (Avant)</th>
                      <th className="py-2.5 px-2 text-center w-8"></th>
                      <th className="py-2.5 px-4 font-semibold text-emerald-400">Nouvelle Valeur (Après)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {allKeys.map((key) => {
                      const oldVal = log.old_values?.[key];
                      const newVal = log.new_values?.[key];
                      const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

                      return (
                        <tr key={key} className={isChanged ? 'bg-surface-hover/30' : ''}>
                          <td className="py-2.5 px-4 font-mono font-medium text-text-secondary">
                            {key}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-red-300">
                            {oldVal !== undefined ? (
                              typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)
                            ) : (
                              <span className="text-text-muted italic">Non défini</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center text-text-muted">
                            <ArrowRight className="w-3 h-3 mx-auto" />
                          </td>
                          <td className="py-2.5 px-4 font-mono text-emerald-300 font-semibold">
                            {newVal !== undefined ? (
                              typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)
                            ) : (
                              <span className="text-text-muted italic">Non défini</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-bg border border-border text-center text-text-muted text-xs">
              Aucun changement de champ spécifique enregistré pour cet événement (action ponctuelle).
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-alt/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-surface-hover hover:bg-border/60 text-white font-medium text-xs border border-border transition-all cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
