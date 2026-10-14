import { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import type { SearchableSelectOption } from '../ui/SearchableSelect';
import OperatorSelectionModal from '../ui/OperatorSelectionModal';
import { useRequireOperator } from '../../hooks/useRequireOperator';
import { customerApi, type Customer } from '../../api/customers';
import { catalogApi } from '../../api/catalog';
import type { Product } from '../../api/catalog';
import { inventoryApi } from '../../api/inventory';
import type { DeviceItem } from '../../api/inventory';
import { exchangeApi } from '../../api/exchanges';
import { 
  ArrowLeftRight, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Scale, 
  Battery, 
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface CreateExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CONDITION_OPTIONS = [
  { value: 'A', label: 'Grade A — Excellent / Like New' },
  { value: 'B', label: 'Grade B — Good (Minor wear)' },
  { value: 'C', label: 'Grade C — Fair (Visible scratches)' },
  { value: 'D', label: 'Grade D — Heavily used / Screen wear' },
];

export function CreateExchangeModal({ isOpen, onClose, onSuccess }: CreateExchangeModalProps) {
  const { 
    isOperatorModalOpen, 
    handleOperatorRequired, 
    onOperatorSelected, 
    onOperatorModalClose 
  } = useRequireOperator();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Customer State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerSearchResults, setCustomerSearchResults] = useState<SearchableSelectOption[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  // 2. Trade-in Device State (Customer phone)
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [tradeInProductId, setTradeInProductId] = useState('');
  const [tradeInImei, setTradeInImei] = useState('');
  const [tradeInCondition, setTradeInCondition] = useState('A');
  const [tradeInBatteryHealth, setTradeInBatteryHealth] = useState<string>('');
  const [tradeInValue, setTradeInValue] = useState<string>('');

  // 3. New Device State (Store phone)
  const [inStockDevices, setInStockDevices] = useState<DeviceItem[]>([]);
  const [isSearchingDevices, setIsSearchingDevices] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDevicePrice, setNewDevicePrice] = useState<string>('');

  // 4. Notes / Reason
  const [reason, setReason] = useState('');

  // Reset or load initial data when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      fetchCatalogProducts('');
      fetchInStockDevices('');
    }
  }, [isOpen]);

  const fetchCatalogProducts = useCallback(async (query: string = '') => {
    try {
      setIsSearchingProducts(true);
      const products = await catalogApi.getProducts({ 
        search: query, 
        is_device: true 
      });
      setCatalogProducts(products);
    } catch (err) {
      console.error('Failed to load catalog products', err);
    } finally {
      setIsSearchingProducts(false);
    }
  }, []);

  const fetchInStockDevices = useCallback(async (query: string = '') => {
    try {
      setIsSearchingDevices(true);
      const devices = await inventoryApi.getDevices({ 
        status: 'IN_STOCK', 
        search: query 
      });
      setInStockDevices(devices);
    } catch (err) {
      console.error('Failed to load in-stock devices', err);
    } finally {
      setIsSearchingDevices(false);
    }
  }, []);

  const handleSearchCustomer = useCallback(async (query: string) => {
    if (!query.trim()) {
      setCustomerSearchResults([]);
      return;
    }
    try {
      setIsSearchingCustomers(true);
      const customers = await customerApi.getCustomers(query);
      setCustomerSearchResults(
        customers.map((c: Customer) => ({
          value: c.id.toString(),
          label: `${c.full_name} (${c.phone_number})`,
          description: `Total Spent: MAD ${c.total_spent || 0}`,
        }))
      );
    } catch (err) {
      console.error('Failed to search customers', err);
    } finally {
      setIsSearchingCustomers(false);
    }
  }, []);

  const handleSelectCustomer = (customerIdStr: string) => {
    const id = parseInt(customerIdStr, 10);
    const option = customerSearchResults.find(opt => opt.value === customerIdStr);
    if (option) {
      setSelectedCustomerId(id);
      // parse "Full Name (Phone)"
      const match = option.label.match(/^(.*?)\s*\((.*?)\)$/);
      if (match) {
        setCustomerName(match[1].trim());
        setCustomerPhone(match[2].trim());
      }
    }
    setShowCustomerSearch(false);
  };

  // Convert catalog products to select options
  const productOptions: SearchableSelectOption[] = useMemo(() => {
    return catalogProducts.map((p) => ({
      value: p.id.toString(),
      label: `${p.name} (${p.brand})`,
      description: `Storage: ${p.storage_gb ? `${p.storage_gb}GB` : 'N/A'} — SKU: ${p.sku}`,
    }));
  }, [catalogProducts]);

  // Convert in-stock devices to select options
  const deviceOptions: SearchableSelectOption[] = useMemo(() => {
    return inStockDevices.map((d) => ({
      value: d.id.toString(),
      label: `${d.product.name} — ${d.imei_1 || d.serial_number || 'No Serial'}`,
      description: `Condition: ${d.condition} | Price: MAD ${d.default_selling_price} | Min: MAD ${d.minimum_selling_price}`,
    }));
  }, [inStockDevices]);

  // Selected new device object
  const selectedNewDevice = useMemo(() => {
    return inStockDevices.find((d) => d.id.toString() === newDeviceId) || null;
  }, [inStockDevices, newDeviceId]);

  // When a new device is selected, pre-fill its price
  const handleSelectNewDevice = (deviceIdStr: string) => {
    setNewDeviceId(deviceIdStr);
    const dev = inStockDevices.find((d) => d.id.toString() === deviceIdStr);
    if (dev) {
      setNewDevicePrice(dev.default_selling_price);
    } else {
      setNewDevicePrice('');
    }
  };

  // Difference and direction computation
  const parsedTradeIn = parseFloat(tradeInValue) || 0;
  const parsedNewPrice = parseFloat(newDevicePrice) || 0;
  const difference = parsedNewPrice - parsedTradeIn;
  const financialDirection: 'CUSTOMER_PAYS' | 'STORE_REFUNDS' | 'EVEN' = 
    difference > 0 ? 'CUSTOMER_PAYS' : difference < 0 ? 'STORE_REFUNDS' : 'EVEN';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const executeSubmit = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Customer name and phone number are required.');
      return;
    }

    if (!tradeInProductId) {
      setError('Please select the trade-in phone model from catalog.');
      return;
    }

    if (!tradeInImei.trim()) {
      setError('Trade-in phone IMEI or serial number is required.');
      return;
    }

    if (parsedTradeIn < 0 || isNaN(parsedTradeIn) || !tradeInValue) {
      setError('Please specify a valid agreed trade-in value.');
      return;
    }

    if (!newDeviceId) {
      setError('Please select an in-stock replacement phone.');
      return;
    }

    if (parsedNewPrice < 0 || isNaN(parsedNewPrice) || !newDevicePrice) {
      setError('Please enter a valid price for the new device.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await exchangeApi.createExchange({
        customer_id: selectedCustomerId,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        trade_in_product_id: parseInt(tradeInProductId, 10),
        trade_in_imei: tradeInImei.trim(),
        trade_in_condition: tradeInCondition,
        trade_in_battery_health: tradeInBatteryHealth ? parseInt(tradeInBatteryHealth, 10) : null,
        trade_in_value: parsedTradeIn,
        new_device_id: parseInt(newDeviceId, 10),
        new_device_price: parsedNewPrice,
        reason: reason.trim() || undefined,
      });

      onSuccess();
    } catch (err: any) {
      if (!handleOperatorRequired(err, executeSubmit)) {
        setError(
          err.response?.data?.detail || 
          err.response?.data?.error || 
          err.message || 
          'Failed to create exchange'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSubmit();
  };

  return (
    <>
      <Modal 
        open={isOpen} 
        onClose={onClose} 
        title="New Device Exchange / Trade-In"
        className="max-w-3xl max-h-[92vh] overflow-y-auto"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-6 text-text">
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-danger-bg border border-danger/30 text-danger text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SECTION 1: CUSTOMER INFORMATION */}
          {/* ============================================================ */}
          <div className="bg-surface rounded-xl p-4 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gold/10 text-gold flex items-center justify-center text-xs font-bold">1</div>
                <h4 className="text-sm font-semibold text-text uppercase tracking-wider">Customer Details</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                className="text-xs text-gold hover:text-gold-bright flex items-center gap-1 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                {showCustomerSearch ? 'Manual Entry' : 'Look up Existing Customer'}
              </button>
            </div>

            {showCustomerSearch && (
              <div className="p-3 bg-surface-alt rounded-lg border border-border-subtle space-y-2">
                <label className="block text-xs font-medium text-text-secondary">Search Customer Profile</label>
                <SearchableSelect
                  value={selectedCustomerId?.toString() || ''}
                  onChange={handleSelectCustomer}
                  options={customerSearchResults}
                  onSearch={handleSearchCustomer}
                  placeholder="Type name or phone number..."
                  loading={isSearchingCustomers}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Customer Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setSelectedCustomerId(null);
                  }}
                  placeholder="e.g. Mohamed"
                  className="w-full h-10 px-3 bg-[rgba(255,255,255,0.03)] border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Customer Phone <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    setSelectedCustomerId(null);
                  }}
                  placeholder="e.g. 0612345678"
                  className="w-full h-10 px-3 bg-[rgba(255,255,255,0.03)] border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* SECTION 2 & 3: DEVICE WORKSPACE (SIDE-BY-SIDE / DUAL CARDS) */}
          {/* ============================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* LEFT: TRADE-IN PHONE (CUSTOMER PHONE) */}
            <div className="bg-surface rounded-xl p-4 border border-border space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gold/10 text-gold flex items-center justify-center text-xs font-bold">2</div>
                  <h4 className="text-sm font-semibold text-text">Customer Phone (Trade-In)</h4>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-surface-alt text-gold border border-gold-border/40">
                  Intake to Inventory
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Phone Model (Catalog) <span className="text-danger">*</span>
                </label>
                <SearchableSelect
                  value={tradeInProductId}
                  onChange={setTradeInProductId}
                  options={productOptions}
                  onSearch={fetchCatalogProducts}
                  placeholder="Select model, e.g. iPhone 13..."
                  loading={isSearchingProducts}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  IMEI / Serial <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={tradeInImei}
                  onChange={(e) => setTradeInImei(e.target.value)}
                  placeholder="15-digit IMEI or Serial number"
                  className="w-full h-10 px-3 font-mono bg-[rgba(255,255,255,0.03)] border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Physical Condition</label>
                  <Select
                    value={tradeInCondition}
                    onChange={setTradeInCondition}
                    options={CONDITION_OPTIONS}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Battery Health (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={tradeInBatteryHealth}
                      onChange={(e) => setTradeInBatteryHealth(e.target.value)}
                      placeholder="e.g. 87"
                      className="w-full h-10 pl-3 pr-8 bg-[rgba(255,255,255,0.03)] border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors"
                    />
                    <Battery className="w-4 h-4 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40">
                <label className="block text-xs font-semibold text-gold mb-1">
                  Agreed Trade-In Value (MAD) <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={tradeInValue}
                    onChange={(e) => setTradeInValue(e.target.value)}
                    placeholder="e.g. 2500.00"
                    className="w-full h-11 px-3 bg-surface-alt border border-gold-border rounded-lg text-base font-bold text-gold placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-gold transition-colors"
                  />
                </div>
                <p className="text-[11px] text-text-muted mt-1">
                  This value will become the phone's inventory cost price upon completion.
                </p>
              </div>
            </div>

            {/* RIGHT: REPLACEMENT PHONE (BIGHRISSEN PHONE) */}
            <div className="bg-surface rounded-xl p-4 border border-border space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-bold">3</div>
                  <h4 className="text-sm font-semibold text-text">Bighrissen Phone (New)</h4>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Currently IN_STOCK
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Select Phone from Inventory <span className="text-danger">*</span>
                </label>
                <SearchableSelect
                  value={newDeviceId}
                  onChange={handleSelectNewDevice}
                  options={deviceOptions}
                  onSearch={fetchInStockDevices}
                  placeholder="Search in-stock phone or IMEI..."
                  loading={isSearchingDevices}
                />
              </div>

              {selectedNewDevice && (
                <div className="p-3 bg-surface-alt rounded-lg border border-border-subtle space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Model:</span>
                    <span className="font-semibold text-text">{selectedNewDevice.product.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">IMEI:</span>
                    <span className="font-mono text-text-secondary">{selectedNewDevice.imei_1 || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Condition:</span>
                    <span className="text-text-secondary">Grade {selectedNewDevice.condition}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Default Price:</span>
                    <span className="text-text-secondary font-medium">MAD {selectedNewDevice.default_selling_price}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-border/40">
                <label className="block text-xs font-semibold text-emerald-400 mb-1">
                  Selling Price for Exchange (MAD) <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newDevicePrice}
                    onChange={(e) => setNewDevicePrice(e.target.value)}
                    placeholder="e.g. 5500.00"
                    className="w-full h-11 px-3 bg-surface-alt border border-emerald-500/30 rounded-lg text-base font-bold text-emerald-400 placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                  />
                </div>
                {selectedNewDevice && (
                  <p className="text-[11px] text-text-muted mt-1">
                    Min Price: MAD {selectedNewDevice.minimum_selling_price}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* SECTION 4: LIVE SETTLEMENT CALCULATION CARD */}
          {/* ============================================================ */}
          <div className="bg-surface-elevated rounded-xl p-5 border border-gold-border/40 shadow-lg">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-gold" />
                <h4 className="text-sm font-semibold text-text">Valuation & Settlement Summary</h4>
              </div>
              <span className="text-xs text-text-muted font-mono">
                Formula: New Phone Price - Trade-in Value
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div className="p-3 bg-surface rounded-lg border border-border-subtle">
                <div className="text-[11px] text-text-muted uppercase">Trade-In Value</div>
                <div className="text-base font-bold text-gold mt-1">
                  {formatCurrency(parsedTradeIn)}
                </div>
              </div>
              <div className="p-3 bg-surface rounded-lg border border-border-subtle">
                <div className="text-[11px] text-text-muted uppercase">New Phone Price</div>
                <div className="text-base font-bold text-emerald-400 mt-1">
                  {formatCurrency(parsedNewPrice)}
                </div>
              </div>
              <div className="p-3 bg-surface rounded-lg border border-border-subtle">
                <div className="text-[11px] text-text-muted uppercase">Net Difference</div>
                <div className="text-base font-bold text-text mt-1">
                  {formatCurrency(Math.abs(difference))}
                </div>
              </div>
            </div>

            {/* Financial Direction Banner */}
            <div className="p-4 rounded-xl flex items-center justify-between transition-all" style={{
              backgroundColor: financialDirection === 'CUSTOMER_PAYS' 
                ? 'rgba(52, 211, 153, 0.12)' 
                : financialDirection === 'STORE_REFUNDS'
                ? 'rgba(245, 158, 11, 0.12)'
                : 'rgba(212, 175, 90, 0.12)',
              borderWidth: 1,
              borderColor: financialDirection === 'CUSTOMER_PAYS'
                ? 'rgba(52, 211, 153, 0.3)'
                : financialDirection === 'STORE_REFUNDS'
                ? 'rgba(245, 158, 11, 0.3)'
                : 'rgba(212, 175, 90, 0.3)'
            }}>
              <div className="flex items-center gap-3">
                {financialDirection === 'CUSTOMER_PAYS' && (
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ArrowDownLeft className="w-5 h-5" />
                  </div>
                )}
                {financialDirection === 'STORE_REFUNDS' && (
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                )}
                {financialDirection === 'EVEN' && (
                  <div className="w-9 h-9 rounded-full bg-gold/20 text-gold flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Settlement Direction
                  </div>
                  <div className="text-base font-bold text-text">
                    {financialDirection === 'CUSTOMER_PAYS' && 'Customer Pays the Difference'}
                    {financialDirection === 'STORE_REFUNDS' && 'Store Refunds Customer'}
                    {financialDirection === 'EVEN' && 'Even Exchange (No Money Owed)'}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-text-muted">Balance Due</div>
                <div className={`text-xl font-black ${
                  financialDirection === 'CUSTOMER_PAYS' ? 'text-emerald-400' :
                  financialDirection === 'STORE_REFUNDS' ? 'text-amber-400' : 'text-gold'
                }`}>
                  {formatCurrency(Math.abs(difference))}
                </div>
              </div>
            </div>
          </div>

          {/* Reason / Notes */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Exchange Notes / Reason (Optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer upgrading from iPhone 13 to iPhone 15"
              className="w-full h-10 px-3 bg-[rgba(255,255,255,0.03)] border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-text-secondary hover:text-text hover:bg-surface-alt transition-colors"
            >
              Cancel
            </button>
            <Button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 bg-gold hover:bg-gold-bright text-black font-semibold rounded-lg flex items-center gap-2 shadow-lg transition-all"
            >
              <ArrowLeftRight className="w-4 h-4" />
              {isLoading ? 'Creating Exchange...' : 'Create Exchange Request'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Operator Selection Modal fallback */}
      <OperatorSelectionModal
        isOpen={isOperatorModalOpen}
        onClose={onOperatorModalClose}
        onSelect={onOperatorSelected}
      />
    </>
  );
}
