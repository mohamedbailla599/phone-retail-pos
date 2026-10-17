/**
 * Thermal Receipt Printing Utility
 * Isolates receipt printing inside a hidden iframe to prevent modal, background,
 * and SPA layout clutter from bleeding into the browser print dialog.
 */
import JsBarcode from 'jsbarcode';
import { useSettingsStore } from '../store/settingsStore';
import { STORE_LOGO_DATA_URL } from './logoBase64';

export interface ReceiptStoreInfo {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  currency: string;
  receiptPrefix: string;
  footerMessage: string;
  disclaimer: string;
}

/**
 * Retrieves the live, user-configured store settings from Zustand store
 * with sensible fallbacks matching the active establishment.
 */
export function getReceiptStoreInfo(): ReceiptStoreInfo {
  const settings = useSettingsStore.getState().settings;
  return {
    storeName: settings?.store_name || 'BIGHRISSEN PHONE',
    storeAddress: settings?.address || 'Boulevard Youssef Bin Tachfine, Guelmim',
    storePhone: settings?.phone_number || '+212 617-646824',
    currency: settings?.currency || 'DH',
    receiptPrefix: settings?.receipt_prefix || 'BP',
    footerMessage:
      settings?.receipt_footer_message ||
      'Merci pour votre visite ! Les articles vendus sont garantis selon conditions.',
    disclaimer: 'Aucun remboursement ou échange sans ce ticket.',
  };
}

/**
 * Generates an SVG string representation of a Code 128 barcode
 */
export function generateBarcodeSvg(value: string, height: number = 30, width: number = 1.3): string {
  if (!value) return '';
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, value, {
      format: 'CODE128',
      width,
      height,
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    });
    return svg.outerHTML;
  } catch (err) {
    console.error('Error generating barcode SVG:', err);
    return '';
  }
}

/**
 * Standardized store header applied across all thermal receipts (80mm)
 * Features the official circular badge logo on the left and store credentials on the right.
 */
export function renderReceiptHeader(subTitle?: string, showLogo: boolean = true): string {
  const info = getReceiptStoreInfo();

  if (showLogo) {
    return `
      <div class="receipt-header-row">
        <div class="receipt-logo-col">
          <img src="${STORE_LOGO_DATA_URL}" alt="Logo" class="receipt-logo-img" />
        </div>
        <div class="receipt-info-col">
          <div class="font-bold text-base uppercase leading-tight">${info.storeName}</div>
          ${subTitle ? `<div class="text-xs font-semibold uppercase mt-0.5 leading-tight">${subTitle}</div>` : ''}
          ${info.storeAddress ? `<div class="text-xxs mt-0.5 leading-tight">${info.storeAddress}</div>` : ''}
          ${info.storePhone ? `<div class="text-xxs leading-tight">Tél : ${info.storePhone}</div>` : ''}
        </div>
      </div>
    `;
  }

  return `
    <div class="text-center border-b-dashed pb-2">
      <div class="font-bold text-base uppercase">${info.storeName}</div>
      ${subTitle ? `<div class="text-xs font-semibold uppercase mt-0.5">${subTitle}</div>` : ''}
      ${info.storeAddress ? `<div class="text-xxs">${info.storeAddress}</div>` : ''}
      ${info.storePhone ? `<div class="text-xxs">Tél : ${info.storePhone}</div>` : ''}
    </div>
  `;
}

/**
 * Standardized store footer applied across all thermal receipts (80mm)
 */
export function renderReceiptFooter(additionalNotices?: string[]): string {
  const info = getReceiptStoreInfo();
  const noticesHtml =
    additionalNotices && additionalNotices.length > 0
      ? `<div class="my-1">${additionalNotices.map((n) => `<p>${n}</p>`).join('')}</div>`
      : '';

  return `
    <div class="text-center text-xxs mt-3 pt-2 border-t-dashed space-y-1">
      <p class="font-bold whitespace-pre-line">${info.footerMessage}</p>
      ${noticesHtml}
      <p class="text-[9px] text-gray-700">${info.disclaimer}</p>
    </div>
  `;
}

