import { useState, useEffect, useCallback } from 'react';
import { inventoryApi } from '../api/inventory';
import type { AccessoryStock } from '../api/inventory';
import { Search, Plus, Loader2, Package, RefreshCw } from 'lucide-react';
import ReceiveAccessoryModal from '../components/inventory/ReceiveAccessoryModal';
import AdjustAccessoryStockModal from '../components/inventory/AdjustAccessoryStockModal';
import { useDebounce } from '../hooks/useDebounce';
import PageContainer from '../components/ui/PageContainer';
import PageHeader from '../components/ui/PageHeader';
import { formatCurrency } from '../utils/formatters';

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
      setError(err.response?.data?.error || 'Erreur lors du chargement des accessoires');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  const headerActions = (
    <div className="flex items-center gap-2.5">
      <button
        onClick={() => loadStocks()}
        disabled={loading}
        className="h-10 px-3.5 rounded-[var(--radius-md)] bg-surface hover:bg-surface-hover text-text-secondary hover:text-text border border-border flex items-center gap-2 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        title="Actualiser"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-gold' : ''}`} />
        <span>Actualiser</span>
      </button>

      <button
        onClick={() => setIsModalOpen(true)}
        className="h-10 px-4 bg-gold hover:bg-gold-bright text-black font-semibold rounded-[var(--radius-md)] flex items-center gap-2 text-xs transition-all shadow-md active:scale-95 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span>Réceptionner un accessoire</span>
      </button>
    </div>
  );

  return (
    <PageContainer
      header={
        <PageHeader
          icon={Package}
          title="Stock des Accessoires"
          subtitle={`${stocks.length} références d'accessoires enregistrées en boutique`}
          actions={headerActions}
        />
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-[var(--radius-md)] bg-danger/10 border border-danger/30 text-danger text-sm">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="p-4 rounded-[var(--radius-lg)] bg-surface border border-border flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom d'accessoire, SKU, marque..."
              className="w-full pl-10 pr-4 h-10 bg-surface-elevated border border-border rounded-[var(--radius-md)] text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-gold/60 transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface border border-border rounded-[var(--radius-lg)] overflow-hidden relative min-h-[200px] shadow-xs">
          {loading && (
            <div className="absolute inset-0 bg-surface/50 backdrop-blur-xs flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 text-gold animate-spin" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-elevated text-text-secondary uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3.5">Produit</th>
                  <th className="px-4 py-3.5">SKU</th>
                  <th className="px-4 py-3.5 text-right">Coût d'achat</th>
                  <th className="px-4 py-3.5 text-right">Prix de vente</th>
                  <th className="px-4 py-3.5 text-center">Quantité</th>
                  <th className="px-4 py-3.5 text-center">Seuil alerte</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stocks.map((stock) => {
                  const isLow = stock.reorder_level > 0 && stock.quantity <= stock.reorder_level;
                  const isOut = stock.quantity === 0;

                  return (
                    <tr key={stock.id} className="hover:bg-surface-hover/60 transition-colors">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-text">{stock.product.name}</p>
                        <p className="text-[11px] text-text-muted">{stock.product.brand}</p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-text-secondary">{stock.product.sku}</td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-text-secondary">
                        {formatCurrency(stock.cost_price)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums font-semibold text-text">
                        {formatCurrency(stock.selling_price)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums border ${
                          isOut 
                            ? 'bg-danger/10 text-danger border-danger/30' 
                            : isLow 
                              ? 'bg-warning/10 text-warning border-warning/30' 
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                        }`}>
                          {stock.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center text-text-secondary tabular-nums">
                        {stock.reorder_level > 0 ? stock.reorder_level : <span className="text-text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedStock(stock);
                            setAdjustModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-surface-elevated hover:bg-gold/20 text-gold border border-gold/30 hover:border-gold/50 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Ajuster
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {stocks.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="text-text-muted mb-2 text-xs">Aucun accessoire trouvé.</div>
                      {search ? (
                        <button 
                          onClick={() => setSearch('')}
                          className="text-gold hover:underline text-xs font-semibold cursor-pointer"
                        >
                          Effacer la recherche
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
    </PageContainer>
  );
}

