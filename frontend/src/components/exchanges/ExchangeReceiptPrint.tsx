import type { Exchange } from '../../api/exchanges';
import { printThermalReceipt } from '../../utils/printReceipt';

interface ExchangeReceiptPrintProps {
  exchange: Exchange | null;
  operator?: any;
}

export function generateExchangeReceiptHtml(exchange: Exchange, operator?: any): string {
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) {
      return new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date());
    }
    return new Intl.DateTimeFormat('en-GB', {
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
    'Staff';

  const replacementName =
    exchange.new_device_product_name ||
    `Store Device #${exchange.new_device}`;

  const settlementLabel =
    exchange.financial_direction === 'CUSTOMER_PAYS'
      ? 'CUSTOMER PAID'
      : exchange.financial_direction === 'STORE_REFUNDS'
      ? 'STORE REFUND'
      : 'EVEN TRADE';

  return `
    <div class="receipt-container">
      <!-- Store Header -->
      <div class="text-center border-b-dashed">
        <div class="text-base font-bold uppercase">BIGHRISSEN PHONE</div>
        <div class="text-xs font-bold mt-1">DEVICE EXCHANGE & TRADE-IN</div>
        <div class="text-xxs muted">Boulevard Hassan II, Casablanca</div>
        <div class="text-xxs muted">Tel: +212 522 000 000</div>
      </div>

      <!-- Exchange Meta -->
      <div class="border-b-dashed text-xs">
        <div class="flex justify-between py-05">
          <span>EXCHANGE #:</span>
          <span class="font-bold mono">${exchange.exchange_number}</span>
        </div>
        <div class="flex justify-between py-05">
          <span>DATE:</span>
          <span>${formatDate(exchange.completed_at || exchange.created_at)}</span>
        </div>
        <div class="flex justify-between py-05">
          <span>OPERATOR:</span>
          <span>${operatorName}</span>
        </div>
        <div class="flex justify-between py-05 border-b-dotted">
          <span>CUSTOMER:</span>
          <span class="font-bold">${exchange.customer_name || 'Walk-in'}</span>
        </div>
        <div class="flex justify-between py-05">
          <span>TEL:</span>
          <span>${exchange.customer_phone || 'N/A'}</span>
        </div>
      </div>

      <!-- Section 1: Trade-in Device (Intake) -->
      <div class="border-b-dashed">
        <div class="border-box text-xxs font-bold uppercase flex justify-between">
          <span>1. TRADE-IN INTAKE</span>
          <span>RECEIVED</span>
        </div>
        <div class="text-xs py-05">
          <div class="font-bold">${exchange.trade_in_product_name || 'Customer Trade-in'}</div>
          <div class="flex justify-between text-xxs py-05">
            <span>IMEI:</span>
            <span class="mono font-bold">${exchange.trade_in_imei}</span>
          </div>
          <div class="flex justify-between text-xxs py-05">
            <span>Condition:</span>
            <span>Grade ${exchange.trade_in_condition || 'N/A'}${
              exchange.trade_in_battery_health ? ` • ${exchange.trade_in_battery_health}% Batt` : ''
            }</span>
          </div>
          <div class="flex justify-between text-xs font-bold pt-1 border-b-dotted">
            <span>Trade-In Credit:</span>
            <span>MAD ${tradeInVal}</span>
          </div>
        </div>
      </div>

      <!-- Section 2: Replacement Device (Delivered) -->
      <div class="border-b-dashed">
        <div class="border-box text-xxs font-bold uppercase flex justify-between">
          <span>2. REPLACEMENT DELIVERED</span>
          <span>HANDED OVER</span>
        </div>
        <div class="text-xs py-05">
          <div class="font-bold">${replacementName}</div>
          ${
            exchange.new_device_imei_1
              ? `<div class="flex justify-between text-xxs py-05">
                   <span>IMEI:</span>
                   <span class="mono font-bold">${exchange.new_device_imei_1}</span>
                 </div>`
              : ''
          }
          <div class="flex justify-between text-xxs py-05">
            <span>Inventory Status:</span>
            <span>SOLD / ASSIGNED</span>
          </div>
          <div class="flex justify-between text-xs font-bold pt-1 border-b-dotted">
            <span>Device Price:</span>
            <span>MAD ${newPrice}</span>
          </div>
        </div>
      </div>

      <!-- Section 3: Financial Settlement -->
      <div class="border-b-dashed text-xs">
        <div class="text-xxs font-bold uppercase mb-1">VALUATION SETTLEMENT</div>
        <div class="flex justify-between py-05">
          <span>Replacement Price:</span>
          <span>MAD ${newPrice}</span>
        </div>
        <div class="flex justify-between py-05">
          <span>Less Trade-In Credit:</span>
          <span>- MAD ${tradeInVal}</span>
        </div>
        <div class="flex justify-between font-bold text-sm border-b-double py-1 mt-1">
          <span>${settlementLabel}:</span>
          <span>${exchange.financial_direction === 'EVEN' ? 'MAD 0.00' : `MAD ${diff}`}</span>
        </div>
        <div class="flex justify-between text-xxs py-05">
          <span>Settlement Status:</span>
          <span class="font-bold">SETTLED & CONFIRMED</span>
        </div>
      </div>

      <!-- Section 4: Customer Terms & Acknowledgment -->
      <div class="text-center text-xxs muted pt-1">
        <div class="font-bold uppercase text-xs mb-1">CUSTOMER ACKNOWLEDGMENT</div>
        <div class="py-05">• Trade-in device is certified legitimate personal property.</div>
        <div class="py-05">• 3-month store warranty applies to replacement device.</div>
        <div class="py-05">• Keep this original receipt for warranty claims.</div>
        <div class="font-bold text-xs mt-2">THANK YOU FOR YOUR BUSINESS!</div>
        <div class="mono text-xxs mt-1 font-bold">*** ${exchange.exchange_number} ***</div>
      </div>
    </div>
  `;
}

export function printExchangeReceipt(exchange: Exchange, operator?: any) {
  if (!exchange) return;
  const html = generateExchangeReceiptHtml(exchange, operator);
  printThermalReceipt(html, `Exchange_Receipt_${exchange.exchange_number}`);
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
