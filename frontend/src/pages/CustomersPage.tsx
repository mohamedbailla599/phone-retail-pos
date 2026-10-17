import { useState, useEffect, useCallback } from 'react';
import { customersApi, type Customer, type CustomerStats } from '../api/customers';
import {
  Users,
  Search,
  Plus,
  Loader2,
  Banknote,
  TrendingUp,
  AlertTriangle,
  UserCheck,
  Eye,
  RefreshCw,
  Phone,
  MapPin,
} from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import PageContainer from '../components/ui/PageContainer';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import CreateCustomerModal from '../components/customers/CreateCustomerModal';
import RecordDebtPaymentModal from '../components/customers/RecordDebtPaymentModal';
import CustomerDetailModal from '../components/customers/CustomerDetailModal';
import { formatCurrency } from '../utils/formatters';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [filterType, setFilterType] = useState<'all' | 'debt' | 'clean'>('all');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [detailCustomerId, setDetailCustomerId] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const hasDebtParam = filterType === 'debt' ? true : filterType === 'clean' ? false : undefined;
      const [custList, statsData] = await Promise.all([
        customersApi.getCustomers({
          search: debouncedSearch.trim() || undefined,
          has_debt: hasDebtParam,
        }),
        customersApi.getCustomerStats(),
      ]);
      setCustomers(custList);
      setStats(statsData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors du chargement des clients.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenPayment = (customer: Customer) => {
    setPaymentCustomer(customer);
    setIsPaymentModalOpen(true);
  };

  const handleOpenDetail = (customerId: number) => {
    setDetailCustomerId(customerId);
    setIsDetailModalOpen(true);
  };

  const headerActions = (
    <div className="flex items-center gap-2.5">
      <button
        onClick={() => loadData()}
        disabled={loading}
        className="h-10 px-3.5 rounded-[var(--radius-md)] bg-surface hover:bg-surface-hover text-text-secondary hover:text-text border border-border flex items-center gap-2 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        title="Rafraîchir"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-gold' : ''}`} />
        <span>Actualiser</span>
      </button>

      <button
        onClick={() => setIsCreateModalOpen(true)}
        className="h-10 px-4 bg-gold hover:bg-gold-bright text-black font-semibold rounded-[var(--radius-md)] flex items-center gap-2 text-xs transition-all shadow-md active:scale-95 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span>Nouveau Client</span>
      </button>
    </div>
  );

  return (
    <PageContainer
      header={
        <PageHeader
          icon={Users}
          title="Clients & Carnet de Dettes"
          subtitle="Suivi des comptes clients, gestion des créances et historique des règlements"
          actions={headerActions}
        />
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-[var(--radius-md)] bg-danger/10 border border-danger/30 text-danger text-sm">
            {error}
          </div>
        )}

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Créances Totales (Dettes)"
            value={formatCurrency(stats ? stats.total_debt : 0)}
            icon={AlertTriangle}
            variant="amber"
            subValue="À recouvrer auprès des clients"
          />

          <StatCard
            label="Clients Débiteurs"
            value={stats?.customers_with_debt_count ?? 0}
            icon={Users}
            variant="rose"
            subValue="Ayant un solde débiteur actif"
          />

          <StatCard
            label="Recouvré ce mois"
            value={formatCurrency(stats ? stats.repayments_month : 0)}
            icon={TrendingUp}
            variant="emerald"
            subValue="Dettes encaissées ce mois-ci"
          />

          <StatCard
            label="Base Clients"
            value={stats?.total_customers_count ?? 0}
            icon={UserCheck}
            variant="gold"
            subValue="Répertoire actif enregistré"
          />
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-[var(--radius-lg)] bg-surface border border-border">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par nom ou numéro de téléphone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 bg-surface-elevated border border-border rounded-[var(--radius-md)] pl-10 pr-4 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-gold/60 transition-colors"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 bg-surface-elevated p-1 rounded-[var(--radius-md)] border border-border">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-gold text-black shadow-xs font-bold'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              Tous
            </button>
            <button
              type="button"
              onClick={() => setFilterType('debt')}
              className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterType === 'debt'
                  ? 'bg-amber-500 text-black shadow-xs font-bold'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Avec dettes</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('clean')}
              className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterType === 'clean'
                  ? 'bg-emerald-500 text-black shadow-xs font-bold'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>À jour</span>
            </button>
          </div>
        </div>

        {/* Customers Table */}
        <div className="border border-border rounded-[var(--radius-lg)] overflow-hidden bg-surface shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-elevated text-text-secondary border-b border-border uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-6">Client</th>
                  <th className="py-3.5 px-6">Téléphone</th>
                  <th className="py-3.5 px-6">Adresse</th>
                  <th className="py-3.5 px-6 text-right">Dette en cours</th>
                  <th className="py-3.5 px-6 text-right">Plafond Crédit</th>
                  <th className="py-3.5 px-6 text-right">Total Dépensé</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-text-muted">
                      <Loader2 className="w-6 h-6 text-gold animate-spin mx-auto mb-2" />
                      Chargement du carnet de clients...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-text-muted">
                      Aucun client ne correspond à votre recherche.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => {
                    const debtNum = parseFloat(c.current_debt || '0');
                    const limitNum = parseFloat(c.credit_limit || '0');
                    const spentNum = parseFloat(c.total_spent || '0');

                    return (
                      <tr key={c.id} className="hover:bg-surface-hover/60 transition-colors">
                        <td className="py-3.5 px-6 font-semibold text-text">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-gold font-bold text-xs flex-shrink-0">
                              {c.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="block text-text font-bold leading-snug">{c.full_name}</span>
                              {debtNum > 0 ? (
                                <span className="text-[10px] text-amber-400 font-medium">Solde débiteur</span>
                              ) : (
                                <span className="text-[10px] text-emerald-400 font-medium">Compte en règle</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-6 font-mono text-[11px]">
                          <span className="inline-flex items-center gap-1.5 text-text-secondary">
                            <Phone className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                            {c.phone_number}
                          </span>
                        </td>

                        <td className="py-3.5 px-6 text-text-secondary">
                          {c.address ? (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                              {c.address}
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-6 text-right tabular-nums">
                          {debtNum > 0 ? (
                            <Badge variant="warning">
                              {formatCurrency(debtNum)}
                            </Badge>
                          ) : (
                            <span className="text-emerald-400 font-medium tabular-nums">0,00 DH</span>
                          )}
                        </td>

                        <td className="py-3.5 px-6 text-right tabular-nums text-text-secondary">
                          {limitNum > 0 ? formatCurrency(limitNum) : <span className="text-text-muted">—</span>}
                        </td>

                        <td className="py-3.5 px-6 text-right tabular-nums font-semibold text-text">
                          {formatCurrency(spentNum)}
                        </td>

                        <td className="py-3.5 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(c.id)}
                              className="p-1.5 rounded-[var(--radius-sm)] bg-surface-elevated hover:bg-gold/15 text-text-secondary hover:text-gold border border-border transition-colors cursor-pointer"
                              title="Dossier client 360°"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {debtNum > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenPayment(c)}
                                className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-gold hover:bg-gold-bright text-black text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-xs cursor-pointer"
                                title="Régler la dette"
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                <span>Régler</span>
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
      <CreateCustomerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          loadData();
        }}
      />

      <RecordDebtPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentCustomer(null);
        }}
        customer={paymentCustomer}
        onSuccess={() => {
          loadData();
          if (detailCustomerId && isDetailModalOpen) {
            setDetailCustomerId(detailCustomerId);
          }
        }}
      />

      <CustomerDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailCustomerId(null);
        }}
        customerId={detailCustomerId}
        onOpenPaymentModal={(cust) => {
          setIsPaymentModalOpen(true);
          setPaymentCustomer(cust);
        }}
      />
    </PageContainer>
  );
}

