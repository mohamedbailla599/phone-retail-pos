import { useState, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { returnsApi } from '../../api/returns';
import { posApi, type Transaction } from '../../api/sales';
import {
  Search,
  Receipt,
  Smartphone,
  Package,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

interface CreateReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface SaleItemDetail {
  id: number;
  type: 'device' | 'accessory';
  name: string;
  identifier?: string;
  sku?: string;
  price: string;
  quantity: number;
}

interface SaleDetail {
  id: number;
  receipt_id: string;
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
  total_amount: string;
  confirmed_paid: string;
  items: SaleItemDetail[];
}

export default function CreateReturnModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateReturnModalProps) {
  // Step 1 = search ticket, Step 2 = select item & reason
  const [step, setStep] = useState<1 | 2>(1);

  // Search state
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [sales, setSales] = useState<Transaction[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  // Selected sale detail
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<SaleDetail | null>(null);

  // Selected item to return
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [returnQuantity, setReturnQuantity] = useState<number>(1);
  const [reasonPreset, setReasonPreset] = useState<string>('Panne au déballage / Appareil défectueux');
  const [customReason, setCustomReason] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load completed sales
  const loadSales = useCallback(async () => {
    setLoadingSales(true);
    setError(null);
    try {
      const data = await posApi.getTransactions({
        status: 'COMPLETED',
        transaction_type: 'SALE',
        search: debouncedSearch.trim() || undefined,
      });
      setSales(data);
    } catch (err: any) {
      console.error('Failed to load completed sales', err);
      setError('Impossible de charger les ventes complétées.');
    } finally {
      setLoadingSales(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSearch('');
      setSelectedSaleDetail(null);
      setSelectedItemId(null);
      setReturnQuantity(1);
      setError(null);
      loadSales();
    }
  }, [isOpen, loadSales]);

  // Load sale detail when a sale is clicked
  const handleSelectSale = async (sale: Transaction) => {
    setError(null);
    try {
      const detail = await posApi.getTransaction(sale.id);
      setSelectedSaleDetail(detail);
      setStep(2);
      // Auto-select first item if exists
      if (detail.items && detail.items.length > 0) {
        setSelectedItemId(detail.items[0].id);
        setReturnQuantity(1);
      }
    } catch (err: any) {
      console.error('Failed to load sale details', err);
      setError('Impossible de récupérer le détail de ce ticket.');
    }
  };

  const selectedItem = selectedSaleDetail?.items.find((it) => it.id === selectedItemId);

  const calculatedRefundTotal = selectedItem
    ? (parseFloat(selectedItem.price || '0') * returnQuantity).toFixed(2)
    : '0.00';

  const handleSubmitReturn = async () => {
    if (!selectedSaleDetail || !selectedItemId || !selectedItem) {
      setError('Veuillez sélectionner un article à retourner.');
      return;
    }

    const finalReason = customReason.trim()
      ? `${reasonPreset} - ${customReason.trim()}`
      : reasonPreset;

    setSubmitting(true);
    setError(null);

    try {
      await returnsApi.createReturn({
        transaction_id: selectedSaleDetail.id,
        transaction_item_id: selectedItemId,
        quantity: returnQuantity,
        reason: finalReason,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create return', err);
      const detailMsg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'Échec de la création de la demande de retour.';
      setError(detailMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={step === 1 ? 'Nouveau Retour — Choisir le Ticket' : 'Détail du Retour Article'}
      className="max-w-2xl"
    >
      <div className="space-y-4 pt-1">
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1 font-medium">{error}</span>
          </div>
        )}

        {/* STEP 1: Search completed ticket */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par N° ticket (BP-...), nom ou téléphone client..."
                className="w-full pl-9 pr-4 py-2.5 bg-surface-2 border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors"
                autoFocus
              />
            </div>

            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted px-1 flex items-center justify-between">
              <span>Tickets de vente récents</span>
              <span>{sales.length} trouvé{sales.length > 1 ? 's' : ''}</span>
            </div>

            <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {loadingSales ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-text-muted">
                  <Loader2 className="w-6 h-6 animate-spin text-gold" />
                  <span className="text-xs">Recherche des tickets...</span>
                </div>
              ) : sales.length === 0 ? (
                <div className="py-12 text-center text-text-muted text-xs">
                  Aucun ticket de vente complété trouvé.
                </div>
              ) : (
                sales.map((sale) => (
                  <div
                    key={sale.id}
                    onClick={() => handleSelectSale(sale)}
                    className="p-3.5 rounded-lg bg-surface border border-border hover:border-gold/50 hover:bg-gold/5 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold-border flex items-center justify-center text-gold group-hover:scale-105 transition-transform">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-text group-hover:text-gold transition-colors">
                            {sale.receipt_id}
                          </span>
                          <Badge variant="success">Payé</Badge>
                        </div>
                        <div className="text-xs text-text-secondary mt-0.5 flex items-center gap-2">
                          <span>{sale.customer_name || 'Client Comptoir'}</span>
                          {sale.customer_phone && (
                            <>
                              <span className="text-border">•</span>
                              <span className="text-text-muted">{sale.customer_phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      <div>
                        <div className="text-sm font-bold text-gold">
                          {parseFloat(sale.total_amount).toLocaleString()} DH
                        </div>
                        <div className="text-[10px] text-text-muted flex items-center justify-end gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(sale.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-gold group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Choose item to return and specify reason */}
        {step === 2 && selectedSaleDetail && (
          <div className="space-y-4">
            {/* Sale Banner */}
            <div className="p-3 rounded-lg bg-surface-2 border border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Receipt className="w-4 h-4 text-gold" />
                <div>
                  <div className="text-xs font-bold text-text flex items-center gap-2">
                    <span className="font-mono text-gold">{selectedSaleDetail.receipt_id}</span>
                    <span className="text-text-muted font-normal">•</span>
                    <span>{selectedSaleDetail.customer_name || 'Client Comptoir'}</span>
                  </div>
                  <div className="text-[11px] text-text-muted">
                    Total payé : {parseFloat(selectedSaleDetail.total_amount).toLocaleString()} DH
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                className="text-xs gap-1 h-8 text-text-muted hover:text-text"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Changer de ticket
              </Button>
            </div>

            {/* Sold Items Selection */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                1. Sélectionnez l'article à retourner :
              </label>

              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {selectedSaleDetail.items.map((item) => {
                  const isSelected = selectedItemId === item.id;
                  const isDevice = item.type === 'device';

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedItemId(item.id);
                        setReturnQuantity(1);
                      }}
                      className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-gold/10 border-gold shadow-[0_0_12px_rgba(212,175,90,0.1)]'
                          : 'bg-surface border-border hover:border-gold/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isDevice
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {isDevice ? (
                            <Smartphone className="w-4 h-4" />
                          ) : (
                            <Package className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="text-xs font-bold text-text">{item.name}</div>
                          <div className="text-[11px] font-mono text-text-muted flex items-center gap-2 mt-0.5">
                            {item.identifier && (
                              <span>IMEI: {item.identifier}</span>
                            )}
                            {item.sku && <span>SKU: {item.sku}</span>}
                            <span>• Qté vendue: {item.quantity}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-xs font-bold text-gold">
                            {parseFloat(item.price).toLocaleString()} DH
                          </span>
                          <span className="text-[10px] text-text-muted block">
                            / unité
                          </span>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-gold bg-gold text-bg'
                              : 'border-border bg-surface-2'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quantity selection if item allows > 1 */}
            {selectedItem && selectedItem.quantity > 1 && (
              <div className="p-3 rounded-lg bg-surface border border-border flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-text">Quantité à retourner</div>
                  <div className="text-[11px] text-text-muted">
                    Maximum : {selectedItem.quantity} unité{selectedItem.quantity > 1 ? 's' : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReturnQuantity((prev) => Math.max(1, prev - 1))}
                    disabled={returnQuantity <= 1}
                    className="w-7 h-7 rounded border border-border bg-surface-2 flex items-center justify-center text-text disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-bold text-sm text-text">
                    {returnQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setReturnQuantity((prev) => Math.min(selectedItem.quantity, prev + 1))
                    }
                    disabled={returnQuantity >= selectedItem.quantity}
                    className="w-7 h-7 rounded border border-border bg-surface-2 flex items-center justify-center text-text disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Reason Selection */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                2. Motif du retour :
              </label>

              <select
                value={reasonPreset}
                onChange={(e) => setReasonPreset(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-gold"
              >
                <option value="Panne au déballage / Appareil défectueux">
                  Panne au déballage / Appareil défectueux (SAV)
                </option>
                <option value="Incompatibilité / Erreur produit">
                  Incompatibilité / Erreur d'achat
                </option>
                <option value="Rétractation client sous 48h">
                  Rétractation client sous 48h
                </option>
                <option value="Accessoire non fonctionnel">
                  Accessoire défectueux / non fonctionnel
                </option>
                <option value="Autre motif">Autre motif particulier</option>
              </select>

              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Précision additionnelle (facultatif)..."
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-gold"
              />
            </div>

            {/* Refund Total Preview Card */}
            <div className="p-3.5 rounded-lg bg-gold/10 border border-gold-border flex items-center justify-between">
              <div>
                <span className="text-[11px] text-text-muted uppercase font-semibold block">
                  Montant à rembourser (estimé)
                </span>
                <span className="text-base font-extrabold text-gold">
                  {parseFloat(calculatedRefundTotal).toLocaleString()} DH
                </span>
              </div>
              <Badge variant="gold">
                Remboursement sur validation
              </Badge>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={submitting}
                className="text-xs"
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmitReturn}
                loading={submitting}
                className="text-xs gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Enregistrer la Demande de Retour
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
