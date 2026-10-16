/**
 * Phone Back Sticker / Label Printing Utility
 * Isolates sticker label printing inside a hidden iframe with strict millimeter dimensions
 * for thermal sticker printers (50x30mm, 40x25mm, 58mm roll).
 * Strictly guarantees a single printed page without blank overflow pages.
 */

export interface StickerPrintOptions {
  widthMm?: number;
  heightMm?: number;
  title?: string;
}

export function printDeviceSticker(contentHtml: string, options: StickerPrintOptions = {}) {
  const { widthMm = 50, heightMm = 30, title = 'Device Label' } = options;

  let iframe = document.getElementById('sticker-print-iframe') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'sticker-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = `${widthMm}mm`;
    iframe.style.height = heightMm ? `${heightMm}mm` : '200px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  const usableHeightMm = heightMm ? heightMm - 1.8 : null;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page {
            size: ${widthMm}mm ${heightMm ? `${heightMm}mm` : 'auto'};
            margin: 0mm !important;
          }
          * {
            box-sizing: border-box !important;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            width: ${widthMm}mm !important;
            ${heightMm ? `height: ${heightMm}mm !important; max-height: ${heightMm}mm !important;` : ''}
            margin: 0 auto !important;
            padding: 0.6mm 1mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 7.5px;
            line-height: 1.15;
            overflow: hidden !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
            break-after: avoid !important;
            break-inside: avoid !important;
          }
          @media print {
            @page {
              size: ${widthMm}mm ${heightMm ? `${heightMm}mm` : 'auto'};
              margin: 0mm !important;
            }
            html, body {
              width: ${widthMm}mm !important;
              ${heightMm ? `height: ${heightMm}mm !important; max-height: ${heightMm}mm !important;` : ''}
              margin: 0 !important;
              padding: 0.6mm 1mm !important;
              overflow: hidden !important;
              page-break-after: avoid !important;
              page-break-before: avoid !important;
              break-after: avoid !important;
            }
          }
          .sticker-root {
            width: 100% !important;
            ${usableHeightMm ? `height: ${usableHeightMm}mm !important; max-height: ${usableHeightMm}mm !important;` : ''}
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            break-inside: avoid !important;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: 700; }
          .uppercase { text-transform: uppercase; }
          .barcode-container {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            margin: 0.2mm 0;
          }
          .barcode-container svg {
            max-width: 98%;
            height: auto;
          }
        </style>
      </head>
      <body>
        ${contentHtml}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Failed to trigger iframe sticker print', e);
      window.print();
    }
  }, 200);
}
