import { useState, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { customersApi, type Customer } from '../../api/customers';
import CreateCustomerModal from './CreateCustomerModal';
import { Search, User, Phone, Plus, Loader2, Check, UserX } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

interface SelectCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCustomerId?: number | null;
  onSelectCustomer: (customer: Customer | null) => void;
}

export default function SelectCustomerModal({
  isOpen,
  onClose,
  selectedCustomerId,
  onSelectCustomer,
}: SelectCustomerModalProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customersApi.getCustomers(debouncedSearch.trim() || undefined);
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers for selection', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (isOpen) {
      loadCustomers();
    } else {
      setSearch('');
    }
  }, [isOpen, loadCustomers]);

  if (!isOpen) return null;

  return (
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        title="Sélectionner un Client"
        className="max-w-lg"
      >
        <div className="space-y-4 pt-2">
          {/* Top Actions: Search + Add New */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher nom ou téléphone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full h-10 bg-surface-alt border border-border rounded-[var(--radius-md)] pl-10 pr-4 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-gold-border focus:ring-2 focus:ring-gold/20 transition-all"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex-shrink-0 gap-1.5 h-10 px-3.5"
            >
              <Plus className="w-4 h-4" />
              Nouveau
            </Button>
          </div>

          {/* Quick Option: Anonymous / Passage */}
          <button
            type="button"
            onClick={() => {
              onSelectCustomer(null);
              onClose();
            }}
            className={`w-full p-3 rounded-[var(--radius-md)] border flex items-center justify-between text-left transition-all cursor-pointer ${
              !selectedCustomerId
                ? 'bg-gold/15 border-gold-border text-gold shadow-sm'
                : 'bg-surface-alt hover:bg-surface-elevated border-border text-text-secondary hover:text-text hover:border-border-focus'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-elevated border border-border flex items-center justify-center text-text-muted">
                <UserX className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-text">Client de passage</p>
                <p className="text-[11px] text-text-muted">Vente sans compte client attitré</p>
              </div>
            </div>
            {!selectedCustomerId && <Check className="w-4 h-4 text-gold" />}
          </button>

          {/* Customer list */}
          <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1">
            {loading && customers.length === 0 ? (
              <div className="py-8 text-center text-text-muted">
                <Loader2 className="w-6 h-6 text-gold animate-spin mx-auto mb-2" />
                Recherche des clients...
              </div>
            ) : customers.length === 0 ? (
              <div className="py-8 text-center text-text-muted text-xs border border-dashed border-border rounded-[var(--radius-md)]">
                Aucun client trouvé pour "{search}".
              </div>
            ) : (
              customers.map((c) => {
                const isSelected = selectedCustomerId === c.id;
                const debtNum = parseFloat(c.current_debt || '0');
                const limitNum = parseFloat(c.credit_limit || '0');

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onSelectCustomer(c);
                      onClose();
                    }}
                    className={`w-full p-3 rounded-[var(--radius-md)] border flex items-center justify-between text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gold/15 border-gold-border shadow-sm'
                        : 'bg-surface-alt hover:bg-surface-elevated border-border hover:border-border-focus'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gold/15 border border-gold-border/50 flex items-center justify-center text-gold font-bold text-xs flex-shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text">{c.full_name}</p>
                        <p className="text-[11px] text-text-secondary flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-text-muted" />
                          {c.phone_number}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {debtNum > 0 ? (
                        <Badge variant="warning">
                          Dette: {debtNum.toFixed(2)} DH
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-emerald-500 font-medium">À jour</span>
                      )}
                      {limitNum > 0 && (
                        <span className="text-[10px] text-text-muted">
                          Plafond: {limitNum.toFixed(0)} DH
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <Button variant="ghost" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Quick customer creation modal */}
      <CreateCustomerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(newCustomer) => {
          loadCustomers();
          onSelectCustomer(newCustomer);
          onClose();
        }}
      />
    </>
  );
}
