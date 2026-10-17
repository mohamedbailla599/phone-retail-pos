/**
 * POS Sales Thermal Receipt Printer (80mm)
 * Uses unified store settings (store_name, address, phone_number, currency, receipt_footer_message)
 */
import {
  printThermalReceipt,
  getReceiptStoreInfo,
  renderReceiptHeader,
  renderReceiptFooter,
  generateBarcodeSvg,
} from './printReceipt';

export interface POSTransactionReceiptData {
  id?: number | string;
  receipt_id?: string;
  created_at?: string;
  operator_name?: string;
  customer?: {
    id?: number;
    full_name?: string;
    phone_number?: string;
    current_debt?: string;
  } | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  items?: Array<{
    id?: number | string;
    name: string;
    price: string | number;
    quantity?: number;
    identifier?: string | null;
    sku?: string | null;
    type?: string;
  }>;
  subtotal?: string | number;
  discount_amount?: string | number;
  total_amount?: string | number;
  confirmed_paid?: string | number;
  confirmed_payments?: Array<{
    method: string;
    amount: string | number;
  }>;
}

export function generatePOSReceiptHtml(
  transaction: POSTransactionReceiptData,
  operator?: any
): string {
  const storeInfo = getReceiptStoreInfo();

  const receiptId =
    transaction.receipt_id ||
    (transaction.id ? `${storeInfo.receiptPrefix}-${transaction.id}` : 'VENTE');

  const dateStr = transaction.created_at
    ? new Date(transaction.created_at).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  const operatorName =
    transaction.operator_name ||
    operator?.display_name ||
    operator?.username ||
    'Mohamed';

  const customerName =
    transaction.customer?.full_name ||
    transaction.customer_name ||
    'Client de Passage';

  const customerPhone =
    transaction.customer?.phone_number ||
    transaction.customer_phone ||
    '';

  const barcodeSvg = generateBarcodeSvg(receiptId, 28, 1.25);

  const subtotal = parseFloat(String(transaction.subtotal || transaction.total_amount || 0));
  const discount = parseFloat(String(transaction.discount_amount || 0));
  const total = parseFloat(String(transaction.total_amount || 0));
  const paid = parseFloat(String(transaction.confirmed_paid || total));

  const itemsHtml = (transaction.items || [])
    .map((item) => {
      const itemPrice = parseFloat(String(item.price || 0));
      const qty = item.quantity || 1;
      const itemTotal = itemPrice * qty;

      return `
        <div class="py-1 border-b-dotted">
          <div class="flex justify-between font-bold text-xs">
            <span>${item.name}</span>
            <span>${itemTotal.toFixed(2)} ${storeInfo.currency}</span>
          </div>
          ${
            item.identifier
              ? `<div class="text-xxs text-gray-700 font-mono">IMEI: ${item.identifier}</div>`
              : item.sku
              ? `<div class="text-xxs text-gray-700 font-mono">SKU: ${item.sku}</div>`
              : ''
          }
          ${
            qty > 1
              ? `<div class="text-xxs text-gray-600">${itemPrice.toFixed(2)} ${storeInfo.currency} × ${qty}</div>`
              : ''
          }
        </div>
      `;
    })
    .join('');

  const payments = transaction.confirmed_payments || [];
  const paymentsHtml =
    payments.length > 0
      ? payments
          .map((p) => {
            const methodLabel =
              p.method === 'DEBT'
                ? 'Vente à Crédit (Dette)'
                : p.method === 'BANK_TRANSFER'
                ? 'Virement Bancaire'
                : 'Espèces';
            return `
            <div class="flex justify-between text-xxs py-05 text-gray-700">
              <span>Mode : ${methodLabel}</span>
              <span>${parseFloat(String(p.amount)).toFixed(2)} ${storeInfo.currency}</span>
            </div>
          `;
          })
          .join('')
      : `
        <div class="flex justify-between text-xxs py-05 text-gray-700">
          <span>Mode : Espèces</span>
          <span>${paid.toFixed(2)} ${storeInfo.currency}</span>
        </div>
      `;

  const customerDebt = parseFloat(String(transaction.customer?.current_debt || 0));

  return `
    <div class="ticket-section">
      <!-- En-tête officiel de la boutique -->
      ${renderReceiptHeader('TICKET DE CAISSE / REÇU')}

      <!-- Meta du ticket & Code-barres -->
      <div class="border-b-dashed text-xs py-1">
        <div class="flex justify-between font-bold">
          <span>Ticket :</span>
          <span class="mono">${receiptId}</span>
        </div>
        ${barcodeSvg ? `<div class="barcode-container my-1">${barcodeSvg}</div>` : ''}
        <div class="flex justify-between text-xxs">
          <span>Date :</span>
          <span>${dateStr}</span>
        </div>
        <div class="flex justify-between text-xxs">
          <span>Opérateur :</span>
          <span>${operatorName}</span>
        </div>
        <div class="flex justify-between text-xxs">
          <span>Client :</span>
          <span class="font-bold">${customerName}${customerPhone ? ` (${customerPhone})` : ''}</span>
        </div>
      </div>

      <!-- Articles vendus -->
      <div class="border-b-dashed py-1">
        <div class="flex justify-between font-bold text-xxs uppercase tracking-wider pb-05 border-b-dotted">
          <span>Article</span>
          <span>Total</span>
        </div>
        ${itemsHtml}
      </div>

      <!-- Totaux et Règlements -->
      <div class="border-b-dashed py-1 text-xs">
        ${
          discount > 0
            ? `
          <div class="flex justify-between py-05">
            <span>Sous-total:</span>
            <span>${subtotal.toFixed(2)} ${storeInfo.currency}</span>
          </div>
          <div class="flex justify-between py-05 text-emerald-700 font-bold">
            <span>Remise accordée:</span>
            <span>-${discount.toFixed(2)} ${storeInfo.currency}</span>
          </div>
        `
            : ''
        }
        <div class="flex justify-between font-bold text-sm border-b-double py-1">
          <span>TOTAL :</span>
          <span>${total.toFixed(2)} ${storeInfo.currency}</span>
        </div>
        <div class="pt-1">
          ${paymentsHtml}
        </div>
        ${
          customerDebt > 0
            ? `
          <div class="flex justify-between font-bold text-xxs pt-1 border-t-dotted mt-1 text-amber-800">
            <span>Solde dette client actuel :</span>
            <span>${customerDebt.toFixed(2)} ${storeInfo.currency}</span>
          </div>
        `
            : ''
        }
      </div>

      <!-- Pied de reçu thermique configuré dans les paramètres -->
      ${renderReceiptFooter()}
    </div>
  `;
}

export function printPOSReceipt(transaction: POSTransactionReceiptData, operator?: any) {
  if (!transaction) return;
  const storeInfo = getReceiptStoreInfo();
  const receiptId =
    transaction.receipt_id ||
    (transaction.id ? `${storeInfo.receiptPrefix}-${transaction.id}` : 'VENTE');
  const html = generatePOSReceiptHtml(transaction, operator);
  printThermalReceipt(html, `Recu_${receiptId}`);
}
