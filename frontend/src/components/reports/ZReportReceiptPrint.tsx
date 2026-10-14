import type { ZReportData } from '../../api/reports';

interface ZReportReceiptPrintProps {
  data: ZReportData;
  operatorName?: string;
}

export default function ZReportReceiptPrint({ data, operatorName }: ZReportReceiptPrintProps) {
  if (!data) return null;

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

  return (
    <div
      id="thermal-receipt-root"
      className="hidden print:block w-full max-w-[80mm] mx-auto bg-white text-black p-4 text-[12px] font-mono leading-tight"
    >
      {/* Header */}
      <div className="text-center mb-3 border-b border-black pb-3 border-dashed">
        <h1 className="text-base font-bold uppercase tracking-wider mb-1 text-black">BIGHRISSEN PHONE</h1>
        <p className="text-[11px] font-bold text-black">CLÔTURE DE CAISSE (TICKET Z)</p>
        <p className="text-[10px] text-black">Période: {data.period.start_date} {data.period.is_single_day ? '' : `au ${data.period.end_date}`}</p>
        <p className="text-[10px] text-black">Généré le: {formatDate(data.period.generated_at)}</p>
        {operatorName && <p className="text-[10px] text-black">Opérateur: {operatorName}</p>}
      </div>

      {/* Section 1: Tiroir Caisse */}
      <div className="mb-3 border-b border-black pb-3 border-dashed space-y-1">
        <div className="text-center font-bold text-[11px] uppercase mb-1">
          === ENCAISSEMENTS & TIROIR ===
        </div>
        <div className="flex justify-between">
          <span>Espèces Ventes :</span>
          <span>{data.kpi.direct_cash} DH</span>
        </div>
        <div className="flex justify-between">
          <span>Espèces Dettes récupérées :</span>
          <span>{data.kpi.debt_cash} DH</span>
        </div>
        <div className="flex justify-between font-bold text-[13px] border-t border-black pt-1 mt-1">
          <span>TOTAL TIROIR (ESPÈCES) :</span>
          <span>{data.kpi.cash_in_drawer} DH</span>
        </div>
        <div className="flex justify-between pt-1">
          <span>Virements Ventes :</span>
          <span>{data.kpi.direct_transfer} DH</span>
        </div>
        <div className="flex justify-between">
          <span>Virements Dettes :</span>
          <span>{data.kpi.debt_transfer} DH</span>
        </div>
        <div className="flex justify-between font-semibold border-t border-dotted border-gray-500 pt-1">
          <span>Total Virements :</span>
          <span>{data.kpi.total_bank_transfer} DH</span>
        </div>
        <div className="flex justify-between font-bold text-[13px] border-t border-black pt-1 mt-1">
          <span>TOTAL ENCAISSÉ RÉEL :</span>
          <span>{data.kpi.total_real_collected} DH</span>
        </div>
      </div>

      {/* Section 2: Ventes & Chiffre d'Affaires */}
      <div className="mb-3 border-b border-black pb-3 border-dashed space-y-1">
        <div className="text-center font-bold text-[11px] uppercase mb-1">
          === CHIFFRE D'AFFAIRES ===
        </div>
        <div className="flex justify-between">
          <span>Nombre de Ventes :</span>
          <span>{data.kpi.sales_count}</span>
        </div>
        <div className="flex justify-between">
          <span>Panier Moyen :</span>
          <span>{data.kpi.average_basket} DH</span>
        </div>
        <div className="flex justify-between">
          <span>Sous-total Brut :</span>
          <span>{data.kpi.subtotal} DH</span>
        </div>
        <div className="flex justify-between">
          <span>Total Remises :</span>
          <span>-{data.kpi.total_discount} DH</span>
        </div>
        <div className="flex justify-between font-bold text-[13px] border-t border-black pt-1 mt-1">
          <span>C.A. NET DU JOUR :</span>
          <span>{data.kpi.total_revenue} DH</span>
        </div>
        <div className="flex justify-between pt-1 text-black">
          <span>Nouveau Crédit accordé :</span>
          <span>{data.kpi.new_debt_granted} DH</span>
        </div>
        <div className="flex justify-between text-black">
          <span>Total Dettes recouvrées :</span>
          <span>{data.kpi.total_debt_recovered} DH</span>
        </div>
      </div>

      {/* Section 3: Marges & Bénéfices */}
      <div className="mb-3 border-b border-black pb-3 border-dashed space-y-1">
        <div className="text-center font-bold text-[11px] uppercase mb-1">
          === BÉNÉFICES ESTIMÉS ===
        </div>
        <div className="flex justify-between">
          <span>Coût d'achat (COGS) :</span>
          <span>{data.kpi.total_cogs} DH</span>
        </div>
        <div className="flex justify-between font-bold text-[12px]">
          <span>Marge Brute :</span>
          <span>{data.kpi.gross_profit} DH</span>
        </div>
        <div className="flex justify-between">
          <span>Taux de Marge :</span>
          <span>{data.kpi.margin_percent} %</span>
        </div>
      </div>

      {/* Section 4: Rayons */}
      <div className="mb-3 border-b border-black pb-3 border-dashed space-y-1">
        <div className="text-center font-bold text-[11px] uppercase mb-1">
          === RÉPARTITION PAR RAYON ===
        </div>
        <div className="flex justify-between">
          <span>Téléphones ({data.breakdown.devices.units} pcs) :</span>
          <span>{data.breakdown.devices.revenue} DH</span>
        </div>
        <div className="flex justify-between text-[11px] text-black pl-2">
          <span>- Bénéfice Téléphones :</span>
          <span>{data.breakdown.devices.profit} DH</span>
        </div>
        <div className="flex justify-between pt-1">
          <span>Accessoires ({data.breakdown.accessories.units} pcs) :</span>
          <span>{data.breakdown.accessories.revenue} DH</span>
        </div>
        <div className="flex justify-between text-[11px] text-black pl-2">
          <span>- Bénéfice Accessoires :</span>
          <span>{data.breakdown.accessories.profit} DH</span>
        </div>
      </div>

      {/* Signatures */}
      <div className="pt-2 text-center text-[10px] space-y-8">
        <div className="flex justify-between text-[10px] px-2">
          <span>Signature Caissier :</span>
          <span>Signature Gérant :</span>
        </div>
        <div className="text-center text-[9px] text-black">
          *** FIN DU RAPPORT Z - BIGHRISSEN PHONE ***
        </div>
      </div>
    </div>
  );
}
