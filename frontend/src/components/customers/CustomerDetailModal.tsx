import { useState, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { customersApi, type CustomerDetail, type Customer } from '../../api/customers';
import {
  User,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Banknote,
  Receipt,
  Loader2,
  PlusCircle,
} from 'lucide-react';

interface CustomerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: number | null;
  onOpenPaymentModal: (customer: Customer) => void;
}

export default function CustomerDetailModal({
  isOpen,
  onClose,
  customerId,
  onOpenPaymentModal,
}: CustomerDetailModalProps) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'payments' | 'transactions'>('payments');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadCustomer = useCallback(async (id: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await customersApi.getCustomer(id);
      setCustomer(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Impossible de charger la fiche client.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && customerId) {
      loadCustomer(customerId);
      setActiveTab('payments');
    } else {
      setCustomer(null);
    }
  }, [isOpen, customerId, loadCustomer]);

  if (!isOpen) return null;

  const currentDebt = customer ? parseFloat(customer.current_debt || '0') : 0;
  const creditLimit = customer ? parseFloat(customer.credit_limit || '0') : 0;
  const totalSpent = customer ? parseFloat(customer.total_spent || '0') : 0;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Fiche Client & Carnet de Dettes"
      className="max-w-3xl"
    >
      <div className="space-y-6 pt-2">
        {loading && !customer && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-text-muted">
            <Loader2 className="w-8 h-8 text-gold animate-spin" />
            <span className="text-sm">Chargement du dossier client...</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {customer && (
          <>
            {/* Header / Client Card */}
            <div className="p-5 rounded-2xl bg-surface border border-border relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-gold/15 border border-gold-border flex items-center justify-center text-gold font-bold text-lg flex-shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-text">{customer.full_name}</h3>
                      {currentDebt > 0 ? (
                        <Badge variant="warning">
                          En dette
                        </Badge>
                      ) : (
                        <Badge variant="success">
                          Solvable / À jour
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-text-muted" />
                        {customer.phone_number}
                      </span>
                      {customer.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-text-muted" />
                          {customer.address}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-text-muted">
                        <Calendar className="w-3.5 h-3.5" />
                        Client depuis {new Date(customer.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </div>

                {currentDebt > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      onOpenPaymentModal(customer);
                    }}
                    className="flex-shrink-0 self-start sm:self-auto gap-2"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Régler dette
                  </Button>
                )}
              </div>

              {/* Financial Snapshot Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-border">
                <div className="p-3 rounded-xl bg-surface-elevated border border-border/80">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-amber-400" />
                    Dette en cours
                  </span>
                  <p className={`text-xl font-bold font-mono mt-1 ${currentDebt > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {currentDebt.toFixed(2)} <span className="text-xs font-normal text-text-muted">DH</span>
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-border/80">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-gold" />
                    Plafond autorisé
                  </span>
                  <p className="text-xl font-bold font-mono text-text mt-1">
                    {creditLimit.toFixed(2)} <span className="text-xs font-normal text-text-muted">DH</span>
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-border/80">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-blue-400" />
                    Total Achats
                  </span>
                  <p className="text-xl font-bold font-mono text-text mt-1">
                    {totalSpent.toFixed(2)} <span className="text-xs font-normal text-text-muted">DH</span>
                  </p>
                </div>
              </div>

              {customer.notes && (
                <div className="mt-4 p-3 rounded-xl bg-bg border border-border text-xs text-text-secondary">
                  <span className="font-semibold text-text">Notes client : </span>
                  {customer.notes}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-border">
              <button
                type="button"
                onClick={() => setActiveTab('payments')}
                className={`pb-2.5 px-3 text-sm font-semibold transition-colors relative ${
                  activeTab === 'payments'
                    ? 'text-gold border-b-2 border-gold -mb-px'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Règlements de dette ({customer.debt_payments?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('transactions')}
                className={`pb-2.5 px-3 text-sm font-semibold transition-colors relative ${
                  activeTab === 'transactions'
                    ? 'text-gold border-b-2 border-gold -mb-px'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Historique des achats ({customer.recent_transactions?.length || 0})
              </button>
            </div>

            {/* Tab 1: Debt Payments History */}
            {activeTab === 'payments' && (
              <div className="space-y-3">
                {(!customer.debt_payments || customer.debt_payments.length === 0) ? (
                  <div className="py-8 text-center text-text-muted border border-dashed border-border rounded-xl">
                    <p className="text-sm">Aucun historique de versement enregistré.</p>
                  </div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden bg-surface">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-elevated text-text-muted border-b border-border uppercase font-medium">
                        <tr>
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-4">Montant versé</th>
                          <th className="py-2.5 px-4">Mode</th>
                          <th className="py-2.5 px-4">Opérateur</th>
                          <th className="py-2.5 px-4">Remarques</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {customer.debt_payments.map((p) => (
                          <tr key={p.id} className="hover:bg-surface-elevated/50 transition-colors">
                            <td className="py-3 px-4 text-text font-mono">
                              {new Date(p.created_at).toLocaleString('fr-FR')}
                            </td>
                            <td className="py-3 px-4 font-bold font-mono text-emerald-400">
                              +{parseFloat(p.amount).toFixed(2)} DH
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-elevated border border-border text-text">
                                {p.payment_method}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-text-secondary">
                              {p.operator_name || '—'}
                            </td>
                            <td className="py-3 px-4 text-text-muted">
                              {p.notes || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Recent Transactions */}
            {activeTab === 'transactions' && (
              <div className="space-y-3">
                {(!customer.recent_transactions || customer.recent_transactions.length === 0) ? (
                  <div className="py-8 text-center text-text-muted border border-dashed border-border rounded-xl">
                    <p className="text-sm">Aucune vente ou transaction liée à ce client.</p>
                  </div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden bg-surface">
                    <table className="w-full text-left text-xs">
                      <tbody className="divide-y divide-border">
                        <tr className="bg-surface-elevated text-text-muted uppercase font-medium">
                          <th className="py-2.5 px-4">Reçu</th>
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-4">Type</th>
                          <th className="py-2.5 px-4">Statut</th>
                          <th className="py-2.5 px-4 text-right">Montant</th>
                        </tr>
                        {customer.recent_transactions.map((t) => (
                          <tr key={t.id} className="hover:bg-surface-elevated/50 transition-colors">
                            <td className="py-3 px-4 font-mono font-semibold text-text">
                              {t.receipt_id || `#${t.id}`}
                            </td>
                            <td className="py-3 px-4 text-text-secondary">
                              {new Date(t.created_at).toLocaleString('fr-FR')}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-surface-elevated border border-border text-text">
                                {t.transaction_type}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={t.status === 'COMPLETED' ? 'success' : 'default'}>
                                {t.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right font-bold font-mono text-text">
                              {parseFloat(t.total_amount).toFixed(2)} DH
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-end pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
