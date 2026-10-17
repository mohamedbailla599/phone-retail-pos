import type { ZReportData } from '../../api/reports';
import { getReceiptStoreInfo, printThermalReceipt, renderReceiptHeader } from '../../utils/printReceipt';

interface ZReportReceiptPrintProps {
  data: ZReportData;
  operatorName?: string;
}

export function generateZReportHtml(data: ZReportData, operatorName?: string): string {
  const storeInfo = getReceiptStoreInfo();

  const formatDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const curr = storeInfo.currency;

  return `
    <div class="ticket-section">
      <!-- Header with logo -->
      ${renderReceiptHeader('CLÔTURE DE CAISSE (TICKET Z)')}
      <div class="border-b-dashed pb-1 mb-2 text-xs">
        <div class="flex justify-between text-xxs py-05">
          <span>Période :</span>
          <span class="font-bold">${data.period.start_date} ${data.period.is_single_day ? '' : `au ${data.period.end_date}`}</span>
        </div>
        <div class="flex justify-between text-xxs py-05">
          <span>Généré le :</span>
          <span>${formatDate(data.period.generated_at)}</span>
        </div>
        ${operatorName ? `
        <div class="flex justify-between text-xxs py-05">
          <span>Opérateur :</span>
          <span>${operatorName}</span>
        </div>` : ''}
      </div>

      <!-- Section 1: Tiroir Caisse -->
      <div class="mb-2 border-b-dashed pb-2 text-xs">
        <div class="text-center font-bold text-xxs uppercase mb-1">
          === ENCAISSEMENTS & TIROIR ===
        </div>
        <div class="flex justify-between py-05">
          <span>Espèces Ventes :</span>
          <span class="mono">${data.kpi.direct_cash} ${curr}</span>
        </div>
        <div class="flex justify-between py-05">
          <span>Espèces Dettes récupérées :</span>
          <span class="mono">${data.kpi.debt_cash} ${curr}</span>
        </div>
        <div class="flex justify-between font-bold text-sm border-t border-black pt-1 mt-1">
          <span>TOTAL TIROIR (ESPÈCES) :</span>
          <span class="mono">${data.kpi.cash_in_drawer} ${curr}</span>
        </div>
        <div class="flex justify-between py-05 pt-1">
          <span>Virements Ventes :</span>
          <span class="mono">${data.kpi.direct_transfer} ${curr}</span>
        </div>
        <div class="flex justify-between py-05">
          <span>Virements Dettes :</span>
          <span class="mono">${data.kpi.debt_transfer} ${curr}</span>
        </div>
        <div class="flex justify-between font-semibold border-t-dotted pt-1">
          <span>Total Virements :</span>
          <span class="mono">${data.kpi.total_bank_transfer} ${curr}</span>
        </div>
        <div class="flex justify-between font-bold text-sm border-t border-black pt-1 mt-1">
          <span>TOTAL ENCAISSÉ RÉEL :</span>
          <span class="mono">${data.kpi.total_real_collected} ${curr}</span>
        </div>
      </div>

      <!-- Section 2: Ventes & Chiffre d'Affaires -->
      <div class="mb-2 border-b-dashed pb-2 text-xs">
        <div class="text-center font-bold text-xxs uppercase mb-1">
          === CHIFFRE D'AFFAIRES ===
        </div>
        <div class="flex justify-between py-05">
          <span>Nombre de Ventes :</span>
          <span class="mono font-bold">${data.kpi.sales_count}</span>
        </div>
        <div class="flex justify-between py-05">
          <span>Panier Moyen :</span>
          <span class="mono">${data.kpi.average_basket} ${curr}</span>
        </div>
        <div class="flex justify-between py-05">
          <span>Sous-total Brut :</span>
          <span class="mono">${data.kpi.subtotal} ${curr}</span>
        </div>
        <div class="flex justify-between py-05 text-emerald-700">
          <span>Total Remises :</span>
          <span class="mono">-${data.kpi.total_discount} ${curr}</span>
        </div>
        <div class="flex justify-between font-bold text-sm border-t border-black pt-1 mt-1">
          <span>C.A. NET DU JOUR :</span>
          <span class="mono">${data.kpi.total_revenue} ${curr}</span>
        </div>
        <div class="flex justify-between py-05 pt-1 text-xxs">
          <span>Nouveau Crédit accordé :</span>
          <span class="mono">${data.kpi.new_debt_granted} ${curr}</span>
        </div>
        <div class="flex justify-between py-05 text-xxs">
          <span>Total Dettes recouvrées :</span>
          <span class="mono">${data.kpi.total_debt_recovered} ${curr}</span>
        </div>
      </div>

      <!-- Section 3: Marges & Bénéfices -->
      <div class="mb-2 border-b-dashed pb-2 text-xs">
        <div class="text-center font-bold text-xxs uppercase mb-1">
          === BÉNÉFICES ESTIMÉS ===
        </div>
        <div class="flex justify-between py-05">
          <span>Coût d'achat (COGS) :</span>
          <span class="mono">${data.kpi.total_cogs} ${curr}</span>
        </div>
        <div class="flex justify-between font-bold py-05">
          <span>Marge Brute :</span>
          <span class="mono">${data.kpi.gross_profit} ${curr}</span>
        </div>
        <div class="flex justify-between py-05">
          <span>Taux de Marge :</span>
          <span class="mono font-bold">${data.kpi.margin_percent} %</span>
        </div>
      </div>

      <!-- Section 4: Rayons -->
      <div class="mb-2 border-b-dashed pb-2 text-xs">
        <div class="text-center font-bold text-xxs uppercase mb-1">
          === RÉPARTITION PAR RAYON ===
        </div>
        <div class="flex justify-between py-05">
          <span>Téléphones (${data.breakdown.devices.units} pcs) :</span>
          <span class="mono">${data.breakdown.devices.revenue} ${curr}</span>
        </div>
        <div class="flex justify-between text-xxs pl-2">
          <span>- Bénéfice Téléphones :</span>
          <span class="mono">${data.breakdown.devices.profit} ${curr}</span>
        </div>
        <div class="flex justify-between py-05 pt-1">
          <span>Accessoires (${data.breakdown.accessories.units} pcs) :</span>
          <span class="mono">${data.breakdown.accessories.revenue} ${curr}</span>
        </div>
        <div class="flex justify-between text-xxs pl-2">
          <span>- Bénéfice Accessoires :</span>
          <span class="mono">${data.breakdown.accessories.profit} ${curr}</span>
        </div>
      </div>

      <!-- Signatures -->
      <div class="pt-2 text-center text-xxs space-y-6">
        <div class="flex justify-between px-2 pt-2">
          <span>Signature Caissier :</span>
          <span>Signature Gérant :</span>
        </div>
        <div class="text-center text-[9px] pt-4 border-t-dashed">
          *** FIN DU RAPPORT Z - ${storeInfo.storeName} ***
        </div>
      </div>
    </div>
  `;
}

export function printZReport(data: ZReportData, operatorName?: string) {
  if (!data) return;
  const html = generateZReportHtml(data, operatorName);
  printThermalReceipt(html, `Ticket_Z_${data.period.start_date}`);
}

export default function ZReportReceiptPrint({ data, operatorName }: ZReportReceiptPrintProps) {
  if (!data) return null;

  const html = generateZReportHtml(data, operatorName);

  return (
    <div
      id="thermal-receipt-root"
      className="hidden print:block w-full max-w-[80mm] mx-auto bg-white text-black p-4 text-[12px] font-mono leading-tight"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
