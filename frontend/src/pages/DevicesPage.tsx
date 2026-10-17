import { useState, useEffect, useCallback } from 'react';
import { inventoryApi } from '../api/inventory';
import type { DeviceItem } from '../api/inventory';
import { 
  Search, Plus, Loader2, Smartphone, Printer, 
  MoreVertical, BookmarkCheck, RefreshCw, Pencil, Trash2 
} from 'lucide-react';
import ReceiveDeviceModal from '../components/inventory/ReceiveDeviceModal';
import ChangeDeviceStatusModal from '../components/inventory/ChangeDeviceStatusModal';
import CreateReservationModal from '../components/reservations/CreateReservationModal';
import DeviceStickerModal, { type DeviceStickerData } from '../components/inventory/DeviceStickerModal';
import EditDeviceModal from '../components/inventory/EditDeviceModal';
import DeleteDeviceModal from '../components/inventory/DeleteDeviceModal';
import { Select } from '../components/ui/Select';
import { useDebounce } from '../hooks/useDebounce';
import PageContainer from '../components/ui/PageContainer';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import PhoneColorDot from '../components/ui/PhoneColorDot';
import { formatCurrency } from '../utils/formatters';

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [status, setStatus] = useState('IN_STOCK');
  const [condition, setCondition] = useState('');
  const [platform, setPlatform] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [deviceToReserve, setDeviceToReserve] = useState<DeviceItem | null>(null);
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [deviceToPrint, setDeviceToPrint] = useState<DeviceStickerData | null>(null);
  const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);
  
  // Edit & Delete CRUD modals
  const [deviceToEdit, setDeviceToEdit] = useState<DeviceItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<DeviceItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Dropdown menu state
  const [dropdownOpenId, setDropdownOpenId] = useState<number | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await inventoryApi.getDevices({ 
        search: debouncedSearch, 
        status: status === 'ALL' ? '' : status,
        condition,
        platform
      });
      setDevices(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors du chargement des appareils');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, condition, platform]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Close dropdown on scroll or window resize
  useEffect(() => {
    const handleScrollOrResize = () => {
      if (dropdownOpenId !== null) {
        setDropdownOpenId(null);
        setDropdownPos(null);
      }
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [dropdownOpenId]);

  const handleToggleDropdown = (e: React.MouseEvent<HTMLButtonElement>, deviceId: number) => {
    e.stopPropagation();
    if (dropdownOpenId === deviceId) {
      setDropdownOpenId(null);
      setDropdownPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 220;
    const menuEstimatedHeight = 230;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < menuEstimatedHeight;

    setDropdownPos({
      top: openUpwards ? Math.max(10, rect.top - menuEstimatedHeight) : rect.bottom + 6,
      left: Math.max(16, rect.right - menuWidth),
    });
    setDropdownOpenId(deviceId);
  };

  const activeDropdownDevice = devices.find((d) => d.id === dropdownOpenId) || null;

  const headerActions = (
    <div className="flex items-center gap-2.5">
      <button
        onClick={() => loadDevices()}
        disabled={loading}
        className="h-10 px-3.5 rounded-[var(--radius-md)] bg-surface hover:bg-surface-hover text-text-secondary hover:text-text border border-border flex items-center gap-2 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        title="Actualiser"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-gold' : ''}`} />
        <span>Actualiser</span>
      </button>

      <button
        onClick={() => setIsModalOpen(true)}
        className="h-10 px-4 bg-gold hover:bg-gold-bright text-black font-semibold rounded-[var(--radius-md)] flex items-center gap-2 text-xs transition-all shadow-md active:scale-95 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span>Réceptionner un appareil</span>
      </button>
    </div>
  );

  return (
    <PageContainer
      header={
        <PageHeader
          icon={Smartphone}
          title="Stock des Téléphones"
          subtitle={`${devices.length} appareils sérialisés répertoriés dans le système`}
          actions={headerActions}
        />
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-[var(--radius-md)] bg-danger/10 border border-danger/30 text-danger text-sm">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="p-4 rounded-[var(--radius-lg)] bg-surface border border-border flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, SKU, IMEI, Série..."
              className="w-full pl-10 pr-4 h-10 bg-surface-elevated border border-border rounded-[var(--radius-md)] text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-gold/60 transition-colors"
            />
          </div>
          <div className="w-[170px]">
            <Select
              value={status}
              onChange={setStatus}
              options={[
                { value: 'ALL', label: 'Tous les statuts' },
                { value: 'IN_STOCK', label: 'En stock' },
                { value: 'RESERVED', label: 'Réservé' },
                { value: 'SOLD', label: 'Vendu' },
                { value: 'REPAIR', label: 'En réparation' },
                { value: 'DAMAGED', label: 'Endommagé' },
                { value: 'LOST', label: 'Perdu' },
              ]}
            />
          </div>
          <div className="w-[150px]">
            <Select
              value={platform}
              onChange={setPlatform}
              options={[
                { value: '', label: 'Toutes marques' },
                { value: 'APPLE', label: 'Apple' },
                { value: 'ANDROID', label: 'Android' },
              ]}
            />
          </div>
          <div className="w-[150px]">
            <Select
              value={condition}
              onChange={setCondition}
              options={[
                { value: '', label: 'Tous les états' },
                { value: 'A', label: 'Grade A' },
                { value: 'B', label: 'Grade B' },
                { value: 'C', label: 'Grade C' },
                { value: 'N', label: 'Neuf' },
              ]}
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface border border-border rounded-[var(--radius-lg)] overflow-hidden relative min-h-[200px] shadow-xs">
          {loading && (
            <div className="absolute inset-0 bg-surface/50 backdrop-blur-xs flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 text-gold animate-spin" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-elevated text-text-secondary uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3.5">Produit</th>
                  <th className="px-4 py-3.5">SKU</th>
                  <th className="px-4 py-3.5">Identifiants</th>
                  <th className="px-4 py-3.5 text-right">Coût</th>
                  <th className="px-4 py-3.5 text-right">Prix de vente</th>
                  <th className="px-4 py-3.5 text-center">État / Batt</th>
                  <th className="px-4 py-3.5 text-center">Statut</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {devices.map((device) => (
                  <tr key={device.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-text">{device.product.brand} {device.product.name}</span>
                        {device.storage_gb && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gold/15 text-gold border border-gold/30">
                            {device.storage_gb} Go
                          </span>
                        )}
                        {device.ram_gb &&
                          device.product.brand?.toLowerCase() !== 'apple' &&
                          !device.product.name?.toLowerCase().includes('iphone') && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-elevated text-text-muted border border-border">
                            {device.ram_gb} Go RAM
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5">
                        {device.color ? (
                          <div className="flex items-center gap-1.5 text-text-secondary font-medium">
                            <span className="text-text-muted">Couleur :</span>
                            <PhoneColorDot color={device.color} size="sm" />
                            <span>{device.color}</span>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-text-secondary">{device.product.sku}</td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-text-secondary">
                      <div className="space-y-0.5">
                        {device.imei_1 && <div>IMEI1: <span className="text-text">{device.imei_1}</span></div>}
                        {device.serial_number && <div>SN: <span className="text-text">{device.serial_number}</span></div>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-text-secondary">
                      {formatCurrency(device.cost_price)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums font-semibold text-text">
                      {formatCurrency(device.default_selling_price)}
                    </td>
                    <td className="px-4 py-3.5 text-center text-text-secondary">
                      <span className="font-semibold text-text">Grade {device.condition}</span>{' '}
                      {device.battery_health ? (
                        <span className="text-[11px] text-text-muted">({device.battery_health}%)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <StatusBadge status={device.status} size="sm" />
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => handleToggleDropdown(e, device.id)}
                        className={`p-1.5 rounded-[var(--radius-sm)] border transition-all inline-flex items-center justify-center cursor-pointer ${
                          dropdownOpenId === device.id
                            ? 'bg-gold/15 text-gold border-gold/40 shadow-xs ring-2 ring-gold/20'
                            : 'bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text border-border'
                        }`}
                        title="Options et actions de l'appareil"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {devices.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="text-text-muted mb-2 text-xs">Aucun appareil trouvé.</div>
                      {search || status !== 'ALL' || condition || platform ? (
                        <button 
                          onClick={() => { setSearch(''); setStatus('ALL'); setCondition(''); setPlatform(''); }}
                          className="text-gold hover:underline text-xs font-semibold cursor-pointer"
                        >
                          Réinitialiser les filtres
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Floating Action Dropdown Menu */}
      {dropdownOpenId && dropdownPos && activeDropdownDevice && (
        <>
          <div
            className="fixed inset-0 z-[80]"
            onClick={() => {
              setDropdownOpenId(null);
              setDropdownPos(null);
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
            }}
            className="z-[90] w-56 bg-surface-elevated/95 backdrop-blur-xl border border-border shadow-2xl rounded-xl p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Imprimer Étiquette */}
            <button
              type="button"
              onClick={() => {
                const d = activeDropdownDevice;
                setDropdownOpenId(null);
                setDropdownPos(null);
                setDeviceToPrint({
                  id: d.id,
                  product: d.product,
                  storage_gb: d.storage_gb,
                  ram_gb: d.ram_gb,
                  color: d.color,
                  imei_1: d.imei_1,
                  imei_2: d.imei_2,
                  serial_number: d.serial_number,
                  battery_health: d.battery_health,
                  condition: d.condition,
                  default_selling_price: d.default_selling_price,
                });
                setIsStickerModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors text-left cursor-pointer"
            >
              <Printer className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span>Imprimer Étiquette</span>
            </button>

            {/* Réserver l'appareil (if IN_STOCK) */}
            {activeDropdownDevice.status === 'IN_STOCK' && (
              <button
                type="button"
                onClick={() => {
                  const d = activeDropdownDevice;
                  setDropdownOpenId(null);
                  setDropdownPos(null);
                  setDeviceToReserve(d);
                  setIsReserveModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors text-left cursor-pointer"
              >
                <BookmarkCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Réserver l'appareil</span>
              </button>
            )}

            {/* Changer Statut */}
            <button
              type="button"
              onClick={() => {
                const d = activeDropdownDevice;
                setDropdownOpenId(null);
                setDropdownPos(null);
                setSelectedDevice(d);
                setIsStatusModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 transition-colors text-left cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span>Changer Statut</span>
            </button>

            <div className="h-px bg-border my-1" />

            {/* Modifier l'appareil */}
            <button
              type="button"
              onClick={() => {
                const d = activeDropdownDevice;
                setDropdownOpenId(null);
                setDropdownPos(null);
                setDeviceToEdit(d);
                setIsEditModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors text-left cursor-pointer"
            >
              <Pencil className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span>Modifier l'appareil</span>
            </button>

            {/* Supprimer l'appareil */}
            <button
              type="button"
              onClick={() => {
                const d = activeDropdownDevice;
                setDropdownOpenId(null);
                setDropdownPos(null);
                setDeviceToDelete(d);
                setIsDeleteModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>Supprimer du stock</span>
            </button>
          </div>
        </>
      )}

      <ReceiveDeviceModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={loadDevices} 
      />

      <ChangeDeviceStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false);
          setSelectedDevice(null);
        }}
        onSuccess={() => {
          loadDevices();
        }}
        device={selectedDevice}
      />

      <CreateReservationModal
        isOpen={isReserveModalOpen}
        onClose={() => {
          setIsReserveModalOpen(false);
          setDeviceToReserve(null);
        }}
        preselectedDevice={deviceToReserve}
        onSuccess={() => {
          loadDevices();
        }}
      />

      <DeviceStickerModal
        isOpen={isStickerModalOpen}
        onClose={() => {
          setIsStickerModalOpen(false);
          setDeviceToPrint(null);
        }}
        device={deviceToPrint}
      />

      <EditDeviceModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setDeviceToEdit(null);
        }}
        onSuccess={() => {
          loadDevices();
        }}
        device={deviceToEdit}
      />

      <DeleteDeviceModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeviceToDelete(null);
        }}
        onSuccess={() => {
          loadDevices();
        }}
        device={deviceToDelete}
      />
    </PageContainer>
  );
}
