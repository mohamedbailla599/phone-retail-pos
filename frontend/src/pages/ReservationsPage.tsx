import { useState, useEffect, useCallback } from 'react';
import PageContainer from '../components/ui/PageContainer';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import {
  reservationsApi,
  type Reservation,
  type ReservationStats,
} from '../api/reservations';
import CreateReservationModal from '../components/reservations/CreateReservationModal';
import CompleteReservationModal from '../components/reservations/CompleteReservationModal';
import CancelReservationModal from '../components/reservations/CancelReservationModal';
import AddDepositModal from '../components/reservations/AddDepositModal';
import ReservationReceiptModal from '../components/reservations/ReservationReceiptModal';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  Bookmark,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  RefreshCw,
  Printer,
  RotateCcw,
  PlusCircle,
  Smartphone,
  Banknote,
} from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';

type StatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [stats, setStats] = useState<ReservationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isAddDepositOpen, setIsAddDepositOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resData, statsData] = await Promise.all([
        reservationsApi.getReservations({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: debouncedSearch.trim() || undefined,
        }),
        reservationsApi.getStats(),
      ]);
      setReservations(resData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load reservations', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleCreated = (newReservation: Reservation) => {
    loadData();
    setActiveReservation(newReservation);
    setIsReceiptModalOpen(true);
  };

  const handleActionSuccess = () => {
    loadData();
  };

  const openCompleteModal = (r: Reservation) => {
    setActiveReservation(r);
    setIsCompleteModalOpen(true);
  };

  const openCancelModal = (r: Reservation) => {
    setActiveReservation(r);
    setIsCancelModalOpen(true);
  };

  const openAddDepositModal = (r: Reservation) => {
    setActiveReservation(r);
    setIsAddDepositOpen(true);
  };

  const openReceiptModal = (r: Reservation) => {
    setActiveReservation(r);
    setIsReceiptModalOpen(true);
  };

  // Helper for expiry remaining time
  const getExpiryBadge = (expiresAtStr: string, status: string) => {
    if (status !== 'ACTIVE') return null;
    const now = new Date();
    const expiry = new Date(expiresAtStr);
    const diffHours = Math.round((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (diffHours < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 font-semibold">
          <Clock className="w-3 h-3" /> Expiré
        </span>
      );
    }
    if (diffHours <= 48) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-semibold">
          <Clock className="w-3 h-3" /> Reste {diffHours}h
        </span>
      );
    }
    const days = Math.round(diffHours / 24);
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-text-muted bg-surface-elevated px-2 py-0.5 rounded-full border border-border">
        <Clock className="w-3 h-3 text-gold" /> Reste {days}j
      </span>
    );
  };

  const headerActions = (
    <div className="flex items-center gap-2.5">
      <button
        onClick={() => loadData()}
        disabled={loading}
        className="h-10 px-3.5 rounded-[var(--radius-md)] bg-surface hover:bg-surface-hover text-text-secondary hover:text-text border border-border flex items-center gap-2 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        title="Actualiser"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-gold' : ''}`} />
        <span>Actualiser</span>
      </button>

      <button
        onClick={() => setIsCreateModalOpen(true)}
        className="h-10 px-4 bg-gold hover:bg-gold-bright text-black font-semibold rounded-[var(--radius-md)] flex items-center gap-2 text-xs transition-all shadow-md active:scale-95 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span>Nouvelle Réservation</span>
      </button>
    </div>
  );

  return (
    <PageContainer
      header={
        <PageHeader
          icon={Bookmark}
          title="Réservations de Téléphones"
          subtitle="Suivi des téléphones mis de côté, encaissement des acomptes et retraits clients"
          actions={headerActions}
        />
      }
    >
      <div className="space-y-6">
        {/* Stats KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Réservations En Cours"
            value={stats?.active_count ?? 0}
            icon={Bookmark}
            variant="amber"
            subValue="Téléphones bloqués pour les clients"
          />

          <StatCard
            label="Échéance Proche (< 48h)"
            value={stats?.expiring_soon_count ?? 0}
            icon={Clock}
            variant={Number(stats?.expiring_soon_count || 0) > 0 ? 'rose' : 'neutral'}
            subValue="À relancer rapidement"
          />

          <StatCard
            label="Acomptes En Caisse"
            value={formatCurrency(stats?.total_deposits_held || 0)}
            icon={Banknote}
            variant="emerald"
            subValue="Avances clients encaissées"
          />

          <StatCard
            label="Ventes Finalisées"
            value={stats?.completed_count ?? 0}
            icon={CheckCircle2}
            variant="gold"
            subValue="Téléphones livrés et soldés"
          />
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-surface border border-border rounded-[var(--radius-lg)]">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 bg-surface-elevated p-1 rounded-[var(--radius-md)] border border-border">
            {(
              [
                { key: 'ACTIVE', label: 'En cours' },
                { key: 'ALL', label: 'Toutes' },
                { key: 'COMPLETED', label: 'Finalisées' },
                { key: 'CANCELLED', label: 'Annulées' },
                { key: 'EXPIRED', label: 'Expirées' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-gold text-black shadow-xs font-bold'
                    : 'text-text-secondary hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher client, IMEI, modèle..."
              className="w-full pl-10 pr-3 h-10 bg-surface-elevated border border-border rounded-[var(--radius-md)] text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-gold/60 transition-colors"
            />
          </div>
        </div>

        {/* Reservations Table */}
        <div className="bg-surface border border-border rounded-[var(--radius-lg)] overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-12 text-center text-text-muted text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-gold" />
              <span>Chargement des réservations...</span>
            </div>
          ) : reservations.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Bookmark className="w-12 h-12 text-text-muted/40 mx-auto" />
              <div className="text-text font-semibold text-sm">Aucune réservation trouvée</div>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                {statusFilter === 'ACTIVE'
                  ? 'Aucun téléphone n’est actuellement réservé. Cliquez sur "Nouvelle Réservation" pour enregistrer une réservation client.'
                  : 'Aucun enregistrement ne correspond aux filtres appliqués.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-elevated border-b border-border text-text-secondary font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">N° Réservation</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Appareil & IMEI</th>
                    <th className="py-3 px-4 text-right">Prix Convenu</th>
                    <th className="py-3 px-4 text-right">Acompte Versé</th>
                    <th className="py-3 px-4 text-right">Solde Restant</th>
                    <th className="py-3 px-4 text-center">Échéance</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reservations.map((r) => {
                    const reservedPrice = parseFloat(r.reserved_price) || 0;
                    const paidAmount = parseFloat(r.paid_amount) || 0;
                    const remainingBalance = parseFloat(r.remaining_balance) || 0;

                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-surface-hover/60 transition-colors group"
                      >
                        {/* N° & Date */}
                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          <div className="font-bold text-gold">{r.reservation_number}</div>
                          <div className="text-[10px] text-text-muted">{formatDate(r.reserved_at)}</div>
                        </td>

                        {/* Client */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-text">{r.customer_name}</div>
                          <div className="text-[10px] text-text-muted font-mono">{r.customer_phone}</div>
                        </td>

                        {/* Device */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-text flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            <span>{r.device_name}</span>
                          </div>
                          <div className="text-[10px] text-text-muted font-mono">
                            IMEI: {r.device_imei}
                          </div>
                        </td>

                        {/* Prix */}
                        <td className="py-3.5 px-4 text-right font-medium text-text tabular-nums">
                          {formatCurrency(reservedPrice)}
                        </td>

                        {/* Acompte */}
                        <td className="py-3.5 px-4 text-right font-semibold text-emerald-400 tabular-nums">
                          {paidAmount > 0 ? formatCurrency(paidAmount) : <span className="text-text-muted font-normal">0,00 DH</span>}
                        </td>

                        {/* Solde restant */}
                        <td className="py-3.5 px-4 text-right font-bold tabular-nums">
                          {remainingBalance > 0 ? (
                            <span className="text-amber-400">{formatCurrency(remainingBalance)}</span>
                          ) : (
                            <span className="text-emerald-400">Payé (0,00 DH)</span>
                          )}
                        </td>

                        {/* Échéance */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="text-text">{formatDate(r.expires_at)}</div>
                          <div className="mt-0.5">{getExpiryBadge(r.expires_at, r.status)}</div>
                        </td>

                        {/* Statut */}
                        <td className="py-3.5 px-4 text-center">
                          <StatusBadge status={r.status} size="sm" />
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {r.status === 'ACTIVE' && (
                              <>
                                <button
                                  onClick={() => openCompleteModal(r)}
                                  className="px-2.5 py-1 bg-gold hover:bg-gold-bright text-black font-semibold rounded-[var(--radius-sm)] text-xs transition-all flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                                  title="Finaliser la vente et remettre le téléphone"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Finaliser</span>
                                </button>

                                {remainingBalance > 0 && (
                                  <button
                                    onClick={() => openAddDepositModal(r)}
                                    className="p-1.5 bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-emerald-400 border border-border rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                                    title="Ajouter un versement / acompte"
                                  >
                                    <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                                  </button>
                                )}

                                <button
                                  onClick={() => openReceiptModal(r)}
                                  className="p-1.5 bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text border border-border rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                                  title="Imprimer le bon de réservation"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => openCancelModal(r)}
                                  className="p-1.5 bg-surface-elevated hover:bg-red-500/20 text-text-muted hover:text-red-400 border border-border rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                                  title="Annuler la réservation"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {r.status !== 'ACTIVE' && (
                              <button
                                onClick={() => openReceiptModal(r)}
                                className="px-2.5 py-1 bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text border border-border rounded-[var(--radius-sm)] text-xs transition-colors flex items-center gap-1 cursor-pointer"
                                title="Voir / Imprimer le bon"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Reçu</span>
                              </button>
                            )}
                          </div>
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

      {/* Modals */}
      <CreateReservationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreated}
      />

      <CompleteReservationModal
        isOpen={isCompleteModalOpen}
        onClose={() => {
          setIsCompleteModalOpen(false);
          setActiveReservation(null);
        }}
        reservation={activeReservation}
        onSuccess={handleActionSuccess}
      />

      <CancelReservationModal
        isOpen={isCancelModalOpen}
        onClose={() => {
          setIsCancelModalOpen(false);
          setActiveReservation(null);
        }}
        reservation={activeReservation}
        onSuccess={handleActionSuccess}
      />

      <AddDepositModal
        isOpen={isAddDepositOpen}
        onClose={() => {
          setIsAddDepositOpen(false);
          setActiveReservation(null);
        }}
        reservation={activeReservation}
        onSuccess={handleActionSuccess}
      />

      <ReservationReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setActiveReservation(null);
        }}
        reservation={activeReservation}
      />
    </PageContainer>
  );
}

