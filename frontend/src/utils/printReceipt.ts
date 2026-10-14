/**
 * Thermal Receipt Printing Utility
 * Isolates receipt printing inside a hidden iframe to prevent modal, background,
 * and SPA layout clutter from bleeding into the browser print dialog.
 */

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
    <html lang="en">
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
          .border-b-dashed {
            border-bottom: 1px dashed #000000;
            padding-bottom: 5px;
            margin-bottom: 5px;
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
          .muted { color: #333333; }
          .mono { font-family: monospace; }
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
