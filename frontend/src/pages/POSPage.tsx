import { useEffect, useState, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { usePosStore } from '../store/posStore';
import { useAuthStore } from '../store/authStore';
import { posApi, type CatalogItem } from '../api/sales';
import Sidebar from '../components/layout/Sidebar';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import PriceDisplay from '../components/ui/PriceDisplay';
import OperatorSelectionModal from '../components/ui/OperatorSelectionModal';
import PaymentModal from '../components/ui/PaymentModal';
import PendingPaymentModal from '../components/ui/PendingPaymentModal';
import ReceiptPrint from '../components/ui/ReceiptPrint';
import SelectCustomerModal from '../components/customers/SelectCustomerModal';
import { type Customer } from '../api/customers';
import {
  Search,
  ScanBarcode,
  Trash2,
  Phone,
  Headphones,
  ShoppingCart,
  QrCode,
  Printer,
  Banknote,
  Wifi,
  WifiOff,
  User,
  Plus,
} from 'lucide-react';

type PendingAction = 
  | { type: 'add_item'; payload: CatalogItem }
  | { type: 'pair_scanner' }
  | { type: 'checkout' }
  | null;

export default function POSPage() {
  const { transaction, setTransaction, clearCart } = usePosStore();
  const { operator } = useAuthStore();
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'device' | 'accessory'>('all');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isPendingPaymentModalOpen, setIsPendingPaymentModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [discountValue, setDiscountValue] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchTransaction = useCallback(async (txId: number | string) => {
    try {
      const data = await posApi.getTransaction(txId);
      if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
        usePosStore.getState().clearCart();
        setTransaction(null);
        return;
      }
      setTransaction(data);
    } catch (e: any) {
      if (e.response?.status === 404) {
        usePosStore.getState().clearCart();
        setTransaction(null);
      } else {
        console.error("Failed to fetch transaction", e);
      }
    }
  }, [setTransaction]);

  useEffect(() => {
    loadCatalog();
    const currentTxId = usePosStore.getState().transaction?.id;
    if (currentTxId) {
      fetchTransaction(currentTxId);
    }
  }, []);

  const loadCatalog = async () => {
    try {
      const data = await posApi.getCatalog();
      setCatalog(data);
    } catch (e) {
      console.error("Failed to load catalog", e);
    }
  };

  // WebSocket connection
  useEffect(() => {
    if (!transaction?.id) return;
    setWsStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/cart/${transaction.id}/`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setWsStatus('connected');
    ws.onclose = () => setWsStatus('disconnected');
    ws.onerror = () => setWsStatus('disconnected');

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'cart.updated') {
        // Fetch authoritative state from backend
        fetchTransaction(transaction.id);
      }
    };

    return () => { ws.close(); };
  }, [transaction?.id, fetchTransaction]);

  // Keyboard shortcut: focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const executeAddItem = async (product: CatalogItem) => {
    try {
      setErrorMsg('');
      let currentTxId = transaction?.id;
      if (!currentTxId) {
        const sale = await posApi.createDraftSale();
        currentTxId = sale.id;
      }
      let updatedTx;
      try {
        updatedTx = await posApi.addItemToSale(currentTxId, product.id);
      } catch (addErr: any) {
        if (addErr.response?.status === 404) {
          clearCart();
          setTransaction(null);
          const sale = await posApi.createDraftSale();
          currentTxId = sale.id;
          updatedTx = await posApi.addItemToSale(currentTxId, product.id);
        } else {
          throw addErr;
        }
      }
      if (updatedTx.error) {
        setErrorMsg(updatedTx.error);
      } else {
        fetchTransaction(currentTxId);
      }
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Failed to add item');
      console.error("Failed to add item", e);
    }
  };

  const handleProductClick = (product: CatalogItem) => {
    if (transaction?.status === 'PENDING_PAYMENT') return; // Cart locked

    if (!operator) {
      setPendingAction({ type: 'add_item', payload: product });
      setIsOpModalOpen(true);
    } else {
      executeAddItem(product);
    }
  };

  const handleRemoveItem = async (itemId: number) => {
    if (!transaction?.id) return;
    try {
      setErrorMsg('');
      await posApi.removeItem(transaction.id, itemId);
      fetchTransaction(transaction.id);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Failed to remove item');
    }
  };

  const handleUpdateQuantity = async (itemId: number, productId: number, currentQty: number, delta: number) => {
    if (!transaction?.id) return;
    try {
      setErrorMsg('');
      if (delta > 0) {
        await posApi.addItemToSale(transaction.id, productId);
      } else if (delta < 0 && currentQty > 1) {
        await posApi.removeItem(transaction.id, itemId, 1);
      } else if (delta < 0 && currentQty === 1) {
        await posApi.removeItem(transaction.id, itemId);
      }
      fetchTransaction(transaction.id);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Failed to update quantity');
    }
  };

  const handleDiscountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction?.id) return;
    try {
      setErrorMsg('');
      await posApi.setDiscount(transaction.id, discountValue || 0);
      setIsEditingDiscount(false);
      fetchTransaction(transaction.id);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Failed to set discount');
    }
  };

  const executePairScanner = async () => {
    try {
      let currentTxId = transaction?.id;
      if (!currentTxId) {
        const sale = await posApi.createDraftSale();
        currentTxId = sale.id;
        fetchTransaction(currentTxId);
      }
      window.open(`/scanner/${currentTxId}`, '_blank', 'width=420,height=800');
    } catch (e) {
      console.error("Failed to pair scanner", e);
    }
  };

  const handleScannerClick = () => {
    if (!operator) {
      setPendingAction({ type: 'pair_scanner' });
      setIsOpModalOpen(true);
    } else {
      executePairScanner();
    }
  };

  const executeCheckout = async () => {
    try {
      setErrorMsg('');
      if (!transaction?.id) return;
      if (transaction.status === 'DRAFT') {
        await posApi.checkout(transaction.id);
        await fetchTransaction(transaction.id);
      }
      setIsPaymentModalOpen(true);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Checkout failed');
    }
  };

  const handleUnlockCart = async () => {
    if (!transaction?.id) return;
    try {
      setErrorMsg('');
      await posApi.cancelCheckout(transaction.id);
      await fetchTransaction(transaction.id);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Failed to unlock cart');
    }
  };

  const handleCheckoutClick = () => {
    if (transaction?.status === 'PENDING_PAYMENT' && (transaction.pending_payments?.length ?? 0) > 0) {
      setIsPendingPaymentModalOpen(true);
      return;
    }

    if (!operator) {
      setPendingAction({ type: 'checkout' });
      setIsOpModalOpen(true);
    } else {
      executeCheckout();
    }
  };

  const handleCustomerSelect = async (selectedCustomer: Customer | null) => {
    try {
      setErrorMsg('');
      let currentTxId = transaction?.id;
      if (!currentTxId) {
        const sale = await posApi.createDraftSale();
        currentTxId = sale.id;
      }
      const updated = await posApi.assignCustomer(currentTxId, selectedCustomer ? selectedCustomer.id : null);
      setTransaction(updated);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Impossible d'associer le client");
    }
  };

  const handlePaymentConfirm = async (
    method: 'CASH' | 'BANK_TRANSFER' | 'DEBT' | 'MIXED',
    amount: string,
    splitDetails?: { cash: string; debt: string }
  ) => {
    if (!transaction?.id) return;
    try {
      if (method === 'MIXED') {
        if (splitDetails) {
          const cashNum = parseFloat(splitDetails.cash || '0');
          const debtNum = parseFloat(splitDetails.debt || '0');

          await posApi.addPayment(transaction.id, amount, 'MIXED', {
            cash: cashNum.toFixed(2),
            debt: debtNum.toFixed(2),
          });

          const finalTx = await posApi.completeSale(transaction.id);
          setTransaction(finalTx);
          setIsPaymentModalOpen(false);
          setSuccessMsg(`Vente finalisée avec succès (Espèces: ${cashNum.toFixed(2)} DH, Dette: ${debtNum.toFixed(2)} DH) ! Reçu : ${finalTx.receipt_id || finalTx.id}`);
          loadCatalog();
        }
        return;
      }

      const updatedTx = await posApi.addPayment(transaction.id, amount, method);
      setTransaction(updatedTx);
      setIsPaymentModalOpen(false);

      if (method === 'BANK_TRANSFER') {
        setSuccessMsg(`Virement bancaire enregistré en attente de confirmation.`);
      } else {
        const total = parseFloat(updatedTx.total_amount || '0');
        const paid = parseFloat(updatedTx.confirmed_paid || '0');

        if (paid >= total - 0.009) {
          const finalTx = await posApi.completeSale(transaction.id);
          setTransaction(finalTx);
          setSuccessMsg(`Vente finalisée avec succès ! Reçu : ${finalTx.receipt_id || finalTx.id}`);
        } else {
          const remaining = Math.max(0, total - paid);
          setSuccessMsg(`Règlement de ${amount} DH (${method}) enregistré. Reste à payer : ${remaining.toFixed(2)} DH.`);
        }
      }
      
      loadCatalog();
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || "Échec du règlement");
    }
  };

  const handleConfirmPendingPayment = async (paymentId: number) => {
    if (!transaction?.id) return;
    try {
      const updatedTx = await posApi.confirmPayment(transaction.id, paymentId);
      setTransaction(updatedTx);
      setIsPendingPaymentModalOpen(false);
      setSuccessMsg("Payment confirmed.");
      
      // Attempt to complete sale if fully paid
      try {
        const finalTx = await posApi.completeSale(transaction.id);
        setTransaction(finalTx);
        setSuccessMsg(`Sale completed successfully! Receipt: ${finalTx.receipt_id || finalTx.id}`);
      } catch (e: any) {
        // Just means it wasn't fully paid or another error
      }
      loadCatalog();
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || "Failed to confirm payment");
    }
  };

  const handleRejectPendingPayment = async (paymentId: number) => {
    if (!transaction?.id) return;
    try {
      const updatedTx = await posApi.rejectPayment(transaction.id, paymentId);
      setTransaction(updatedTx);
      setIsPendingPaymentModalOpen(false);
      setErrorMsg("Bank transfer rejected. Please retry payment.");
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || "Failed to reject payment");
    }
  };

  const handlePaymentCancel = async () => {
    setIsPaymentModalOpen(false);
    const alreadyPaid = parseFloat(transaction?.confirmed_paid || '0');
    if (transaction?.id && transaction.status === 'PENDING_PAYMENT' && alreadyPaid === 0) {
      try {
        await posApi.cancelCheckout(transaction.id);
        fetchTransaction(transaction.id);
      } catch (e) {
        console.error("Failed to cancel checkout", e);
      }
    }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = "Bighrissen Phone — Receipt";
    window.print();
    document.title = originalTitle;
  };

  const startNewSale = () => {
    clearCart();
    setTransaction(null);
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleCancelSale = async () => {
    if (!transaction?.id) {
      clearCart();
      setTransaction(null);
      setIsCancelModalOpen(false);
      return;
    }
    try {
      await posApi.cancelSale(transaction.id);
      setIsCancelModalOpen(false);
      clearCart();
      setTransaction(null);
      setSuccessMsg("Vente annulée avec succès. Nouveau panier prêt.");
    } catch (e: any) {
      clearCart();
      setTransaction(null);
      setIsCancelModalOpen(false);
      setSuccessMsg("Panier réinitialisé.");
    }
  };

  const onOperatorSelected = () => {
    setIsOpModalOpen(false);
    if (pendingAction) {
      if (pendingAction.type === 'add_item') {
        executeAddItem(pendingAction.payload);
      } else if (pendingAction.type === 'pair_scanner') {
        executePairScanner();
      } else if (pendingAction.type === 'checkout') {
        executeCheckout();
      }
      setPendingAction(null);
    }
  };

  const devicesCount = catalog.filter((p) => p.type === 'device').length;
  const accessoriesCount = catalog.filter((p) => p.type === 'accessory').length;

  const filteredCatalog = catalog.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.sub && p.sub.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      categoryFilter === 'all' || p.type === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const isDraft = !transaction || transaction.status === 'DRAFT';
  const isCompleted = transaction?.status === 'COMPLETED';
  const isPendingPayment = transaction?.status === 'PENDING_PAYMENT';

  return (
    <div className="h-screen flex bg-bg overflow-hidden print:h-auto print:bg-white print:overflow-visible">
      
      {/* Receipt for Printing */}
      <ReceiptPrint transaction={transaction} operator={operator} />

      {/* POS UI (Hidden when printing) */}
      <div className="print:hidden flex flex-1 h-full overflow-hidden w-full">
        <Sidebar />

        {/* Main POS Area */}
        <div className="flex-1 flex flex-col lg:flex-row min-w-0">
        
        {/* LEFT: Product search & catalog */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border relative">
          {successMsg && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm font-medium rounded-lg shadow-lg">
              {successMsg}
              <button onClick={startNewSale} className="ml-4 underline hover:text-emerald-400">Start New Sale</button>
            </div>
          )}
          {errorMsg && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium rounded-lg shadow-lg">
              {errorMsg}
              <button onClick={() => setErrorMsg('')} className="ml-4 hover:text-red-400">&times;</button>
            </div>
          )}
          
          {/* Search Bar & Filter Pills */}
          <div className="px-6 py-4 border-b border-border bg-surface/50">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un produit, code-barres ou scan IMEI..."
                className="w-full h-11 pl-10 pr-20 bg-surface-alt border border-border rounded-[var(--radius-md)] text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-gold-border focus:ring-1 focus:ring-gold/15 transition-smooth"
                autoFocus
                disabled={!isDraft}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <kbd className="hidden sm:inline-flex h-5 px-1.5 items-center rounded text-[10px] font-semibold text-text-muted bg-surface-elevated border border-border shadow-xs">/</kbd>
                <ScanBarcode className="w-4 h-4 text-text-muted" />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 mt-3 pt-0.5">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={clsx(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                  categoryFilter === 'all'
                    ? 'bg-gold text-black shadow-sm font-bold'
                    : 'bg-surface-alt text-text-secondary hover:text-text hover:bg-surface-elevated border border-border'
                )}
              >
                <span>Tous</span>
                <span
                  className={clsx(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                    categoryFilter === 'all' ? 'bg-black/20 text-black' : 'bg-surface text-text-muted'
                  )}
                >
                  {catalog.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCategoryFilter('device')}
                className={clsx(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                  categoryFilter === 'device'
                    ? 'bg-gold text-black shadow-sm font-bold'
                    : 'bg-surface-alt text-text-secondary hover:text-text hover:bg-surface-elevated border border-border'
                )}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Téléphones</span>
                <span
                  className={clsx(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                    categoryFilter === 'device' ? 'bg-black/20 text-black' : 'bg-surface text-text-muted'
                  )}
                >
                  {devicesCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCategoryFilter('accessory')}
                className={clsx(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                  categoryFilter === 'accessory'
                    ? 'bg-gold text-black shadow-sm font-bold'
                    : 'bg-surface-alt text-text-secondary hover:text-text hover:bg-surface-elevated border border-border'
                )}
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Accessoires</span>
                <span
                  className={clsx(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                    categoryFilter === 'accessory' ? 'bg-black/20 text-black' : 'bg-surface text-text-muted'
                  )}
                >
                  {accessoriesCount}
                </span>
              </button>
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                {categoryFilter === 'device'
                  ? 'Téléphones & Appareils'
                  : categoryFilter === 'accessory'
                  ? 'Accessoires'
                  : 'Tous les produits'}
              </h2>
              <span className="text-xs text-text-muted">{filteredCatalog.length} articles</span>
            </div>

            {filteredCatalog.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center text-text-muted mb-3">
                  {categoryFilter === 'device' ? (
                    <Phone className="w-6 h-6" />
                  ) : categoryFilter === 'accessory' ? (
                    <Headphones className="w-6 h-6" />
                  ) : (
                    <Search className="w-6 h-6" />
                  )}
                </div>
                <h3 className="text-sm font-semibold text-text">Aucun article trouvé</h3>
                <p className="text-xs text-text-muted mt-1 max-w-xs">
                  {searchQuery
                    ? `Aucun résultat pour "${searchQuery}" dans cette sélection.`
                    : 'Aucun article disponible pour ce filtre.'}
                </p>
                {(searchQuery || categoryFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('all');
                    }}
                    className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gold bg-gold/10 border border-gold-border hover:bg-gold/20 transition-colors cursor-pointer"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                {filteredCatalog.map((product) => {
                  const Icon = product.type === 'device' ? Phone : Headphones;
                  const isLowStock = product.stock_count <= 2;
                  return (
                    <button
                      key={product.id}
                      onClick={() => handleProductClick(product)}
                      className="group flex flex-col p-3.5 rounded-[var(--radius-lg)] bg-surface border border-border hover:border-gold/50 hover:shadow-md text-left transition-all duration-200 cursor-pointer relative overflow-hidden"
                    >
                      <div className="w-full h-24 rounded-[var(--radius-md)] bg-surface-elevated/70 mb-2.5 flex items-center justify-center relative border border-border/40 group-hover:border-gold/20 transition-colors">
                        <Icon className="w-7 h-7 text-text-muted group-hover:text-gold group-hover:scale-110 transition-all duration-200" />
                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-surface/90 border border-border text-text-muted">
                          {product.type === 'device' ? 'Tél' : 'Acc'}
                        </span>
                      </div>
                      <h3 className="text-xs font-semibold text-text truncate group-hover:text-gold transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-[11px] text-text-muted truncate min-h-[16px]">
                        {product.sub || '—'}
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between">
                        <PriceDisplay amount={parseFloat(product.price)} size="sm" highlight />
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isLowStock
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                          }`}
                        >
                          {product.stock_count} en stock
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Cart Panel */}
        <aside className="w-full lg:w-[380px] xl:w-[400px] flex flex-col bg-surface flex-shrink-0">
          
          {/* Cart Header */}
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gold" />
              <h2 className="text-sm font-semibold text-text">
                {isCompleted ? `Reçu ${transaction.receipt_id || transaction.id}` : 'Vente en cours'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {isCompleted ? (
                <button
                  type="button"
                  onClick={startNewSale}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-gold text-black hover:bg-gold-light transition-all shadow-sm active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nouvelle Vente
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    {wsStatus === 'connected' ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                        <Wifi className="w-3 h-3" /> Scanner
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-text-muted" title="Scanner déconnecté">
                        <WifiOff className="w-3 h-3" />
                      </span>
                    )}
                    <Badge variant={transaction?.items?.length ? 'gold' : 'default'}>
                      {transaction?.items?.length || 0} articles
                    </Badge>
                  </div>
                  {transaction && (transaction.items?.length || transaction.status === 'PENDING_PAYMENT') && (
                    <button
                      type="button"
                      onClick={() => setIsCancelModalOpen(true)}
                      className="p-1 rounded-md text-text-muted hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
                      title="Annuler cette vente et recommencer à zéro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Customer Selection Bar */}
          <div className="px-5 py-2.5 border-b border-border/80 bg-surface-elevated/40">
            {transaction?.customer ? (
              <div className="flex items-center justify-between gap-2">
                <div 
                  onClick={() => isDraft && setIsCustomerModalOpen(true)}
                  className={`flex items-center gap-2.5 min-w-0 ${isDraft ? 'cursor-pointer group' : ''}`}
                >
                  <div className="w-7 h-7 rounded-full bg-gold/15 border border-gold-border/40 flex items-center justify-center text-gold text-xs font-bold flex-shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-text truncate group-hover:text-gold transition-colors">
                        {transaction.customer.full_name}
                      </p>
                      {parseFloat(transaction.customer.current_debt || '0') > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-mono font-medium">
                          Dette: {parseFloat(transaction.customer.current_debt).toFixed(0)} DH
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-muted truncate">{transaction.customer.phone_number}</p>
                  </div>
                </div>

                {isDraft && (
                  <button
                    type="button"
                    onClick={() => handleCustomerSelect(null)}
                    title="Dissocier le client"
                    className="p-1 text-text-muted hover:text-red-400 rounded-full hover:bg-surface transition-colors"
                  >
                    &times;
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => isDraft && setIsCustomerModalOpen(true)}
                disabled={!isDraft}
                className="w-full py-1.5 px-3 rounded-lg border border-dashed border-border hover:border-gold-border/60 bg-surface/40 hover:bg-gold/5 text-text-secondary hover:text-gold text-xs font-medium flex items-center justify-center gap-1.5 transition-all active:scale-[0.99]"
              >
                <User className="w-3.5 h-3.5 text-text-muted" />
                <span>+ Associer un Client (ou Vente à crédit)</span>
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto printable-receipt">
            {!transaction?.items?.length ? (
              <div className="h-full flex flex-col items-center justify-center text-text-muted gap-3 px-6">
                <ShoppingCart className="w-10 h-10 opacity-20" />
                <p className="text-sm">Scan or add products</p>
                <p className="text-xs text-text-muted/60">Press / to search</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {transaction.items.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="group flex items-center gap-3 px-5 py-3.5 hover:bg-surface-hover transition-colors"
                  >
                    {/* Item icon */}
                    <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-surface-alt border border-border flex items-center justify-center flex-shrink-0 print:hidden">
                      {item.type === 'device' ? (
                        <Phone className="w-4 h-4 text-text-muted" />
                      ) : (
                        <Headphones className="w-4 h-4 text-text-muted" />
                      )}
                    </div>

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-medium text-text truncate">{item.name}</h4>
                      {(item.identifier || item.sku) && (
                        <p className="text-[10px] text-text-muted font-mono mt-0.5 truncate">
                          {item.identifier ? `IMEI: ${item.identifier}` : item.sku}
                        </p>
                      )}
                      {item.type === 'accessory' && (
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[11px] text-text-muted">
                            Qty: {item.quantity}
                          </p>
                          <p className="text-[11px] text-text-muted">
                            {parseFloat(item.price).toFixed(2)} DH × {item.quantity} = {(parseFloat(item.price) * (item.quantity || 1)).toFixed(2)} DH
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Quantity Controls & Price */}
                    <div className="flex flex-col items-end gap-1">
                      <PriceDisplay amount={parseFloat(item.price) * (item.quantity || 1)} size="sm" />
                      {isDraft && item.type === 'accessory' && (
                        <div className="flex items-center gap-1 bg-surface rounded-md border border-border">
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.product_id!, item.quantity || 1, -1)}
                            className="p-1 text-text-muted hover:text-text hover:bg-surface-alt transition-fast"
                          >
                            <span className="w-3 h-3 flex items-center justify-center font-bold">-</span>
                          </button>
                          <span className="text-[11px] font-medium w-4 text-center">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.product_id!, item.quantity || 1, 1)}
                            className="p-1 text-text-muted hover:text-text hover:bg-surface-alt transition-fast"
                          >
                            <span className="w-3 h-3 flex items-center justify-center font-bold">+</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Remove */}
                    {isDraft && (
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="print:hidden opacity-0 group-hover:opacity-100 p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-red-400 hover:bg-danger/10 transition-fast"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout Footer */}
          <div className="border-t border-border bg-surface-alt p-5 space-y-4 flex flex-col relative">
            {/* Cancel Action */}
            {isDraft && (transaction?.items?.length ?? 0) > 0 && (
              <div className="flex justify-end mb-1 no-print">
                <button
                  onClick={() => setIsCancelModalOpen(true)}
                  className="text-xs font-semibold text-text-muted hover:text-red-400 flex items-center gap-1 transition-fast cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Annuler la vente
                </button>
              </div>
            )}
            
            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Sous-total</span>
                <PriceDisplay amount={parseFloat(transaction?.subtotal || '0')} size="sm" />
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-text-secondary">Remise</span>
                {isEditingDiscount ? (
                  <form onSubmit={handleDiscountSubmit} className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="w-20 bg-surface border border-border rounded px-2 py-1 text-sm text-right focus:outline-none focus:border-gold"
                      placeholder="0.00"
                      autoFocus
                    />
                    <button type="submit" className="text-xs text-gold hover:text-gold-light cursor-pointer font-semibold">Valider</button>
                    <button type="button" onClick={() => setIsEditingDiscount(false)} className="text-xs text-text-muted hover:text-text cursor-pointer">Annuler</button>
                  </form>
                ) : (
                  <button 
                    onClick={() => {
                      if (isDraft && operator?.role === 'OWNER') {
                        setDiscountValue(transaction?.discount_amount || '0');
                        setIsEditingDiscount(true);
                      }
                    }}
                    disabled={!isDraft || operator?.role !== 'OWNER'}
                    className={`text-sm font-medium ${isDraft && operator?.role === 'OWNER' ? 'text-emerald-400 hover:text-emerald-300 underline decoration-dashed underline-offset-4 cursor-pointer' : 'text-emerald-400/70'}`}
                  >
                    {transaction?.discount_amount || '0.00'} DH
                  </button>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-border" />

            {/* Total */}
            <div className="flex items-end justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Total</span>
              <PriceDisplay amount={parseFloat(transaction?.total_amount || '0')} size="lg" highlight />
            </div>
            
            {isCompleted && (
              <div className="flex justify-between text-sm text-emerald-400">
                <span>Encaissé</span>
                <PriceDisplay amount={parseFloat(transaction?.confirmed_paid || '0')} size="sm" />
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 no-print">
              <Button
                variant="secondary"
                size="sm"
                icon={<Printer className="w-3.5 h-3.5" />}
                disabled={!isCompleted}
                onClick={handlePrint}
              >
                Imprimer
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<QrCode className="w-3.5 h-3.5" />}
                onClick={handleScannerClick}
                disabled={!isDraft}
              >
                Scanner Caméra
              </Button>
            </div>

            {!isCompleted ? (
              <div className="space-y-2 no-print">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  icon={<Banknote className="w-5 h-5" />}
                  disabled={!transaction?.items?.length || (!isDraft && !isPendingPayment)}
                  onClick={handleCheckoutClick}
                >
                  {transaction?.status === 'PENDING_PAYMENT' ? 'Reprendre le paiement' : 'Finaliser la vente'}
                </Button>
                {transaction?.status === 'PENDING_PAYMENT' ? (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleUnlockCart}
                      className="text-xs font-semibold text-text-secondary hover:text-gold transition-colors text-left"
                    >
                      ← Modifier le panier
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCancelModalOpen(true)}
                      className="text-xs font-semibold text-red-400/90 hover:text-red-300 transition-colors text-right"
                    >
                      Annuler la vente
                    </button>
                  </div>
                ) : transaction?.items?.length ? (
                  <button
                    type="button"
                    onClick={() => setIsCancelModalOpen(true)}
                    className="w-full py-1 text-xs font-medium text-text-muted hover:text-red-400 transition-colors text-center"
                  >
                    Vider le panier / Annuler la vente
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2 no-print">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full !bg-emerald-600 hover:!bg-emerald-500 !text-white font-bold shadow-lg"
                  icon={<Printer className="w-5 h-5" />}
                  onClick={handlePrint}
                >
                  Imprimer le Reçu
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full font-semibold"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={startNewSale}
                >
                  Nouvelle Vente
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>
      </div>

      <OperatorSelectionModal 
        isOpen={isOpModalOpen}
        onClose={() => {
          setIsOpModalOpen(false);
          setPendingAction(null);
        }}
        onSelect={onOperatorSelected}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={handlePaymentCancel}
        totalAmount={parseFloat(transaction?.total_amount || '0')}
        confirmedPaid={parseFloat(transaction?.confirmed_paid || '0')}
        customer={transaction?.customer}
        onSelectCustomerRequest={() => {
          setIsPaymentModalOpen(false);
          setIsCustomerModalOpen(true);
        }}
        onConfirm={handlePaymentConfirm}
      />

      <SelectCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        selectedCustomerId={transaction?.customer?.id}
        onSelectCustomer={handleCustomerSelect}
      />

      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-[var(--radius-lg)] p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div>
              <h2 className="text-lg font-bold text-text mb-1.5">Annuler la vente en cours ?</h2>
              <p className="text-text-muted text-xs leading-relaxed">
                Êtes-vous sûr de vouloir abandonner cette vente et recommencer à zéro ? Tous les articles et paiements en attente associés à cette vente seront annulés.
              </p>
            </div>
            <div className="flex gap-2.5 justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setIsCancelModalOpen(false)}>
                Conserver la vente
              </Button>
              <Button variant="primary" size="sm" className="!bg-red-500 hover:!bg-red-600 !text-white !border-transparent" onClick={handleCancelSale}>
                Oui, Annuler
              </Button>
            </div>
          </div>
        </div>
      )}
      <PendingPaymentModal
        isOpen={isPendingPaymentModalOpen}
        onClose={() => setIsPendingPaymentModalOpen(false)}
        pendingPayments={transaction?.pending_payments || []}
        onConfirm={handleConfirmPendingPayment}
        onReject={handleRejectPendingPayment}
      />
    </div>
  );
}

