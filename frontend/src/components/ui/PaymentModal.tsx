import { useState, useEffect } from 'react';
import { X, Loader2, Banknote, CreditCard, User, AlertCircle, ArrowRight, Split } from 'lucide-react';
import Button from './Button';
import PriceDisplay from './PriceDisplay';

interface PaymentCustomerInfo {
  id: number;
  full_name: string;
  phone_number: string;
  current_debt: string;
  credit_limit: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  confirmedPaid?: number;
  customer?: PaymentCustomerInfo | null;
  onSelectCustomerRequest?: () => void;
  onConfirm: (
    method: 'CASH' | 'BANK_TRANSFER' | 'DEBT' | 'MIXED',
    amount: string,
    splitDetails?: { cash: string; debt: string }
  ) => Promise<void>;
}

export default function PaymentModal({
  isOpen,
  onClose,
  totalAmount,
  confirmedPaid = 0,
  customer,
  onSelectCustomerRequest,
  onConfirm,
}: PaymentModalProps) {
  const [method, setMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'DEBT' | 'MIXED'>('CASH');
  const [amount, setAmount] = useState<string>('');
  const [cashAmount, setCashAmount] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const alreadyPaid = confirmedPaid;
  const remainingDue = Math.max(0, totalAmount - alreadyPaid);

  useEffect(() => {
    if (isOpen) {
      setAmount(remainingDue > 0 ? remainingDue.toFixed(2) : totalAmount.toFixed(2));
      setCashAmount('0');
      setMethod('CASH');
      setError('');
    }
  }, [isOpen, totalAmount, remainingDue]);

  if (!isOpen) return null;

  const currentDebt = customer ? parseFloat(customer.current_debt || '0') : 0;
  const creditLimit = customer ? parseFloat(customer.credit_limit || '0') : 0;

  // For pure DEBT
  const payAmount = parseFloat(amount || '0');
  const projectedDebtPure = currentDebt + (isNaN(payAmount) ? 0 : payAmount);
  const isPureLimitExceeded = creditLimit > 0 && projectedDebtPure > creditLimit;

  // For MIXED: cash given now + remaining debt
  const cashGiven = Math.min(remainingDue, Math.max(0, parseFloat(cashAmount || '0') || 0));
  const mixedDebt = Math.max(0, Math.round((remainingDue - cashGiven) * 100) / 100);
  const projectedDebtMixed = currentDebt + mixedDebt;
  const isMixedLimitExceeded = creditLimit > 0 && projectedDebtMixed > creditLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (method === 'MIXED') {
      if (!customer) {
        setError('Veuillez sélectionner un client enregistré pour une vente à crédit.');
        return;
      }
      if (mixedDebt <= 0 && cashGiven <= 0) {
        setError('Veuillez saisir un montant valide.');
        return;
      }
      if (isMixedLimitExceeded) {
        setError(`Le crédit demandé (${mixedDebt.toFixed(2)} DH) dépasse le plafond autorisé (${creditLimit.toFixed(2)} DH).`);
        return;
      }

      try {
        setLoading(true);
        await onConfirm('MIXED', remainingDue.toFixed(2), {
          cash: cashGiven.toFixed(2),
          debt: mixedDebt.toFixed(2),
        });
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Échec du règlement.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Single payment methods (CASH, DEBT, BANK_TRANSFER)
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Veuillez saisir un montant valide.');
      return;
    }

    if (numAmount > remainingDue + 0.009) {
      setError(`Le montant ne peut pas dépasser le reste à payer (${remainingDue.toFixed(2)} DH).`);
      return;
    }

    if (method === 'DEBT') {
      if (!customer) {
        setError('Veuillez sélectionner un client enregistré pour une vente à crédit.');
        return;
      }
      if (isPureLimitExceeded) {
        setError(`Le montant dépasse le plafond de crédit autorisé (${creditLimit.toFixed(2)} DH).`);
        return;
      }
    }

    try {
      setLoading(true);
      await onConfirm(method, amount);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Échec du règlement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg glass-panel rounded-[var(--radius-xl)] shadow-2xl border border-border/50 animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50 bg-surface/50">
          <div>
            <h2 className="text-lg font-bold text-text tracking-tight">Règlement de la Vente</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Choisissez le mode de paiement pour finaliser
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 -mt-2 text-text-muted hover:text-text hover:bg-surface-hover rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 text-xs text-red-200 bg-red-500/10 border border-red-500/20 rounded-lg">
              {error}
            </div>
          )}

          {/* Total Due Banner with partial payment breakdown */}
          <div className="p-4 bg-surface-alt rounded-[var(--radius-lg)] border border-border/50 space-y-1.5">
            <div className="flex justify-between items-center text-xs text-text-muted">
              <span>Total vente</span>
              <span className="font-mono font-medium">{totalAmount.toFixed(2)} DH</span>
            </div>
            {alreadyPaid > 0 && (
              <div className="flex justify-between items-center text-xs text-emerald-400">
                <span>Déjà réglé (acomptes / crédit)</span>
                <span className="font-mono font-semibold">-{alreadyPaid.toFixed(2)} DH</span>
              </div>
            )}
            <div className="flex justify-between items-end pt-1.5 border-t border-border/40">
              <span className="text-sm font-semibold text-text-secondary">Reste à payer</span>
              <PriceDisplay amount={remainingDue} size="lg" highlight />
            </div>
          </div>

          {/* Payment Method Selector (4 options) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Mode de Règlement
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMethod('CASH');
                  setAmount(remainingDue.toFixed(2));
                  setError('');
                }}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-[var(--radius-md)] border transition-all text-xs ${
                  method === 'CASH'
                    ? 'border-gold bg-gold/10 text-gold font-bold shadow-sm'
                    : 'border-border bg-surface text-text-muted hover:bg-surface-alt'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Espèces</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMethod('DEBT');
                  setAmount(remainingDue.toFixed(2));
                  setError('');
                }}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-[var(--radius-md)] border transition-all text-xs ${
                  method === 'DEBT'
                    ? 'border-amber-400 bg-amber-500/15 text-amber-400 font-bold shadow-sm'
                    : 'border-border bg-surface text-text-muted hover:bg-surface-alt'
                }`}
              >
                <User className="w-4 h-4" />
                <span>100% Dette</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMethod('MIXED');
                  setCashAmount('0');
                  setError('');
                }}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-[var(--radius-md)] border transition-all text-xs ${
                  method === 'MIXED'
                    ? 'border-gold bg-gold/15 text-gold font-bold shadow-sm ring-1 ring-gold/40'
                    : 'border-border bg-surface text-text-muted hover:bg-surface-alt'
                }`}
              >
                <Split className="w-4 h-4" />
                <span>Mixte (Cash+Dette)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMethod('BANK_TRANSFER');
                  setAmount(remainingDue.toFixed(2));
                  setError('');
                }}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-[var(--radius-md)] border transition-all text-xs ${
                  method === 'BANK_TRANSFER'
                    ? 'border-blue-400 bg-blue-500/10 text-blue-400 font-bold shadow-sm'
                    : 'border-border bg-surface text-text-muted hover:bg-surface-alt'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Virement</span>
              </button>
            </div>
          </div>

          {/* Client badge if required (DEBT or MIXED) */}
          {(method === 'DEBT' || method === 'MIXED') && (
            <div className="p-3.5 rounded-xl bg-surface border border-amber-500/30 space-y-3 animate-in fade-in duration-150">
              {!customer ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-xs text-amber-300">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>
                      Aucun client sélectionné pour cette vente. Une vente à crédit nécessite d'associer un compte client.
                    </span>
                  </div>
                  {onSelectCustomerRequest && (
                    <button
                      type="button"
                      onClick={onSelectCustomerRequest}
                      className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <User className="w-3.5 h-3.5" />
                      Choisir ou créer un client
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-semibold">Client sélectionné</span>
                      <span className="font-bold text-text">{customer.full_name}</span>
                    </div>
                    {onSelectCustomerRequest && (
                      <button
                        type="button"
                        onClick={onSelectCustomerRequest}
                        className="text-[11px] text-gold hover:underline"
                      >
                        Changer
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-text-muted">Dette actuelle :</span>
                      <span className="font-mono font-semibold text-amber-400 block">
                        {currentDebt.toFixed(2)} DH
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted">Plafond autorisé :</span>
                      <span className="font-mono font-semibold text-text block">
                        {creditLimit > 0 ? `${creditLimit.toFixed(2)} DH` : 'Illimité'}
                      </span>
                    </div>
                  </div>

                  {/* Projected total debt */}
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                    <span className="text-text-muted">Nouvelle dette totale :</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold">
                      <span className="text-text-secondary">{currentDebt.toFixed(2)}</span>
                      <ArrowRight className="w-3 h-3 text-gold" />
                      <span className={(method === 'MIXED' ? isMixedLimitExceeded : isPureLimitExceeded) ? 'text-red-400' : 'text-amber-400'}>
                        {(method === 'MIXED' ? projectedDebtMixed : projectedDebtPure).toFixed(2)} DH
                      </span>
                    </div>
                  </div>

                  {(method === 'MIXED' ? isMixedLimitExceeded : isPureLimitExceeded) && (
                    <p className="text-[11px] text-red-400 font-medium pt-1">
                      ⚠️ Cette vente dépasse le plafond de crédit autorisé pour ce client.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MIXED Payment Controls */}
          {method === 'MIXED' && (
            <div className="p-4 rounded-xl bg-surface-alt border border-border space-y-3 animate-in fade-in duration-150">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-secondary">
                    1. Acompte en Espèces (reçu en caisse) :
                  </label>
                  <span className="text-[11px] text-text-muted">Maximum {remainingDue.toFixed(2)} DH</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={remainingDue}
                    value={cashAmount}
                    onChange={(e) => {
                      setCashAmount(e.target.value);
                      setError('');
                    }}
                    className="w-full h-11 px-3 bg-surface border border-border rounded-[var(--radius-md)] text-sm text-text font-mono font-bold focus:outline-none focus:border-gold-border focus:ring-1 focus:ring-gold/15"
                    placeholder="0.00"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted font-medium">
                    DH
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[20, 50, 100, 200, 500].map((preset) => {
                    if (preset > remainingDue) return null;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCashAmount(preset.toString())}
                        className="px-2 py-0.5 text-[11px] rounded bg-surface hover:bg-gold/15 hover:text-gold border border-border text-text-secondary transition-colors"
                      >
                        +{preset} DH
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setCashAmount((remainingDue / 2).toFixed(2))}
                    className="px-2 py-0.5 text-[11px] rounded bg-surface hover:bg-gold/15 hover:text-gold border border-border text-text-secondary transition-colors"
                  >
                    Moitié ({(remainingDue / 2).toFixed(2)} DH)
                  </button>
                </div>
              </div>

              {/* Calculated Remaining in Debt */}
              <div className="pt-2 border-t border-border/60 flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div>
                  <span className="block text-[11px] font-semibold text-amber-300">
                    2. Reste porté en Dette client :
                  </span>
                  <span className="text-[10px] text-amber-400/80">
                    Sera ajouté au carnet de dettes
                  </span>
                </div>
                <span className="text-base font-black font-mono text-amber-300">
                  {mixedDebt.toFixed(2)} DH
                </span>
              </div>
            </div>
          )}

          {/* Simple Amount Input for CASH, DEBT, or BANK_TRANSFER */}
          {method !== 'MIXED' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Montant à régler
                </label>
                {remainingDue > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(remainingDue.toFixed(2))}
                    className="text-[11px] text-gold hover:underline font-medium"
                  >
                    Tout régler ({remainingDue.toFixed(2)} DH)
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={remainingDue}
                  required
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError('');
                  }}
                  className="w-full h-11 px-3 bg-surface border border-border rounded-[var(--radius-md)] text-sm text-text font-mono font-bold focus:outline-none focus:border-gold-border focus:ring-1 focus:ring-gold/15"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted font-medium">
                  DH
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-4 font-bold shadow-lg"
            disabled={
              loading ||
              (method === 'DEBT' && (!customer || isPureLimitExceeded)) ||
              (method === 'MIXED' && (!customer || isMixedLimitExceeded))
            }
            icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
          >
            {loading
              ? 'Traitement en cours...'
              : method === 'MIXED'
              ? `Valider la Vente (${cashGiven.toFixed(2)} DH Espèces + ${mixedDebt.toFixed(2)} DH Dette)`
              : method === 'DEBT'
              ? `Confirmer la Vente à Crédit (${parseFloat(amount || '0').toFixed(2)} DH)`
              : method === 'BANK_TRANSFER'
              ? `Enregistrer le Virement (${parseFloat(amount || '0').toFixed(2)} DH)`
              : `Valider le Paiement Espèces (${parseFloat(amount || '0').toFixed(2)} DH)`}
          </Button>
        </form>
      </div>
    </div>
  );
}
