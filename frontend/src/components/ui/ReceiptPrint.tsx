

import { useSettingsStore } from '../../store/settingsStore';

interface ReceiptPrintProps {
  transaction: any;
  operator: any;
}

export default function ReceiptPrint({ transaction, operator }: ReceiptPrintProps) {
  const { settings } = useSettingsStore();
  if (!transaction) return null;

  return (
    <div id="thermal-receipt-root" className="hidden print:block w-full max-w-[80mm] mx-auto bg-white text-black p-4 text-[12px] font-mono leading-tight">
      <style type="text/css" media="print">
        {`
          @page { size: 80mm auto; margin: 0; }
          body { padding: 4mm 2mm; margin: 0; }
        `}
      </style>
      <div className="text-center mb-4 border-b border-black pb-4 border-dashed">
        <h1 className="text-lg font-bold uppercase tracking-wider mb-1">{settings?.store_name || 'Bighrissen Phone'}</h1>
        <p>{settings?.address || 'Boulevard Hassan II, Agadir'}</p>
        <p>Tel: {settings?.phone_number || '+212 600-000000'}</p>
      </div>

      <div className="mb-4">
        <p>Receipt: {transaction.receipt_id || transaction.id}</p>
        <p>Date: {new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}</p>
        <p>Operator: {transaction.operator_name || operator?.name || 'Unknown'}</p>
        {(transaction.customer?.full_name || transaction.customer_name) && (
          <p>Client: {transaction.customer?.full_name || transaction.customer_name} {(transaction.customer?.phone_number || transaction.customer_phone) ? `(${transaction.customer?.phone_number || transaction.customer_phone})` : ''}</p>
        )}
      </div>

      <table className="w-full mb-4 border-t border-b border-black border-dashed py-2">
        <thead>
          <tr className="text-left border-b border-black">
            <th className="py-1 w-full">Item</th>
            <th className="text-right py-1 px-2 whitespace-nowrap">Qty</th>
            <th className="text-right py-1 pl-4 whitespace-nowrap">Price</th>
          </tr>
        </thead>
        <tbody>
          {transaction.items?.map((item: any) => (
            <tr key={item.id} className="align-top">
              <td className="py-2 pr-2">
                <div className="font-semibold">{item.name}</div>
                {item.identifier && <div className="text-[10px] text-gray-600">IMEI: {item.identifier}</div>}
                {item.sku && <div className="text-[10px] text-gray-600">SKU: {item.sku}</div>}
              </td>
              <td className="text-right py-2 px-2 whitespace-nowrap">{item.quantity || 1}</td>
              <td className="text-right py-2 pl-4 whitespace-nowrap">{parseFloat(item.price).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-1 text-right mb-4 border-b border-black pb-4 border-dashed">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{parseFloat(transaction.subtotal || '0').toFixed(2)} DH</span>
        </div>
        <div className="flex justify-between">
          <span>Discount:</span>
          <span>{parseFloat(transaction.discount_amount || '0').toFixed(2)} DH</span>
        </div>
        <div className="flex justify-between font-bold text-[14px] mt-1 pt-1 border-t border-black">
          <span>Total:</span>
          <span>{parseFloat(transaction.total_amount || '0').toFixed(2)} DH</span>
        </div>
      </div>

      <div className="mb-4 border-b border-black pb-4 border-dashed space-y-1">
        <div className="flex justify-between">
          <span>Amount Paid:</span>
          <span>{parseFloat(transaction.confirmed_paid || transaction.total_amount || '0').toFixed(2)} DH</span>
        </div>
        {transaction.confirmed_payments?.map((cp: any, i: number) => (
          <div key={i} className="flex justify-between text-[11px] text-gray-700">
            <span>• Mode: {cp.method === 'DEBT' ? 'Vente à Crédit (Dette)' : cp.method === 'BANK_TRANSFER' ? 'Virement Bancaire' : 'Espèces'}</span>
            <span>{parseFloat(cp.amount).toFixed(2)} DH</span>
          </div>
        ))}
        {transaction.customer && parseFloat(transaction.customer.current_debt || '0') > 0 && (
          <div className="flex justify-between text-[11px] font-bold text-black border-t border-dotted border-gray-400 pt-1 mt-1">
            <span>Solde dette client :</span>
            <span>{parseFloat(transaction.customer.current_debt).toFixed(2)} DH</span>
          </div>
        )}
      </div>

      <div className="text-center text-[10px]">
        {settings?.receipt_footer_message ? (
          <p className="font-semibold mb-1 whitespace-pre-line">{settings.receipt_footer_message}</p>
        ) : (
          <>
            <p className="font-bold mb-1">Merci pour votre visite !</p>
            <p>Les articles vendus sont garantis selon conditions.</p>
          </>
        )}
        <p className="text-[9px] text-gray-700">Aucun remboursement ou échange sans ce ticket de caisse.</p>
      </div>
    </div>
  );
}
