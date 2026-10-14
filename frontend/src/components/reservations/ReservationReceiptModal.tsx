import { useRef } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { type Reservation } from '../../api/reservations';
import { useSettingsStore } from '../../store/settingsStore';
import { Printer } from 'lucide-react';

interface ReservationReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
}

export default function ReservationReceiptModal({
  isOpen,
  onClose,
  reservation,
}: ReservationReceiptModalProps) {
  const { settings } = useSettingsStore();
  const printRef = useRef<HTMLDivElement>(null);

  if (!reservation) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bon de Réservation / Reçu d'acompte" size="md">
      <div className="space-y-6">
        {/* Printable thermal receipt view */}
        <div
          ref={printRef}
          id="receipt-print-area"
          className="bg-white text-black p-6 rounded-lg font-mono text-xs shadow-inner space-y-4 max-w-sm mx-auto border border-neutral-300"
        >
          {/* Header */}
          <div className="text-center space-y-1 border-b border-dashed border-neutral-400 pb-3">
            <h2 className="text-base font-bold tracking-wider uppercase">
              {settings?.store_name || 'Bighrissen Phone'}
            </h2>
            <p className="text-[11px] text-neutral-600">{settings?.address || 'Boulevard Hassan II, Agadir'}</p>
            <p className="text-[11px] text-neutral-600">Tél: {settings?.phone_number || '+212 600-000000'}</p>
            <div className="pt-2 font-bold text-xs uppercase tracking-widest text-neutral-800">
              *** BON DE RÉSERVATION ***
            </div>
            <p className="text-[10px] text-neutral-500">N° {reservation.reservation_number}</p>
          </div>

          {/* Metadata */}
          <div className="text-[11px] space-y-1 border-b border-dashed border-neutral-400 pb-2">
            <div className="flex justify-between">
              <span>Date réservation:</span>
              <span>{formatDate(reservation.reserved_at)}</span>
            </div>
            <div className="flex justify-between font-bold text-neutral-900">
              <span>Date limite (Échéance):</span>
              <span>{formatDate(reservation.expires_at)}</span>
            </div>
            {reservation.receipt_id && (
              <div className="flex justify-between">
                <span>Réf Transaction:</span>
                <span>{reservation.receipt_id}</span>
              </div>
            )}
          </div>

          {/* Client Info */}
          <div className="text-[11px] space-y-1 border-b border-dashed border-neutral-400 pb-2">
            <div className="font-bold uppercase text-[10px] text-neutral-600">Client:</div>
            <div className="flex justify-between">
              <span className="font-semibold">{reservation.customer_name}</span>
              <span>{reservation.customer_phone}</span>
            </div>
          </div>

          {/* Reserved Device Info */}
          <div className="text-[11px] space-y-1 border-b border-dashed border-neutral-400 pb-2">
            <div className="font-bold uppercase text-[10px] text-neutral-600">Appareil Réservé:</div>
            <div className="font-bold text-xs">{reservation.device_name}</div>
            {reservation.device_imei && (
              <div className="flex justify-between text-neutral-600">
                <span>IMEI / N° Série:</span>
                <span className="font-mono">{reservation.device_imei}</span>
              </div>
            )}
            <div className="flex justify-between text-neutral-600 text-[10px]">
              <span>Couleur: {reservation.device_color || 'Standard'}</span>
              {reservation.device_storage && <span>Capacité: {reservation.device_storage}</span>}
            </div>
          </div>

          {/* Payment & Balance breakdown */}
          <div className="text-[11px] space-y-1.5 border-b border-dashed border-neutral-400 pb-3">
            <div className="flex justify-between font-bold text-xs">
              <span>Prix convenu:</span>
              <span>{parseFloat(reservation.reserved_price).toFixed(2)} DH</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Acompte versé:</span>
              <span>- {parseFloat(reservation.paid_amount).toFixed(2)} DH</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-neutral-900 border-t border-neutral-300 pt-1">
              <span>SOLDE RESTANT À PAYER:</span>
              <span>{parseFloat(reservation.remaining_balance).toFixed(2)} DH</span>
            </div>
          </div>

          {/* Payments list if multiple */}
          {reservation.payments && reservation.payments.length > 0 && (
            <div className="text-[10px] space-y-1 border-b border-dashed border-neutral-400 pb-2">
              <div className="font-bold text-neutral-600 uppercase text-[9px]">Détail des versements:</div>
              {reservation.payments.map((p) => (
                <div key={p.id} className="flex justify-between text-neutral-700">
                  <span>
                    {p.method === 'CASH' ? 'Espèces' : p.method === 'BANK_TRANSFER' ? 'Virement' : 'Crédit'}
                    {p.reference ? ` (${p.reference})` : ''}
                  </span>
                  <span>{parseFloat(p.amount).toFixed(2)} DH ({p.status})</span>
                </div>
              ))}
            </div>
          )}

          {/* Terms & Footer Note */}
          <div className="text-[10px] text-center text-neutral-600 space-y-1 pt-1 leading-tight">
            <p>
              Cet appareil est réservé jusqu'au{' '}
              <span className="font-bold text-black">{formatDate(reservation.expires_at)}</span>.
            </p>
            <p className="text-[9px] text-neutral-500">
              Prière de présenter ce bon lors du retrait de votre téléphone.
            </p>
            <p className="text-[9px] text-neutral-400 pt-1">Merci de votre confiance !</p>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2 border-t border-neutral-800">
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          <Button variant="primary" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimer le Bon de Réservation
          </Button>
        </div>
      </div>
    </Modal>
  );
}
