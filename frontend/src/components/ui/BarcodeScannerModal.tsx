import { useEffect, useRef, useState, useCallback } from 'react';
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
} from '@zxing/library';
import {
  X,
  Camera,
  AlertCircle,
  Flashlight,
  FlashlightOff,
  FlipHorizontal,
  Barcode,
  Keyboard,
  CheckCircle2,
  RefreshCw,
  Clipboard,
} from 'lucide-react';
import { playBeep } from '../../utils/audio';
import { decodeCode11FromImageData } from '../../utils/code11Decoder';
import { decodeCode128FromImageData } from '../../utils/code128Decoder';
import Quagga from '@ericblade/quagga2';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
  expectedType?: 'imei' | 'serial' | 'any';
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'Scanner Code-Barres / IMEI',
  expectedType = 'any',
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const scanIntervalRef = useRef<any>(null);
  const isDecodingRef = useRef(false);
  const hasScannedRef = useRef(false);
  const frameCountRef = useRef(0);
  const streamShutdownTimerRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Initialize ZXing and BarcodeDetector
  useEffect(() => {
    const hints = new Map<DecodeHintType, any>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.UPC_A,
      BarcodeFormat.CODE_93,
      BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    zxingReaderRef.current = new BrowserMultiFormatReader(hints);

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
              'qr_code',
              'data_matrix',
              'itf',
            ];
            const active = desired.filter((f) => supported.includes(f));
            if (active.length > 0) {
              barcodeDetectorRef.current = new BD({ formats: active });
            }
          })
          .catch(() => {});
      } catch {
        // Fallback to ZXing
      }
    }

    return () => {
      if (zxingReaderRef.current) {
        zxingReaderRef.current.reset();
      }
    };
  }, []);

  // Complete teardown of camera tracks and timers (on component unmount or error recovery)
  const fullStopCamera = useCallback(() => {
    if (streamShutdownTimerRef.current) {
      clearTimeout(streamShutdownTimerRef.current);
      streamShutdownTimerRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // Ignore
      }
      videoRef.current.srcObject = null;
    }
    setIsTorchOn(false);
    setHasTorch(false);
    isDecodingRef.current = false;
    hasScannedRef.current = false;
  }, []);

  // Lightweight pause when modal is closed between consecutive scans (keeps stream warm for 30s)
  const pauseScanning = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // Ignore
      }
    }
    isDecodingRef.current = false;
    hasScannedRef.current = true; // Guard against straggler frames

    // Automatically power down the webcam after 30s if scanner is not reopened
    if (streamShutdownTimerRef.current) {
      clearTimeout(streamShutdownTimerRef.current);
    }
    streamShutdownTimerRef.current = setTimeout(() => {
      fullStopCamera();
    }, 30000);
  }, [fullStopCamera]);

  const handleScanSuccess = useCallback(
    (rawCode: string) => {
      const cleaned = rawCode.trim().replace(/^IMEI[:\s]*/i, '');
      if (!cleaned || hasScannedRef.current) return;

      // Lock synchronously to prevent multiple rapid triggers
      hasScannedRef.current = true;

      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }

      playBeep(true);
      setScannedResult(cleaned);

      setTimeout(() => {
        onScan(cleaned);
        onClose();
      }, 350);
    },
    [onScan, onClose]
  );

  // Decode frame with reticle crop and prioritized Code 11 + Code 128 decoders (<1ms)
  const decodeFrame = useCallback(async () => {
    const video = videoRef.current;
    if (
      !video ||
      video.readyState < video.HAVE_CURRENT_DATA ||
      !video.videoWidth ||
      isDecodingRef.current ||
      hasScannedRef.current
    ) {
      return;
    }

    isDecodingRef.current = true;
    frameCountRef.current++;
    const currentFrame = frameCountRef.current;

    try {
      const vW = video.videoWidth || 640;
      const vH = video.videoHeight || 480;

      // Crop center 88% width and 65% height (giving ample quiet-zone margin for wide 15-digit barcodes)
      const cropW = Math.max(300, Math.floor(vW * 0.88));
      const cropH = Math.max(180, Math.floor(vH * 0.65));
      const cropX = Math.floor((vW - cropW) / 2);
      const cropY = Math.floor((vH - cropH) / 2);

      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      if (canvas.width !== cropW || canvas.height !== cropH) {
        canvas.width = cropW;
        canvas.height = cropH;
      }
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        isDecodingRef.current = false;
        return;
      }

      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      const imgData = ctx.getImageData(0, 0, cropW, cropH);

      // 1. Fast Pure-JS 1D Decoders directly on cropped reticle canvas (<1ms, every tick):
      // 1a. Code 11 (specifically decodes Apple iPhone *#06# on-screen barcodes in < 1ms)
      try {
        const code11 = decodeCode11FromImageData(imgData);
        if (code11 && code11.trim().length >= 10) {
          handleScanSuccess(code11.trim());
          isDecodingRef.current = false;
          return;
        }
      } catch {
        // Normal per-frame decode miss
      }

      // 1b. Code 128 (instantly decodes Android *#06#, device boxes, labels, JsBarcode in < 1ms)
      try {
        const code128 = decodeCode128FromImageData(imgData);
        if (code128 && code128.trim().length >= 6) {
          handleScanSuccess(code128.trim());
          isDecodingRef.current = false;
          return;
        }
      } catch {
        // Normal per-frame decode miss
      }

      // 2. Hardware accelerated BarcodeDetector on cropped canvas (Android Chrome / Edge) - every 2nd frame
      if (barcodeDetectorRef.current && currentFrame % 2 === 0) {
        try {
          const barcodes = await barcodeDetectorRef.current.detect(canvas);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            handleScanSuccess(barcodes[0].rawValue);
            isDecodingRef.current = false;
            return;
          }
        } catch {
          // Fallback to ZXing
        }
      }

      // 3. Quagga2 Locator & Subpixel Edge Decoder (runs every 4th frame to prevent event loop choking)
      if (currentFrame % 4 === 0) {
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const qCode = await new Promise<string | null>((resolve) => {
            Quagga.decodeSingle(
              {
                src: dataUrl,
                numOfWorkers: 0,
                decoder: {
                  readers: ['code_128_reader', 'ean_reader', 'code_39_reader', 'upc_reader'],
                },
                locate: true,
              },
              (res: any) => {
                resolve(res && res.codeResult && res.codeResult.code ? res.codeResult.code : null);
              }
            );
          });
          if (qCode && qCode.trim().length >= 6) {
            handleScanSuccess(qCode.trim());
            isDecodingRef.current = false;
            return;
          }
        } catch {
          // Normal per-frame decode miss
        }
      }

      // 4. Fallback: ZXing MultiFormatReader (runs every 4th frame offset by 2 for QR codes & full video)
      if (zxingReaderRef.current && currentFrame % 4 === 2) {
        const origWarn = console.warn;
        try {
          console.warn = (...args: any[]) => {
            if (typeof args[0] === 'string' && args[0].includes('MultiFormatReader')) return;
            origWarn.apply(console, args);
          };

          let result: any = null;
          try {
            result = zxingReaderRef.current.decode(video);
          } catch {
            // Normal per-frame decode miss
          }

          if (result && result.getText()) {
            handleScanSuccess(result.getText());
            isDecodingRef.current = false;
            return;
          }
        } catch {
          // Normal per-frame decode miss
        } finally {
          console.warn = origWarn;
        }
      }
    } catch {
      // Normal per-frame decode miss
    } finally {
      isDecodingRef.current = false;
    }
  }, [handleScanSuccess]);

  // Keep a mutable ref of decodeFrame so scanInterval never closes over stale state
  const decodeFrameRef = useRef(decodeFrame);
  useEffect(() => {
    decodeFrameRef.current = decodeFrame;
  });

  // Start camera with instant warm-stream reuse and multi-stage fallback
  const startCamera = useCallback(
    async (deviceId?: string) => {
      if (streamShutdownTimerRef.current) {
        clearTimeout(streamShutdownTimerRef.current);
        streamShutdownTimerRef.current = null;
      }

      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }

      // Synchronously reset scanning state
      hasScannedRef.current = false;
      isDecodingRef.current = false;
      setCameraError(null);
      setScannedResult(null);

      // Fast-path: Reuse active warm stream if available (0ms instant camera warm-start!)
      const activeStream = streamRef.current;
      const isWarm =
        activeStream &&
        activeStream.active &&
        activeStream.getVideoTracks().some((t) => t.readyState === 'live');

      if (isWarm && videoRef.current) {
        try {
          videoRef.current.srcObject = activeStream;
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            await playPromise;
          }

          const videoTrack = activeStream.getVideoTracks()[0];
          if (videoTrack) {
            const capabilities: any = videoTrack.getCapabilities?.() || {};
            setHasTorch(!!capabilities.torch);
          }

          // Start scanning loop immediately at 80ms interval
          scanIntervalRef.current = setInterval(() => {
            decodeFrameRef.current?.();
          }, 80);

          setIsRetrying(false);
          return;
        } catch (warmErr: any) {
          if (warmErr.name !== 'AbortError') {
            console.warn('Warm stream play failed, falling back to getUserMedia...', warmErr);
          }
        }
      }

      setIsRetrying(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Votre navigateur ne supporte pas l'accès direct à la caméra.");
        setShowManualInput(true);
        setIsRetrying(false);
        return;
      }

      let stream: MediaStream | null = null;

      // Stage 1: Try with ideal environment constraints
      try {
        const primaryConstraints: MediaStreamConstraints = {
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
              },
        };
        stream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
      } catch (firstErr: any) {
        console.warn('Primary camera constraint failed, attempting simple fallback...', firstErr);

        // Stage 2: Basic fallback without resolution/facingMode constraints (works on standard PC webcams)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: deviceId ? { deviceId: { exact: deviceId } } : true,
          });
        } catch (fallbackErr: any) {
          if (fallbackErr.name === 'AbortError') {
            setIsRetrying(false);
            return;
          }
          console.error('All camera attempts failed:', fallbackErr);

          let friendlyMsg = "Impossible d'accéder à la caméra.";
          if (
            fallbackErr.name === 'NotAllowedError' ||
            fallbackErr.name === 'PermissionDeniedError'
          ) {
            friendlyMsg =
              "Accès caméra refusé. Cliquez sur l'icône de cadenas ou caméra dans la barre d'adresse de Chrome pour autoriser l'accès.";
          } else if (
            fallbackErr.name === 'NotFoundError' ||
            fallbackErr.name === 'DevicesNotFoundError'
          ) {
            friendlyMsg =
              "Aucune caméra détectée sur cet ordinateur (ex: PC de bureau sans webcam). Utilisez une douchette USB ou saisissez l'IMEI ci-dessous.";
          } else if (
            fallbackErr.name === 'NotReadableError' ||
            fallbackErr.name === 'TrackStartError'
          ) {
            friendlyMsg =
              "La caméra est actuellement utilisée par une autre application (ex: Teams, Zoom) ou en cours de réinitialisation.";
          } else {
            friendlyMsg = `Caméra indisponible (${fallbackErr.name || 'Périphérique introuvable'}).`;
          }

          setCameraError(friendlyMsg);
          setShowManualInput(true);
          setIsRetrying(false);
          return;
        }
      }

      setIsRetrying(false);

      if (stream && videoRef.current) {
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        try {
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            await playPromise;
          }

          // Check torch capability
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            const capabilities: any = videoTrack.getCapabilities?.() || {};
            setHasTorch(!!capabilities.torch);
          }

          // Start scanning loop every 80ms
          scanIntervalRef.current = setInterval(() => {
            decodeFrameRef.current?.();
          }, 80);
        } catch (playErr: any) {
          if (playErr.name !== 'AbortError') {
            console.warn('Video play error:', playErr);
          }
        }
      }

      // Enumerate available cameras
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setCameras(videoDevices);
      } catch {
        // Ignore enumeration errors
      }
    },
    []
  );

  // Unconditionally terminate camera tracks on unmount
  useEffect(() => {
    return () => {
      fullStopCamera();
    };
  }, [fullStopCamera]);

  // Handle open / close lifecycle transitions
  useEffect(() => {
    if (isOpen) {
      setScannedResult(null);
      setManualInput('');
      setShowManualInput(false);
      startCamera(selectedCameraId);
    } else {
      pauseScanning();
    }
  }, [isOpen, selectedCameraId, startCamera, pauseScanning]);

  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
      } catch (e) {
        console.error('Torch error', e);
      }
    }
  };

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.deviceId === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextId = cameras[nextIndex].deviceId;
    fullStopCamera();
    setSelectedCameraId(nextId);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleScanSuccess(manualInput.trim());
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setManualInput(text.trim());
        handleScanSuccess(text.trim());
      }
    } catch {
      // Clipboard permission denied or unavailable
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-alt">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gold/15 border border-gold-border flex items-center justify-center text-gold">
              <Barcode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text leading-tight">{title}</h3>
              <p className="text-xs text-text-muted">
                {expectedType === 'imei'
                  ? 'Visez le code-barres 15 chiffres IMEI (boîte ou écran *#06#)'
                  : 'Visez le code-barres ou QR code'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative bg-neutral-950 aspect-[4/3] w-full overflow-hidden flex items-center justify-center">
          {cameraError ? (
            <div className="p-6 text-center text-text space-y-4 max-w-md">
              <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div>
                <h4 className="text-sm font-bold text-text mb-1">Caméra non disponible</h4>
                <p className="text-xs text-text-muted leading-relaxed">{cameraError}</p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    fullStopCamera();
                    startCamera(selectedCameraId);
                  }}
                  disabled={isRetrying}
                  className="px-3.5 py-1.5 bg-surface-alt hover:bg-surface-hover border border-border rounded-lg text-xs font-semibold text-text flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                  Réessayer la caméra
                </button>

                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="px-3.5 py-1.5 bg-gold/20 hover:bg-gold/30 border border-gold-border text-gold rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  Coller l'IMEI
                </button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />

              {/* Scanned Success Overlay */}
              {scannedResult ? (
                <div className="absolute inset-0 bg-green-500/30 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-fadeIn">
                  <CheckCircle2 className="w-16 h-16 text-green-400 mb-2 animate-bounce" />
                  <p className="text-white font-bold text-lg font-mono">{scannedResult}</p>
                  <p className="text-green-200 text-xs">Identifié avec succès !</p>
                </div>
              ) : (
                /* Scanner Reticle */
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-64 h-36 sm:w-72 sm:h-40 border-2 border-gold/70 rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.3)]">
                    {/* Corner accents */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-gold rounded-tl" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-gold rounded-tr" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-gold rounded-bl" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-gold rounded-br" />

                    {/* Animated Laser line */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-gold-bright to-transparent animate-pulse absolute top-1/2 -translate-y-1/2 shadow-[0_0_10px_#e5c158]" />
                  </div>
                </div>
              )}

              {/* In-viewport Controls */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
                {hasTorch && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`p-2.5 rounded-full backdrop-blur-md border transition-all cursor-pointer ${
                      isTorchOn
                        ? 'bg-amber-500 text-black border-amber-400 shadow-lg'
                        : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                    }`}
                    title={isTorchOn ? 'Éteindre la torche' : 'Allumer la torche'}
                  >
                    {isTorchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                  </button>
                )}

                {cameras.length > 1 && (
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="p-2.5 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20 hover:bg-black/80 transition-all cursor-pointer"
                    title="Changer de caméra"
                  >
                    <FlipHorizontal className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer / Input Fallback Area */}
        <div className="p-4 bg-surface border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-gold" />
              Lecteur USB ou caméra compatible
            </span>
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-xs font-semibold text-gold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Keyboard className="w-3.5 h-3.5" />
              {showManualInput ? 'Masquer la saisie' : 'Saisir / Coller manuellement'}
            </button>
          </div>

          {(showManualInput || cameraError) && (
            <form onSubmit={handleManualSubmit} className="flex gap-2 pt-1 animate-fadeIn">
              <input
                type="text"
                autoFocus
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Ex: 358921098451234..."
                className="flex-1 h-10 px-3 bg-surface-alt border border-border rounded-lg text-sm text-text focus:outline-none focus:border-gold-border font-mono"
              />
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                title="Coller depuis le presse-papier"
                className="px-3 h-10 bg-surface-alt hover:bg-surface-hover border border-border text-text-secondary hover:text-text rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Coller</span>
              </button>
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="px-4 h-10 bg-gold hover:bg-gold-bright text-black font-semibold rounded-lg text-xs transition-colors disabled:opacity-40 cursor-pointer"
              >
                Valider
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
