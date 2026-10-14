import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { reportsApi, type ZReportData } from '../api/reports';
import { useAuthStore } from '../store/authStore';
import ZReportReceiptPrint from '../components/reports/ZReportReceiptPrint';
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
    window.print();
  };

  const formatDH = (val?: string | number) => {
    const num = Number(val || 0);
    return num.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' DH';
  };

  const formatDateTime = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const operatorLabel = operator?.display_name || user?.display_name || 'Bighrissen Admin';

  return (
    <div className="h-screen flex bg-bg overflow-hidden print:h-auto print:bg-white print:overflow-visible">
      {/* Thermal Print Version (Hidden from screen, visible only when printing) */}
      {data && <ZReportReceiptPrint data={data} operatorName={operatorLabel} />}

      {/* Screen Interface (Hidden when printing) */}
      <div className="print:hidden flex flex-1 h-full overflow-hidden w-full">
        <Sidebar />

        <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
          {/* Top Header */}
          <header className="h-[76px] flex items-center justify-between px-8 bg-surface border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white tracking-wide">
                    Rapports & Clôture de Caisse
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gold/15 text-gold border border-gold/30">
                    Ticket Z
                  </span>
                </div>
                <p className="text-xs text-text-secondary">
                  Bilan financier, réconciliation du tiroir de caisse et marges réelles
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchReport(true)}
                disabled={isRefreshing || isLoading}
                className="h-10 px-3.5 rounded-xl bg-surface-hover hover:bg-border/60 text-text-secondary hover:text-white border border-border flex items-center gap-2 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
                title="Actualiser les données"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-gold' : ''}`} />
                <span>Actualiser</span>
              </button>

              <button
                onClick={handlePrintZReport}
                disabled={!data || isLoading}
                className="h-10 px-4 rounded-xl bg-gold hover:bg-gold-hover text-black font-semibold flex items-center gap-2 text-xs shadow-lg shadow-gold/20 hover:shadow-gold/30 transition-all cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer Ticket Z</span>
              </button>
            </div>
          </header>

          {/* Subheader: Date Range Selector */}
          <div className="bg-surface/50 border-b border-border px-8 py-3 flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
            {/* Presets */}
            <div className="flex items-center gap-1.5 bg-bg p-1 rounded-xl border border-border">
              <button
                onClick={() => setPresetDates('today')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  preset === 'today'
                    ? 'bg-gold text-black shadow-sm font-semibold'
                    : 'text-text-secondary hover:text-white'
                }`}
              >
                Aujourd'hui (Z-Report)
              </button>
              <button
                onClick={() => setPresetDates('yesterday')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  preset === 'yesterday'
                    ? 'bg-gold text-black shadow-sm font-semibold'
                    : 'text-text-secondary hover:text-white'
                }`}
              >
                Hier
              </button>
              <button
                onClick={() => setPresetDates('week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  preset === 'week'
                    ? 'bg-gold text-black shadow-sm font-semibold'
                    : 'text-text-secondary hover:text-white'
                }`}
              >
                7 derniers jours
              </button>
              <button
                onClick={() => setPresetDates('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  preset === 'month'
                    ? 'bg-gold text-black shadow-sm font-semibold'
                    : 'text-text-secondary hover:text-white'
                }`}
              >
                Ce mois-ci
              </button>
            </div>

            {/* Custom Dates */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-bg px-3 py-1.5 rounded-xl border border-border text-xs text-text-secondary">
                <Calendar className="w-3.5 h-3.5 text-gold" />
                <span>Du :</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPreset('custom');
                  }}
                  className="bg-transparent text-white focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 bg-bg px-3 py-1.5 rounded-xl border border-border text-xs text-text-secondary">
                <Calendar className="w-3.5 h-3.5 text-gold" />
                <span>Au :</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPreset('custom');
                  }}
                  className="bg-transparent text-white focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Main Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isLoading && !data ? (
              <div className="h-64 flex flex-col items-center justify-center text-text-secondary gap-3">
                <Loader2 className="w-8 h-8 text-gold animate-spin" />
                <p className="text-sm">Calcul du bilan et clôture de caisse...</p>
              </div>
            ) : !data ? null : (
              <>
                {/* 5 Key Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Card 1: Tiroir Espèces */}
                  <div className="p-4 rounded-2xl bg-surface border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/5 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                        Tiroir Caisse (Espèces)
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                        <Banknote className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400 mb-2">
                      {formatDH(data.kpi.cash_in_drawer)}
                    </div>
                    <div className="text-[11px] text-text-secondary space-y-0.5 border-t border-border/60 pt-2">
                      <div className="flex justify-between">
                        <span>Ventes directes :</span>
                        <span className="text-white font-medium">{formatDH(data.kpi.direct_cash)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Dettes encaissées :</span>
                        <span className="text-white font-medium">+{formatDH(data.kpi.debt_cash)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Chiffre d'Affaires */}
                  <div className="p-4 rounded-2xl bg-surface border border-gold-border/60 relative overflow-hidden group hover:border-gold transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gold">
                        Chiffre d'Affaires Net
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-gold/15 flex items-center justify-center text-gold">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white mb-2">
                      {formatDH(data.kpi.total_revenue)}
                    </div>
                    <div className="text-[11px] text-text-secondary space-y-0.5 border-t border-border/60 pt-2">
                      <div className="flex justify-between">
                        <span>Transactions :</span>
                        <span className="text-white font-medium">{data.kpi.sales_count} ventes</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Panier moyen :</span>
                        <span className="text-white font-medium">{formatDH(data.kpi.average_basket)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Total Encaissé Réel */}
                  <div className="p-4 rounded-2xl bg-surface border border-border relative overflow-hidden group hover:border-cyan-500/40 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                        Total Encaissé Réel
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center text-cyan-400">
                        <CreditCard className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-cyan-300 mb-2">
                      {formatDH(data.kpi.total_real_collected)}
                    </div>
                    <div className="text-[11px] text-text-secondary space-y-0.5 border-t border-border/60 pt-2">
                      <div className="flex justify-between">
                        <span>Espèces en caisse :</span>
                        <span className="text-white font-medium">{formatDH(data.kpi.cash_in_drawer)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Virements reçus :</span>
                        <span className="text-white font-medium">{formatDH(data.kpi.total_bank_transfer)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Bénéfice Estimé */}
                  <div className="p-4 rounded-2xl bg-surface border border-border relative overflow-hidden group hover:border-purple-500/40 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
                        Bénéfice Brut Estimé
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400">
                        <Coins className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-purple-300 mb-2">
                      {formatDH(data.kpi.gross_profit)}
                    </div>
                    <div className="text-[11px] text-text-secondary space-y-0.5 border-t border-border/60 pt-2">
                      <div className="flex justify-between">
                        <span>Taux de marge :</span>
                        <span className="text-emerald-400 font-semibold">{data.kpi.margin_percent}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Coût d'achat total :</span>
                        <span className="text-white font-medium">{formatDH(data.kpi.total_cogs)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 5: Crédits & Dettes */}
                  <div className="p-4 rounded-2xl bg-surface border border-border relative overflow-hidden group hover:border-amber-500/40 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                        Flux Crédit / Dettes
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
                        <HandCoins className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-amber-300 mb-2">
                      {formatDH(data.kpi.new_debt_granted)}
                    </div>
                    <div className="text-[11px] text-text-secondary space-y-0.5 border-t border-border/60 pt-2">
                      <div className="flex justify-between">
                        <span>Crédits accordés :</span>
                        <span className="text-amber-400 font-medium">+{formatDH(data.kpi.new_debt_granted)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Dettes recouvrées :</span>
                        <span className="text-emerald-400 font-medium">-{formatDH(data.kpi.total_debt_recovered)}</span>
                      </div>
                    </div>
                  </div>
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
                          <h3 className="text-sm font-bold text-white">Rayon Téléphones</h3>
                          <p className="text-[11px] text-text-secondary">Appareils et smartphones vendus</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-300">
                        {data.breakdown.devices.units} pcs
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-text-secondary">Chiffre d'Affaires Téléphones :</span>
                        <span className="font-semibold text-white">{formatDH(data.breakdown.devices.revenue)}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-text-secondary">Coût d'Achat :</span>
                        <span className="text-white">{formatDH(data.breakdown.devices.cost)}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-text-secondary font-medium">Bénéfice Réalisé :</span>
                        <span className="font-bold text-emerald-400">+{formatDH(data.breakdown.devices.profit)}</span>
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
                          <h3 className="text-sm font-bold text-white">Rayon Accessoires</h3>
                          <p className="text-[11px] text-text-secondary">Chargeurs, écouteurs, coques, etc.</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gold/15 text-gold">
                        {data.breakdown.accessories.units} pcs
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-text-secondary">Chiffre d'Affaires Accessoires :</span>
                        <span className="font-semibold text-white">{formatDH(data.breakdown.accessories.revenue)}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-text-secondary">Coût d'Achat :</span>
                        <span className="text-white">{formatDH(data.breakdown.accessories.cost)}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-text-secondary font-medium">Bénéfice Réalisé :</span>
                        <span className="font-bold text-emerald-400">+{formatDH(data.breakdown.accessories.profit)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Top Produits */}
                  <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Award className="w-4 h-4 text-gold" />
                        <h3 className="text-sm font-bold text-white">Top Ventes de la Période</h3>
                      </div>
                      {data.top_products.length === 0 ? (
                        <p className="text-xs text-text-secondary py-6 text-center">Aucune vente enregistrée.</p>
                      ) : (
                        <div className="space-y-2">
                          {data.top_products.slice(0, 4).map((tp, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                              <div className="truncate pr-2">
                                <span className="font-bold text-gold mr-1.5">#{idx + 1}</span>
                                <span className="text-white font-medium">{tp.name}</span>
                              </div>
                              <div className="text-right whitespace-nowrap">
                                <div className="text-white font-semibold">{formatDH(tp.revenue)}</div>
                                <div className="text-[10px] text-text-secondary">{tp.quantity} vendus</div>
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
                          : 'border-transparent text-text-secondary hover:text-white'
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
                          : 'border-transparent text-text-secondary hover:text-white'
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
                          : 'border-transparent text-text-secondary hover:text-white'
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
                        <thead className="bg-bg text-text-secondary border-b border-border">
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
                              <td colSpan={8} className="py-8 text-center text-text-secondary">
                                Aucune vente complétée sur cette période.
                              </td>
                            </tr>
                          ) : (
                            data.sales.map((sale) => (
                              <tr key={sale.id} className="hover:bg-surface-hover/50 transition-colors">
                                <td className="py-3 px-6 text-text-secondary font-mono flex items-center gap-1.5">
                                  <Clock className="w-3 h-3 text-gold" />
                                  {formatDateTime(sale.created_at)}
                                </td>
                                <td className="py-3 px-4 font-mono font-medium text-white">
                                  {sale.receipt_id}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-medium text-white">{sale.customer_name}</div>
                                  {sale.customer_phone && (
                                    <div className="text-[10px] text-text-secondary">{sale.customer_phone}</div>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 rounded-md bg-bg text-text-secondary border border-border">
                                    {sale.items_count} art.
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-emerald-400">
                                  {Number(sale.cash_amount) > 0 ? formatDH(sale.cash_amount) : '—'}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-cyan-400">
                                  {Number(sale.transfer_amount) > 0 ? formatDH(sale.transfer_amount) : '—'}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-amber-400">
                                  {Number(sale.debt_amount) > 0 ? formatDH(sale.debt_amount) : '—'}
                                </td>
                                <td className="py-3 px-6 text-right font-bold text-white">
                                  {formatDH(sale.total_amount)}
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
                        <thead className="bg-bg text-text-secondary border-b border-border">
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
                              <td colSpan={6} className="py-8 text-center text-text-secondary">
                                Aucun remboursement de dette enregistré sur cette période.
                              </td>
                            </tr>
                          ) : (
                            data.debt_repayments.map((dp) => (
                              <tr key={dp.id} className="hover:bg-surface-hover/50 transition-colors">
                                <td className="py-3 px-6 text-text-secondary font-mono flex items-center gap-1.5">
                                  <Clock className="w-3 h-3 text-emerald-400" />
                                  {formatDateTime(dp.created_at)}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-medium text-white">{dp.customer_name}</div>
                                  <div className="text-[10px] text-text-secondary">{dp.customer_phone}</div>
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
                                <td className="py-3 px-4 text-text-secondary italic">
                                  {dp.notes || 'Règlement carnet crédit'}
                                </td>
                                <td className="py-3 px-4 text-text-secondary flex items-center gap-1.5">
                                  <UserCheck className="w-3 h-3 text-gold" />
                                  {dp.operator || 'Caissier'}
                                </td>
                                <td className="py-3 px-6 text-right font-bold text-emerald-400 text-sm">
                                  +{formatDH(dp.amount)}
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
                        <thead className="bg-bg text-text-secondary border-b border-border">
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
                              <td colSpan={6} className="py-8 text-center text-text-secondary">
                                Aucun article vendu sur cette période.
                              </td>
                            </tr>
                          ) : (
                            data.top_products.map((p, idx) => (
                              <tr key={idx} className="hover:bg-surface-hover/50 transition-colors">
                                <td className="py-3 px-6 font-bold text-gold">#{idx + 1}</td>
                                <td className="py-3 px-4 font-semibold text-white">{p.name}</td>
                                <td className="py-3 px-4 font-mono text-text-secondary">{p.sku}</td>
                                <td className="py-3 px-4 text-center font-bold text-white">{p.quantity}</td>
                                <td className="py-3 px-4 text-right font-medium text-emerald-400">
                                  +{formatDH(p.profit)}
                                </td>
                                <td className="py-3 px-6 text-right font-bold text-white">
                                  {formatDH(p.revenue)}
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
        </div>
      </div>
    </div>
  );
}
