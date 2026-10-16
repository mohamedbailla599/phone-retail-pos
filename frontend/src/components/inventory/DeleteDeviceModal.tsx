import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { inventoryApi, type DeviceItem } from '../../api/inventory';
import { Trash2, AlertTriangle, AlertCircle, Ban } from 'lucide-react';
import OperatorSelectionModal from '../ui/OperatorSelectionModal';
import { useRequireOperator } from '../../hooks/useRequireOperator';

interface DeleteDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  device: DeviceItem | null;
}

export default function DeleteDeviceModal({
  isOpen,
  onClose,
  onSuccess,
  device,
}: DeleteDeviceModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    isOperatorModalOpen,
    onOperatorSelected,
    onOperatorModalClose,
    handleOperatorRequired,
  } = useRequireOperator();

  const isSold = device?.status === 'SOLD';

  const handleDelete = () => {
    if (!device || isSold) return;
    executeDelete();
  };

  const executeDelete = async () => {
    if (!device) return;
    setLoading(true);
    setError('');

    try {
      await inventoryApi.deleteDevice(device.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      if (handleOperatorRequired(err, executeDelete)) {
        return;
      }
      const respData = err.response?.data;
      if (respData?.error) {
        setError(respData.error);
      } else {
        setError(err.message || 'Impossible de supprimer cet appareil.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !device) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isSold ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {isSold ? <Ban className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">
                {isSold ? "Suppression impossible" : "Supprimer l'appareil"}
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                {isSold ? "Cet appareil est verrouillé" : "Action irréversible sur l'inventaire"}
              </p>
            </div>
          </div>

          {/* Device Card Info */}
          <div className="mt-4 p-4 rounded-xl bg-surface-alt border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text text-sm">{device.product.name}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border
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
            
            <div className="text-xs text-text-muted grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
              <div>
                <span className="text-text-secondary">SKU:</span> {device.product.sku}
              </div>
              <div>
                <span className="text-text-secondary">Prix vente:</span> {device.default_selling_price} DH
              </div>
              {device.imei_1 && (
                <div className="col-span-2 font-mono">
                  <span className="text-text-secondary">IMEI 1:</span> {device.imei_1}
                </div>
              )}
              {device.serial_number && (
                <div className="col-span-2 font-mono">
                  <span className="text-text-secondary">S/N:</span> {device.serial_number}
                </div>
              )}
            </div>
          </div>

          {/* Warning Message */}
          {isSold ? (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2.5 text-xs text-amber-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">Appareil déjà vendu</p>
                <p>Cet appareil a été vendu et est lié à des transactions et garanties dans le système. Il ne peut pas être supprimé du stock.</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2.5 text-xs text-red-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">Confirmation requise</p>
                <p>Êtes-vous sûr de vouloir supprimer définitivement cet appareil du stock ? Cette action supprimera sa fiche produit de l'inventaire et sera tracée dans le journal d'audit.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-border mt-5">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              {isSold ? "Fermer" : "Annuler"}
            </Button>
            {!isSold && (
              <Button
                type="button"
                variant="danger"
                loading={loading}
                onClick={handleDelete}
                icon={<Trash2 className="w-4 h-4" />}
              >
                Supprimer définitivement
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Operator Authentication Modal */}
      <OperatorSelectionModal
        isOpen={isOperatorModalOpen}
        onClose={onOperatorModalClose}
        onSelect={onOperatorSelected}
        description={`Cette suppression de l'appareil #${device.id} sera enregistrée dans le journal d'audit.`}
      />
    </>
  );
}
