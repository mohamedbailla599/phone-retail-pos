import React, { useState, useEffect } from 'react';
import { inventoryApi } from '../../api/inventory';
import type { AccessoryStock } from '../../api/inventory';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { SearchableSelect } from '../ui/SearchableSelect';
import OperatorSelectionModal from '../ui/OperatorSelectionModal';
import { useRequireOperator } from '../../hooks/useRequireOperator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReceiveAccessoryModal({ isOpen, onClose, onSuccess }: Props) {
  const [stocks, setStocks] = useState<AccessoryStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState<React.ReactNode | null>(null);

  const {
    isOperatorModalOpen,
    onOperatorSelected,
    onOperatorModalClose,
    handleOperatorRequired,
  } = useRequireOperator();
  
  const [formData, setFormData] = useState({
    accessory_stock_id: '',
    quantity: '1',
  });

  useEffect(() => {
    if (isOpen) {
      handleSearch('');
      setFormData({
        accessory_stock_id: '', quantity: '1'
      });
      setError('');
      setSuccessMessage(null);
    }
  }, [isOpen]);

  const handleSearch = async (query: string) => {
    setSearching(true);
    try {
      const data = await inventoryApi.getAccessories({ search: query });
      setStocks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const selectedStock = stocks.find(s => s.id.toString() === formData.accessory_stock_id);
      
      const newStock = await inventoryApi.receiveAccessory({
        accessory_stock_id: parseInt(formData.accessory_stock_id),
        quantity: parseInt(formData.quantity)
      });
      
      setSuccessMessage(
        <div className="flex flex-col items-center justify-center text-center py-6">
          <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
          <h3 className="text-xl font-bold text-text mb-2">Stock received successfully.</h3>
          <p className="text-text-secondary">{selectedStock?.product.brand} {selectedStock?.product.name}</p>
          <p className="text-gold font-medium mt-1">+{formData.quantity} units</p>
          <p className="text-text-muted mt-1 text-sm">New stock: {newStock.quantity}</p>
          <button 
            type="button"
            onClick={() => {
              onSuccess();
              onClose();
            }}
            className="mt-6 px-6 py-2 bg-gold text-black font-semibold rounded-lg hover:bg-gold-hover transition-colors"
          >
            Done
          </button>
        </div>
      );
      
      onSuccess();
    } catch (err: any) {
      if (handleOperatorRequired(err, () => {
        handleSubmit({ preventDefault: () => {} } as any);
      })) {
        return;
      }
      setError(err.response?.data?.error || 'An error occurred while receiving the accessory.');
    } finally {
      setLoading(false);
    }
  };

  const selectedStock = stocks.find(s => s.id.toString() === formData.accessory_stock_id);
  const qty = parseInt(formData.quantity) || 0;
  const currentStock = selectedStock ? selectedStock.quantity : 0;
  const projectedStock = currentStock + qty;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text">Receive Accessory</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMessage ? (
          <div className="p-6">{successMessage}</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
            {error && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Accessory Product *</label>
                <SearchableSelect
                  value={formData.accessory_stock_id}
                  onChange={(val) => setFormData(f => ({ ...f, accessory_stock_id: val }))}
                  options={stocks.map(s => ({
                    value: s.id.toString(),
                    label: `${s.product.brand} ${s.product.name}`,
                    description: `SKU: ${s.product.sku}`
                  }))}
                  onSearch={handleSearch}
                  loading={searching}
                  placeholder="Search accessory..."
                />
              </div>

              {selectedStock && (
                <div className="p-3 bg-surface-alt border border-border rounded-[var(--radius-md)] flex items-center justify-between">
                  <span className="text-sm text-text-muted">Current Stock:</span>
                  <span className="text-sm font-semibold text-text">{currentStock}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Quantity Received *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full h-10 px-3 bg-surface-alt border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold-border focus:ring-2 focus:ring-gold/20 focus:outline-none transition-all"
                />
              </div>

              {selectedStock && qty > 0 && (
                <div className="p-3 bg-gold/10 border border-gold-border/50 rounded-[var(--radius-md)] flex items-center justify-between">
                  <span className="text-sm text-gold font-medium">New Stock (Projected):</span>
                  <span className="text-sm font-bold text-gold">{projectedStock}</span>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-[var(--radius-md)] font-medium text-text-secondary hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.accessory_stock_id || qty < 1}
                className="px-4 py-2 rounded-[var(--radius-md)] font-semibold text-black bg-gold hover:bg-gold-bright transition-all shadow-[0_2px_12px_rgba(212,175,90,0.25)] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Receive Stock
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
      <OperatorSelectionModal
        isOpen={isOperatorModalOpen}
        onClose={onOperatorModalClose}
        onSelect={onOperatorSelected}
      />
    </>
  );
}
