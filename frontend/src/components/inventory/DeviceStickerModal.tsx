import { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { X, Printer, Check, Smartphone, Settings2, Info } from 'lucide-react';
import { printDeviceSticker } from '../../utils/printSticker';
import { useSettingsStore } from '../../store/settingsStore';

export interface DeviceStickerData {
  id?: number;
  product: {
    name: string;
    brand: string;
    sku?: string;
    storage_gb?: number | null;
    ram_gb?: number | null;
  };
  imei_1?: string | null;
  imei_2?: string | null;
  serial_number?: string | null;
  battery_health?: number | null;
  battery_capacity_mah?: number | null;
  condition?: string;
  default_selling_price?: string | number;
  selling_price?: string | number;
}

interface DeviceStickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: DeviceStickerData | null;
}

type StickerSize = '50x30' | '40x25' | '58roll';

export default function DeviceStickerModal({
  isOpen,
  onClose,
  device,
}: DeviceStickerModalProps) {
  const { settings } = useSettingsStore();
  const [includePrice, setIncludePrice] = useState<boolean>(false);
  const [stickerSize, setStickerSize] = useState<StickerSize>('50x30');
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Determine identifier to encode in barcode
  const barcodeValue =
    device?.imei_1 ||
    device?.serial_number ||
    device?.imei_2 ||
    device?.product.sku ||
    '0000000000';

  const priceValue =
    device?.default_selling_price ?? device?.selling_price ?? null;

  // Render barcode into preview SVG with compact thermal sizing
  useEffect(() => {
    if (isOpen && svgRef.current && barcodeValue) {
      try {
        const isCompact = stickerSize === '40x25';
        const isRoll = stickerSize === '58roll';

        JsBarcode(svgRef.current, barcodeValue, {
          format: 'CODE128',
          width: isCompact ? 0.95 : isRoll ? 1.25 : 1.1,
          height: isCompact ? 14 : isRoll ? 22 : 18,
          displayValue: false,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (err) {
        console.error('JsBarcode rendering error:', err);
      }
    }
  }, [isOpen, barcodeValue, stickerSize]);

  if (!isOpen || !device) return null;

  // Dimensions
  const getDimensions = () => {
    switch (stickerSize) {
      case '40x25':
        return { width: 40, height: 25 };
      case '58roll':
        return { width: 54, height: 35 };
      case '50x30':
      default:
        return { width: 50, height: 30 };
    }
  };

  const { width: widthMm, height: heightMm } = getDimensions();

  // Generate compact printable HTML strictly fitting single page
  const generateStickerHtml = () => {
    const storeName = settings?.store_name || 'BIGHRISSEN PHONE';
    const productName = `${device.product.brand} ${device.product.name}`;
    const storageText = device.product.storage_gb ? `${device.product.storage_gb}GB` : '';
    const ramText = device.product.ram_gb ? `${device.product.ram_gb}GB RAM` : '';
    const specsArray = [storageText, ramText].filter(Boolean);
    const specsString = specsArray.length > 0 ? ` - ${specsArray.join(' / ')}` : '';

    const conditionText =
      device.condition === 'N'
        ? 'Neuf'
        : device.condition
        ? `Grade ${device.condition}`
        : '';
    const batteryText = device.battery_health
      ? `🔋 ${device.battery_health}%`
      : device.battery_capacity_mah
      ? `🔋 ${device.battery_capacity_mah}mAh`
      : '';

    const subDetails = [conditionText, batteryText].filter(Boolean).join(' • ');

    const svgHtml = svgRef.current ? svgRef.current.outerHTML : '';

    const isCompact = stickerSize === '40x25';

    const priceHtml =
      includePrice && priceValue
        ? `<div style="font-weight: 800; font-size: ${isCompact ? '7.5px' : '8.5px'}; border-top: 0.5px solid #000; padding-top: 0.3mm; margin-top: 0.3mm; display: flex; justify-content: space-between; align-items: center; line-height: 1;">
            <span style="font-size: 6.5px; font-weight: 600; text-transform: uppercase;">Prix :</span>
            <span>${parseFloat(priceValue.toString()).toLocaleString('fr-FR')} DH</span>
          </div>`
        : '';

    return `
      <div class="sticker-root">
        <div>
          <!-- Store Header -->
          <div style="font-size: ${isCompact ? '6.8px' : '7.8px'}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 0.5px solid #000; padding-bottom: 0.2mm; margin-bottom: 0.3mm; line-height: 1.1;">
            ${storeName}
          </div>

          <!-- Product Name & Specs -->
          <div style="font-size: ${isCompact ? '7px' : '8px'}; font-weight: 700; line-height: 1.1; max-height: 2.1em; overflow: hidden; text-overflow: ellipsis;">
            ${productName}${specsString}
          </div>

          <!-- Grade & Battery -->
          ${
            subDetails
              ? `<div style="font-size: ${isCompact ? '5.8px' : '6.5px'}; color: #111; font-weight: 600; margin-top: 0.2mm; line-height: 1;">${subDetails}</div>`
              : ''
          }
        </div>

        <!-- Barcode Section -->
        <div style="margin: 0.2mm 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="width: 100%; display: flex; justify-content: center; align-items: center;">
            ${svgHtml}
          </div>
          <div style="font-family: 'Courier New', Courier, monospace; font-size: ${isCompact ? '6px' : '7px'}; font-weight: 700; letter-spacing: 0.4px; margin-top: 0.2mm; line-height: 1;">
            IMEI: ${barcodeValue}
          </div>
          ${
            device.serial_number && device.serial_number !== barcodeValue
              ? `<div style="font-family: 'Courier New', Courier, monospace; font-size: 5.5px; color: #333; line-height: 1;">S/N: ${device.serial_number}</div>`
              : ''
          }
        </div>

        <!-- Optional Price -->
        ${priceHtml}
      </div>
    `;
  };

  const handlePrint = () => {
    const html = generateStickerHtml();
    printDeviceSticker(html, {
      widthMm,
      heightMm: stickerSize === '58roll' ? undefined : heightMm,
      title: `${device.product.brand}_${device.product.name}_Sticker`,
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-alt">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold-border flex items-center justify-center text-gold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text leading-tight">
                Imprimer l'Étiquette Téléphone
              </h3>
              <p className="text-xs text-text-muted">
                Étiquette autocollante pour le dos de l'appareil (1 seule page garantie)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Options Section */}
          <div className="bg-surface-alt/70 border border-border rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-text uppercase tracking-wider">
              <Settings2 className="w-3.5 h-3.5 text-gold" />
              Options d'impression
            </div>

            {/* Price Checkbox - Requested Feature */}
            <label className="flex items-start gap-3 p-3 bg-surface border border-border rounded-lg cursor-pointer hover:border-gold-border/60 transition-all select-none">
              <input
                type="checkbox"
                checked={includePrice}
                onChange={(e) => setIncludePrice(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-gold border-border rounded focus:ring-gold/30 accent-gold cursor-pointer"
              />
              <div className="flex-1">
                <span className="text-sm font-semibold text-text block">
                  Afficher le prix de vente sur l'étiquette
                </span>
                <span className="text-xs text-text-muted">
                  {includePrice
                    ? `Le prix (${priceValue ? `${parseFloat(priceValue.toString()).toLocaleString('fr-FR')} DH` : 'Non défini'}) sera imprimé en bas du sticker.`
                    : 'Non coché : L\'étiquette sera imprimée sans afficher le prix de vente.'}
                </span>
              </div>
            </label>

            {/* Sticker Dimensions Preset */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-2">
                Format de l'étiquette (Taille)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStickerSize('50x30')}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    stickerSize === '50x30'
                      ? 'bg-gold/15 border-gold-border text-gold font-bold shadow-sm'
                      : 'bg-surface border-border text-text-secondary hover:text-text hover:bg-surface-hover'
                  }`}
                >
                  50 × 30 mm
                  <span className="block text-[10px] text-text-muted font-normal">
                    Standard Dos
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setStickerSize('40x25')}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    stickerSize === '40x25'
                      ? 'bg-gold/15 border-gold-border text-gold font-bold shadow-sm'
                      : 'bg-surface border-border text-text-secondary hover:text-text hover:bg-surface-hover'
                  }`}
                >
                  40 × 25 mm
                  <span className="block text-[10px] text-text-muted font-normal">
                    Compact
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setStickerSize('58roll')}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    stickerSize === '58roll'
                      ? 'bg-gold/15 border-gold-border text-gold font-bold shadow-sm'
                      : 'bg-surface border-border text-text-secondary hover:text-text hover:bg-surface-hover'
                  }`}
                >
                  58 mm
                  <span className="block text-[10px] text-text-muted font-normal">
                    Rouleau Ticket
                  </span>
                </button>
              </div>
            </div>

            {/* Print Settings Tip */}
            <div className="flex items-center gap-2 p-2.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
              <Info className="w-4 h-4 flex-shrink-0 text-blue-400" />
              <span>
                <strong>Astuce :</strong> Dans la fenêtre d'impression Chrome, réglez <em>Marges : Aucune (None)</em> si votre imprimante thermique le demande.
              </span>
            </div>
          </div>

          {/* Visual Sticker Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Aperçu en direct ({widthMm} × {heightMm} mm)
              </span>
              <span className="text-[11px] text-text-muted flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-gold" />
                Coller au dos du téléphone
              </span>
            </div>

            {/* Sticker Physical Mockup Card */}
            <div className="p-6 bg-neutral-900 border border-border/80 rounded-xl flex items-center justify-center">
              <div
                style={{
                  width: stickerSize === '40x25' ? '220px' : '270px',
                  minHeight: stickerSize === '40x25' ? '135px' : '155px',
                }}
                className="bg-white text-black p-3 rounded shadow-xl flex flex-col justify-between select-none border border-neutral-300 font-sans leading-tight transition-all"
              >
                {/* Header */}
                <div className="text-center">
                  <div className="font-extrabold text-[10.5px] uppercase tracking-wide border-b border-black pb-0.5 mb-1">
                    {settings?.store_name || 'BIGHRISSEN PHONE'}
                  </div>
                  <div className="font-bold text-[11px] leading-tight text-neutral-900">
                    {device.product.brand} {device.product.name}
                    {device.product.storage_gb && (
                      <span className="text-[9.5px] text-neutral-800 font-normal">
                        {' '}
                        • {device.product.storage_gb}GB
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] font-semibold text-neutral-700 mt-0.5">
                    {device.condition === 'N'
                      ? 'Neuf'
                      : device.condition
                      ? `Grade ${device.condition}`
                      : 'Occasion'}
                    {device.battery_health && ` • 🔋 ${device.battery_health}%`}
                    {device.battery_capacity_mah &&
                      ` • 🔋 ${device.battery_capacity_mah}mAh`}
                  </div>
                </div>

                {/* Barcode representation */}
                <div className="my-1 flex flex-col items-center justify-center">
                  <div className="w-full flex justify-center py-0.5">
                    <svg ref={svgRef} className="max-w-full" />
                  </div>
                  <div className="font-mono text-[9px] font-bold tracking-wider mt-0.5">
                    IMEI: {barcodeValue}
                  </div>
                  {device.serial_number && device.serial_number !== barcodeValue && (
                    <div className="font-mono text-[7.5px] text-neutral-600">
                      SN: {device.serial_number}
                    </div>
                  )}
                </div>

                {/* Optional Price footer */}
                {includePrice && priceValue ? (
                  <div className="border-t border-black pt-1 mt-0.5 flex justify-between items-center text-[11px] font-extrabold text-black">
                    <span className="text-[8.5px] font-medium text-neutral-600 uppercase">
                      Prix :
                    </span>
                    <span>
                      {parseFloat(priceValue.toString()).toLocaleString('fr-FR')}{' '}
                      DH
                    </span>
                  </div>
                ) : (
                  <div className="text-center text-[7px] text-neutral-500 border-t border-dotted border-neutral-300 pt-0.5 mt-0.5">
                    Garantie magasin Bighrissen
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-alt flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-text-secondary hover:text-text hover:bg-surface-hover transition-colors"
          >
            Fermer
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-6 py-2.5 bg-gold hover:bg-gold-bright text-black font-bold rounded-lg text-sm flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-black" />
                Impression envoyée !
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" />
                Imprimer l'Étiquette
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
