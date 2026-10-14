import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { inventoryApi, type AccessoryStock } from '../../api/inventory';
import OperatorSelectionModal from '../ui/OperatorSelectionModal';
import { useRequireOperator } from '../../hooks/useRequireOperator';

interface AdjustAccessoryStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  stock: AccessoryStock | null;
}

export default function AdjustAccessoryStockModal({
  isOpen,
  onClose,
  onSuccess,
  stock,
}: AdjustAccessoryStockModalProps) {
  const [physicalCount, setPhysicalCount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    isOperatorModalOpen,
    onOperatorSelected,
    onOperatorModalClose,
    handleOperatorRequired,
  } = useRequireOperator();

  useEffect(() => {
    if (isOpen && stock) {
      setPhysicalCount(stock.quantity.toString());
      setReason('');
      setError('');
    }
  }, [isOpen, stock]);

  const handleClose = () => {
    onClose();
    setPhysicalCount('');
    setReason('');
    setError('');
  };

  const currentQuantity = stock?.quantity ?? 0;
  const parsedPhysicalCount = parseInt(physicalCount, 10);
  const isValidCount = !isNaN(parsedPhysicalCount) && parsedPhysicalCount >= 0;
  
  const quantityDelta = isValidCount ? parsedPhysicalCount - currentQuantity : 0;
  const isSubmitDisabled = !isValidCount || quantityDelta === 0 || !reason.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stock || isSubmitDisabled) return;

    setLoading(true);
    setError('');

    try {
      await inventoryApi.adjustAccessoryStock({
        accessory_stock_id: stock.id,
        quantity_delta: quantityDelta,
        reason: reason.trim(),
      });
      onSuccess();
      handleClose();
    } catch (err: any) {
      if (handleOperatorRequired(err, () => {
        // we can't easily re-submit a React.FormEvent, so we recreate the logic
        handleSubmit({ preventDefault: () => {} } as any);
      })) {
        return;
      }
      setError(err.response?.data?.error || 'Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  };

  if (!stock) return null;

  return (
    <>
      <Modal
        open={isOpen}
      onClose={handleClose}
      title={`Adjust Stock: ${stock.product.name}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] p-4 flex flex-col gap-1">
          <span className="text-xs text-text-muted uppercase tracking-wider">Current Stock</span>
          <span className="text-xl font-semibold text-text">{currentQuantity}</span>
        </div>

        <Input
          label="Physical count"
          type="number"
          min="0"
          value={physicalCount}
          onChange={(e) => setPhysicalCount(e.target.value)}
          placeholder="Enter actual stock count"
          required
        />

        <div className="flex items-center justify-between py-3 border-y border-border">
          <span className="text-sm font-medium text-text-secondary">Adjustment</span>
          <span className={`text-sm font-semibold ${quantityDelta > 0 ? 'text-green-400' : quantityDelta < 0 ? 'text-red-400' : 'text-text-muted'}`}>
            {quantityDelta > 0 ? '+' : ''}{quantityDelta}
          </span>
        </div>

        <Input
          label="Reason"
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Inventory recount, missing item"
          required
        />

        <div className="flex justify-end gap-3 mt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading} disabled={isSubmitDisabled}>
            Adjust Stock
          </Button>
        </div>
      </form>
    </Modal>
      <OperatorSelectionModal
        isOpen={isOperatorModalOpen}
        onClose={onOperatorModalClose}
        onSelect={onOperatorSelected}
      />
    </>
  );
}
