import type { Exchange } from '../../api/exchanges';
import {
  printThermalReceipt,
  getReceiptStoreInfo,
  generateBarcodeSvg,
  renderReceiptHeader,
} from '../../utils/printReceipt';

interface ExchangeReceiptPrintProps {
  exchange: Exchange | null;
  operator?: any;
}

export function generateExchangeReceiptHtml(exchange: Exchange, operator?: any): string {
  const storeInfo = getReceiptStoreInfo();

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date());
    }
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(dateStr));
  };

  const tradeInVal = parseFloat(exchange.trade_in_value || '0').toFixed(2);
  const newPrice = parseFloat(exchange.new_device_price || '0').toFixed(2);
  const diff = parseFloat(exchange.difference_amount || '0').toFixed(2);

  const operatorName =
    exchange.completed_by_name ||
    operator?.display_name ||
    operator?.username ||
    'Mohamed';

  const replacementName =
    exchange.new_device_product_name ||
    `Appareil Boutique #${exchange.new_device}`;

  const settlementLabel =
    exchange.financial_direction === 'CUSTOMER_PAYS'
      ? 'DIFFÉRENCE PAYÉE PAR CLIENT'
      : exchange.financial_direction === 'STORE_REFUNDS'
      ? 'DIFFÉRENCE REMBOURSÉE PAR BOUTIQUE'
      : 'ÉCHANGE DIRECT ÉQUILIBRÉ';

  const barcodeSvg = generateBarcodeSvg(exchange.exchange_number, 28, 1.25);

  return `
    <div class="ticket-section">
      <!-- En-tête boutique unifié avec logo -->
      ${renderReceiptHeader('ÉCHANGE & REPRISE SMARTPHONE')}

      <!-- Méta de l'échange & Code-barres -->
      <div class="border-b-dashed text-xs py-1">
        <div class="flex justify-between py-05 font-bold">
          <span>BON ÉCHANGE N° :</span>
          <span class="mono">${exchange.exchange_number}</span>
        </div>
        ${barcodeSvg ? `<div class="barcode-container my-1">${barcodeSvg}</div>` : ''}
        <div class="flex justify-between py-05 text-xxs">
          <span>Date :</span>
          <span>${formatDate(exchange.completed_at || exchange.created_at)}</span>
        </div>
        <div class="flex justify-between py-05 text-xxs">
          <span>Opérateur :</span>
          <span>${operatorName}</span>
        </div>
        <div class="flex justify-between py-05 text-xxs border-b-dotted">
          <span>Client :</span>
          <span class="font-bold">${exchange.customer_name || 'Client de Passage'}</span>
        </div>
        ${
          exchange.customer_phone
            ? `
        <div class="flex justify-between py-05 text-xxs">
          <span>Tél Client :</span>
          <span class="mono">${exchange.customer_phone}</span>
        </div>`
            : ''
        }
      </div>

      <!-- Volet 1: Appareil Repris (Entrée Atelier) -->
      <div class="border-b-dashed py-1">
        <div class="border-box text-xxs font-bold uppercase flex justify-between">
          <span>1. APPAREIL REPRIS DU CLIENT</span>
          <span>REÇU</span>
        </div>
        <div class="text-xs py-05">
          <div class="font-bold">${exchange.trade_in_product_name || 'Appareil Client'}</div>
          <div class="flex justify-between text-xxs py-05">
            <span>IMEI :</span>
            <span class="mono font-bold">${exchange.trade_in_imei}</span>
          </div>
          <div class="flex justify-between text-xxs py-05">
            <span>État :</span>
            <span>Grade ${exchange.trade_in_condition || 'Standard'}${
              exchange.trade_in_battery_health ? ` • ${exchange.trade_in_battery_health}% Batterie` : ''
            }</span>
          </div>
          <div class="flex justify-between text-xs font-bold pt-1 border-b-dotted">
            <span>Valeur de reprise :</span>
            <span class="mono">${tradeInVal} ${storeInfo.currency}</span>
          </div>
        </div>
      </div>

      <!-- Volet 2: Nouvel Appareil Cédé (Sortie Boutique) -->
      <div class="border-b-dashed py-1">
        <div class="border-box text-xxs font-bold uppercase flex justify-between">
          <span>2. NOUVEL APPAREIL LIVRÉ</span>
          <span>CÉDÉ</span>
        </div>
        <div class="text-xs py-05">
          <div class="font-bold">${replacementName}</div>
          ${
            exchange.new_device_imei_1
              ? `<div class="flex justify-between text-xxs py-05">
                   <span>IMEI :</span>
                   <span class="mono font-bold">${exchange.new_device_imei_1}</span>
                 </div>`
              : ''
          }
          <div class="flex justify-between text-xs font-bold pt-1 border-b-dotted">
            <span>Prix appareil boutique :</span>
            <span class="mono">${newPrice} ${storeInfo.currency}</span>
          </div>
        </div>
      </div>

      <!-- Volet 3: Rapprochement Financier -->
      <div class="border-b-dashed text-xs py-1">
        <div class="text-xxs font-bold uppercase mb-1">RÈGLEMENT & SOLDE ÉCHANGE</div>
        <div class="flex justify-between py-05">
          <span>Prix nouvel appareil :</span>
          <span class="mono">${newPrice} ${storeInfo.currency}</span>
        </div>
        <div class="flex justify-between py-05 text-emerald-700">
          <span>Déduction valeur reprise :</span>
          <span class="mono font-bold">- ${tradeInVal} ${storeInfo.currency}</span>
        </div>
        <div class="flex justify-between font-bold text-sm border-b-double py-1 mt-1">
          <span>${settlementLabel} :</span>
          <span class="mono">${exchange.financial_direction === 'EVEN' ? `0.00 ${storeInfo.currency}` : `${diff} ${storeInfo.currency}`}</span>
        </div>
        <div class="flex justify-between text-xxs py-05">
          <span>Statut :</span>
          <span class="font-bold text-emerald-700">RÉGLÉ & CLÔTURÉ</span>
        </div>
      </div>

      <!-- Volet 4: Conditions & Pied de reçu boutique -->
      <div class="text-center text-xxs pt-1">
        <div class="my-1 text-gray-700">
          <p>• Le client atteste être le propriétaire légitime de l'appareil cédé.</p>
          <p>• Garantie légale boutique appliquée sur le nouvel appareil.</p>
        </div>
        <div class="text-center text-xxs mt-3 pt-2 border-t-dashed space-y-1">
          <p class="font-bold whitespace-pre-line">${storeInfo.footerMessage}</p>
          <p class="text-[9px] text-gray-700">${storeInfo.disclaimer}</p>
        </div>
      </div>
    </div>
  `;
}

export function printExchangeReceipt(exchange: Exchange, operator?: any) {
  if (!exchange) return;
  const html = generateExchangeReceiptHtml(exchange, operator);
  printThermalReceipt(html, `Bon_Echange_${exchange.exchange_number}`);
}

export default function ExchangeReceiptPrint({
  exchange,
  operator,
}: ExchangeReceiptPrintProps) {
  if (!exchange) return null;

  const html = generateExchangeReceiptHtml(exchange, operator);

  return (
    <div
      id="thermal-receipt-root"
      className="hidden print:block w-full max-w-[80mm] mx-auto bg-white text-black p-3 text-[11px] font-mono leading-tight"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
