import { useState, useEffect, useCallback } from 'react';
import { inventoryApi } from '../api/inventory';
import type { AccessoryStock } from '../api/inventory';
import { Search, Plus, Loader2, Package } from 'lucide-react';
import ReceiveAccessoryModal from '../components/inventory/ReceiveAccessoryModal';
import AdjustAccessoryStockModal from '../components/inventory/AdjustAccessoryStockModal';
import { useDebounce } from '../hooks/useDebounce';
import Sidebar from '../components/layout/Sidebar';

export default function AccessoriesPage() {
  const [stocks, setStocks] = useState<AccessoryStock[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<AccessoryStock | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadStocks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await inventoryApi.getAccessories({ search: debouncedSearch });
      setStocks(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load accessories');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  return (
    <div className="h-screen flex bg-bg overflow-hidden w-full print:hidden">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
        <header className="h-[72px] flex items-center justify-between px-8 bg-surface border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text tracking-tight flex items-center gap-2">
                Accessories Inventory
              </h1>
              <p className="text-xs text-text-muted mt-0.5">{stocks.length} accessories in system</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="h-10 px-4 bg-gold hover:bg-gold-bright text-black font-semibold rounded-[var(--radius-md)] flex items-center gap-2 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Receive Accessory
          </button>
        </header>

        <div className="flex-1 overflow-auto p-8 space-y-6">
          <div className="max-w-[1400px] mx-auto space-y-6">
          {error && (
            <div className="p-3 mb-6 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search accessories by name, SKU..."
                className="w-full pl-10 pr-4 h-10 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] text-sm text-text placeholder-text-muted focus:outline-none focus:border-gold/50 focus:bg-[rgba(255,255,255,0.04)] transition-all"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-surface border border-border rounded-[var(--radius-lg)] overflow-hidden relative min-h-[200px]">
            {loading && (
              <div className="absolute inset-0 bg-surface/50 backdrop-blur-sm flex items-center justify-center z-10">
                <Loader2 className="w-8 h-8 text-gold animate-spin" />
              </div>
            )}
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-[rgba(255,255,255,0.02)]">
                  <th className="px-4 py-3 font-medium text-text-secondary">Product</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">SKU</th>
                  <th className="px-4 py-3 font-medium text-text-secondary text-right">Cost Price</th>
                  <th className="px-4 py-3 font-medium text-text-secondary text-right">Selling Price</th>
                  <th className="px-4 py-3 font-medium text-text-secondary text-right">Qty</th>
                  <th className="px-4 py-3 font-medium text-text-secondary text-right">Reorder Level</th>
                  <th className="px-4 py-3 font-medium text-text-secondary text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stocks.map((stock) => (
                  <tr key={stock.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text">{stock.product.name}</p>
                      <p className="text-xs text-text-muted">{stock.product.brand}</p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{stock.product.sku}</td>
                    <td className="px-4 py-3 text-text text-right">{stock.cost_price} DH</td>
                    <td className="px-4 py-3 text-text text-right">{stock.selling_price} DH</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded text-xs font-medium border ${
                        stock.quantity === 0 
                          ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                          : stock.quantity <= stock.reorder_level 
                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' 
                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                      }`}>
                        {stock.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-right">{stock.reorder_level}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedStock(stock);
                          setAdjustModalOpen(true);
                        }}
                        className="text-gold hover:text-gold-hover text-sm font-medium px-3 py-1 rounded bg-gold/10 hover:bg-gold/20 transition-colors"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
                {stocks.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="text-text-muted mb-2">No accessories found.</div>
                      {search ? (
                        <button 
                          onClick={() => setSearch('')}
                          className="text-gold hover:underline text-sm"
                        >
                          Clear search
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

      <ReceiveAccessoryModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={loadStocks} 
      />

      <AdjustAccessoryStockModal
        isOpen={adjustModalOpen}
        onClose={() => {
          setAdjustModalOpen(false);
          setSelectedStock(null);
        }}
        onSuccess={loadStocks}
        stock={selectedStock}
      />
    </div>
  );
}
