import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import { dashboardApi } from '../api/dashboard';
import type { DashboardStats } from '../api/dashboard';
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
      setError(err.response?.data?.detail || err.message || 'Failed to load dashboard metrics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatCurrency = (val?: string | number) => {
    return new Intl.NumberFormat('en-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 2,
    }).format(Number(val || 0));
  };

  return (
    <div className="h-screen flex bg-bg overflow-hidden w-full print:hidden">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
        {/* Top Header */}
        <header className="h-[72px] flex items-center justify-between px-8 bg-surface border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text tracking-tight flex items-center gap-2">
                Executive Dashboard
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                Real-time sales revenue, inventory valuation, register balances & exchanges
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchStats(true)}
              disabled={isRefreshing || isLoading}
              className="h-9 px-3.5 bg-surface-alt hover:bg-surface-elevated text-text-secondary hover:text-text border border-border rounded-[var(--radius-md)] flex items-center gap-2 text-xs font-semibold transition-colors active:scale-95"
              title="Refresh dashboard metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-gold' : ''}`} />
              <span>Refresh</span>
            </button>

            <Link
              to="/pos"
              className="h-9 px-3.5 bg-gold hover:bg-gold-bright text-black font-semibold rounded-[var(--radius-md)] flex items-center gap-1.5 text-xs transition-all shadow-md active:scale-95"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              New Sale
            </Link>

            <Link
              to="/exchanges"
              className="h-9 px-3.5 bg-surface-elevated hover:bg-surface-hover text-gold border border-gold-border/50 font-semibold rounded-[var(--radius-md)] flex items-center gap-1.5 text-xs transition-all shadow-sm active:scale-95"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Exchanges
            </Link>
          </div>
        </header>

        {/* Scrollable Dashboard Body */}
        <div className="flex-1 overflow-auto p-8 space-y-6">
          <div className="max-w-[1400px] mx-auto space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-danger-bg border border-danger/30 text-danger text-sm flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => fetchStats()} className="underline text-xs font-semibold">
                  Retry
                </button>
              </div>
            )}

            {isLoading && !stats ? (
              <div className="flex flex-col items-center justify-center py-28 text-text-muted">
                <Loader2 className="w-8 h-8 animate-spin text-gold mb-3" />
                <p className="text-sm">Aggregating store performance metrics...</p>
              </div>
            ) : stats ? (
              <>
                {/* 1. Core Key Performance Indicator Cards (4 Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Today's Revenue */}
                  <div className="p-5 rounded-2xl bg-surface border border-border relative overflow-hidden group hover:border-gold/30 transition-all shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                        Today's Revenue
                      </span>
                      <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-black text-text tracking-tight font-mono">
                        {formatCurrency(stats.today_revenue)}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{stats.today_sales_count} sales completed today</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Cash & Transfer Collections */}
                  <div className="p-5 rounded-2xl bg-surface border border-border relative overflow-hidden group hover:border-emerald-500/30 transition-all shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                        Register Collections
                      </span>
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Coins className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-muted flex items-center gap-1">
                          <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                          Cash in Drawer:
                        </span>
                        <span className="font-bold text-text font-mono">
                          {formatCurrency(stats.today_cash)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                        <span className="text-text-muted flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                          Bank Transfers:
                        </span>
                        <span className="font-bold text-text font-mono">
                          {formatCurrency(stats.today_transfer)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Inventory Valuation */}
                  <div className="p-5 rounded-2xl bg-surface border border-border relative overflow-hidden group hover:border-blue-500/30 transition-all shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                        Stock Valuation
                      </span>
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                        <Smartphone className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-black text-text tracking-tight font-mono">
                        {formatCurrency(stats.devices_in_stock_value)}
                      </div>
                      <div className="text-xs text-text-muted mt-1 flex items-center justify-between">
                        <span>{stats.devices_in_stock_count} phones in stock</span>
                        <span>{stats.accessories_in_stock_count} accessories</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Trade-Ins & Exchanges */}
                  <div className="p-5 rounded-2xl bg-surface border border-border relative overflow-hidden group hover:border-amber-500/30 transition-all shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                        Device Exchanges
                      </span>
                      <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <ArrowLeftRight className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">Awaiting Review:</span>
                        <span className="font-bold text-warning font-mono">
                          {stats.pending_exchanges_count}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                        <span className="text-text-muted">Approved & Ready:</span>
                        <span className="font-bold text-emerald-400 font-mono">
                          {stats.approved_exchanges_count}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Operational Notice Banners */}
                <div className="space-y-3">
                  {stats.low_stock_count > 0 && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-amber-400">
                            Low Stock Alert: {stats.low_stock_count} accessories at or below reorder level
                          </div>
                          <div className="text-[11px] text-text-muted mt-0.5">
                            Reorder supplies to prevent stockout during checkout.
                          </div>
                        </div>
                      </div>
                      <Link
                        to="/accessories"
                        className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 transition-colors"
                      >
                        Manage Stock
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}

                  {stats.pending_exchanges_count > 0 && (
                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                          <ArrowLeftRight className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-blue-400">
                            Exchange Action Required: {stats.pending_exchanges_count} pending review
                          </div>
                          <div className="text-[11px] text-text-muted mt-0.5">
                            Owners must approve or reject pending trade-in valuations.
                          </div>
                        </div>
                      </div>
                      <Link
                        to="/exchanges"
                        className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40 transition-colors"
                      >
                        Review Now
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>

                {/* 3. Middle Feeds: Recent Sales & Recent Exchanges */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Completed Sales */}
                  <div className="p-5 rounded-2xl bg-surface border border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-gold" />
                        <h3 className="text-sm font-bold text-text">Recent POS Transactions</h3>
                      </div>
                      <Link
                        to="/pos"
                        className="text-xs text-text-muted hover:text-gold flex items-center gap-1 transition-colors"
                      >
                        Go to POS
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>

                    {stats.recent_sales.length === 0 ? (
                      <div className="py-12 text-center text-text-muted text-xs">
                        No transactions completed yet today.
                      </div>
                    ) : (
                      <div className="divide-y divide-border/60">
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
                                {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {sale.items_count} item{sale.items_count > 1 ? 's' : ''}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-text font-mono">
                                {formatCurrency(sale.total_amount)}
                              </div>
                              <div className="text-[10px] text-emerald-400 flex items-center justify-end gap-1 mt-0.5">
                                {sale.payment_methods.join(' / ') || 'Paid'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Exchanges & Trade-Ins */}
                  <div className="p-5 rounded-2xl bg-surface border border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowLeftRight className="w-4 h-4 text-gold" />
                        <h3 className="text-sm font-bold text-text">Recent Trade-Ins & Exchanges</h3>
                      </div>
                      <Link
                        to="/exchanges"
                        className="text-xs text-text-muted hover:text-gold flex items-center gap-1 transition-colors"
                      >
                        View All
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>

                    {stats.recent_exchanges.length === 0 ? (
                      <div className="py-12 text-center text-text-muted text-xs">
                        No trade-ins recorded yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-border/60">
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
                            <div className="text-right">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                                ex.status === 'COMPLETED' ? 'bg-surface-alt text-text-secondary border border-border' :
                                ex.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                                ex.status === 'UNDER_REVIEW' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                                'bg-warning-bg text-warning border border-warning/30'
                              }`}>
                                {ex.status.replace('_', ' ')}
                              </span>
                              <div className="text-[11px] font-mono text-text-muted mt-0.5">
                                Diff: {formatCurrency(ex.difference_amount)}
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
                  <div className="p-5 rounded-2xl bg-surface border border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-warning" />
                        <h3 className="text-sm font-bold text-text">Low Stock Accessories Watchlist</h3>
                      </div>
                      <Link
                        to="/accessories"
                        className="text-xs text-text-muted hover:text-gold flex items-center gap-1 transition-colors"
                      >
                        Inventory Details
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-alt border-b border-border text-text-muted uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="px-4 py-2.5 font-semibold">Product</th>
                            <th className="px-4 py-2.5 font-semibold">SKU</th>
                            <th className="px-4 py-2.5 font-semibold text-center">Remaining Stock</th>
                            <th className="px-4 py-2.5 font-semibold text-center">Reorder Threshold</th>
                            <th className="px-4 py-2.5 font-semibold text-right">Price</th>
                            <th className="px-4 py-2.5 font-semibold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50 text-text">
                          {stats.low_stock_items.map((item) => (
                            <tr key={item.id} className="hover:bg-surface-hover/50 transition-colors">
                              <td className="px-4 py-3 font-semibold text-text">{item.name}</td>
                              <td className="px-4 py-3 font-mono text-text-muted">{item.sku}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                                  item.quantity === 0
                                    ? 'bg-danger-bg text-danger border border-danger/30'
                                    : 'bg-warning-bg text-warning border border-warning/30'
                                }`}>
                                  {item.quantity} units
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-text-muted">
                                {item.reorder_level} units
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-semibold">
                                {formatCurrency(item.selling_price)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Link
                                  to="/accessories"
                                  className="text-[11px] font-semibold text-gold hover:underline"
                                >
                                  Adjust
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
        </div>
      </div>
    </div>
  );
}
