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
import Sidebar from '../components/layout/Sidebar';
import Badge from '../components/ui/Badge';
import CreateCustomerModal from '../components/customers/CreateCustomerModal';
import RecordDebtPaymentModal from '../components/customers/RecordDebtPaymentModal';
import CustomerDetailModal from '../components/customers/CustomerDetailModal';

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
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text tracking-tight flex items-center gap-2">
                Clients & Carnet de Dettes
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                Suivi des comptes clients, crédits et recouvrements
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData()}
              disabled={loading}
              className="p-2.5 rounded-[var(--radius-md)] bg-surface hover:bg-surface-elevated text-text-secondary border border-border transition-colors"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="h-10 px-4 bg-gold hover:bg-gold-bright text-black font-semibold rounded-[var(--radius-md)] flex items-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Nouveau Client
            </button>
          </div>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-auto p-8 space-y-6">
          <div className="max-w-[1400px] mx-auto space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Receivables / Debt */}
              <div className="p-5 rounded-2xl bg-surface border border-border relative overflow-hidden group hover:border-gold-border/50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Créances Totales (Dettes)
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black font-mono text-amber-400">
                    {stats ? parseFloat(stats.total_debt).toFixed(2) : '0.00'}
                  </span>
                  <span className="text-xs text-text-muted ml-1.5 font-medium">DH</span>
                </div>
                <p className="text-[11px] text-text-muted mt-1">À recouvrer auprès des clients</p>
              </div>

              {/* Card 2: Debtors count */}
              <div className="p-5 rounded-2xl bg-surface border border-border relative overflow-hidden group hover:border-gold-border/50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Clients Débiteurs
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black font-mono text-text">
                    {stats?.customers_with_debt_count ?? 0}
                  </span>
                  <span className="text-xs text-text-muted ml-1.5 font-medium">clients</span>
                </div>
                <p className="text-[11px] text-text-muted mt-1">Ayant un solde débiteur actif</p>
              </div>

              {/* Card 3: Recovered this month */}
              <div className="p-5 rounded-2xl bg-surface border border-border relative overflow-hidden group hover:border-gold-border/50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Recouvré ce mois
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    +{stats ? parseFloat(stats.repayments_month).toFixed(2) : '0.00'}
                  </span>
                  <span className="text-xs text-text-muted ml-1.5 font-medium">DH</span>
                </div>
                <p className="text-[11px] text-text-muted mt-1">Dettes encaissées ce mois-ci</p>
              </div>

              {/* Card 4: Total customers */}
              <div className="p-5 rounded-2xl bg-surface border border-border relative overflow-hidden group hover:border-gold-border/50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Base Clients
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
                    <UserCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black font-mono text-text">
                    {stats?.total_customers_count ?? 0}
                  </span>
                  <span className="text-xs text-text-muted ml-1.5 font-medium">enregistrés</span>
                </div>
                <p className="text-[11px] text-text-muted mt-1">Répertoire actif</p>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-surface border border-border">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou numéro de téléphone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 bg-surface-elevated border border-border rounded-[var(--radius-md)] pl-10 pr-4 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-gold-border transition-colors"
                />
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1.5 bg-surface-elevated p-1 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    filterType === 'all'
                      ? 'bg-gold text-black shadow-sm'
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  Tous
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('debt')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    filterType === 'debt'
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Avec dettes
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('clean')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    filterType === 'clean'
                      ? 'bg-emerald-500 text-black shadow-sm'
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  À jour
                </button>
              </div>
            </div>

            {/* Customers Table */}
            <div className="border border-border rounded-2xl overflow-hidden bg-surface shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-elevated text-text-muted border-b border-border text-xs uppercase font-semibold">
                    <tr>
                      <th className="py-3.5 px-6">Client</th>
                      <th className="py-3.5 px-6">Téléphone</th>
                      <th className="py-3.5 px-6">Adresse</th>
                      <th className="py-3.5 px-6">Dette en cours</th>
                      <th className="py-3.5 px-6">Plafond Crédit</th>
                      <th className="py-3.5 px-6">Total Dépensé</th>
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
                          <tr key={c.id} className="hover:bg-surface-elevated/40 transition-colors">
                            <td className="py-4 px-6 font-semibold text-text">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold-border/40 flex items-center justify-center text-gold font-bold text-xs flex-shrink-0">
                                  {c.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="block text-text font-bold leading-snug">{c.full_name}</span>
                                  {debtNum > 0 ? (
                                    <span className="text-[11px] text-amber-400 font-medium">Solde débiteur</span>
                                  ) : (
                                    <span className="text-[11px] text-emerald-400 font-medium">Compte en règle</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-6 text-text font-mono text-xs">
                              <span className="inline-flex items-center gap-1.5 text-text-secondary">
                                <Phone className="w-3.5 h-3.5 text-text-muted" />
                                {c.phone_number}
                              </span>
                            </td>

                            <td className="py-4 px-6 text-text-secondary text-xs">
                              {c.address ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-text-muted" />
                                  {c.address}
                                </span>
                              ) : (
                                <span className="text-text-muted">—</span>
                              )}
                            </td>

                            <td className="py-4 px-6">
                              {debtNum > 0 ? (
                                <div className="flex items-center gap-2">
                                  <Badge variant="warning">
                                    {debtNum.toFixed(2)} DH
                                  </Badge>
                                </div>
                              ) : (
                                <Badge variant="success">
                                  0.00 DH
                                </Badge>
                              )}
                            </td>

                            <td className="py-4 px-6 font-mono text-xs text-text-secondary">
                              {limitNum.toFixed(2)} DH
                            </td>

                            <td className="py-4 px-6 font-mono text-xs font-semibold text-text">
                              {spentNum.toFixed(2)} DH
                            </td>

                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetail(c.id)}
                                  className="p-2 rounded-lg bg-surface-elevated hover:bg-gold/15 text-text-secondary hover:text-gold border border-border transition-colors"
                                  title="Dossier 360°"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                {debtNum > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPayment(c)}
                                    className="px-3 py-1.5 rounded-lg bg-gold/15 hover:bg-gold/25 text-gold border border-gold/30 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                                    title="Régler la dette"
                                  >
                                    <Banknote className="w-3.5 h-3.5" />
                                    Régler
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
            // refresh detail modal if open
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
    </div>
  );
}
