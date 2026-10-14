import React, { useState } from 'react';
import { X, Wrench, Printer, Check, Smartphone, User, DollarSign, Calendar, Lock } from 'lucide-react';
import { repairsApi, type IssueType, type CreateRepairPayload, type RepairTicket } from '../../api/repairs';
import { printRepairIntakeReceipt } from '../../utils/printRepairReceipt';

interface CreateRepairModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTicket: RepairTicket) => void;
}

const COMMON_BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Oppo', 'Huawei', 'Google', 'Vivo', 'Realme', 'Infinix', 'Autre'];

const ISSUE_OPTIONS: { value: IssueType; label: string }[] = [
  { value: 'SCREEN', label: 'Écran / Vitre cassée (Screen)' },
  { value: 'BATTERY', label: 'Batterie / Autonomie (Battery)' },
  { value: 'CHARGING_PORT', label: 'Connecteur de charge (Port)' },
  { value: 'BACK_GLASS', label: 'Vitre arrière / Châssis' },
  { value: 'CAMERA', label: 'Caméra / Lentille' },
  { value: 'WATER_DAMAGE', label: 'Oxydation / Dégât des eaux' },
  { value: 'SPEAKER_MIC', label: 'Micro / Haut-parleur / Écouteur' },
  { value: 'SOFTWARE', label: 'Système / Déblocage / Flash' },
  { value: 'MOTHERBOARD', label: 'Carte Mère / Micro-soudure' },
  { value: 'OTHER', label: 'Autre panne / Diagnostic global' },
];

export const CreateRepairModal: React.FC<CreateRepairModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceBrand, setDeviceBrand] = useState('Apple');
  const [customBrand, setCustomBrand] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [deviceColor, setDeviceColor] = useState('');
  const [imeiOrSerial, setImeiOrSerial] = useState('');
  const [passcode, setPasscode] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('SCREEN');
  const [issueDescription, setIssueDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [depositPaid, setDepositPaid] = useState('');
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (printReceiptAfter: boolean = false) => {
    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Veuillez renseigner le nom et le téléphone du client.');
      return;
    }

    const brand = deviceBrand === 'Autre' ? customBrand.trim() : deviceBrand;
    if (!brand) {
      setError("Veuillez renseigner la marque de l'appareil.");
      return;
    }

    if (!deviceModel.trim()) {
      setError("Veuillez spécifier le modèle de l'appareil.");
      return;
    }

    if (!issueDescription.trim()) {
      setError('Veuillez décrire le problème ou la panne signalée.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: CreateRepairPayload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        device_brand: brand,
        device_model: deviceModel.trim(),
        device_color: deviceColor.trim() || undefined,
        imei_or_serial: imeiOrSerial.trim() || undefined,
        passcode: passcode.trim() || undefined,
        issue_type: issueType,
        issue_description: issueDescription.trim(),
        estimated_cost: estimatedCost ? parseFloat(estimatedCost) : 0,
        deposit_paid: depositPaid ? parseFloat(depositPaid) : 0,
        estimated_completion_date: estimatedCompletionDate || null,
      };

      const createdTicket = await repairsApi.createRepair(payload);

      if (printReceiptAfter) {
        printRepairIntakeReceipt(createdTicket);
      }

      onSuccess(createdTicket);
      onClose();
    } catch (err: any) {
      console.error('Error creating repair ticket:', err);
      const detail = err.response?.data?.detail || err.response?.data?.message || 'Erreur lors de la création du ticket.';
      setError(typeof detail === 'object' ? JSON.stringify(detail) : String(detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">Nouvelle Réception Réparation</h2>
              <p className="text-xs text-text-muted">Enregistrement appareil atelier & ticket de dépôt client</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center gap-2">
              <span className="font-semibold">Attention:</span> {error}
            </div>
          )}

          {/* Section: Client */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gold uppercase tracking-wider">
              <User className="w-3.5 h-3.5" />
              <span>Informations Client</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Mohammed Alami"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Téléphone *</label>
                <input
                  type="tel"
                  required
                  placeholder="ex: 06 12 34 56 78"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section: Appareil */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs font-bold text-gold uppercase tracking-wider">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Identification de l'Appareil</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Marque *</label>
                <select
                  value={deviceBrand}
                  onChange={(e) => setDeviceBrand(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors"
                >
                  {COMMON_BRANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                {deviceBrand === 'Autre' && (
                  <input
                    type="text"
                    placeholder="Préciser la marque"
                    value={customBrand}
                    onChange={(e) => setCustomBrand(e.target.value)}
                    className="w-full mt-2 px-3 py-1.5 bg-surface-elevated border border-border rounded-lg text-xs text-text focus:outline-none focus:border-gold"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Modèle précis *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: iPhone 13 Pro Max"
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Couleur</label>
                <input
                  type="text"
                  placeholder="ex: Bleu Alpin / Noir"
                  value={deviceColor}
                  onChange={(e) => setDeviceColor(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">IMEI ou N° Série</label>
                <input
                  type="text"
                  placeholder="ex: 354892019283741"
                  value={imeiOrSerial}
                  onChange={(e) => setImeiOrSerial(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm font-mono text-text focus:outline-none focus:border-gold transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-gold" /> Code déverrouillage / Schéma
                </label>
                <input
                  type="text"
                  placeholder="ex: 123456 ou L-pattern"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm font-mono text-text focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section: Diagnostic & Panne */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs font-bold text-gold uppercase tracking-wider">
              <Wrench className="w-3.5 h-3.5" />
              <span>Panne & Diagnostic</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Type d'intervention</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as IssueType)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors"
              >
                {ISSUE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Description détaillée des symptômes *</label>
              <textarea
                rows={2}
                required
                placeholder="ex: L'écran scintille en vert après une chute, le tactile fonctionne encore. Connecteur de charge légèrement desserré."
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors resize-none"
              />
            </div>
          </div>

          {/* Section: Financier & Délais */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs font-bold text-gold uppercase tracking-wider">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Devis & Avance</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Coût estimé (DH)</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  placeholder="0.00"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm font-mono text-text focus:outline-none focus:border-gold transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Acompte versé (DH)</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  placeholder="0.00"
                  value={depositPaid}
                  onChange={(e) => setDepositPaid(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm font-mono text-text focus:outline-none focus:border-gold transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-gold" /> Date prévue
                </label>
                <input
                  type="date"
                  value={estimatedCompletionDate}
                  onChange={(e) => setEstimatedCompletionDate(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-elevated/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-text-muted">
            {estimatedCost && depositPaid && (
              <span>
                Reste à payer : <strong className="text-gold font-mono">{(parseFloat(estimatedCost) - parseFloat(depositPaid)).toFixed(2)} DH</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 sm:flex-initial px-4 py-2 border border-border rounded-lg text-xs font-semibold text-text-secondary hover:text-text hover:bg-white/5 transition-colors"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={loading}
              className="flex-1 sm:flex-initial px-4 py-2 bg-surface-elevated border border-border hover:border-gold/50 rounded-lg text-xs font-semibold text-text flex items-center justify-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Enregistrer</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={loading}
              className="flex-1 sm:flex-initial px-4 py-2 bg-gold hover:bg-gold-light text-bg font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-gold/10 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Enregistrer & Ticket</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
