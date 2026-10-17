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
import { CreateExchangeModal } from '../components/exchanges/CreateExchangeModal';
import { SettleExchangeModal } from '../components/exchanges/SettleExchangeModal';
import ExchangeReceiptPrint, { printExchangeReceipt } from '../components/exchanges/ExchangeReceiptPrint';
import OperatorSelectionModal from '../components/ui/OperatorSelectionModal';
import { useRequireOperator } from '../hooks/useRequireOperator';
import { useAuthStore } from '../store/authStore';
import PageContainer from '../components/ui/PageContainer';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { formatCurrency, formatDate } from '../utils/formatters';

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
      setError(err.response?.data?.detail || err.message || 'Impossible de charger les échanges');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExchanges();
  }, [fetchExchanges]);

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
        alert(err.response?.data?.detail || err.message || "Échec de la soumission de l'échange");
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
        alert(err.response?.data?.detail || err.message || "Échec de l'approbation de l'échange");
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (exchangeId: number) => {
    const reason = prompt('Veuillez indiquer le motif du rejet (facultatif) :');
    if (reason === null) return;

    setActionLoadingId(exchangeId);
    try {
      await exchangeApi.rejectExchange(exchangeId, reason);
      await fetchExchanges();
    } catch (err: any) {
      if (!handleOperatorRequired(err, () => handleReject(exchangeId))) {
        alert(err.response?.data?.detail || err.message || "Échec du rejet de l'échange");
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
    <PageContainer
      header={
        <PageHeader
          title="Échanges & Reprises d'Appareils"
          subtitle="Reprise d'anciens appareils, attribution des modèles neufs et régularisation financière"
          icon={ArrowLeftRight}
          badge={
            <span className="text-xs font-mono font-semibold text-gold px-2.5 py-0.5 rounded-full bg-gold/10 border border-gold-border">
              {exchanges.length} échange{exchanges.length !== 1 ? 's' : ''}
            </span>
          }
          actions={
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="h-9 px-4 bg-gold hover:bg-gold-light text-bg font-bold rounded-lg text-xs flex items-center gap-2 shadow-lg shadow-gold/10 transition-all hover:scale-[1.02] active:scale-[0.98] focus-ring"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvel Échange</span>
            </button>
          }
        />
      }
    >
      <div className="space-y-6">
        {/* Quick Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard
            label="Total Échanges"
            value={stats.total}
            subValue="Toutes périodes"
            icon={ArrowLeftRight}
            variant="neutral"
            onClick={() => setStatusFilter('ALL')}
            className={statusFilter === 'ALL' ? 'ring-2 ring-gold/40 cursor-pointer' : 'cursor-pointer'}
          />
          <StatCard
            label="En Attente"
            value={stats.requested}
            subValue="À soumettre"
            icon={Coins}
            variant="amber"
            onClick={() => setStatusFilter('REQUESTED')}
            className={statusFilter === 'REQUESTED' ? 'ring-2 ring-amber-400/40 cursor-pointer' : 'cursor-pointer'}
          />
          <StatCard
            label="En Examen"
            value={stats.underReview}
            subValue="Validation requise"
            icon={Scale}
            variant="blue"
            onClick={() => setStatusFilter('UNDER_REVIEW')}
            className={statusFilter === 'UNDER_REVIEW' ? 'ring-2 ring-blue-400/40 cursor-pointer' : 'cursor-pointer'}
          />
          <StatCard
            label="Approuvés"
            value={stats.approved}
            subValue="Prêts à régler"
            icon={CheckCircle2}
            variant="emerald"
            onClick={() => setStatusFilter('APPROVED')}
            className={statusFilter === 'APPROVED' ? 'ring-2 ring-emerald-400/40 cursor-pointer' : 'cursor-pointer'}
          />
          <StatCard
            label="Clôturés"
            value={stats.completed}
            subValue="Finalisés & soldés"
            icon={CheckCircle2}
            variant="neutral"
            onClick={() => setStatusFilter('COMPLETED')}
            className={statusFilter === 'COMPLETED' ? 'ring-2 ring-gold/40 cursor-pointer' : 'cursor-pointer'}
          />
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par N°, client, téléphone, IMEI..."
              className="w-full pl-10 pr-4 h-9 bg-surface-elevated border border-border rounded-lg text-xs text-text placeholder-text-muted focus:outline-none focus:border-gold transition-all focus-ring"
            />
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { value: 'ALL', label: 'Tous' },
              { value: 'REQUESTED', label: 'Demandé' },
              { value: 'UNDER_REVIEW', label: 'En examen' },
              { value: 'APPROVED', label: 'Approuvé' },
              { value: 'COMPLETED', label: 'Clôturé' },
              { value: 'REJECTED', label: 'Rejeté' },
            ].map((st) => (
              <button
                key={st.value}
                onClick={() => setStatusFilter(st.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-ring ${
                  statusFilter === st.value
                    ? 'bg-gold text-bg font-bold shadow-sm'
                    : 'bg-surface-elevated text-text-secondary hover:text-text hover:bg-white/5 border border-border'
                }`}
              >
                {st.label}
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
                  <p className="text-sm">Chargement des échanges et reprises...</p>
                </div>
              ) : filteredExchanges.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <div className="w-14 h-14 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center text-text-muted mb-4">
                    <ArrowLeftRight className="w-7 h-7 text-text-muted" />
                  </div>
                  <h3 className="text-base font-semibold text-text">Aucun échange trouvé</h3>
                  <p className="text-xs text-text-muted mt-1 max-w-sm">
                    {search || statusFilter !== 'ALL' 
                      ? 'Aucun enregistrement ne correspond à vos critères de recherche.'
                      : 'Créez votre première demande de reprise ou d\'échange.'}
                  </p>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-5 h-9 px-4 bg-gold hover:bg-gold-light text-bg text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors focus-ring"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nouvel Échange
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-elevated/60 border-b border-border text-text-secondary uppercase text-[11px] tracking-wider font-semibold">
                      <tr>
                        <th className="px-5 py-3.5">Échange</th>
                        <th className="px-5 py-3.5">Client & Contact</th>
                        <th className="px-5 py-3.5">Appareil Repris</th>
                        <th className="px-5 py-3.5">Nouvel Appareil</th>
                        <th className="px-5 py-3.5 text-right">Régularisation</th>
                        <th className="px-5 py-3.5 text-center">Statut</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-text">
                      {filteredExchanges.map((ex) => {
                        const isActionLoading = actionLoadingId === ex.id;

                        return (
                          <tr key={ex.id} className="hover:bg-white/[0.02] transition-colors group">
                            {/* Exchange Number & Date */}
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="font-semibold text-text group-hover:text-gold font-mono transition-colors">
                                {ex.exchange_number}
                              </div>
                              <div className="text-[11px] text-text-muted mt-0.5">
                                {formatDate(ex.requested_at || ex.created_at)}
                              </div>
                            </td>

                            {/* Customer */}
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="font-medium text-text">{ex.customer_name || 'Client de passage'}</div>
                              <div className="text-[11px] text-text-muted font-mono mt-0.5">
                                {ex.customer_phone || 'Sans contact'}
                              </div>
                            </td>

                            {/* Trade-In Phone */}
                            <td className="px-5 py-4">
                              <div className="font-medium text-text">{ex.trade_in_product_name || 'Appareil repris'}</div>
                              <div className="text-[11px] font-mono text-text-muted mt-0.5 truncate max-w-[160px]">
                                IMEI: {ex.trade_in_imei}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-text-secondary">
                                  Grade {ex.trade_in_condition}
                                </span>
                                {ex.trade_in_battery_health && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-text-secondary">
                                    {ex.trade_in_battery_health}% Batt
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-gold tabular-nums">
                                  Val: {formatCurrency(Number(ex.trade_in_value))}
                                </span>
                              </div>
                            </td>

                            {/* Replacement Phone */}
                            <td className="px-5 py-4">
                              <div className="font-medium text-text">Appareil #{ex.new_device}</div>
                              <div className="text-[11px] font-mono text-text-muted mt-0.5 truncate max-w-[160px]">
                                IMEI: {ex.new_device_imei_1 || '—'}
                              </div>
                              <div className="text-[11px] font-bold text-emerald-400 mt-1 tabular-nums">
                                Prix: {formatCurrency(Number(ex.new_device_price))}
                              </div>
                            </td>

                            {/* Settlement Direction & Difference */}
                            <td className="px-5 py-4 text-right whitespace-nowrap">
                              <div className="text-sm font-bold text-text tabular-nums">
                                {formatCurrency(Number(ex.difference_amount))}
                              </div>
                              <div className="mt-1 flex justify-end">
                                {ex.financial_direction === 'CUSTOMER_PAYS' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <ArrowDownLeft className="w-3 h-3" />
                                    Client verse
                                  </span>
                                )}
                                {ex.financial_direction === 'STORE_REFUNDS' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    <ArrowUpRight className="w-3 h-3" />
                                    Boutique rembourse
                                  </span>
                                )}
                                {ex.financial_direction === 'EVEN' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-gold/10 text-gold border border-gold-border/30">
                                    <Scale className="w-3 h-3" />
                                    Équitable (0 DH)
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-5 py-4 text-center whitespace-nowrap">
                              <StatusBadge status={ex.status} />
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
                                      className="px-2.5 py-1 rounded bg-surface-elevated hover:bg-white/10 text-text text-[11px] font-medium border border-border flex items-center gap-1 transition-colors focus-ring"
                                      title="Soumettre pour validation responsable"
                                    >
                                      <Send className="w-3 h-3 text-gold" />
                                      Soumettre
                                    </button>
                                  )}

                                  {ex.status === 'UNDER_REVIEW' && (
                                    <>
                                      <button
                                        onClick={() => handleApprove(ex.id)}
                                        className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold border border-emerald-500/30 flex items-center gap-1 transition-colors focus-ring"
                                        title="Approuver l'échange"
                                      >
                                        <Check className="w-3 h-3" />
                                        Approuver
                                      </button>
                                      <button
                                        onClick={() => handleReject(ex.id)}
                                        className="px-2 py-1 rounded bg-danger/10 hover:bg-danger/20 text-danger text-[11px] font-medium border border-danger/30 flex items-center gap-1 transition-colors focus-ring"
                                        title="Rejeter l'échange"
                                      >
                                        <X className="w-3 h-3" />
                                        Rejeter
                                      </button>
                                    </>
                                  )}

                                  {ex.status === 'APPROVED' && (
                                    <button
                                      onClick={() => setSelectedSettleExchange(ex)}
                                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold border border-emerald-500/40 flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)] focus-ring"
                                      title="Régulariser paiement/remboursement et finaliser l'échange"
                                    >
                                      <Coins className="w-3.5 h-3.5" />
                                      Régulariser
                                    </button>
                                  )}

                                  {ex.status === 'COMPLETED' && (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => printExchangeReceipt(ex, operator)}
                                        className="px-2.5 py-1 rounded bg-gold/15 hover:bg-gold/25 text-gold text-[11px] font-semibold border border-gold-border flex items-center gap-1 transition-all shadow-sm focus-ring"
                                        title="Imprimer le ticket thermique"
                                      >
                                        <Printer className="w-3 h-3" />
                                        Ticket
                                      </button>
                                      <button
                                        onClick={() => setSelectedSettleExchange(ex)}
                                        className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors focus-ring"
                                        title="Voir le récapitulatif de l'échange"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        Détails
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
    </PageContainer>
  );
}
export default ExchangesPage;
