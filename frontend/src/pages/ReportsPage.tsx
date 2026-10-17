import { useState, useEffect, useCallback } from 'react';
import { reportsApi, type ZReportData } from '../api/reports';
import { useAuthStore } from '../store/authStore';
import ZReportReceiptPrint, { printZReport } from '../components/reports/ZReportReceiptPrint';
import PageContainer from '../components/ui/PageContainer';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import {
  BarChart3,
  Banknote,
  TrendingUp,
  CreditCard,
  Coins,
  HandCoins,
  Smartphone,
  Package,
  Printer,
  RefreshCw,
  Loader2,
  Calendar,
  AlertCircle,
  Clock,
  UserCheck,
  ShoppingBag,
  Award,
} from 'lucide-react';

export default function ReportsPage() {
  const { operator, user } = useAuthStore();
  const [data, setData] = useState<ZReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date Filter State
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [preset, setPreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());

  // Active Tab for details
  const [activeTab, setActiveTab] = useState<'sales' | 'debts' | 'products'>('sales');

  const setPresetDates = (newPreset: 'today' | 'yesterday' | 'week' | 'month') => {
    setPreset(newPreset);
    const now = new Date();
    const todayStr = getTodayStr();

    if (newPreset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (newPreset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (newPreset === 'week') {
      const w = new Date();
      w.setDate(w.getDate() - 6);
      setStartDate(w.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (newPreset === 'month') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(m.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  };

  const fetchReport = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const report = await reportsApi.getZReport(startDate, endDate);
      setData(report);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erreur de chargement du rapport Z.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePrintZReport = () => {
    if (data) {
      printZReport(data, operatorLabel);
    } else {
      window.print();
    }
  };

  const operatorLabel = operator?.display_name || user?.display_name || 'Bighrissen Admin';

  return (
    <>
      {/* Thermal Print Version (Hidden from screen, visible only when printing) */}
      {data && <ZReportReceiptPrint data={data} operatorName={operatorLabel} />}

      <PageContainer
        header={
          <PageHeader
            title="Rapports & Clôture de Caisse"
            subtitle="Bilan financier, réconciliation du tiroir de caisse et marges réelles"
            icon={BarChart3}
            badge={
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gold/15 text-gold border border-gold-border">
                Ticket Z
              </span>
            }
            actions={
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => fetchReport(true)}
                  disabled={isRefreshing || isLoading}
                  className="h-9 px-3.5 rounded-lg border border-border text-text-secondary hover:text-text hover:bg-white/5 flex items-center gap-2 text-xs font-semibold transition-all focus-ring disabled:opacity-50"
                  title="Actualiser les données"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-gold' : ''}`} />
                  <span>Actualiser</span>
                </button>

                <button
                  onClick={handlePrintZReport}
                  disabled={!data || isLoading}
                  className="h-9 px-4 rounded-lg bg-gold hover:bg-gold-light text-bg font-bold flex items-center gap-2 text-xs shadow-lg shadow-gold/10 transition-all hover:scale-[1.02] active:scale-[0.98] focus-ring disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer Ticket Z</span>
                </button>
              </div>
            }
          />
        }
      >
        <div className="space-y-6">
          {/* Subheader: Date Range Selector */}
          <div className="bg-surface p-4 rounded-xl border border-border flex flex-wrap items-center justify-between gap-4">
            {/* Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setPresetDates('today')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-ring ${
                  preset === 'today'
                    ? 'bg-gold text-bg font-bold shadow-sm'
                    : 'bg-surface-elevated text-text-secondary hover:text-text hover:bg-white/5 border border-border'
                }`}
              >
                Aujourd'hui (Ticket Z)
              </button>
              <button
                onClick={() => setPresetDates('yesterday')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-ring ${
                  preset === 'yesterday'
                    ? 'bg-gold text-bg font-bold shadow-sm'
                    : 'bg-surface-elevated text-text-secondary hover:text-text hover:bg-white/5 border border-border'
                }`}
              >
                Hier
              </button>
              <button
                onClick={() => setPresetDates('week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-ring ${
                  preset === 'week'
                    ? 'bg-gold text-bg font-bold shadow-sm'
                    : 'bg-surface-elevated text-text-secondary hover:text-text hover:bg-white/5 border border-border'
                }`}
              >
                7 derniers jours
              </button>
              <button
                onClick={() => setPresetDates('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-ring ${
                  preset === 'month'
                    ? 'bg-gold text-bg font-bold shadow-sm'
                    : 'bg-surface-elevated text-text-secondary hover:text-text hover:bg-white/5 border border-border'
                }`}
              >
                Ce mois-ci
              </button>
            </div>

            {/* Custom Dates */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-surface-elevated px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary">
                <Calendar className="w-3.5 h-3.5 text-gold" />
                <span>Du :</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPreset('custom');
                  }}
                  className="bg-transparent text-text focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 bg-surface-elevated px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary">
                <Calendar className="w-3.5 h-3.5 text-gold" />
                <span>Au :</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPreset('custom');
                  }}
                  className="bg-transparent text-text focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading && !data ? (
            <div className="h-64 flex flex-col items-center justify-center text-text-muted gap-3">
              <Loader2 className="w-8 h-8 text-gold animate-spin" />
              <p className="text-sm">Calcul du bilan et clôture de caisse...</p>
            </div>
          ) : !data ? null : (
            <>
              {/* 5 Key Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                  label="Tiroir Caisse (Espèces)"
                  value={formatCurrency(data.kpi.cash_in_drawer)}
                  subValue={`Ventes: ${formatCurrency(data.kpi.direct_cash)} | Dettes: +${formatCurrency(data.kpi.debt_cash)}`}
                  icon={Banknote}
                  variant="emerald"
                />
                <StatCard
                  label="Chiffre d'Affaires Net"
                  value={formatCurrency(data.kpi.total_revenue)}
                  subValue={`${data.kpi.sales_count} ventes | Panier: ${formatCurrency(data.kpi.average_basket)}`}
                  icon={TrendingUp}
                  variant="gold"
                />
                <StatCard
                  label="Total Encaissé Réel"
                  value={formatCurrency(data.kpi.total_real_collected)}
                  subValue={`Espèces: ${formatCurrency(data.kpi.cash_in_drawer)} | Virement: ${formatCurrency(data.kpi.total_bank_transfer)}`}
                  icon={CreditCard}
                  variant="cyan"
                />
                <StatCard
                  label="Bénéfice Brut Estimé"
                  value={formatCurrency(data.kpi.gross_profit)}
                  subValue={`Marge: ${data.kpi.margin_percent}% | Coût: ${formatCurrency(data.kpi.total_cogs)}`}
                  icon={Coins}
                  variant="purple"
                />
                <StatCard
                  label="Flux Crédit / Dettes"
                  value={formatCurrency(data.kpi.new_debt_granted)}
                  subValue={`Accordés: +${formatCurrency(data.kpi.new_debt_granted)} | Recouvrés: -${formatCurrency(data.kpi.total_debt_recovered)}`}
                  icon={HandCoins}
                  variant="amber"
                />
              </div>

                {/* Section Rayons & Top Produits */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Rayon Téléphones */}
                  <div className="p-5 rounded-2xl bg-surface border border-border">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-text">Rayon Téléphones</h3>
                          <p className="text-[11px] text-text-muted">Appareils et smartphones vendus</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-300 tabular-nums">
                        {data.breakdown.devices.units} pcs
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-text-muted">Chiffre d'Affaires Téléphones :</span>
                        <span className="font-semibold text-text tabular-nums">{formatCurrency(data.breakdown.devices.revenue)}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-text-muted">Coût d'Achat :</span>
                        <span className="text-text tabular-nums">{formatCurrency(data.breakdown.devices.cost)}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-text-muted font-medium">Bénéfice Réalisé :</span>
                        <span className="font-bold text-emerald-400 tabular-nums">+{formatCurrency(data.breakdown.devices.profit)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rayon Accessoires */}
                  <div className="p-5 rounded-2xl bg-surface border border-border">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gold/10 text-gold flex items-center justify-center">
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-text">Rayon Accessoires</h3>
                          <p className="text-[11px] text-text-muted">Chargeurs, écouteurs, coques, etc.</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gold/15 text-gold tabular-nums">
                        {data.breakdown.accessories.units} pcs
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-text-muted">Chiffre d'Affaires Accessoires :</span>
                        <span className="font-semibold text-text tabular-nums">{formatCurrency(data.breakdown.accessories.revenue)}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-text-muted">Coût d'Achat :</span>
                        <span className="text-text tabular-nums">{formatCurrency(data.breakdown.accessories.cost)}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-text-muted font-medium">Bénéfice Réalisé :</span>
                        <span className="font-bold text-emerald-400 tabular-nums">+{formatCurrency(data.breakdown.accessories.profit)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Top Produits */}
                  <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Award className="w-4 h-4 text-gold" />
                        <h3 className="text-sm font-bold text-text">Top Ventes de la Période</h3>
                      </div>
                      {data.top_products.length === 0 ? (
                        <p className="text-xs text-text-muted py-6 text-center">Aucune vente enregistrée.</p>
                      ) : (
                        <div className="space-y-2">
                          {data.top_products.slice(0, 4).map((tp, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                              <div className="truncate pr-2">
                                <span className="font-bold text-gold mr-1.5">#{idx + 1}</span>
                                <span className="text-text font-medium">{tp.name}</span>
                              </div>
                              <div className="text-right whitespace-nowrap">
                                <div className="text-text font-semibold tabular-nums">{formatCurrency(tp.revenue)}</div>
                                <div className="text-[10px] text-text-muted tabular-nums">{tp.quantity} vendus</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {data.top_products.length > 4 && (
                      <button
                        onClick={() => setActiveTab('products')}
                        className="mt-3 text-xs text-gold hover:underline text-left cursor-pointer font-medium"
                      >
                        Voir tous les produits ({data.top_products.length}) &rarr;
                      </button>
                    )}
                  </div>
                </div>

                {/* Section Détails & Journaux */}
                <div className="bg-surface rounded-2xl border border-border overflow-hidden">
                  {/* Table Tabs */}
                  <div className="border-b border-border px-6 pt-4 flex items-center gap-6">
                    <button
                      onClick={() => setActiveTab('sales')}
                      className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border-b-2 ${
                        activeTab === 'sales'
                          ? 'border-gold text-gold'
                          : 'border-transparent text-text-muted hover:text-text'
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Journal des Ventes ({data.sales.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('debts')}
                      className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border-b-2 ${
                        activeTab === 'debts'
                          ? 'border-gold text-gold'
                          : 'border-transparent text-text-muted hover:text-text'
                      }`}
                    >
                      <HandCoins className="w-4 h-4" />
                      <span>Recouvrements de Dettes ({data.debt_repayments.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('products')}
                      className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border-b-2 ${
                        activeTab === 'products'
                          ? 'border-gold text-gold'
                          : 'border-transparent text-text-muted hover:text-text'
                      }`}
                    >
                      <Package className="w-4 h-4" />
                      <span>Articles Vendus ({data.top_products.length})</span>
                    </button>
                  </div>

                  {/* Tab 1: Sales Journal */}
                  {activeTab === 'sales' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-elevated text-text-muted border-b border-border">
                          <tr>
                            <th className="py-3 px-6">Heure / Date</th>
                            <th className="py-3 px-4">N° Reçu</th>
                            <th className="py-3 px-4">Client</th>
                            <th className="py-3 px-4">Articles</th>
                            <th className="py-3 px-4 text-right">Espèces</th>
                            <th className="py-3 px-4 text-right">Virement</th>
                            <th className="py-3 px-4 text-right">Dette / Crédit</th>
                            <th className="py-3 px-6 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {data.sales.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-text-muted">
                                Aucune vente complétée sur cette période.
                              </td>
                            </tr>
                          ) : (
                            data.sales.map((sale) => (
                              <tr key={sale.id} className="hover:bg-surface-hover/50 transition-colors">
                                <td className="py-3 px-6 text-text-muted font-mono flex items-center gap-1.5">
                                  <Clock className="w-3 h-3 text-gold" />
                                  {formatDateTime(sale.created_at)}
                                </td>
                                <td className="py-3 px-4 font-mono font-medium text-text">
                                  {sale.receipt_id}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-medium text-text">{sale.customer_name}</div>
                                  {sale.customer_phone && (
                                    <div className="text-[10px] text-text-muted">{sale.customer_phone}</div>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 rounded-md bg-surface-elevated text-text-secondary border border-border tabular-nums">
                                    {sale.items_count} art.
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-emerald-400 tabular-nums">
                                  {Number(sale.cash_amount) > 0 ? formatCurrency(sale.cash_amount) : '—'}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-cyan-400 tabular-nums">
                                  {Number(sale.transfer_amount) > 0 ? formatCurrency(sale.transfer_amount) : '—'}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-amber-400 tabular-nums">
                                  {Number(sale.debt_amount) > 0 ? formatCurrency(sale.debt_amount) : '—'}
                                </td>
                                <td className="py-3 px-6 text-right font-bold text-text tabular-nums">
                                  {formatCurrency(sale.total_amount)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Tab 2: Debt Repayments */}
                  {activeTab === 'debts' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-elevated text-text-muted border-b border-border">
                          <tr>
                            <th className="py-3 px-6">Date & Heure</th>
                            <th className="py-3 px-4">Client</th>
                            <th className="py-3 px-4">Mode de Paiement</th>
                            <th className="py-3 px-4">Notes / Réf</th>
                            <th className="py-3 px-4">Opérateur</th>
                            <th className="py-3 px-6 text-right">Montant Encaissé</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {data.debt_repayments.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-text-muted">
                                Aucun remboursement de dette enregistré sur cette période.
                              </td>
                            </tr>
                          ) : (
                            data.debt_repayments.map((dp) => (
                              <tr key={dp.id} className="hover:bg-surface-hover/50 transition-colors">
                                <td className="py-3 px-6 text-text-muted font-mono flex items-center gap-1.5">
                                  <Clock className="w-3 h-3 text-emerald-400" />
                                  {formatDateTime(dp.created_at)}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-medium text-text">{dp.customer_name}</div>
                                  <div className="text-[10px] text-text-muted">{dp.customer_phone}</div>
                                </td>
                                <td className="py-3 px-4">
                                  {dp.payment_method === 'CASH' ? (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium text-[11px]">
                                      Espèces (Tiroir)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium text-[11px]">
                                      Virement Bancaire
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-text-muted italic">
                                  {dp.notes || 'Règlement carnet crédit'}
                                </td>
                                <td className="py-3 px-4 text-text-muted flex items-center gap-1.5">
                                  <UserCheck className="w-3 h-3 text-gold" />
                                  {dp.operator || 'Caissier'}
                                </td>
                                <td className="py-3 px-6 text-right font-bold text-emerald-400 text-sm tabular-nums">
                                  +{formatCurrency(dp.amount)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Tab 3: Products breakdown */}
                  {activeTab === 'products' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-elevated text-text-muted border-b border-border">
                          <tr>
                            <th className="py-3 px-6">Rang</th>
                            <th className="py-3 px-4">Produit</th>
                            <th className="py-3 px-4">SKU</th>
                            <th className="py-3 px-4 text-center">Quantité Vendue</th>
                            <th className="py-3 px-4 text-right">Bénéfice Réalisé</th>
                            <th className="py-3 px-6 text-right">Chiffre d'Affaires</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {data.top_products.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-text-muted">
                                Aucun article vendu sur cette période.
                              </td>
                            </tr>
                          ) : (
                            data.top_products.map((p, idx) => (
                              <tr key={idx} className="hover:bg-surface-hover/50 transition-colors">
                                <td className="py-3 px-6 font-bold text-gold">#{idx + 1}</td>
                                <td className="py-3 px-4 font-semibold text-text">{p.name}</td>
                                <td className="py-3 px-4 font-mono text-text-muted">{p.sku}</td>
                                <td className="py-3 px-4 text-center font-bold text-text tabular-nums">{p.quantity}</td>
                                <td className="py-3 px-4 text-right font-medium text-emerald-400 tabular-nums">
                                  +{formatCurrency(p.profit)}
                                </td>
                                <td className="py-3 px-6 text-right font-bold text-text tabular-nums">
                                  {formatCurrency(p.revenue)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </PageContainer>
    </>
  );
}
