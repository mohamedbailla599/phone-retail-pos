import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
} from '@zxing/library';
import {
  Camera,
  AlertCircle,
  CheckCircle2,
  Loader2,
  User,
  FlipHorizontal,
  Barcode,
  Search,
  UserCheck,
  ShoppingCart,
  Sparkles,
  ArrowRight,
  Wifi,
} from 'lucide-react';
import { decodeCode11FromImageData } from '../utils/code11Decoder';
import client from '../api/client';
import Button from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';
import OperatorSelectionModal from '../components/ui/OperatorSelectionModal';

// Audio feedback helper for POS register chime
function playBeep(success: boolean = true) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (success) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, ctx.currentTime);
      osc.frequency.setValueAtTime(1420, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.16);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    // Ignore audio restrictions
  }
}

interface CartItem {
  id: number;
  name: string;
  price?: string;
  price_sold?: string;
  quantity: number;
}

interface CartSummary {
  id: number;
  receipt_id: string;
  total_amount: string;
  items: CartItem[];
}

// Demo stock items for quick 1-click test simulation
const DEMO_ITEMS = [
  {
    name: 'iPhone 14 Pro 256GB',
    code: '351234567890123',
    badge: 'IMEI',
    price: '9 499 DH',
  },
  {
    name: 'Samsung Galaxy S23 256GB',
    code: '351282612322719',
    badge: 'IMEI',
    price: '7 899 DH',
  },
  {
    name: 'Chargeur 20W USB-C Apple',
    code: 'CHG-20W-APL',
    badge: 'SKU',
    price: '280 DH',
  },
  {
    name: 'Câble Type-C Anker',
    code: 'CBL-TYPEC-ANK',
    badge: 'SKU',
    price: '140 DH',
  },
];

