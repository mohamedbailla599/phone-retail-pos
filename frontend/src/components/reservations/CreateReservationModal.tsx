import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import PriceDisplay from '../ui/PriceDisplay';
import { reservationsApi, type Reservation } from '../../api/reservations';
import { inventoryApi, type DeviceItem } from '../../api/inventory';
import { type Customer } from '../../api/customers';
import SelectCustomerModal from '../customers/SelectCustomerModal';
import CreateCustomerModal from '../customers/CreateCustomerModal';
import {
  Smartphone,
  User,
  Plus,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle,
  ArrowRight,
  Search,
} from 'lucide-react';

interface CreateReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedDevice?: DeviceItem | null;
  onSuccess: (reservation: Reservation) => void;
}

export default function CreateReservationModal({
  isOpen,
  onClose,
  preselectedDevice,
  onSuccess,
}: CreateReservationModalProps) {
  // Customer selection
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSelectCustomerOpen, setIsSelectCustomerOpen] = useState(false);
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false);

  // Device selection
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [deviceSearch, setDeviceSearch] = useState('');

  // Pricing & Deposit
  const [reservedPrice, setReservedPrice] = useState<string>('');
  const [depositAmount, setDepositAmount] = useState<string>('0');
  const [depositMethod, setDepositMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'DEBT'>('CASH');
  const [depositReference, setDepositReference] = useState<string>('');

  // Expiration presets
  const [durationPreset, setDurationPreset] = useState<'48h' | '7d' | '15d' | '30d' | 'custom'>('7d');
  const [customDays, setCustomDays] = useState<number>(7);

  // Notes & Submission
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load in-stock devices
  useEffect(() => {
    if (isOpen) {
      if (preselectedDevice) {
        setSelectedDeviceId(preselectedDevice.id);
        setReservedPrice(preselectedDevice.default_selling_price || '');
      } else {
        setLoadingDevices(true);
        inventoryApi
          .getDevices({ status: 'IN_STOCK' })
          .then((data) => {
            setDevices(data);
          })
          .catch((err) => {
            console.error('Failed to load devices for reservation', err);
          })
          .finally(() => setLoadingDevices(false));
      }
    } else {
      // Reset state on close
      setSelectedCustomer(null);
      setSelectedDeviceId(null);
      setReservedPrice('');
      setDepositAmount('0');
      setDepositMethod('CASH');
      setDepositReference('');
      setDurationPreset('7d');
      setCustomDays(7);
      setNotes('');
      setError(null);
    }
  }, [isOpen, preselectedDevice]);

  // Selected device object
  const currentDevice = useMemo(() => {
    if (preselectedDevice && preselectedDevice.id === selectedDeviceId) {
      return preselectedDevice;
    }
    return devices.find((d) => d.id === selectedDeviceId) || null;
  }, [preselectedDevice, devices, selectedDeviceId]);

  // Update default price when device changes
  const handleSelectDevice = (device: DeviceItem) => {
    setSelectedDeviceId(device.id);
    setReservedPrice(device.default_selling_price || '');
    setError(null);
  };

  // Filtered devices list
  const filteredDevices = useMemo(() => {
    if (!deviceSearch.trim()) return devices;
    const q = deviceSearch.toLowerCase();
    return devices.filter(
      (d) =>
        (d.product?.name && d.product.name.toLowerCase().includes(q)) ||
        (d.imei_1 && d.imei_1.includes(q)) ||
        (d.serial_number && d.serial_number.toLowerCase().includes(q)) ||
        (d.product?.brand && d.product.brand.toLowerCase().includes(q))
    );
  }, [devices, deviceSearch]);

  // Calculate calculated duration in days
  const effectiveDays = useMemo(() => {
    switch (durationPreset) {
      case '48h':
        return 2;
      case '7d':
        return 7;
      case '15d':
        return 15;
      case '30d':
        return 30;
      case 'custom':
        return Math.max(1, customDays);
      default:
        return 7;
    }
  }, [durationPreset, customDays]);

  // Expiration preview date
  const expiryPreviewDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + effectiveDays);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [effectiveDays]);

  // Remaining balance calculation
  const numPrice = parseFloat(reservedPrice) || 0;
  const numDeposit = parseFloat(depositAmount) || 0;
  const remainingBalance = Math.max(numPrice - numDeposit, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCustomer) {
      setError('Veuillez sélectionner ou créer un client pour cette réservation.');
      return;
    }

    if (!selectedDeviceId) {
      setError('Veuillez sélectionner un téléphone disponible en stock.');
      return;
    }

    if (numPrice <= 0) {
      setError('Le prix réservé doit être supérieur à 0.');
      return;
    }

    if (currentDevice?.minimum_selling_price) {
      const minPrice = parseFloat(currentDevice.minimum_selling_price);
      if (numPrice < minPrice) {
        setError(`Le prix réservé ne peut être inférieur au prix minimum (${minPrice} DH).`);
        return;
      }
    }

    if (numDeposit < 0) {
      setError("Le montant de l'acompte ne peut être négatif.");
      return;
    }

    if (numDeposit > numPrice) {
      setError("L'acompte ne peut excéder le prix total du téléphone.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await reservationsApi.createReservation({
        customer_id: selectedCustomer.id,
        device_id: selectedDeviceId,
        reserved_price: numPrice,
        duration_days: effectiveDays,
        deposit_amount: numDeposit > 0 ? numDeposit : undefined,
        deposit_method: numDeposit > 0 ? depositMethod : undefined,
        deposit_reference: depositReference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess(created);
      onClose();
    } catch (err: any) {
      console.error('Failed to create reservation', err);
      const detail = err.response?.data?.detail || err.message || 'Erreur lors de la création de la réservation.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle Réservation de Téléphone" size="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SECTION 1: Client */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
              1. Client Bénéficiaire *
            </label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-3.5 bg-neutral-900 border border-amber-500/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                    {(selectedCustomer.full_name || (selectedCustomer as any).name || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-100 flex items-center gap-2">
                      {selectedCustomer.full_name || (selectedCustomer as any).name}
                      <Badge variant="success" size="sm">Client sélectionné</Badge>
                    </div>
                    <div className="text-xs text-neutral-400 font-mono mt-0.5">
                      {selectedCustomer.phone_number || (selectedCustomer as any).phone}
                      {parseFloat(selectedCustomer.current_debt || '0') > 0 && (
                        <span className="text-red-400 ml-2">
                          (Dette actuelle: {parseFloat(selectedCustomer.current_debt || '0').toFixed(2)} DH)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSelectCustomerOpen(true)}
                >
                  Changer
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsSelectCustomerOpen(true)}
                  className="p-4 bg-neutral-900 hover:bg-neutral-800/80 border border-dashed border-neutral-700 hover:border-amber-500/50 rounded-xl flex items-center justify-center gap-2 text-sm text-neutral-300 transition-all group"
                >
                  <User className="w-4 h-4 text-neutral-400 group-hover:text-amber-400" />
                  <span>Choisir un client existant</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateCustomerOpen(true)}
                  className="p-4 bg-neutral-900 hover:bg-neutral-800/80 border border-dashed border-neutral-700 hover:border-amber-500/50 rounded-xl flex items-center justify-center gap-2 text-sm text-amber-400 transition-all group"
                >
                  <Plus className="w-4 h-4" />
                  <span>Créer un nouveau client</span>
                </button>
              </div>
            )}
          </div>

          {/* SECTION 2: Téléphone */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
              2. Téléphone à Réserver *
            </label>
            {preselectedDevice ? (
              <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-amber-400">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-100">{preselectedDevice.product?.name}</div>
                    <div className="text-xs text-neutral-400 font-mono">
                      IMEI: {preselectedDevice.imei_1 || preselectedDevice.serial_number}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-amber-400">
                    {parseFloat(preselectedDevice.default_selling_price).toFixed(2)} DH
                  </div>
                  <Badge variant="info" size="sm">En Stock</Badge>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    value={deviceSearch}
                    onChange={(e) => setDeviceSearch(e.target.value)}
                    placeholder="Rechercher par modèle, marque, IMEI..."
                    className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {loadingDevices ? (
                  <div className="p-6 text-center text-neutral-500 text-sm flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Chargement des téléphones en stock...</span>
                  </div>
                ) : filteredDevices.length === 0 ? (
                  <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg text-center text-sm text-neutral-500">
                    Aucun téléphone en stock disponible.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {filteredDevices.map((d) => {
                      const isSelected = selectedDeviceId === d.id;
                      return (
                        <div
                          key={d.id}
                          onClick={() => handleSelectDevice(d)}
                          className={`p-2.5 rounded-lg border text-sm cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500/50 text-amber-200'
                              : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Smartphone className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-neutral-500'}`} />
                            <div>
                              <div className="font-medium text-xs text-neutral-100">{d.product?.name}</div>
                              <div className="text-[11px] text-neutral-500 font-mono">
                                IMEI: {d.imei_1 || d.serial_number}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-xs text-amber-400">
                              {parseFloat(d.default_selling_price).toFixed(2)} DH
                            </span>
                            {isSelected && (
                              <CheckCircle className="w-4 h-4 text-amber-400 inline-block ml-2" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: Prix convenu & Acompte */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                Prix Réservé / Convenu (DH) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={reservedPrice}
                onChange={(e) => setReservedPrice(e.target.value)}
                placeholder="Ex: 3500"
                required
              />
              {currentDevice?.minimum_selling_price && (
                <div className="text-[11px] text-neutral-500">
                  Prix minimum autorisé: {parseFloat(currentDevice.minimum_selling_price).toFixed(2)} DH
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                Acompte Versé Aujourd'hui (DH)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0 si sans acompte"
              />
              <div className="text-[11px] text-neutral-500">
                Laissez 0 pour une réservation de courtoisie.
              </div>
            </div>

            {numDeposit > 0 && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">
                    Moyen de Paiement de l'Acompte
                  </label>
                  <select
                    value={depositMethod}
                    onChange={(e) => setDepositMethod(e.target.value as any)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="CASH">Espèces (Cash)</option>
                    <option value="BANK_TRANSFER">Virement Bancaire</option>
                    <option value="DEBT">Crédit / Dette</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">
                    Référence Versement (Optionnel)
                  </label>
                  <Input
                    type="text"
                    value={depositReference}
                    onChange={(e) => setDepositReference(e.target.value)}
                    placeholder="Ex: Virement reçu Hassan..."
                  />
                </div>
              </>
            )}

            {/* Solde restant summary banner */}
            <div className="col-span-1 md:col-span-2 pt-2 border-t border-neutral-800 flex items-center justify-between text-sm">
              <span className="text-neutral-400">Solde restant à payer au retrait :</span>
              <span className="font-bold text-amber-400 text-base">
                {remainingBalance.toFixed(2)} DH
              </span>
            </div>
          </div>

          {/* SECTION 4: Durée de validité */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                3. Durée de Validité de la Réservation
              </label>
              <span className="text-xs text-amber-400/90 font-mono">
                Expire le : {expiryPreviewDate}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {(['48h', '7d', '15d', '30d', 'custom'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDurationPreset(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    durationPreset === preset
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  {preset === '48h'
                    ? '48 Heures'
                    : preset === '7d'
                    ? '7 Jours'
                    : preset === '15d'
                    ? '15 Jours'
                    : preset === '30d'
                    ? '30 Jours'
                    : 'Personnalisé'}
                </button>
              ))}
            </div>

            {durationPreset === 'custom' && (
              <div className="pt-2 flex items-center gap-3">
                <Input
                  type="number"
                  min="1"
                  max="180"
                  value={customDays}
                  onChange={(e) => setCustomDays(parseInt(e.target.value) || 1)}
                  className="w-32"
                />
                <span className="text-xs text-neutral-400">jours de réservation</span>
              </div>
            )}
          </div>

          {/* SECTION 5: Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
              Notes / Remarques (Optionnel)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Le client passera samedi matin pour payer le solde..."
              rows={2}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Valider la Réservation
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Nested Customer Select & Create modals */}
      <SelectCustomerModal
        isOpen={isSelectCustomerOpen}
        onClose={() => setIsSelectCustomerOpen(false)}
        selectedCustomerId={selectedCustomer?.id}
        onSelectCustomer={(c) => {
          setSelectedCustomer(c);
          setIsSelectCustomerOpen(false);
          setError(null);
        }}
      />

      <CreateCustomerModal
        isOpen={isCreateCustomerOpen}
        onClose={() => setIsCreateCustomerOpen(false)}
        onCustomerCreated={(c) => {
          setSelectedCustomer(c);
          setIsCreateCustomerOpen(false);
          setError(null);
        }}
      />
    </>
  );
}