export function printThermalReceipt(contentHtml: string, title: string = 'Receipt') {
  // Check if print iframe already exists, or create a new one
  let iframe = document.getElementById('thermal-print-iframe') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'thermal-print-iframe';
    // Use off-screen placement with positive dimensions rather than visibility:hidden or 0x0 size
    // to prevent Chromium from treating the iframe as unrendered (which causes blank print previews).
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '80mm';
    iframe.style.height = '1200px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    // Fallback if iframe contentWindow is inaccessible
    window.print();
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            width: 76mm;
            max-width: 80mm;
            margin: 0 auto;
            padding: 3mm 2mm;
            background: #ffffff;
            color: #000000;
            font-family: 'Courier New', Courier, monospace, system-ui;
            font-size: 11px;
            line-height: 1.25;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .uppercase { text-transform: uppercase; }
          .text-xs { font-size: 10px; }
          .text-xxs { font-size: 9px; }
          .text-sm { font-size: 12px; }
          .text-base { font-size: 13px; }
          .text-lg { font-size: 14px; }
          .receipt-header-row {
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 1px dashed #000000;
            padding-bottom: 6px;
            margin-bottom: 6px;
          }
          .receipt-logo-col {
            flex-shrink: 0;
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .receipt-logo-img {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            object-fit: cover;
            border: 1.5px solid #000000;
            display: block;
          }
          .receipt-info-col {
            flex: 1;
            text-align: left;
            min-width: 0;
          }
          .leading-tight { line-height: 1.25; }
          .border-b-dashed {
            border-bottom: 1px dashed #000000;
            padding-bottom: 5px;
            margin-bottom: 5px;
          }
          .border-t-dashed {
            border-top: 1px dashed #000000;
            padding-top: 5px;
            margin-top: 5px;
          }
          .border-b-dotted {
            border-bottom: 1px dotted #444444;
            padding-bottom: 3px;
            margin-bottom: 3px;
          }
          .border-b-double {
            border-bottom: 2px solid #000000;
            padding-bottom: 5px;
            margin-bottom: 5px;
          }
          .border-box {
            border: 1px solid #000000;
            padding: 3px 4px;
            margin: 3px 0;
            background: #f7f7f7;
          }
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .items-center { align-items: center; }
          .gap-1 { gap: 4px; }
          .py-05 { padding-top: 2px; padding-bottom: 2px; }
          .py-1 { padding-top: 4px; padding-bottom: 4px; }
          .mt-1 { margin-top: 4px; }
          .mt-2 { margin-top: 8px; }
          .mb-1 { margin-bottom: 4px; }
          .mb-2 { margin-bottom: 8px; }
          .my-1 { margin-top: 4px; margin-bottom: 4px; }
          .my-2 { margin-top: 8px; margin-bottom: 8px; }
          .my-3 { margin-top: 12px; margin-bottom: 12px; }
          .muted { color: #333333; }
          .mono { font-family: monospace; }
          .barcode-container { display: flex; justify-content: center; align-items: center; width: 100%; margin: 4px 0; }
          .barcode-container svg { max-width: 100%; height: auto; }
          .cut-separator { text-align: center; font-size: 10px; color: #222; margin: 12px 0 8px 0; border-top: 1px dashed #000; padding-top: 6px; }
          .workshop-stub { background: #fafafa; border: 1px dashed #333; padding: 6px; margin-top: 6px; }
          .page-break {
            page-break-before: always !important;
            break-before: page !important;
            clear: both !important;
            display: block !important;
          }
          .ticket-section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          @media print {
            .page-break {
              page-break-before: always !important;
              break-before: page !important;
              clear: both !important;
              display: block !important;
            }
            .ticket-section {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
          .pt-2 { padding-top: 8px; }
          .pt-4 { padding-top: 16px; }
        </style>
      </head>
      <body>
        ${contentHtml}
      </body>
    </html>
  `);
  doc.close();

  // Allow iframe layout engine to compute dimensions before opening dialog
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Failed to trigger iframe print', e);
      window.print();
    }
  }, 200);
}
