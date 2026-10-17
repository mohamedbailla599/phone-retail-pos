import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  Plus,
  Search,
  RefreshCw,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Smartphone,
  DollarSign,
  ShieldCheck,
  Lock,
  Camera,
  X,
} from 'lucide-react';
import { repairsApi, type RepairTicket } from '../api/repairs';
import { CreateRepairModal } from '../components/repairs/CreateRepairModal';
import { UpdateRepairStatusModal } from '../components/repairs/UpdateRepairStatusModal';
import { DeliverRepairModal } from '../components/repairs/DeliverRepairModal';
import BarcodeScannerModal from '../components/ui/BarcodeScannerModal';
import { printRepairIntakeReceipt, printRepairDeliveryReceipt } from '../utils/printRepairReceipt';
import PageContainer from '../components/ui/PageContainer';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { formatCurrency, formatDateTime } from '../utils/formatters';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tous les tickets' },
  { value: 'RECEIVED', label: 'Reçus' },
  { value: 'DIAGNOSING', label: 'Diagnostic' },
  { value: 'WAITING_PARTS', label: 'Pièces' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'READY', label: 'Prêts au retrait' },
  { value: 'DELIVERED', label: 'Livrés & Soldés' },
];

export const RepairsPage: React.FC = () => {
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statusModalTicket, setStatusModalTicket] = useState<RepairTicket | null>(null);
  const [deliverModalTicket, setDeliverModalTicket] = useState<RepairTicket | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Debounce search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchTickets = async (overrideSearch?: string) => {
    setLoading(true);
    setError(null);
    try {
      const term = overrideSearch !== undefined ? overrideSearch : debouncedSearch;
      const data = await repairsApi.getRepairs({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: term.trim() || undefined,
      });
      setTickets(data);
    } catch (err: any) {
      console.error('Failed to fetch repairs:', err);
      setError('Impossible de charger les tickets de réparation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets(debouncedSearch);
  }, [statusFilter, debouncedSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(searchQuery);
    fetchTickets(searchQuery);
  };

  const handleScan = (scannedCode: string) => {
    const cleanCode = scannedCode.trim();
    setSearchQuery(cleanCode);
    setDebouncedSearch(cleanCode);
    setIsScannerOpen(false);
    fetchTickets(cleanCode);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    fetchTickets('');
  };

  // Metrics
  const metrics = useMemo(() => {
    const active = tickets.filter((t) =>
      ['RECEIVED', 'DIAGNOSING', 'WAITING_PARTS', 'IN_PROGRESS'].includes(t.status)
    ).length;
    const ready = tickets.filter((t) => t.status === 'READY').length;
    const delivered = tickets.filter((t) => t.status === 'DELIVERED').length;
    const pendingBalance = tickets
      .filter((t) => t.status !== 'DELIVERED' && t.status !== 'CANCELLED')
      .reduce((sum, t) => sum + (parseFloat(t.final_cost || t.estimated_cost) - parseFloat(t.deposit_paid)), 0);

    return { active, ready, delivered, pendingBalance };
  }, [tickets]);

  return (
    <PageContainer
      header={
        <PageHeader
          title="Atelier & Service Réparations"
          subtitle="Prise en charge matériel, suivi atelier, devis pièces, encaissements et tickets thermiques"
          icon={Wrench}
          badge={
            <span className="text-xs font-mono font-semibold text-gold px-2.5 py-0.5 rounded-full bg-gold/10 border border-gold-border">
              {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
            </span>
          }
          actions={
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => fetchTickets()}
                disabled={loading}
                className="p-2.5 border border-border rounded-lg text-text-secondary hover:text-text hover:bg-white/5 transition-colors focus-ring"
                title="Rafraîchir"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2.5 bg-gold hover:bg-gold-light text-bg font-bold rounded-lg text-xs flex items-center gap-2 shadow-lg shadow-gold/10 transition-all hover:scale-[1.02] active:scale-[0.98] focus-ring"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau Dépôt Client</span>
              </button>
            </div>
          }
        />
      }
    >
      <div className="space-y-6">
        {/* Quick Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="En Atelier Actif"
            value={metrics.active}
            subValue="Diagnostic, pièces ou intervention en cours"
            icon={Clock}
            variant="amber"
          />
          <StatCard
            label="Prêts pour Retrait"
            value={metrics.ready}
            subValue="En attente de passage du client"
            icon={CheckCircle2}
            variant="emerald"
          />
          <StatCard
            label="Restitués & Soldés"
            value={metrics.delivered}
            subValue="Appareils remis avec garantie active"
            icon={ShieldCheck}
            variant="blue"
          />
          <StatCard
            label="Solde en Attente"
            value={formatCurrency(metrics.pendingBalance)}
            subValue="Reste à encaisser à la restitution"
            icon={DollarSign}
            variant="gold"
          />
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 bg-surface rounded-xl border border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher par IMEI, N° ticket, client, tél, marque, modèle, panne..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors focus-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text rounded-md transition-colors cursor-pointer"
                  title="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Scan IMEI / Barcode Button */}
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="h-9 px-3.5 bg-gold/15 hover:bg-gold/25 text-gold border border-gold-border/60 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xs cursor-pointer whitespace-nowrap focus-ring"
              title="Scanner un IMEI ou le code-barres d'un ticket avec la caméra"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Scanner IMEI</span>
              <span className="sm:hidden">Scan</span>
            </button>
          </form>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
            {STATUS_FILTERS.map((f) => {
              const isActive = statusFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors focus-ring ${
                    isActive
                      ? 'bg-gold text-bg font-bold shadow-sm'
                      : 'bg-surface-elevated text-text-secondary hover:text-text hover:bg-white/5 border border-border'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tickets Table */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
            {error && (
              <div className="p-4 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-elevated/60 text-text-secondary border-b border-border uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Ticket</th>
                    <th className="px-5 py-3.5">Client & Contact</th>
                    <th className="px-5 py-3.5">Appareil & Panne</th>
                    <th className="px-5 py-3.5">Statut Atelier</th>
                    <th className="px-5 py-3.5 text-right">Finances</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-text-muted">
                        <div className="max-w-xs mx-auto space-y-3">
                          <Wrench className="w-8 h-8 text-text-muted/40 mx-auto" />
                          <p className="text-sm font-semibold text-text">
                            {searchQuery ? 'Aucun résultat trouvé' : 'Aucun ticket trouvé'}
                          </p>
                          <p className="text-xs">
                            {searchQuery
                              ? `Aucune réparation ne correspond à « ${searchQuery} » avec le filtre « ${STATUS_FILTERS.find((f) => f.value === statusFilter)?.label} ».`
                              : 'Aucune réparation ne correspond aux critères de recherche actuels.'}
                          </p>
                          <div className="flex items-center justify-center gap-2 pt-1">
                            {searchQuery && (
                              <button
                                type="button"
                                onClick={handleClearSearch}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated border border-border text-text rounded-lg text-xs font-medium hover:bg-white/5 transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Effacer</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setIsCreateModalOpen(true)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold/10 border border-gold-border text-gold rounded-lg text-xs font-bold hover:bg-gold/20 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Nouveau Dépôt</span>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    tickets.map((ticket) => {
                      const estCost = parseFloat(ticket.estimated_cost) || 0;
                      const finalCost = parseFloat(ticket.final_cost) || estCost;
                      const deposit = parseFloat(ticket.deposit_paid) || 0;
                      const balance = Math.max(0, finalCost - deposit);
                      const isDelivered = ticket.status === 'DELIVERED';
                      const isReady = ticket.status === 'READY';

                      return (
                        <tr
                          key={ticket.id}
                          className="hover:bg-white/[0.02] transition-colors group"
                        >
                          {/* Ticket Number */}
                          <td className="px-5 py-4 align-top">
                            <div className="font-mono font-bold text-text group-hover:text-gold transition-colors">
                              {ticket.ticket_number}
                            </div>
                            <div className="text-[11px] text-text-muted mt-0.5">
                              {formatDateTime(ticket.created_at)}
                            </div>
                            {ticket.created_by_username && (
                              <div className="text-[10px] text-text-muted/80 mt-0.5">
                                Par: {ticket.created_by_username}
                              </div>
                            )}
                          </td>

                          {/* Customer */}
                          <td className="px-5 py-4 align-top">
                            <div className="font-semibold text-text">{ticket.customer_name}</div>
                            <div className="text-[11px] font-mono text-gold mt-0.5">
                              {ticket.customer_phone}
                            </div>
                          </td>

                          {/* Device & Issue */}
                          <td className="px-5 py-4 align-top max-w-xs">
                            <div className="font-semibold text-text flex items-center gap-1.5">
                              <Smartphone className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                              <span>{ticket.device_brand} {ticket.device_model}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="px-2 py-0.5 bg-surface-elevated rounded border border-border text-[10px] text-text-secondary">
                                {ticket.issue_type_display}
                              </span>
                              {ticket.passcode && (
                                <span className="px-1.5 py-0.5 bg-gold/10 text-gold rounded text-[10px] font-mono flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" /> Code: {ticket.passcode}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-text-muted mt-1 line-clamp-2">
                              {ticket.issue_description}
                            </p>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4 align-top">
                            <StatusBadge
                              status={ticket.status}
                              label={ticket.status === 'READY' ? 'Prêt au retrait' : ticket.status_display}
                              tone={ticket.status === 'READY' ? 'success' : undefined}
                            />
                            {ticket.technician_notes && (
                              <p className="text-[10px] text-text-secondary mt-1.5 italic line-clamp-1">
                                "{ticket.technician_notes}"
                              </p>
                            )}
                          </td>

                          {/* Financials */}
                          <td className="px-5 py-4 align-top text-right">
                            <div className="text-text font-bold tabular-nums">
                              {formatCurrency(finalCost)}
                            </div>
                            {deposit > 0 && (
                              <div className="text-[10px] text-emerald-400 tabular-nums">
                                Acompte: {formatCurrency(deposit)}
                              </div>
                            )}
                            <div className={`text-[11px] font-semibold mt-0.5 tabular-nums ${balance > 0 && !isDelivered ? 'text-amber-400' : 'text-text-muted'}`}>
                              {isDelivered ? 'Soldé' : `Reste: ${formatCurrency(balance)}`}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4 align-top text-right space-y-1.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Print Ticket Intake */}
                              <button
                                onClick={() => printRepairIntakeReceipt(ticket)}
                                className="p-1.5 bg-surface-elevated hover:bg-white/10 border border-border rounded text-text-secondary hover:text-text transition-colors focus-ring"
                                title="Imprimer le ticket de dépôt (80mm)"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {!isDelivered && (
                                <>
                                  {/* Update status */}
                                  <button
                                    onClick={() => setStatusModalTicket(ticket)}
                                    className="px-2.5 py-1 bg-surface-elevated hover:border-gold/50 border border-border rounded text-[11px] font-semibold text-text transition-colors flex items-center gap-1 focus-ring"
                                  >
                                    <Clock className="w-3 h-3 text-gold" />
                                    <span>Statut</span>
                                  </button>

                                  {/* Deliver & Settle */}
                                  <button
                                    onClick={() => setDeliverModalTicket(ticket)}
                                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 focus-ring ${
                                      isReady
                                        ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-sm'
                                        : 'bg-gold/15 hover:bg-gold/25 border border-gold-border text-gold'
                                    }`}
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Restituer</span>
                                  </button>
                                </>
                              )}

                              {isDelivered && (
                                <button
                                  onClick={() => printRepairDeliveryReceipt(ticket)}
                                  className="px-2.5 py-1 bg-surface-elevated hover:bg-white/10 border border-border rounded text-[11px] font-medium text-emerald-400 transition-colors flex items-center gap-1 focus-ring"
                                  title="Réimprimer facture & certificat de garantie"
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>Garantie</span>
                                </button>
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
        </div>

      {/* Modals */}
      <CreateRepairModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => fetchTickets()}
      />

      <UpdateRepairStatusModal
        isOpen={!!statusModalTicket}
        ticket={statusModalTicket}
        onClose={() => setStatusModalTicket(null)}
        onSuccess={() => fetchTickets()}
      />

      <DeliverRepairModal
        isOpen={!!deliverModalTicket}
        ticket={deliverModalTicket}
        onClose={() => setDeliverModalTicket(null)}
        onSuccess={() => fetchTickets()}
      />

      {/* Barcode & Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
        title="Scanner IMEI ou Ticket Réparation"
        expectedType="any"
      />
    </PageContainer>
  );
};

export default RepairsPage;
