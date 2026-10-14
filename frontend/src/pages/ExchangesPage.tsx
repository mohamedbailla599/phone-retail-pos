import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ArrowLeftRight, 
  Plus, 
  Search, 
  Loader2, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Scale, 
  Check, 
  Send, 
  X,
  Coins,
  CheckCircle2,
  Printer
} from 'lucide-react';
import { exchangeApi } from '../api/exchanges';
import type { Exchange } from '../api/exchanges';
import Sidebar from '../components/layout/Sidebar';
import { CreateExchangeModal } from '../components/exchanges/CreateExchangeModal';
import { SettleExchangeModal } from '../components/exchanges/SettleExchangeModal';
import ExchangeReceiptPrint, { printExchangeReceipt } from '../components/exchanges/ExchangeReceiptPrint';
import OperatorSelectionModal from '../components/ui/OperatorSelectionModal';
import { useRequireOperator } from '../hooks/useRequireOperator';
import { useAuthStore } from '../store/authStore';

export function ExchangesPage() {
  const { operator } = useAuthStore();
  const { 
    isOperatorModalOpen, 
    handleOperatorRequired, 
    onOperatorSelected, 
    onOperatorModalClose 
  } = useRequireOperator();

  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedSettleExchange, setSelectedSettleExchange] = useState<Exchange | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const fetchExchanges = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await exchangeApi.getExchanges();
      setExchanges(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load exchanges');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExchanges();
  }, [fetchExchanges]);

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat('en-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 2,
    }).format(Number(value));
  };

  const filteredExchanges = useMemo(() => {
    return exchanges.filter((item) => {
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        item.exchange_number.toLowerCase().includes(q) ||
        (item.customer_name && item.customer_name.toLowerCase().includes(q)) ||
        (item.customer_phone && item.customer_phone.toLowerCase().includes(q)) ||
        (item.trade_in_imei && item.trade_in_imei.toLowerCase().includes(q)) ||
        (item.new_device_imei_1 && item.new_device_imei_1.toLowerCase().includes(q)) ||
        (item.trade_in_product_name && item.trade_in_product_name.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [exchanges, statusFilter, search]);

  const handleSubmitForReview = async (exchangeId: number) => {
    setActionLoadingId(exchangeId);
    try {
      await exchangeApi.submitExchange(exchangeId);
      await fetchExchanges();
    } catch (err: any) {
      if (!handleOperatorRequired(err, () => handleSubmitForReview(exchangeId))) {
        alert(err.response?.data?.detail || err.message || 'Failed to submit exchange for review');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApprove = async (exchangeId: number) => {
    setActionLoadingId(exchangeId);
    try {
      await exchangeApi.approveExchange(exchangeId);
      await fetchExchanges();
    } catch (err: any) {
      if (!handleOperatorRequired(err, () => handleApprove(exchangeId))) {
        alert(err.response?.data?.detail || err.message || 'Failed to approve exchange');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (exchangeId: number) => {
    const reason = prompt('Please enter the reason for rejection (optional):');
    if (reason === null) return; // User cancelled prompt

    setActionLoadingId(exchangeId);
    try {
      await exchangeApi.rejectExchange(exchangeId, reason);
      await fetchExchanges();
    } catch (err: any) {
      if (!handleOperatorRequired(err, () => handleReject(exchangeId))) {
        alert(err.response?.data?.detail || err.message || 'Failed to reject exchange');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Status statistics
  const stats = useMemo(() => {
    return {
      total: exchanges.length,
      requested: exchanges.filter(e => e.status === 'REQUESTED').length,
      underReview: exchanges.filter(e => e.status === 'UNDER_REVIEW').length,
      approved: exchanges.filter(e => e.status === 'APPROVED').length,
      completed: exchanges.filter(e => e.status === 'COMPLETED').length,
    };
  }, [exchanges]);

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
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text tracking-tight flex items-center gap-2">
                Device Exchanges & Trade-Ins
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                Trade-in intake, phone replacements, and valuation settlements
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="h-10 px-4 bg-gold hover:bg-gold-bright text-black font-semibold rounded-[var(--radius-md)] flex items-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" />
              New Exchange
            </button>
          </div>
        </header>

        {/* Workspace Body */}
        <div className="flex-1 overflow-auto p-8 space-y-6">
          <div className="max-w-[1400px] mx-auto space-y-6">

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div 
                onClick={() => setStatusFilter('ALL')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  statusFilter === 'ALL' ? 'bg-surface-elevated border-gold/40' : 'bg-surface border-border hover:bg-surface-alt'
                }`}
              >
                <div className="text-[11px] text-text-muted uppercase">Total</div>
                <div className="text-lg font-bold text-text mt-0.5">{stats.total}</div>
              </div>
              <div 
                onClick={() => setStatusFilter('REQUESTED')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  statusFilter === 'REQUESTED' ? 'bg-surface-elevated border-warning/40' : 'bg-surface border-border hover:bg-surface-alt'
                }`}
              >
                <div className="text-[11px] text-warning uppercase">Requested</div>
                <div className="text-lg font-bold text-warning mt-0.5">{stats.requested}</div>
              </div>
              <div 
                onClick={() => setStatusFilter('UNDER_REVIEW')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  statusFilter === 'UNDER_REVIEW' ? 'bg-surface-elevated border-blue-400/40' : 'bg-surface border-border hover:bg-surface-alt'
                }`}
              >
                <div className="text-[11px] text-blue-400 uppercase">Under Review</div>
                <div className="text-lg font-bold text-blue-400 mt-0.5">{stats.underReview}</div>
              </div>
              <div 
                onClick={() => setStatusFilter('APPROVED')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  statusFilter === 'APPROVED' ? 'bg-surface-elevated border-emerald-400/40' : 'bg-surface border-border hover:bg-surface-alt'
                }`}
              >
                <div className="text-[11px] text-emerald-400 uppercase">Approved</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">{stats.approved}</div>
              </div>
              <div 
                onClick={() => setStatusFilter('COMPLETED')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  statusFilter === 'COMPLETED' ? 'bg-surface-elevated border-text-secondary/40' : 'bg-surface border-border hover:bg-surface-alt'
                }`}
              >
                <div className="text-[11px] text-text-muted uppercase">Completed</div>
                <div className="text-lg font-bold text-text-secondary mt-0.5">{stats.completed}</div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by number, customer, phone, IMEI..."
                  className="w-full pl-10 pr-4 h-10 bg-surface-alt border border-border rounded-[var(--radius-md)] text-sm text-text placeholder-text-muted focus:outline-none focus:border-gold-border focus:ring-2 focus:ring-gold/20 transition-all"
                />
              </div>

              {/* Status Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {['ALL', 'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      statusFilter === st
                        ? 'bg-gold text-black font-semibold'
                        : 'bg-surface-alt text-text-secondary hover:text-text hover:bg-surface-elevated'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-4 rounded-xl bg-danger-bg border border-danger/30 text-danger text-sm">
                {error}
              </div>
            )}

            {/* Table or Empty State */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                  <Loader2 className="w-8 h-8 animate-spin text-gold mb-3" />
                  <p className="text-sm">Loading exchanges and trade-ins...</p>
                </div>
              ) : filteredExchanges.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <div className="w-14 h-14 rounded-2xl bg-surface-alt border border-border flex items-center justify-center text-text-muted mb-4">
                    <ArrowLeftRight className="w-7 h-7 text-text-muted" />
                  </div>
                  <h3 className="text-base font-semibold text-text">No exchanges found</h3>
                  <p className="text-xs text-text-muted mt-1 max-w-sm">
                    {search || statusFilter !== 'ALL' 
                      ? 'No exchange records matched your filter criteria.'
                      : 'Create your first trade-in / device exchange request.'}
                  </p>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-5 h-9 px-4 bg-gold hover:bg-gold-bright text-black text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Exchange
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-alt border-b border-border text-text-muted uppercase text-[11px] tracking-wider">
                      <tr>
                        <th className="px-5 py-3.5 font-semibold">Exchange</th>
                        <th className="px-5 py-3.5 font-semibold">Customer</th>
                        <th className="px-5 py-3.5 font-semibold">Trade-In Phone</th>
                        <th className="px-5 py-3.5 font-semibold">Replacement Phone</th>
                        <th className="px-5 py-3.5 font-semibold text-center">Settlement</th>
                        <th className="px-5 py-3.5 font-semibold text-center">Status</th>
                        <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 text-text">
                      {filteredExchanges.map((ex) => {
                        const isActionLoading = actionLoadingId === ex.id;

                        return (
                          <tr key={ex.id} className="hover:bg-surface-hover/50 transition-colors">
                            {/* Exchange Number & Date */}
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="font-semibold text-gold font-mono">{ex.exchange_number}</div>
                              <div className="text-[11px] text-text-muted mt-0.5">
                                {new Date(ex.requested_at || ex.created_at).toLocaleDateString()}
                              </div>
                            </td>

                            {/* Customer */}
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="font-medium text-text">{ex.customer_name || 'Walk-in Customer'}</div>
                              <div className="text-[11px] text-text-muted font-mono mt-0.5">
                                {ex.customer_phone || 'No phone'}
                              </div>
                            </td>

                            {/* Trade-In Phone */}
                            <td className="px-5 py-4">
                              <div className="font-medium text-text">{ex.trade_in_product_name || 'Trade-in Phone'}</div>
                              <div className="text-[11px] font-mono text-text-muted mt-0.5 truncate max-w-[160px]">
                                IMEI: {ex.trade_in_imei}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-alt border border-border-subtle text-text-secondary">
                                  Grade {ex.trade_in_condition}
                                </span>
                                {ex.trade_in_battery_health && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-alt border border-border-subtle text-text-secondary">
                                    {ex.trade_in_battery_health}% Batt
                                  </span>
                                )}
                                <span className="text-[10px] font-semibold text-gold">
                                  Val: {formatCurrency(ex.trade_in_value)}
                                </span>
                              </div>
                            </td>

                            {/* Replacement Phone */}
                            <td className="px-5 py-4">
                              <div className="font-medium text-text">Device #{ex.new_device}</div>
                              <div className="text-[11px] font-mono text-text-muted mt-0.5 truncate max-w-[160px]">
                                IMEI: {ex.new_device_imei_1 || 'N/A'}
                              </div>
                              <div className="text-[11px] font-semibold text-emerald-400 mt-1">
                                Price: {formatCurrency(ex.new_device_price)}
                              </div>
                            </td>

                            {/* Settlement Direction & Difference */}
                            <td className="px-5 py-4 text-center whitespace-nowrap">
                              <div className="text-sm font-bold text-text">
                                {formatCurrency(ex.difference_amount)}
                              </div>
                              <div className="mt-1">
                                {ex.financial_direction === 'CUSTOMER_PAYS' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <ArrowDownLeft className="w-3 h-3" />
                                    Customer Pays
                                  </span>
                                )}
                                {ex.financial_direction === 'STORE_REFUNDS' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    <ArrowUpRight className="w-3 h-3" />
                                    Store Refunds
                                  </span>
                                )}
                                {ex.financial_direction === 'EVEN' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-gold/10 text-gold border border-gold-border/30">
                                    <Scale className="w-3 h-3" />
                                    Even
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-5 py-4 text-center whitespace-nowrap">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                                ex.status === 'REQUESTED' ? 'bg-warning-bg text-warning border border-warning/30' :
                                ex.status === 'UNDER_REVIEW' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                                ex.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                                ex.status === 'COMPLETED' ? 'bg-surface-alt text-text-secondary border border-border' :
                                'bg-danger-bg text-danger border border-danger/30'
                              }`}>
                                {ex.status.replace('_', ' ')}
                              </span>
                            </td>

                            {/* Lifecycle Actions */}
                            <td className="px-5 py-4 text-right whitespace-nowrap">
                              {isActionLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-gold inline-block" />
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  {ex.status === 'REQUESTED' && (
                                    <button
                                      onClick={() => handleSubmitForReview(ex.id)}
                                      className="px-2.5 py-1 rounded bg-surface-alt hover:bg-surface-elevated text-text text-[11px] font-medium border border-border flex items-center gap-1 transition-colors"
                                      title="Submit for Owner Review"
                                    >
                                      <Send className="w-3 h-3 text-gold" />
                                      Review
                                    </button>
                                  )}

                                  {ex.status === 'UNDER_REVIEW' && (
                                    <>
                                      <button
                                        onClick={() => handleApprove(ex.id)}
                                        className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold border border-emerald-500/30 flex items-center gap-1 transition-colors"
                                        title="Approve Exchange"
                                      >
                                        <Check className="w-3 h-3" />
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleReject(ex.id)}
                                        className="px-2 py-1 rounded bg-danger-bg hover:bg-danger/20 text-danger text-[11px] font-medium border border-danger/30 flex items-center gap-1 transition-colors"
                                        title="Reject Exchange"
                                      >
                                        <X className="w-3 h-3" />
                                        Reject
                                      </button>
                                    </>
                                  )}

                                  {ex.status === 'APPROVED' && (
                                    <button
                                      onClick={() => setSelectedSettleExchange(ex)}
                                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold border border-emerald-500/40 flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                                      title="Settle Payment/Refund and Complete Exchange"
                                    >
                                      <Coins className="w-3.5 h-3.5" />
                                      Settle & Complete
                                    </button>
                                  )}

                                  {ex.status === 'COMPLETED' && (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => printExchangeReceipt(ex, operator)}
                                        className="px-2.5 py-1 rounded bg-gold/15 hover:bg-gold/25 text-gold text-[11px] font-semibold border border-gold-border flex items-center gap-1 transition-all shadow-sm"
                                        title="Print Thermal Receipt"
                                      >
                                        <Printer className="w-3 h-3" />
                                        Receipt
                                      </button>
                                      <button
                                        onClick={() => setSelectedSettleExchange(ex)}
                                        className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                                        title="View Exchange Summary & Details"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        Completed
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* New Exchange Modal */}
      <CreateExchangeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          fetchExchanges();
        }}
      />

      {/* Settle & Complete Exchange Modal */}
      <SettleExchangeModal
        isOpen={Boolean(selectedSettleExchange)}
        onClose={() => setSelectedSettleExchange(null)}
        exchange={selectedSettleExchange}
        onSuccess={() => {
          fetchExchanges();
        }}
      />

      {/* Operator Selection fallback modal */}
      <OperatorSelectionModal
        isOpen={isOperatorModalOpen}
        onClose={onOperatorModalClose}
        onSelect={onOperatorSelected}
      />

      {/* Fallback Thermal Receipt Print for ExchangesPage */}
      <ExchangeReceiptPrint
        exchange={selectedSettleExchange}
        operator={operator}
      />
    </div>
  );
}
export default ExchangesPage;
