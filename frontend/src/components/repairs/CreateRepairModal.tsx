import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  X, Wrench, Printer, Check, Smartphone, User, DollarSign, Calendar, Lock, 
  Search, UserPlus, Layers, Pencil, Camera, CheckCircle2 
} from 'lucide-react';
import { repairsApi, type IssueType, type CreateRepairPayload, type RepairTicket } from '../../api/repairs';
import { customerApi, type Customer } from '../../api/customers';
import { catalogApi, type Product } from '../../api/catalog';
import { SearchableSelect, type SearchableSelectOption } from '../ui/SearchableSelect';
import PhoneColorDot from '../ui/PhoneColorDot';
import BarcodeScannerModal from '../ui/BarcodeScannerModal';
import { printRepairIntakeReceipt } from '../../utils/printRepairReceipt';
import { cn } from '../ui/Select';

interface CreateRepairModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTicket: RepairTicket) => void;
}

const COMMON_BRANDS = [
  'Apple',
  'Samsung',
  'Xiaomi',
  'Google',
  'Oppo',
  'Realme',
  'Infinix',
  'Tecno',
  'Huawei',
  'Vivo',
  'Autre',
];

const PRESET_COLORS = [
  'Noir',
  'Blanc',
  'Bleu',
  'Gris',
  'Or',
  'Vert',
  'Titane Naturel',
  'Violet',
  'Starlight',
  'Midnight',
];

const ISSUE_OPTIONS: { value: IssueType; label: string }[] = [
  { value: 'SCREEN', label: 'Écran / Vitre cassée (Screen)' },
  { value: 'BATTERY', label: 'Batterie / Autonomie (Battery)' },
  { value: 'CHARGING_PORT', label: 'Connecteur de charge (Port)' },
  { value: 'BACK_GLASS', label: 'Vitre arrière / Châssis' },
  { value: 'CAMERA', label: 'Caméra / Lentille' },
  { value: 'WATER_DAMAGE', label: 'Oxydation / Dégât des eaux' },
  { value: 'SPEAKER_MIC', label: 'Micro / Haut-parleur / Écouteur' },
  { value: 'SOFTWARE', label: 'Système / Déblocage / Flash' },
  { value: 'MOTHERBOARD', label: 'Carte Mère / Micro-soudure' },
  { value: 'OTHER', label: 'Autre panne / Diagnostic global' },
];

