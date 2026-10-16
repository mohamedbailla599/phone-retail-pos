import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Select } from '../ui/Select';
import { inventoryApi, type DeviceItem } from '../../api/inventory';
import { Pencil, Camera, AlertCircle, Sparkles } from 'lucide-react';
import OperatorSelectionModal from '../ui/OperatorSelectionModal';
import { useRequireOperator } from '../../hooks/useRequireOperator';
import BarcodeScannerModal from '../ui/BarcodeScannerModal';

interface EditDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  device: DeviceItem | null;
}

export default function EditDeviceModal({
  isOpen,
  onClose,
  onSuccess,
  device,
}: EditDeviceModalProps) {
  const [formData, setFormData] = useState({
    imei_1: '',
    imei_2: '',
    serial_number: '',
    cost_price: '',
    default_selling_price: '',
    minimum_selling_price: '',
    battery_health: '',
    condition: 'A',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scannerTarget, setScannerTarget] = useState<'imei_1' | 'imei_2' | 'serial_number' | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const {
    isOperatorModalOpen,
    onOperatorSelected,
    onOperatorModalClose,
    handleOperatorRequired,
  } = useRequireOperator();

  useEffect(() => {
    if (isOpen && device) {
      setFormData({
        imei_1: device.imei_1 || '',
        imei_2: device.imei_2 || '',
        serial_number: device.serial_number || '',
        cost_price: device.cost_price || '',
        default_selling_price: device.default_selling_price || '',
        minimum_selling_price: device.minimum_selling_price || '',
        battery_health: device.battery_health !== null && device.battery_health !== undefined ? String(device.battery_health) : '',
        condition: device.condition || 'A',
      });
      setError('');
    }
  }, [isOpen, device]);

  const handleOpenScanner = (target: 'imei_1' | 'imei_2' | 'serial_number') => {
    setScannerTarget(target);
    setIsScannerOpen(true);
  };

  const handleScannedCode = (code: string) => {
    if (!scannerTarget) return;
    setFormData((prev) => ({
      ...prev,
      [scannerTarget]: code.trim(),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!device) return;

    const defaultPrice = parseFloat(formData.default_selling_price);
    const minPrice = parseFloat(formData.minimum_selling_price);
    const costPrice = parseFloat(formData.cost_price);

    if (isNaN(defaultPrice) || defaultPrice < 0) {
      setError('Veuillez saisir un prix de vente valide.');
      return;
    }

    if (isNaN(minPrice) || minPrice < 0) {
      setError('Veuillez saisir un prix de vente minimum valide.');
      return;
    }

    if (minPrice > defaultPrice) {
      setError('Le prix minimum ne peut pas être supérieur au prix de vente standard.');
      return;
    }

    if (!isNaN(costPrice) && costPrice > defaultPrice) {
      // Warning but allow, or let backend check
    }

    executeSubmit();
  };

  const executeSubmit = async () => {
    if (!device) return;
    setLoading(true);
    setError('');

    try {
      const payload: Record<string, any> = {
        imei_1: formData.imei_1.trim() || null,
        imei_2: formData.imei_2.trim() || null,
        serial_number: formData.serial_number.trim() || null,
        cost_price: formData.cost_price,
        default_selling_price: formData.default_selling_price,
        minimum_selling_price: formData.minimum_selling_price,
        condition: formData.condition,
        battery_health: formData.battery_health ? parseInt(formData.battery_health, 10) : null,
      };

      await inventoryApi.updateDevice(device.id, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      if (handleOperatorRequired(err, executeSubmit)) {
        return;
      }
      const respData = err.response?.data;
      if (respData) {
        if (respData.error) {
          setError(respData.error);
        } else if (typeof respData === 'object') {
          const firstKey = Object.keys(respData)[0];
          const val = respData[firstKey];
          setError(Array.isArray(val) ? `${firstKey}: ${val[0]}` : String(val));
        } else {
          setError('Erreur lors de la mise à jour de l\'appareil.');
        }
      } else {
        setError(err.message || 'Erreur lors de la mise à jour de l\'appareil.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !device) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text flex items-center gap-2">
                  Modifier l'appareil
                </h2>
                <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                  <span className="font-semibold text-text">{device.product.name}</span>
                  <span>•</span>
                  <span>SKU: {device.product.sku}</span>
                  <span>•</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border
                    ${device.status === 'IN_STOCK' ? 'bg-green-500/10 text-green-400 border-green-500/20' : ''}
                    ${device.status === 'SOLD' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : ''}
                    ${device.status === 'RESERVED' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : ''}
                    ${device.status === 'REPAIR' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : ''}
                    ${device.status === 'DAMAGED' ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''}
                    ${device.status === 'LOST' ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''}
                  `}>
                    {device.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2.5 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            {/* Identifiers Section */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-gold" /> Identifiants de l'appareil
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* IMEI 1 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    IMEI 1
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.imei_1}
                      onChange={(e) => setFormData({ ...formData, imei_1: e.target.value })}
                      placeholder="Ex: 356891234567890"
                      className="w-full h-10 bg-surface-alt border border-border rounded-[var(--radius-md)] text-text text-sm px-3 pr-10 focus:outline-none focus:border-gold-border focus:ring-2 focus:ring-gold/20 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenScanner('imei_1')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-muted hover:text-gold hover:bg-gold/10 transition-colors"
                      title="Scanner avec la caméra"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* IMEI 2 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    IMEI 2 (Optionnel)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.imei_2}
                      onChange={(e) => setFormData({ ...formData, imei_2: e.target.value })}
                      placeholder="Ex: 356891234567891"
                      className="w-full h-10 bg-surface-alt border border-border rounded-[var(--radius-md)] text-text text-sm px-3 pr-10 focus:outline-none focus:border-gold-border focus:ring-2 focus:ring-gold/20 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenScanner('imei_2')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-muted hover:text-gold hover:bg-gold/10 transition-colors"
                      title="Scanner avec la caméra"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Serial Number */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Numéro de série
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.serial_number}
                      onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                      placeholder="Ex: F2LX800XHG7F"
                      className="w-full h-10 bg-surface-alt border border-border rounded-[var(--radius-md)] text-text text-sm px-3 pr-10 focus:outline-none focus:border-gold-border focus:ring-2 focus:ring-gold/20 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenScanner('serial_number')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-muted hover:text-gold hover:bg-gold/10 transition-colors"
                      title="Scanner avec la caméra"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing Section */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-1.5">
                Tarification & Rentabilité
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  label="Prix d'achat (DH)"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  placeholder="0.00"
                />
                <Input
                  label="Prix de vente (DH)"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.default_selling_price}
                  onChange={(e) => setFormData({ ...formData, default_selling_price: e.target.value })}
                  placeholder="0.00"
                />
                <Input
                  label="Prix minimum (DH)"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.minimum_selling_price}
                  onChange={(e) => setFormData({ ...formData, minimum_selling_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Condition & Battery Section */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-1.5">
                État Physique & Batterie
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Grade / Condition
                  </label>
                  <Select
                    value={formData.condition}
                    onChange={(val) => setFormData({ ...formData, condition: val })}
                    options={[
                      { value: 'A', label: 'Grade A (Comme neuf / Excellent)' },
                      { value: 'B', label: 'Grade B (Très bon état / Légères micro-rayures)' },
                      { value: 'C', label: 'Grade C (Bon état / Traces visibles)' },
                      { value: 'N', label: 'Neuf / Scellé (Brand New)' },
                    ]}
                  />
                </div>

                <Input
                  label="Santé Batterie (% Optionnel)"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.battery_health}
                  onChange={(e) => setFormData({ ...formData, battery_health: e.target.value })}
                  placeholder="Ex: 89"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                Annuler
              </Button>
              <Button type="submit" variant="primary" loading={loading}>
                Enregistrer les modifications
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Barcode scanner */}
      {isScannerOpen && (
        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => {
            setIsScannerOpen(false);
            setScannerTarget(null);
          }}
          onScan={handleScannedCode}
          title={`Scanner ${scannerTarget === 'serial_number' ? 'le Numéro de Série' : scannerTarget === 'imei_2' ? 'IMEI 2' : 'IMEI 1'}`}
        />
      )}

      {/* Operator Authentication Modal */}
      <OperatorSelectionModal
        isOpen={isOperatorModalOpen}
        onClose={onOperatorModalClose}
        onSelect={onOperatorSelected}
        description="Cette modification d'appareil sera enregistrée dans le journal d'audit."
      />
    </>
  );
}
