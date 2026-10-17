import { useState, useEffect, useCallback } from 'react';
import PageContainer from '../components/ui/PageContainer';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { auditApi, type AuditLog, type AuditLogStats } from '../api/audit';
import AuditDetailModal from '../components/audit/AuditDetailModal';
import { useDebounce } from '../hooks/useDebounce';
import { useAuthStore } from '../store/authStore';
import { exportAuditLogsToPdf } from '../utils/auditPdfExport';
import { formatDateTime } from '../utils/formatters';
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
  Download,
} from 'lucide-react';

export default function AuditLogsPage() {
  const { operator, user } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
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

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      // Fetch full matching dataset (up to 5000 items)
      const exportData = await auditApi.getLogs({
        page: 1,
        page_size: 5000,
        search: debouncedSearch.trim() || undefined,
        action: selectedAction !== 'ALL' ? selectedAction : undefined,
        actor_id: selectedActor ? Number(selectedActor) : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      const categoryLabels: Record<string, string> = {
        ALL: 'Toutes les actions',
        SALES: 'Ventes',
        PAYMENTS: 'Paiements & Dettes',
        STOCK: 'Stocks & Matériel',
        EXCHANGES: 'Échanges',
        CUSTOMERS: 'Clients',
        USERS: 'Comptes & Utilisateurs',
      };

      const activeCategoryLabel = categoryLabels[selectedAction] || selectedAction;
      const selectedOp = stats?.operators.find((o) => String(o.id) === String(selectedActor));
      const activeOpName = selectedOp ? `${selectedOp.name} (@${selectedOp.username})` : undefined;

      exportAuditLogsToPdf({
        logs: exportData.results,
        categoryLabel: activeCategoryLabel,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        operatorName: activeOpName,
        generatedBy: operator?.display_name || user?.display_name || 'Bighrissen Admin',
      });
    } catch (err: any) {
      setError('Erreur lors de la génération du fichier PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await auditApi.getStats();
      setStats(statsData);
    } catch {
      // Non-critical, ignore
    }
  };

  const fetchLogs = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await auditApi.getLogs({
        page,
        page_size: 25,
        search: debouncedSearch.trim() || undefined,
        action: selectedAction !== 'ALL' ? selectedAction : undefined,
        actor_id: selectedActor ? Number(selectedActor) : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      setLogs(data.results);
      setTotalCount(data.count);
      setTotalPages(data.total_pages);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erreur lors du chargement des journaux.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, debouncedSearch, selectedAction, selectedActor, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleFilterChange = (setter: (val: any) => void, val: any) => {
    setter(val);
    setPage(1);
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('DELETE') || action.includes('CANCEL') || action.includes('REJECT') || action.includes('DEACTIVATED')) {
      return 'bg-red-500/10 text-red-400 border-red-500/25';
    }
    if (action.includes('PAYMENT') || action.includes('COMPLETED') || action.includes('APPROVED')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
    }
    if (action.includes('STOCK') || action.includes('STATUS') || action.includes('OVERRIDE')) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
    }
    if (action.includes('EXCHANGE') || action.includes('REFUND')) {
      return 'bg-purple-500/10 text-purple-400 border-purple-500/25';
    }
    if (action.includes('USER') || action.includes('SETTINGS')) {
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25';
    }
    return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
  };

  const headerActions = (
    <div className="flex items-center gap-2.5">
      <button
        onClick={() => {
          fetchLogs(true);
          fetchStats();
        }}
        disabled={isRefreshing || isLoading}
        className="h-10 px-3.5 rounded-[var(--radius-md)] bg-surface hover:bg-surface-hover text-text-secondary hover:text-text border border-border flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
        title="Actualiser"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-gold' : ''}`} />
        <span>Actualiser</span>
      </button>

      <button
        onClick={handleExportPdf}
        disabled={isExporting || isLoading}
        className="h-10 px-4 rounded-[var(--radius-md)] bg-gold hover:bg-gold-bright text-black font-semibold flex items-center gap-2 text-xs shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
        title="Exporter en PDF selon les filtres actifs"
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin text-black" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span>{isExporting ? 'Exportation...' : 'Exporter en PDF'}</span>
      </button>
    </div>
  );

  return (
    <PageContainer
      header={
        <PageHeader
          icon={ShieldCheck}
          title="Journal d'Audit & Sécurité"
          subtitle="Traçabilité des opérations sensibles, modifications de stock et mouvements de caisse"
          badge={
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gold/15 text-gold border border-gold/30">
              Audit Log
            </span>
          }
          actions={headerActions}
        />
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-[var(--radius-md)] bg-danger/10 border border-danger/30 text-danger text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 4 Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Événements Tracés"
              value={stats.total_logs}
              icon={ShieldCheck}
              iconColor="gold"
              subValue="Historique complet des actions"
            />
            <StatCard
              title="Aujourd'hui"
              value={stats.today_logs}
              icon={Clock}
              iconColor="emerald"
              subValue="Activités depuis 00:00"
            />
            <StatCard
              title="Ventes & Encaissements"
              value={stats.categories.sales + stats.categories.payments}
              icon={CreditCard}
              iconColor="cyan"
              subValue={`${stats.categories.sales} ventes • ${stats.categories.payments} paiements`}
            />
            <StatCard
              title="Stocks & Échanges"
              value={stats.categories.stock + stats.categories.exchanges}
              icon={Package}
              iconColor="purple"
              subValue={`${stats.categories.stock} ajustements • ${stats.categories.exchanges} échanges`}
            />
          </div>
        )}

        {/* Filters Bar */}
        <div className="p-4 rounded-[var(--radius-lg)] bg-surface border border-border space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Rechercher par motif, entité (#9), opérateur, etc..."
                value={search}
                onChange={(e) => handleFilterChange(setSearch, e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded-[var(--radius-md)] pl-10 pr-4 py-2 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-gold/60 transition-colors"
              />
            </div>

            {/* Operator Filter */}
            {stats?.operators && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary whitespace-nowrap">Opérateur :</span>
                <select
                  value={selectedActor}
                  onChange={(e) => handleFilterChange(setSelectedActor, e.target.value)}
                  className="bg-surface-elevated border border-border rounded-[var(--radius-md)] px-3 py-2 text-xs text-text focus:outline-none focus:border-gold/60 cursor-pointer"
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
              <div className="flex items-center gap-1.5 bg-surface-elevated px-2.5 py-1.5 rounded-[var(--radius-md)] border border-border text-xs text-text-secondary">
                <Calendar className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                <span>Du :</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
                  className="bg-transparent text-text focus:outline-none cursor-pointer text-xs"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-surface-elevated px-2.5 py-1.5 rounded-[var(--radius-md)] border border-border text-xs text-text-secondary">
                <Calendar className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                <span>Au :</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
                  className="bg-transparent text-text focus:outline-none cursor-pointer text-xs"
                />
              </div>
            </div>
          </div>

          {/* Category Quick Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            <span className="text-overline mr-1">Catégorie :</span>
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
                className={`px-3 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-all cursor-pointer ${
                  selectedAction === cat.id
                    ? 'bg-gold text-black font-semibold shadow-sm'
                    : 'bg-surface-elevated text-text-secondary hover:text-text border border-border'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-elevated text-text-secondary border-b border-border">
                <tr>
                  <th className="py-3 px-6 font-semibold">Date & Heure</th>
                  <th className="py-3 px-4 font-semibold">Opérateur</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold">Entité / Réf</th>
                  <th className="py-3 px-6 font-semibold">Description / Motif</th>
                  <th className="py-3 px-4 text-center font-semibold">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
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
                    <td colSpan={6} className="py-12 text-center text-text-muted">
                      Aucun événement d'audit ne correspond à vos critères de recherche.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-surface-hover/60 transition-colors cursor-pointer group"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="py-3 px-6 text-text-secondary font-mono text-[11px] flex items-center gap-1.5 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                        <span>{formatDateTime(log.created_at)}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium text-text">
                          <UserCheck className="w-3 h-3 text-gold" />
                          <span>{log.actor_name}</span>
                        </div>
                        <span className="text-[10px] text-text-muted">@{log.actor_username}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-[var(--radius-sm)] font-semibold border text-[11px] ${getActionBadgeColor(log.action)}`}>
                          {log.action_display || log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                        <span className="text-text-secondary">{log.entity_type}</span>{' '}
                        <span className="text-gold font-bold">#{log.entity_id}</span>
                      </td>
                      <td className="py-3 px-6 text-text-secondary max-w-md truncate">
                        {log.reason ? (
                          <span>{log.reason}</span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="p-1.5 rounded-[var(--radius-sm)] bg-surface-elevated hover:bg-gold/20 text-text-secondary hover:text-gold border border-border transition-colors cursor-pointer"
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
            <div className="p-4 border-t border-border bg-surface-elevated/40 flex items-center justify-between">
              <span className="text-xs text-text-secondary">
                Total : <strong className="text-text tabular-nums">{totalCount}</strong> événements (Page {page} sur {totalPages})
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                  className="p-2 rounded-[var(--radius-md)] bg-surface hover:bg-surface-hover text-text-secondary hover:text-text border border-border disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  title="Page précédente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-3 py-1 bg-surface rounded-[var(--radius-sm)] text-xs font-mono text-text border border-border">
                  {page} / {totalPages}
                </span>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                  className="p-2 rounded-[var(--radius-md)] bg-surface hover:bg-surface-hover text-text-secondary hover:text-text border border-border disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  title="Page suivante"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </PageContainer>
  );
}

