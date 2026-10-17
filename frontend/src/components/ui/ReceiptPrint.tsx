import { generatePOSReceiptHtml } from '../../utils/printPOSReceipt';

interface ReceiptPrintProps {
  transaction: any;
  operator: any;
}

export default function ReceiptPrint({ transaction, operator }: ReceiptPrintProps) {
  if (!transaction) return null;

  const html = generatePOSReceiptHtml(transaction, operator);

  return (
    <div
      id="thermal-receipt-root"
      className="hidden print:block w-full max-w-[80mm] mx-auto bg-white text-black p-4 text-[12px] font-mono leading-tight"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
