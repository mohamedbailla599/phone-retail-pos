import React, { useState, useEffect, useCallback } from 'react';
import { inventoryApi } from '../../api/inventory';
import { catalogApi } from '../../api/catalog';
import type { Product, Category } from '../../api/catalog';
import { X, Loader2, CheckCircle2, Plus, Camera, Printer } from 'lucide-react';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { cn } from '../ui/Select';
import OperatorSelectionModal from '../ui/OperatorSelectionModal';
import { useRequireOperator } from '../../hooks/useRequireOperator';
import BarcodeScannerModal from '../ui/BarcodeScannerModal';
import DeviceStickerModal, { type DeviceStickerData } from './DeviceStickerModal';
import PhoneColorDot from '../ui/PhoneColorDot';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type DeviceType = 'APPLE' | 'ANDROID';

export default function ReceiveDeviceModal({ isOpen, onClose, onSuccess }: Props) {
  const [deviceType, setDeviceType] = useState<DeviceType>('APPLE');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState<React.ReactNode | null>(null);

  const [scannerTarget, setScannerTarget] = useState<'imei_1' | 'imei_2' | 'serial_number' | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [lastReceivedDevice, setLastReceivedDevice] = useState<DeviceStickerData | null>(null);
  const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);

  const handleOpenScanner = (target: 'imei_1' | 'imei_2' | 'serial_number') => {
    setScannerTarget(target);
    setIsScannerOpen(true);
  };

  const handleScannedCode = (code: string) => {
    if (!scannerTarget) return;
    setFormData((prev) => ({
      ...prev,
      [scannerTarget]: code,
    }));
    setTouched((t) => ({ ...t, identifiers: true }));
  };

  const handleIdentifierKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentField: 'imei_1' | 'imei_2' | 'serial_number'
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentField === 'imei_1') {
        const imei2Input = document.getElementById('receive-modal-imei-2') as HTMLInputElement;
        imei2Input?.focus();
      } else if (currentField === 'imei_2') {
        const serialInput = document.getElementById('receive-modal-serial') as HTMLInputElement;
        serialInput?.focus();
      }
    }
  };

  const {
    isOperatorModalOpen,
    onOperatorSelected,
    onOperatorModalClose,
    handleOperatorRequired,
  } = useRequireOperator();
  
  const [isNewProduct, setIsNewProduct] = useState(false);
  
  const [formData, setFormData] = useState({
    // Inventory fields
    product_id: '',
    imei_1: '',
    imei_2: '',
    serial_number: '',
    cost_price: '',
    default_selling_price: '',
    minimum_selling_price: '',
    battery_health: '',
    battery_capacity_mah: '',
    storage_gb: '128',
    ram_gb: '',
    color: '',
    condition: 'A',
    
    // New Product fields
    new_product_name: '',
    new_product_brand: '',
    new_product_sku: '',
    new_product_storage_gb: '',
    new_product_ram_gb: '',
    new_product_category_id: '',
    
    // New Category fields
    is_new_category: false,
    new_category_name: ''
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      handleSearch('');
      loadCategories();
      setFormData({
        product_id: '', imei_1: '', imei_2: '', serial_number: '',
        cost_price: '', default_selling_price: '', minimum_selling_price: '',
        battery_health: '', battery_capacity_mah: '',
        storage_gb: '128', ram_gb: '', color: '', condition: 'A',
        new_product_name: '', new_product_brand: '', new_product_sku: '',
        new_product_storage_gb: '', new_product_ram_gb: '', new_product_category_id: '',
        is_new_category: false, new_category_name: ''
      });
      setError('');
      setSuccessMessage(null);
      setTouched({});
      setIsNewProduct(false);
    }
  }, [isOpen, deviceType]);

  const handleSearch = useCallback(async (query: string) => {
    setSearching(true);
    try {
      const data = await catalogApi.getProducts({ 
        is_device: 'true', 
        platform: deviceType,
        name: query
      });
      setProducts(data);
    } catch (err) {
      console.error('Error searching products:', err);
    } finally {
      setSearching(false);
    }
  }, [deviceType]);

  const loadCategories = async () => {
    try {
      const data = await catalogApi.getCategories();
      setCategories(data.filter(c => c.is_device));
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      let finalProductId = parseInt(formData.product_id);
      let selectedProduct: Product | undefined = products.find(p => p.id === finalProductId);

      if (isNewProduct) {
        let finalCategoryId = parseInt(formData.new_product_category_id);
        
        if (formData.is_new_category) {
          const newCat = await catalogApi.createCategory({
            name: formData.new_category_name,
            is_device: true
          });
          finalCategoryId = newCat.id;
        }

        selectedProduct = await catalogApi.createProduct({
          category_id: finalCategoryId,
          name: formData.new_product_name,
          brand: formData.new_product_brand,
          sku: formData.new_product_sku,
          platform: deviceType,
          storage_gb: formData.new_product_storage_gb ? parseInt(formData.new_product_storage_gb) : null,
          ram_gb: (deviceType === 'ANDROID' && formData.new_product_ram_gb) ? parseInt(formData.new_product_ram_gb) : null,
          is_active: true
        });
        
        finalProductId = selectedProduct.id;
      } else {
        if (!finalProductId || isNaN(finalProductId)) {
          setError('Veuillez sélectionner un modèle dans la liste ou cliquer sur "+ Create New Product".');
          setLoading(false);
          return;
        }
      }

      const payload: any = {
        product_id: finalProductId,
        cost_price: formData.cost_price,
        default_selling_price: formData.default_selling_price,
        minimum_selling_price: formData.minimum_selling_price,
        condition: formData.condition,
        imei_1: formData.imei_1 || null,
        imei_2: formData.imei_2 || null,
        serial_number: formData.serial_number || null,
      };

      if (formData.storage_gb) {
        payload.storage_gb = parseInt(formData.storage_gb);
      }
      if (deviceType === 'ANDROID' && formData.ram_gb) {
        payload.ram_gb = parseInt(formData.ram_gb);
      }
      if (formData.color) {
        payload.color = formData.color.trim();
      }

      if (deviceType === 'APPLE' && formData.battery_health) {
        payload.battery_health = parseInt(formData.battery_health);
      }
      if (deviceType === 'ANDROID' && formData.battery_capacity_mah) {
        payload.battery_capacity_mah = parseInt(formData.battery_capacity_mah);
      }

      const createdDevice = await inventoryApi.receiveDevice(payload);

      const stickerInfo: DeviceStickerData = {
        id: createdDevice.id,
        product: {
          name: selectedProduct?.name || formData.new_product_name,
          brand: selectedProduct?.brand || formData.new_product_brand,
          sku: selectedProduct?.sku || formData.new_product_sku,
          storage_gb:
            createdDevice.storage_gb ??
            selectedProduct?.storage_gb ??
            (formData.new_product_storage_gb ? parseInt(formData.new_product_storage_gb) : null),
          ram_gb:
            createdDevice.ram_gb ??
            selectedProduct?.ram_gb ??
            (formData.new_product_ram_gb ? parseInt(formData.new_product_ram_gb) : null),
        },
        storage_gb: createdDevice.storage_gb,
        ram_gb: createdDevice.ram_gb,
        color: createdDevice.color,
        imei_1: createdDevice.imei_1,
        imei_2: createdDevice.imei_2,
        serial_number: createdDevice.serial_number,
        battery_health: createdDevice.battery_health,
        battery_capacity_mah: (createdDevice as any).battery_capacity_mah,
        condition: createdDevice.condition,
        default_selling_price: createdDevice.default_selling_price,
      };
      setLastReceivedDevice(stickerInfo);

      setSuccessMessage(
        <div className="flex flex-col items-center justify-center text-center py-6">
          <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-text mb-1">Appareil ajouté avec succès !</h3>
          <p className="text-text font-semibold text-base">
            {stickerInfo.product.brand} {stickerInfo.product.name}
          </p>
          {stickerInfo.imei_1 && (
            <p className="text-text-muted text-xs font-mono mt-1">IMEI: {stickerInfo.imei_1}</p>
          )}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-green-500/10 text-green-400 text-xs font-medium border border-green-500/20 mt-2">
            En Stock • {stickerInfo.default_selling_price ? `${parseFloat(stickerInfo.default_selling_price.toString()).toLocaleString('fr-FR')} DH` : ''}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6 w-full max-w-md">
            <button
              type="button"
              onClick={() => setIsStickerModalOpen(true)}
              className="flex-1 min-w-[200px] py-2.5 px-4 bg-gold hover:bg-gold-bright text-black font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimer l'Étiquette Téléphone
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData((f) => ({
                  ...f,
                  imei_1: '',
                  imei_2: '',
                  serial_number: '',
                  battery_health: '',
                  battery_capacity_mah: '',
                }));
                setSuccessMessage(null);
                setError('');
              }}
              className="py-2.5 px-4 bg-surface-alt hover:bg-surface-hover text-text font-semibold rounded-lg text-sm border border-border transition-colors cursor-pointer"
            >
              Ajouter un autre
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onSuccess();
              onClose();
            }}
            className="mt-4 text-xs text-text-muted hover:text-text hover:underline transition-colors cursor-pointer"
          >
            Fermer et retourner à l'inventaire
          </button>
        </div>
      );

      onSuccess();
    } catch (err: any) {
      if (handleOperatorRequired(err, () => {
        handleSubmit({ preventDefault: () => {} } as any);
      })) {
        return;
      }
      const backendError =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        (err.response?.data && typeof err.response.data === 'object'
          ? Object.entries(err.response.data)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join(' | ')
          : null) ||
        err.message ||
        'An error occurred while receiving the device.';
      setError(backendError);
    } finally {
      setLoading(false);
    }
  };

  const isIdentifiersValid = formData.imei_1 || formData.serial_number;
  const showIdentifierError = touched['identifiers'] && !isIdentifiersValid;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text">Receive Device</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMessage ? (
          <div className="p-6">{successMessage}</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-8">
            {error && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Section 1: Device Type */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">1. Device Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeviceType('APPLE')}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-[var(--radius-md)] border text-sm font-semibold transition-all cursor-pointer",
                    deviceType === 'APPLE' 
                      ? "bg-gold/15 border-gold-border text-gold shadow-sm" 
                      : "bg-surface-alt border-border text-text-secondary hover:text-text hover:bg-surface-hover"
                  )}
                >
                  Apple
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceType('ANDROID')}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-[var(--radius-md)] border text-sm font-semibold transition-all cursor-pointer",
                    deviceType === 'ANDROID' 
                      ? "bg-gold/15 border-gold-border text-gold shadow-sm" 
                      : "bg-surface-alt border-border text-text-secondary hover:text-text hover:bg-surface-hover"
                  )}
                >
                  Android
                </button>
              </div>
            </div>

            {/* Section 2: Product */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-text-secondary">2. Product *</label>
                <button
                  type="button"
                  onClick={() => setIsNewProduct(!isNewProduct)}
                  className="text-xs font-medium text-gold hover:underline flex items-center gap-1"
                >
                  {isNewProduct ? 'Use Existing Product' : <><Plus className="w-3 h-3" /> Create New Product</>}
                </button>
              </div>

              {!isNewProduct ? (
                <SearchableSelect
                  value={formData.product_id}
                  onChange={(val) => setFormData(f => ({ ...f, product_id: val }))}
                  options={products.map(p => ({
                    value: p.id.toString(),
                    label: `${p.brand} ${p.name}`,
                    description: `${p.category?.name || p.brand} • SKU: ${p.sku}`
                  }))}
                  onSearch={handleSearch}
                  loading={searching}
                  placeholder="Search product..."
                />
              ) : (
                <div className="p-4 bg-surface-alt border border-border rounded-[var(--radius-md)] space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Brand *</label>
                      <input
                        type="text"
                        required={isNewProduct}
                        value={formData.new_product_brand}
                        onChange={(e) => setFormData({ ...formData, new_product_brand: e.target.value })}
                        className="w-full h-10 px-3 bg-surface-alt border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold-border focus:ring-2 focus:ring-gold/20 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Model Name *</label>
                      <input
                        type="text"
                        required={isNewProduct}
                        value={formData.new_product_name}
                        onChange={(e) => setFormData({ ...formData, new_product_name: e.target.value })}
                        className="w-full h-10 px-3 bg-surface-alt border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold-border focus:ring-2 focus:ring-gold/20 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">SKU *</label>
                      <input
                        type="text"
                        required={isNewProduct}
                        value={formData.new_product_sku}
                        onChange={(e) => setFormData({ ...formData, new_product_sku: e.target.value })}
                        className="w-full h-10 px-3 bg-surface-alt border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold-border focus:ring-2 focus:ring-gold/20 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Storage (GB)</label>
                      <input
                        type="number"
                        value={formData.new_product_storage_gb}
                        onChange={(e) => setFormData({ ...formData, new_product_storage_gb: e.target.value })}
                        className="w-full h-10 px-3 bg-surface-alt border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold-border focus:ring-2 focus:ring-gold/20 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-text-muted">Category *</label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={formData.is_new_category}
                          onChange={(e) => setFormData({...formData, is_new_category: e.target.checked})}
                          className="w-3 h-3 text-gold bg-bg border-border rounded focus:ring-gold"
                        />
                        <span className="text-xs text-text-secondary">Create New Category</span>
                      </label>
                    </div>

                    {!formData.is_new_category ? (
                      <Select
                        value={formData.new_product_category_id}
                        onChange={(val) => setFormData({ ...formData, new_product_category_id: val })}
                        options={categories.map(c => ({ value: c.id.toString(), label: c.name }))}
                      />
                    ) : (
                      <input
                        type="text"
                        required={isNewProduct && formData.is_new_category}
                        placeholder="Category Name (e.g. Smartphones)"
                        value={formData.new_category_name}
                        onChange={(e) => setFormData({ ...formData, new_category_name: e.target.value })}
                        className="w-full h-10 px-3 bg-surface-alt border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold-border focus:ring-2 focus:ring-gold/20 focus:outline-none transition-all"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Identifiers */}
            <div className="space-y-4" onBlur={() => setTouched(t => ({...t, identifiers: true}))}>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-text-secondary">3. Identifiers</label>
                <span className="text-[11px] text-text-muted flex items-center gap-1">
                  <Camera className="w-3 h-3 text-gold" />
                  Cliquez sur Scan pour utiliser la caméra
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">IMEI 1</label>
                  <div className="relative">
                    <input
                      id="receive-modal-imei-1"
                      type="text"
                      placeholder="Ex: 358921098451234"
                      value={formData.imei_1}
                      onChange={(e) => setFormData({ ...formData, imei_1: e.target.value })}
                      onKeyDown={(e) => handleIdentifierKeyDown(e, 'imei_1')}
                      className="w-full h-10 pl-3 pr-14 bg-surface-alt border border-border rounded-[var(--radius-md)] text-sm text-text font-mono focus:border-gold-border focus:ring-2 focus:ring-gold/20 focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenScanner('imei_1')}
                      title="Scanner IMEI 1 avec la caméra"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-2 bg-gold/15 hover:bg-gold/25 border border-gold-border/60 text-gold rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Scan</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">IMEI 2</label>
                  <div className="relative">
                    <input
                      id="receive-modal-imei-2"
                      type="text"
                      placeholder="Ex: 358921098451235"
                      value={formData.imei_2}
                      onChange={(e) => setFormData({ ...formData, imei_2: e.target.value })}
                      onKeyDown={(e) => handleIdentifierKeyDown(e, 'imei_2')}
                      className="w-full h-10 pl-3 pr-14 bg-surface-alt border border-border rounded-[var(--radius-md)] text-sm text-text font-mono focus:border-gold-border focus:ring-2 focus:ring-gold/20 focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenScanner('imei_2')}
                      title="Scanner IMEI 2 avec la caméra"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-2 bg-gold/15 hover:bg-gold/25 border border-gold-border/60 text-gold rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Scan</span>
                    </button>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-text-muted mb-1">Serial Number</label>
                  <div className="relative">
                    <input
                      id="receive-modal-serial"
                      type="text"
                      placeholder="Ex: F17X89..."
                      value={formData.serial_number}
                      onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                      onKeyDown={(e) => handleIdentifierKeyDown(e, 'serial_number')}
                      className="w-full h-10 pl-3 pr-14 bg-surface-alt border border-border rounded-[var(--radius-md)] text-sm text-text font-mono focus:border-gold-border focus:ring-2 focus:ring-gold/20 focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenScanner('serial_number')}
                      title="Scanner Numéro de Série avec la caméra"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-2 bg-gold/15 hover:bg-gold/25 border border-gold-border/60 text-gold rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Scan</span>
                    </button>
                  </div>
                </div>
              </div>
              {showIdentifierError && (
                <p className="text-sm text-red-400">Must provide at least IMEI 1 or Serial Number.</p>
              )}
              {!showIdentifierError && (
                <p className="text-xs text-text-muted">Provide IMEI 1, Serial Number, or both.</p>
              )}
            </div>

            {/* Section 4: Device Specifications */}
            <div className="space-y-4 p-4 rounded-[var(--radius-md)] bg-surface-alt/70 border border-border">
              <label className="block text-sm font-semibold text-text">4. Caractéristiques de l'exemplaire reçu</label>

              {/* Storage selection */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Capacité de stockage *
                </label>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {['64', '128', '256', '512', '1024'].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setFormData((f) => ({ ...f, storage_gb: size }))}
                      className={cn(
                        'py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer',
                        formData.storage_gb === size
                          ? 'bg-gold/20 border-gold text-gold shadow-xs font-bold'
                          : 'bg-surface border-border text-text-secondary hover:text-text hover:bg-surface-hover'
                      )}
                    >
                      {size === '1024' ? '1 To' : `${size} Go`}
                    </button>
                  ))}
                  <div className="flex-1 min-w-[100px]">
                    <input
                      type="number"
                      placeholder="Autre Go..."
                      value={['64', '128', '256', '512', '1024'].includes(formData.storage_gb) ? '' : formData.storage_gb}
                      onChange={(e) => setFormData((f) => ({ ...f, storage_gb: e.target.value }))}
                      className="w-full h-8 px-2.5 bg-surface border border-border rounded-lg text-xs text-text font-mono focus:border-gold-border focus:ring-1 focus:ring-gold/20 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* RAM selection (Android) */}
              {deviceType === 'ANDROID' && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Mémoire RAM (Android)
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {['4', '6', '8', '12', '16'].map((ram) => (
                      <button
                        key={ram}
                        type="button"
                        onClick={() => setFormData((f) => ({ ...f, ram_gb: f.ram_gb === ram ? '' : ram }))}
                        className={cn(
                          'py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer',
                          formData.ram_gb === ram
                            ? 'bg-gold/20 border-gold text-gold shadow-xs font-bold'
                            : 'bg-surface border-border text-text-secondary hover:text-text hover:bg-surface-hover'
                        )}
                      >
                        {ram} Go
                      </button>
                    ))}
                    <div className="flex-1 min-w-[90px]">
                      <input
                        type="number"
                        placeholder="Autre RAM..."
                        value={['4', '6', '8', '12', '16'].includes(formData.ram_gb) ? '' : formData.ram_gb}
                        onChange={(e) => setFormData((f) => ({ ...f, ram_gb: e.target.value }))}
                        className="w-full h-8 px-2.5 bg-surface border border-border rounded-lg text-xs text-text font-mono focus:border-gold-border focus:ring-1 focus:ring-gold/20 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Color selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-text-secondary">
                    Couleur de l'appareil
                  </label>
                  {formData.color && (
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                      <PhoneColorDot color={formData.color} size="xs" />
                      <span>{formData.color}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {['Noir', 'Blanc', 'Bleu', 'Gris', 'Or', 'Vert', 'Titane Naturel', 'Violet', 'Starlight', 'Midnight'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData((f) => ({ ...f, color: f.color?.toLowerCase() === c.toLowerCase() ? '' : c }))}
                      className={cn(
                        'py-1 px-2.5 rounded-md border text-[11px] font-medium transition-all cursor-pointer inline-flex items-center gap-1.5',
                        formData.color?.toLowerCase() === c.toLowerCase()
                          ? 'bg-gold/20 border-gold text-gold font-semibold shadow-xs'
                          : 'bg-surface border-border text-text-muted hover:text-text hover:bg-surface-hover'
                      )}
                    >
                      <PhoneColorDot color={c} size="xs" />
                      {c}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ou saisir une couleur personnalisée (ex: Deep Purple, Rose Gold, Phantom Black)..."
                    value={formData.color}
                    onChange={(e) => setFormData((f) => ({ ...f, color: e.target.value }))}
                    className="w-full h-9 pl-3 pr-8 bg-surface border border-border rounded-[var(--radius-md)] text-xs text-text focus:border-gold-border focus:ring-1 focus:ring-gold/20 focus:outline-none transition-all"
                  />
                  {formData.color && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <PhoneColorDot color={formData.color} size="sm" />
                    </div>
                  )}
                </div>
              </div>

              {/* Battery specs */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
                {deviceType === 'APPLE' ? (
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">État de la batterie (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="Ex: 87"
                      value={formData.battery_health}
                      onChange={(e) => setFormData({ ...formData, battery_health: e.target.value })}
                      className="w-full h-9 px-3 bg-surface border border-border rounded-[var(--radius-md)] text-xs text-text font-mono focus:border-gold-border focus:ring-1 focus:ring-gold/20 focus:outline-none transition-all"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Capacité batterie (mAh)</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Ex: 5000"
                      value={formData.battery_capacity_mah}
                      onChange={(e) => setFormData({ ...formData, battery_capacity_mah: e.target.value })}
                      className="w-full h-9 px-3 bg-surface border border-border rounded-[var(--radius-md)] text-xs text-text font-mono focus:border-gold-border focus:ring-1 focus:ring-gold/20 focus:outline-none transition-all"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">État esthétique (Grade)</label>
                  <Select
                    value={formData.condition}
                    onChange={(val) => setFormData({ ...formData, condition: val })}
                    options={[
                      { value: 'A', label: 'Grade A (Excellent état / Comme neuf)' },
                      { value: 'B', label: 'Grade B (Très bon état)' },
                      { value: 'C', label: 'Grade C (Traces d’usure)' },
                      { value: 'N', label: 'Neuf (Sous emballage)' }
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Pricing */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-text-secondary">5. Pricing</label>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Cost Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    className="w-full h-10 px-3 bg-surface-alt border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold-border focus:ring-2 focus:ring-gold/20 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Def. Selling *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.default_selling_price}
                    onChange={(e) => setFormData({ ...formData, default_selling_price: e.target.value })}
                    className="w-full h-10 px-3 bg-surface-alt border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold-border focus:ring-2 focus:ring-gold/20 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Min. Selling *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.minimum_selling_price}
                    onChange={(e) => setFormData({ ...formData, minimum_selling_price: e.target.value })}
                    className="w-full h-10 px-3 bg-surface-alt border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold-border focus:ring-2 focus:ring-gold/20 focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 flex justify-end gap-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-[var(--radius-md)] font-medium text-text-secondary hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !isIdentifiersValid || (!isNewProduct && !formData.product_id)}
                className="px-6 py-2 rounded-[var(--radius-md)] font-semibold text-black bg-gold hover:bg-gold-bright transition-all shadow-[0_2px_12px_rgba(212,175,90,0.25)] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Receive Device
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
      <OperatorSelectionModal
        isOpen={isOperatorModalOpen}
        onClose={onOperatorModalClose}
        onSelect={onOperatorSelected}
      />

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          setScannerTarget(null);
        }}
        onScan={handleScannedCode}
        title={
          scannerTarget === 'imei_1'
            ? 'Scanner IMEI 1'
            : scannerTarget === 'imei_2'
            ? 'Scanner IMEI 2'
            : 'Scanner Numéro de Série'
        }
        expectedType={scannerTarget?.startsWith('imei') ? 'imei' : 'serial'}
      />

      <DeviceStickerModal
        isOpen={isStickerModalOpen}
        onClose={() => setIsStickerModalOpen(false)}
        device={lastReceivedDevice}
      />
    </>
  );
}
