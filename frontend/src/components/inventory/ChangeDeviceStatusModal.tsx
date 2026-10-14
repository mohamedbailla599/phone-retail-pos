import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Select } from '../ui/Select';
import { inventoryApi, type DeviceItem } from '../../api/inventory';
import { AlertCircle } from 'lucide-react';
import OperatorSelectionModal from '../ui/OperatorSelectionModal';
import { useRequireOperator } from '../../hooks/useRequireOperator';

interface ChangeDeviceStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  device: DeviceItem | null;
}

const ALL_STATUSES = [
  { value: 'IN_STOCK', label: 'In Stock' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'LOST', label: 'Lost' },
];

const DANGEROUS_STATUSES = ['SOLD', 'DAMAGED', 'LOST'];

export default function ChangeDeviceStatusModal({
  isOpen,
  onClose,
  onSuccess,
  device,
}: ChangeDeviceStatusModalProps) {
  const [targetStatus, setTargetStatus] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const {
    isOperatorModalOpen,
    onOperatorSelected,
    onOperatorModalClose,
    handleOperatorRequired,
  } = useRequireOperator();

  useEffect(() => {
    if (isOpen && device) {
      setTargetStatus('');
      setReason('');
      setError('');
      setShowConfirmation(false);
    }
  }, [isOpen, device]);

  const handleClose = () => {
    onClose();
    setTargetStatus('');
    setReason('');
    setError('');
    setShowConfirmation(false);
  };

  const availableTransitions = device 
    ? ALL_STATUSES.filter(s => s.value !== device.status) 
    : [];

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStatus) {
      setError('Please select a target status.');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason.');
      return;
    }
    
    if (DANGEROUS_STATUSES.includes(targetStatus)) {
      setShowConfirmation(true);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!device) return;

    setLoading(true);
    setError('');

    try {
      await inventoryApi.changeDeviceStatus({
        device_id: device.id,
        target_status: targetStatus,
        reason,
      });
      onSuccess();
      handleClose();
    } catch (err: any) {
      if (handleOperatorRequired(err, handleSubmit)) {
        return;
      }
      setError(err.response?.data?.error || 'Failed to change device status.');
      setShowConfirmation(false);
    } finally {
      setLoading(false);
    }
  };

  if (!device) return null;

  return (
    <>
      <Modal open={isOpen} onClose={handleClose} title="Change Device Status">
        <div className="p-6">
        {error && (
          <div className="p-3 mb-6 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="mb-6 p-4 bg-surface rounded border border-border">
          <p className="text-sm font-medium text-text">{device.product.name}</p>
          <p className="text-xs text-text-muted mt-1">
            {device.imei_1 && `IMEI 1: ${device.imei_1} `}
            {device.serial_number && `SN: ${device.serial_number}`}
          </p>
          <div className="mt-3 text-sm">
            <span className="text-text-secondary">Current Status: </span>
            <span className="font-medium text-text">{device.status.replace('_', ' ')}</span>
          </div>
        </div>

        {availableTransitions.length === 0 ? (
          <div className="text-center py-4 text-text-muted text-sm">
            No valid status transitions are available from {device.status}.
          </div>
        ) : !showConfirmation ? (
          <form id="changeStatusForm" onSubmit={handlePreSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">New Status</label>
              <Select
                value={targetStatus}
                onChange={setTargetStatus}
                options={[
                  { value: '', label: 'Select status...' },
                  ...availableTransitions
                ]}
              />
            </div>

            <Input
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for status change"
              required
            />
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-md">
              <h3 className="text-red-400 font-medium text-sm mb-2">Confirm Status Change</h3>
              <p className="text-sm text-text-secondary mb-1">
                Are you sure you want to mark this device as <span className="font-bold text-text">{targetStatus}</span>?
              </p>
              <p className="text-sm text-text-secondary">
                Reason: <span className="text-text">{reason}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-surface border-t border-border flex justify-end gap-3 rounded-b-xl">
        <Button
          variant="secondary"
          onClick={() => {
            if (showConfirmation) setShowConfirmation(false);
            else handleClose();
          }}
          disabled={loading}
        >
          {showConfirmation ? 'Back' : 'Cancel'}
        </Button>
        {availableTransitions.length > 0 && (
          <Button
            variant="primary"
            onClick={showConfirmation ? handleSubmit : handlePreSubmit}
            loading={loading}
          >
            {showConfirmation ? 'Confirm Change' : 'Review Change'}
          </Button>
        )}
      </div>
    </Modal>
      <OperatorSelectionModal
        isOpen={isOperatorModalOpen}
        onClose={onOperatorModalClose}
        onSelect={onOperatorSelected}
      />
    </>
  );
}