export const CreateRepairModal: React.FC<CreateRepairModalProps> = ({ isOpen, onClose, onSuccess }) => {
  // Mode Toggles
  const [customerMode, setCustomerMode] = useState<'SAVED' | 'NEW'>('SAVED');
  const [deviceMode, setDeviceMode] = useState<'CATALOG' | 'MANUAL'>('CATALOG');

  // Customer Data
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<SearchableSelectOption[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);

  // Device Data
  const [deviceBrand, setDeviceBrand] = useState('Apple');
  const [deviceModel, setDeviceModel] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [deviceColor, setDeviceColor] = useState('');
  const [imeiOrSerial, setImeiOrSerial] = useState('');
  const [passcode, setPasscode] = useState('');

  // Scanner Modal
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [issueType, setIssueType] = useState<IssueType>('SCREEN');
  const [issueDescription, setIssueDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [depositPaid, setDepositPaid] = useState('');
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState(getTodayDateString());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch saved customers
  const fetchCustomers = useCallback(async (query: string = '') => {
    try {
      setIsSearchingCustomers(true);
      const customers = await customerApi.getCustomers(query.trim() || undefined);
      setCustomerSearchResults(
        customers.map((c: Customer) => ({
          value: c.id.toString(),
          label: `${c.full_name} (${c.phone_number})`,
          description: `Total Dépensé : ${parseFloat(c.total_spent || '0').toLocaleString('fr-FR')} DH${
            c.current_debt && parseFloat(c.current_debt) > 0 ? ` • Dette : ${c.current_debt} DH` : ''
          }`,
        }))
      );
    } catch (err) {
      console.error('Failed to load customers for repairs:', err);
    } finally {
      setIsSearchingCustomers(false);
    }
  }, []);

  // Fetch catalog products
  const fetchCatalogProducts = useCallback(async (query: string = '') => {
    try {
      setIsSearchingProducts(true);
      const products = await catalogApi.getProducts({
        search: query,
        is_device: true,
      });
      setCatalogProducts(products);
    } catch (err) {
      console.error('Failed to load catalog products for repairs:', err);
    } finally {
      setIsSearchingProducts(false);
    }
  }, []);

  const resetForm = useCallback(() => {
    setCustomerMode('SAVED');
    setDeviceMode('CATALOG');
    setSelectedCustomerId(null);
    setCustomerName('');
    setCustomerPhone('');
    setDeviceBrand('Apple');
    setDeviceModel('');
    setSelectedProductId('');
    setDeviceColor('');
    setImeiOrSerial('');
    setPasscode('');
    setIsScannerOpen(false);
    setIssueType('SCREEN');
    setIssueDescription('');
    setEstimatedCost('');
    setDepositPaid('');
    setEstimatedCompletionDate(getTodayDateString());
    setError(null);
  }, []);

  // Preload customers and catalog on open, and reset form
  useEffect(() => {
    if (isOpen) {
      resetForm();
      fetchCustomers('');
      fetchCatalogProducts('');
    }
  }, [isOpen, resetForm, fetchCustomers, fetchCatalogProducts]);

  // Filter catalog models according to selected brand
  const filteredCatalogOptions: SearchableSelectOption[] = useMemo(() => {
    const brandLower = deviceBrand.toLowerCase();
    const filtered = catalogProducts.filter((p) => {
      if (brandLower === 'autre') return true;
      if (brandLower === 'xiaomi') {
        const b = p.brand.toLowerCase();
        return b.includes('xiaomi') || b.includes('redmi') || b.includes('poco');
      }
      return p.brand.toLowerCase().includes(brandLower);
    });

    return (filtered.length > 0 ? filtered : catalogProducts).map((p) => ({
      value: p.id.toString(),
      label: `${p.brand} ${p.name}`,
      description: p.sku ? `SKU: ${p.sku}` : undefined,
    }));
  }, [catalogProducts, deviceBrand]);

  // Handle customer selection
  const handleSelectCustomer = (customerIdStr: string) => {
    const id = parseInt(customerIdStr, 10);
    const option = customerSearchResults.find((opt) => opt.value === customerIdStr);
    if (option) {
      setSelectedCustomerId(id);
      const match = option.label.match(/^(.*?)\s*\((.*?)\)$/);
      if (match) {
        setCustomerName(match[1].trim());
        setCustomerPhone(match[2].trim());
      }
    }
  };

  // Handle catalog model selection
  const handleSelectCatalogProduct = (prodIdStr: string) => {
    setSelectedProductId(prodIdStr);
    const prod = catalogProducts.find((p) => p.id.toString() === prodIdStr);
    if (prod) {
      setDeviceModel(prod.name);
      if (COMMON_BRANDS.includes(prod.brand)) {
        setDeviceBrand(prod.brand);
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (printReceiptAfter: boolean = false) => {
    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Veuillez renseigner le nom et le téléphone du client.');
      return;
    }

    const brand = deviceBrand.trim();
    if (!brand) {
      setError("Veuillez renseigner la marque de l'appareil.");
      return;
    }

    if (!deviceModel.trim()) {
      setError("Veuillez spécifier le modèle de l'appareil.");
      return;
    }

    if (!issueDescription.trim()) {
      setError('Veuillez décrire le problème ou la panne signalée.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: CreateRepairPayload = {
        customer_id: customerMode === 'SAVED' ? selectedCustomerId : null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        device_brand: brand,
        device_model: deviceModel.trim(),
        device_color: deviceColor.trim() || undefined,
        imei_or_serial: imeiOrSerial.trim() || undefined,
        passcode: passcode.trim() || undefined,
        issue_type: issueType,
        issue_description: issueDescription.trim(),
        estimated_cost: estimatedCost ? parseFloat(estimatedCost) : 0,
        deposit_paid: depositPaid ? parseFloat(depositPaid) : 0,
        estimated_completion_date: estimatedCompletionDate || null,
      };

      const createdTicket = await repairsApi.createRepair(payload);

      if (printReceiptAfter) {
        printRepairIntakeReceipt(createdTicket);
      }

      onSuccess(createdTicket);
      resetForm();
      onClose();
    } catch (err: any) {
      console.error('Error creating repair ticket:', err);
      const detail = err.response?.data?.detail || err.response?.data?.message || 'Erreur lors de la création du ticket.';
      setError(typeof detail === 'object' ? JSON.stringify(detail) : String(detail));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
        <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text">Nouvelle Réception Réparation</h2>
                <p className="text-xs text-text-muted">Enregistrement appareil atelier & ticket de dépôt client</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-text-muted hover:text-text rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center gap-2">
                <span className="font-semibold">Attention:</span> {error}
              </div>
            )}

            {/* ============================================================ */}
            {/* SECTION 1: CLIENT */}
            {/* ============================================================ */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-alt/70 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-gold uppercase tracking-wider">
                  <User className="w-3.5 h-3.5" />
                  <span>1. Informations Client</span>
                </div>

                {/* Mode Toggle Button */}
                <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setCustomerMode('SAVED')}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer',
                      customerMode === 'SAVED'
                        ? 'bg-gold text-bg font-semibold shadow-xs'
                        : 'text-text-muted hover:text-text'
                    )}
                  >
                    <Search className="w-3 h-3" />
                    <span>Client enregistré</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMode('NEW');
                      setSelectedCustomerId(null);
                    }}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer',
                      customerMode === 'NEW'
                        ? 'bg-gold text-bg font-semibold shadow-xs'
                        : 'text-text-muted hover:text-text'
                    )}
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Nouveau client</span>
                  </button>
                </div>
              </div>

              {customerMode === 'SAVED' ? (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-text-secondary">
                    Rechercher un profil client existant
                  </label>
                  <SearchableSelect
                    value={selectedCustomerId?.toString() || ''}
                    onChange={handleSelectCustomer}
                    options={customerSearchResults}
                    onSearch={fetchCustomers}
                    placeholder="Taper un nom ou numéro de téléphone (ex: Mohamed, 06...)"
                    emptyMessage="Aucun client enregistré trouvé"
                    loading={isSearchingCustomers}
                  />

                  {selectedCustomerId ? (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-text font-medium">
                          Client lié : <strong className="text-emerald-300">{customerName}</strong> ({customerPhone})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId(null);
                          setCustomerName('');
                          setCustomerPhone('');
                        }}
                        className="text-text-muted hover:text-danger text-[11px] underline cursor-pointer"
                      >
                        Délier
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-text-muted">
                      💡 Sélectionnez un client dans la liste pour pré-remplir automatiquement son dossier.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Nom complet *</label>
                    <input
                      type="text"
                      required
                      placeholder="ex: Mohammed Alami"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Téléphone *</label>
                    <input
                      type="tel"
                      required
                      placeholder="ex: 06 12 34 56 78"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ============================================================ */}
            {/* SECTION 2: IDENTIFICATION APPAREIL */}
            {/* ============================================================ */}
            <div className="space-y-4 p-4 rounded-xl bg-surface-alt/70 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-gold uppercase tracking-wider">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>2. Identification de l'Appareil</span>
                </div>

                {/* Device Mode Toggle */}
                <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setDeviceMode('CATALOG')}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer',
                      deviceMode === 'CATALOG'
                        ? 'bg-gold text-bg font-semibold shadow-xs'
                        : 'text-text-muted hover:text-text'
                    )}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Depuis le catalogue</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeviceMode('MANUAL');
                      setSelectedProductId('');
                    }}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer',
                      deviceMode === 'MANUAL'
                        ? 'bg-gold text-bg font-semibold shadow-xs'
                        : 'text-text-muted hover:text-text'
                    )}
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Saisie libre</span>
                  </button>
                </div>
              </div>

              {/* Brand & Model Selector */}
              {deviceMode === 'CATALOG' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Marque *</label>
                    <select
                      value={deviceBrand}
                      onChange={(e) => {
                        setDeviceBrand(e.target.value);
                        setSelectedProductId('');
                        setDeviceModel('');
                      }}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors cursor-pointer"
                    >
                      {COMMON_BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Modèle du catalogue (+400 modèles) *
                    </label>
                    <SearchableSelect
                      value={selectedProductId}
                      onChange={handleSelectCatalogProduct}
                      options={filteredCatalogOptions}
                      onSearch={fetchCatalogProducts}
                      placeholder={`Sélectionner un modèle ${deviceBrand}...`}
                      emptyMessage="Aucun modèle trouvé"
                      loading={isSearchingProducts}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Marque *</label>
                    <input
                      type="text"
                      required
                      placeholder="ex: Apple, Samsung, Huawei, Xiaomi..."
                      value={deviceBrand}
                      onChange={(e) => setDeviceBrand(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Modèle précis *</label>
                    <input
                      type="text"
                      required
                      placeholder="ex: iPhone 13 Pro Max, Galaxy Tab S8..."
                      value={deviceModel}
                      onChange={(e) => setDeviceModel(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Color with Quick Chips & Dynamic Dot */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-text-secondary">
                    Couleur de l'appareil
                  </label>
                  {deviceColor && (
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                      <PhoneColorDot color={deviceColor} size="xs" />
                      <span>{deviceColor}</span>
                    </div>
                  )}
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDeviceColor(deviceColor.toLowerCase() === c.toLowerCase() ? '' : c)}
                      className={cn(
                        'py-1 px-2.5 rounded-md border text-[11px] font-medium transition-all cursor-pointer inline-flex items-center gap-1.5',
                        deviceColor.toLowerCase() === c.toLowerCase()
                          ? 'bg-gold/20 border-gold text-gold font-semibold shadow-xs'
                          : 'bg-surface border-border text-text-muted hover:text-text hover:bg-surface-hover'
                      )}
                    >
                      <PhoneColorDot color={c} size="xs" />
                      <span>{c}</span>
                    </button>
                  ))}
                </div>

                {/* Custom Color Text Input with Live Dot */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ou saisir une couleur personnalisée (ex: Deep Purple, Phantom Black, Bleu Nuit)..."
                    value={deviceColor}
                    onChange={(e) => setDeviceColor(e.target.value)}
                    className="w-full h-9 pl-3 pr-8 bg-surface border border-border rounded-lg text-xs text-text focus:border-gold focus:outline-none transition-colors"
                  />
                  {deviceColor && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <PhoneColorDot color={deviceColor} size="sm" />
                    </div>
                  )}
                </div>
              </div>

              {/* IMEI/Serial with Camera Scan & Passcode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-text-secondary">
                      IMEI ou N° Série
                    </label>
                    <span className="text-[11px] text-text-muted flex items-center gap-1">
                      <Camera className="w-3 h-3 text-gold" />
                      Caméra / Douchette
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="ex: 354892019283741"
                      value={imeiOrSerial}
                      onChange={(e) => setImeiOrSerial(e.target.value)}
                      className="w-full h-10 pl-3 pr-20 bg-surface border border-border rounded-lg text-sm font-mono text-text focus:outline-none focus:border-gold transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      title="Scanner avec la caméra"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-2.5 bg-gold/15 hover:bg-gold/25 border border-gold-border/60 text-gold rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Scan</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-gold" /> Code déverrouillage / Schéma
                  </label>
                  <input
                    type="text"
                    placeholder="ex: 123456 ou L-pattern"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-sm font-mono text-text focus:outline-none focus:border-gold transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 3: DIAGNOSTIC & PANNE */}
            {/* ============================================================ */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-alt/70 border border-border">
              <div className="flex items-center gap-2 text-xs font-bold text-gold uppercase tracking-wider">
                <Wrench className="w-3.5 h-3.5" />
                <span>3. Panne & Diagnostic</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Type d'intervention</label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value as IssueType)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors cursor-pointer"
                >
                  {ISSUE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Description détaillée des symptômes *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="ex: L'écran scintille en vert après une chute, le tactile fonctionne encore. Connecteur de charge légèrement desserré."
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors resize-none"
                />
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 4: DEVIS & AVANCE */}
            {/* ============================================================ */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-alt/70 border border-border">
              <div className="flex items-center gap-2 text-xs font-bold text-gold uppercase tracking-wider">
                <DollarSign className="w-3.5 h-3.5" />
                <span>4. Devis & Avance</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Coût estimé (DH)</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    placeholder="0.00"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm font-mono text-text focus:outline-none focus:border-gold transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Acompte versé (DH)</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    placeholder="0.00"
                    value={depositPaid}
                    onChange={(e) => setDepositPaid(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm font-mono text-text focus:outline-none focus:border-gold transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gold" /> Date prévue
                  </label>
                  <input
                    type="date"
                    value={estimatedCompletionDate}
                    onChange={(e) => setEstimatedCompletionDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-border bg-surface-elevated/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-text-muted">
              {estimatedCost && depositPaid && (
                <span>
                  Reste à payer :{' '}
                  <strong className="text-gold font-mono font-bold">
                    {(parseFloat(estimatedCost) - parseFloat(depositPaid)).toFixed(2)} DH
                  </strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 sm:flex-initial px-4 py-2 border border-border rounded-lg text-xs font-semibold text-text-secondary hover:text-text hover:bg-white/5 transition-colors cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={loading}
                className="flex-1 sm:flex-initial px-4 py-2 bg-surface-elevated border border-border hover:border-gold/50 rounded-lg text-xs font-semibold text-text flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Enregistrer</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={loading}
                className="flex-1 sm:flex-initial px-4 py-2 bg-gold hover:bg-gold-light text-bg font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-gold/10 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Enregistrer & Ticket</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode & Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code: string) => {
          setImeiOrSerial(code.trim());
          setIsScannerOpen(false);
        }}
        title="Scanner IMEI / Numéro de Série"
        expectedType="imei"
      />
    </>
  );
};
