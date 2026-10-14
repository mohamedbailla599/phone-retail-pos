import React, { useState, useEffect } from 'react';
import { inventoryApi } from '../../api/inventory';
import { catalogApi } from '../../api/catalog';
import type { Product, Category } from '../../api/catalog';
import { X, Loader2, CheckCircle2, Plus } from 'lucide-react';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { cn } from '../ui/Select';
import OperatorSelectionModal from '../ui/OperatorSelectionModal';
import { useRequireOperator } from '../../hooks/useRequireOperator';

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
        battery_health: '', battery_capacity_mah: '', condition: 'A',
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

  const handleSearch = async (query: string) => {
    setSearching(true);
    try {
      const data = await catalogApi.getProducts({ 
        is_device: 'true', 
        platform: deviceType,
        name: query
      });
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

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

      if (deviceType === 'APPLE' && formData.battery_health) {
        payload.battery_health = parseInt(formData.battery_health);
      }
      if (deviceType === 'ANDROID' && formData.battery_capacity_mah) {
        payload.battery_capacity_mah = parseInt(formData.battery_capacity_mah);
      }

      await inventoryApi.receiveDevice(payload);
      
      setSuccessMessage(
        <div className="flex flex-col items-center justify-center text-center py-6">
          <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
          <h3 className="text-xl font-bold text-text mb-2">Device received successfully.</h3>
          <p className="text-text-secondary">{selectedProduct?.brand} {selectedProduct?.name}</p>
          <p className="text-text-muted mt-1 text-sm">Status: IN STOCK</p>
          <button 
            type="button"
            onClick={() => {
              onSuccess();
              onClose();
            }}
            className="mt-6 px-6 py-2 bg-gold text-black font-semibold rounded-lg hover:bg-gold-hover transition-colors"
          >
            Done
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
      setError(err.response?.data?.error || 'An error occurred while receiving the device.');
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = isNewProduct ? null : products.find(p => p.id.toString() === formData.product_id);
  const isIdentifiersValid = formData.imei_1 || formData.serial_number;
  const showIdentifierError = touched['identifiers'] && !isIdentifiersValid;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text">Receive Device</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-text-muted hover:bg-[rgba(255,255,255,0.05)] transition-colors">
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
                    "flex-1 py-2 px-4 rounded-[var(--radius-md)] border text-sm font-medium transition-colors",
                    deviceType === 'APPLE' 
                      ? "bg-gold/10 border-gold/50 text-gold" 
                      : "bg-[rgba(255,255,255,0.02)] border-border text-text-secondary hover:text-text"
                  )}
                >
                  Apple
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceType('ANDROID')}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-[var(--radius-md)] border text-sm font-medium transition-colors",
                    deviceType === 'ANDROID' 
                      ? "bg-gold/10 border-gold/50 text-gold" 
                      : "bg-[rgba(255,255,255,0.02)] border-border text-text-secondary hover:text-text"
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
                    description: `SKU: ${p.sku}`
                  }))}
                  onSearch={async (q) => {
                    setSearching(true);
                    try {
                      const data = await catalogApi.getProducts({ is_device: 'true', platform: deviceType, name: q });
                      setProducts(data);
                    } finally {
                      setSearching(false);
                    }
                  }}
                  loading={searching}
                  placeholder="Search product..."
                />
              ) : (
                <div className="p-4 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Brand *</label>
                      <input
                        type="text"
                        required={isNewProduct}
                        value={formData.new_product_brand}
                        onChange={(e) => setFormData({ ...formData, new_product_brand: e.target.value })}
                        className="w-full h-10 px-3 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Model Name *</label>
                      <input
                        type="text"
                        required={isNewProduct}
                        value={formData.new_product_name}
                        onChange={(e) => setFormData({ ...formData, new_product_name: e.target.value })}
                        className="w-full h-10 px-3 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold/50 focus:outline-none"
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
                        className="w-full h-10 px-3 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Storage (GB)</label>
                      <input
                        type="number"
                        value={formData.new_product_storage_gb}
                        onChange={(e) => setFormData({ ...formData, new_product_storage_gb: e.target.value })}
                        className="w-full h-10 px-3 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold/50 focus:outline-none"
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
                        className="w-full h-10 px-3 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold/50 focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Identifiers */}
            <div className="space-y-4" onBlur={() => setTouched(t => ({...t, identifiers: true}))}>
              <label className="block text-sm font-medium text-text-secondary">3. Identifiers</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">IMEI 1</label>
                  <input
                    type="text"
                    value={formData.imei_1}
                    onChange={(e) => setFormData({ ...formData, imei_1: e.target.value })}
                    className="w-full h-10 px-3 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">IMEI 2</label>
                  <input
                    type="text"
                    value={formData.imei_2}
                    onChange={(e) => setFormData({ ...formData, imei_2: e.target.value })}
                    className="w-full h-10 px-3 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold/50 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-text-muted mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    className="w-full h-10 px-3 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold/50 focus:outline-none"
                  />
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
            <div className="space-y-4">
              <label className="block text-sm font-medium text-text-secondary">4. Device Specifications</label>
              <div className="grid grid-cols-2 gap-4">
                {deviceType === 'ANDROID' && (
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">RAM (GB)</label>
                    {isNewProduct ? (
                      <input
                        type="number"
                        value={formData.new_product_ram_gb}
                        onChange={(e) => setFormData({ ...formData, new_product_ram_gb: e.target.value })}
                        className="w-full h-10 px-3 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold/50 focus:outline-none"
                      />
                    ) : (
                      <input
                        type="text"
                        disabled
                        value={selectedProduct?.ram_gb || 'N/A'}
                        className="w-full h-10 px-3 bg-[rgba(255,255,255,0.01)] border border-border/50 rounded-[var(--radius-md)] text-sm text-text-muted focus:outline-none cursor-not-allowed"
                      />
                    )}
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Storage (GB)</label>
                  {isNewProduct ? (
                    <input
                      type="number"
                      disabled
                      value={formData.new_product_storage_gb}
                      className="w-full h-10 px-3 bg-[rgba(255,255,255,0.01)] border border-border/50 rounded-[var(--radius-md)] text-sm text-text-muted focus:outline-none cursor-not-allowed"
                    />
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={selectedProduct?.storage_gb || 'N/A'}
                      className="w-full h-10 px-3 bg-[rgba(255,255,255,0.01)] border border-border/50 rounded-[var(--radius-md)] text-sm text-text-muted focus:outline-none cursor-not-allowed"
                    />
                  )}
                </div>

                {deviceType === 'APPLE' && (
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Battery Health (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.battery_health}
                      onChange={(e) => setFormData({ ...formData, battery_health: e.target.value })}
                      className="w-full h-10 px-3 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold/50 focus:outline-none"
                    />
                  </div>
                )}

                {deviceType === 'ANDROID' && (
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Battery Capacity (mAh)</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.battery_capacity_mah}
                      onChange={(e) => setFormData({ ...formData, battery_capacity_mah: e.target.value })}
                      className="w-full h-10 px-3 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold/50 focus:outline-none"
                    />
                  </div>
                )}
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
                    className="w-full h-10 px-3 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold/50 focus:outline-none"
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
                    className="w-full h-10 px-3 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold/50 focus:outline-none"
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
                    className="w-full h-10 px-3 bg-[rgba(255,255,255,0.02)] border border-border rounded-[var(--radius-md)] text-sm text-text focus:border-gold/50 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 6: Condition */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-text-secondary">6. Condition</label>
              <Select
                value={formData.condition}
                onChange={(val) => setFormData({ ...formData, condition: val })}
                options={[
                  { value: 'A', label: 'Grade A (Like New)' },
                  { value: 'B', label: 'Grade B (Good)' },
                  { value: 'C', label: 'Grade C (Fair)' },
                  { value: 'N', label: 'New' }
                ]}
              />
            </div>

            <div className="pt-6 flex justify-end gap-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-[var(--radius-md)] font-medium text-text-secondary hover:text-text hover:bg-[rgba(255,255,255,0.05)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !isIdentifiersValid || (!isNewProduct && !formData.product_id)}
                className="px-6 py-2 rounded-[var(--radius-md)] font-semibold text-black bg-gold hover:bg-gold-hover transition-colors disabled:opacity-50 flex items-center gap-2"
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
    </>
  );
}
