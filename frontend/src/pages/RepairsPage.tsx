import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/layout/Sidebar';
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
} from 'lucide-react';
import { repairsApi, type RepairTicket, type RepairStatus } from '../api/repairs';
import { CreateRepairModal } from '../components/repairs/CreateRepairModal';
import { UpdateRepairStatusModal } from '../components/repairs/UpdateRepairStatusModal';
import { DeliverRepairModal } from '../components/repairs/DeliverRepairModal';
import { printRepairIntakeReceipt, printRepairDeliveryReceipt } from '../utils/printRepairReceipt';

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

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statusModalTicket, setStatusModalTicket] = useState<RepairTicket | null>(null);
  const [deliverModalTicket, setDeliverModalTicket] = useState<RepairTicket | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repairsApi.getRepairs({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
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
    fetchTickets();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTickets();
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

  const getStatusBadge = (status: RepairStatus, display: string) => {
    switch (status) {
      case 'RECEIVED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            {display}
          </span>
        );
      case 'DIAGNOSING':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            {display}
          </span>
        );
      case 'WAITING_PARTS':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            {display}
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
            {display}
          </span>
        );
      case 'READY':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse">
            Prêt au retrait
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/5 text-text-muted border border-border">
            Livré & Soldé
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
            Annulé
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface-elevated text-text border border-border">
            {display}
          </span>
        );
    }
  };

  return (
    <div className="flex h-screen w-screen bg-bg text-text overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="px-8 py-5 border-b border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
                <Wrench className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-text">Atelier & Service Réparations</h1>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Prise en charge matériel, suivi atelier, devis pièces, encaissements et tickets thermiques
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchTickets()}
              disabled={loading}
              className="p-2.5 border border-border rounded-lg text-text-secondary hover:text-text hover:bg-white/5 transition-colors"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 bg-gold hover:bg-gold-light text-bg font-bold rounded-lg text-xs flex items-center gap-2 shadow-lg shadow-gold/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Dépôt Client</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 custom-scrollbar">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-surface rounded-xl border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary">En Atelier Actif</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-text mt-2">{metrics.active}</div>
              <p className="text-[11px] text-text-muted mt-1">Diagnostic, pièces ou intervention en cours</p>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-emerald-500/20 bg-emerald-500/5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400">Prêts pour Retrait</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">{metrics.ready}</div>
              <p className="text-[11px] text-text-muted mt-1">En attente de passage du client</p>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary">Restitués & Soldés</span>
                <ShieldCheck className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-text mt-2">{metrics.delivered}</div>
              <p className="text-[11px] text-text-muted mt-1">Appareils remis avec garantie active</p>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-gold-border/40 bg-gold/5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gold">Solde en Attente</span>
                <DollarSign className="w-4 h-4 text-gold" />
              </div>
              <div className="text-2xl font-bold font-mono text-gold mt-2">
                {metrics.pendingBalance.toFixed(2)} DH
              </div>
              <p className="text-[11px] text-text-muted mt-1">Reste à encaisser à la restitution</p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-4 bg-surface rounded-xl border border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <form onSubmit={handleSearchSubmit} className="flex-1 relative">
              <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par N° ticket, client, téléphone, modèle ou IMEI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors"
              />
            </form>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
              {STATUS_FILTERS.map((f) => {
                const isActive = statusFilter === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
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
                    <th className="px-5 py-3.5">Finances (DH)</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-text-muted">
                        <div className="max-w-xs mx-auto space-y-3">
                          <Wrench className="w-8 h-8 text-text-muted/40 mx-auto" />
                          <p className="text-sm font-semibold text-text">Aucun ticket trouvé</p>
                          <p className="text-xs">
                            Aucune réparation ne correspond aux critères de recherche actuels.
                          </p>
                          <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold/10 border border-gold-border text-gold rounded-lg text-xs font-bold hover:bg-gold/20 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Créer un ticket de dépôt
                          </button>
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
                              {new Date(ticket.created_at).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
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
                            {getStatusBadge(ticket.status, ticket.status_display)}
                            {ticket.technician_notes && (
                              <p className="text-[10px] text-text-secondary mt-1.5 italic line-clamp-1">
                                "{ticket.technician_notes}"
                              </p>
                            )}
                          </td>

                          {/* Financials */}
                          <td className="px-5 py-4 align-top font-mono">
                            <div className="text-text font-bold">
                              {finalCost.toFixed(2)} DH
                            </div>
                            {deposit > 0 && (
                              <div className="text-[10px] text-emerald-400">
                                Acompte: {deposit.toFixed(2)} DH
                              </div>
                            )}
                            <div className={`text-[11px] font-semibold mt-0.5 ${balance > 0 && !isDelivered ? 'text-amber-400' : 'text-text-muted'}`}>
                              {isDelivered ? 'Soldé' : `Reste: ${balance.toFixed(2)} DH`}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4 align-top text-right space-y-1.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Print Ticket Intake */}
                              <button
                                onClick={() => printRepairIntakeReceipt(ticket)}
                                className="p-1.5 bg-surface-elevated hover:bg-white/10 border border-border rounded text-text-secondary hover:text-text transition-colors"
                                title="Imprimer le ticket de dépôt (80mm)"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {!isDelivered && (
                                <>
                                  {/* Update status */}
                                  <button
                                    onClick={() => setStatusModalTicket(ticket)}
                                    className="px-2.5 py-1 bg-surface-elevated hover:border-gold/50 border border-border rounded text-[11px] font-semibold text-text transition-colors flex items-center gap-1"
                                  >
                                    <Clock className="w-3 h-3 text-gold" />
                                    <span>Statut</span>
                                  </button>

                                  {/* Deliver & Settle */}
                                  <button
                                    onClick={() => setDeliverModalTicket(ticket)}
                                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 ${
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
                                  className="px-2.5 py-1 bg-surface-elevated hover:bg-white/10 border border-border rounded text-[11px] font-medium text-emerald-400 transition-colors flex items-center gap-1"
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
      </main>

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
    </div>
  );
};

export default RepairsPage;
