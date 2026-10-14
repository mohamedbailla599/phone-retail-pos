import { type Reservation } from '../api/reservations';
import { printThermalReceipt } from './printReceipt';

interface StoreSettings {
  store_name?: string;
  address?: string;
  phone_number?: string;
}

export function generateReservationReceiptHtml(
  reservation: Reservation,
  settings?: StoreSettings | null
): string {
  const isCompleted = reservation.status === 'COMPLETED';
  const isCancelled = reservation.status === 'CANCELLED';

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
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

  const storeName = settings?.store_name || 'BIGHRISSEN PHONE';
  const storeAddress = settings?.address || 'Boulevard Hassan II, Agadir';
  const storePhone = settings?.phone_number || '+212 600-000000';

  const title = isCompleted
    ? 'FACTURE / BON DE LIVRAISON'
    : isCancelled
    ? "BON D'ANNULATION & REMBOURSEMENT"
    : 'BON DE RÉSERVATION';

  const paymentsHtml =
    reservation.payments && reservation.payments.length > 0
      ? `
      <div class="border-b-dashed text-xs py-1">
        <div class="font-bold uppercase text-xxs muted mb-1">DÉTAIL DES VERSEMENTS</div>
        ${reservation.payments
          .map(
            (p) => `
          <div class="flex justify-between py-05">
            <span>${p.method === 'CASH' ? 'Espèces' : p.method === 'BANK_TRANSFER' ? 'Virement' : 'Crédit'}${
              p.reference ? ` (${p.reference})` : ''
            }</span>
            <span class="font-bold mono">${parseFloat(p.amount).toFixed(2)} DH</span>
          </div>
        `
          )
          .join('')}
      </div>
    `
      : '';

  return `
    <div class="receipt-container">
      <!-- Store Header -->
      <div class="text-center border-b-dashed pb-2">
        <div class="text-base font-bold uppercase">${storeName}</div>
        <div class="text-xxs muted">${storeAddress}</div>
        <div class="text-xxs muted">Tél: ${storePhone}</div>
      </div>

      <!-- Receipt Meta & Type -->
      <div class="text-center my-2 border-box">
        <div class="text-xxs uppercase tracking-wider font-bold">*** ${title} ***</div>
        <div class="text-base font-bold mono">N° ${reservation.reservation_number}</div>
        ${
          isCompleted
            ? `<div class="text-xxs font-bold uppercase" style="color: #047857; margin-top: 2px;">VENTE FINALISÉE & LIVRÉ</div>`
            : ''
        }
      </div>

      <!-- Dates & Reference -->
      <div class="border-b-dashed text-xs py-1">
        <div class="flex justify-between py-05">
          <span>Date réservation:</span>
          <span class="mono">${formatDate(reservation.reserved_at)}</span>
        </div>
        ${
          isCompleted
            ? `
          <div class="flex justify-between py-05 font-bold">
            <span>Date livraison:</span>
            <span class="mono">${formatDate(reservation.completed_at || reservation.updated_at)}</span>
          </div>
        `
            : `
          <div class="flex justify-between py-05 font-bold">
            <span>Date limite (Échéance):</span>
            <span class="mono">${formatDate(reservation.expires_at)}</span>
          </div>
        `
        }
        ${
          reservation.receipt_id
            ? `
          <div class="flex justify-between py-05">
            <span>Réf Transaction:</span>
            <span class="mono font-bold">${reservation.receipt_id}</span>
          </div>
        `
            : ''
        }
      </div>

      <!-- Customer Info -->
      <div class="border-b-dashed text-xs py-1">
        <div class="font-bold uppercase text-xxs muted mb-1">CLIENT</div>
        <div class="flex justify-between py-05">
          <span class="font-bold">${reservation.customer_name}</span>
          <span>${reservation.customer_phone || '-'}</span>
        </div>
      </div>

      <!-- Device Info -->
      <div class="border-b-dashed text-xs py-1">
        <div class="font-bold uppercase text-xxs muted mb-1">${
          isCompleted ? 'APPAREIL LIVRÉ' : 'APPAREIL RÉSERVÉ'
        }</div>
        <div class="font-bold text-sm py-05">${reservation.device_name}</div>
        ${
          reservation.device_imei
            ? `
          <div class="flex justify-between py-05">
            <span>IMEI / N° Série:</span>
            <span class="mono font-bold">${reservation.device_imei}</span>
          </div>
        `
            : ''
        }
        <div class="flex justify-between py-05 text-xxs muted">
          <span>Couleur: ${reservation.device_color || 'Standard'}</span>
          ${reservation.device_battery ? `<span>Batterie: ${reservation.device_battery}%</span>` : ''}
        </div>
      </div>

      <!-- Financial Breakdown -->
      <div class="border-b-dashed text-xs py-1">
        <div class="flex justify-between py-05">
          <span>Prix convenu:</span>
          <span class="font-bold mono">${parseFloat(reservation.reserved_price).toFixed(2)} DH</span>
        </div>
        <div class="flex justify-between py-05 font-bold" style="color: #047857;">
          <span>${isCompleted ? 'Total encaissé:' : 'Acompte versé:'}</span>
          <span class="mono">- ${parseFloat(reservation.paid_amount).toFixed(2)} DH</span>
        </div>
        <div class="flex justify-between py-1 border-t font-bold text-sm mt-1" style="border-top: 1px solid #000;">
          <span>SOLDE RESTANT:</span>
          <span class="mono">${parseFloat(reservation.remaining_balance).toFixed(2)} DH</span>
        </div>
      </div>

      <!-- Payments Detail -->
      ${paymentsHtml}

      <!-- Footer Notices -->
      <div class="text-center text-xxs muted pt-2" style="line-height: 1.4;">
        ${
          isCompleted
            ? `
          <div class="font-bold" style="color: #000;">Appareil livré et vente finalisée avec succès.</div>
          <div>Garantie légale et assistance boutique activées.</div>
        `
            : isCancelled
            ? `
          <div class="font-bold" style="color: #b91c1c;">Réservation annulée.</div>
        `
            : `
          <div>Cet appareil est réservé jusqu'au <b>${formatDate(reservation.expires_at)}</b>.</div>
          <div>Prière de présenter ce bon lors du retrait de votre téléphone.</div>
        `
        }
        <div class="mt-2 font-bold" style="color: #000;">Merci de votre confiance !</div>
      </div>
    </div>
  `;
}

export function printReservationReceipt(
  reservation: Reservation,
  settings?: StoreSettings | null
) {
  const html = generateReservationReceiptHtml(reservation, settings);
  const title = `Recu_${reservation.reservation_number}`;
  printThermalReceipt(html, title);
}
