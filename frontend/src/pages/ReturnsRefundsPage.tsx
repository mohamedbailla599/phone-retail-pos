import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import {
  returnsApi,
  type ReturnRecord,
  type RefundRecord,
  type ReturnStatus,
  type RefundStatus,
} from '../api/returns';
import CreateReturnModal from '../components/returns/CreateReturnModal';
import ProcessReturnModal, { type ReturnActionType } from '../components/returns/ProcessReturnModal';
import {
  RotateCcw,
  Plus,
  Search,
  Receipt,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Coins,
  PackageCheck,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

export default function ReturnsRefundsPage() {
  const [activeTab, setActiveTab] = useState<'returns' | 'refunds'>('returns');

  // Data states
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [returnStatusFilter, setReturnStatusFilter] = useState<string>('ALL');
  const [refundStatusFilter, setRefundStatusFilter] = useState<string>('ALL');

  // Modals state
  const [isCreateReturnOpen, setIsCreateReturnOpen] = useState(false);
  const [selectedReturnForAction, setSelectedReturnForAction] = useState<ReturnRecord | null>(null);
  const [returnActionType, setReturnActionType] = useState<ReturnActionType>('APPROVE');
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);

  // Refund direct actions
  const [processingRefundId, setProcessingRefundId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [returnsRes, refundsRes] = await Promise.allSettled([
        returnsApi.getReturns(),
        returnsApi.getRefunds(),
      ]);

      if (returnsRes.status === 'fulfilled') {
        setReturns(returnsRes.value);
      } else {
        console.error('Failed to load returns', returnsRes.reason);
      }

      if (refundsRes.status === 'fulfilled') {
        setRefunds(refundsRes.value);
      } else {
        console.error('Failed to load refunds', refundsRes.reason);
      }

      if (returnsRes.status === 'rejected' && refundsRes.status === 'rejected') {
        setError('Impossible de charger les données des retours et remboursements.');
      }
    } catch (err: any) {
      console.error('Failed to load returns and refunds', err);
      setError('Impossible de charger les données.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle return action modal trigger
  const triggerReturnAction = (ret: ReturnRecord, type: ReturnActionType) => {
    setSelectedReturnForAction(ret);
    setReturnActionType(type);
    setIsProcessModalOpen(true);
  };

  // Direct refund actions
  const handleApproveRefund = async (refundId: number) => {
    setProcessingRefundId(refundId);
    try {
      await returnsApi.approveRefund(refundId);
      loadData();
    } catch (err: any) {
      console.error('Failed to approve refund', err);
      alert(err.response?.data?.detail || "Échec de l'approbation du remboursement.");
    } finally {
      setProcessingRefundId(null);
    }
  };

  const handleCompleteRefund = async (refundId: number) => {
    setProcessingRefundId(refundId);
    try {
      await returnsApi.completeRefund(refundId);
      loadData();
    } catch (err: any) {
      console.error('Failed to complete refund', err);
      alert(err.response?.data?.detail || 'Échec de la clôture du remboursement.');
    } finally {
      setProcessingRefundId(null);
    }
  };

  // Metrics calculation
  const totalReturnsCount = returns.length;
  const pendingReturnsCount = returns.filter((r) => r.status === 'REQUESTED').length;
  const restockedCount = returns.filter(
    (r) => r.status === 'RESTOCKED' || r.status === 'REFUNDED'
  ).length;

  const totalRefundedAmount = refunds
    .filter((rf) => rf.status === 'COMPLETED')
    .reduce((sum, rf) => sum + parseFloat(rf.amount || '0'), 0);

  // Filtered returns
  const filteredReturns = returns.filter((ret) => {
    const matchSearch =
      !searchQuery.trim() ||
      ret.return_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.receipt_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.customer_phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.items?.some((i) => i.product_name?.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchStatus =
      returnStatusFilter === 'ALL' || ret.status === returnStatusFilter;

    return matchSearch && matchStatus;
  });

  // Filtered refunds
  const filteredRefunds = refunds.filter((rf) => {
    const matchSearch =
      !searchQuery.trim() ||
      rf.refund_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rf.source_label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rf.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rf.customer_phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rf.reference?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus =
      refundStatusFilter === 'ALL' || rf.status === refundStatusFilter;

    return matchSearch && matchStatus;
  });

  const getReturnStatusBadge = (status: ReturnStatus) => {
    switch (status) {
      case 'REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            En attente
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Approuvé
          </span>
        );
      case 'RESTOCKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <PackageCheck className="w-3 h-3" />
            Restocké
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Coins className="w-3 h-3" />
            Remboursé
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            Rejeté
          </span>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getRefundStatusBadge = (status: RefundStatus) => {
    switch (status) {
      case 'REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Demandé
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Approuvé (À décaisser)
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Coins className="w-3 h-3" />
            Clôturé (Décaissé)
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            Rejeté
          </span>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto space-y-6 w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold-border flex items-center justify-center text-gold shadow-[0_0_15px_rgba(212,175,90,0.15)]">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text flex items-center gap-2">
                  Retours & Remboursements
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gold/15 text-gold border border-gold-border font-medium">
                    SAV
                  </span>
                </h1>
                <p className="text-xs text-text-muted mt-0.5">
                  Gestion des retours articles, réintégrations au stock et sorties de caisse
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={loadData}
                loading={loading}
                className="gap-1.5 text-xs h-9"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Actualiser
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateReturnOpen(true)}
                className="gap-1.5 text-xs h-9"
              >
                <Plus className="w-4 h-4" />
                Nouveau Retour
              </Button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-surface border border-border flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                  Total Retours
                </span>
                <span className="text-xl font-extrabold text-text mt-1 block">
                  {totalReturnsCount}
                </span>
                <span className="text-[10px] text-text-muted mt-0.5 block">
                  Toutes périodes
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-text-secondary">
                <RotateCcw className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-border flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                  En Attente d'Action
                </span>
                <span className="text-xl font-extrabold text-amber-400 mt-1 block">
                  {pendingReturnsCount}
                </span>
                <span className="text-[10px] text-text-muted mt-0.5 block">
                  Nécessitent validation
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-border flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                  Articles Réintégrés
                </span>
                <span className="text-xl font-extrabold text-purple-400 mt-1 block">
                  {restockedCount}
                </span>
                <span className="text-[10px] text-text-muted mt-0.5 block">
                  Remis en stock boutique
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <PackageCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-border flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                  Total Décaissé
                </span>
                <span className="text-xl font-extrabold text-gold mt-1 block font-mono">
                  {totalRefundedAmount.toLocaleString()} DH
                </span>
                <span className="text-[10px] text-emerald-400 mt-0.5 block">
                  Remboursements clôturés
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
                <Coins className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Tab Switcher & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            {/* Tabs */}
            <div className="flex p-1 bg-surface-2 border border-border rounded-xl">
              <button
                onClick={() => setActiveTab('returns')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'returns'
                    ? 'bg-gold/15 text-gold border border-gold-border/60 shadow-[0_0_10px_rgba(212,175,90,0.1)]'
                    : 'text-text-secondary hover:text-text'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retours Articles ({returns.length})
              </button>
              <button
                onClick={() => setActiveTab('refunds')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'refunds'
                    ? 'bg-gold/15 text-gold border border-gold-border/60 shadow-[0_0_10px_rgba(212,175,90,0.1)]'
                    : 'text-text-secondary hover:text-text'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                Remboursements Caisse ({refunds.length})
              </button>
            </div>

            {/* Search & Filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrer par N°, client, ticket..."
                  className="w-full pl-8 pr-3 py-1.5 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-gold"
                />
              </div>

              {activeTab === 'returns' ? (
                <select
                  value={returnStatusFilter}
                  onChange={(e) => setReturnStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-[#171717] border border-border rounded-lg text-xs text-[#F5F5F5] focus:outline-none focus:border-gold cursor-pointer"
                >
                  <option value="ALL" className="bg-[#1a1a1c] text-[#F5F5F5] py-1.5">Tous statuts</option>
                  <option value="REQUESTED" className="bg-[#1a1a1c] text-[#F5F5F5] py-1.5">En attente</option>
                  <option value="APPROVED" className="bg-[#1a1a1c] text-[#F5F5F5] py-1.5">Approuvé</option>
                  <option value="RESTOCKED" className="bg-[#1a1a1c] text-[#F5F5F5] py-1.5">Restocké</option>
                  <option value="REFUNDED" className="bg-[#1a1a1c] text-[#F5F5F5] py-1.5">Remboursé</option>
                  <option value="REJECTED" className="bg-[#1a1a1c] text-[#F5F5F5] py-1.5">Rejeté</option>
                </select>
              ) : (
                <select
                  value={refundStatusFilter}
                  onChange={(e) => setRefundStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-[#171717] border border-border rounded-lg text-xs text-[#F5F5F5] focus:outline-none focus:border-gold cursor-pointer"
                >
                  <option value="ALL" className="bg-[#1a1a1c] text-[#F5F5F5] py-1.5">Tous statuts</option>
                  <option value="REQUESTED" className="bg-[#1a1a1c] text-[#F5F5F5] py-1.5">Demandé</option>
                  <option value="APPROVED" className="bg-[#1a1a1c] text-[#F5F5F5] py-1.5">Approuvé</option>
                  <option value="COMPLETED" className="bg-[#1a1a1c] text-[#F5F5F5] py-1.5">Clôturé</option>
                  <option value="REJECTED" className="bg-[#1a1a1c] text-[#F5F5F5] py-1.5">Rejeté</option>
                </select>
              )}
            </div>
          </div>

          {/* TAB 1: RETURNS TABLE */}
          {activeTab === 'returns' && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-surface-2/60 border-b border-border text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      <th className="py-3 px-4">N° Retour & Date</th>
                      <th className="py-3 px-4">Ticket Vente</th>
                      <th className="py-3 px-4">Client</th>
                      <th className="py-3 px-4">Article Retourné</th>
                      <th className="py-3 px-4">Montant</th>
                      <th className="py-3 px-4">Statut</th>
                      <th className="py-3 px-4">Motif</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredReturns.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-text-muted">
                          Aucun retour trouvé.
                        </td>
                      </tr>
                    ) : (
                      filteredReturns.map((ret) => {
                        const item = ret.items && ret.items.length > 0 ? ret.items[0] : null;

                        return (
                          <tr
                            key={ret.id}
                            className="hover:bg-white/[0.02] transition-colors group"
                          >
                            {/* N° Retour */}
                            <td className="py-3.5 px-4">
                              <span className="font-mono font-bold text-text group-hover:text-gold transition-colors block">
                                {ret.return_number}
                              </span>
                              <span className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3" />
                                {new Date(ret.created_at).toLocaleDateString('fr-FR')}
                              </span>
                            </td>

                            {/* Ticket Vente */}
                            <td className="py-3.5 px-4 font-mono text-text-secondary">
                              <div className="flex items-center gap-1.5">
                                <Receipt className="w-3.5 h-3.5 text-gold/70" />
                                <span>{ret.receipt_id}</span>
                              </div>
                            </td>

                            {/* Client */}
                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-text block">
                                {ret.customer_name}
                              </span>
                              {ret.customer_phone && (
                                <span className="text-[10px] text-text-muted block">
                                  {ret.customer_phone}
                                </span>
                              )}
                            </td>

                            {/* Article */}
                            <td className="py-3.5 px-4 max-w-[220px]">
                              {item ? (
                                <div>
                                  <span className="font-medium text-text block truncate">
                                    {item.product_name}
                                  </span>
                                  <span className="text-[10px] font-mono text-text-muted block truncate">
                                    {item.identifier
                                      ? `IMEI: ${item.identifier}`
                                      : item.sku
                                      ? `SKU: ${item.sku}`
                                      : ''}
                                    {` × ${item.quantity}`}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-text-muted">-</span>
                              )}
                            </td>

                            {/* Montant */}
                            <td className="py-3.5 px-4 font-mono font-bold text-gold">
                              {parseFloat(ret.total_amount).toLocaleString()} DH
                            </td>

                            {/* Statut */}
                            <td className="py-3.5 px-4">
                              {getReturnStatusBadge(ret.status)}
                            </td>

                            {/* Motif */}
                            <td className="py-3.5 px-4 max-w-[180px]">
                              <span
                                className="text-[11px] text-text-secondary truncate block"
                                title={ret.reason}
                              >
                                {ret.reason || '-'}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {ret.status === 'REQUESTED' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => triggerReturnAction(ret, 'APPROVE')}
                                      className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:bg-blue-500/10 transition-colors"
                                      title="Approuver la demande"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      Approuver
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => triggerReturnAction(ret, 'REJECT')}
                                      className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:bg-rose-500/10 transition-colors"
                                      title="Refuser la demande"
                                    >
                                      <XCircle className="w-3 h-3" />
                                      Rejeter
                                    </button>
                                  </>
                                )}

                                {ret.status === 'APPROVED' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => triggerReturnAction(ret, 'RESTOCK')}
                                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-purple-400 hover:text-purple-300 border border-purple-500/30 hover:bg-purple-500/10 transition-colors"
                                      title="Réintégrer en stock boutique"
                                    >
                                      <PackageCheck className="w-3.5 h-3.5" />
                                      Restocker
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => triggerReturnAction(ret, 'REJECT')}
                                      className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:bg-rose-500/10 transition-colors"
                                      title="Refuser la demande"
                                    >
                                      <XCircle className="w-3 h-3" />
                                      Rejeter
                                    </button>
                                  </>
                                )}

                                {ret.status === 'RESTOCKED' && (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => triggerReturnAction(ret, 'ISSUE_REFUND')}
                                    className="h-7 px-2.5 text-[11px] gap-1"
                                    title="Émettre le remboursement caisse"
                                  >
                                    <Coins className="w-3 h-3" />
                                    Rembourser
                                  </Button>
                                )}

                                {ret.status === 'REFUNDED' && (
                                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 justify-end">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Clôturé
                                  </span>
                                )}

                                {ret.status === 'REJECTED' && (
                                  <span className="text-[11px] text-text-muted flex items-center gap-1 justify-end">
                                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                    Rejeté
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: REFUNDS TABLE */}
          {activeTab === 'refunds' && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-surface-2/60 border-b border-border text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      <th className="py-3 px-4">N° Remboursement</th>
                      <th className="py-3 px-4">Source & Référence</th>
                      <th className="py-3 px-4">Client</th>
                      <th className="py-3 px-4">Montant</th>
                      <th className="py-3 px-4">Mode de Paiement</th>
                      <th className="py-3 px-4">Statut</th>
                      <th className="py-3 px-4">Opérateur</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredRefunds.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-text-muted">
                          Aucun remboursement enregistré.
                        </td>
                      </tr>
                    ) : (
                      filteredRefunds.map((rf) => (
                        <tr
                          key={rf.id}
                          className="hover:bg-white/[0.02] transition-colors group"
                        >
                          {/* N° Remboursement */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-text group-hover:text-gold transition-colors block">
                              {rf.refund_number}
                            </span>
                            <span className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              {new Date(rf.requested_at).toLocaleDateString('fr-FR')}
                            </span>
                          </td>

                          {/* Source */}
                          <td className="py-3.5 px-4 font-mono text-text-secondary">
                            <span className="block truncate max-w-[200px]" title={rf.source_label}>
                              {rf.source_label}
                            </span>
                            {rf.reference && (
                              <span className="text-[10px] text-text-muted block">
                                Réf: {rf.reference}
                              </span>
                            )}
                          </td>

                          {/* Client */}
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-text block">
                              {rf.customer_name}
                            </span>
                            {rf.customer_phone && (
                              <span className="text-[10px] text-text-muted block">
                                {rf.customer_phone}
                              </span>
                            )}
                          </td>

                          {/* Montant */}
                          <td className="py-3.5 px-4 font-mono font-bold text-gold">
                            {parseFloat(rf.amount).toLocaleString()} DH
                          </td>

                          {/* Mode */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 text-xs text-text">
                              {rf.method === 'CASH' ? (
                                <>
                                  <Coins className="w-3.5 h-3.5 text-gold" />
                                  Espèces
                                </>
                              ) : (
                                <>
                                  <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                                  Virement
                                </>
                              )}
                            </span>
                          </td>

                          {/* Statut */}
                          <td className="py-3.5 px-4">
                            {getRefundStatusBadge(rf.status)}
                          </td>

                          {/* Opérateur */}
                          <td className="py-3.5 px-4 text-text-secondary text-[11px]">
                            {rf.completed_by_name || rf.requested_by_name || '-'}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {rf.status === 'REQUESTED' && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveRefund(rf.id)}
                                  disabled={processingRefundId === rf.id}
                                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  Approuver
                                </button>
                              )}

                              {rf.status === 'APPROVED' && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleCompleteRefund(rf.id)}
                                  loading={processingRefundId === rf.id}
                                  className="h-7 px-2.5 text-[11px] gap-1"
                                >
                                  <Coins className="w-3 h-3" />
                                  Clôturer Sortie Caisse
                                </Button>
                              )}

                              {rf.status === 'COMPLETED' && (
                                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 justify-end">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Décaissé
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal Création Retour */}
          <CreateReturnModal
            isOpen={isCreateReturnOpen}
            onClose={() => setIsCreateReturnOpen(false)}
            onSuccess={() => {
              loadData();
            }}
          />

          {/* Modal Traitement Retour */}
          <ProcessReturnModal
            isOpen={isProcessModalOpen}
            onClose={() => {
              setIsProcessModalOpen(false);
              setSelectedReturnForAction(null);
            }}
            returnRecord={selectedReturnForAction}
            actionType={returnActionType}
            onSuccess={() => {
              loadData();
            }}
          />
        </div>
      </div>
    </div>
  );
}
