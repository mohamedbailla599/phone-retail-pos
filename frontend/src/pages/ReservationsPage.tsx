import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
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
    // Offer to print receipt
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

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Helper for expiry remaining time
  const getExpiryBadge = (expiresAtStr: string, status: string) => {
    if (status !== 'ACTIVE') return null;
    const now = new Date();
    const expiry = new Date(expiresAtStr);
    const diffHours = Math.round((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (diffHours < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
          <Clock className="w-3 h-3" /> Expiré
        </span>
      );
    }
    if (diffHours <= 48) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
          <Clock className="w-3 h-3" /> Reste {diffHours}h
        </span>
      );
    }
    const days = Math.round(diffHours / 24);
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" /> Reste {days}j
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="warning">En cours</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">Finalisée</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Annulée</Badge>;
      case 'EXPIRED':
        return <Badge variant="default">Expirée</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
              <Bookmark className="w-7 h-7 text-amber-400" />
              <span>Réservations de Téléphones</span>
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              Gérez les téléphones mis de côté, le suivi des acomptes et les retraits clients
            </p>
          </div>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle Réservation
          </Button>
        </div>

        {/* Stats KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span>Réservations En Cours</span>
              <Bookmark className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-neutral-100">
              {stats?.active_count ?? 0}
            </div>
            <div className="text-[11px] text-neutral-500">Téléphones bloqués</div>
          </div>

          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span>Échéance Proche (&lt; 48h)</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className={`text-2xl font-bold ${Number(stats?.expiring_soon_count || 0) > 0 ? 'text-amber-400' : 'text-neutral-100'}`}>
              {stats?.expiring_soon_count ?? 0}
            </div>
            <div className="text-[11px] text-neutral-500">À relancer rapidement</div>
          </div>

          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span>Total Acomptes En Caisse</span>
              <Banknote className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {parseFloat(stats?.total_deposits_held || '0').toFixed(2)} DH
            </div>
            <div className="text-[11px] text-neutral-500">Avances clients reçues</div>
          </div>

          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span>Ventes Finalisées</span>
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-neutral-100">
              {stats?.completed_count ?? 0}
            </div>
            <div className="text-[11px] text-neutral-500">Téléphones livrés</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  statusFilter === tab.key
                    ? 'bg-amber-500 text-black font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher client, IMEI, modèle..."
                className="w-full pl-9 pr-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              onClick={() => loadData()}
              className="p-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200 rounded-lg transition-all"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Reservations Table */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-neutral-500 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
              <span>Chargement des réservations...</span>
            </div>
          ) : reservations.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Bookmark className="w-12 h-12 text-neutral-700 mx-auto" />
              <div className="text-neutral-300 font-semibold">Aucune réservation trouvée</div>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                {statusFilter === 'ACTIVE'
                  ? 'Aucun téléphone n’est actuellement réservé. Cliquez sur "Nouvelle Réservation" pour enregistrer une réservation client.'
                  : 'Aucun enregistrement ne correspond aux filtres appliqués.'}
              </p>
              {statusFilter === 'ACTIVE' && (
                <Button variant="secondary" size="sm" onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer une réservation
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950/70 border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">N° Réservation</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Appareil & IMEI</th>
                    <th className="py-3 px-4 text-right">Prix Convenu</th>
                    <th className="py-3 px-4 text-right">Acompte Versé</th>
                    <th className="py-3 px-4 text-right">Solde Restant</th>
                    <th className="py-3 px-4">Échéance</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {reservations.map((r) => {
                    const reservedPrice = parseFloat(r.reserved_price) || 0;
                    const paidAmount = parseFloat(r.paid_amount) || 0;
                    const remainingBalance = parseFloat(r.remaining_balance) || 0;

                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-neutral-800/40 transition-colors group"
                      >
                        {/* N° & Date */}
                        <td className="py-3.5 px-4 font-mono text-neutral-200">
                          <div className="font-semibold text-neutral-100">{r.reservation_number}</div>
                          <div className="text-[10px] text-neutral-500">{formatDate(r.reserved_at)}</div>
                        </td>

                        {/* Client */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-neutral-200">{r.customer_name}</div>
                          <div className="text-[11px] text-neutral-400 font-mono">{r.customer_phone}</div>
                        </td>

                        {/* Device */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-neutral-200 flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <span>{r.device_name}</span>
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            IMEI: {r.device_imei}
                          </div>
                        </td>

                        {/* Prix */}
                        <td className="py-3.5 px-4 text-right font-medium text-neutral-300">
                          {reservedPrice.toFixed(2)} DH
                        </td>

                        {/* Acompte */}
                        <td className="py-3.5 px-4 text-right font-semibold text-emerald-400">
                          {paidAmount > 0 ? `${paidAmount.toFixed(2)} DH` : <span className="text-neutral-500 font-normal">0.00 DH</span>}
                        </td>

                        {/* Solde restant */}
                        <td className="py-3.5 px-4 text-right font-bold">
                          {remainingBalance > 0 ? (
                            <span className="text-amber-400">{remainingBalance.toFixed(2)} DH</span>
                          ) : (
                            <span className="text-emerald-400">Payé (0.00 DH)</span>
                          )}
                        </td>

                        {/* Échéance */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-neutral-300">{formatDate(r.expires_at)}</div>
                          <div className="mt-0.5">{getExpiryBadge(r.expires_at, r.status)}</div>
                        </td>

                        {/* Statut */}
                        <td className="py-3.5 px-4">
                          {getStatusBadge(r.status)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {r.status === 'ACTIVE' && (
                              <>
                                <button
                                  onClick={() => openCompleteModal(r)}
                                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-xs transition-all flex items-center gap-1 shadow-sm"
                                  title="Finaliser la vente et remettre le téléphone"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Finaliser</span>
                                </button>

                                {remainingBalance > 0 && (
                                  <button
                                    onClick={() => openAddDepositModal(r)}
                                    className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-all"
                                    title="Ajouter un versement / acompte"
                                  >
                                    <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                                  </button>
                                )}

                                <button
                                  onClick={() => openReceiptModal(r)}
                                  className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-all"
                                  title="Imprimer le bon de réservation"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => openCancelModal(r)}
                                  className="p-1.5 bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 rounded-lg transition-all"
                                  title="Annuler la réservation"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {r.status !== 'ACTIVE' && (
                              <button
                                onClick={() => openReceiptModal(r)}
                                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs transition-all flex items-center gap-1"
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
    </div>
  );
}
