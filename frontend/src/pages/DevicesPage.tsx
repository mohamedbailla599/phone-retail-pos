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
import Sidebar from '../components/layout/Sidebar';

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
      setError(err.response?.data?.error || 'Failed to load devices');
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

  return (
    <div className="h-screen flex bg-bg overflow-hidden w-full print:hidden">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
        <header className="h-[72px] flex items-center justify-between px-8 bg-surface border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text tracking-tight flex items-center gap-2">
                Devices Inventory
              </h1>
              <p className="text-xs text-text-muted mt-0.5">{devices.length} serialized devices in system</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="h-10 px-4 bg-gold hover:bg-gold-bright text-black font-semibold rounded-[var(--radius-md)] flex items-center gap-2 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Receive Device
          </button>
        </header>

        <div className="flex-1 overflow-auto p-8 space-y-6">
          <div className="max-w-[1400px] mx-auto space-y-6">
          {error && (
            <div className="p-3 mb-6 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, SKU, IMEI, Serial..."
                className="w-full pl-10 pr-4 h-10 bg-surface-alt border border-border rounded-[var(--radius-md)] text-sm text-text placeholder-text-muted focus:outline-none focus:border-gold-border focus:ring-2 focus:ring-gold/20 transition-all"
              />
            </div>
            <div className="w-[180px]">
              <Select
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'IN_STOCK', label: 'In Stock' },
                  { value: 'RESERVED', label: 'Reserved' },
                  { value: 'SOLD', label: 'Sold' },
                  { value: 'REPAIR', label: 'Repair' },
                  { value: 'DAMAGED', label: 'Damaged' },
                  { value: 'LOST', label: 'Lost' },
                ]}
              />
            </div>
            <div className="w-[160px]">
              <Select
                value={platform}
                onChange={setPlatform}
                options={[
                  { value: '', label: 'All Types' },
                  { value: 'APPLE', label: 'Apple' },
                  { value: 'ANDROID', label: 'Android' },
                ]}
              />
            </div>
            <div className="w-[160px]">
              <Select
                value={condition}
                onChange={setCondition}
                options={[
                  { value: '', label: 'All Conditions' },
                  { value: 'A', label: 'Grade A' },
                  { value: 'B', label: 'Grade B' },
                  { value: 'C', label: 'Grade C' },
                  { value: 'N', label: 'New' },
                ]}
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-surface border border-border rounded-[var(--radius-lg)] overflow-hidden relative min-h-[200px] shadow-sm">
            {loading && (
              <div className="absolute inset-0 bg-surface/50 backdrop-blur-sm flex items-center justify-center z-10">
                <Loader2 className="w-8 h-8 text-gold animate-spin" />
              </div>
            )}
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-alt">
                  <th className="px-4 py-3 font-semibold text-text-secondary text-xs uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-xs uppercase tracking-wider">SKU</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-xs uppercase tracking-wider">Identifier</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-xs uppercase tracking-wider text-right">Cost</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-xs uppercase tracking-wider text-right">Price</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-xs uppercase tracking-wider">Cond/Batt</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-xs uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {devices.map((device) => (
                  <tr key={device.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text">{device.product.name}</p>
                      <p className="text-xs text-text-muted">{device.product.brand}</p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{device.product.sku}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      <div className="text-xs">
                        {device.imei_1 && <div>IMEI1: {device.imei_1}</div>}
                        {device.serial_number && <div>SN: {device.serial_number}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text text-right">{device.cost_price} DH</td>
                    <td className="px-4 py-3 text-text text-right">{device.default_selling_price} DH</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {device.condition} {device.battery_health ? `(${device.battery_health}%)` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border
                        ${device.status === 'IN_STOCK' ? 'bg-green-500/10 text-green-400 border-green-500/20' : ''}
                        ${device.status === 'SOLD' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : ''}
                        ${device.status === 'RESERVED' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : ''}
                        ${device.status === 'REPAIR' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : ''}
                        ${device.status === 'DAMAGED' ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''}
                        ${device.status === 'LOST' ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''}
                      `}>
                        {device.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => handleToggleDropdown(e, device.id)}
                        className={`p-1.5 rounded-lg border transition-all inline-flex items-center justify-center cursor-pointer ${
                          dropdownOpenId === device.id
                            ? 'bg-gold/15 text-gold border-gold/40 shadow-sm ring-2 ring-gold/20'
                            : 'bg-surface-alt hover:bg-surface-hover text-text-secondary hover:text-text border-border hover:border-border-focus'
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
                      <div className="text-text-muted mb-2">No devices found.</div>
                      {search || status !== 'ALL' || condition || platform ? (
                        <button 
                          onClick={() => { setSearch(''); setStatus('ALL'); setCondition(''); setPlatform(''); }}
                          className="text-gold hover:underline text-sm"
                        >
                          Clear all filters
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
    </div>
  );
}
