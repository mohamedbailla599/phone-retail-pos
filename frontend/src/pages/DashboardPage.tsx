import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PageContainer from '../components/ui/PageContainer';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { dashboardApi } from '../api/dashboard';
import type { DashboardStats } from '../api/dashboard';
import { formatCurrency } from '../utils/formatters';
import {
  LayoutDashboard,
  Coins,
  Banknote,
  CreditCard,
  Smartphone,
  Package,
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Loader2,
  TrendingUp,
  ShoppingCart
} from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const data = await dashboardApi.getStats();
      setStats(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Impossible de charger les métriques du tableau de bord');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const headerActions = (
    <div className="flex items-center gap-2.5">
      <button
        onClick={() => fetchStats(true)}
        disabled={isRefreshing || isLoading}
        className="h-10 px-3.5 bg-surface hover:bg-surface-hover text-text-secondary hover:text-text border border-border rounded-[var(--radius-md)] flex items-center gap-2 text-xs font-semibold transition-colors active:scale-95 disabled:opacity-50"
        title="Actualiser les métriques"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-gold' : ''}`} />
        <span>Actualiser</span>
      </button>

      <Link
        to="/pos"
        className="h-10 px-4 bg-gold hover:bg-gold-bright text-black font-semibold rounded-[var(--radius-md)] flex items-center gap-2 text-xs transition-all shadow-md active:scale-95"
      >
        <ShoppingCart className="w-4 h-4" />
        <span>Nouvelle Vente</span>
      </Link>

      <Link
        to="/exchanges"
        className="h-10 px-3.5 bg-surface hover:bg-surface-hover text-gold border border-gold/30 font-semibold rounded-[var(--radius-md)] flex items-center gap-1.5 text-xs transition-all shadow-xs active:scale-95"
      >
        <ArrowLeftRight className="w-3.5 h-3.5" />
        <span>Échanges</span>
      </Link>
    </div>
  );

  return (
    <PageContainer
      header={
        <PageHeader
          icon={LayoutDashboard}
          title="Tableau de Bord"
          subtitle="Aperçu en temps réel du chiffre d'affaires, de la valorisation des stocks et de la caisse"
          actions={headerActions}
        />
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-[var(--radius-md)] bg-danger/10 border border-danger/30 text-danger text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => fetchStats()} className="underline text-xs font-semibold cursor-pointer">
              Réessayer
            </button>
          </div>
        )}

        {isLoading && !stats ? (
          <div className="flex flex-col items-center justify-center py-28 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-gold mb-3" />
            <p className="text-sm">Calcul des indicateurs du magasin...</p>
          </div>
        ) : stats ? (
          <>
            {/* 1. Core Key Performance Indicator Cards (4 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Chiffre d'Affaires du Jour"
                value={formatCurrency(stats.today_revenue)}
                icon={TrendingUp}
                variant="gold"
                subValue={
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{stats.today_sales_count} ventes réalisées aujourd'hui</span>
                  </span>
                }
              />

              <StatCard
                label="Encaissements Caisse"
                value={formatCurrency(stats.today_cash + stats.today_transfer)}
                icon={Coins}
                variant="emerald"
                subValue={
                  <div className="flex flex-col gap-0.5 w-full">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted flex items-center gap-1">
                        <Banknote className="w-3 h-3 text-emerald-400" /> Espèces :
                      </span>
                      <span className="font-semibold text-text tabular-nums">{formatCurrency(stats.today_cash)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-blue-400" /> Virement :
                      </span>
                      <span className="font-semibold text-text tabular-nums">{formatCurrency(stats.today_transfer)}</span>
                    </div>
                  </div>
                }
              />

              <StatCard
                label="Valorisation du Stock"
                value={formatCurrency(stats.devices_in_stock_value)}
                icon={Smartphone}
                variant="blue"
                subValue={
                  <div className="flex items-center justify-between text-text-muted text-[11px] w-full">
                    <span>{stats.devices_in_stock_count} téléphones</span>
                    <span>{stats.accessories_in_stock_count} accessoires</span>
                  </div>
                }
              />

              <StatCard
                label="Échanges de Téléphones"
                value={stats.pending_exchanges_count + stats.approved_exchanges_count}
                icon={ArrowLeftRight}
                variant="amber"
                subValue={
                  <div className="flex items-center justify-between text-[11px] w-full">
                    <span className="text-warning font-medium">{stats.pending_exchanges_count} en attente</span>
                    <span className="text-emerald-400 font-medium">{stats.approved_exchanges_count} validés</span>
                  </div>
                }
              />
            </div>

            {/* 2. Operational Notice Banners */}
            <div className="space-y-3">
              {stats.low_stock_count > 0 && (
                <div className="p-4 rounded-[var(--radius-lg)] bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[var(--radius-md)] bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-400">
                        Alerte Stock Faible : {stats.low_stock_count} accessoire{stats.low_stock_count > 1 ? 's' : ''} sous le seuil d'alerte
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        Réapprovisionnez les références signalées pour éviter les ruptures en caisse.
                      </div>
                    </div>
                  </div>
                  <Link
                    to="/accessories"
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] bg-amber-500/20 border border-amber-500/40 transition-colors"
                  >
                    <span>Gérer le stock</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {stats.pending_exchanges_count > 0 && (
                <div className="p-4 rounded-[var(--radius-lg)] bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[var(--radius-md)] bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                      <ArrowLeftRight className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-blue-400">
                        Validation requise : {stats.pending_exchanges_count} échange{stats.pending_exchanges_count > 1 ? 's' : ''} en attente
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        Validez ou rejetez les estimations de reprise pour clôturer les dossiers.
                      </div>
                    </div>
                  </div>
                  <Link
                    to="/exchanges"
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] bg-blue-500/20 border border-blue-500/40 transition-colors"
                  >
                    <span>Examiner</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>

            {/* 3. Middle Feeds: Recent Sales & Recent Exchanges */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Completed Sales */}
              <div className="p-5 rounded-[var(--radius-lg)] bg-surface border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-gold" />
                    <h3 className="text-sm font-bold text-text">Dernières Ventes en Caisse</h3>
                  </div>
                  <Link
                    to="/pos"
                    className="text-xs text-text-muted hover:text-gold flex items-center gap-1 transition-colors"
                  >
                    <span>Point de Vente</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {stats.recent_sales.length === 0 ? (
                  <div className="py-12 text-center text-text-muted text-xs">
                    Aucune vente enregistrée aujourd'hui.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {stats.recent_sales.map((sale) => (
                      <div key={sale.id} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-gold">
                              {sale.receipt_id}
                            </span>
                            <span className="text-xs text-text font-medium">
                              {sale.customer_name}
                            </span>
                          </div>
                          <div className="text-[11px] text-text-muted mt-0.5">
                            {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {sale.items_count} article{sale.items_count > 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-text tabular-nums">
                            {formatCurrency(sale.total_amount)}
                          </div>
                          <div className="text-[10px] text-emerald-400 flex items-center justify-end gap-1 mt-0.5">
                            {sale.payment_methods.join(' / ') || 'Payé'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Exchanges & Trade-Ins */}
              <div className="p-5 rounded-[var(--radius-lg)] bg-surface border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4 text-gold" />
                    <h3 className="text-sm font-bold text-text">Derniers Échanges & Reprises</h3>
                  </div>
                  <Link
                    to="/exchanges"
                    className="text-xs text-text-muted hover:text-gold flex items-center gap-1 transition-colors"
                  >
                    <span>Voir tout</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {stats.recent_exchanges.length === 0 ? (
                  <div className="py-12 text-center text-text-muted text-xs">
                    Aucun échange enregistré récemment.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {stats.recent_exchanges.map((ex) => (
                      <div key={ex.id} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-gold">
                              {ex.exchange_number}
                            </span>
                            <span className="text-xs text-text font-medium">
                              {ex.customer_name}
                            </span>
                          </div>
                          <div className="text-[11px] text-text-muted mt-0.5">
                            {ex.trade_in_product_name} ➔ {ex.new_device_name}
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <StatusBadge status={ex.status} size="sm" />
                          <div className="text-[11px] tabular-nums text-text-muted">
                            Diff : {formatCurrency(ex.difference_amount)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Bottom Section: Low Stock Watchlist */}
            {stats.low_stock_items.length > 0 && (
              <div className="p-5 rounded-[var(--radius-lg)] bg-surface border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-warning" />
                    <h3 className="text-sm font-bold text-text">Surveillance du Stock Faible (Accessoires)</h3>
                  </div>
                  <Link
                    to="/accessories"
                    className="text-xs text-text-muted hover:text-gold flex items-center gap-1 transition-colors"
                  >
                    <span>Gestion des stocks</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-elevated border-b border-border text-text-secondary uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Produit</th>
                        <th className="px-4 py-2.5 font-semibold">SKU</th>
                        <th className="px-4 py-2.5 font-semibold text-center">Stock restant</th>
                        <th className="px-4 py-2.5 font-semibold text-center">Seuil réappro</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Prix de vente</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-text">
                      {stats.low_stock_items.map((item) => (
                        <tr key={item.id} className="hover:bg-surface-hover/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-text">{item.name}</td>
                          <td className="px-4 py-3 font-mono text-text-muted">{item.sku}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-bold ${
                              item.quantity === 0
                                ? 'bg-danger/10 text-danger border border-danger/30'
                                : 'bg-warning/10 text-warning border border-warning/30'
                            }`}>
                              {item.quantity} unités
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-text-muted tabular-nums">
                            {item.reorder_level} unités
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">
                            {formatCurrency(item.selling_price)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              to="/accessories"
                              className="text-[11px] font-semibold text-gold hover:underline"
                            >
                              Ajuster
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}

