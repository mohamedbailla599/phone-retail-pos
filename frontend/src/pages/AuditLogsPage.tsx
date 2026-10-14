import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { auditApi, type AuditLog, type AuditLogStats } from '../api/audit';
import AuditDetailModal from '../components/audit/AuditDetailModal';
import { useDebounce } from '../hooks/useDebounce';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Loader2,
  Calendar,
  AlertCircle,
  Eye,
  UserCheck,
  Clock,
  ChevronLeft,
  ChevronRight,
  Package,
  CreditCard,
} from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [selectedActor, setSelectedActor] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected Log for Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchStats = async () => {
    try {
      const statsData = await auditApi.getStats();
      setStats(statsData);
    } catch {
      // Non-critical, ignore
    }
  };

  const fetchLogs = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const data = await auditApi.getLogs({
        page,
        search: debouncedSearch.trim() || undefined,
        action: selectedAction !== 'ALL' ? selectedAction : undefined,
        actor_id: selectedActor ? Number(selectedActor) : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      setLogs(data.results);
      setTotalPages(data.total_pages);
      setTotalCount(data.count);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erreur lors du chargement des journaux d audit.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, debouncedSearch, selectedAction, selectedActor, startDate, endDate]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when filters change
  const handleFilterChange = (setter: (val: any) => void, val: any) => {
    setPage(1);
    setter(val);
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

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CANCEL') || action.includes('REJECT') || action.includes('DEACTIVATED')) {
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    }
    if (action.includes('PAYMENT') || action.includes('COMPLETED') || action.includes('APPROVED')) {
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
    if (action.includes('STOCK') || action.includes('STATUS') || action.includes('OVERRIDE')) {
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    }
    return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  };

  return (
    <div className="h-screen flex bg-bg overflow-hidden w-full">
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
        {/* Top Header */}
        <header className="h-[76px] flex items-center justify-between px-8 bg-surface border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-wide">
                  Journal d'Audit & Sécurité
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gold/15 text-gold border border-gold/30">
                  Audit Log
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                Traçabilité des opérations sensibles, modifications de stocks et mouvements de caisse
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchLogs(true);
                fetchStats();
              }}
              disabled={isRefreshing || isLoading}
              className="h-10 px-3.5 rounded-xl bg-surface-hover hover:bg-border/60 text-text-secondary hover:text-white border border-border flex items-center gap-2 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
              title="Actualiser"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-gold' : ''}`} />
              <span>Actualiser</span>
            </button>
          </div>
        </header>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 4 Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-surface border border-gold-border/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gold">
                    Total Événements Tracés
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-gold/15 flex items-center justify-center text-gold">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white">{stats.total_logs}</div>
                <div className="text-[11px] text-text-secondary mt-1">Actions enregistrées dans l'historique</div>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-emerald-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    Aujourd'hui
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-emerald-400">{stats.today_logs}</div>
                <div className="text-[11px] text-text-secondary mt-1">Activités réalisées depuis ce matin</div>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-cyan-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                    Ventes & Encaissements
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center text-cyan-400">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-cyan-300">
                  {stats.categories.sales + stats.categories.payments}
                </div>
                <div className="text-[11px] text-text-secondary mt-1">
                  {stats.categories.sales} ventes • {stats.categories.payments} paiements
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-purple-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
                    Stocks & Échanges
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-purple-300">
                  {stats.categories.stock + stats.categories.exchanges}
                </div>
                <div className="text-[11px] text-text-secondary mt-1">
                  {stats.categories.stock} ajustements • {stats.categories.exchanges} échanges
                </div>
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-surface border border-border space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Rechercher par motif, entité (#9), opérateur, etc..."
                  value={search}
                  onChange={(e) => handleFilterChange(setSearch, e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>

              {/* Operator Filter */}
              {stats?.operators && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary">Opérateur :</span>
                  <select
                    value={selectedActor}
                    onChange={(e) => handleFilterChange(setSelectedActor, e.target.value)}
                    className="bg-bg border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold/50 cursor-pointer"
                  >
                    <option value="">Tous les opérateurs</option>
                    {stats.operators.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.name} (@{op.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date Filters */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-bg px-2.5 py-1.5 rounded-xl border border-border text-xs text-text-secondary">
                  <Calendar className="w-3.5 h-3.5 text-gold" />
                  <span>Du :</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
                    className="bg-transparent text-white focus:outline-none cursor-pointer text-xs"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-bg px-2.5 py-1.5 rounded-xl border border-border text-xs text-text-secondary">
                  <Calendar className="w-3.5 h-3.5 text-gold" />
                  <span>Au :</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
                    className="bg-transparent text-white focus:outline-none cursor-pointer text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Category Quick Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
              <span className="text-[11px] text-text-muted uppercase font-bold mr-1">Catégorie :</span>
              {[
                { id: 'ALL', label: 'Toutes les actions' },
                { id: 'SALES', label: 'Ventes' },
                { id: 'PAYMENTS', label: 'Paiements & Dettes' },
                { id: 'STOCK', label: 'Stocks & Matériel' },
                { id: 'EXCHANGES', label: 'Échanges' },
                { id: 'CUSTOMERS', label: 'Clients' },
                { id: 'USERS', label: 'Comptes' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleFilterChange(setSelectedAction, cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    selectedAction === cat.id
                      ? 'bg-gold text-black font-semibold shadow-sm'
                      : 'bg-bg text-text-secondary hover:text-white border border-border'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg text-text-secondary border-b border-border">
                  <tr>
                    <th className="py-3 px-6">Date & Heure</th>
                    <th className="py-3 px-4">Opérateur</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entité / Réf</th>
                    <th className="py-3 px-6">Description / Motif</th>
                    <th className="py-3 px-4 text-center">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-text-secondary">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-6 h-6 text-gold animate-spin" />
                          <span>Chargement du journal d'audit...</span>
                        </div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-text-secondary">
                        Aucun événement d'audit ne correspond à vos critères de recherche.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-surface-hover/50 transition-colors cursor-pointer group"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="py-3 px-6 text-text-secondary font-mono flex items-center gap-1.5 whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                          <span>{formatDateTime(log.created_at)}</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-medium text-white">
                            <UserCheck className="w-3 h-3 text-gold" />
                            <span>{log.actor_name}</span>
                          </div>
                          <span className="text-[10px] text-text-muted">@{log.actor_username}</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-md font-semibold border text-[11px] ${getActionBadgeColor(log.action)}`}>
                            {log.action_display || log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono whitespace-nowrap">
                          <span className="text-text-secondary">{log.entity_type}</span>{' '}
                          <span className="text-gold font-bold">#{log.entity_id}</span>
                        </td>
                        <td className="py-3 px-6 text-text-secondary max-w-md truncate">
                          {log.reason || (
                            <span className="text-text-muted italic">Aucun motif textuel</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="p-1.5 rounded-lg bg-bg hover:bg-gold/20 text-text-secondary hover:text-gold border border-border transition-colors cursor-pointer"
                            title="Voir les détails"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-border bg-bg/50 flex items-center justify-between">
                <span className="text-xs text-text-secondary">
                  Total : <strong className="text-white">{totalCount}</strong> événements (Page {page} sur {totalPages})
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || isLoading}
                    className="p-2 rounded-xl bg-surface hover:bg-surface-hover text-text-secondary hover:text-white border border-border disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    title="Page précédente"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 bg-surface rounded-lg text-xs font-mono text-white border border-border">
                    {page} / {totalPages}
                  </span>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || isLoading}
                    className="p-2 rounded-xl bg-surface hover:bg-surface-hover text-text-secondary hover:text-white border border-border disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    title="Page suivante"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