export default function ScannerPage() {
  const { transactionId } = useParams();
  const { operator } = useAuthStore();

  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);

  // Manual input state
  const [manualCode, setManualCode] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Camera devices
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0);

  // Live Cart state
  const [cartSummary, setCartSummary] = useState<CartSummary | null>(null);

  // Non-blocking HUD status notification
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    title: string;
    detail?: string;
  } | null>(null);

  const [lastScanned, setLastScanned] = useState('');
  const [scanCount, setScanCount] = useState(0);

  // Refs for camera and decoding loop
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isScanningRef = useRef(false);
  const isProcessingRef = useRef(false);
  const lastScannedTimeRef = useRef(0);
  const lastScannedCodeRef = useRef('');
  const scanLoopTimerRef = useRef<any>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const zxingReaderRef = useRef<MultiFormatReader | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  const opName = operator?.display_name || operator?.username;

  // Initialize ZXing MultiFormatReader once
  useEffect(() => {
    const hints = new Map<DecodeHintType, any>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.UPC_A,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.EAN_8,
      BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new MultiFormatReader();
    reader.setHints(hints);
    zxingReaderRef.current = reader;

    // Check for native BarcodeDetector support
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const BD = (window as any).BarcodeDetector;
        BD.getSupportedFormats()
          .then((supported: string[]) => {
            const desired = [
              'code_128',
              'ean_13',
              'upc_a',
              'code_39',
              'code_93',
              'ean_8',
              'qr_code',
            ];
            const active = desired.filter((f) => supported.includes(f));
            if (active.length > 0) {
              barcodeDetectorRef.current = new BD({ formats: active });
            }
          })
          .catch(() => {});
      } catch (e) {
        // Fallback to ZXing
      }
    }
  }, []);

  // Fetch current sale cart summary
  const fetchCart = useCallback(async () => {
    if (!transactionId) return;
    try {
      const res = await client.get(`/sales/${transactionId}/`);
      setCartSummary(res.data);
    } catch (e) {
      // Sale might be new
    }
  }, [transactionId]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Enumerate video cameras
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          if (videoInputs.length > 0) {
            setVideoDevices(videoInputs);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Process barcode against backend
  const handleBarcodeScanned = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed || trimmed.length < 3 || isProcessingRef.current) return;

      const now = Date.now();
      // Debounce: prevent duplicate burst scans of the same code within 2.5 seconds
      if (trimmed === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 2500) {
        return;
      }
      // Minimum interval between distinct scans
      if (now - lastScannedTimeRef.current < 750) {
        return;
      }

      isProcessingRef.current = true;
      lastScannedTimeRef.current = now;
      lastScannedCodeRef.current = trimmed;

      try {
        const response = await client.post(`/sales/${transactionId}/scan/`, {
          barcode: trimmed,
        });

        playBeep(true);
        setLastScanned(trimmed);
        setScanCount((c) => c + 1);

        const itemName = response.data?.item?.name || trimmed;
        const price = response.data?.item?.price
          ? `${parseFloat(response.data.item.price).toLocaleString('fr-MA')} DH`
          : '';

        setStatusMessage({
          type: 'success',
          title: itemName,
          detail: price ? `${price} · Ajouté à la caisse en direct` : 'Ajouté à la caisse en direct',
        });

        fetchCart();

        setTimeout(() => {
          setStatusMessage(null);
          isProcessingRef.current = false;
        }, 2200);
      } catch (err: any) {
        playBeep(false);
        const detail =
          err.response?.data?.error ||
          err.response?.data?.detail ||
          `Article "${trimmed}" non trouvé dans l'inventaire en stock.`;

        setStatusMessage({
          type: 'error',
          title: 'Article introuvable',
          detail: detail,
        });

        setTimeout(() => {
          setStatusMessage(null);
          isProcessingRef.current = false;
        }, 2500);
      }
    },
    [transactionId, fetchCart]
  );

  // Stop camera and clear scan loops
  const stopCamera = useCallback(() => {
    isScanningRef.current = false;
    if (scanLoopTimerRef.current) {
      clearInterval(scanLoopTimerRef.current);
      scanLoopTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setStartingCamera(false);
  }, []);

  // Frame decoding loop executed periodically
  const decodeFrame = useCallback(async () => {
    if (!isScanningRef.current || isProcessingRef.current || !videoRef.current) return;
    const video = videoRef.current;

    // Verify video is actually delivering frames
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0 || video.paused) {
      return;
    }

    // 1. Try native BarcodeDetector (fastest, GPU-accelerated on Chrome)
    if (barcodeDetectorRef.current) {
      try {
        const detected = await barcodeDetectorRef.current.detect(video);
        if (detected && detected.length > 0) {
          const raw = detected[0].rawValue;
          if (raw && raw.trim().length >= 3) {
            handleBarcodeScanned(raw.trim());
            return;
          }
        }
      } catch (e) {
        // Fallback to ZXing canvas decoding
      }
    }

    // 2. Fallback to ZXing MultiFormatReader via hidden off-screen canvas
    if (zxingReaderRef.current) {
      try {
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }
        const canvas = canvasRef.current;
        const width = Math.min(video.videoWidth, 1280);
        const height = Math.min(video.videoHeight, 720);

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);

        // 2a. Real-time Code 11 (USD-8) decoder
        const code11 = decodeCode11FromImageData(imgData);
        if (code11 && code11.trim().length >= 3) {
          handleBarcodeScanned(code11.trim());
          return;
        }

        // 2b. ZXing MultiFormatReader (Code 128, EAN-13, UPC, Code 39, QR)
        const lumSource = new RGBLuminanceSource(imgData.data, width, height);
        const bitmap = new BinaryBitmap(new HybridBinarizer(lumSource));
        const result = zxingReaderRef.current.decodeWithState(bitmap);

        if (result && result.getText()) {
          const text = result.getText().trim();
          if (text.length >= 3) {
            handleBarcodeScanned(text);
          }
        }
      } catch (e) {
        // NotFoundException is normal when no barcode is in frame
      }
    }
  }, [handleBarcodeScanned]);

  // Start Camera with standard getUserMedia
  const startCamera = useCallback(async () => {
    stopCamera();
    setStartingCamera(true);
    setStatusMessage(null);

    try {
      const dev = videoDevices[selectedDeviceIndex];
      const deviceId = dev?.deviceId;

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
            },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video metadata to play
        await videoRef.current.play();

        setCameraActive(true);
        setStartingCamera(false);
        isScanningRef.current = true;

        // Start scanning loop every 100ms (10 frames per second)
        scanLoopTimerRef.current = setInterval(() => {
          decodeFrame();
        }, 100);
      }
    } catch (err: any) {
      console.error('Camera access failed:', err);
      setStartingCamera(false);
      setCameraActive(false);
      setStatusMessage({
        type: 'error',
        title: "Impossible d'accéder à la caméra",
        detail:
          "Veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur, ou utilisez la saisie manuelle.",
      });
    }
  }, [selectedDeviceIndex, videoDevices, stopCamera, decodeFrame]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Handle manual submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    setManualSubmitting(true);
    await handleBarcodeScanned(manualCode.trim());
    setManualCode('');
    setManualSubmitting(false);
    manualInputRef.current?.focus();
  };

  // Flip camera between available inputs
  const handleFlipCamera = () => {
    if (videoDevices.length > 1) {
      setSelectedDeviceIndex((prev) => (prev + 1) % videoDevices.length);
      setTimeout(() => startCamera(), 150);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0e] flex flex-col font-[Inter,system-ui,sans-serif] select-none text-slate-100">
      {/* Top Header */}
      <header className="px-5 py-3.5 border-b border-[#232733] bg-[#11131a] flex items-center justify-between sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/5 border border-amber-500/30 flex items-center justify-center overflow-hidden p-0.5 shadow-[0_0_15px_rgba(212,175,90,0.15)]">
            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover rounded-lg" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">Bighrissen Phone</h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-400 tracking-wide">
                POS SCANNER
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
              Terminal Mobile & Caisse Haute Précision
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/pos"
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181b24] hover:bg-[#202532] border border-[#2d3242] text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm"
          >
            <span>Retour Caisse</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400">
            <Wifi className="w-3.5 h-3.5" />
            <span>Connecté</span>
          </div>
        </div>
      </header>

      {/* Meta Bar: Transaction ID, Cart Items & Operator */}
      <div className="px-5 py-2.5 border-b border-[#1f232e] bg-[#14161f] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="text-slate-400 font-medium">Vente en cours :</span>
          <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded font-mono font-bold text-xs">
            #{transactionId}
          </span>
          {cartSummary && (
            <span className="text-xs text-slate-300 flex items-center gap-1.5 bg-[#1b1e2a] px-2.5 py-0.5 rounded-md border border-[#292e3f]">
              <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
              <span>
                <strong>{cartSummary.items?.length || 0}</strong> article(s) ·{' '}
                <strong className="text-amber-400 font-mono">
                  {parseFloat(cartSummary.total_amount || '0').toLocaleString('fr-MA')} DH
                </strong>
              </span>
            </span>
          )}
        </div>

        {/* Operator Badge */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Opérateur :</span>
          {operator ? (
            <button
              onClick={() => setIsOpModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#1b1e2a] border border-amber-500/40 text-amber-300 font-semibold text-xs hover:bg-amber-500/15 transition-all shadow-sm"
              title="Changer d'opérateur"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>{opName}</span>
              <span className="text-[10px] text-slate-400 underline ml-1">Changer</span>
            </button>
          ) : (
            <button
              onClick={() => setIsOpModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold text-xs hover:bg-amber-500/30 transition-all animate-pulse"
              title="Sélectionnez un opérateur"
            >
              <User className="w-3.5 h-3.5" />
              <span>Sélectionner un opérateur</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Layout: Camera on Left, Tools & Cart on Right */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Camera Viewport (lg:col-span-7) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="w-full rounded-2xl overflow-hidden border-2 border-[#2b3142] relative bg-[#06070a] shadow-2xl flex flex-col items-center justify-center min-h-[380px] sm:min-h-[440px]">
            {/* If Camera Not Active: Start Button */}
            {!cameraActive && (
              <div className="text-center p-8 max-w-sm w-full space-y-5 my-auto">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/5 border border-amber-500/30 flex items-center justify-center shadow-[0_0_35px_rgba(212,175,90,0.12)]">
                  <Camera className="w-10 h-10 text-amber-400" />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-white mb-1.5">Caméra Scanner</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Pointez la caméra vers le code-barres (Code-128 pour IMEI téléphones, EAN pour accessoires) pour ajouter au panier.
                  </p>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  className="w-full font-bold shadow-xl shadow-amber-500/10 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 border-0"
                  icon={startingCamera ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                  disabled={startingCamera}
                  onClick={startCamera}
                >
                  {startingCamera ? 'Activation de la caméra...' : 'Activer la Caméra'}
                </Button>
              </div>
            )}

            {/* Direct React HTML5 Video Element (ALWAYS mounted and styled) */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full min-h-[380px] sm:min-h-[440px] object-cover bg-black ${
                !cameraActive ? 'hidden' : 'block'
              }`}
            />

            {/* Scanner HUD Overlay (When Camera Active) */}
            {cameraActive && (
              <>
                {/* 4 Golden Corner Reticles */}
                <div className="absolute inset-5 pointer-events-none flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-10 h-10 border-t-2 border-l-2 border-amber-400/80 rounded-tl-xl shadow-[0_0_12px_rgba(212,175,90,0.4)]" />
                    <div className="w-10 h-10 border-t-2 border-r-2 border-amber-400/80 rounded-tr-xl shadow-[0_0_12px_rgba(212,175,90,0.4)]" />
                  </div>
                  <div className="flex justify-between">
                    <div className="w-10 h-10 border-b-2 border-l-2 border-amber-400/80 rounded-bl-xl shadow-[0_0_12px_rgba(212,175,90,0.4)]" />
                    <div className="w-10 h-10 border-b-2 border-r-2 border-amber-400/80 rounded-br-xl shadow-[0_0_12px_rgba(212,175,90,0.4)]" />
                  </div>
                </div>

                {/* Animated Gold Laser Line */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_16px_#d4af5a]" />
                </div>

                {/* Top Floating Controls */}
                <div className="absolute top-3 right-3 flex items-center gap-2 z-30">
                  {videoDevices.length > 1 && (
                    <button
                      onClick={handleFlipCamera}
                      className="p-2 rounded-xl bg-black/75 backdrop-blur-md border border-white/20 text-white hover:text-amber-400 hover:border-amber-400/50 transition-all shadow-md"
                      title="Basculer de caméra"
                    >
                      <FlipHorizontal className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={stopCamera}
                    className="px-3.5 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/20 text-xs font-semibold text-white hover:bg-rose-500/60 hover:border-rose-400 transition-all shadow-md"
                  >
                    Arrêter
                  </button>
                </div>

                {/* Bottom Viewport Status Pill */}
                <div className="absolute bottom-3 left-3 z-30 flex items-center gap-2 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-[11px] text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Scanner Actif · Détection Continue</span>
                </div>
              </>
            )}

            {/* Non-blocking Floating HUD Status Notification */}
            {statusMessage && (
              <div
                className={`absolute top-4 left-4 right-4 z-40 p-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top duration-200 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-950/95 border-emerald-500/70 text-emerald-100'
                    : 'bg-rose-950/95 border-rose-500/70 text-rose-100'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-bold text-sm text-white">{statusMessage.title}</p>
                  {statusMessage.detail && (
                    <p className="text-xs opacity-90 mt-0.5 leading-snug">{statusMessage.detail}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Telemetry Status Bar: Last Scanned Code & Total Counter */}
          <div className="p-3.5 rounded-xl bg-[#141722] border border-[#242938] flex items-center justify-between text-xs">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Dernier code scanné</p>
              <p className="font-mono font-bold text-amber-400 text-xs mt-0.5">
                {lastScanned || 'En attente de scan...'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-[11px]">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>{scanCount} article{scanCount > 1 ? 's' : ''} scanné{scanCount > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Live POS Cart, Manual Input & Quick 1-Click Test Chips (lg:col-span-5) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Live Mini Cart Summary */}
          <div className="w-full bg-[#11131b] border border-[#242838] rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Panier Caisse</h3>
                  <p className="text-[10px] text-slate-400">Vente #{transactionId}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Net</p>
                <p className="text-base font-bold font-mono text-amber-400">
                  {cartSummary?.total_amount
                    ? `${parseFloat(cartSummary.total_amount).toLocaleString('fr-MA')} DH`
                    : '0,00 DH'}
                </p>
              </div>
            </div>

            {/* Cart Items List */}
            {cartSummary && cartSummary.items && cartSummary.items.length > 0 ? (
              <div className="border-t border-[#1e2330] pt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {cartSummary.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-[#161924] border border-[#252b3d] flex items-center justify-between text-xs hover:border-amber-500/30 transition-colors"
                  >
                    <div className="truncate pr-2">
                      <p className="font-semibold text-slate-200 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400">Qté : {item.quantity}</p>
                    </div>
                    <span className="font-mono font-bold text-amber-400 flex-shrink-0">
                      {parseFloat(item.price || item.price_sold || '0').toLocaleString('fr-MA')} DH
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-t border-[#1e2330] pt-4 pb-2 text-center text-slate-500 text-xs">
                <p>Aucun article scanné pour le moment.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Scannez un code-barres pour l'ajouter au panier.</p>
              </div>
            )}

            {/* Button to Complete in POS */}
            <Link
              to="/pos"
              className="w-full py-2.5 px-3 rounded-xl bg-[#1a1e2a] hover:bg-[#23293a] border border-[#2f3547] hover:border-amber-500/40 text-xs font-bold text-slate-200 hover:text-white flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <span>Accéder à la Caisse (POS)</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </Link>
          </div>

          {/* Manual Input / USB Barcode Gun */}
          <div className="w-full bg-[#11131b] border border-[#242838] rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-amber-400" /> Saisie Manuelle ou Douchette USB
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Touche Entrée pour valider</span>
            </div>

            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={manualInputRef}
                  type="text"
                  placeholder="Code-barres, IMEI ou SKU..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full pl-3 pr-3 py-2.5 bg-[#161924] border border-[#2b3142] rounded-xl text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition-colors shadow-inner"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={manualSubmitting || !manualCode.trim()}
                className="px-4 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 border-0 rounded-xl"
                icon={manualSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              >
                Valider
              </Button>
            </form>
          </div>

          {/* Quick Demo Test Chips */}
          <div className="w-full bg-[#11131b] border border-[#242838] rounded-2xl p-4 shadow-xl space-y-3">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Articles en stock (Test 1-Clic)
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Cliquez pour simuler un scan immédiat</p>
            </div>

            <div className="space-y-2">
              {DEMO_ITEMS.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-[#161924] border border-[#232838] hover:border-amber-500/40 flex items-center justify-between text-xs transition-colors"
                >
                  <div className="truncate pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-200 text-xs">{item.name}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-mono">
                        {item.badge}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-slate-400 mt-0.5">{item.code}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleBarcodeScanned(item.code)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-bold text-amber-300 transition-colors flex-shrink-0"
                    title="Simuler un scan instantané"
                  >
                    Scanner
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-5 py-3 border-t border-[#1e2330] text-center bg-[#10121a] mt-auto">
        <p className="text-[11px] text-slate-500 font-medium">
          Bighrissen Phone · Système d'Encaissement & Scanner Mobile Connecté
        </p>
      </footer>

      {/* Operator Selection Modal */}
      <OperatorSelectionModal
        isOpen={isOpModalOpen}
        onClose={() => setIsOpModalOpen(false)}
        onSelect={() => setIsOpModalOpen(false)}
        title="Sélectionner l'opérateur"
        description="Choisissez quel propriétaire encaisse et enregistre les articles scannés."
      />
    </div>
  );
}
